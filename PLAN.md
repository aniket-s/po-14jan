# Full-Screen Excel-Like Spreadsheet View for Purchase Orders

## Overview

Replace the current POExcelView with a full-screen, Microsoft Excel-like spreadsheet experience for viewing and editing PO styles. Uses **@glideapps/glide-data-grid** (MIT, canvas-based, 100k+ row performance) as the grid engine, wrapped in a custom Excel-like shell (ribbon toolbar, formula bar, column letters, row numbers, green selection border, status bar).

Each row = one **style within a PO**. The PO creator can edit cells in real-time; changes are auto-saved to the backend and broadcast via the existing Laravel Reverb WebSocket infrastructure to other viewers.

---

## Architecture

### Route & Layout

- **New full-screen page**: `/purchase-orders/[poId]/spreadsheet`
  - No sidebar, no DashboardLayout — 100vh full-screen
  - Minimal header: PO number + back button + save indicator
- **Entry point**: From PO detail page or PO list → click "Open in Spreadsheet" button
- Also support an **"All POs" spreadsheet** at `/purchase-orders/spreadsheet` showing styles across all POs (grouped by PO, with PO header rows)

### Component Tree

```
SpreadsheetPage (full-screen, 100vh)
├── SpreadsheetHeader          — PO info bar, back button, save status, share
├── SpreadsheetToolbar         — Excel-like ribbon with tabs
│   ├── HomeTab                — Clipboard, Font, Alignment, Number, Cells, Editing
│   ├── InsertTab              — Add Row (new style), Image upload
│   ├── DataTab                — Sort, Filter, Group
│   └── ViewTab                — Freeze panes, Zoom, Gridlines, Column visibility
├── SpreadsheetFormulaBar      — Cell reference (e.g. "C4") + cell value editor
├── SpreadsheetGrid            — @glideapps/glide-data-grid canvas grid
│   ├── Custom cell renderers  — ImageCell, BadgeCell, CurrencyCell, DateCell
│   └── Custom cell editors    — TextEditor, NumberEditor, DropdownEditor, DatePicker, ImageUploader
├── SpreadsheetSheetTabs       — Bottom tabs (if multi-PO: one tab per PO)
└── SpreadsheetStatusBar       — Row count, selection range, sum/avg of selected numbers
```

### File Structure (new files)

```
frontend/src/
├── app/purchase-orders/[poId]/spreadsheet/
│   └── page.tsx                              — Full-screen spreadsheet page
├── components/spreadsheet/
│   ├── SpreadsheetView.tsx                   — Main orchestrator component
│   ├── SpreadsheetHeader.tsx                 — PO info + back + save status
│   ├── SpreadsheetToolbar.tsx                — Ribbon toolbar container
│   ├── toolbar/
│   │   ├── HomeTab.tsx                       — Home ribbon tab
│   │   ├── InsertTab.tsx                     — Insert ribbon tab
│   │   ├── DataTab.tsx                       — Data ribbon tab
│   │   └── ViewTab.tsx                       — View ribbon tab
│   ├── SpreadsheetFormulaBar.tsx             — Formula/cell bar
│   ├── SpreadsheetGrid.tsx                   — Grid wrapper around glide-data-grid
│   ├── SpreadsheetSheetTabs.tsx              — Bottom sheet tabs
│   ├── SpreadsheetStatusBar.tsx              — Bottom status bar
│   ├── cells/
│   │   ├── ImageCellRenderer.ts              — Canvas renderer for CAD images
│   │   ├── BadgeCellRenderer.ts              — Canvas renderer for status badges
│   │   ├── CurrencyCellRenderer.ts           — Canvas renderer for formatted currency
│   │   └── DateCellRenderer.ts               — Canvas renderer for dates
│   ├── editors/
│   │   ├── TextCellEditor.tsx                — Multi-line text editor overlay
│   │   ├── DropdownCellEditor.tsx            — Dropdown for status/factory/color
│   │   ├── DateCellEditor.tsx                — Date picker editor
│   │   ├── NumberCellEditor.tsx              — Number input with formatting
│   │   └── ImageCellEditor.tsx               — Image upload/selection editor
│   └── hooks/
│       ├── useSpreadsheetData.ts             — Data fetching, caching, optimistic updates
│       ├── useSpreadsheetRealtime.ts         — WebSocket subscription for live updates
│       ├── useSpreadsheetColumns.ts          — Column definitions & mapping
│       ├── useSpreadsheetSelection.ts        — Selection state, formula bar sync
│       └── useSpreadsheetActions.ts          — Toolbar action handlers (sort, filter, etc.)
├── types/spreadsheet.ts                      — Spreadsheet-specific types
```

