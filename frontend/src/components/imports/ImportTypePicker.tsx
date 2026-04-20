'use client';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { FileText, FileSpreadsheet } from 'lucide-react';
import type { ImportStrategy } from './types';

interface Props {
  strategies: ImportStrategy[];
  selectedKey: string | null;
  onSelect: (strategy: ImportStrategy) => void;
  loading?: boolean;
}

export function ImportTypePicker({ strategies, selectedKey, onSelect, loading }: Props) {
  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading import types…</p>;
  }
  if (!strategies.length) {
    return <p className="text-sm text-muted-foreground">No import strategies configured.</p>;
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {strategies.map((s) => {
        const Icon = s.format === 'pdf' ? FileText : FileSpreadsheet;
        const isSelected = selectedKey === s.key;
        return (
          <Card
            key={s.key}
            className={`cursor-pointer transition-colors hover:border-primary ${isSelected ? 'border-primary ring-2 ring-primary/30' : ''}`}
            onClick={() => onSelect(s)}
          >
            <CardContent className="p-4 flex items-start gap-3">
              <Icon className="h-5 w-5 text-muted-foreground mt-1 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium">{s.label}</span>
                  <Badge variant="outline" className="text-xs uppercase">{s.format}</Badge>
                  <Badge
                    variant={s.document_kind === 'buy_sheet' ? 'secondary' : 'default'}
                    className="text-xs"
                  >
                    {s.document_kind === 'buy_sheet' ? 'Buy Sheet' : 'Purchase Order'}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Buyer: <span className="font-mono">{s.buyer_code}</span>
                  {s.supports_buy_sheet && ' · can link to an existing buy sheet'}
                </p>
              </div>
              {isSelected && (
                <Button size="sm" variant="default" className="pointer-events-none h-7">Selected</Button>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
