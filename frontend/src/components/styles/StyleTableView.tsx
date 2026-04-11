'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Edit, Trash2, ArrowUpDown, ArrowUp, ArrowDown, Package, Link2,
} from 'lucide-react';
import { Style } from '@/services/styles';
import { cn } from '@/lib/utils';

interface StyleTableViewProps {
  styles: Style[];
  selectedIds: Set<number>;
  onToggleSelect: (id: number) => void;
  onToggleSelectAll: () => void;
  selectedStyleId: number | null;
  onSelectStyle: (style: Style) => void;
  onEdit?: (style: Style) => void;
  onDelete?: (style: Style) => void;
  canEdit: boolean;
  canDelete: boolean;
}

type SortField = 'style_number' | 'description' | 'retailer' | 'brand' | 'category';
type SortOrder = 'asc' | 'desc';

export function StyleTableView({
  styles,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  selectedStyleId,
  onSelectStyle,
  onEdit,
  onDelete,
  canEdit,
  canDelete,
}: StyleTableViewProps) {
  const router = useRouter();
  const [sortField, setSortField] = useState<SortField>('style_number');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const sortedStyles = [...styles].sort((a, b) => {
    let aVal: string = '';
    let bVal: string = '';
    switch (sortField) {
      case 'style_number': aVal = a.style_number || ''; bVal = b.style_number || ''; break;
      case 'description': aVal = a.description || ''; bVal = b.description || ''; break;
      case 'retailer': aVal = a.retailer?.name || ''; bVal = b.retailer?.name || ''; break;
      case 'brand': aVal = a.brand?.name || ''; bVal = b.brand?.name || ''; break;
      case 'category': aVal = a.category?.name || ''; bVal = b.category?.name || ''; break;
    }
    const cmp = aVal.toLowerCase().localeCompare(bVal.toLowerCase());
    return sortOrder === 'asc' ? cmp : -cmp;
  });

  const SortHeader = ({ field, children, className }: { field: SortField; children: React.ReactNode; className?: string }) => (
    <TableHead className={className}>
      <button className="flex items-center gap-1 hover:text-foreground transition-colors text-xs" onClick={() => toggleSort(field)}>
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
    <div className="rounded-lg border bg-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-10">
              <Checkbox
                checked={selectedIds.size === styles.length && styles.length > 0}
                onCheckedChange={onToggleSelectAll}
              />
            </TableHead>
            <TableHead className="w-12 text-xs">Image</TableHead>
            <SortHeader field="style_number">Style #</SortHeader>
            <SortHeader field="description">Name</SortHeader>
            <TableHead className="text-xs">Fabric</TableHead>
            <TableHead className="text-xs">Color</TableHead>
            <SortHeader field="brand">Brand</SortHeader>
            <SortHeader field="retailer">Retailer</SortHeader>
            <SortHeader field="category">Category</SortHeader>
            <TableHead className="text-xs">POs</TableHead>
            <TableHead className="text-xs text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedStyles.length === 0 ? (
            <TableRow>
              <TableCell colSpan={11} className="text-center py-16">
                <div className="flex flex-col items-center gap-2">
                  <Package className="h-10 w-10 text-muted-foreground/40" />
                  <p className="text-muted-foreground font-medium">No styles found</p>
                  <p className="text-xs text-muted-foreground">Try adjusting your filters</p>
                </div>
              </TableCell>
            </TableRow>
          ) : (
            sortedStyles.map((style) => {
              const isSelected = selectedStyleId === style.id;
              const imageUrl = style.images && style.images.length > 0 ? style.images[0] : null;
              const poCount = style.purchase_orders?.length || 0;
              return (
                <TableRow
                  key={style.id}
                  className={cn('group cursor-pointer transition-colors', isSelected && 'bg-primary/5')}
                  onClick={() => onSelectStyle(style)}
                >
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedIds.has(style.id)}
                      onCheckedChange={() => onToggleSelect(style.id)}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="h-9 w-9 rounded border bg-muted overflow-hidden">
                      {imageUrl ? (
                        <img src={imageUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center">
                          <Package className="h-4 w-4 text-muted-foreground/30" />
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs font-semibold">{style.style_number}</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs truncate max-w-[150px] block">{style.description || '-'}</span>
                  </TableCell>
                  <TableCell>
                    {style.fabric_type_name ? (
                      <div>
                        <p className="text-xs">{style.fabric_type_name}</p>
                        {style.fabric_weight && <p className="text-[10px] text-muted-foreground">{style.fabric_weight}</p>}
                      </div>
                    ) : <span className="text-xs text-muted-foreground">-</span>}
                  </TableCell>
                  <TableCell>
                    {(style.color?.name || style.color_name) ? (
                      <div className="flex items-center gap-1">
                        {style.color?.code && (
                          <span className="h-3 w-3 rounded-full border shrink-0" style={{ backgroundColor: style.color.code }} />
                        )}
                        <span className="text-xs truncate">{style.color?.name || style.color_name}</span>
                      </div>
                    ) : <span className="text-xs text-muted-foreground">-</span>}
                  </TableCell>
                  <TableCell>
                    <span className="text-xs">{style.brand?.name || '-'}</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs">{style.retailer?.name || '-'}</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-xs">{style.category?.name || '-'}</span>
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    {poCount > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {style.purchase_orders!.slice(0, 2).map((po: any) => (
                          <Button
                            key={po.id}
                            variant="link"
                            size="sm"
                            className="h-auto p-0 text-[10px]"
                            onClick={() => router.push(`/purchase-orders/${po.id}`)}
                          >
                            {po.po_number}
                          </Button>
                        ))}
                        {poCount > 2 && (
                          <Badge variant="secondary" className="text-[9px] px-1">+{poCount - 2}</Badge>
                        )}
                      </div>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">None</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      {canEdit && onEdit && (
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => onEdit(style)} title="Edit">
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {canDelete && onDelete && (
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-600" onClick={() => onDelete(style)} title="Delete">
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
  );
}
