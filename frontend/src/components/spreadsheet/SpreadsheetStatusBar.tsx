'use client';

import { SpreadsheetPOMeta, CellSaveStatus } from '@/types/spreadsheet';

interface SpreadsheetStatusBarProps {
  poMeta: SpreadsheetPOMeta | null;
  rowCount: number;
  selectionAddress: string | null;
  selectionStats: { count: number; sum: number | null; avg: number | null } | null;
  saveStatuses: Record<string, CellSaveStatus>;
}

export function SpreadsheetStatusBar({
  poMeta,
  rowCount,
  selectionAddress,
  selectionStats,
  saveStatuses,
}: SpreadsheetStatusBarProps) {
  const savingCount = Object.values(saveStatuses).filter((s) => s === 'saving').length;
  const errorCount = Object.values(saveStatuses).filter((s) => s === 'error').length;

  let modeLabel = 'Ready';
  if (savingCount > 0) modeLabel = 'Saving...';
  if (errorCount > 0) modeLabel = `${errorCount} error(s)`;

  return (
    <div
      className="flex items-center justify-between h-6 px-3 border-t bg-[#217346] text-white text-[11px] select-none shrink-0"
      style={{ fontFamily: 'Calibri, "Segoe UI", Arial, sans-serif' }}
    >
      {/* Left: mode */}
      <div className="flex items-center gap-4">
        <span>{modeLabel}</span>
        <span className="opacity-75">{rowCount} styles</span>
        {poMeta && (
          <span className="opacity-75">
            {poMeta.currency_symbol}{poMeta.total_value.toLocaleString(undefined, { minimumFractionDigits: 2 })} total
          </span>
        )}
      </div>

      {/* Right: selection info */}
      <div className="flex items-center gap-4">
        {selectionAddress && <span>Cell: {selectionAddress}</span>}
        {selectionStats && selectionStats.count > 1 && (
          <>
            <span>Count: {selectionStats.count}</span>
            {selectionStats.sum !== null && (
              <span>Sum: {selectionStats.sum.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            )}
            {selectionStats.avg !== null && (
              <span>Avg: {selectionStats.avg.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            )}
          </>
        )}
      </div>
    </div>
  );
}
