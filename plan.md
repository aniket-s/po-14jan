# PDF Purchase Order Parser - Implementation Plan

## Overview

Build a feature that allows importers/agencies to upload a Purchase Order PDF, automatically extract all data from it, create a PO with attached styles, and surface any fields the system couldn't identify for manual correction.

---

## PDF Format Analysis (from provided images)

The PO PDFs contain:

**Header Section:**
- PO Number, Date, Revision
- Vendor/Supplier (name, address, contact, phone, fax, email)
- Ship To (company name, address)
- Payment Terms, Ship Via, FOB
- Season, Department, Division, Buyer

**Line Items Table:**
- Style/Item number
- Description
- Color/Colorway
- Size columns with individual quantities (XS, S, M, L, XL, XXL, etc.)
- Total Quantity per row
- Unit Price per row
- Total Amount per row

**Footer:**
- Grand Total Quantity
- Grand Total Amount
- Special Instructions / Notes

---

## Architecture Decision: PDF Parsing Approach

**Chosen: `smalot/pdfparser` (PHP) for text extraction + structured regex-based parsing**

Rationale:
- Pure PHP, no external system dependencies (no Python, no poppler-utils needed)
- Keeps everything within the existing Laravel ecosystem
- The PO format shown is text-based (not scanned images), making text extraction reliable
- Follows the same service pattern as the existing `ExcelImportService`
- No external API costs (vs Claude Vision API)
- The two-phase approach (parse → review → confirm) handles edge cases where parsing fails

If text extraction proves insufficient for some PDFs in the future, we can add a fallback to Claude Vision API (the architecture supports swapping parsers).

---

## Implementation Plan

### Phase 1: Backend - PDF Parser Service & API

#### 1.1 Install PHP PDF Parser dependency
- Add `smalot/pdfparser` to composer.json
- Run `composer install`

#### 1.2 Create `PdfImportService` (new file)
**File:** `backend/app/Services/PdfImportService.php`

This service mirrors the `ExcelImportService` pattern with two phases: analyze and execute.

**Methods:**

```
analyzePdf(string $filePath): array
```
- Extracts all text from PDF using smalot/pdfparser
- Parses text into structured sections (header, line items, footer)
- Returns parsed data with confidence indicators for each field
- Returns warnings for fields that couldn't be identified

```
parseHeaderSection(string $text): array
```
- Extracts PO number, date, revision using regex patterns
- Extracts vendor/factory information block
- Extracts ship-to information block
- Extracts payment terms, shipping term (FOB/DDP), season
- Matches extracted values against master data (retailers, seasons, countries, currencies, payment terms, warehouses) by name/code
- Returns matched IDs where found, raw text where not matched

```
parseLineItems(string $text): array
```
- Detects the table structure from text layout
- Extracts column headers to identify size columns dynamically
- Parses each row: style number, description, color, size quantities, total qty, unit price, total amount
- Builds size_breakdown JSON from individual size columns
- Validates row data (quantities match, prices calculate correctly)

```
parseFooter(string $text): array
```
- Extracts total quantity and total value
- Extracts special instructions/notes
- Cross-validates totals against sum of line items

```
matchMasterData(array $parsedData): array
```
- Fuzzy-matches extracted text values to existing master data records:
  - Retailer name → retailer_id
  - Season name → season_id
  - Country name → country_id
  - Currency code/symbol → currency_id
  - Payment term name → payment_term_id
  - Warehouse name → warehouse_id
- Returns matched IDs with confidence scores and unmatched raw values

```
buildPurchaseOrderData(array $parsedData, array $matchedMasterData): array
```
- Assembles the final structured output that maps to PurchaseOrder + Style models
- Separates into: `po_header` (maps to PurchaseOrder fields) and `styles` (maps to Style + pivot fields)
- Marks each field with status: `matched` | `parsed` | `unrecognized` | `missing`

