'use client';

import { useState, useCallback } from 'react';
import {
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Copy,
  Scissors,
  ClipboardPaste,
  Undo2,
  Redo2,
  Plus,
  Trash2,
  Search,
  ArrowUpDown,
  Filter,
  Columns3,
  Eye,
  EyeOff,
  ZoomIn,
  ZoomOut,
  Snowflake,
  Grid3X3,
  Hash,
  Image,
  SortAsc,
  SortDesc,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ToolbarTab, SpreadsheetColumnDef } from '@/types/spreadsheet';
import { SPREADSHEET_COLUMNS } from './hooks/useSpreadsheetColumns';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// ---------------------------------------------------------------------------
// Toolbar button helper
// ---------------------------------------------------------------------------
function TBtn({
  icon: Icon,
  label,
  onClick,
  disabled,
  active,
  size = 'default',
}: {
  icon: React.ElementType;
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  active?: boolean;
  size?: 'default' | 'sm';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={`inline-flex items-center justify-center rounded px-1.5 py-1 text-xs transition-colors
        ${active ? 'bg-gray-200 text-gray-900' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}
        ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
      `}
    >
      <Icon className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
    </button>
  );
}

function Divider() {
  return <div className="w-px h-5 bg-gray-300 mx-1" />;
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[9px] text-gray-400 tracking-wide uppercase text-center block mt-0.5 select-none">
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------
interface SpreadsheetToolbarProps {
  canEdit: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onAddRow: () => void;
  onDeleteRow: () => void;
  visibleColumnKeys: string[];
  onToggleColumn: (key: string) => void;
  freezeColumns: number;
  onFreezeChange: (n: number) => void;
  showRowNumbers: boolean;
  onToggleRowNumbers: () => void;
  onSortAsc: () => void;
  onSortDesc: () => void;
  onSearch: () => void;
  /** Optional column definitions override (defaults to SPREADSHEET_COLUMNS) */
  columns?: SpreadsheetColumnDef[];
}

export function SpreadsheetToolbar({
  canEdit,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onAddRow,
  onDeleteRow,
  visibleColumnKeys,
  onToggleColumn,
  freezeColumns,
  onFreezeChange,
  showRowNumbers,
  onToggleRowNumbers,
  onSortAsc,
  onSortDesc,
  onSearch,
  columns: columnsProp,
}: SpreadsheetToolbarProps) {
  const [activeTab, setActiveTab] = useState<ToolbarTab>('home');
  const allColumns = columnsProp ?? SPREADSHEET_COLUMNS;

  return (
    <div className="border-b bg-[#f3f3f3] shrink-0 select-none" style={{ fontFamily: 'Calibri, "Segoe UI", Arial, sans-serif' }}>
      {/* Tab bar */}
      <div className="flex items-center h-7 border-b border-gray-300 px-2 gap-0.5">
        {(['home', 'insert', 'data', 'view'] as ToolbarTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-0.5 text-xs font-medium rounded-t transition-colors capitalize
              ${activeTab === tab
                ? 'bg-white border border-b-white border-gray-300 -mb-px text-[#217346]'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200/60'
              }
            `}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content ribbon */}
      <div className="flex items-end px-2 py-1 min-h-[52px] gap-0.5">
        {activeTab === 'home' && (
          <>
            {/* Clipboard */}
            <div className="flex flex-col items-center gap-0.5 px-1">
              <div className="flex gap-0.5">
                <TBtn icon={ClipboardPaste} label="Paste (Ctrl+V)" />
                <TBtn icon={Copy} label="Copy (Ctrl+C)" size="sm" />
                <TBtn icon={Scissors} label="Cut (Ctrl+X)" size="sm" />
              </div>
              <GroupLabel>Clipboard</GroupLabel>
            </div>
            <Divider />

            {/* Font */}
            <div className="flex flex-col items-center gap-0.5 px-1">
              <div className="flex gap-0.5">
                <TBtn icon={Bold} label="Bold (Ctrl+B)" />
                <TBtn icon={Italic} label="Italic (Ctrl+I)" />
                <TBtn icon={Underline} label="Underline (Ctrl+U)" />
              </div>
              <GroupLabel>Font</GroupLabel>
            </div>
            <Divider />

            {/* Alignment */}
            <div className="flex flex-col items-center gap-0.5 px-1">
              <div className="flex gap-0.5">
                <TBtn icon={AlignLeft} label="Align Left" />
                <TBtn icon={AlignCenter} label="Align Center" />
                <TBtn icon={AlignRight} label="Align Right" />
              </div>
              <GroupLabel>Alignment</GroupLabel>
            </div>
            <Divider />

            {/* Number */}
            <div className="flex flex-col items-center gap-0.5 px-1">
              <div className="flex gap-0.5">
                <TBtn icon={Hash} label="Number Format" />
              </div>
              <GroupLabel>Number</GroupLabel>
            </div>
            <Divider />

            {/* Cells */}
            <div className="flex flex-col items-center gap-0.5 px-1">
              <div className="flex gap-0.5">
                <TBtn icon={Plus} label="Insert Row" onClick={onAddRow} disabled={!canEdit} />
                <TBtn icon={Trash2} label="Delete Row" onClick={onDeleteRow} disabled={!canEdit} />
              </div>
              <GroupLabel>Cells</GroupLabel>
            </div>
            <Divider />

            {/* Editing */}
            <div className="flex flex-col items-center gap-0.5 px-1">
              <div className="flex gap-0.5">
                <TBtn icon={Search} label="Find (Ctrl+F)" onClick={onSearch} />
                <TBtn icon={SortAsc} label="Sort A→Z" onClick={onSortAsc} />
                <TBtn icon={SortDesc} label="Sort Z→A" onClick={onSortDesc} />
              </div>
              <GroupLabel>Sort & Find</GroupLabel>
            </div>
            <Divider />

            {/* History */}
            <div className="flex flex-col items-center gap-0.5 px-1">
              <div className="flex gap-0.5">
                <TBtn icon={Undo2} label="Undo (Ctrl+Z)" onClick={onUndo} disabled={!canUndo} />
                <TBtn icon={Redo2} label="Redo (Ctrl+Y)" onClick={onRedo} disabled={!canRedo} />
              </div>
              <GroupLabel>History</GroupLabel>
            </div>
          </>
        )}

        {activeTab === 'insert' && (
          <>
            <div className="flex flex-col items-center gap-0.5 px-1">
              <div className="flex gap-0.5">
                <TBtn icon={Plus} label="Insert Style Row" onClick={onAddRow} disabled={!canEdit} />
              </div>
              <GroupLabel>Rows</GroupLabel>
            </div>
            <Divider />
            <div className="flex flex-col items-center gap-0.5 px-1">
              <div className="flex gap-0.5">
                <TBtn icon={Image} label="Upload Image" disabled />
              </div>
              <GroupLabel>Images</GroupLabel>
            </div>
          </>
        )}

        {activeTab === 'data' && (
          <>
            <div className="flex flex-col items-center gap-0.5 px-1">
              <div className="flex gap-0.5">
                <TBtn icon={SortAsc} label="Sort A→Z" onClick={onSortAsc} />
                <TBtn icon={SortDesc} label="Sort Z→A" onClick={onSortDesc} />
                <TBtn icon={ArrowUpDown} label="Custom Sort" />
              </div>
              <GroupLabel>Sort</GroupLabel>
            </div>
            <Divider />
            <div className="flex flex-col items-center gap-0.5 px-1">
              <div className="flex gap-0.5">
                <TBtn icon={Filter} label="Toggle Filter" />
              </div>
              <GroupLabel>Filter</GroupLabel>
            </div>
          </>
        )}

        {activeTab === 'view' && (
          <>
            {/* Freeze */}
            <div className="flex flex-col items-center gap-0.5 px-1">
              <div className="flex items-center gap-1">
                <TBtn icon={Snowflake} label="Freeze Panes" active={freezeColumns > 0} onClick={() => onFreezeChange(freezeColumns > 0 ? 0 : 1)} />
                <select
                  className="h-6 text-[11px] border rounded bg-white px-1"
                  value={freezeColumns}
                  onChange={(e) => onFreezeChange(parseInt(e.target.value))}
                >
                  <option value={0}>None</option>
                  <option value={1}>1 col</option>
                  <option value={2}>2 cols</option>
                  <option value={3}>3 cols</option>
                </select>
              </div>
              <GroupLabel>Freeze</GroupLabel>
            </div>
            <Divider />

            {/* Show/Hide */}
            <div className="flex flex-col items-center gap-0.5 px-1">
              <div className="flex gap-0.5">
                <TBtn
                  icon={showRowNumbers ? Eye : EyeOff}
                  label="Row Numbers"
                  onClick={onToggleRowNumbers}
                  active={showRowNumbers}
                />
                <TBtn icon={Grid3X3} label="Gridlines" active />
              </div>
              <GroupLabel>Show</GroupLabel>
            </div>
            <Divider />

            {/* Column visibility */}
            <div className="flex flex-col items-center gap-0.5 px-1">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    title="Column Visibility"
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded"
                  >
                    <Columns3 className="h-4 w-4" />
                    <span>Columns</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="max-h-80 overflow-y-auto">
                  {allColumns.map((col) => (
                    <DropdownMenuCheckboxItem
                      key={col.key}
                      checked={visibleColumnKeys.includes(col.key)}
                      onCheckedChange={() => onToggleColumn(col.key)}
                    >
                      {col.title}
                    </DropdownMenuCheckboxItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <GroupLabel>Columns</GroupLabel>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
