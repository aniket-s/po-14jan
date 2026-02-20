'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import DataEditor, {
  GridCell,
  GridCellKind,
  GridColumn,
  EditableGridCell,
  Item,
  CompactSelection,
  GridSelection,
  Theme,
  DataEditorRef,
} from '@glideapps/glide-data-grid';
import '@glideapps/glide-data-grid/dist/index.css';

import { SpreadsheetRow, SpreadsheetSelection, SpreadsheetColumnDef } from '@/types/spreadsheet';
import { SPREADSHEET_COLUMNS, colIndexToLetter, cellAddress } from './hooks/useSpreadsheetColumns';

/** Excel-like green theme */
const EXCEL_THEME: Partial<Theme> = {
  accentColor: '#217346',
  accentLight: '#E2EFDA',
  bgCell: '#FFFFFF',
  bgCellMedium: '#F9F9F9',
  bgHeader: '#E6E6E6',
  bgHeaderHasFocus: '#D9E2F3',
  bgHeaderHovered: '#D6DCE4',
  borderColor: '#D4D4D4',
  textDark: '#000000',
  textHeader: '#333333',
  textMedium: '#737373',
  headerFontStyle: '600 13px',
  baseFontStyle: '13px',
  fontFamily: 'Calibri, "Segoe UI", Arial, sans-serif',
  cellHorizontalPadding: 8,
  cellVerticalPadding: 3,
  editorFontSize: '13px',
  lineHeight: 1.4,
};

export interface SpreadsheetGridProps {
  rows: any[];
  canEdit: boolean;
  currencySymbol: string;
  visibleColumnKeys: string[];
  onCellEdit: (rowIndex: number, field: string, value: any, target: 'style' | 'pivot') => void;
  onSelectionChange: (sel: SpreadsheetSelection | null) => void;
  freezeColumns: number;
  showRowNumbers: boolean;
  gridRef?: React.RefObject<DataEditorRef | null>;
  /** Optional column definitions override (defaults to SPREADSHEET_COLUMNS) */
  columns?: SpreadsheetColumnDef[];
  /** Callback when a cell is double-clicked / activated */
  onCellActivated?: (cell: Item) => void;
}

