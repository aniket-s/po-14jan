'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { DataEditorRef } from '@glideapps/glide-data-grid';
import { Loader2 } from 'lucide-react';

import { SpreadsheetSelection } from '@/types/spreadsheet';
import { useAuth } from '@/contexts/AuthContext';
import { SpreadsheetHeader } from './SpreadsheetHeader';
import { SpreadsheetToolbar } from './SpreadsheetToolbar';
import { SpreadsheetFormulaBar } from './SpreadsheetFormulaBar';
import { SpreadsheetGrid } from './SpreadsheetGrid';
import { SpreadsheetStatusBar } from './SpreadsheetStatusBar';
import { useSpreadsheetData } from './hooks/useSpreadsheetData';
import { useSpreadsheetRealtime } from './hooks/useSpreadsheetRealtime';
import { SPREADSHEET_COLUMNS } from './hooks/useSpreadsheetColumns';

interface SpreadsheetViewProps {
  poId: number;
}

export function SpreadsheetView({ poId }: SpreadsheetViewProps) {
  const { user, can } = useAuth();
  const gridRef = useRef<DataEditorRef>(null);

  // Data hook
  const {
    rows,
    poMeta,
    lookups,
    loading,
    error,
    cellSaveStatuses,
    fetchData,
    updateCell,
    undo,
    redo,
    canUndo,
    canRedo,
    addRow,
    deleteRow,
    applyRemoteUpdate,
  } = useSpreadsheetData(poId);

  // Editing permissions
  const canEdit = can('po.edit') || can('po.create');

  // Real-time
  useSpreadsheetRealtime({
    poId,
    currentUserId: user?.id ?? null,
    onCellUpdate: applyRemoteUpdate,
  });

  // Load data on mount
  useEffect(() => {
    fetchData(poId);
  }, [poId, fetchData]);

  // Column visibility
  const [visibleColumnKeys, setVisibleColumnKeys] = useState<string[]>(() =>
    SPREADSHEET_COLUMNS.filter((c) => c.defaultVisible !== false).map((c) => c.key),
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

  // Formula bar commit
  const handleFormulaBarCommit = useCallback(
    (value: string) => {
      if (!selection || !selection.columnDef?.editable || !canEdit) return;
      const colDef = selection.columnDef;

      let parsedValue: any = value;
      if (colDef.kind === 'number' || colDef.kind === 'currency') {
        parsedValue = parseFloat(value) || 0;
      }

      updateCell(selection.row, colDef.key, parsedValue, colDef.target);
    },
    [selection, canEdit, updateCell],
  );

  // Selection stats for status bar
  const selectionStats = useMemo(() => {
    if (!selection) return null;
    // Single cell for now (multi-cell stats can be added later)
    const val = selection.value;
    if (typeof val === 'number') {
      return { count: 1, sum: val, avg: val };
    }
    return { count: 1, sum: null, avg: null };
  }, [selection]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z' && !e.shiftKey) {
          e.preventDefault();
          undo();
        } else if ((e.key === 'y') || (e.key === 'z' && e.shiftKey)) {
          e.preventDefault();
          redo();
        } else if (e.key === 's') {
          e.preventDefault();
          // All changes auto-save; this just prevents the browser dialog
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo]);

  // Toolbar action stubs
  const handleAddRow = useCallback(() => {
    // In a full implementation, this would open a style picker dialog
    // For now, it's a placeholder
    alert('Select an existing style to add to this PO, or create a new one.');
  }, []);

  const handleDeleteRow = useCallback(() => {
    if (!selection) return;
    if (!confirm('Remove this style from the PO?')) return;
    deleteRow(selection.row);
  }, [selection, deleteRow]);

  const handleSearch = useCallback(() => {
    // glide-data-grid has built-in search via Ctrl+F
    // This button triggers the same behavior
  }, []);

  const handleSortAsc = useCallback(() => {
    // Placeholder for sort
  }, []);

  const handleSortDesc = useCallback(() => {
    // Placeholder for sort
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col h-screen w-screen bg-white">
        <div className="h-10 border-b bg-gray-50 animate-pulse" />
        <div className="h-8 border-b bg-gray-50 animate-pulse" />
        <div className="flex-1 p-0">
          <div className="grid grid-cols-8 gap-px bg-gray-200">
            <div className="h-8 bg-gray-100 animate-pulse" />
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="h-8 bg-gray-50 animate-pulse" />
            ))}
            {Array.from({ length: 40 }).map((_, i) => (
              <div key={i} className="h-7 bg-white animate-pulse" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen w-screen bg-white">
        <div className="text-center">
          <p className="text-red-600 font-medium">Failed to load spreadsheet</p>
          <p className="text-sm text-gray-500 mt-1">{error}</p>
          <button
            onClick={() => fetchData(poId)}
            className="mt-3 px-4 py-1.5 text-sm bg-[#217346] text-white rounded hover:bg-[#1a5c38]"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-white">
      {/* Header bar (PO info + save status) */}
      <SpreadsheetHeader poMeta={poMeta} saveStatuses={cellSaveStatuses} canEdit={canEdit} />

      {/* Toolbar ribbon */}
      <SpreadsheetToolbar
        canEdit={canEdit}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={undo}
        onRedo={redo}
        onAddRow={handleAddRow}
        onDeleteRow={handleDeleteRow}
        visibleColumnKeys={visibleColumnKeys}
        onToggleColumn={toggleColumn}
        freezeColumns={freezeColumns}
        onFreezeChange={setFreezeColumns}
        showRowNumbers={showRowNumbers}
        onToggleRowNumbers={() => setShowRowNumbers((v) => !v)}
        onSortAsc={handleSortAsc}
        onSortDesc={handleSortDesc}
        onSearch={handleSearch}
      />

      {/* Formula bar */}
      <SpreadsheetFormulaBar selection={selection} onValueCommit={handleFormulaBarCommit} />

      {/* Grid (fills remaining space) */}
      <div className="flex-1 min-h-0">
        <SpreadsheetGrid
          rows={rows}
          canEdit={canEdit}
          currencySymbol={poMeta?.currency_symbol ?? '$'}
          visibleColumnKeys={visibleColumnKeys}
          onCellEdit={updateCell}
          onSelectionChange={setSelection}
          freezeColumns={freezeColumns}
          showRowNumbers={showRowNumbers}
          gridRef={gridRef}
        />
      </div>

      {/* Status bar */}
      <SpreadsheetStatusBar
        poMeta={poMeta}
        rowCount={rows.length}
        selectionAddress={selection?.address ?? null}
        selectionStats={selectionStats}
        saveStatuses={cellSaveStatuses}
      />
    </div>
  );
}
