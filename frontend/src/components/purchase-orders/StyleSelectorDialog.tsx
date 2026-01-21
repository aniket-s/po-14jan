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
  shipping_term: 'FOB' | 'DDP'; // Changed from price_term
  size_breakdown: Record<string, number>;
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
        shipping_term: 'FOB', // Default to FOB - changed from price_term
        size_breakdown: style.size_breakdown || {}, // Use existing or empty
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

  // Update shipping term for selected style
  const updateShippingTerm = (styleId: number, shippingTerm: 'FOB' | 'DDP') => { // Changed from updatePriceTerm
    const newSelected = new Map(selectedStyles);
    const style = newSelected.get(styleId);
    if (style) {
      style.shipping_term = shippingTerm; // Changed from price_term
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

                        <div>
                          <Label className="text-xs">Shipping Term *</Label>
                          <Select
                            value={style.shipping_term}
                            onValueChange={(value) =>
                              updateShippingTerm(style.id, value as 'FOB' | 'DDP')
                            }
                          >
                            <SelectTrigger className="h-8 text-sm">
                              <SelectValue placeholder="Select shipping term" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="FOB">FOB (Free On Board)</SelectItem>
                              <SelectItem value="DDP">DDP (Delivered Duty Paid)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div>
                          <Label className="text-xs">Size Breakdown</Label>

                          {/* Prepack Auto-Fill */}
                          <div className="mb-3 mt-2">
                            <Select onValueChange={(value) => autoFillFromPrepack(style.id, parseInt(value))}>
                              <SelectTrigger className="h-8 text-sm">
                                <SelectValue placeholder="Use Prepack..." />
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
                            <p className="text-xs text-muted-foreground mt-1">
                              Select a prepack to auto-fill size breakdown
                            </p>
                          </div>

                          <div className="grid grid-cols-3 gap-2 mt-2">
                            {['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'].map((size) => (
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
                                  className="h-8 text-sm"
                                />
                              </div>
                            ))}
                          </div>
                          <div className="text-xs text-muted-foreground mt-2">
                            Total sizes: {Object.values(style.size_breakdown || {}).reduce((sum, qty) => sum + (Number(qty) || 0), 0)}
                          </div>
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
