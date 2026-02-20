'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { SpreadsheetSelection } from '@/types/spreadsheet';

interface SpreadsheetFormulaBarProps {
  selection: SpreadsheetSelection | null;
  onValueCommit: (value: string) => void;
}

export function SpreadsheetFormulaBar({ selection, onValueCommit }: SpreadsheetFormulaBarProps) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync display when selection changes
  useEffect(() => {
    if (!editing) {
      setEditValue(selection?.value?.toString() ?? '');
    }
  }, [selection, editing]);

  const commit = useCallback(() => {
    if (editing) {
      onValueCommit(editValue);
      setEditing(false);
    }
  }, [editing, editValue, onValueCommit]);

  const cancel = useCallback(() => {
    setEditing(false);
    setEditValue(selection?.value?.toString() ?? '');
  }, [selection]);

  const isComputed = selection?.columnDef?.key === 'total_price';
  const isEditable = selection?.columnDef?.editable ?? false;

  const displayFormula = isComputed ? '=Qty×Unit Price' : '';

  return (
    <div className="flex items-center h-7 border-b bg-white text-xs" style={{ fontFamily: 'Calibri, "Segoe UI", Arial, sans-serif' }}>
      {/* Cell reference */}
      <div className="flex items-center justify-center w-16 h-full border-r bg-gray-50 font-semibold text-gray-700 select-none shrink-0">
        {selection?.address ?? ''}
      </div>

      {/* fx label */}
      <div className="flex items-center justify-center w-7 h-full border-r text-gray-400 italic select-none shrink-0">
        <span className="text-[11px]">fx</span>
      </div>

      {/* Value / formula */}
      <input
        ref={inputRef}
        className="flex-1 h-full px-2 outline-none bg-white text-[13px]"
        value={editing ? editValue : (isComputed ? displayFormula : (selection?.value?.toString() ?? ''))}
        readOnly={!isEditable || isComputed}
        onFocus={() => {
          if (isEditable && !isComputed) {
            setEditing(true);
            setEditValue(selection?.value?.toString() ?? '');
          }
        }}
        onChange={(e) => setEditValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            commit();
            inputRef.current?.blur();
          } else if (e.key === 'Escape') {
            cancel();
            inputRef.current?.blur();
          }
        }}
        onBlur={commit}
      />
    </div>
  );
}