---

## Grid Columns (Style Fields → Spreadsheet Columns)

Each column maps a style/pivot field to a spreadsheet column with a letter header (A, B, C...) and a named sub-header.

| Col | Header | Source Field | Type | Editable | Width | Cell Kind |
|-----|--------|-------------|------|----------|-------|-----------|
| A | Row # | (auto) | number | No | 40 | RowID |
| B | Style # | style.style_number | text | Yes | 120 | Text |
| C | Label | style.retailer.name or custom | text | Yes | 100 | Text |
| D | Color | style.color_name | text | Yes | 100 | Text |
| E | Color Code | style.color_code | text | Yes | 90 | Text |
| F | CAD | style.images[0] | image | Yes (upload) | 80 | Image |
| G | Description | style.description | text | Yes | 200 | Text (multiline) |
| H | Fabric | style.fabric | text | Yes | 120 | Text |
| I | Fabric Type | style.fabric_type_name | text | Yes | 110 | Text |
| J | Fit | style.fit | text | Yes | 80 | Text |
| K | Qty | pivot.quantity_in_po | number | Yes | 80 | Number |
| L | Unit Price | pivot.unit_price_in_po | currency | Yes | 100 | Currency |
| M | Total Price | K * L (computed) | currency | No (auto) | 100 | Currency |
| N | MSRP | style.msrp | currency | Yes | 90 | Currency |
| O | Wholesale | style.wholesale_price | currency | Yes | 90 | Currency |
| P | Size Breakdown | pivot.size_breakdown | json | Yes (popup) | 150 | Custom |
| Q | Status | pivot.status | enum | Yes (dropdown) | 100 | Dropdown |
| R | Prod. Status | pivot.production_status | enum | Yes (dropdown) | 110 | Dropdown |
| S | Factory | pivot.assigned_factory | lookup | Yes (dropdown) | 120 | Dropdown |
| T | Assignment | pivot.assignment_type | enum | Yes (dropdown) | 110 | Dropdown |
| U | Ex-Factory | pivot.ex_factory_date | date | Yes | 110 | Date |
| V | Target Ship | pivot.target_shipment_date | date | Yes | 110 | Date |
| W | Est. Ex-Factory | pivot.estimated_ex_factory_date | date | Yes | 120 | Date |
| X | Ship Approval | pivot.shipping_approval_status | enum | No (workflow) | 110 | Badge |
| Y | Notes | pivot.notes | text | Yes | 200 | Text (multiline) |
| Z | Country | style.country_of_origin | text | Yes | 100 | Text |
| AA | FOB Price | style.fob_price | currency | Yes | 90 | Currency |
| AB | Category | style.category.name | text | No | 100 | Text |
| AC | Season | style.season.name | text | No | 100 | Text |
| AD | Created | style.created_at | date | No | 110 | Date |

Columns Q–X hidden by default (toggle via View tab). Users can reorder and resize all columns.

---

## Toolbar Ribbon (Home Tab — Primary)

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ Home │ Insert │ Data │ View │                                              [PO-2025-001] │
├──────────────────────────────────────────────────────────────────────────────────────────┤
│ 📋 Paste │ B I U S │ ≡ ≡ ≡ │ $ % , .0 .00 │ + Insert │ Σ Sort │ 🔍 Find │ ↩ Undo │
│    Copy  │ Font    │ Align │ Number Format │ - Delete │ Filter │ Replace │ ↪ Redo │
│    Cut   │ Size ▼  │       │               │ Row/Col  │        │         │        │
├──────────┴─────────┴───────┴───────────────┴──────────┴────────┴─────────┴────────┤
│ Clipboard│  Font   │ Align │    Number     │  Cells   │ Sort & │ Editing │ History│
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

### Home Tab Actions
- **Clipboard**: Copy (Ctrl+C), Cut (Ctrl+X), Paste (Ctrl+V) — glide-data-grid native
- **Font**: Bold, Italic, Underline, Strikethrough — stored in cell metadata for notes/description
- **Alignment**: Left, Center, Right — per-column default, overridable
- **Number Format**: General, Number (comma-separated), Currency ($), Percent, Date
- **Cells**: Insert Row (add new style), Delete Row (detach style from PO)
- **Sort & Filter**: Sort A→Z / Z→A on selected column; toggle column filter dropdowns
- **Find & Replace**: Search across all cells with highlight; replace values
- **Undo/Redo**: Track edit history, revert changes (local stack + API revert)

