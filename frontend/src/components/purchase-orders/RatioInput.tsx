'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, X } from 'lucide-react';
import api from '@/lib/api';

interface Gender {
  id: number;
  name: string;
}

interface Size {
  id: number;
  gender_id: number;
  size_code: string;
  size_name: string;
  display_order: number;
}

interface RatioRow {
  id: string;
  sizeCode: string;
  quantity: number;
}

interface RatioInputProps {
  value: Record<string, number> | null;
  onChange: (ratio: Record<string, number> | null) => void;
  styleGenderId?: number;
  disabled?: boolean;
}

export function RatioInput({ value, onChange, styleGenderId, disabled = false }: RatioInputProps) {
  const [genders, setGenders] = useState<Gender[]>([]);
  const [selectedGenderId, setSelectedGenderId] = useState<number | null>(styleGenderId || null);
  const [availableSizes, setAvailableSizes] = useState<Size[]>([]);
  const [ratioRows, setRatioRows] = useState<RatioRow[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch genders on mount
  useEffect(() => {
    fetchGenders();
  }, []);

  // Fetch sizes when gender changes
  useEffect(() => {
    if (selectedGenderId) {
      fetchSizes(selectedGenderId);
    } else {
      setAvailableSizes([]);
    }
  }, [selectedGenderId]);

  // Initialize ratio rows from value prop
  useEffect(() => {
    if (value) {
      const rows = Object.entries(value).map(([sizeCode, quantity], idx) => ({
        id: `row-${Date.now()}-${idx}`,
        sizeCode,
        quantity,
      }));
      setRatioRows(rows);
    } else {
      setRatioRows([]);
    }
  }, []);

  // Auto-select gender from styleGenderId
  useEffect(() => {
    if (styleGenderId) {
      setSelectedGenderId(styleGenderId);
    }
  }, [styleGenderId]);

  const fetchGenders = async () => {
    try {
      const response = await api.get('/master-data/genders?active_only=true&all=true');
      const data = response.data.data || response.data;
      setGenders(data);
    } catch (error) {
      console.error('Failed to fetch genders:', error);
    }
  };

  const fetchSizes = async (genderId: number) => {
    try {
      setLoading(true);
      const response = await api.get(`/master-data/sizes?gender_id=${genderId}&active_only=true&all=true`);
      const data = response.data.data || response.data;
      setAvailableSizes(data.sort((a: Size, b: Size) => a.display_order - b.display_order));
    } catch (error) {
      console.error('Failed to fetch sizes:', error);
    } finally {
      setLoading(false);
    }
  };

  const rowsToRatio = (rows: RatioRow[]): Record<string, number> | null => {
    if (rows.length === 0) return null;
    const ratio: Record<string, number> = {};
    rows.forEach(row => {
      if (row.sizeCode && row.quantity > 0) {
        ratio[row.sizeCode] = row.quantity;
      }
    });
    return Object.keys(ratio).length > 0 ? ratio : null;
  };

  const handleAddRow = () => {
    const newRow: RatioRow = {
      id: `row-${Date.now()}`,
      sizeCode: '',
      quantity: 1,
    };
    const updated = [...ratioRows, newRow];
    setRatioRows(updated);
  };

  const handleUpdateRow = (rowId: string, field: 'sizeCode' | 'quantity', value: string | number) => {
    const updated = ratioRows.map(row =>
      row.id === rowId ? { ...row, [field]: value } : row
    );
    setRatioRows(updated);
    onChange(rowsToRatio(updated));
  };

  const handleRemoveRow = (rowId: string) => {
    const updated = ratioRows.filter(row => row.id !== rowId);
    setRatioRows(updated);
    onChange(rowsToRatio(updated));
  };

  const usedSizes = ratioRows.map(row => row.sizeCode).filter(Boolean);
  const totalPieces = ratioRows.reduce((sum, row) => sum + (row.quantity || 0), 0);

  return (
    <div className="space-y-3">
      <Label className="text-xs">Ratio (Optional)</Label>

      {/* Gender Selection and Add Button */}
      <div className="flex items-center gap-2">
        <Select
          value={selectedGenderId?.toString() || ''}
          onValueChange={(val) => setSelectedGenderId(parseInt(val))}
          disabled={disabled}
        >
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="Select gender for sizes..." />
          </SelectTrigger>
          <SelectContent>
            {genders.map((gender) => (
              <SelectItem key={gender.id} value={gender.id.toString()}>
                {gender.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          size="sm"
          onClick={handleAddRow}
          disabled={disabled || !selectedGenderId || availableSizes.length === 0 || loading}
        >
          <Plus className="h-4 w-4 mr-1" />
          Add Size
        </Button>
      </div>

      {/* Ratio Rows */}
      <div className="space-y-2">
        {ratioRows.map((row) => (
          <div key={row.id} className="flex items-center gap-2 p-2 border rounded-md bg-muted/30">
            <Select
              value={row.sizeCode}
              onValueChange={(val) => handleUpdateRow(row.id, 'sizeCode', val)}
              disabled={disabled || loading}
            >
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Select size" />
              </SelectTrigger>
              <SelectContent>
                {availableSizes
                  .filter(size =>
                    !usedSizes.includes(size.size_code) || size.size_code === row.sizeCode
                  )
                  .map((size) => (
                    <SelectItem key={size.id} value={size.size_code}>
                      {size.size_code} - {size.size_name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>

            <div className="flex items-center gap-1">
              <Label className="text-xs text-muted-foreground whitespace-nowrap">Qty:</Label>
              <Input
                type="number"
                min="1"
                value={row.quantity}
                onChange={(e) => handleUpdateRow(row.id, 'quantity', parseInt(e.target.value) || 1)}
                className="w-20"
                placeholder="Qty"
                disabled={disabled}
              />
            </div>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => handleRemoveRow(row.id)}
              disabled={disabled}
              className="shrink-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}

        {ratioRows.length === 0 && selectedGenderId && !loading && (
          <p className="text-sm text-muted-foreground text-center py-2">
            No ratio defined. Click "Add Size" to start.
          </p>
        )}

        {!selectedGenderId && (
          <p className="text-sm text-muted-foreground text-center py-2">
            Select a gender to add size ratios
          </p>
        )}

        {loading && (
          <p className="text-sm text-muted-foreground text-center py-2">
            Loading sizes...
          </p>
        )}
      </div>

      {/* Total Display */}
      {ratioRows.length > 0 && totalPieces > 0 && (
        <div className="p-2 bg-primary/10 rounded-md">
          <span className="text-sm font-medium">
            Total Ratio: {totalPieces} pieces
          </span>
        </div>
      )}
    </div>
  );
}