**Return structure from analyzePdf:**
```json
{
  "success": true,
  "po_header": {
    "po_number": { "value": "PO-2024-001", "status": "parsed", "confidence": "high" },
    "po_date": { "value": "2024-01-15", "status": "parsed", "confidence": "high" },
    "retailer_id": { "value": 3, "raw_text": "Walmart", "status": "matched", "confidence": "high" },
    "season_id": { "value": null, "raw_text": "Spring 2024", "status": "unrecognized", "confidence": "low" },
    "currency_id": { "value": 1, "raw_text": "USD", "status": "matched", "confidence": "high" },
    "shipping_term": { "value": "FOB", "status": "parsed", "confidence": "high" },
    "payment_term_id": { "value": null, "raw_text": "Net 30", "status": "unrecognized", "confidence": "low" },
    "ship_to": { "value": "Warehouse A, 123 Street", "status": "parsed", "confidence": "medium" },
    "country_of_origin": { "value": null, "raw_text": "", "status": "missing" },
    "etd_date": { "value": null, "status": "missing" },
    "notes": { "value": "Handle with care", "status": "parsed", "confidence": "medium" }
  },
  "styles": [
    {
      "style_number": { "value": "ST-001", "status": "parsed", "confidence": "high" },
      "description": { "value": "Men's Cotton T-Shirt", "status": "parsed", "confidence": "high" },
      "color_name": { "value": "Navy Blue", "status": "parsed", "confidence": "high" },
      "size_breakdown": { "value": { "S": 100, "M": 200, "L": 150, "XL": 50 }, "status": "parsed", "confidence": "high" },
      "quantity": { "value": 500, "status": "parsed", "confidence": "high" },
      "unit_price": { "value": 12.50, "status": "parsed", "confidence": "high" },
      "total_amount": { "value": 6250.00, "status": "parsed", "confidence": "high" }
    }
  ],
  "totals": {
    "total_quantity": 5000,
    "total_value": 75000.00,
    "validation_passed": true
  },
  "warnings": [
    "Season 'Spring 2024' not found in system - please select manually",
    "Payment term 'Net 30' not found - please select manually"
  ],
  "errors": [],
  "raw_text": "... (full extracted text for debugging)"
}
```

#### 1.3 Create API Endpoints

**File:** `backend/app/Http/Controllers/Api/PdfImportController.php` (new)

Two-phase flow (mirrors Excel import pattern):

**Endpoint 1: Analyze PDF**
```
POST /api/purchase-orders/pdf-import/analyze
Content-Type: multipart/form-data
Body: { file: <PDF file> }

Response: {
  "success": true,
  "parsed_data": { ... },      // Full structured parse result
  "temp_file_path": "temp/...", // For re-parsing if needed
  "warnings": [...],
  "errors": [...]
}
```

Validation:
- File type: application/pdf
- Max size: 20MB
- Required: file field

**Endpoint 2: Create PO from Parsed Data**
```
POST /api/purchase-orders/pdf-import/create
Content-Type: application/json
Body: {
  "po_header": {
    "po_number": "PO-2024-001",
    "po_date": "2024-01-15",
    "retailer_id": 3,
    "currency_id": 1,
    "shipping_term": "FOB",
    "season_id": 5,
    "payment_term_id": 2,
    "country_id": 1,
    "warehouse_id": 2,
    "ship_to": "...",
    "ship_to_address": "...",
    "packing_method": "...",
    "other_terms": "...",
    "additional_notes": "...",
    "etd_date": "2024-03-15",
    "headline": "Spring Collection"
  },
  "styles": [
    {
      "style_number": "ST-001",
      "description": "Men's Cotton T-Shirt",
      "color_name": "Navy Blue",
      "size_breakdown": { "S": 100, "M": 200, "L": 150, "XL": 50 },
      "quantity": 500,
      "unit_price": 12.50
    }
  ]
}

Response: {
  "success": true,
  "message": "Purchase order created successfully from PDF",
  "purchase_order": { "id": 123, "po_number": "PO-2024-001", ... },
  "styles_created": 12,
  "styles_errors": []
}
```

This endpoint:
1. Validates the submitted data using the same rules as the existing PO `store` method
2. Creates the PO header via the existing PurchaseOrder model
3. Creates each Style and attaches to PO via the pivot table (reusing ExcelImportService patterns)
4. Recalculates PO totals
5. Logs activity via ActivityLogService
6. Returns the created PO with any style-level errors

#### 1.4 Register Routes

**File:** `backend/routes/api.php`

