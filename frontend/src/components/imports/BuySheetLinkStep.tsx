'use client';

import { useEffect, useState } from 'react';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Combobox } from '@/components/ui/combobox';
import { fetchBuySheetsForBuyer } from './api';
import type { BuySheetSummary } from './types';

interface Props {
  buyerId: number | null;
  value: 'yes' | 'no' | null;
  onChange: (v: 'yes' | 'no', sheet: BuySheetSummary | null) => void;
  selectedSheet: BuySheetSummary | null;
}

export function BuySheetLinkStep({ buyerId, value, onChange, selectedSheet }: Props) {
  const [sheets, setSheets] = useState<BuySheetSummary[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (value !== 'yes' || !buyerId) return;
    setLoading(true);
    fetchBuySheetsForBuyer(buyerId)
      .then(setSheets)
      .catch(() => setSheets([]))
      .finally(() => setLoading(false));
  }, [buyerId, value]);

  return (
    <div className="space-y-4">
      <div>
        <Label className="text-sm font-medium">Is this against an existing buy sheet?</Label>
        <p className="text-xs text-muted-foreground mb-2">
          Some buyers send styles first via a buy sheet, then send the PO later. Linking preserves the history.
        </p>
        <RadioGroup
          value={value ?? ''}
          onValueChange={(v) => onChange(v as 'yes' | 'no', v === 'yes' ? selectedSheet : null)}
          className="flex gap-6"
        >
          <div className="flex items-center gap-2">
            <RadioGroupItem value="yes" id="bs-yes" />
            <Label htmlFor="bs-yes">Yes, link to a buy sheet</Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="no" id="bs-no" />
            <Label htmlFor="bs-no">No, import as a new PO</Label>
          </div>
        </RadioGroup>
      </div>

      {value === 'yes' && (
        <div>
          <Label className="text-xs text-muted-foreground">Buy sheet</Label>
          <Combobox
            options={sheets.map((s) => ({
              value: s.id,
              label: `${s.buy_sheet_number} — ${s.name ?? 'Untitled'}`,
              description: `${s.total_styles} styles · ${s.total_quantity} units`,
            }))}
            value={selectedSheet?.id ?? undefined}
            onChange={(v) => {
              const id = typeof v === 'number' ? v : v ? Number(v) : null;
              onChange('yes', sheets.find((s) => s.id === id) ?? null);
            }}
            placeholder={loading ? 'Loading…' : 'Select buy sheet…'}
            searchPlaceholder="Search by number or name…"
            emptyMessage={buyerId ? 'No open buy sheets for this buyer.' : 'Pick a buyer first.'}
          />
        </div>
      )}
    </div>
  );
}
