'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
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
  Edit,
  Trash2,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Layers,
  Ship,
  Calendar,
  Package,
} from 'lucide-react';
import { PurchaseOrder } from '@/types';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

interface POTableViewProps {
  purchaseOrders: PurchaseOrder[];
  onDelete: (id: number) => void;
  onBulkDelete?: (ids: number[]) => void;
  onExport?: (pos: PurchaseOrder[]) => void;
  onStatusChange?: (poId: number, newStatus: string) => Promise<void>;
  onBulkStatusChange?: (poIds: number[], newStatus: string) => Promise<void>;
  canEdit: boolean;
  canDelete: boolean;
  canExport: boolean;
}

type SortField = 'po_number' | 'po_date' | 'total_quantity' | 'total_value' | 'styles_count' | 'etd_date';
type SortOrder = 'asc' | 'desc';

export function POTableView({
  purchaseOrders,
  onDelete,
  onBulkDelete,
  onExport,
  onStatusChange,
  onBulkStatusChange,
  canEdit,
  canDelete,
  canExport,
}: POTableViewProps) {
  const { hasRole } = useAuth();
  const isFactory = hasRole('Factory');
  const getDisplayPoDate = (po: PurchaseOrder): string | null => {
    if (isFactory) {
      return (po as any).factory_po_date || po.po_date;
    }
    return po.po_date;
  };
  const [sortField, setSortField] = useState<SortField>('po_date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [changingStatusId, setChangingStatusId] = useState<number | null>(null);

  // Clear selection when data changes
  useEffect(() => {
    setSelectedIds(new Set());
  }, [purchaseOrders]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const sortedPOs = [...purchaseOrders].sort((a, b) => {
    let aVal: any;
    let bVal: any;
    switch (sortField) {
      case 'po_number':
        aVal = a.po_number.toLowerCase();
        bVal = b.po_number.toLowerCase();
        break;
      case 'po_date':
        aVal = new Date(getDisplayPoDate(a) || a.po_date).getTime();
        bVal = new Date(getDisplayPoDate(b) || b.po_date).getTime();
        break;
      case 'total_quantity':
        aVal = Number(a.total_quantity) || 0;
        bVal = Number(b.total_quantity) || 0;
        break;
      case 'total_value':
        aVal = parseFloat(String(a.total_value)) || 0;
        bVal = parseFloat(String(b.total_value)) || 0;
        break;
      case 'styles_count':
        aVal = a.styles_count || 0;
        bVal = b.styles_count || 0;
        break;
      case 'etd_date':
        aVal = a.etd_date ? new Date(a.etd_date).getTime() : 0;
        bVal = b.etd_date ? new Date(b.etd_date).getTime() : 0;
        break;
      default:
        return 0;
    }
    if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === purchaseOrders.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(purchaseOrders.map(p => p.id)));
    }
  };

  const formatCurrency = (value: number | string, currency: string) => {
    value = parseFloat(String(value)) || 0;
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currency || 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(value);
    } catch {
      return `${currency || '$'} ${value.toLocaleString()}`;
    }
  };

  const formatDate = (dateString: string | undefined | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getETDUrgency = (etdDate: string | undefined | null) => {
    if (!etdDate) return null;
    const etd = new Date(etdDate);
    const now = new Date();
    const diffDays = Math.ceil((etd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return 'overdue';
    if (diffDays <= 7) return 'urgent';
    if (diffDays <= 14) return 'soon';
    return null;
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; className: string }> = {
      draft: { variant: 'secondary', className: '' },
      active: { variant: 'default', className: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900 dark:text-green-300' },
      completed: { variant: 'default', className: 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900 dark:text-purple-300' },
      cancelled: { variant: 'destructive', className: '' },
    };
    const config = statusConfig[status?.toLowerCase()] || statusConfig.draft;
    return (
      <Badge variant={config.variant} className={cn('text-[10px] capitalize', config.className)}>
        {status || 'draft'}
      </Badge>
    );
  };

  const SortHeader = ({ field, children, className }: { field: SortField; children: React.ReactNode; className?: string }) => (
    <TableHead className={className}>
      <button
        className="flex items-center gap-1 hover:text-foreground transition-colors text-xs"
        onClick={() => toggleSort(field)}
      >
        {children}
        {sortField === field ? (
          sortOrder === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-30" />
        )}
      </button>
    </TableHead>
  );

  return (
    <div className="space-y-3">
      {/* Bulk Actions */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 rounded-lg border bg-muted/50 p-3 animate-in slide-in-from-top-2">
          <span className="text-sm font-medium">
            {selectedIds.size} PO{selectedIds.size > 1 ? 's' : ''} selected
          </span>
          {canExport && onExport && (
            <Button
              size="sm"
              variant="outline"
              className="h-7"
              onClick={() => {
                const selected = purchaseOrders.filter(p => selectedIds.has(p.id));
                onExport(selected);
              }}
            >
              Export Selected
            </Button>
          )}
          {canEdit && onBulkStatusChange && (
            <>
              <Button
                size="sm"
                className="h-7 bg-green-600 hover:bg-green-700 text-white"
                onClick={async () => {
                  await onBulkStatusChange(Array.from(selectedIds), 'active');
                }}
              >
                Mark Active
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7"
                onClick={async () => {
                  await onBulkStatusChange(Array.from(selectedIds), 'completed');
                }}
              >
                Mark Completed
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-red-600 border-red-200 hover:bg-red-50"
                onClick={async () => {
                  await onBulkStatusChange(Array.from(selectedIds), 'cancelled');
                }}
              >
                Cancel
              </Button>
            </>
          )}
          {canDelete && onBulkDelete && (
            <Button
              size="sm"
              variant="destructive"
              className="h-7"
              onClick={() => {
                if (confirm(`Delete ${selectedIds.size} purchase order(s)? This action cannot be undone.`)) {
                  onBulkDelete(Array.from(selectedIds));
                }
              }}
            >
              Delete Selected
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="h-7 ml-auto"
            onClick={() => setSelectedIds(new Set())}
          >
            Clear
          </Button>
        </div>
      )}

      {/* Table */}
      <div className="rounded-lg border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-10">
                <Checkbox
                  checked={selectedIds.size === purchaseOrders.length && purchaseOrders.length > 0}
                  onCheckedChange={toggleSelectAll}
                />
              </TableHead>
              <SortHeader field="po_number">PO Number</SortHeader>
              <TableHead className="text-xs">Status</TableHead>
              <SortHeader field="po_date">PO Date</SortHeader>
              <TableHead className="text-xs">Ship Term</TableHead>
              <SortHeader field="etd_date">ETD</SortHeader>
              <SortHeader field="styles_count">Styles</SortHeader>
              <SortHeader field="total_quantity" className="text-right">Quantity</SortHeader>
              {!isFactory && <SortHeader field="total_value" className="text-right">Value</SortHeader>}
              <TableHead className="text-xs text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedPOs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={isFactory ? 9 : 10} className="text-center py-16">
                  <div className="flex flex-col items-center gap-2">
                    <Package className="h-10 w-10 text-muted-foreground/40" />
                    <p className="text-muted-foreground font-medium">No purchase orders found</p>
                    <p className="text-xs text-muted-foreground">Try adjusting your filters or create a new PO</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              sortedPOs.map((po) => {
                const isSelected = selectedIds.has(po.id);
                const etdUrgency = getETDUrgency(po.etd_date);
                return (
                  <TableRow
                    key={po.id}
                    className={cn(
                      'group cursor-pointer transition-colors',
                      isSelected && 'bg-primary/5',
                    )}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleSelect(po.id)}
                      />
                    </TableCell>
                    <TableCell>
                      <Link href={`/purchase-orders/${po.id}`} className="block">
                        <div className="flex items-start gap-2">
                          <div className={cn(
                            'w-1 h-8 rounded-full shrink-0 mt-0.5',
                            po.status === 'active' && 'bg-green-500',
                            po.status === 'completed' && 'bg-purple-500',
                            po.status === 'cancelled' && 'bg-red-500',
                            (!po.status || po.status === 'draft') && 'bg-gray-300',
                          )} />
                          <div className="min-w-0">
                            <p className="text-sm font-semibold truncate">{po.po_number}</p>
                            {po.headline && (
                              <p className="text-[10px] text-muted-foreground truncate max-w-[180px]">
                                {po.headline}
                              </p>
                            )}
                          </div>
                        </div>
                      </Link>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {canEdit && onStatusChange && (po as any).allowed_transitions?.length > 0 ? (
                        <Select
                          value={po.status}
                          onValueChange={async (val) => {
                            setChangingStatusId(po.id);
                            await onStatusChange(po.id, val);
                            setChangingStatusId(null);
                          }}
                          disabled={changingStatusId === po.id}
                        >
                          <SelectTrigger className="h-7 w-[110px] text-[10px] px-2">
                            <SelectValue>{getStatusBadge(po.status)}</SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value={po.status} disabled>
                              <span className="capitalize">{po.status.replace(/_/g, ' ')} (current)</span>
                            </SelectItem>
                            {((po as any).allowed_transitions || []).map((s: string) => (
                              <SelectItem key={s} value={s}>
                                <span className="capitalize">{s.replace(/_/g, ' ')}</span>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        getStatusBadge(po.status)
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-xs">{formatDate(getDisplayPoDate(po) || po.po_date)}</span>
                    </TableCell>
                    <TableCell>
                      {po.shipping_term ? (
                        <Badge variant="outline" className="text-[10px]">
                          <Ship className="h-2.5 w-2.5 mr-0.5" />
                          {po.shipping_term}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <span className={cn(
                          'text-xs',
                          etdUrgency === 'overdue' && 'text-red-600 font-semibold',
                          etdUrgency === 'urgent' && 'text-amber-600 font-medium',
                        )}>
                          {formatDate(po.etd_date)}
                        </span>
                        {etdUrgency === 'overdue' && (
                          <Badge variant="destructive" className="text-[9px] px-1 py-0">Overdue</Badge>
                        )}
                        {etdUrgency === 'urgent' && (
                          <Badge variant="outline" className="text-[9px] px-1 py-0 text-amber-600 border-amber-300">Soon</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Layers className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs">{po.styles_count || 0}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-xs font-medium tabular-nums">
                        {(Number(po.total_quantity) || 0).toLocaleString()}
                      </span>
                    </TableCell>
                    {!isFactory && (
                      <TableCell className="text-right">
                        <span className="text-xs font-semibold tabular-nums">
                          {formatCurrency(po.total_value, po.currency)}
                        </span>
                      </TableCell>
                    )}
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Link href={`/purchase-orders/${po.id}`}>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="View">
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                        </Link>
                        {canEdit && (
                          <Link href={`/purchase-orders/${po.id}`}>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Edit">
                              <Edit className="h-3.5 w-3.5" />
                            </Button>
                          </Link>
                        )}
                        {canDelete && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                            onClick={() => onDelete(po.id)}
                            title="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
