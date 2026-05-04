'use client';

import { useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Eye,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Package,
  Truck,
  ClipboardCheck,
  ShieldCheck,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { POReportItem, POReportGroupBy, POEtdStatus } from './types';

interface Props {
  items: POReportItem[];
  groupBy: POReportGroupBy;
  selectedIds: Set<number>;
  onToggleSelect: (id: number) => void;
  onToggleSelectAll: () => void;
  onOpenDetail: (item: POReportItem) => void;
  selectedDetailId: number | null;
  sortBy: string;
  sortDir: 'asc' | 'desc';
  onSort: (key: string) => void;
}

type GroupKey = string;
interface Group {
  key: GroupKey;
  label: string;
  rows: POReportItem[];
  totalQty: number;
  totalValue: number;
  overdueCount: number;
}

const dateFmt = (s: string | null) => {
  if (!s) return '—';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const numFmt = (n: number) => new Intl.NumberFormat('en-US').format(n);

const moneyFmt = (n: number, currency: string | null) => {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `${currency || '$'} ${numFmt(n)}`;
  }
};

const STATUS_BAR_CLASS: Record<string, string> = {
  draft: 'bg-amber-400',
  active: 'bg-emerald-500',
  in_progress: 'bg-blue-500',
  completed: 'bg-purple-500',
  cancelled: 'bg-red-500',
};

const STATUS_BADGE_CLASS: Record<string, string> = {
  draft: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900 dark:text-amber-300',
  active: 'bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900 dark:text-emerald-300',
  in_progress: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900 dark:text-blue-300',
  completed: 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900 dark:text-purple-300',
  cancelled: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900 dark:text-red-300',
};

function StatusBadge({ status }: { status: string }) {
  const klass = STATUS_BADGE_CLASS[status] ?? 'bg-muted';
  return (
    <Badge variant="outline" className={cn('text-[10px] capitalize whitespace-nowrap', klass)}>
      {status?.replace(/_/g, ' ') ?? 'unknown'}
    </Badge>
  );
}

function EtdCell({ etdDate, etdStatus }: { etdDate: string | null; etdStatus: POEtdStatus }) {
  if (!etdDate) return <span className="text-muted-foreground text-xs">—</span>;
  const cls =
    etdStatus === 'overdue'
      ? 'text-red-600 font-semibold'
      : etdStatus === 'urgent'
        ? 'text-amber-600 font-medium'
        : etdStatus === 'soon'
          ? 'text-yellow-700'
          : 'text-foreground';
  const label =
    etdStatus === 'overdue'
      ? 'Overdue'
      : etdStatus === 'urgent'
        ? '≤ 7 days'
        : etdStatus === 'soon'
          ? '≤ 30 days'
          : null;
  return (
    <div className="flex flex-col">
      <span className={cn('text-xs', cls)}>{dateFmt(etdDate)}</span>
      {label && <span className={cn('text-[10px]', cls)}>{label}</span>}
    </div>
  );
}

function ProgressIcons({ item }: { item: POReportItem }) {
  // Compact cross-domain status pillbox: production / samples / shipments / quality.
  // Each shows total + alert color when something needs attention.
  const cells: Array<{
    icon: React.ReactNode;
    title: string;
    total: number;
    primary: number;
    primaryClass: string;
    alert: boolean;
  }> = [
    {
      icon: <Package className="h-3 w-3" />,
      title: 'Production',
      total: item.production_summary.total,
      primary: item.production_summary.completed,
      primaryClass: 'text-emerald-600',
      alert: false,
    },
    {
      icon: <ClipboardCheck className="h-3 w-3" />,
      title: 'Samples',
      total: item.samples_summary.total,
      primary: item.samples_summary.approved,
      primaryClass: 'text-emerald-600',
      alert: item.samples_summary.rejected > 0,
    },
    {
      icon: <Truck className="h-3 w-3" />,
      title: 'Shipments',
      total: item.shipments_summary.total,
      primary: item.shipments_summary.delivered,
      primaryClass: 'text-emerald-600',
      alert: item.shipments_summary.overdue > 0,
    },
    {
      icon: <ShieldCheck className="h-3 w-3" />,
      title: 'Quality',
      total: item.quality_summary.total,
      primary: item.quality_summary.passed,
      primaryClass: 'text-emerald-600',
      alert: item.quality_summary.failed > 0,
    },
  ];

  return (
    <div className="flex items-center gap-1.5">
      {cells.map((c, i) => (
        <div
          key={i}
          title={`${c.title}: ${c.primary}/${c.total}`}
          className={cn(
            'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] tabular-nums',
            c.alert ? 'border-red-200 bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300' : 'bg-muted/40',
          )}
        >
          <span className={c.alert ? 'text-red-600' : 'text-muted-foreground'}>{c.icon}</span>
          <span className={c.alert ? 'text-red-700 font-medium' : 'text-foreground'}>
            {c.primary}/{c.total}
          </span>
        </div>
      ))}
    </div>
  );
}

function groupItems(items: POReportItem[], groupBy: POReportGroupBy): Group[] {
  if (groupBy === 'none') {
    return [
      {
        key: 'all',
        label: 'All',
        rows: items,
        totalQty: items.reduce((s, i) => s + i.total_quantity, 0),
        totalValue: items.reduce((s, i) => s + i.total_value, 0),
        overdueCount: items.filter((i) => i.etd_status === 'overdue').length,
      },
    ];
  }

  const map = new Map<string, Group>();
  for (const item of items) {
    let key: string;
    let label: string;
    switch (groupBy) {
      case 'retailer':
        key = `retailer:${item.retailer_id ?? 'none'}`;
        label = item.retailer_name ?? '— No retailer —';
        break;
      case 'buyer':
        key = `buyer:${item.buyer_id ?? 'none'}`;
        label = item.buyer_name ?? '— No buyer —';
        break;
      case 'agency':
        key = `agency:${item.agency_id ?? 'none'}`;
        label = item.agency_name ?? '— No agency —';
        break;
      case 'season':
        key = `season:${item.season_id ?? 'none'}`;
        label = item.season_name ?? '— No season —';
        break;
      case 'status':
        key = `status:${item.status}`;
        label = item.status?.replace(/_/g, ' ') ?? 'unknown';
        break;
      case 'month': {
        if (item.po_date) {
          const d = new Date(item.po_date);
          key = `month:${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        } else {
          key = 'month:none';
          label = '— No PO date —';
        }
        break;
      }
      default:
        key = 'all';
        label = 'All';
    }
    let group = map.get(key);
    if (!group) {
      group = { key, label, rows: [], totalQty: 0, totalValue: 0, overdueCount: 0 };
      map.set(key, group);
    }
    group.rows.push(item);
    group.totalQty += item.total_quantity;
    group.totalValue += item.total_value;
    if (item.etd_status === 'overdue') group.overdueCount++;
  }
  // Stable sort by label
  return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
}

function SortableHeader({
  label,
  sortKey,
  currentSort,
  currentDir,
  onSort,
  className,
}: {
  label: string;
  sortKey: string;
  currentSort: string;
  currentDir: 'asc' | 'desc';
  onSort: (key: string) => void;
  className?: string;
}) {
  const active = currentSort === sortKey;
  return (
    <TableHead className={className}>
      <button
        className="flex items-center gap-1 text-xs font-medium hover:text-foreground transition-colors"
        onClick={() => onSort(sortKey)}
      >
        {label}
        {active && currentDir === 'asc' ? (
          <ArrowUp className="h-3 w-3" />
        ) : active && currentDir === 'desc' ? (
          <ArrowDown className="h-3 w-3" />
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-40" />
        )}
      </button>
    </TableHead>
  );
}

export function POReportTableView({
  items,
  groupBy,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  onOpenDetail,
  selectedDetailId,
  sortBy,
  sortDir,
  onSort,
}: Props) {
  const groups = useMemo(() => groupItems(items, groupBy), [items, groupBy]);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  // Reset collapse state when grouping mode changes so users don't get stuck looking
  // at a fully-collapsed table after switching dimensions.
  useEffect(() => {
    setCollapsed(new Set());
  }, [groupBy]);

  const toggleGroup = (key: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const allSelected = items.length > 0 && items.every((i) => selectedIds.has(i.id));

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-10">
              <Checkbox checked={allSelected} onCheckedChange={onToggleSelectAll} />
            </TableHead>
            <TableHead className="w-2 p-0" />
            <SortableHeader label="PO #" sortKey="po_number" currentSort={sortBy} currentDir={sortDir} onSort={onSort} />
            <TableHead className="text-xs">Retailer / Buyer</TableHead>
            <TableHead className="text-xs">Agency / Factory</TableHead>
            <SortableHeader label="PO Date" sortKey="po_date" currentSort={sortBy} currentDir={sortDir} onSort={onSort} />
            <SortableHeader label="ETD" sortKey="etd_date" currentSort={sortBy} currentDir={sortDir} onSort={onSort} />
            <SortableHeader
              label="Qty"
              sortKey="total_quantity"
              currentSort={sortBy}
              currentDir={sortDir}
              onSort={onSort}
              className="text-right"
            />
            <SortableHeader
              label="Value"
              sortKey="total_value"
              currentSort={sortBy}
              currentDir={sortDir}
              onSort={onSort}
              className="text-right"
            />
            <TableHead className="text-xs">Progress</TableHead>
            <SortableHeader label="Status" sortKey="status" currentSort={sortBy} currentDir={sortDir} onSort={onSort} />
            <TableHead className="text-xs text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.length === 0 && (
            <TableRow>
              <TableCell colSpan={12} className="text-center text-muted-foreground py-12">
                No purchase orders match the current filters.
              </TableCell>
            </TableRow>
          )}
          {groups.map((group) => (
            <GroupBlock
              key={group.key}
              group={group}
              groupBy={groupBy}
              isCollapsed={collapsed.has(group.key)}
              onToggle={() => toggleGroup(group.key)}
              selectedIds={selectedIds}
              onToggleSelect={onToggleSelect}
              onOpenDetail={onOpenDetail}
              selectedDetailId={selectedDetailId}
            />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function GroupBlock({
  group,
  groupBy,
  isCollapsed,
  onToggle,
  selectedIds,
  onToggleSelect,
  onOpenDetail,
  selectedDetailId,
}: {
  group: Group;
  groupBy: POReportGroupBy;
  isCollapsed: boolean;
  onToggle: () => void;
  selectedIds: Set<number>;
  onToggleSelect: (id: number) => void;
  onOpenDetail: (item: POReportItem) => void;
  selectedDetailId: number | null;
}) {
  const showHeader = groupBy !== 'none';

  return (
    <>
      {showHeader && (
        <TableRow
          key={`${group.key}-header`}
          className="bg-muted/40 hover:bg-muted/60 cursor-pointer"
          onClick={onToggle}
        >
          <TableCell colSpan={3}>
            <div className="flex items-center gap-2">
              {isCollapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              <span className="text-sm font-semibold">{group.label}</span>
              <Badge variant="outline" className="text-[10px]">
                {group.rows.length} PO{group.rows.length !== 1 ? 's' : ''}
              </Badge>
              {group.overdueCount > 0 && (
                <Badge variant="outline" className="text-[10px] border-red-300 text-red-700 bg-red-50 dark:bg-red-950 dark:text-red-300">
                  <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
                  {group.overdueCount} overdue
                </Badge>
              )}
            </div>
          </TableCell>
          <TableCell colSpan={4} className="text-xs text-muted-foreground">
            {numFmt(group.totalQty)} units total
          </TableCell>
          <TableCell className="text-right text-xs font-semibold">{numFmt(group.totalQty)}</TableCell>
          <TableCell className="text-right text-xs font-semibold">{moneyFmt(group.totalValue, 'USD')}</TableCell>
          <TableCell colSpan={3} />
        </TableRow>
      )}

      {!isCollapsed &&
        group.rows.map((item, idx) => {
          const isSelected = selectedDetailId === item.id;
          const checked = selectedIds.has(item.id);
          // Fall back to a positional key so a row missing its id (defensive
          // against unexpected backend payloads) doesn't trigger React's
          // "each child should have a unique key" warning.
          const rowKey = item.id != null ? `po-${item.id}` : `${group.key}-row-${idx}`;
          return (
            <TableRow
              key={rowKey}
              className={cn(
                'cursor-pointer transition-colors',
                isSelected && 'bg-primary/5 hover:bg-primary/10',
                item.etd_status === 'overdue' && !isSelected && 'bg-red-50/50 hover:bg-red-50 dark:bg-red-950/20',
              )}
              onClick={() => onOpenDetail(item)}
            >
              <TableCell onClick={(e) => e.stopPropagation()}>
                <Checkbox checked={checked} onCheckedChange={() => onToggleSelect(item.id)} />
              </TableCell>
              <TableCell className="p-0">
                <div className={cn('w-1 h-10 rounded-r', STATUS_BAR_CLASS[item.status] ?? 'bg-muted-foreground/30')} />
              </TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <span className="text-sm font-semibold">{item.po_number}</span>
                  {item.headline && (
                    <span className="text-[11px] text-muted-foreground line-clamp-1 max-w-[220px]">
                      {item.headline}
                    </span>
                  )}
                  {item.buy_sheet_number && (
                    <Badge variant="outline" className="text-[9px] mt-0.5 w-fit">
                      Buy Sheet #{item.buy_sheet_number}
                    </Badge>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <span className="text-xs">{item.retailer_name ?? '—'}</span>
                  <span className="text-[11px] text-muted-foreground">
                    {item.buyer_name ?? '—'}
                    {item.buyer_code ? ` · ${item.buyer_code}` : ''}
                  </span>
                </div>
              </TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <span className="text-xs">{item.agency_name ?? '—'}</span>
                  <span className="text-[11px] text-muted-foreground line-clamp-1 max-w-[160px]">
                    {item.factories.length > 0 ? item.factories.map((f) => f.name).join(', ') : '— No factory —'}
                  </span>
                </div>
              </TableCell>
              <TableCell className="text-xs">{dateFmt(item.po_date)}</TableCell>
              <TableCell>
                <EtdCell etdDate={item.etd_date} etdStatus={item.etd_status} />
              </TableCell>
              <TableCell className="text-right text-xs tabular-nums">{numFmt(item.total_quantity)}</TableCell>
              <TableCell className="text-right text-xs tabular-nums font-medium">
                {moneyFmt(item.total_value, item.currency_code)}
              </TableCell>
              <TableCell>
                <ProgressIcons item={item} />
              </TableCell>
              <TableCell>
                <StatusBadge status={item.status} />
              </TableCell>
              <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                <div className="flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0"
                    title="Open detail panel"
                    onClick={() => onOpenDetail(item)}
                  >
                    <Eye className="h-3.5 w-3.5" />
                  </Button>
                  <Link href={`/purchase-orders/${item.id}`} target="_blank" rel="noreferrer">
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Open PO in new tab">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </Button>
                  </Link>
                </div>
              </TableCell>
            </TableRow>
          );
        })}
    </>
  );
}

