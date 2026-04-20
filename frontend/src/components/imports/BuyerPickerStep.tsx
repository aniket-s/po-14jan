'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import { Plus } from 'lucide-react';
import { CreateBuyerDialog } from '@/components/master-data/CreateBuyerDialog';

interface Buyer { id: number; name: string; code?: string | null }

interface Props {
  buyers: Buyer[];
  value: number | null;
  onChange: (id: number | null) => void;
  lockedToCode?: string | null;
  onRefresh?: () => void;
}

export function BuyerPickerStep({ buyers, value, onChange, lockedToCode, onRefresh }: Props) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const filtered = useMemo(() => {
    if (!lockedToCode) return buyers;
    return buyers.filter((b) =>
      (b.code ?? '').toUpperCase() === lockedToCode.toUpperCase() ||
      b.name.toUpperCase().includes(lockedToCode.toUpperCase())
    );
  }, [buyers, lockedToCode]);

  const options = filtered.map((b) => ({
    value: b.id,
    label: b.name,
    description: b.code ?? undefined,
  }));

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium mb-1">Buyer / Importer</p>
        <p className="text-xs text-muted-foreground mb-2">
          {lockedToCode
            ? `Pre-filtered to buyers matching "${lockedToCode}" (from the selected import type).`
            : 'Pick the buying house this document belongs to. You can search by name or code.'}
        </p>
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <Combobox
              options={options}
              value={value ?? undefined}
              onChange={(v) => onChange(typeof v === 'number' ? v : v ? Number(v) : null)}
              placeholder="Select buyer…"
              searchPlaceholder="Search buyers…"
              emptyMessage="No matching buyer. Create one instead."
            />
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => setIsCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> New Buyer
          </Button>
        </div>
        {lockedToCode && filtered.length === 0 && (
          <p className="text-xs text-amber-600 mt-2">
            No buyer with code or name matching "{lockedToCode}" exists. Create one to continue.
          </p>
        )}
      </div>
      <CreateBuyerDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onSuccess={() => {
          setIsCreateOpen(false);
          onRefresh?.();
        }}
      />
    </div>
  );
}
