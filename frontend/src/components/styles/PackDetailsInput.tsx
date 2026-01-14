'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Trash2 } from 'lucide-react';
import { PackDetail, PackingDetails } from '@/types';

interface PackDetailsInputProps {
  packingDetails: PackingDetails | null;
  onChange: (packingDetails: PackingDetails | null) => void;
  disabled?: boolean;
}

export function PackDetailsInput({ packingDetails, onChange, disabled }: PackDetailsInputProps) {
  const [packs, setPacks] = useState<PackDetail[]>(packingDetails?.packs || []);

  const handleAddPack = () => {
    const newPack: PackDetail = {
      pack_size: `S${packs.length + 1}`,
      width: 'M',
      size_breakdown: {},
      quantity: 0,
      cost_per_unit: 0,
      total_cost: 0,
    };
    const updatedPacks = [...packs, newPack];
    setPacks(updatedPacks);
    updatePackingDetails(updatedPacks);
  };

  const handleRemovePack = (index: number) => {
    const updatedPacks = packs.filter((_, i) => i !== index);
    setPacks(updatedPacks);
    updatePackingDetails(updatedPacks);
  };

  const handlePackChange = (index: number, field: keyof PackDetail, value: any) => {
    const updatedPacks = [...packs];
    updatedPacks[index] = { ...updatedPacks[index], [field]: value };

    // Auto-calculate quantities
    if (field === 'size_breakdown') {
      const quantity = Object.values(value).reduce((sum: number, qty) => sum + (Number(qty) || 0), 0);
      updatedPacks[index].quantity = quantity;
      updatedPacks[index].total_cost = quantity * updatedPacks[index].cost_per_unit;
    } else if (field === 'cost_per_unit') {
      updatedPacks[index].total_cost = updatedPacks[index].quantity * Number(value);
    }

    setPacks(updatedPacks);
    updatePackingDetails(updatedPacks);
  };

  const handleSizeChange = (packIndex: number, size: string, quantity: string) => {
    const updatedPacks = [...packs];
    const qty = parseInt(quantity) || 0;

    if (qty === 0) {
      const { [size]: _, ...rest } = updatedPacks[packIndex].size_breakdown;
      updatedPacks[packIndex].size_breakdown = rest;
    } else {
      updatedPacks[packIndex].size_breakdown = {
        ...updatedPacks[packIndex].size_breakdown,
        [size]: qty,
      };
    }

    // Auto-calculate total quantity for this pack
    const totalQty = Object.values(updatedPacks[packIndex].size_breakdown).reduce(
      (sum, qty) => sum + (Number(qty) || 0),
      0
    );
    updatedPacks[packIndex].quantity = totalQty;
    updatedPacks[packIndex].total_cost = totalQty * updatedPacks[packIndex].cost_per_unit;

    setPacks(updatedPacks);
    updatePackingDetails(updatedPacks);
  };

  const updatePackingDetails = (updatedPacks: PackDetail[]) => {
    if (updatedPacks.length === 0) {
      onChange(null);
      return;
    }

    const totalQuantity = updatedPacks.reduce((sum, pack) => sum + pack.quantity, 0);
    const overallSizeBreakdown: Record<string, number> = {};

    updatedPacks.forEach(pack => {
      Object.entries(pack.size_breakdown).forEach(([size, qty]) => {
        overallSizeBreakdown[size] = (overallSizeBreakdown[size] || 0) + qty;
      });
    });

    onChange({
      packs: updatedPacks,
      total_quantity: totalQuantity,
      overall_size_breakdown: overallSizeBreakdown,
    });
  };

  const availableSizes = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'];
  const availableWidths = ['XS', 'S', 'M', 'L', 'XL'];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <Label>Pack Details (Optional)</Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAddPack}
          disabled={disabled}
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Pack
        </Button>
      </div>

      {packs.length > 0 && (
        <div className="space-y-4">
          {packs.map((pack, packIndex) => (
            <Card key={packIndex}>
              <CardHeader className="pb-3">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-sm">Pack {packIndex + 1}</CardTitle>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemovePack(packIndex)}
                    disabled={disabled}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor={`pack-size-${packIndex}`}>Pack Size</Label>
                    <Input
                      id={`pack-size-${packIndex}`}
                      value={pack.pack_size}
                      onChange={(e) => handlePackChange(packIndex, 'pack_size', e.target.value)}
                      placeholder="S1"
                      disabled={disabled}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`width-${packIndex}`}>Width</Label>
                    <select
                      id={`width-${packIndex}`}
                      value={pack.width}
                      onChange={(e) => handlePackChange(packIndex, 'width', e.target.value)}
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      disabled={disabled}
                    >
                      {availableWidths.map(width => (
                        <option key={width} value={width}>{width}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`cost-${packIndex}`}>Cost/Unit</Label>
                    <Input
                      id={`cost-${packIndex}`}
                      type="number"
                      step="0.01"
                      value={pack.cost_per_unit}
                      onChange={(e) => handlePackChange(packIndex, 'cost_per_unit', e.target.value)}
                      placeholder="0.00"
                      disabled={disabled}
                    />
                  </div>
                </div>

                <div>
                  <Label>Size Breakdown</Label>
                  <div className="grid grid-cols-4 gap-2 mt-2">
                    {availableSizes.map(size => (
                      <div key={size} className="space-y-1">
                        <Label htmlFor={`size-${packIndex}-${size}`} className="text-xs">
                          {size}
                        </Label>
                        <Input
                          id={`size-${packIndex}-${size}`}
                          type="number"
                          value={pack.size_breakdown[size] || ''}
                          onChange={(e) => handleSizeChange(packIndex, size, e.target.value)}
                          placeholder="0"
                          disabled={disabled}
                          className="h-8"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                  <div>
                    <Label className="text-xs text-muted-foreground">Total Quantity</Label>
                    <p className="text-sm font-medium">{pack.quantity}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Total Cost</Label>
                    <p className="text-sm font-medium">${pack.total_cost.toFixed(2)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {packs.length > 0 && (
            <Card className="bg-muted/50">
              <CardContent className="pt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-muted-foreground">Overall Total Quantity</Label>
                    <p className="text-lg font-bold">
                      {packs.reduce((sum, pack) => sum + pack.quantity, 0)}
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Overall Total Cost</Label>
                    <p className="text-lg font-bold">
                      ${packs.reduce((sum, pack) => sum + pack.total_cost, 0).toFixed(2)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
