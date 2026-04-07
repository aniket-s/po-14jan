'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { getPOStyles, deleteStandaloneStyle, type Style } from '@/services/styles';
import { Loader2, AlertTriangle, Trash2 } from 'lucide-react';
import api from '@/lib/api';

interface DeletePOStylesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  poId: number | null;
  poNumber: string;
  onSuccess: () => void;
}

export function DeletePOStylesDialog({
  open,
  onOpenChange,
  poId,
  poNumber,
  onSuccess,
}: DeletePOStylesDialogProps) {
  const [styles, setStyles] = useState<Style[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (open && poId) {
      fetchStyles();
    }
    if (!open) {
      setSelectedIds(new Set());
      setStyles([]);
    }
  }, [open, poId]);

  const fetchStyles = async () => {
    if (!poId) return;
    setIsLoading(true);
    try {
      const result = await getPOStyles(poId, { per_page: 100 });
      setStyles(result.data || []);
    } catch (error) {
      console.error('Failed to fetch styles:', error);
      toast.error('Failed to load styles');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === styles.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(styles.map((s) => s.id)));
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) {
      toast.error('Please select at least one style to delete');
      return;
    }

    setIsDeleting(true);
    let deletedCount = 0;
    const errors: string[] = [];

    for (const styleId of selectedIds) {
      try {
        await deleteStandaloneStyle(styleId);
        deletedCount++;
      } catch (error: any) {
        const style = styles.find((s) => s.id === styleId);
        const msg = error.response?.data?.message || 'Unknown error';
        errors.push(`${style?.style_number || styleId}: ${msg}`);
      }
    }

    if (deletedCount > 0) {
      toast.success(`Deleted ${deletedCount} style${deletedCount > 1 ? 's' : ''}`);
    }
    if (errors.length > 0) {
      toast.error(`Failed to delete ${errors.length} style${errors.length > 1 ? 's' : ''}`, {
        description: errors.join(', '),
      });
    }

    // If all styles were deleted, try deleting the PO
    if (deletedCount === styles.length) {
      try {
        await api.delete(`/purchase-orders/${poId}`);
        toast.success(`Purchase order "${poNumber}" deleted successfully`);
        onOpenChange(false);
        onSuccess();
      } catch (error: any) {
        const msg = error.response?.data?.message || 'Failed to delete purchase order';
        toast.error(msg);
        // Refresh styles list to show remaining
        fetchStyles();
        setSelectedIds(new Set());
      }
    } else {
      // Some styles remain, refresh the list
      fetchStyles();
      setSelectedIds(new Set());
    }

    setIsDeleting(false);
  };

  const allSelected = styles && styles.length > 0 && selectedIds.size === styles.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Cannot Delete Purchase Order
          </DialogTitle>
          <DialogDescription>
            PO <strong>{poNumber}</strong> has styles that must be deleted first.
            Select the styles you want to delete.
          </DialogDescription>
        </DialogHeader>

        <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-sm text-amber-900 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-200">
          <p className="font-semibold mb-1">Warning:</p>
          <ul className="list-disc list-inside space-y-1 text-xs">
            <li>Deleting a style removes it from the system entirely</li>
            <li>All PO-specific data (quantities, prices, assignments) will be lost</li>
            <li>This action cannot be undone</li>
          </ul>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : styles.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No styles found.</p>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2 pb-2 border-b">
              <Checkbox
                id="select-all"
                checked={allSelected}
                onCheckedChange={toggleSelectAll}
                disabled={isDeleting}
              />
              <label htmlFor="select-all" className="text-sm font-medium cursor-pointer">
                Select All ({styles.length} style{styles.length > 1 ? 's' : ''})
              </label>
            </div>
            <div className="max-h-[300px] overflow-y-auto space-y-1">
              {styles.map((style) => (
                <div
                  key={style.id}
                  className={`flex items-center gap-3 p-2 rounded-md border cursor-pointer transition-colors ${
                    selectedIds.has(style.id)
                      ? 'bg-destructive/5 border-destructive/30'
                      : 'hover:bg-muted/50'
                  }`}
                  onClick={() => !isDeleting && toggleSelect(style.id)}
                >
                  <Checkbox
                    checked={selectedIds.has(style.id)}
                    onCheckedChange={() => toggleSelect(style.id)}
                    disabled={isDeleting}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">
                        {style.style_number}
                      </span>
                      {style.color_name && (
                        <Badge variant="outline" className="text-xs">
                          {style.color_name}
                        </Badge>
                      )}
                    </div>
                    {style.description && (
                      <p className="text-xs text-muted-foreground truncate">
                        {style.description}
                      </p>
                    )}
                  </div>
                  <div className="text-right text-xs text-muted-foreground shrink-0">
                    <div>Qty: {style.total_quantity || 0}</div>
                    {style.unit_price > 0 && <div>${style.unit_price}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isDeleting}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDeleteSelected}
            disabled={isDeleting || selectedIds.size === 0}
          >
            {isDeleting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="mr-2 h-4 w-4" />
                Delete {selectedIds.size > 0 ? `${selectedIds.size} Style${selectedIds.size > 1 ? 's' : ''}` : 'Selected'}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
