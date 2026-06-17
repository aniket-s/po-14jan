'use client';

import { useMemo } from 'react';
import { T_IGNORE, T_METADATA, type BulkColumn, type BulkRow, type FieldCatalogItem, type RowIssue } from './types';

interface Props {
  columns: BulkColumn[];
  rows: BulkRow[];
  mapping: Record<number, string>;
  fieldCatalog: FieldCatalogItem[];
  onChangeTarget: (columnIndex: number, target: string) => void;
  rowIssues: (row: BulkRow) => RowIssue[];
  fieldColumn: Record<string, number | undefined>;
}

const SIZE_OPTIONS = ['XS', 'S', 'M', 'L', 'XL', '1XL', '2XL', '3XL', '4XL', '5XL'];
const MAX_RENDER_ROWS = 150;

const headerTone = (target: string, fieldKeys: Set<string>): string => {
  if (target.startsWith('size:')) return 'bg-teal-50 dark:bg-teal-950/40 border-teal-300';
  if (target === T_METADATA) return 'bg-blue-50 dark:bg-blue-950/40 border-blue-300';
  if (target === T_IGNORE) return 'bg-muted/40 border-border';
  if (fieldKeys.has(target)) return 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300';
  return 'bg-muted/40 border-border';
};

export function RawPreviewGrid({ columns, rows, mapping, fieldCatalog, onChangeTarget, rowIssues, fieldColumn }: Props) {
  const fieldKeys = useMemo(() => new Set(fieldCatalog.map((f) => f.key)), [fieldCatalog]);
  const groups = useMemo(() => {
    const byGroup: Record<string, FieldCatalogItem[]> = {};
    for (const f of fieldCatalog) (byGroup[f.group] ??= []).push(f);
    return byGroup;
  }, [fieldCatalog]);

  // column index -> field key (for cell highlighting from row issues)
  const fieldByColumn = useMemo(() => {
    const out: Record<number, string> = {};
    for (const [field, col] of Object.entries(fieldColumn)) {
      if (col !== undefined) out[col] = field;
    }
    return out;
  }, [fieldColumn]);

  const rendered = rows.slice(0, MAX_RENDER_ROWS);

  return (
    <div className="rounded-md border overflow-auto max-h-[52vh]">
      <table className="border-collapse text-xs">
        <thead className="sticky top-0 z-20">
          {/* Column letter + name */}
          <tr>
            <th className="sticky left-0 z-30 bg-muted border-b border-r px-2 py-1 text-left font-medium w-12">#</th>
            {columns.map((col) => (
              <th key={col.index} className="bg-muted border-b border-r px-2 py-1 text-left font-medium min-w-[140px] max-w-[240px]">
                <div className="flex items-center gap-1">
                  <span className="font-mono text-[10px] text-muted-foreground">{col.letter}</span>
                  <span className="truncate" title={col.name}>{col.name || <span className="italic text-muted-foreground">(unnamed)</span>}</span>
                </div>
              </th>
            ))}
          </tr>
          {/* Mapping dropdown row */}
          <tr>
            <th className="sticky left-0 z-30 bg-muted border-b border-r px-2 py-1 w-12" />
            {columns.map((col) => {
              const target = mapping[col.index] ?? col.target;
              return (
                <th key={col.index} className={`border-b border-r px-1 py-1 ${headerTone(target, fieldKeys)}`}>
                  <select
                    value={target}
                    onChange={(e) => onChangeTarget(col.index, e.target.value)}
                    className="w-full bg-transparent text-[11px] outline-none cursor-pointer"
                  >
                    {Object.entries(groups).map(([group, items]) => (
                      <optgroup key={group} label={group}>
                        {items.map((f) => (
                          <option key={f.key} value={f.key}>{f.label}{f.required ? ' *' : ''}</option>
                        ))}
                      </optgroup>
                    ))}
                    <optgroup label="Size column">
                      {SIZE_OPTIONS.map((s) => (
                        <option key={s} value={`size:${s}`}>Size {s}</option>
                      ))}
                      {target.startsWith('size:') && !SIZE_OPTIONS.includes(target.slice(5)) && (
                        <option value={target}>Size {target.slice(5)}</option>
                      )}
                    </optgroup>
                    <optgroup label="Other">
                      <option value={T_METADATA}>Store as note</option>
                      <option value={T_IGNORE}>Ignore</option>
                    </optgroup>
                  </select>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rendered.map((row) => {
            const issues = rowIssues(row);
            const sevByField: Record<string, string> = {};
            for (const i of issues) {
              if (sevByField[i.field] !== 'error') sevByField[i.field] = i.severity;
            }
            return (
              <tr key={row.row_number} className="hover:bg-muted/30">
                <td className="sticky left-0 z-10 bg-background border-b border-r px-2 py-1 text-muted-foreground font-mono">
                  {row.row_number}
                </td>
                {columns.map((col) => {
                  const field = fieldByColumn[col.index];
                  const sev = field ? sevByField[field] : undefined;
                  const tone = sev === 'error' ? 'bg-red-100 dark:bg-red-950/50'
                    : sev === 'warning' ? 'bg-amber-100 dark:bg-amber-950/50'
                    : '';
                  return (
                    <td key={col.index} className={`border-b border-r px-2 py-1 max-w-[240px] truncate ${tone}`} title={row.cells[col.index] ?? ''}>
                      {row.cells[col.index] ?? ''}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
      {rows.length > MAX_RENDER_ROWS && (
        <div className="sticky left-0 px-3 py-2 text-xs text-muted-foreground bg-muted/40 border-t">
          Showing first {MAX_RENDER_ROWS} of {rows.length} rows in this preview — all rows are grouped and imported.
        </div>
      )}
    </div>
  );
}
