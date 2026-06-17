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

/** A distinct RETAILER/STORE NAME value from the sheet + its best existing match. */
export interface RetailerResolution {
  name: string;
  po_count: number;
  style_count: number;
  matched_retailer_id: number | null;
  matched_name: string | null;
}

export interface RetailerOption {
  id: number;
  name: string;
  code?: string | null;
}

/** A distinct FACTORY NAME value from the sheet + its best existing match. */
export interface FactoryResolution {
  name: string;
  po_count: number;
  style_count: number;
  matched_factory_id: number | null;
  matched_name: string | null;
}

export interface FactoryOption {
  id: number;
  name: string;
  company?: string | null;
}

export type FieldType = 'string' | 'text' | 'number' | 'integer' | 'date' | 'enum';
export type FieldLevel = 'po' | 'style';

/** Validation contract for a structured field, mirrored from the backend. */
export interface FieldRule {
  key: string;
  label: string;
  group: string;
  level: FieldLevel;
  type: FieldType;
  required: boolean;
  max_length?: number;
  min?: number;
  max?: number;
  decimals?: number;
  enum?: string[];
  warn_zero?: boolean;
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
  field_rules: FieldRule[];
  required_fields: string[];
  existing_po_numbers: string[];
  image_columns: number[];
  has_images: boolean;
  retailers: RetailerResolution[];
  factories: FactoryResolution[];
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
  // Per-style factory assignment (name resolved to a Factory user id client-side).
  factory_id?: number | null;
  factory_unit_price?: number | null;
  factory_date?: string | null;
}

export interface CommitPoPayload {
  po_number: string;
  po_date?: string | null;
  retailer_name?: string | null;
  retailer_id?: number | null;
  shipping_term?: string | null;
  metadata?: Record<string, string>;
  styles: CommitStylePayload[];
}

export type DuplicateStrategy = 'skip' | 'append' | 'update';

export interface BulkCommitOptions {
  duplicate_strategy: DuplicateStrategy;
  default_shipping_term: 'FOB' | 'DDP';
  buyer_id?: number | null;
  filename?: string | null;
}

export interface BulkCommitReport {
  success: boolean;
  batch_id: string;
  created: Array<{ po_number: string; id: number; styles: number; refreshed?: number }>;
  updated: Array<{ po_number: string; id: number; styles: number; refreshed?: number }>;
  skipped: Array<{ po_number: string; reason: string; id?: number }>;
  errors: Array<{ po_number: string | null; message: string }>;
  summary: {
    pos_created: number;
    pos_updated: number;
    pos_skipped: number;
    pos_failed: number;
    styles_created: number;
    styles_refreshed?: number;
  };
}

export type IssueSeverity = 'error' | 'warning';

export interface RowIssue {
  field: string;
  severity: IssueSeverity;
  message: string;
}
