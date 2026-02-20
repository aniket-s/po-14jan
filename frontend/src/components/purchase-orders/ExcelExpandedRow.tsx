'use client';

import { ExcelViewStyle } from '@/types';
import { Badge } from '@/components/ui/badge';

interface ExcelExpandedRowProps {
  styles: ExcelViewStyle[];
  currencyCode?: string;
}

export function ExcelExpandedRow({ styles, currencyCode }: ExcelExpandedRowProps) {
  if (!styles || styles.length === 0) {
    return (
      <div className="px-4 py-3 text-sm text-muted-foreground">
        No styles attached to this PO
      </div>
    );
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyCode || 'USD',
      minimumFractionDigits: 2,
    }).format(value);
  };

  return (
    <div className="px-4 py-2">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b text-muted-foreground">
            <th className="py-1.5 px-2 text-left font-medium">Style #</th>
            <th className="py-1.5 px-2 text-left font-medium">Description</th>
            <th className="py-1.5 px-2 text-left font-medium">Color</th>
            <th className="py-1.5 px-2 text-right font-medium">Qty</th>
            <th className="py-1.5 px-2 text-right font-medium">Unit Price</th>
            <th className="py-1.5 px-2 text-right font-medium">Total</th>
            <th className="py-1.5 px-2 text-left font-medium">Status</th>
            <th className="py-1.5 px-2 text-left font-medium">Factory</th>
          </tr>
        </thead>
        <tbody>
          {styles.map((style) => (
            <tr key={style.id} className="border-b last:border-0 hover:bg-muted/30">
              <td className="py-1.5 px-2 font-medium">{style.style_number}</td>
              <td className="py-1.5 px-2 max-w-[200px] truncate">{style.description || '-'}</td>
              <td className="py-1.5 px-2">{style.color_name || '-'}</td>
              <td className="py-1.5 px-2 text-right">{(style.quantity_in_po ?? 0).toLocaleString()}</td>
              <td className="py-1.5 px-2 text-right">{formatCurrency(style.unit_price_in_po ?? 0)}</td>
              <td className="py-1.5 px-2 text-right">{formatCurrency(style.total_price ?? 0)}</td>
              <td className="py-1.5 px-2">
                {style.production_status ? (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    {style.production_status}
                  </Badge>
                ) : '-'}
              </td>
              <td className="py-1.5 px-2">{style.assigned_factory || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
