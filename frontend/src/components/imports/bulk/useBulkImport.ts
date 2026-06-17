import { useMemo, useState } from 'react';
import {
  T_METADATA,
  type BulkAnalyzeResponse,
  type BulkColumn,
  type BulkRow,
  type CommitPoPayload,
  type CommitStylePayload,
  type FieldCatalogItem,
  type FieldRule,
  type RetailerResolution,
  type RowIssue,
} from './types';
import { validateSizeValue, validateValue, type FieldValidation } from './validation';

const SCALAR_FIELDS = [
  'po_number', 'po_date', 'retailer_name', 'style_number', 'color_name',
  'description', 'fabric', 'fit', 'label', 'notes', 'unit_price', 'quantity',
  'pre_pack_inner', 'packing', 'ihd',
];
const SCALAR_SET = new Set<string>(SCALAR_FIELDS);

// Stable empty references so memo dependency arrays don't churn when analysis is null.
const EMPTY_COLUMNS: BulkColumn[] = [];
const EMPTY_ROWS: BulkRow[] = [];
const EMPTY_STRINGS: string[] = [];
const EMPTY_CATALOG: FieldCatalogItem[] = [];
const EMPTY_RULES: FieldRule[] = [];
const EMPTY_RETAILERS: RetailerResolution[] = [];

const cleanNumeric = (raw: string): number =>
  parseFloat(String(raw ?? '').replace(/[^0-9.\-]/g, ''));

const slug = (name: string): string =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

export interface BulkGroup {
  po_number: string;
  po_date: string;
  retailer_name: string;
  mixed_retailer: boolean;
  exists: boolean;
  rows: BulkRow[];
  styles: CommitStylePayload[];
  total_quantity: number;
  total_value: number;
}

export interface UseBulkImport {
  mapping: Record<number, string>;
  setColumnTarget: (columnIndex: number, target: string) => void;
  edits: Record<string, string>;
  setFieldValue: (rowNumber: number, field: string, value: string) => void;
  fieldColumn: Record<string, number | undefined>;
  fieldValue: (row: BulkRow, field: string) => string;
  rowIssues: (row: BulkRow) => RowIssue[];
  groups: BulkGroup[];
  payloadPos: CommitPoPayload[];
  requiredStatus: Array<{ field: string; label: string; mapped: boolean; letter: string | null }>;
  requiredOk: boolean;
  // Field-level validation (mirrors the backend rules)
  rulesByKey: Record<string, FieldRule>;
  poRules: FieldRule[];
  styleRules: FieldRule[];
  sizeTokens: string[];
  sizeValue: (row: BulkRow, token: string) => string;
  setSizeValue: (rowNumber: number, token: string, value: string) => void;
  fieldError: (row: BulkRow, field: string) => FieldValidation;
  poFieldError: (group: BulkGroup, field: string) => FieldValidation;
  validation: { total: number; byPo: Record<string, number> };
  canSubmit: boolean;
  // Retailer resolution
  retailers: RetailerResolution[];
  retailerMap: Record<string, number | null>;
  setRetailerId: (name: string, id: number | null) => void;
  unresolvedRetailers: string[];
  allRetailersResolved: boolean;
  summary: {
    po_count: number;
    style_count: number;
    existing_count: number;
    error_rows: number;
    warning_rows: number;
    excluded_rows: number;
    metadata_columns: number;
  };
}