Add inside the authenticated middleware group:
```php
Route::post('purchase-orders/pdf-import/analyze', [PdfImportController::class, 'analyze']);
Route::post('purchase-orders/pdf-import/create', [PdfImportController::class, 'create']);
```

---

### Phase 2: Frontend - PDF Import Dialog & Review UI

#### 2.1 Create `PdfImportDialog` Component (new file)
**File:** `frontend/src/components/purchase-orders/PdfImportDialog.tsx`

A multi-step dialog (similar pattern to `ExcelImportDialog.tsx`) with these steps:

**Step 1: Upload**
- Drag-and-drop zone + file picker for PDF files
- Accept: `.pdf` only, max 20MB
- Upload button triggers `POST /purchase-orders/pdf-import/analyze`
- Shows loading spinner during parsing

**Step 2: Review PO Header**
- Displays all parsed PO header fields in a form layout
- Each field shows:
  - The parsed value (pre-filled in form input)
  - A status indicator (green check = matched, yellow warning = needs review, red X = missing)
  - For master data fields (retailer, season, country, currency, warehouse, payment term): a select dropdown pre-populated with the matched value, allowing the user to change or select if unmatched
  - Inline "+" create buttons for missing master data (same pattern as existing PO create form)
- Warning banner at top listing all fields that need attention
- Required fields that are missing are highlighted with red borders

**Step 3: Review Styles / Line Items**
- Table showing all parsed styles with columns:
  - Row # | Style Number | Description | Color | Size Breakdown (expandable) | Total Qty | Unit Price | Total Amount | Status
- Each cell is editable (inline editing)
- Rows with issues highlighted in yellow/red
- Ability to delete rows that shouldn't be imported
- Ability to add missing rows manually
- Summary row: Total Quantity, Total Value
- Cross-validation: total matches sum of line items

**Step 4: Confirmation / Creating**
- Summary of what will be created:
  - PO header details (key fields)
  - Number of styles to be created
  - Total quantity and value
- "Create Purchase Order" button
- Loading state during creation

**Step 5: Result**
- Success/failure message
- Created PO details with link to view
- Any style-level errors listed
- "View Purchase Order" button navigates to PO detail page

#### 2.2 Add TypeScript Types
**File:** `frontend/src/types/index.ts`

Add new types:
```typescript
interface PdfParsedField<T = string> {
  value: T | null;
  raw_text?: string;
  status: 'matched' | 'parsed' | 'unrecognized' | 'missing';
  confidence?: 'high' | 'medium' | 'low';
}

interface PdfParsedPOHeader {
  po_number: PdfParsedField;
  po_date: PdfParsedField;
  retailer_id: PdfParsedField<number>;
  season_id: PdfParsedField<number>;
  currency_id: PdfParsedField<number>;
  shipping_term: PdfParsedField;
  payment_term_id: PdfParsedField<number>;
  country_id: PdfParsedField<number>;
  warehouse_id: PdfParsedField<number>;
  ship_to: PdfParsedField;
  ship_to_address: PdfParsedField;
  country_of_origin: PdfParsedField;
  etd_date: PdfParsedField;
  notes: PdfParsedField;
  headline: PdfParsedField;
  packing_method: PdfParsedField;
  other_terms: PdfParsedField;
}

interface PdfParsedStyle {
  style_number: PdfParsedField;
  description: PdfParsedField;
  color_name: PdfParsedField;
  size_breakdown: PdfParsedField<Record<string, number>>;
  quantity: PdfParsedField<number>;
  unit_price: PdfParsedField<number>;
  total_amount: PdfParsedField<number>;
}

interface PdfAnalysisResult {
  success: boolean;
  po_header: PdfParsedPOHeader;
  styles: PdfParsedStyle[];
  totals: {
    total_quantity: number;
    total_value: number;
    validation_passed: boolean;
  };
  warnings: string[];
  errors: string[];
  raw_text: string;
  temp_file_path: string;
}
```

#### 2.3 Integrate into PO List Page
**File:** `frontend/src/app/purchase-orders/page.tsx`

Add:
- "Import from PDF" button next to the existing "Import Excel" button in the PO list page header
- Opens `PdfImportDialog`
- On successful creation, refreshes the PO list

