/** Row data for the spreadsheet grid — one row per style in a PO */
export interface SpreadsheetRow {
  /** Internal: style ID */
  _styleId: number;
  /** Internal: purchase_order_style pivot ID */
  _pivotId: number;

  // --- Style fields ---
  style_number: string;
  description: string | null;
  color_name: string | null;
  color_code: string | null;
  fabric: string | null;
  fabric_type_name: string | null;
  fit: string | null;
  country_of_origin: string | null;
  item_description: string | null;
  images: string[];
  fob_price: number | null;
  msrp: number | null;
  wholesale_price: number | null;
  unit_price: number;
  total_price_style: number;
  category_name: string | null;
  season_name: string | null;
  brand_name: string | null;

  // --- Pivot fields (PO-specific) ---
  quantity_in_po: number;
  unit_price_in_po: number | null;
  total_price: number;
  size_breakdown: Record<string, number> | null;
  ratio: Record<string, number> | null;
  status: string;
  production_status: string | null;
  shipping_approval_status: string | null;
  assigned_factory_id: number | null;
  assigned_factory_name: string | null;
  assigned_agency_id: number | null;
  assignment_type: string | null;
  ex_factory_date: string | null;
  estimated_ex_factory_date: string | null;
  target_production_date: string | null;
  target_shipment_date: string | null;
  notes: string | null;
}

/** Metadata about the PO itself (shown in header / context) */
export interface SpreadsheetPOMeta {
  id: number;
  po_number: string;
  headline: string | null;
  status: string;
  po_date: string;
  etd_date: string | null;
  eta_date: string | null;
  ex_factory_date: string | null;
  in_warehouse_date: string | null;
  shipping_term: string | null;
  total_quantity: number;
  total_value: number;
  currency_code: string;
  currency_symbol: string;
  retailer_name: string | null;
  season_name: string | null;
  country_name: string | null;
  importer_name: string;
  agency_name: string | null;
  creator_id: number;
}

/** Full response from GET /purchase-orders/{id}/spreadsheet-data */
export interface SpreadsheetDataResponse {
  po: SpreadsheetPOMeta;
  rows: SpreadsheetRow[];
  /** Lookup tables for dropdown editors */
  lookups: {
    factories: { id: number; name: string }[];
    agencies: { id: number; name: string }[];
    statuses: string[];
    production_statuses: string[];
  };
}

/** Payload for PATCH cell update */
export interface CellUpdatePayload {
  field: string;
  value: string | number | boolean | null;
  /** 'style' or 'pivot' to route the update to the correct model */
  target: 'style' | 'pivot';
}

/** WebSocket event for real-time cell updates */
export interface StyleCellUpdatedEvent {
  style_id: number;
  field: string;
  value: string | number | boolean | null;
  target: 'style' | 'pivot';
  old_value: string | number | boolean | null;
  updated_by: { id: number; name: string };
  updated_at: string;
}

/** Undo/redo entry */
export interface EditHistoryEntry {
  styleId: number;
  field: string;
  target: 'style' | 'pivot';
  oldValue: any;
  newValue: any;
  timestamp: number;
}

// ========== PO List Spreadsheet Types ==========

/** Row data for the PO list spreadsheet — one row per purchase order */
export interface PoListRow {
  _poId: number;
  po_number: string;
  headline: string | null;
  status: string;
  po_date: string | null;
  revision_date: string | null;
  shipping_term: string | null;
  etd_date: string | null;
  eta_date: string | null;
  ex_factory_date: string | null;
  in_warehouse_date: string | null;
  total_quantity: number;
  total_value: number;
  styles_count: number;
  payment_terms: string | null;
  ship_to: string | null;
  importer_name: string | null;
  agency_name: string | null;
  retailer_name: string | null;
  season_name: string | null;
  country_name: string | null;
  warehouse_name: string | null;
  currency_code: string | null;
  currency_symbol: string | null;
  created_at: string | null;
}

/** Toolbar active tab */
export type ToolbarTab = 'home' | 'insert' | 'data' | 'view';

/** Column definition for the spreadsheet */
export interface SpreadsheetColumnDef {
  /** Unique key matching SpreadsheetRow field */
  key: string;
  /** Display header */
  title: string;
  /** Column width in px */
  width: number;
  /** Whether the column is editable */
  editable: boolean;
  /** Which model to update: style or pivot */
  target: 'style' | 'pivot';
  /** Cell kind for rendering */
  kind: 'text' | 'number' | 'currency' | 'date' | 'image' | 'dropdown' | 'badge' | 'json';
  /** Dropdown options (for kind=dropdown) */
  options?: string[];
  /** Whether column is visible by default */
  defaultVisible?: boolean;
  /** Text alignment */
  align?: 'left' | 'center' | 'right';
}

/** Selection state */
export interface SpreadsheetSelection {
  row: number;
  col: number;
  /** Cell address like "C4" */
  address: string;
  /** Current cell value */
  value: any;
  /** Column definition */
  columnDef: SpreadsheetColumnDef | null;
}

/** Save status for a cell */
export type CellSaveStatus = 'idle' | 'saving' | 'saved' | 'error';
