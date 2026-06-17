'use client';

import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronRight, AlertTriangle, Store, RefreshCw, Package } from 'lucide-react';
import type { BulkGroup } from './useBulkImport';
import type { BulkRow, RowIssue } from './types';
import { resolveImageUrl } from './utils';

const firstImageUrl = (row: BulkRow): string | null => {
  if (!row.images) return null;
  const keys = Object.keys(row.images);
  if (!keys.length) return null;
  return row.images[Number(keys[0])]?.url ?? null;
};

const isValidDateStr = (v: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(v);

interface Props {
  groups: BulkGroup[];
  fieldValue: (row: BulkRow, field: string) => string;
  setFieldValue: (rowNumber: number, field: string, value: string) => void;
  rowIssues: (row: BulkRow) => RowIssue[];
}

const fmtUsd = (n: number) => n.toLocaleString(undefined, { style: 'currency', currency: 'USD' });

export function PoGroupReview({ groups, fieldValue, setFieldValue, rowIssues }: Props) {
  const groupIssueCounts = useMemo(() => {
    const map: Record<string, { errors: number; warnings: number }> = {};
    for (const g of groups) {
      let errors = 0;
      let warnings = 0;
      for (const row of g.rows) {
        const issues = rowIssues(row);
        if (issues.some((i) => i.severity === 'error')) errors++;
        else if (issues.some((i) => i.severity === 'warning')) warnings++;
      }
      map[g.po_number] = { errors, warnings };
    }
    return map;
  }, [groups, rowIssues]);

  // Default-open any PO that needs attention.
  const [open, setOpen] = useState<Set<string>>(() => {
    const s = new Set<string>();
    for (const g of groups) {
      const c = groupIssueCounts[g.po_number];
      if (g.mixed_retailer || (c && (c.errors || c.warnings))) s.add(g.po_number);
    }
    return s;
  });

  const toggle = (po: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(po)) next.delete(po);
      else next.add(po);
      return next;
    });
  const expandAll = () => setOpen(new Set(groups.map((g) => g.po_number)));
  const collapseAll = () => setOpen(new Set());

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{groups.length} purchase orders detected</span>
        <div className="flex gap-2 text-xs">
          <button type="button" className="underline text-muted-foreground hover:text-foreground" onClick={expandAll}>Expand all</button>
          <button type="button" className="underline text-muted-foreground hover:text-foreground" onClick={collapseAll}>Collapse all</button>
        </div>
      </div>

      <div className="space-y-2 max-h-[48vh] overflow-auto pr-1">
        {groups.map((g) => {
          const isOpen = open.has(g.po_number);
          const counts = groupIssueCounts[g.po_number] ?? { errors: 0, warnings: 0 };
          return (
            <div key={g.po_number} className="rounded-md border">
              <button
                type="button"
                onClick={() => toggle(g.po_number)}
                className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted/40"
              >
                {isOpen ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                <Package className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="font-medium">PO {g.po_number}</span>
                {g.exists && (
                  <Badge variant="outline" className="border-blue-300 text-blue-700 dark:text-blue-300">
                    <RefreshCw className="h-3 w-3 mr-1" />Already in system
                  </Badge>
                )}
                {g.retailer_name && (
                  <span className="hidden sm:inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Store className="h-3 w-3" />{g.retailer_name}
                  </span>
                )}
                {g.mixed_retailer && (
                  <Badge variant="outline" className="border-amber-300 text-amber-700 dark:text-amber-400">
                    <AlertTriangle className="h-3 w-3 mr-1" />Mixed retailer
                  </Badge>
                )}
                {g.po_date && !isValidDateStr(g.po_date) && (
                  <Badge variant="outline" className="border-amber-300 text-amber-700 dark:text-amber-400">
                    <AlertTriangle className="h-3 w-3 mr-1" />Check date
                  </Badge>
                )}
                <span className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
                  {counts.errors > 0 && <Badge variant="destructive">{counts.errors} error{counts.errors > 1 ? 's' : ''}</Badge>}
                  {counts.warnings > 0 && (
                    <Badge variant="outline" className="border-amber-300 text-amber-700 dark:text-amber-400">{counts.warnings} warning{counts.warnings > 1 ? 's' : ''}</Badge>
                  )}
                  <span>{g.styles.length} styles</span>
                  <span>· {g.total_quantity.toLocaleString()} units</span>
                  <span>· {fmtUsd(g.total_value)}</span>
                </span>
              </button>

              {isOpen && (
                <div className="border-t">
                  {/* Editable PO-level fields (flow into the first row of the group). */}
                  <div className="flex flex-wrap items-end gap-3 px-3 py-2 bg-muted/20">
                    <div>
                      <label className="block text-[11px] text-muted-foreground mb-0.5">PO Date</label>
                      <input
                        type="date"
                        value={isValidDateStr(g.po_date) ? g.po_date : ''}
                        onChange={(e) => setFieldValue(g.rows[0].row_number, 'po_date', e.target.value)}
                        className="h-7 rounded-md border bg-background px-2 text-xs"
                      />
                      {g.po_date && !isValidDateStr(g.po_date) && (
                        <div className="text-[10px] text-amber-600 mt-0.5 max-w-[220px]">
                          From sheet: “{g.po_date}”. Pick a date (today is used if left blank).
                        </div>
                      )}
                    </div>
                    <div className="min-w-[200px] flex-1 max-w-md">
                      <label className="block text-[11px] text-muted-foreground mb-0.5">Retailer</label>
                      <Input
                        value={g.retailer_name}
                        onChange={(e) => setFieldValue(g.rows[0].row_number, 'retailer_name', e.target.value)}
                        className="h-7 text-xs"
                      />
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-muted/40 text-left">
                        <th className="px-2 py-1 w-8" />
                        <th className="px-2 py-1 w-14">Img</th>
                        <th className="px-2 py-1 min-w-[140px]">Style #</th>
                        <th className="px-2 py-1 min-w-[110px]">Color</th>
                        <th className="px-2 py-1 min-w-[180px]">Description</th>
                        <th className="px-2 py-1 w-24">Qty</th>
                        <th className="px-2 py-1 w-24">Unit Price</th>
                        <th className="px-2 py-1 min-w-[120px]">Sizes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {g.rows.map((row, i) => {
                        const issues = rowIssues(row);
                        const issueFor = (field: string) => issues.find((x) => x.field === field);
                        const style = g.styles[i];
                        const sizeStr = style.size_breakdown
                          ? Object.entries(style.size_breakdown).map(([k, v]) => `${k}:${v}`).join('  ')
                          : '—';
                        const rowTone = issues.some((x) => x.severity === 'error')
                          ? 'bg-red-50 dark:bg-red-950/30'
                          : issues.some((x) => x.severity === 'warning')
                          ? 'bg-amber-50 dark:bg-amber-950/30'
                          : '';
                        return (
                          <tr key={row.row_number} className={`border-t align-top ${rowTone}`}>
                            <td className="px-2 py-1 text-muted-foreground font-mono">{row.row_number}</td>
                            <td className="px-2 py-1">
                              {firstImageUrl(row) ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={resolveImageUrl(firstImageUrl(row)!)} alt="" loading="lazy" className="h-10 w-10 object-contain rounded border bg-white" />
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                            <td className="px-2 py-1">
                              <EditCell value={fieldValue(row, 'style_number')} onChange={(v) => setFieldValue(row.row_number, 'style_number', v)} issue={issueFor('style_number')} />
                            </td>
                            <td className="px-2 py-1">
                              <EditCell value={fieldValue(row, 'color_name')} onChange={(v) => setFieldValue(row.row_number, 'color_name', v)} />
                            </td>
                            <td className="px-2 py-1">
                              <EditCell value={fieldValue(row, 'description')} onChange={(v) => setFieldValue(row.row_number, 'description', v)} />
                            </td>
                            <td className="px-2 py-1">
                              <EditCell value={fieldValue(row, 'quantity')} onChange={(v) => setFieldValue(row.row_number, 'quantity', v)} issue={issueFor('quantity')} />
                            </td>
                            <td className="px-2 py-1">
                              <EditCell value={fieldValue(row, 'unit_price')} onChange={(v) => setFieldValue(row.row_number, 'unit_price', v)} issue={issueFor('unit_price')} />
                            </td>
                            <td className="px-2 py-1 font-mono text-[11px] text-muted-foreground whitespace-nowrap">{sizeStr}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EditCell({ value, onChange, issue }: { value: string; onChange: (v: string) => void; issue?: RowIssue }) {
  return (
    <div>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`h-7 text-xs ${issue ? (issue.severity === 'error' ? 'border-red-400' : 'border-amber-400') : ''}`}
      />
      {issue && (
        <div className={`mt-0.5 text-[10px] ${issue.severity === 'error' ? 'text-red-600' : 'text-amber-600'}`} title={issue.message}>
          {issue.message}
        </div>
      )}
    </div>
  );
}
