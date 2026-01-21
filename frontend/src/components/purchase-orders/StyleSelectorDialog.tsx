'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, Package, ShoppingCart, X } from 'lucide-react';
import { getAllStyles, Style } from '@/services/styles';
import { toast } from 'sonner';

interface SelectedStyle extends Style {
  quantity_in_po: number;
  unit_price_in_po: number | null;
  // shipping_term removed - now set at PO level, not per-style
  size_breakdown: Record<string, number>;
  packing_method: 'solid' | 'prepack'; // NEW: Solid pack or Prepack
  ratio: Record<string, number>; // NEW: For prepack ratio
}

interface StyleSelectorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (styles: SelectedStyle[]) => void;
  poId?: number; // Optional - if provided, excludes styles already in this PO
  title?: string;
  description?: string;
}

export function StyleSelectorDialog({
  open,
  onOpenChange,
  onSelect,
  poId,
  title = 'Select Styles for Purchase Order',
  description = 'Choose styles from your library to add to this purchase order',
}: StyleSelectorDialogProps) {
  const [styles, setStyles] = useState<Style[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStyles, setSelectedStyles] = useState<Map<number, SelectedStyle>>(new Map());
  const [page, setPage] = useState(1);
  const [prepacks, setPrepacks] = useState<any[]>([]);

  // Fetch available styles
  const fetchStyles = async () => {
    try {
      setLoading(true);
      const response = await getAllStyles({
        search: searchQuery || undefined,
        page,
        per_page: 20,
      });
      setStyles(response.data);
    } catch (error) {
      console.error('Failed to fetch styles:', error);
      toast.error('Failed to load styles');
    } finally {
      setLoading(false);
    }
  };

  // Fetch prepacks
  const fetchPrepacks = async () => {
    try {
      const api = (await import('@/lib/api')).default;
      const response = await api.get('/master-data/prepack-codes?all=true');
      setPrepacks(response.data || []);
    } catch (error) {
      console.error('Failed to fetch prepacks:', error);
    }
  };

  useEffect(() => {
    if (open) {
      fetchStyles();
      fetchPrepacks();
    }
  }, [open, searchQuery, page]);

  // Reset when dialog closes
  useEffect(() => {
    if (!open) {
      setSearchQuery('');
      setSelectedStyles(new Map());
      setPage(1);
    }
  }, [open]);

  // Toggle style selection
  const toggleStyleSelection = (style: Style, checked: boolean) => {
    const newSelected = new Map(selectedStyles);
    if (checked) {
      newSelected.set(style.id, {
        ...style,
        quantity_in_po: style.total_quantity || 1, // Default to style's base quantity or 1
        unit_price_in_po: null, // Use style's base price by default
        // shipping_term removed - set at PO level
        size_breakdown: style.size_breakdown || {}, // Use existing or empty
        packing_method: 'solid', // Default to solid pack
        ratio: {}, // Empty ratio for prepack
      });
    } else {
      newSelected.delete(style.id);
    }
    setSelectedStyles(newSelected);
  };

  // Update quantity for selected style
  const updateQuantity = (styleId: number, quantity: number) => {
    const newSelected = new Map(selectedStyles);
    const style = newSelected.get(styleId);
    if (style) {
      style.quantity_in_po = quantity;
      newSelected.set(styleId, style);
      setSelectedStyles(newSelected);
    }
  };

  // Update price override for selected style
  const updatePriceOverride = (styleId: number, price: number | null) => {
    const newSelected = new Map(selectedStyles);
    const style = newSelected.get(styleId);
    if (style) {
      style.unit_price_in_po = price;
      newSelected.set(styleId, style);
      setSelectedStyles(newSelected);
    }
  };

  // Update packing method for selected style
  const updatePackingMethod = (styleId: number, packingMethod: 'solid' | 'prepack') => {
    const newSelected = new Map(selectedStyles);
    const style = newSelected.get(styleId);
    if (style) {
      style.packing_method = packingMethod;
      // Clear ratio if switching to solid pack
      if (packingMethod === 'solid') {
        style.ratio = {};
      }
      newSelected.set(styleId, style);
      setSelectedStyles(newSelected);
    }
  };

  // Update ratio for prepack
  const updateRatio = (styleId: number, ratio: Record<string, number>) => {
    const newSelected = new Map(selectedStyles);
    const style = newSelected.get(styleId);
    if (style) {
      style.ratio = ratio;
      // Auto-calculate size breakdown from ratio and quantity
      if (style.packing_method === 'prepack' && Object.keys(ratio).length > 0) {
        const totalRatio = Object.values(ratio).reduce((sum, r) => sum + r, 0);
        if (totalRatio > 0) {
          const sizeBreakdown: Record<string, number> = {};
          Object.entries(ratio).forEach(([size, r]) => {
            sizeBreakdown[size] = Math.round((style.quantity_in_po * r) / totalRatio);
          });
          style.size_breakdown = sizeBreakdown;
        }
      }
      newSelected.set(styleId, style);
      setSelectedStyles(newSelected);
    }
  };

  // Update size breakdown for selected style
  const updateSizeBreakdown = (styleId: number, sizeBreakdown: Record<string, number>) => {
    const newSelected = new Map(selectedStyles);
    const style = newSelected.get(styleId);
    if (style) {
      style.size_breakdown = sizeBreakdown;
      newSelected.set(styleId, style);
      setSelectedStyles(newSelected);
    }
  };

  // Auto-fill size breakdown from prepack
  const autoFillFromPrepack = (styleId: number, prepackId: number) => {
    const prepack = prepacks.find(p => p.id === prepackId);
    if (!prepack) return;

    const style = selectedStyles.get(styleId);
    if (!style) return;

    // Calculate size breakdown based on prepack ratio and total quantity
    const totalQuantity = style.quantity_in_po;
    const prepackSizes = prepack.sizes; // JSON object like {S: 2, M: 2, L: 1, XL: 1}
    const totalPiecesPerPack = prepack.total_pieces_per_pack;

    if (!prepackSizes || !totalPiecesPerPack) {
      toast.error('Invalid prepack data');
      return;
    }

    // Calculate how many complete packs we can make
    const numberOfPacks = Math.floor(totalQuantity / totalPiecesPerPack);
    const remainder = totalQuantity % totalPiecesPerPack;

    // Create size breakdown
    const sizeBreakdown: Record<string, number> = {};

    Object.entries(prepackSizes).forEach(([size, ratio]) => {
      const numRatio = Number(ratio);
      sizeBreakdown[size] = numberOfPacks * numRatio;
    });

    // Distribute remainder proportionally (optional - we can skip this for simplicity)
    if (remainder > 0) {
      // Just add the remainder to the first size for simplicity
      const firstSize = Object.keys(prepackSizes)[0];
      sizeBreakdown[firstSize] = (sizeBreakdown[firstSize] || 0) + remainder;
    }

    updateSizeBreakdown(styleId, sizeBreakdown);
    toast.success(`Size breakdown auto-filled from ${prepack.code}`);
  };

  // Handle submit
  const handleSubmit = () => {
    const stylesArray = Array.from(selectedStyles.values());
    if (stylesArray.length === 0) {
      toast.error('Please select at least one style');
      return;
    }
    onSelect(stylesArray);
    onOpenChange(false);
  };

  // Calculate totals
  const totalQuantity = Array.from(selectedStyles.values()).reduce(
    (sum, style) => sum + style.quantity_in_po,
    0
  );

  const totalValue = Array.from(selectedStyles.values()).reduce((sum, style) => {
    const price = style.unit_price_in_po ?? style.unit_price ?? 0;
    return sum + style.quantity_in_po * price;
  }, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-6">
          {/* Left: Available Styles */}
          <div className="col-span-2 space-y-4">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by style number, description, fabric, color..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <ScrollArea className="h-[500px] border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <span className="sr-only">Select</span>
                    </TableHead>
                    <TableHead>Style Number</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Fabric</TableHead>
                    <TableHead>Color</TableHead>
                    <TableHead className="text-right">Base Qty</TableHead>
                    <TableHead className="text-right">Base Price</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        Loading styles...
                      </TableCell>
                    </TableRow>
                  ) : styles.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
                        <p>No styles found</p>
                        <p className="text-sm">Try adjusting your search</p>
                      </TableCell>
                    </TableRow>
                  ) : (
                    styles.map((style) => (
                      <TableRow key={style.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedStyles.has(style.id)}
                            onCheckedChange={(checked) =>
                              toggleStyleSelection(style, checked as boolean)
                            }
                          />
                        </TableCell>
                        <TableCell className="font-medium">{style.style_number}</TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {style.description || '-'}
                        </TableCell>
                        <TableCell>{style.fabric || '-'}</TableCell>
                        <TableCell>{style.color?.name || '-'}</TableCell>
                        <TableCell className="text-right">
                          {style.total_quantity?.toLocaleString() || '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          {style.unit_price ? `$${style.unit_price.toFixed(2)}` : '-'}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>

          {/* Right: Selected Styles */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2">
                <ShoppingCart className="h-4 w-4" />
                Selected ({selectedStyles.size})
              </h3>
              {selectedStyles.size > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedStyles(new Map())}
                  className="h-auto p-1"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>

            <ScrollArea className="h-[400px] border rounded-md p-2">
              {selectedStyles.size === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No styles selected</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {Array.from(selectedStyles.values()).map((style) => (
                    <div key={style.id} className="border rounded-md p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{style.style_number}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {style.description || 'No description'}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleStyleSelection(style, false)}
                          className="h-auto p-1"
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>

                      <div className="space-y-2">
                        <div>
                          <Label className="text-xs">Quantity for this PO</Label>
                          <Input
                            type="number"
                            min="1"
                            value={style.quantity_in_po}
                            onChange={(e) =>
                              updateQuantity(style.id, parseInt(e.target.value) || 0)
                            }
                            className="h-8 text-sm"
                          />
                        </div>

                        <div>
                          <Label className="text-xs">
                            Price Override (Base: ${style.unit_price})
                          </Label>
                          <Input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder={`${style.unit_price}`}
                            value={style.unit_price_in_po || ''}
                            onChange={(e) =>
                              updatePriceOverride(
                                style.id,
                                e.target.value ? parseFloat(e.target.value) : null
                              )
                            }
                            className="h-8 text-sm"
                          />
                        </div>

                        {/* Packing Method - Solid or Prepack */}
                        <div>
                          <Label className="text-xs">Packing Method</Label>
                          <div className="flex gap-2 mt-1">
                            <Button
                              type="button"
                              variant={style.packing_method === 'solid' ? 'default' : 'outline'}
                              size="sm"
                              className="flex-1 h-8 text-xs"
                              onClick={() => updatePackingMethod(style.id, 'solid')}
                            >
                              Solid Pack
                            </Button>
                            <Button
                              type="button"
                              variant={style.packing_method === 'prepack' ? 'default' : 'outline'}
                              size="sm"
                              className="flex-1 h-8 text-xs"
                              onClick={() => updatePackingMethod(style.id, 'prepack')}
                            >
                              Prepack
                            </Button>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {style.packing_method === 'solid'
                              ? 'All sizes packed together in one box'
                              : 'Sizes distributed by ratio across boxes'}
                          </p>
                        </div>

                        {/* Size Breakdown Section */}
                        <div>
                          <Label className="text-xs">
                            {style.packing_method === 'prepack' ? 'Size Ratio' : 'Size Breakdown'}
                          </Label>

                          {/* Prepack selector - only show for prepack method */}
                          {style.packing_method === 'prepack' && (
                            <div className="mb-3 mt-2">
                              <Select onValueChange={(value) => autoFillFromPrepack(style.id, parseInt(value))}>
                                <SelectTrigger className="h-8 text-sm">
                                  <SelectValue placeholder="Use Prepack Code..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {prepacks.map((prepack) => (
                                    <SelectItem key={prepack.id} value={prepack.id.toString()}>
                                      {prepack.code} - {prepack.name} ({prepack.size_range})
                                    </SelectItem>
                                  ))}
                                  {prepacks.length === 0 && (
                                    <SelectItem value="none" disabled>No prepacks available</SelectItem>
                                  )}
                                </SelectContent>
                              </Select>
                            </div>
                          )}

                          {style.packing_method === 'prepack' ? (
                            /* Prepack: Show ratio inputs */
                            <div>
                              <div className="grid grid-cols-4 gap-2 mt-2">
                                {['S', 'M', 'L', 'XL'].map((size) => (
                                  <div key={size} className="space-y-1">
                                    <Label htmlFor={`ratio-${style.id}-${size}`} className="text-xs">
                                      {size}
                                    </Label>
                                    <Input
                                      id={`ratio-${style.id}-${size}`}
                                      type="number"
                                      min="0"
                                      value={style.ratio?.[size] || ''}
                                      onChange={(e) => {
                                        const ratio = parseInt(e.target.value) || 0;
                                        const newRatio = { ...style.ratio };
                                        if (ratio === 0) {
                                          delete newRatio[size];
                                        } else {
                                          newRatio[size] = ratio;
                                        }
                                        updateRatio(style.id, newRatio);
                                      }}
                                      placeholder="0"
                                      className="h-8 text-sm text-center"
                                    />
                                  </div>
                                ))}
                              </div>
                              <div className="text-xs text-muted-foreground mt-2 p-2 bg-muted/50 rounded">
                                <strong>Calculated breakdown:</strong>{' '}
                                {Object.entries(style.size_breakdown || {}).map(([size, qty]) => (
                                  <span key={size} className="mr-2">{size}: {qty}</span>
                                ))}
                                <br />
                                <span>Total: {Object.values(style.size_breakdown || {}).reduce((sum, qty) => sum + (Number(qty) || 0), 0)}</span>
                              </div>
                            </div>
                          ) : (
                            /* Solid: Show direct quantity inputs */
                            <div>
                              <div className="grid grid-cols-4 gap-2 mt-2">
                                {['S', 'M', 'L', 'XL'].map((size) => (
                                  <div key={size} className="space-y-1">
                                    <Label htmlFor={`size-${style.id}-${size}`} className="text-xs">
                                      {size}
                                    </Label>
                                    <Input
                                      id={`size-${style.id}-${size}`}
                                      type="number"
                                      min="0"
                                      value={style.size_breakdown?.[size] || ''}
                                      onChange={(e) => {
                                        const qty = parseInt(e.target.value) || 0;
                                        const newBreakdown = { ...style.size_breakdown };
                                        if (qty === 0) {
                                          delete newBreakdown[size];
                                        } else {
                                          newBreakdown[size] = qty;
                                        }
                                        updateSizeBreakdown(style.id, newBreakdown);
                                      }}
                                      placeholder="0"
                                      className="h-8 text-sm text-center"
                                    />
                                  </div>
                                ))}
                              </div>
                              <div className="text-xs text-muted-foreground mt-2">
                                Total: {Object.values(style.size_breakdown || {}).reduce((sum, qty) => sum + (Number(qty) || 0), 0)} pcs
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="text-xs text-muted-foreground">
                          Total: $
                          {(
                            style.quantity_in_po * (style.unit_price_in_po ?? style.unit_price)
                          ).toFixed(2)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>

            {/* Totals Summary */}
            {selectedStyles.size > 0 && (
              <div className="border rounded-md p-3 space-y-1 bg-muted/50">
                <div className="flex justify-between text-sm">
                  <span>Total Styles:</span>
                  <span className="font-semibold">{selectedStyles.size}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Total Quantity:</span>
                  <span className="font-semibold">{totalQuantity.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm border-t pt-1">
                  <span>Total Value:</span>
                  <span className="font-semibold text-green-600">
                    ${totalValue.toFixed(2)}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={selectedStyles.size === 0}>
            Add {selectedStyles.size} Style{selectedStyles.size !== 1 ? 's' : ''} to PO
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
