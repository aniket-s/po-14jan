'use client';

import Link from 'next/link';
import { ArrowLeft, Save, Check, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SpreadsheetPOMeta, CellSaveStatus } from '@/types/spreadsheet';

interface SpreadsheetHeaderProps {
  poMeta: SpreadsheetPOMeta | null;
  saveStatuses: Record<string, CellSaveStatus>;
  canEdit: boolean;
}

export function SpreadsheetHeader({ poMeta, saveStatuses, canEdit }: SpreadsheetHeaderProps) {
  const savingCount = Object.values(saveStatuses).filter((s) => s === 'saving').length;
  const errorCount = Object.values(saveStatuses).filter((s) => s === 'error').length;
  const savedRecently = Object.values(saveStatuses).filter((s) => s === 'saved').length;

  return (
    <div className="flex items-center justify-between h-9 px-2 border-b bg-[#217346] text-white shrink-0">
      {/* Left: back + PO info */}
      <div className="flex items-center gap-2">
        <Link href={poMeta ? `/purchase-orders/${poMeta.id}` : '/purchase-orders'}>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-white hover:bg-white/20">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <span className="font-semibold text-sm">
          {poMeta?.po_number ?? 'Loading...'}
        </span>
        {poMeta?.headline && (
          <span className="text-xs opacity-80 truncate max-w-[200px]">
            — {poMeta.headline}
          </span>
        )}
        {poMeta && (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-white/40 text-white">
            {poMeta.status}
          </Badge>
        )}
      </div>

      {/* Center: save indicator */}
      <div className="flex items-center gap-2 text-xs">
        {savingCount > 0 && (
          <span className="flex items-center gap-1 opacity-80">
            <Save className="h-3 w-3 animate-pulse" /> Saving...
          </span>
        )}
        {savingCount === 0 && errorCount === 0 && savedRecently > 0 && (
          <span className="flex items-center gap-1 opacity-80">
            <Check className="h-3 w-3" /> All changes saved
          </span>
        )}
        {errorCount > 0 && (
          <span className="flex items-center gap-1 text-red-200">
            <AlertCircle className="h-3 w-3" /> {errorCount} save error(s)
          </span>
        )}
      </div>

      {/* Right: metadata */}
      <div className="flex items-center gap-3 text-xs opacity-80">
        {canEdit && <span className="text-green-200">Editing</span>}
        {!canEdit && <span className="text-yellow-200">Read Only</span>}
        {poMeta?.retailer_name && <span>{poMeta.retailer_name}</span>}
        {poMeta?.season_name && <span>{poMeta.season_name}</span>}
      </div>
    </div>
  );
}
