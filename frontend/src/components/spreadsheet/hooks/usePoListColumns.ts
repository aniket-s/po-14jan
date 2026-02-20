import { SpreadsheetColumnDef } from '@/types/spreadsheet';

/**
 * Column definitions for the PO list spreadsheet.
 * Each row = one purchase order.
 */
export const PO_LIST_COLUMNS: SpreadsheetColumnDef[] = [
  { key: 'po_number',       title: 'PO Number',       width: 140, editable: false, target: 'style', kind: 'text',     defaultVisible: true,  align: 'left' },
  { key: 'headline',        title: 'Headline',         width: 200, editable: false, target: 'style', kind: 'text',     defaultVisible: true,  align: 'left' },
  { key: 'status',          title: 'Status',           width: 110, editable: false, target: 'style', kind: 'badge',    defaultVisible: true,  align: 'left' },
  { key: 'po_date',         title: 'PO Date',          width: 110, editable: false, target: 'style', kind: 'date',     defaultVisible: true,  align: 'left' },
  { key: 'retailer_name',   title: 'Retailer',         width: 120, editable: false, target: 'style', kind: 'text',     defaultVisible: true,  align: 'left' },
  { key: 'season_name',     title: 'Season',           width: 110, editable: false, target: 'style', kind: 'text',     defaultVisible: true,  align: 'left' },
  { key: 'country_name',    title: 'Country',          width: 110, editable: false, target: 'style', kind: 'text',     defaultVisible: false, align: 'left' },
  { key: 'shipping_term',   title: 'Ship Term',        width: 90,  editable: false, target: 'style', kind: 'text',     defaultVisible: true,  align: 'center' },
  { key: 'currency_code',   title: 'Currency',         width: 80,  editable: false, target: 'style', kind: 'text',     defaultVisible: true,  align: 'center' },
  { key: 'total_quantity',  title: 'Total Qty',        width: 100, editable: false, target: 'style', kind: 'number',   defaultVisible: true,  align: 'right' },
  { key: 'total_value',     title: 'Total Value',      width: 120, editable: false, target: 'style', kind: 'currency', defaultVisible: true,  align: 'right' },
  { key: 'styles_count',    title: 'Styles',           width: 70,  editable: false, target: 'style', kind: 'number',   defaultVisible: true,  align: 'right' },
  { key: 'etd_date',        title: 'ETD',              width: 110, editable: false, target: 'style', kind: 'date',     defaultVisible: true,  align: 'left' },
  { key: 'eta_date',        title: 'ETA',              width: 110, editable: false, target: 'style', kind: 'date',     defaultVisible: false, align: 'left' },
  { key: 'ex_factory_date', title: 'Ex-Factory',       width: 110, editable: false, target: 'style', kind: 'date',     defaultVisible: true,  align: 'left' },
  { key: 'in_warehouse_date', title: 'In-Warehouse',   width: 120, editable: false, target: 'style', kind: 'date',     defaultVisible: false, align: 'left' },
  { key: 'revision_date',   title: 'Revision Date',    width: 120, editable: false, target: 'style', kind: 'date',     defaultVisible: false, align: 'left' },
  { key: 'payment_terms',   title: 'Payment Terms',    width: 130, editable: false, target: 'style', kind: 'text',     defaultVisible: false, align: 'left' },
  { key: 'importer_name',   title: 'Importer',         width: 130, editable: false, target: 'style', kind: 'text',     defaultVisible: true,  align: 'left' },
  { key: 'agency_name',     title: 'Agency',           width: 130, editable: false, target: 'style', kind: 'text',     defaultVisible: false, align: 'left' },
  { key: 'warehouse_name',  title: 'Warehouse',        width: 120, editable: false, target: 'style', kind: 'text',     defaultVisible: false, align: 'left' },
  { key: 'ship_to',         title: 'Ship To',          width: 120, editable: false, target: 'style', kind: 'text',     defaultVisible: false, align: 'left' },
  { key: 'created_at',      title: 'Created',          width: 110, editable: false, target: 'style', kind: 'date',     defaultVisible: false, align: 'left' },
];
