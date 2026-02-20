'use client';

import { useState, useCallback, useRef } from 'react';
import api from '@/lib/api';
import {
  SpreadsheetRow,
  SpreadsheetPOMeta,
  SpreadsheetDataResponse,
  CellUpdatePayload,
  EditHistoryEntry,
  CellSaveStatus,
} from '@/types/spreadsheet';

interface UseSpreadsheetDataReturn {
  rows: SpreadsheetRow[];
  poMeta: SpreadsheetPOMeta | null;
  lookups: SpreadsheetDataResponse['lookups'] | null;
  loading: boolean;
  error: string | null;
  cellSaveStatuses: Record<string, CellSaveStatus>;
  fetchData: (poId: number) => Promise<void>;
  updateCell: (rowIndex: number, field: string, value: any, target: 'style' | 'pivot') => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  addRow: (styleId: number) => Promise<void>;
  deleteRow: (rowIndex: number) => Promise<void>;
  /** Apply a remote update (from WebSocket) */
  applyRemoteUpdate: (styleId: number, field: string, value: any) => void;
}

export function useSpreadsheetData(poId: number | null): UseSpreadsheetDataReturn {
  const [rows, setRows] = useState<SpreadsheetRow[]>([]);
  const [poMeta, setPoMeta] = useState<SpreadsheetPOMeta | null>(null);
  const [lookups, setLookups] = useState<SpreadsheetDataResponse['lookups'] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cellSaveStatuses, setCellSaveStatuses] = useState<Record<string, CellSaveStatus>>({});

  // Undo/redo stacks
  const undoStack = useRef<EditHistoryEntry[]>([]);
  const redoStack = useRef<EditHistoryEntry[]>([]);
  const [undoLen, setUndoLen] = useState(0);
  const [redoLen, setRedoLen] = useState(0);

  // Debounce timers per cell
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const fetchData = useCallback(async (id: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<SpreadsheetDataResponse>(`/purchase-orders/${id}/spreadsheet-data`);
      setPoMeta(res.data.po);
      setRows(res.data.rows);
      setLookups(res.data.lookups);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load spreadsheet data');
    } finally {
      setLoading(false);
    }
  }, []);

  const setCellStatus = useCallback((key: string, status: CellSaveStatus) => {
    setCellSaveStatuses((prev) => ({ ...prev, [key]: status }));
    if (status === 'saved') {
      setTimeout(() => {
        setCellSaveStatuses((prev) => ({ ...prev, [key]: 'idle' }));
      }, 2000);
    }
  }, []);

  const persistCell = useCallback(
    (styleId: number, field: string, value: any, target: 'style' | 'pivot') => {
      if (!poId) return;
      const cellKey = `${styleId}:${field}`;
      setCellStatus(cellKey, 'saving');

      // Clear any pending debounce for this cell
      if (saveTimers.current[cellKey]) {
        clearTimeout(saveTimers.current[cellKey]);
      }

      saveTimers.current[cellKey] = setTimeout(async () => {
        try {
          const payload: CellUpdatePayload = { field, value, target };
          const res = await api.patch(
            `/purchase-orders/${poId}/styles/${styleId}/cell`,
            payload,
          );
          setCellStatus(cellKey, 'saved');

          // Update PO totals if returned
          if (res.data.po_totals && poMeta) {
            setPoMeta((prev) =>
              prev
                ? {
                    ...prev,
                    total_quantity: res.data.po_totals.total_quantity,
                    total_value: res.data.po_totals.total_value,
                  }
                : prev,
            );
          }

          // Update total_price if it was recalculated
          if (res.data.total_price !== undefined) {
            setRows((prev) =>
              prev.map((r) =>
                r._styleId === styleId ? { ...r, total_price: res.data.total_price } : r,
              ),
            );
          }
        } catch {
          setCellStatus(cellKey, 'error');
          // Could revert, but for now just flag error
        }
      }, 400);
    },
    [poId, poMeta, setCellStatus],
  );

  const updateCell = useCallback(
    (rowIndex: number, field: string, value: any, target: 'style' | 'pivot') => {
      setRows((prev) => {
        const row = prev[rowIndex];
        if (!row) return prev;

        const oldValue = (row as any)[field];
        if (oldValue === value) return prev;

        // Push to undo stack
        undoStack.current.push({
          styleId: row._styleId,
          field,
          target,
          oldValue,
          newValue: value,
          timestamp: Date.now(),
        });
        redoStack.current = [];
        setUndoLen(undoStack.current.length);
        setRedoLen(0);

        const updated = [...prev];
        updated[rowIndex] = { ...row, [field]: value };

        // Recompute total_price locally if qty or unit_price changed
        if (field === 'quantity_in_po' || field === 'unit_price_in_po') {
          const qty = field === 'quantity_in_po' ? (value ?? 0) : (updated[rowIndex].quantity_in_po ?? 0);
          const price = field === 'unit_price_in_po'
            ? (value ?? updated[rowIndex].unit_price ?? 0)
            : (updated[rowIndex].unit_price_in_po ?? updated[rowIndex].unit_price ?? 0);
          updated[rowIndex] = { ...updated[rowIndex], total_price: qty * price };
        }

        // Persist to backend
        persistCell(row._styleId, field, value, target);

        return updated;
      });
    },
    [persistCell],
  );

  const undo = useCallback(() => {
    const entry = undoStack.current.pop();
    if (!entry) return;
    redoStack.current.push(entry);
    setUndoLen(undoStack.current.length);
    setRedoLen(redoStack.current.length);

    setRows((prev) =>
      prev.map((r) =>
        r._styleId === entry.styleId ? { ...r, [entry.field]: entry.oldValue } : r,
      ),
    );
    persistCell(entry.styleId, entry.field, entry.oldValue, entry.target);
  }, [persistCell]);

  const redo = useCallback(() => {
    const entry = redoStack.current.pop();
    if (!entry) return;
    undoStack.current.push(entry);
    setUndoLen(undoStack.current.length);
    setRedoLen(redoStack.current.length);

    setRows((prev) =>
      prev.map((r) =>
        r._styleId === entry.styleId ? { ...r, [entry.field]: entry.newValue } : r,
      ),
    );
    persistCell(entry.styleId, entry.field, entry.newValue, entry.target);
  }, [persistCell]);

  const addRow = useCallback(
    async (styleId: number) => {
      if (!poId) return;
      try {
        await api.post(`/purchase-orders/${poId}/styles/attach`, {
          styles: [{ style_id: styleId, quantity_in_po: 0, unit_price_in_po: 0 }],
        });
        await fetchData(poId);
      } catch (err: any) {
        setError(err?.response?.data?.message || 'Failed to add style');
      }
    },
    [poId, fetchData],
  );

  const deleteRow = useCallback(
    async (rowIndex: number) => {
      if (!poId) return;
      const row = rows[rowIndex];
      if (!row) return;
      try {
        await api.delete(`/purchase-orders/${poId}/styles/${row._styleId}/detach`);
        setRows((prev) => prev.filter((_, i) => i !== rowIndex));
      } catch (err: any) {
        setError(err?.response?.data?.message || 'Failed to remove style');
      }
    },
    [poId, rows],
  );

  const applyRemoteUpdate = useCallback(
    (styleId: number, field: string, value: any) => {
      setRows((prev) =>
        prev.map((r) => (r._styleId === styleId ? { ...r, [field]: value } : r)),
      );
    },
    [],
  );

  return {
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
    canUndo: undoLen > 0,
    canRedo: redoLen > 0,
    addRow,
    deleteRow,
    applyRemoteUpdate,
  };
}
