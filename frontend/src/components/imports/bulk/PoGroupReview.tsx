'use client';

import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, ChevronRight, AlertTriangle, Store, RefreshCw, Package, Factory } from 'lucide-react';
import type { BulkGroup } from './useBulkImport';
import type { BulkRow } from './types';
import type { FieldValidation } from './validation';
import { resolveImageUrl } from './utils';

interface Props {
  groups: BulkGroup[];
  fieldValue: (row: BulkRow, field: string) => string;
  setFieldValue: (rowNumber: number, field: string, value: string) => void;
  fieldError: (row: BulkRow, field: string) => FieldValidation;
  poFieldError: (group: BulkGroup, field: string) => FieldValidation;
  sizeTokens: string[];
  sizeValue: (row: BulkRow, token: string) => string;
  setSizeValue: (rowNumber: number, token: string, value: string) => void;
  validationByPo: Record<string, number>;
  /** Server-rejected fields keyed by `${rowNumber}:${field}` / `po:${po}:${field}`. */
  serverErrors?: Record<string, string>;
  /** PO numbers to force-expand (e.g. ones the server flagged). */
  forceOpenPos?: string[];
  /** Resolved retailer display name for a sheet retailer value (read-only). */
  resolveRetailerLabel?: (sheetName: string) => string | null;
  /** Show the per-style factory row (only when a factory column is mapped). */
  showFactory?: boolean;
  /** Resolved factory display name for a sheet factory value (read-only). */
  resolveFactoryLabel?: (sheetName: string) => string | null;
}

