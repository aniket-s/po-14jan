import { SpreadsheetColumnDef } from '@/types/spreadsheet';

/**
 * All column definitions for the PO spreadsheet.
 * Order here = default column order in the grid.
 */
export const SPREADSHEET_COLUMNS: SpreadsheetColumnDef[] = [
  // --- Core style identification ---
  { key: 'style_number',      title: 'Style #',          width: 120, editable: true,  target: 'style', kind: 'text',     defaultVisible: true,  align: 'left' },
  { key: 'description',       title: 'Description',      width: 200, editable: true,  target: 'style', kind: 'text',     defaultVisible: true,  align: 'left' },
  { key: 'color_name',        title: 'Color',            width: 100, editable: true,  target: 'style', kind: 'text',     defaultVisible: true,  align: 'left' },
  { key: 'color_code',        title: 'Color Code',       width: 90,  editable: true,  target: 'style', kind: 'text',     defaultVisible: true,  align: 'left' },
  { key: 'images',            title: 'CAD',              width: 70,  editable: false, target: 'style', kind: 'image',    defaultVisible: true,  align: 'center' },
  { key: 'fabric',            title: 'Fabric',           width: 120, editable: true,  target: 'style', kind: 'text',     defaultVisible: true,  align: 'left' },
  { key: 'fabric_type_name',  title: 'Fabric Type',      width: 110, editable: true,  target: 'style', kind: 'text',     defaultVisible: false, align: 'left' },
  { key: 'fit',               title: 'Fit',              width: 80,  editable: true,  target: 'style', kind: 'text',     defaultVisible: true,  align: 'left' },

  // --- PO-specific quantity / pricing (pivot) ---
  { key: 'quantity_in_po',    title: 'Qty',              width: 80,  editable: true,  target: 'pivot', kind: 'number',   defaultVisible: true,  align: 'right' },
  { key: 'unit_price_in_po',  title: 'Unit Price',       width: 100, editable: true,  target: 'pivot', kind: 'currency', defaultVisible: true,  align: 'right' },
  { key: 'total_price',       title: 'Total',            width: 110, editable: false, target: 'pivot', kind: 'currency', defaultVisible: true,  align: 'right' },
  { key: 'fob_price',         title: 'FOB Price',        width: 90,  editable: true,  target: 'style', kind: 'currency', defaultVisible: false, align: 'right' },
  { key: 'msrp',              title: 'MSRP',             width: 90,  editable: true,  target: 'style', kind: 'currency', defaultVisible: false, align: 'right' },
  { key: 'wholesale_price',   title: 'Wholesale',        width: 90,  editable: true,  target: 'style', kind: 'currency', defaultVisible: false, align: 'right' },

  // --- Status & assignment (pivot) ---
  { key: 'status',            title: 'Status',           width: 110, editable: true,  target: 'pivot', kind: 'dropdown', defaultVisible: true,  align: 'left',
    options: ['pending', 'confirmed', 'in_production', 'completed', 'cancelled'] },
  { key: 'production_status', title: 'Prod. Status',     width: 110, editable: true,  target: 'pivot', kind: 'dropdown', defaultVisible: false, align: 'left',
    options: ['pending', 'cutting', 'sewing', 'finishing', 'packing', 'ready_to_ship', 'shipped'] },
  { key: 'assigned_factory_name', title: 'Factory',      width: 120, editable: false, target: 'pivot', kind: 'text',     defaultVisible: true,  align: 'left' },
  { key: 'assignment_type',   title: 'Assignment',       width: 110, editable: true,  target: 'pivot', kind: 'dropdown', defaultVisible: false, align: 'left',
    options: ['direct_to_factory', 'via_agency'] },

  // --- Dates (pivot) ---
  { key: 'ex_factory_date',          title: 'Ex-Factory',       width: 110, editable: true, target: 'pivot', kind: 'date', defaultVisible: true,  align: 'left' },
  { key: 'estimated_ex_factory_date', title: 'Est. Ex-Factory', width: 120, editable: true, target: 'pivot', kind: 'date', defaultVisible: false, align: 'left' },
  { key: 'target_production_date',   title: 'Target Prod.',     width: 110, editable: true, target: 'pivot', kind: 'date', defaultVisible: false, align: 'left' },
  { key: 'target_shipment_date',     title: 'Target Ship',      width: 110, editable: true, target: 'pivot', kind: 'date', defaultVisible: false, align: 'left' },

  // --- Extra (pivot / style) ---
  { key: 'notes',              title: 'Notes',            width: 200, editable: true,  target: 'pivot', kind: 'text',   defaultVisible: true,  align: 'left' },
  { key: 'country_of_origin',  title: 'Country',          width: 100, editable: true,  target: 'style', kind: 'text',   defaultVisible: false, align: 'left' },
  { key: 'item_description',   title: 'Item Desc.',       width: 150, editable: true,  target: 'style', kind: 'text',   defaultVisible: false, align: 'left' },
  { key: 'category_name',      title: 'Category',         width: 100, editable: false, target: 'style', kind: 'text',   defaultVisible: false, align: 'left' },
  { key: 'season_name',        title: 'Season',           width: 100, editable: false, target: 'style', kind: 'text',   defaultVisible: false, align: 'left' },
  { key: 'brand_name',         title: 'Brand',            width: 100, editable: false, target: 'style', kind: 'text',   defaultVisible: false, align: 'left' },
  { key: 'shipping_approval_status', title: 'Ship. Approval', width: 110, editable: false, target: 'pivot', kind: 'badge', defaultVisible: false, align: 'left' },
];

/** Convert 0-based column index to Excel-style letter (0→A, 25→Z, 26→AA) */
export function colIndexToLetter(index: number): string {
  let result = '';
  let n = index;
  while (n >= 0) {
    result = String.fromCharCode((n % 26) + 65) + result;
    n = Math.floor(n / 26) - 1;
  }
  return result;
}

/** Build a cell address string like "C4" */
export function cellAddress(col: number, row: number): string {
  return `${colIndexToLetter(col)}${row + 1}`;
}
