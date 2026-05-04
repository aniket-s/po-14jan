'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  X,
  ExternalLink,
  Loader2,
  Calendar,
  Package,
  Truck,
  ClipboardCheck,
  ShieldCheck,
  AlertTriangle,
  Building2,
} from 'lucide-react';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import type { POReportItem } from './types';

interface Props {
  item: POReportItem;
  onClose: () => void;
}

const dateFmt = (s: string | null | undefined) => {
  if (!s) return '—';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const moneyFmt = (n: number, currency: string | null) => {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `${currency || '$'} ${n.toLocaleString()}`;
  }
};

const numFmt = (n: number) => new Intl.NumberFormat('en-US').format(n);

export function POReportDetailPanel({ item, onClose }: Props) {
  const [tab, setTab] = useState('overview');
  const [stylesData, setStylesData] = useState<any[] | null>(null);
  const [loadingStyles, setLoadingStyles] = useState(false);

  // Lazy-load styles when the user opens the Styles tab. Detail panel stays light
  // by default - no waterfall on every row click.
  useEffect(() => {
    if (tab !== 'styles' || stylesData !== null) return;
    let cancelled = false;
    setLoadingStyles(true);
    api
      .get(`/purchase-orders/${item.id}`)
      .then((r) => {
        if (cancelled) return;
        setStylesData(r.data?.styles ?? r.data?.purchase_order?.styles ?? []);
      })
      .catch(() => {
        if (cancelled) return;
        setStylesData([]);
      })
      .finally(() => {
        if (cancelled) return;
        setLoadingStyles(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tab, item.id, stylesData]);

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-full sm:w-[480px] md:w-[560px] bg-background border-l shadow-xl flex flex-col animate-in slide-in-from-right-4 duration-200">
      {/* Header */}
      <div className="flex items-start justify-between px-4 pt-4 pb-3 border-b">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-lg font-bold">{item.po_number}</span>
            <StatusBadge status={item.status} />
            {item.etd_status === 'overdue' && (
              <Badge variant="outline" className="text-[10px] border-red-300 text-red-700 bg-red-50">
                <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
                Overdue ETD
              </Badge>
            )}
          </div>
          {item.headline && (
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{item.headline}</p>
          )}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {item.shipping_term && (
              <Badge variant="outline" className="text-[10px]">
                {item.shipping_term}
              </Badge>
            )}
            {item.season_name && (
              <Badge variant="outline" className="text-[10px]">
                {item.season_name}
              </Badge>
            )}
            {item.country_name && (
              <Badge variant="outline" className="text-[10px]">
                {item.country_name}
              </Badge>
            )}
            {item.buy_sheet_number && (
              <Badge variant="outline" className="text-[10px]">
                Buy Sheet #{item.buy_sheet_number}
              </Badge>
            )}
          </div>
        </div>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Stat strip */}
      <div className="grid grid-cols-3 gap-2 px-4 py-3 border-b bg-muted/30">
        <Stat label="Styles" value={numFmt(item.styles_count)} />
        <Stat label="Quantity" value={numFmt(item.total_quantity)} />
        <Stat label="Value" value={moneyFmt(item.total_value, item.currency_code)} />
      </div>

      {/* Body */}
      <ScrollArea className="flex-1">
        <Tabs value={tab} onValueChange={setTab} className="px-4 pt-3">
          <TabsList className="grid grid-cols-5 mb-3 h-9">
            <TabsTrigger value="overview" className="text-xs">Overview</TabsTrigger>
            <TabsTrigger value="styles" className="text-xs">Styles</TabsTrigger>
            <TabsTrigger value="samples" className="text-xs">Samples</TabsTrigger>
            <TabsTrigger value="shipments" className="text-xs">Ship</TabsTrigger>
            <TabsTrigger value="quality" className="text-xs">QC</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4 pb-4">
            <Section title="Parties" icon={<Building2 className="h-3.5 w-3.5" />}>
              <KV label="Retailer" value={item.retailer_name} />
              <KV label="Buyer" value={item.buyer_name ? (item.buyer_code ? `${item.buyer_name} (${item.buyer_code})` : item.buyer_name) : null} />
              <KV label="Agency" value={item.agency_name} />
              <KV label="Importer" value={item.importer_name} />
              <KV
                label="Factories"
                value={item.factories.length > 0 ? item.factories.map((f) => f.name).join(', ') : null}
              />
              <KV label="Warehouse" value={item.warehouse_name} />
            </Section>

            <Section title="Date cascade" icon={<Calendar className="h-3.5 w-3.5" />}>
              <KV label="PO Date" value={dateFmt(item.po_date)} />
              <KV label="Ex-Factory" value={dateFmt(item.ex_factory_date)} />
              <KV label="ETD" value={<EtdValue date={item.etd_date} status={item.etd_status} />} />
              <KV label="ETA" value={dateFmt(item.eta_date)} />
              <KV label="In-Warehouse" value={dateFmt(item.in_warehouse_date)} />
            </Section>
          </TabsContent>

          <TabsContent value="styles" className="space-y-2 pb-4">
            <ProductionSummaryStrip item={item} />
            {loadingStyles ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-6 justify-center">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading styles...
              </div>
            ) : (stylesData ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No styles found.</p>
            ) : (
              <div className="space-y-1">
                {(stylesData ?? []).map((s: any) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between rounded-md border bg-card p-2 hover:bg-muted/30 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono font-semibold">{s.style_number}</span>
                        {s.color_name && <span className="text-[11px] text-muted-foreground">{s.color_name}</span>}
                      </div>
                      {s.description && (
                        <p className="text-[11px] text-muted-foreground line-clamp-1">{s.description}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-xs tabular-nums font-medium">
                        {numFmt(Number(s.pivot?.quantity_in_po ?? s.total_quantity ?? 0))}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        @ {moneyFmt(Number(s.pivot?.unit_price_in_po ?? s.unit_price ?? 0), item.currency_code)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="samples" className="space-y-3 pb-4">
            <SummaryGrid
              icon={<ClipboardCheck className="h-4 w-4 text-muted-foreground" />}
              title="Samples"
              cells={[
                { label: 'Pending', value: item.samples_summary.pending, color: 'text-amber-600' },
                { label: 'Approved', value: item.samples_summary.approved, color: 'text-emerald-600' },
                { label: 'Rejected', value: item.samples_summary.rejected, color: 'text-red-600' },
              ]}
              total={item.samples_summary.total}
            />
            <p className="text-[11px] text-muted-foreground">
              Counts include samples linked to any style on this PO. Open the full PO to see details per style.
            </p>
          </TabsContent>

          <TabsContent value="shipments" className="space-y-3 pb-4">
            <SummaryGrid
              icon={<Truck className="h-4 w-4 text-muted-foreground" />}
              title="Shipments"
              cells={[
                { label: 'Preparing', value: item.shipments_summary.preparing, color: 'text-amber-600' },
                { label: 'In Transit', value: item.shipments_summary.in_transit, color: 'text-blue-600' },
                { label: 'Delivered', value: item.shipments_summary.delivered, color: 'text-emerald-600' },
                { label: 'Overdue', value: item.shipments_summary.overdue, color: 'text-red-600' },
              ]}
              total={item.shipments_summary.total}
            />
          </TabsContent>

          <TabsContent value="quality" className="space-y-3 pb-4">
            <SummaryGrid
              icon={<ShieldCheck className="h-4 w-4 text-muted-foreground" />}
              title="Quality inspections"
              cells={[
                { label: 'Passed', value: item.quality_summary.passed, color: 'text-emerald-600' },
                { label: 'Failed', value: item.quality_summary.failed, color: 'text-red-600' },
                { label: 'Pending', value: item.quality_summary.pending, color: 'text-amber-600' },
              ]}
              total={item.quality_summary.total}
            />
          </TabsContent>
        </Tabs>
      </ScrollArea>

      <Separator />
      <div className="flex items-center justify-between p-3 bg-muted/20">
        <Button variant="ghost" size="sm" onClick={onClose}>
          Close
        </Button>
        <Link href={`/purchase-orders/${item.id}`} target="_blank" rel="noreferrer">
          <Button size="sm">
            <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
            Open full PO
          </Button>
        </Link>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="text-base font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const klass: Record<string, string> = {
    draft: 'bg-amber-100 text-amber-800 border-amber-200',
    active: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    in_progress: 'bg-blue-100 text-blue-800 border-blue-200',
    completed: 'bg-purple-100 text-purple-800 border-purple-200',
    cancelled: 'bg-red-100 text-red-800 border-red-200',
  };
  return (
    <Badge variant="outline" className={cn('text-[10px] capitalize', klass[status] ?? '')}>
      {status?.replace(/_/g, ' ') ?? 'unknown'}
    </Badge>
  );
}

function EtdValue({ date, status }: { date: string | null; status: string }) {
  if (!date) return <span className="text-muted-foreground">—</span>;
  const cls =
    status === 'overdue'
      ? 'text-red-600 font-semibold'
      : status === 'urgent'
        ? 'text-amber-600 font-medium'
        : status === 'soon'
          ? 'text-yellow-700'
          : '';
  return <span className={cls}>{dateFmt(date)}</span>;
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground mb-2">
        {icon}
        {title}
      </div>
      <div className="space-y-1.5 rounded-md border bg-card p-3">{children}</div>
    </div>
  );
}

function KV({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className="text-xs font-medium text-right">{value || <span className="text-muted-foreground">—</span>}</span>
    </div>
  );
}

function ProductionSummaryStrip({ item }: { item: POReportItem }) {
  return (
    <div className="rounded-md border bg-muted/30 px-3 py-2 flex items-center justify-between">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Package className="h-3.5 w-3.5" />
        Production
      </div>
      <div className="flex items-center gap-3 text-[11px]">
        <span className="text-muted-foreground">
          Not started: <span className="font-semibold text-foreground tabular-nums">{item.production_summary.not_started}</span>
        </span>
        <span className="text-muted-foreground">
          In progress: <span className="font-semibold text-blue-600 tabular-nums">{item.production_summary.in_progress}</span>
        </span>
        <span className="text-muted-foreground">
          Completed: <span className="font-semibold text-emerald-600 tabular-nums">{item.production_summary.completed}</span>
        </span>
      </div>
    </div>
  );
}

function SummaryGrid({
  icon,
  title,
  cells,
  total,
}: {
  icon: React.ReactNode;
  title: string;
  cells: Array<{ label: string; value: number; color: string }>;
  total: number;
}) {
  return (
    <div className="rounded-md border bg-card">
      <div className="flex items-center justify-between px-3 py-2 border-b">
        <div className="flex items-center gap-1.5 text-xs font-semibold">
          {icon}
          {title}
        </div>
        <span className="text-[11px] text-muted-foreground">Total: {total}</span>
      </div>
      <div className={`grid gap-2 p-3`} style={{ gridTemplateColumns: `repeat(${cells.length}, minmax(0, 1fr))` }}>
        {cells.map((c) => (
          <div key={c.label} className="rounded-md bg-muted/30 px-2 py-1.5">
            <p className="text-[10px] text-muted-foreground">{c.label}</p>
            <p className={`text-sm font-bold tabular-nums ${c.color}`}>{c.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
