// Shared types for the bulk multi-PO Excel import flow.

export const T_METADATA = '__metadata__';
export const T_IGNORE = '__ignore__';

export interface BulkColumn {
  index: number;
  letter: string;
  name: string;
  /** Detected target: a field key, "size:<TOKEN>", "__metadata__" or "__ignore__". */
  target: string;
  required: boolean;
  size_token: string | null;
  /** When a single-cardinality field was already claimed, the column it lost to. */
  duplicate_of: number | null;
}

export interface CellImage {
  url: string;
  path: string;
}

export interface BulkRow {
  row_number: number;
  cells: string[];
  /** Embedded images anchored in this row, keyed by column index. */
  images?: Record<number, CellImage>;
}

export interface FieldCatalogItem {
  key: string;
  label: string;
  group: string;
  required: boolean;
}

export interface BulkAnalyzeResponse {
  success: boolean;
  sheet_name: string;
  header_row: number;
  columns: BulkColumn[];
  rows: BulkRow[];
  total_data_rows: number;
  preview_truncated: boolean;
  field_catalog: FieldCatalogItem[];
  required_fields: string[];
  existing_po_numbers: string[];
  image_columns: number[];
  has_images: boolean;
}

export interface CommitStylePayload {
  style_number: string;
  color_name?: string | null;
  description?: string | null;
  fabric?: string | null;
  fit?: string | null;
  label?: string | null;
  notes?: string | null;
  packing?: string | null;
  pre_pack_inner?: string | null;
  ihd?: string | null;
  quantity: number;
  unit_price: number;
  size_breakdown?: Record<string, number> | null;
  metadata?: Record<string, string>;
  images?: string[];
}

export interface CommitPoPayload {
  po_number: string;
  po_date?: string | null;
  retailer_name?: string | null;
  shipping_term?: string | null;
  metadata?: Record<string, string>;
  styles: CommitStylePayload[];
}

export interface BulkCommitOptions {
  duplicate_strategy: 'skip' | 'update';
  default_shipping_term: 'FOB' | 'DDP';
  buyer_id?: number | null;
  filename?: string | null;
}

export interface BulkCommitReport {
  success: boolean;
  batch_id: string;
  created: Array<{ po_number: string; id: number; styles: number }>;
  updated: Array<{ po_number: string; id: number; styles: number }>;
  skipped: Array<{ po_number: string; reason: string; id?: number }>;
  errors: Array<{ po_number: string | null; message: string }>;
  summary: {
    pos_created: number;
    pos_updated: number;
    pos_skipped: number;
    pos_failed: number;
    styles_created: number;
  };
}

export type IssueSeverity = 'error' | 'warning';

export interface RowIssue {
  field: string;
  severity: IssueSeverity;
  message: string;
}
