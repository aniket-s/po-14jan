'use client';

import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Trash2, Package } from 'lucide-react';
import api from '@/lib/api';

interface PrepackCode {
  id: number;
  code: string;
  name: string;
  size_range: string;
  ratio: string;
  sizes: Record<string, number>;
  total_pieces_per_pack: number;
}

interface SelectedPrepack {
  prepack_code_id: number;
  quantity: number;
  notes?: string;
}

interface PrepackSelectorProps {
  prepacks: SelectedPrepack[];
  onChange: (prepacks: SelectedPrepack[]) => void;
}

export function PrepackSelector({ prepacks, onChange }: PrepackSelectorProps) {
  const [prepackCodes, setPrepackCodes] = useState<PrepackCode[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPrepackCodes();
  }, []);

  const fetchPrepackCodes = async () => {
    try {
      const response = await api.get('/master-data/prepack-codes?all=true');
      setPrepackCodes(response.data || []);
    } catch (error) {
      console.error('Failed to fetch prepack codes:', error);
    } finally {
      setLoading(false);
    }
  };

  const addPrepack = () => {
    onChange([
      ...prepacks,
      {
        prepack_code_id: 0,
        quantity: 1,
        notes: '',
      },
    ]);
  };

  const removePrepack = (index: number) => {
    onChange(prepacks.filter((_, i) => i !== index));
  };

  const updatePrepack = (index: number, field: keyof SelectedPrepack, value: any) => {
    const updated = [...prepacks];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  const getPrepackCodeDetails = (id: number): PrepackCode | null => {
    return prepackCodes.find((pc) => pc.id === id) || null;
  };

  const calculateTotalPieces = (prepack: SelectedPrepack): number => {
    const code = getPrepackCodeDetails(prepack.prepack_code_id);
    return code ? code.total_pieces_per_pack * prepack.quantity : 0;
  };

  const getTotalPiecesAllPrepacks = (): number => {
    return prepacks.reduce((sum, prepack) => sum + calculateTotalPieces(prepack), 0);
  };

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading prepack codes...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Prepacks
            </CardTitle>
            <CardDescription>
              Select prepack codes and quantities for this style
            </CardDescription>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={addPrepack}>
            <Plus className="mr-2 h-4 w-4" />
            Add Prepack
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {prepacks.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No prepacks added. Click "Add Prepack" to start.
          </p>
        )}

        {prepacks.map((prepack, index) => {
          const details = getPrepackCodeDetails(prepack.prepack_code_id);
          return (
            <div key={index} className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">Prepack {index + 1}</h4>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removePrepack(index)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Prepack Code *</Label>
                  <Select
                    value={prepack.prepack_code_id?.toString() || ''}
                    onValueChange={(value) =>
                      updatePrepack(index, 'prepack_code_id', parseInt(value))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select prepack code" />
                    </SelectTrigger>
                    <SelectContent>
                      {prepackCodes.map((code) => (
                        <SelectItem key={code.id} value={code.id.toString()}>
                          {code.code} - {code.name} ({code.size_range})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Number of Packs *</Label>
                  <Input
                    type="number"
                    min="1"
                    value={prepack.quantity}
                    onChange={(e) =>
                      updatePrepack(index, 'quantity', parseInt(e.target.value) || 1)
                    }
                    placeholder="1"
                  />
                </div>
              </div>

              {details && (
                <div className="bg-muted p-3 rounded-md space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Ratio:</span>
                    <span className="font-medium">{details.ratio}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Pieces per pack:</span>
                    <span className="font-medium">{details.total_pieces_per_pack}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total pieces:</span>
                    <span className="font-semibold text-primary">
                      {calculateTotalPieces(prepack)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Size breakdown:</span>
                    <span className="font-medium">
                      {Object.entries(details.sizes)
                        .map(([size, qty]) => `${size}: ${qty}`)
                        .join(', ')}
                    </span>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>Notes</Label>
                <Input
                  value={prepack.notes || ''}
                  onChange={(e) => updatePrepack(index, 'notes', e.target.value)}
                  placeholder="Optional notes for this prepack"
                />
              </div>
            </div>
          );
        })}

        {prepacks.length > 0 && (
          <div className="bg-primary/10 p-4 rounded-lg">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium">Total Pieces (All Prepacks):</span>
              <span className="text-lg font-bold text-primary">{getTotalPiecesAllPrepacks()}</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