export default function SpreadsheetGridInner({
  rows,
  canEdit,
  currencySymbol,
  visibleColumnKeys,
  onCellEdit,
  onSelectionChange,
  freezeColumns,
  showRowNumbers,
  gridRef: externalRef,
  columns: columnsProp,
  onCellActivated,
}: SpreadsheetGridProps) {
  const internalRef = useRef<DataEditorRef>(null);
  const ref = externalRef ?? internalRef;

  const allColumns = columnsProp ?? SPREADSHEET_COLUMNS;

  // Filter columns by visibility
  const activeColumns = useMemo(
    () => allColumns.filter((c) => visibleColumnKeys.includes(c.key)),
    [allColumns, visibleColumnKeys],
  );

  // Map to glide-data-grid GridColumn format
  const gridColumns: GridColumn[] = useMemo(
    () =>
      activeColumns.map((col, i) => ({
        id: col.key,
        title: col.title,
        width: col.width,
        // Show Excel-style letter as group header
        group: colIndexToLetter(i),
        hasMenu: false,
        themeOverride:
          col.align === 'right'
            ? { cellHorizontalPadding: 12 }
            : col.align === 'center'
              ? { cellHorizontalPadding: 4 }
              : undefined,
      })),
    [activeColumns],
  );

  // Selection state
  const [selection, setSelection] = useState<GridSelection>({
    columns: CompactSelection.empty(),
    rows: CompactSelection.empty(),
  });

  // ----- Cell content provider -----
  const getCellContent = useCallback(
    (cell: Item): GridCell => {
      const [colIdx, rowIdx] = cell;
      const row = rows[rowIdx];
      const colDef = activeColumns[colIdx];

      if (!row || !colDef) {
        return { kind: GridCellKind.Text, data: '', displayData: '', allowOverlay: false };
      }

      const rawValue = (row as any)[colDef.key];
      const editable = canEdit && colDef.editable;

      switch (colDef.kind) {
        case 'number': {
          const num = typeof rawValue === 'number' ? rawValue : parseFloat(rawValue) || 0;
          return {
            kind: GridCellKind.Number,
            data: num,
            displayData: num.toLocaleString(),
            allowOverlay: editable,
            readonly: !editable,
            contentAlign: 'right',
          };
        }

        case 'currency': {
          const num = typeof rawValue === 'number' ? rawValue : parseFloat(rawValue) || 0;
          return {
            kind: GridCellKind.Number,
            data: num,
            displayData: `${currencySymbol}${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            allowOverlay: editable,
            readonly: !editable,
            contentAlign: 'right',
          };
        }

        case 'date': {
          const str = rawValue ?? '';
          return {
            kind: GridCellKind.Text,
            data: str,
            displayData: str ? new Date(str + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '',
            allowOverlay: editable,
            readonly: !editable,
          };
        }

        case 'image': {
          const imgs = Array.isArray(rawValue) ? rawValue : [];
          if (imgs.length > 0) {
            return {
              kind: GridCellKind.Image,
              data: [imgs[0]],
              displayData: [imgs[0]],
              allowOverlay: true,
              readonly: true,
            };
          }
          return {
            kind: GridCellKind.Text,
            data: '',
            displayData: '',
            allowOverlay: false,
            readonly: true,
          };
        }

        case 'dropdown': {
          const val = rawValue ?? '';
          return {
            kind: GridCellKind.Text,
            data: val,
            displayData: val ? val.replace(/_/g, ' ') : '',
            allowOverlay: editable,
            readonly: !editable,
          };
        }

        case 'badge': {
          const val = rawValue ?? '';
          return {
            kind: GridCellKind.Text,
            data: val,
            displayData: val ? val.replace(/_/g, ' ') : '-',
            allowOverlay: false,
            readonly: true,
          };
        }

        case 'json': {
          const jsonVal = rawValue ? JSON.stringify(rawValue) : '';
          return {
            kind: GridCellKind.Text,
            data: jsonVal,
            displayData: jsonVal,
            allowOverlay: editable,
            readonly: !editable,
          };
        }

        default: {
          const text = rawValue?.toString() ?? '';
          return {
            kind: GridCellKind.Text,
            data: text,
            displayData: text,
            allowOverlay: editable,
            readonly: !editable,
          };
        }
      }
    },
    [rows, activeColumns, canEdit, currencySymbol],
  );

  // ----- Cell edit handler -----
  const onCellEdited = useCallback(
    (cell: Item, newValue: EditableGridCell) => {
      const [colIdx, rowIdx] = cell;
      const colDef = activeColumns[colIdx];
      if (!colDef || !colDef.editable || !canEdit) return;

      let value: any;
      if (newValue.kind === GridCellKind.Number) {
        value = newValue.data;
      } else if (newValue.kind === GridCellKind.Text) {
        value = newValue.data;
      } else if (newValue.kind === GridCellKind.Boolean) {
        value = newValue.data;
      } else {
        value = (newValue as any).data;
      }

      onCellEdit(rowIdx, colDef.key, value, colDef.target);
    },
    [activeColumns, canEdit, onCellEdit],
  );

  // ----- Column resize -----
  const onColumnResize = useCallback(
    (col: GridColumn, newSize: number) => {
      // Column widths are local state; we could persist to localStorage
    },
    [],
  );

  // ----- Selection change → formula bar sync -----
  const handleSelectionChange = useCallback(
    (newSel: GridSelection) => {
      setSelection(newSel);
      if (newSel.current?.cell) {
        const [colIdx, rowIdx] = newSel.current.cell;
        const colDef = activeColumns[colIdx];
        const row = rows[rowIdx];
        if (colDef && row) {
          onSelectionChange({
            col: colIdx,
            row: rowIdx,
            address: cellAddress(colIdx, rowIdx),
            value: (row as any)[colDef.key],
            columnDef: colDef,
          });
        }
      } else {
        onSelectionChange(null);
      }
    },
    [activeColumns, rows, onSelectionChange],
  );

  // ----- Row markers (row numbers) -----
  const rowMarkers = showRowNumbers ? ('number' as const) : ('none' as const);

  return (
    <DataEditor
      ref={ref}
      columns={gridColumns}
      rows={rows.length}
      getCellContent={getCellContent}
      onCellEdited={onCellEdited}
      onGridSelectionChange={handleSelectionChange}
      gridSelection={selection}
      onColumnResize={onColumnResize}
      theme={EXCEL_THEME}
      rowMarkers={rowMarkers}
      smoothScrollX
      smoothScrollY
      overscrollX={0}
      overscrollY={0}
      freezeColumns={freezeColumns}
      getCellsForSelection={true}
      keybindings={{
        copy: true,
        paste: true,
        search: true,
        selectAll: true,
        selectColumn: true,
        selectRow: true,
        downFill: true,
        rightFill: true,
      }}
      width="100%"
      height="100%"
      rowHeight={28}
      headerHeight={32}
      groupHeaderHeight={24}
      minColumnWidth={40}
      maxColumnAutoWidth={500}
      scaleToRem={false}
      drawFocusRing={true}
      rangeSelect="multi-rect"
      columnSelect="multi"
      rowSelect="multi"
      preventDiagonalScrolling={false}
      rightElement={null}
      onCellActivated={onCellActivated}
    />
  );
}