#### 2.4 Add PDF Import Service Functions
**File:** `frontend/src/services/styles.ts` (extend existing)

Add new functions:
```typescript
analyzePdf(file: File): Promise<PdfAnalysisResult>
createPOFromPdf(data: { po_header: object; styles: object[] }): Promise<CreatePOFromPdfResult>
```

---

## Field Mapping: PDF → Database Schema

| PDF Field | DB Table | DB Column | Match Strategy |
|-----------|----------|-----------|----------------|
| PO Number | purchase_orders | po_number | Direct text extraction |
| Date | purchase_orders | po_date | Date pattern regex |
| Revision | purchase_orders | revision_number | Number extraction |
| Vendor Name | - | (informational) | Display only, or match to factory user |
| Ship To | purchase_orders | ship_to, ship_to_address | Text block extraction |
| Payment Terms | purchase_orders | payment_term_id | Fuzzy match to payment_terms table |
| Ship Via / FOB | purchase_orders | shipping_term | Keyword detection (FOB/DDP) |
| Season | purchase_orders | season_id | Fuzzy match to seasons table |
| Currency ($, USD) | purchase_orders | currency_id | Symbol/code match to currencies table |
| Notes | purchase_orders | additional_notes | Text block extraction |
| Style # | styles | style_number | Direct extraction per row |
| Description | styles | description | Direct extraction per row |
| Color | styles | color_name | Direct extraction per row |
| Size Qtys | styles | size_breakdown (JSON) | Column-based extraction |
| Total Qty | pivot (purchase_order_style) | quantity_in_po | Sum/extraction per row |
| Unit Price | pivot (purchase_order_style) | unit_price_in_po | Decimal extraction per row |
| Total Amount | - | Calculated validation | qty * price cross-check |

---

## Error Handling Strategy

1. **Parse Errors** (Phase 1): PDF can't be read, is encrypted, or is a scanned image
   - Show clear error: "Unable to extract text from this PDF. The file may be scanned or encrypted."

2. **Field Recognition Errors** (Phase 2): Some fields couldn't be identified
   - Show warnings with yellow indicators
   - Fields left editable for manual input
   - Required fields marked with red if missing

3. **Master Data Mismatch** (Phase 2): Extracted values don't match existing records
   - Show the raw extracted text alongside the dropdown
   - User selects correct value or creates new master data inline

4. **Validation Errors** (Phase 4): Submitted data fails backend validation
   - Show validation errors from API response
   - Allow user to go back and correct

5. **Partial Failures** (Phase 5): Some styles fail to create
   - PO is still created
   - Show which styles succeeded and which failed
   - User can manually add failed styles later

---

## Files to Create (New)

| # | File | Description |
|---|------|-------------|
| 1 | `backend/app/Services/PdfImportService.php` | Core PDF parsing and data extraction service |
| 2 | `backend/app/Http/Controllers/Api/PdfImportController.php` | API endpoints for analyze + create |
| 3 | `frontend/src/components/purchase-orders/PdfImportDialog.tsx` | Multi-step PDF import wizard UI |

## Files to Modify (Existing)

| # | File | Changes |
|---|------|---------|
| 1 | `backend/composer.json` | Add `smalot/pdfparser` dependency |
| 2 | `backend/routes/api.php` | Add 2 PDF import routes |
| 3 | `frontend/src/app/purchase-orders/page.tsx` | Add "Import PDF" button + dialog integration |
| 4 | `frontend/src/types/index.ts` | Add PDF-related TypeScript types |
| 5 | `frontend/src/services/styles.ts` | Add PDF API service functions |

---

## Permissions

The PDF import feature will use the existing `po.create` permission — same as creating a PO manually or via Excel. No new permissions needed.

---

## Summary

- **Backend**: 2 new files (Service + Controller), 3 file modifications
- **Frontend**: 1 new file (Dialog component), 3 file modifications
- **New dependency**: `smalot/pdfparser` (PHP package)
- **Approach**: Two-phase (analyze → review/edit → create) following the established Excel import pattern
- **Error handling**: Comprehensive — parse errors, field warnings, master data mismatches, validation errors
- **UX**: User always reviews and can edit every field before PO creation