const fmtUsd = (n: number) => n.toLocaleString(undefined, { style: 'currency', currency: 'USD' });
const isValidDateStr = (v: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(v);

const firstImageUrl = (row: BulkRow): string | null => {
  if (!row.images) return null;
  const keys = Object.keys(row.images);
  return keys.length ? row.images[Number(keys[0])]?.url ?? null : null;
};

const prettyKey = (k: string) => k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const borderFor = (v: FieldValidation) =>
  v.error ? 'border-red-400 focus-visible:ring-red-400'
    : v.warning ? 'border-amber-400 focus-visible:ring-amber-400'
    : '';

function ErrText({ v }: { v: FieldValidation }) {
  if (v.error) return <p className="text-[10px] text-red-600 mt-0.5 leading-tight">{v.error}</p>;
  if (v.warning) return <p className="text-[10px] text-amber-600 mt-0.5 leading-tight">{v.warning}</p>;
  return null;
}

function Field({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="block text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">{label}</label>
      {children}
    </div>
  );
}

export function PoGroupReview({
  groups, fieldValue, setFieldValue, fieldError, poFieldError,
  sizeTokens, sizeValue, setSizeValue, validationByPo, serverErrors, forceOpenPos,
  resolveRetailerLabel, showFactory, resolveFactoryLabel,
}: Props) {
  // Default-open any PO that has validation errors so problems are visible.
  const [open, setOpen] = useState<Set<string>>(() => {
    const s = new Set<string>();
    for (const g of groups) {
      if ((validationByPo[g.po_number] ?? 0) > 0 || g.mixed_retailer) s.add(g.po_number);
    }
    return s;
  });

  // Auto-expand POs the server just flagged (render-time adjust on change).
  const forceKey = (forceOpenPos ?? []).join(',');
  const [seenForce, setSeenForce] = useState('');
  if (forceKey && forceKey !== seenForce) {
    setSeenForce(forceKey);
    setOpen((prev) => new Set([...prev, ...(forceOpenPos ?? [])]));
  }

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

      <div className="space-y-2 max-h-[52vh] overflow-auto pr-1">
        {groups.map((g) => {
          const isOpen = open.has(g.po_number);
          const errCount = validationByPo[g.po_number] ?? 0;
          const srvDate = serverErrors?.[`po:${g.po_number}:po_date`];
          const dateErr: FieldValidation = srvDate ? { error: srvDate } : poFieldError(g, 'po_date');
          const retailerLabel = resolveRetailerLabel ? resolveRetailerLabel(g.retailer_name) : g.retailer_name;
          return (
            <div key={g.po_number} className={`rounded-md border ${errCount > 0 ? 'border-red-300' : ''}`}>
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
                <span className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
                  {errCount > 0 && <Badge variant="destructive">{errCount} to fix</Badge>}
                  <span>{g.styles.length} styles</span>
                  <span>· {g.total_quantity.toLocaleString()} units</span>
                  <span>· {fmtUsd(g.total_value)}</span>
                </span>
              </button>

              {isOpen && (
                <div className="border-t p-3 space-y-3">
                  {/* PO-level editable fields */}
                  <div className="flex flex-wrap items-start gap-3">
                    <Field label="PO Date *">
                      <Input
                        type="date"
                        value={isValidDateStr(g.po_date) ? g.po_date : ''}
                        onChange={(e) => setFieldValue(g.rows[0].row_number, 'po_date', e.target.value)}
                        className={`h-7 w-40 text-xs ${borderFor(dateErr)}`}
                      />
                      {g.po_date && !isValidDateStr(g.po_date) && (
                        <p className="text-[10px] text-amber-600 mt-0.5 max-w-[220px]">From sheet: “{g.po_date}”</p>
                      )}
                      <ErrText v={dateErr} />
                    </Field>
                    <Field label="Retailer (set in the Retailers step)" className="min-w-[220px] flex-1 max-w-md">
                      <div className="h-7 flex items-center text-xs">
                        {retailerLabel
                          ? <span className="font-medium inline-flex items-center gap-1"><Store className="h-3 w-3 text-muted-foreground" />{retailerLabel}</span>
                          : <span className="text-muted-foreground">— blank —</span>}
                      </div>
                      {g.retailer_name && retailerLabel !== g.retailer_name && (
                        <p className="text-[10px] text-muted-foreground truncate" title={g.retailer_name}>from sheet: {g.retailer_name}</p>
                      )}
                    </Field>
                  </div>

                  {/* One editable card per style */}
                  <div className="space-y-2">
                    {g.rows.map((row, i) => (
                      <StyleCard
                        key={row.row_number}
                        row={row}
                        metadata={g.styles[i]?.metadata ?? {}}
                        fieldValue={fieldValue}
                        setFieldValue={setFieldValue}
                        fieldError={fieldError}
                        sizeTokens={sizeTokens}
                        sizeValue={sizeValue}
                        setSizeValue={setSizeValue}
                        serverErrors={serverErrors}
                        showFactory={showFactory}
                        resolveFactoryLabel={resolveFactoryLabel}
                      />
                    ))}
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

function StyleCard({
  row, metadata, fieldValue, setFieldValue, fieldError, sizeTokens, sizeValue, setSizeValue, serverErrors,
  showFactory, resolveFactoryLabel,
}: {
  row: BulkRow;
  metadata: Record<string, string>;
  fieldValue: (row: BulkRow, field: string) => string;
  setFieldValue: (rowNumber: number, field: string, value: string) => void;
  fieldError: (row: BulkRow, field: string) => FieldValidation;
  sizeTokens: string[];
  sizeValue: (row: BulkRow, token: string) => string;
  setSizeValue: (rowNumber: number, token: string, value: string) => void;
  serverErrors?: Record<string, string>;
  showFactory?: boolean;
  resolveFactoryLabel?: (sheetName: string) => string | null;
}) {
  const v = (f: string) => fieldValue(row, f);
  // Server-rejected field wins over (and is shown like) a client error.
  const e = (f: string): FieldValidation => {
    const srv = serverErrors?.[`${row.row_number}:${f}`];
    return srv ? { error: srv } : fieldError(row, f);
  };
  const set = (f: string, val: string) => setFieldValue(row.row_number, f, val);
  const img = firstImageUrl(row);
  const metaEntries = useMemo(() => Object.entries(metadata), [metadata]);

  const hasError = ['style_number', 'quantity', 'unit_price', 'color_name', 'description', 'fabric', 'fit', 'label', 'notes', 'packing', 'pre_pack_inner', 'ihd', 'factory_unit_price', 'factory_date']
    .some((f) => e(f).error)
    || sizeTokens.some((t) => /\D/.test(sizeValue(row, t)));

  const factorySheetName = v('factory_name').trim();
  const factoryLabel = resolveFactoryLabel ? resolveFactoryLabel(factorySheetName) : factorySheetName;

  const cell = (field: string, label: string, opts: { type?: string; wide?: boolean } = {}) => {
    const ve = e(field);
    return (
      <Field label={label} className={opts.wide ? 'min-w-[180px] flex-1' : 'w-32'}>
        <Input
          type={opts.type ?? 'text'}
          value={v(field)}
          onChange={(ev) => set(field, ev.target.value)}
          className={`h-7 text-xs ${borderFor(ve)}`}
        />
        <ErrText v={ve} />
      </Field>
    );
  };

  return (
    <div className={`rounded-md border p-2 ${hasError ? 'border-red-300 bg-red-50/40 dark:bg-red-950/20' : 'bg-muted/10'}`}>
      <div className="flex gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {img ? <img src={resolveImageUrl(img)} alt="" loading="lazy" className="h-16 w-16 object-contain rounded border bg-white shrink-0" />
          : <div className="h-16 w-16 rounded border bg-muted/40 shrink-0 flex items-center justify-center text-[10px] text-muted-foreground">no img</div>}

        <div className="flex-1 min-w-0 space-y-2">
          {/* Primary fields */}
          <div className="flex flex-wrap gap-2">
            <span className="text-[10px] font-mono text-muted-foreground self-end pb-1.5">row {row.row_number}</span>
            {cell('style_number', 'Style # *')}
            {cell('color_name', 'Color')}
            {cell('quantity', 'Qty *', { type: 'text' })}
            {cell('unit_price', 'Unit Price *', { type: 'text' })}
            {cell('ihd', 'IHD', { type: 'date' })}
          </div>
          {/* Secondary fields */}
          <div className="flex flex-wrap gap-2">
            {cell('fabric', 'Fabric', { wide: true })}
            {cell('fit', 'Fit')}
            {cell('label', 'Label')}
            {cell('pre_pack_inner', 'Pre-pack')}
          </div>
          <div className="flex flex-wrap gap-2">
            <Field label="Description" className="min-w-[240px] flex-1">
              <Textarea value={v('description')} onChange={(ev) => set('description', ev.target.value)} className={`min-h-[34px] text-xs ${borderFor(e('description'))}`} rows={1} />
              <ErrText v={e('description')} />
            </Field>
            <Field label="Notes" className="min-w-[240px] flex-1">
              <Textarea value={v('notes')} onChange={(ev) => set('notes', ev.target.value)} className={`min-h-[34px] text-xs ${borderFor(e('notes'))}`} rows={1} />
              <ErrText v={e('notes')} />
            </Field>
          </div>
          <div className="flex flex-wrap gap-2">
            <Field label="Packing" className="min-w-[240px] flex-1">
              <Input value={v('packing')} onChange={(ev) => set('packing', ev.target.value)} className={`h-7 text-xs ${borderFor(e('packing'))}`} />
              <ErrText v={e('packing')} />
            </Field>
          </div>

          {/* Factory assignment (only when a factory column is mapped) */}
          {showFactory && (
            <div className="flex flex-wrap gap-2">
              <Field label="Factory (set in the Factories step)" className="min-w-[200px] flex-1">
                <div className="h-7 flex items-center text-xs">
                  {factoryLabel
                    ? <span className="font-medium inline-flex items-center gap-1"><Factory className="h-3 w-3 text-muted-foreground" />{factoryLabel}</span>
                    : <span className="text-muted-foreground">— blank —</span>}
                </div>
                {factorySheetName && factoryLabel !== factorySheetName && (
                  <p className="text-[10px] text-muted-foreground truncate" title={factorySheetName}>from sheet: {factorySheetName}</p>
                )}
              </Field>
              {cell('factory_unit_price', 'Factory Price', { type: 'text' })}
              {cell('factory_date', 'Factory Date', { type: 'date' })}
            </div>
          )}

          {/* Per-size editable cells */}
          {sizeTokens.length > 0 && (
            <div>
              <label className="block text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">Sizes</label>
              <div className="flex flex-wrap gap-1.5">
                {sizeTokens.map((t) => {
                  const sv = sizeValue(row, t);
                  const bad = /\D/.test(sv);
                  return (
                    <div key={t} className="flex items-center gap-1">
                      <span className="text-[10px] font-medium text-muted-foreground w-8 text-right">{t}</span>
                      <Input
                        value={sv}
                        onChange={(ev) => setSizeValue(row.row_number, t, ev.target.value)}
                        className={`h-7 w-16 text-xs ${bad ? 'border-red-400' : ''}`}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Read-only unmapped columns (stored as notes) */}
          {metaEntries.length > 0 && (
            <details className="text-xs">
              <summary className="cursor-pointer text-[11px] text-muted-foreground hover:text-foreground">
                {metaEntries.length} other column{metaEntries.length > 1 ? 's' : ''} (stored as notes)
              </summary>
              <div className="mt-1 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-0.5 rounded bg-muted/30 p-2">
                {metaEntries.map(([k, val]) => (
                  <div key={k} className="flex gap-2 min-w-0">
                    <span className="text-[10px] text-muted-foreground shrink-0">{prettyKey(k)}:</span>
                    <span className="text-[10px] truncate" title={val}>{val}</span>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}