### Insert Tab
- **New Style Row**: Add blank style row (creates style + attaches to PO)
- **Image**: Upload image to selected CAD cell
- **Bulk Import**: Open existing Excel import dialog

### Data Tab
- **Sort**: Multi-column sort dialog
- **Filter**: Column auto-filter dropdowns (like Excel's column header filter)
- **Group**: Group rows by a column value (e.g., group by Color or Factory)
- **Validation**: Set cell validation rules (min/max for qty, required fields)

### View Tab
- **Freeze**: Freeze first N columns (Style # always visible)
- **Zoom**: 75% / 100% / 125% / 150%
- **Gridlines**: Toggle gridlines on/off
- **Headers**: Toggle row numbers / column letters
- **Column Visibility**: Checklist to show/hide columns
- **Full Screen**: Toggle browser fullscreen (F11)

---

## Formula Bar

```
┌─────────┬──────────────────────────────────────────────────┐
│  C4  ▼  │  Summer Floral Print Dress                       │
└─────────┴──────────────────────────────────────────────────┘
```

- **Cell Reference** (left): Shows current cell address (e.g., "G4" for Description row 4)
- **Value** (right): Shows and allows editing the current cell value
- Editing in the formula bar updates the cell; editing in the cell updates the formula bar
- For computed cells (Total Price), shows the formula: `=K4*L4`
- Pressing Enter commits the edit; Escape cancels

---

## Status Bar

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ Ready │ 24 styles │ Selected: C4:C8 │ Count: 5 │ Sum: 12,450 │ Avg: 2,490 │
└──────────────────────────────────────────────────────────────────────────────┘
```

- **Mode**: Ready / Edit / Filter
- **Row Count**: Total styles in PO
- **Selection**: Current selection range
- **Aggregates**: Auto-calculated Count, Sum, Average for selected numeric cells

---

## Data Flow & Real-Time Editing

### Loading Data

```
1. Page loads → GET /api/purchase-orders/{poId}?with=styles_full
   (new query param that returns all style fields + pivot fields + relationships)
2. Map response to grid row format: StyleSpreadsheetRow[]
3. Initialize glide-data-grid with data
```

### Editing (Optimistic + Persist)

```
1. User edits cell (e.g., changes Qty in K4)
2. Local state updates immediately (optimistic)
3. Formula bar reflects new value
4. Debounced API call (300ms): PATCH /api/purchase-orders/{poId}/styles/{styleId}/cell
   Body: { field: "quantity_in_po", value: 500 }
5. Backend validates, saves, recalculates totals
6. Backend broadcasts StyleCellUpdated event on private channel `po.{poId}`
7. Save indicator: ✓ Saved (green) / ⏳ Saving... (yellow) / ✗ Error (red)
8. On error: revert local state, show toast with error message
```

### Real-Time (WebSocket via Laravel Reverb)

```
1. On mount: echo.private(`po.${poId}`).listen('StyleCellUpdated', handler)
2. handler receives: { style_id, field, value, updated_by, updated_at }
3. If updated_by !== currentUser → update local cell data
4. Show subtle highlight animation on remotely changed cells
5. On unmount: leave channel
```

---

## Backend Changes

### New API Endpoint

```php
// PATCH /api/purchase-orders/{poId}/styles/{styleId}/cell
// Permission: po.edit
// Validates field name against whitelist, validates value type
// Updates either Style model field or PurchaseOrderStyle pivot field
// Recalculates PO totals if quantity/price changed
// Broadcasts StyleCellUpdated event
```

**Field Whitelist & Routing:**
- Style model fields: style_number, description, color_name, color_code, fabric, fabric_type_name, fit, country_of_origin, msrp, wholesale_price, fob_price
- Pivot fields: quantity_in_po, unit_price_in_po, size_breakdown, status, production_status, notes, ex_factory_date, estimated_ex_factory_date, target_shipment_date, assigned_factory_id, assignment_type

### New Endpoint for Full Style Data

```php
// GET /api/purchase-orders/{poId}/spreadsheet-data
// Returns all styles with ALL fields needed for spreadsheet
// Includes: style fields + pivot fields + related names (factory name, category name, etc.)
// Eager-loads: styles.category, styles.season, styles.color, styles.brand
// + batch-loads factory names from pivot
```

### New Event

```php
// App\Events\StyleCellUpdated
// Channel: private-po.{poId}
// Payload: { style_id, field, value, old_value, updated_by: { id, name }, updated_at }
// Implements ShouldBroadcast
```

### Route Registration

```php
// routes/api.php (inside purchase-orders group)
Route::patch('/{poId}/styles/{styleId}/cell', [PurchaseOrderController::class, 'updateStyleCell']);
Route::get('/{poId}/spreadsheet-data', [PurchaseOrderController::class, 'spreadsheetData']);
```

### Broadcasting Channel Authorization

```php
// routes/channels.php
Broadcast::channel('po.{poId}', function ($user, $poId) {
    // User must have po.view or po.view_all or po.view_own (and owns it)
    return $user->hasPermissionTo('po.view_all')
        || $user->hasPermissionTo('po.view')
        || /* owns the PO check */;
});
```

---

## Permission Model

| Permission | Can View | Can Edit Cells | Can Add/Delete Rows |
|-----------|----------|---------------|---------------------|
| po.view_all | Yes | No | No |
| po.view | Yes | No | No |
| po.view_own (owns PO) | Yes | No | No |
| po.edit | Yes | Yes | No |
| po.create (is PO creator) | Yes | Yes | Yes |
| style.edit | Yes | Style fields only | No |
| po.assign_factory | Yes | Factory column only | No |

- Read-only users see the full spreadsheet but cannot click into cells
- Edit users get green cell borders on editable cells, gray on read-only
- PO creator gets full access including adding/deleting style rows

---

## Keyboard Shortcuts (Excel-Compatible)

| Shortcut | Action |
|----------|--------|
| Arrow keys | Navigate cells |
| Tab / Shift+Tab | Move right/left |
| Enter / Shift+Enter | Move down/up, commit edit |
| F2 | Enter edit mode on selected cell |
| Escape | Cancel edit |
| Ctrl+C / Ctrl+V | Copy/paste |
| Ctrl+Z / Ctrl+Y | Undo/redo |
| Ctrl+F | Find dialog |
| Ctrl+H | Find & Replace dialog |
| Ctrl+S | Force save all pending changes |
| Ctrl+B / I / U | Bold/Italic/Underline (notes cells) |
| Delete | Clear cell content |
| Ctrl+; | Insert today's date |
| Ctrl+Shift+L | Toggle filters |
| Home / End | Go to first/last column |
| Ctrl+Home / Ctrl+End | Go to first/last cell |
| Ctrl+Arrow | Jump to edge of data region |
| Shift+Click | Range selection |
| Ctrl+Click | Multi-cell selection |

Most of these are natively supported by glide-data-grid. Custom ones (Ctrl+S, Ctrl+;, etc.) will be handled via a global keydown listener.

---

## Implementation Steps (Ordered)

### Step 1: Install Dependencies
```bash
npm install @glideapps/glide-data-grid
```

### Step 2: Types & Interfaces
- Create `frontend/src/types/spreadsheet.ts`
- Define `StyleSpreadsheetRow`, `SpreadsheetColumn`, `CellEdit`, `SpreadsheetState`

### Step 3: Backend — New Endpoints
- Add `spreadsheetData()` method to PurchaseOrderController
- Add `updateStyleCell()` method with field whitelist & validation
- Register routes in api.php

### Step 4: Backend — Broadcasting
- Create `StyleCellUpdated` event class
- Register broadcast channel authorization in channels.php
- Fire event from `updateStyleCell()`

### Step 5: Spreadsheet Page & Layout
- Create `/purchase-orders/[poId]/spreadsheet/page.tsx`
- Full-screen layout (100vh, no sidebar)
- SpreadsheetHeader with PO info + back navigation

### Step 6: Data Hook (useSpreadsheetData)
- Fetch PO + styles via new spreadsheet-data endpoint
- Map to grid row format
- Handle optimistic updates + API persistence
- Debounced cell saves
- Undo/redo stack

### Step 7: Grid Component (SpreadsheetGrid)
- Configure @glideapps/glide-data-grid with Excel theme
- Green selection border, alternating row colors
- Column letters (A, B, C...) + named headers
- Row numbers
- Column resizing, reordering
- Freeze first 2 columns (Row #, Style #)

### Step 8: Custom Cell Renderers
- ImageCellRenderer: Render thumbnail from URL, click to enlarge
- BadgeCellRenderer: Colored status badges (pending/in_production/etc.)
- CurrencyCellRenderer: Format with currency symbol + commas
- DateCellRenderer: Format as locale date string

### Step 9: Custom Cell Editors
- DropdownCellEditor: For status, factory, assignment type
- DateCellEditor: Date picker popover
- ImageCellEditor: Upload dialog or URL input
- NumberCellEditor: Numeric input with validation

### Step 10: Formula Bar
- Show cell reference (column letter + row number)
- Show/edit cell value
- Sync with grid selection state
- Show formula for computed cells

### Step 11: Toolbar Ribbon
- Tab navigation (Home, Insert, Data, View)
- Home tab with all action groups
- Insert tab with add-row and image upload
- Data tab with sort/filter controls
- View tab with freeze/zoom/visibility toggles

### Step 12: Status Bar
- Selection range display
- Aggregate calculations (Count, Sum, Average)
- Mode indicator (Ready/Edit)
- Row count

### Step 13: Real-Time Integration (useSpreadsheetRealtime)
- Connect to Reverb via existing Echo setup
- Subscribe to `po.{poId}` private channel
- Handle `StyleCellUpdated` events
- Highlight remotely changed cells
- Conflict resolution (last-write-wins with notification)

### Step 14: Entry Points & Navigation
- Add "Open in Spreadsheet" button to PO detail page
- Update PO list page Excel toggle to link to spreadsheet page
- Add keyboard shortcut hint

### Step 15: Polish & Testing
- Loading skeleton that looks like an empty spreadsheet
- Error boundary with recovery
- Mobile responsive fallback (message to use desktop)
- Performance testing with 500+ styles
- Accessibility: screen reader support for grid navigation

---

## Dependencies

| Package | Version | License | Purpose |
|---------|---------|---------|---------|
| @glideapps/glide-data-grid | ^6.x | MIT | Canvas-based Excel grid |

No other new dependencies needed — all other UI components (buttons, dropdowns, dialogs, icons) already exist in the project via Radix UI + Lucide + shadcn/ui. Real-time uses existing laravel-echo + pusher-js.

---

## Theme Configuration (Excel Look)

```typescript
const excelTheme: Partial<Theme> = {
  accentColor: '#217346',          // Excel green for selection
  accentLight: '#E2EFDA',          // Light green for selection fill
  bgCell: '#FFFFFF',               // White cell background
  bgCellMedium: '#F2F2F2',        // Alternate row gray
  bgHeader: '#E6E6E6',            // Header background (Excel gray)
  bgHeaderHasFocus: '#D9E2F3',    // Focused header
  bgHeaderHovered: '#D6DCE4',     // Hovered header
  borderColor: '#D4D4D4',         // Grid lines (light gray)
  textDark: '#000000',            // Cell text
  textHeader: '#000000',          // Header text
  textMedium: '#737373',          // Secondary text
  headerFontStyle: '600 13px',    // Bold headers
  baseFontStyle: '13px',          // Cell font
  fontFamily: 'Calibri, "Segoe UI", Arial, sans-serif',  // Excel-like font
  cellHorizontalPadding: 8,
  cellVerticalPadding: 4,
  headerIconSize: 16,
  editorFontSize: '13px',
  lineHeight: 1.4,
};
```

---

## What Gets Removed

- `frontend/src/components/purchase-orders/POExcelView.tsx` (replaced entirely)
- `frontend/src/components/purchase-orders/ExcelExpandedRow.tsx` (no longer needed — styles are top-level rows)
- `frontend/src/components/purchase-orders/ExcelColumnFilter.tsx` (replaced by toolbar filters)
- The `viewMode === 'excel'` toggle in the PO list page will link to the new spreadsheet page instead

---

## Estimated Scope

| Component | Complexity | Files |
|-----------|-----------|-------|
| Backend endpoints + event | Medium | 3-4 files |
| Types & hooks | Medium | 5-6 files |
| Grid + cell renderers/editors | High | 8-10 files |
| Toolbar ribbon | High | 5-6 files |
| Formula bar + status bar | Low | 2 files |
| Page + layout + navigation | Low | 2-3 files |
| Real-time integration | Medium | 2 files |
| **Total** | | **~28-33 files** |
