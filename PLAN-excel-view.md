# Plan: Excel View for PO List Page

## Current State

The PO list page (`/frontend/src/app/purchase-orders/page.tsx`) has a basic table with 6 columns:
- PO Number (with headline), Date, Quantity, Value, Styles Count, Actions
- Simple search by PO number
- Pagination (10 per page, prev/next only)
- No sorting, no column filtering, no column resizing

The backend `GET /purchase-orders` returns limited fields:
- `id, po_number, importer, agency, po_date, total_quantity, total_value, status, styles_count, created_at`

Key assets already available:
- `@tanstack/react-table` v8.21.3 is installed but **unused**
- Backend PO model has rich relationships: retailer, season, country, warehouse, currency, payment_term, styles (with pivot data)
- Backend already supports `sort_by`, `sort_order`, `date_from`, `date_to`, `status`, `importer_id`, `agency_id` filters

---

## Goal

Build a full-featured Excel/spreadsheet-style view for the PO list page with:
- Many more columns showing all PO data
- Column sorting, filtering, resizing, reordering
- Column visibility toggle (show/hide columns)
- Sticky first column (PO Number)
- Row selection for bulk actions
- Expandable rows to show styles within each PO
- Higher density display (compact rows)
- Configurable page sizes (25, 50, 100)
- View toggle: current "Card View" vs new "Excel View"

---

## Implementation Plan

### Phase 1: Backend — Enhanced List Endpoint

**File:** `backend/app/Http/Controllers/Api/PurchaseOrderController.php`

**1.1** Modify the `index` method to accept a `view=excel` query parameter. When `view=excel`:
- Eager-load additional relationships: `retailer`, `season`, `country`, `warehouse`, `currency`, `paymentTerm`
- Return all PO fields (headline, shipping_term, etd_date, eta_date, ex_factory_date, in_warehouse_date, payment_terms, packing_method, revision_date, ship_to, etc.)
- Return related entity names inline (retailer.name, season.name, country.name, warehouse.name, currency.code)
- Return styles as nested array with pivot data (style_number, color, quantity_in_po, unit_price_in_po, production_status, shipping_approval_status, assigned factory, etc.)
- Support larger `per_page` values (up to 100)
- Support sorting on new columns: `po_number`, `po_date`, `total_quantity`, `total_value`, `status`, `etd_date`, `eta_date`, `retailer` (join), `season` (join)

**1.2** Add new filter support:
- `shipping_term` — filter by FOB or DDP
- `retailer_id` — filter by retailer
- `season_id` — filter by season
- `country_id` — filter by country

Response format when `view=excel`:
```json
{
  "data": [{
    "id": 1,
    "po_number": "PO-2025-001",
    "headline": "Spring Collection",
    "status": "confirmed",
    "po_date": "2025-01-14",
    "revision_date": "2025-01-20",
    "shipping_term": "FOB",
    "etd_date": "2025-03-01",
    "eta_date": "2025-03-20",
    "ex_factory_date": "2025-02-22",
    "in_warehouse_date": "2025-03-25",
    "total_quantity": 5000,
    "total_value": 25000,
    "styles_count": 5,
    "payment_terms": "Net 30",
    "ship_to": "NYC Warehouse",
    "importer": { "id": 1, "name": "John", "company": "Acme" },
    "agency": { "id": 2, "name": "Agency Co", "company": "..." },
    "retailer": { "id": 3, "name": "Nordstrom" },
    "season": { "id": 1, "name": "SS2025" },
    "country": { "id": 5, "name": "Bangladesh" },
    "warehouse": { "id": 2, "name": "NYC Main" },
    "currency": { "id": 1, "code": "USD", "symbol": "$" },
    "styles": [{
      "id": 10,
      "style_number": "ST-001",
      "description": "Cotton Tee",
      "color_name": "Red",
      "quantity_in_po": 1000,
      "unit_price_in_po": 5.00,
      "total_price": 5000,
      "production_status": "in_production",
      "shipping_approval_status": "pending",
      "assigned_factory": "Factory A",
      "assignment_type": "direct_to_factory",
      "ex_factory_date": "2025-02-22",
      "target_shipment_date": "2025-03-01"
    }],
    "created_at": "2025-01-14T10:00:00Z"
  }],
  "current_page": 1,
  "last_page": 5,
  "per_page": 50,
  "total": 250
}
```

### Phase 2: Frontend — Excel View Component

**2.1** Create `frontend/src/components/purchase-orders/POExcelView.tsx`

A new component using `@tanstack/react-table` with the following columns:

| # | Column | Field | Type | Sortable | Filterable |
|---|--------|-------|------|----------|------------|
| 1 | PO Number | `po_number` | string (link) | Yes | Yes (text) |
| 2 | Headline | `headline` | string | No | No |
| 3 | Status | `status` | badge | Yes | Yes (select) |
| 4 | PO Date | `po_date` | date | Yes | Yes (date range) |
| 5 | Retailer | `retailer.name` | string | Yes | Yes (select) |
| 6 | Season | `season.name` | string | Yes | Yes (select) |
| 7 | Country | `country.name` | string | No | Yes (select) |
| 8 | Shipping Term | `shipping_term` | badge | No | Yes (select) |
| 9 | Currency | `currency.code` | string | No | No |
| 10 | Total Qty | `total_quantity` | number | Yes | No |
| 11 | Total Value | `total_value` | currency | Yes | No |
| 12 | Styles | `styles_count` | number | Yes | No |
| 13 | ETD Date | `etd_date` | date | Yes | No |
| 14 | ETA Date | `eta_date` | date | Yes | No |
| 15 | Ex-Factory | `ex_factory_date` | date | Yes | No |
| 16 | In-Warehouse | `in_warehouse_date` | date | No | No |
| 17 | Payment Terms | `payment_terms` | string | No | No |
| 18 | Importer | `importer.name` | string | No | Yes (select) |
| 19 | Agency | `agency.name` | string | No | Yes (select) |
| 20 | Ship To | `ship_to` | string | No | No |
| 21 | Created | `created_at` | date | Yes | No |

