'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { DataEditorRef } from '@glideapps/glide-data-grid';
import { Loader2, ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';

import { SpreadsheetSelection } from '@/types/spreadsheet';
import { SpreadsheetGrid } from './SpreadsheetGrid';
import { SpreadsheetToolbar } from './SpreadsheetToolbar';
import { SpreadsheetFormulaBar } from './SpreadsheetFormulaBar';
import { usePoListSpreadsheetData } from './hooks/usePoListSpreadsheetData';
import { PO_LIST_COLUMNS } from './hooks/usePoListColumns';
import { Button } from '@/components/ui/button';

interface PoListSpreadsheetViewProps {
  searchTerm?: string;
  onBack?: () => void;
}

export function PoListSpreadsheetView({ searchTerm, onBack }: PoListSpreadsheetViewProps) {
  const router = useRouter();
  const gridRef = useRef<DataEditorRef>(null);

  const {
    rows,
    loading,
    error,
    currentPage,
    totalPages,
    totalRows,
    fetchData,
    navigateToPage,
  } = usePoListSpreadsheetData();

  // Load on mount and when search changes
  useEffect(() => {
    fetchData({ search: searchTerm || undefined, page: 1 });
  }, [searchTerm, fetchData]);

  // Column visibility
  const [visibleColumnKeys, setVisibleColumnKeys] = useState<string[]>(() =>
    PO_LIST_COLUMNS.filter((c) => c.defaultVisible !== false).map((c) => c.key),
  );

  const toggleColumn = useCallback((key: string) => {
    setVisibleColumnKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  }, []);

  // View settings
  const [freezeColumns, setFreezeColumns] = useState(1);
  const [showRowNumbers, setShowRowNumbers] = useState(true);

  // Selection
  const [selection, setSelection] = useState<SpreadsheetSelection | null>(null);

  // Navigate to PO on double-click
  const handleCellActivated = useCallback(
    (cell: readonly [number, number]) => {
      const [, rowIdx] = cell;
      const row = rows[rowIdx];
      if (row) {
        router.push(`/purchase-orders/${row._poId}`);
      }
    },
    [rows, router],
  );

  // Noop handlers for toolbar actions that don't apply here
  const noop = useCallback(() => {}, []);

  // Selection stats for status bar
  const selectionStats = useMemo(() => {
    if (!selection) return null;
    const val = selection.value;
    if (typeof val === 'number') {
      return { count: 1, sum: val, avg: val };
    }
    return { count: 1, sum: null, avg: null };
  }, [selection]);

  if (loading && rows.length === 0) {
    return (
      <div className="flex items-center justify-center h-full w-full bg-white">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-[#217346]" />
          <span className="text-sm text-gray-500">Loading purchase orders...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full w-full bg-white">
        <div className="text-center">
          <p className="text-red-600 font-medium">Failed to load purchase orders</p>
          <p className="text-sm text-gray-500 mt-1">{error}</p>
          <button
            onClick={() => fetchData({ search: searchTerm || undefined })}
            className="mt-3 px-4 py-1.5 text-sm bg-[#217346] text-white rounded hover:bg-[#1a5c38]"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full overflow-hidden bg-white">
      {/* Header bar */}
      <div className="flex items-center justify-between h-9 px-2 border-b bg-[#217346] text-white shrink-0">
        <div className="flex items-center gap-2">
          {onBack && (
            <Button variant="ghost" size="icon" className="h-7 w-7 text-white hover:bg-white/20" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          <span className="font-semibold text-sm">Purchase Orders</span>
          <span className="text-xs opacity-80">{totalRows} orders</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          {loading && <span className="opacity-80">Loading...</span>}
          <span className="opacity-80">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => navigateToPage(Math.max(1, currentPage - 1))}
            disabled={currentPage <= 1}
            className="p-0.5 rounded hover:bg-white/20 disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => navigateToPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage >= totalPages}
            className="p-0.5 rounded hover:bg-white/20 disabled:opacity-40"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Toolbar ribbon */}
      <SpreadsheetToolbar
        canEdit={false}
        canUndo={false}
        canRedo={false}
        onUndo={noop}
        onRedo={noop}
        onAddRow={noop}
        onDeleteRow={noop}
        visibleColumnKeys={visibleColumnKeys}
        onToggleColumn={toggleColumn}
        freezeColumns={freezeColumns}
        onFreezeChange={setFreezeColumns}
        showRowNumbers={showRowNumbers}
        onToggleRowNumbers={() => setShowRowNumbers((v) => !v)}
        onSortAsc={noop}
        onSortDesc={noop}
        onSearch={noop}
        columns={PO_LIST_COLUMNS}
      />

      {/* Formula bar */}
      <SpreadsheetFormulaBar selection={selection} onValueCommit={noop} />

      {/* Grid (fills remaining space) */}
      <div className="flex-1 min-h-0">
        <SpreadsheetGrid
          rows={rows}
          canEdit={false}
          currencySymbol="$"
          visibleColumnKeys={visibleColumnKeys}
          onCellEdit={noop}
          onSelectionChange={setSelection}
          freezeColumns={freezeColumns}
          showRowNumbers={showRowNumbers}
          gridRef={gridRef}
          columns={PO_LIST_COLUMNS}
          onCellActivated={handleCellActivated}
        />
      </div>

      {/* Status bar */}
      <div
        className="flex items-center justify-between h-6 px-3 border-t bg-[#217346] text-white text-[11px] select-none shrink-0"
        style={{ fontFamily: 'Calibri, "Segoe UI", Arial, sans-serif' }}
      >
        <div className="flex items-center gap-4">
          <span>Ready</span>
          <span className="opacity-75">{totalRows} purchase orders</span>
          <span className="opacity-75">Page {currentPage}/{totalPages}</span>
        </div>
        <div className="flex items-center gap-4">
          {selection?.address && <span>Cell: {selection.address}</span>}
          {selectionStats?.sum !== null && selectionStats?.sum !== undefined && (
            <span>Sum: {selectionStats.sum.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          )}
        </div>
      </div>
    </div>
  );
}