export function useBulkImport(analysis: BulkAnalyzeResponse | null): UseBulkImport {
  const columns = analysis?.columns ?? EMPTY_COLUMNS;
  const rows = analysis?.rows ?? EMPTY_ROWS;
  const requiredFields = analysis?.required_fields ?? EMPTY_STRINGS;
  const catalog = analysis?.field_catalog ?? EMPTY_CATALOG;
  const rules = analysis?.field_rules ?? EMPTY_RULES;

  // Per-column mapping overrides on top of the server-detected targets, plus
  // per-cell value edits. Both reset when a new file is analysed - performed
  // during render (React's recommended pattern) rather than in an effect.
  const [overrides, setOverrides] = useState<Record<number, string>>({});
  const [edits, setEdits] = useState<Record<string, string>>({});
  // Sheet retailer name -> resolved retailer id (number) or null (left blank).
  // Absent = not yet resolved.
  const [retailerMap, setRetailerMap] = useState<Record<string, number | null>>({});
  const [seenAnalysis, setSeenAnalysis] = useState(analysis);
  if (analysis !== seenAnalysis) {
    setSeenAnalysis(analysis);
    setOverrides({});
    setEdits({});
    const seed: Record<string, number | null> = {};
    for (const r of analysis?.retailers ?? []) {
      if (r.matched_retailer_id != null) seed[r.name] = r.matched_retailer_id;
    }
    setRetailerMap(seed);
  }

  const setRetailerId = (name: string, id: number | null) =>
    setRetailerMap((prev) => ({ ...prev, [name]: id }));

  const mapping = useMemo(() => {
    const out: Record<number, string> = {};
    for (const col of columns) out[col.index] = overrides[col.index] ?? col.target;
    return out;
  }, [columns, overrides]);

  const setColumnTarget = (columnIndex: number, target: string) =>
    setOverrides((prev) => ({ ...prev, [columnIndex]: target }));

  const setFieldValue = (rowNumber: number, field: string, value: string) =>
    setEdits((prev) => ({ ...prev, [`${rowNumber}:${field}`]: value }));

  const setSizeValue = (rowNumber: number, token: string, value: string) =>
    setEdits((prev) => ({ ...prev, [`${rowNumber}:size:${token}`]: value }));

  // target -> first column mapped to it (single-cardinality fields)
  const fieldColumn = useMemo(() => {
    const out: Record<string, number | undefined> = {};
    for (const col of columns) {
      const t = mapping[col.index];
      if (SCALAR_SET.has(t) && out[t] === undefined) {
        out[t] = col.index;
      }
    }
    return out;
  }, [columns, mapping]);

  const sizeColumns = useMemo(() => {
    const out: Array<{ index: number; token: string }> = [];
    for (const col of columns) {
      const t = mapping[col.index];
      if (t.startsWith('size:')) out.push({ index: col.index, token: t.slice(5) });
    }
    return out;
  }, [columns, mapping]);

  const metadataColumns = useMemo(
    () => columns.filter((c) => mapping[c.index] === T_METADATA).map((c) => c.index),
    [columns, mapping],
  );

  // Distinct size tokens in column order (one editable cell per token).
  const sizeTokens = useMemo(() => {
    const seen: string[] = [];
    for (const { token } of sizeColumns) if (!seen.includes(token)) seen.push(token);
    return seen;
  }, [sizeColumns]);

  // Per-size value: an explicit edit wins, otherwise the sum of the raw columns
  // feeding that token (a sheet can carry two size scales for the same letter).
  const sizeValue = useMemo(() => {
    return (row: BulkRow, token: string): string => {
      const key = `${row.row_number}:size:${token}`;
      if (key in edits) return edits[key];
      let sum = 0;
      for (const { index, token: t } of sizeColumns) {
        if (t !== token) continue;
        const v = cleanNumeric(row.cells[index] ?? '');
        if (!isNaN(v) && v > 0) sum += Math.round(v);
      }
      return sum > 0 ? String(sum) : '';
    };
  }, [edits, sizeColumns]);

  const existingPoSet = useMemo(
    () => new Set((analysis?.existing_po_numbers ?? EMPTY_STRINGS).map((p) => String(p))),
    [analysis],
  );

  const fieldValue = useMemo(() => {
    return (row: BulkRow, field: string): string => {
      const key = `${row.row_number}:${field}`;
      if (key in edits) return edits[key];
      const col = fieldColumn[field];
      if (col === undefined) return '';
      return row.cells[col] ?? '';
    };
  }, [edits, fieldColumn]);

  const rowIssues = useMemo(() => {
    return (row: BulkRow): RowIssue[] => {
      const issues: RowIssue[] = [];
      const po = fieldValue(row, 'po_number').trim();
      const sn = fieldValue(row, 'style_number').trim();
      if (!po) issues.push({ field: 'po_number', severity: 'error', message: 'Missing PO number — row will be skipped' });
      if (!sn) {
        issues.push({ field: 'style_number', severity: 'error', message: 'Missing style number — row will be skipped' });
      } else if (/\s/.test(sn) || !/\d/.test(sn)) {
        issues.push({ field: 'style_number', severity: 'warning', message: 'Unusual style code (spaces or no digits) — check before import' });
      }
      if (fieldColumn['unit_price'] !== undefined) {
        const raw = fieldValue(row, 'unit_price');
        if (raw.trim() === '' || isNaN(cleanNumeric(raw))) {
          issues.push({ field: 'unit_price', severity: 'warning', message: `Price "${raw}" isn't a number — will import as 0` });
        }
      }
      if (fieldColumn['quantity'] !== undefined) {
        const raw = fieldValue(row, 'quantity');
        const q = cleanNumeric(raw);
        if (raw.trim() === '' || isNaN(q) || q <= 0) {
          issues.push({ field: 'quantity', severity: 'warning', message: `Quantity "${raw}" is missing or zero` });
        }
      }
      return issues;
    };
  }, [fieldValue, fieldColumn]);

  const buildStyle = useMemo(() => {
    return (row: BulkRow): CommitStylePayload => {
      const sb: Record<string, number> = {};
      for (const token of sizeTokens) {
        const v = cleanNumeric(sizeValue(row, token));
        if (!isNaN(v) && v > 0) sb[token] = Math.round(v);
      }
      const meta: Record<string, string> = {};
      for (const ci of metadataColumns) {
        const val = row.cells[ci];
        if (val && val.trim() !== '') {
          const col = columns.find((c) => c.index === ci);
          const key = (col ? slug(col.name) : '') || `col_${ci}`;
          meta[key] = val;
        }
      }
      // Any image anchored anywhere in the row belongs to this style (CAD etc.),
      // regardless of how that column is mapped. Carry the storage path through.
      const images: string[] = [];
      if (row.images) {
        for (const key of Object.keys(row.images)) {
          const p = row.images[Number(key)]?.path;
          if (p) images.push(p);
        }
      }
      const q = cleanNumeric(fieldValue(row, 'quantity'));
      const p = cleanNumeric(fieldValue(row, 'unit_price'));
      const orNull = (f: string) => {
        const v = fieldValue(row, f).trim();
        return v === '' ? null : v;
      };
      return {
        images: images.length ? images : undefined,
        style_number: fieldValue(row, 'style_number').trim(),
        color_name: orNull('color_name'),
        description: orNull('description'),
        fabric: orNull('fabric'),
        fit: orNull('fit'),
        label: orNull('label'),
        notes: orNull('notes'),
        packing: orNull('packing'),
        pre_pack_inner: orNull('pre_pack_inner'),
        ihd: orNull('ihd'),
        quantity: isNaN(q) ? 0 : Math.round(q),
        unit_price: isNaN(p) ? 0 : p,
        size_breakdown: Object.keys(sb).length ? sb : null,
        metadata: meta,
      };
    };
  }, [sizeTokens, sizeValue, metadataColumns, columns, fieldValue]);

  const groups = useMemo<BulkGroup[]>(() => {
    const map = new Map<string, BulkGroup & { retailers: Set<string> }>();
    for (const row of rows) {
      const po = fieldValue(row, 'po_number').trim();
      const sn = fieldValue(row, 'style_number').trim();
      if (!po || !sn) continue; // excluded — surfaced as an error elsewhere
      let g = map.get(po);
      if (!g) {
        g = {
          po_number: po,
          po_date: fieldValue(row, 'po_date').trim(),
          retailer_name: '',
          mixed_retailer: false,
          exists: existingPoSet.has(po),
          rows: [],
          styles: [],
          total_quantity: 0,
          total_value: 0,
          retailers: new Set<string>(),
        };
        map.set(po, g);
      }
      g.rows.push(row);
      const style = buildStyle(row);
      g.styles.push(style);
      g.total_quantity += style.quantity;
      g.total_value += style.quantity * style.unit_price;
      const ret = fieldValue(row, 'retailer_name').trim();
      if (ret) g.retailers.add(ret);
    }
    return Array.from(map.values()).map(({ retailers, ...g }) => ({
      ...g,
      retailer_name: retailers.values().next().value ?? '',
      mixed_retailer: retailers.size > 1,
    }));
  }, [rows, fieldValue, buildStyle, existingPoSet]);

  const payloadPos = useMemo<CommitPoPayload[]>(
    () =>
      groups.map((g) => ({
        po_number: g.po_number,
        po_date: g.po_date || null,
        // Retailer is resolved to an id; the raw name isn't sent (avoids validating
        // long free-text cells). The backend derives the buyer from the retailer.
        retailer_id: g.retailer_name ? (retailerMap[g.retailer_name] ?? null) : null,
        styles: g.styles,
      })),
    [groups, retailerMap],
  );

  // Retailer resolution status (drives the "Retailers" step gate).
  const retailers = analysis?.retailers ?? EMPTY_RETAILERS;
  const unresolvedRetailers = useMemo(
    () => retailers.filter((r) => retailerMap[r.name] === undefined).map((r) => r.name),
    [retailers, retailerMap],
  );
  const allRetailersResolved = unresolvedRetailers.length === 0;

  const requiredStatus = useMemo(() => {
    return requiredFields.map((field) => {
      const item = catalog.find((c) => c.key === field);
      const col = fieldColumn[field];
      const letter = col !== undefined ? columns.find((c) => c.index === col)?.letter ?? null : null;
      return { field, label: item?.label ?? field, mapped: col !== undefined, letter };
    });
  }, [requiredFields, catalog, fieldColumn, columns]);

  const requiredOk = requiredStatus.every((r) => r.mapped);

  // --- Field-level validation (mirrors the backend's strict rules) ---
  const rulesByKey = useMemo(() => {
    const out: Record<string, FieldRule> = {};
    for (const r of rules) out[r.key] = r;
    return out;
  }, [rules]);

  const poRules = useMemo(() => rules.filter((r) => r.level === 'po'), [rules]);
  const styleRules = useMemo(() => rules.filter((r) => r.level === 'style'), [rules]);

  const fieldError = useMemo(() => {
    return (row: BulkRow, field: string): FieldValidation => {
      const rule = rulesByKey[field];
      return rule ? validateValue(rule, fieldValue(row, field)) : {};
    };
  }, [rulesByKey, fieldValue]);

  const poFieldValue = useMemo(() => {
    return (group: BulkGroup, field: string): string => {
      if (field === 'po_number') return group.po_number;
      return group.rows.length ? fieldValue(group.rows[0], field) : '';
    };
  }, [fieldValue]);

  const poFieldError = useMemo(() => {
    return (group: BulkGroup, field: string): FieldValidation => {
      const rule = rulesByKey[field];
      return rule ? validateValue(rule, poFieldValue(group, field)) : {};
    };
  }, [rulesByKey, poFieldValue]);

  const validation = useMemo(() => {
    const byPo: Record<string, number> = {};
    let total = 0;
    for (const g of groups) {
      let count = 0;
      for (const r of poRules) {
        if (validateValue(r, poFieldValue(g, r.key)).error) count++;
      }
      for (const row of g.rows) {
        for (const r of styleRules) {
          if (validateValue(r, fieldValue(row, r.key)).error) count++;
        }
        for (const token of sizeTokens) {
          if (validateSizeValue(sizeValue(row, token)).error) count++;
        }
      }
      byPo[g.po_number] = count;
      total += count;
    }
    return { total, byPo };
  }, [groups, poRules, styleRules, sizeTokens, fieldValue, sizeValue, poFieldValue]);

  const canSubmit = requiredOk && validation.total === 0 && allRetailersResolved;

  const summary = useMemo(() => {
    let errorRows = 0;
    let warningRows = 0;
    for (const row of rows) {
      const issues = rowIssues(row);
      if (issues.some((i) => i.severity === 'error')) errorRows++;
      else if (issues.some((i) => i.severity === 'warning')) warningRows++;
    }
    return {
      po_count: groups.length,
      style_count: groups.reduce((n, g) => n + g.styles.length, 0),
      existing_count: groups.filter((g) => g.exists).length,
      error_rows: errorRows,
      warning_rows: warningRows,
      excluded_rows: errorRows,
      metadata_columns: metadataColumns.length,
    };
  }, [rows, rowIssues, groups, metadataColumns]);

  return {
    mapping,
    setColumnTarget,
    edits,
    setFieldValue,
    fieldColumn,
    fieldValue,
    rowIssues,
    groups,
    payloadPos,
    requiredStatus,
    requiredOk,
    rulesByKey,
    poRules,
    styleRules,
    sizeTokens,
    sizeValue,
    setSizeValue,
    fieldError,
    poFieldError,
    validation,
    canSubmit,
    retailers,
    retailerMap,
    setRetailerId,
    unresolvedRetailers,
    allRetailersResolved,
    summary,
  };
}