Features:
- **Column resizing**: Drag column borders to resize
- **Column visibility**: Dropdown to toggle columns on/off (default: show columns 1-13, hide 14-21)
- **Sorting**: Click column header to sort (server-side)
- **Sticky first column**: PO Number stays fixed on horizontal scroll
- **Row expansion**: Click expand arrow to reveal style details inline (sub-table showing style_number, color, qty, price, status, factory)
- **Row selection**: Checkboxes for bulk operations
- **Compact mode**: Dense row height for maximum data density
- **Page sizes**: 25, 50, 100 per page
- **Page number navigation**: Jump to specific page, not just prev/next

**2.2** Create `frontend/src/components/purchase-orders/ExcelColumnFilter.tsx`

Small filter components for column headers:
- Text filter (debounced input)
- Select filter (dropdown with options fetched from master data)
- Date range filter (two date inputs)

**2.3** Create `frontend/src/components/purchase-orders/ExcelExpandedRow.tsx`

Expanded row sub-component showing styles in a nested table:
- Style Number, Color, Description, Qty in PO, Unit Price, Total, Production Status, Factory, Shipping Approval

### Phase 3: Frontend — Integrate into PO List Page

**File:** `frontend/src/app/purchase-orders/page.tsx`

**3.1** Add view mode toggle (List View / Excel View) in the page header, stored in localStorage for persistence.

**3.2** When Excel view is active:
- Hide the current Card-based filters and table
- Render `POExcelView` component instead
- Pass current search term and master data for filter dropdowns
- Keep the header buttons (New PO, Import, Export) working

**3.3** Wire up the Export button:
- When in Excel view, export current filtered data as CSV/Excel
- Use the existing backend `GET /reports/purchase-orders?format=csv` endpoint, forwarding current filter params

### Phase 4: Frontend — TypeScript Types

**File:** `frontend/src/types/index.ts`

**4.1** Add `ExcelViewPurchaseOrder` interface extending `PurchaseOrder` with:
- `retailer?: { id: number; name: string }`
- `season?: { id: number; name: string }`
- `country?: { id: number; name: string }`
- `warehouse?: { id: number; name: string }`
- `currency_detail?: { id: number; code: string; symbol: string }`
- `styles_data?: ExcelViewStyle[]` (with pivot data)

**4.2** Add `ExcelViewStyle` interface with pivot data fields.

**4.3** Add `ExcelViewFilters` interface for filter state.

---

## File Changes Summary

| File | Action | Description |
|------|--------|-------------|
| `backend/app/Http/Controllers/Api/PurchaseOrderController.php` | Modify | Add `view=excel` response branch with full data, new filters, join-based sorting |
| `frontend/src/types/index.ts` | Modify | Add ExcelView-related interfaces |
| `frontend/src/components/purchase-orders/POExcelView.tsx` | **Create** | Main Excel view component with @tanstack/react-table |
| `frontend/src/components/purchase-orders/ExcelColumnFilter.tsx` | **Create** | Column filter components (text, select, date range) |
| `frontend/src/components/purchase-orders/ExcelExpandedRow.tsx` | **Create** | Expanded row showing styles |
| `frontend/src/app/purchase-orders/page.tsx` | Modify | Add view toggle, conditionally render Excel view |

---

## Technical Details

### @tanstack/react-table Setup
```tsx
const table = useReactTable({
  data,
  columns,
  state: { sorting, columnFilters, columnVisibility, rowSelection, expanded, pagination },
  onSortingChange: setSorting,
  onColumnFiltersChange: setColumnFilters,
  onColumnVisibilityChange: setColumnVisibility,
  onRowSelectionChange: setRowSelection,
  onExpandedChange: setExpanded,
  onPaginationChange: setPagination,
  getCoreRowModel: getCoreRowModel(),
  manualSorting: true,      // server-side sorting
  manualFiltering: true,    // server-side filtering
  manualPagination: true,   // server-side pagination
  getExpandedRowModel: getExpandedRowModel(),
  columnResizeMode: 'onChange',
  enableColumnResizing: true,
})
```

### Server-Side Integration
- Sorting/filtering/pagination all handled server-side via API params
- `useEffect` watches table state changes and re-fetches data
- Debounced text filters (300ms delay)
- Filter state synced with URL search params for shareable links

### Styling
- Use existing Tailwind classes + shadcn `table.tsx` base styles
- Horizontal scroll container with sticky first column via `position: sticky; left: 0`
- Zebra striping for readability: `even:bg-muted/50`
- Compact row padding: `py-1.5 px-2` instead of default
- Column resize handle visible on hover
- Active sort column highlighted

---

## Not in Scope (Future Enhancements)
- Inline cell editing (edit PO fields directly in the table)
- Drag-and-drop column reordering
- Saved view presets (save column visibility + filter combinations)
- Keyboard navigation (arrow keys to move between cells)
- Copy-paste cell values
