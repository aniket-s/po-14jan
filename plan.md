# PDF Import Feature - Comprehensive Fix & Enhancement Plan

## PDF Format Analysis (5 Samples Studied)

All 5 POs are "Master Cut Ticket / Purchase Order" from **SPORT CASUAL INTERNATIONAL (SCI)**. They follow an identical layout.

### Header Layout (consistent across all samples):
```
SPORT CASUAL INTERNATIONAL (SCI)                    PO#: 2454
500 WEST CYPRESS ROAD SUITE 320                     Purchase ORIGINAL
FORT LAUDERDALE, FL 33309
Tel: 954-777-6997                                   CUST: CITITRENDS
                                                    LABELS: SAINT ARCHIVES
Vendor: Crystal Apparels India                      ISSUE DATE: 12-FEB-26
        Shed No-51, 2nd Floor...                    SHIP: 25-MAY-26
        New Delhi 110020 INDIA                      CANCEL: 01-JUN-26
                                                    PRE-TICKET: Y
Ship to Warehouse:                                  SAMPLE: Y
FTDI-EAST, 45 SAW MILL POND ROAD                   AIR/SEA: SEA
EDISON NJ 08817 6025 USA                           TERMS: NET 30
                                                    DDP
```

### CRITICAL: Multi-Row Line Item Structure
Each line item occupies **3-4 rows** in the PDF (NOT one row per item):
```
STYLE      COLOR          Ln  WH  DESCRIPTION              QTY    PRICE EA.  EXTN
SAT301SBC  001 BLACK       1  FE  SUPER BOXY TEE          2400      3.36   8,064.00
                                   Category:                               PACK 6
           SIZE >  XS    S     M     L     XL    2XL
           QTY >   300   600   600   600   300   0
```

### Variations Across Samples:
- **PO Numbers**: 2452, 2453, 2454, 2455, 2456
- **Size ranges**: Regular (XS-2XL) vs Plus (2XL-5XL) depending on style suffix (SBC vs SBCX)
- **SHIP dates vary**: 25-MAY-26, 22-JUN-26, 13-JUL-26
- **CANCEL dates vary**: 01-JUN-26, 01-JUL-26, 01-AUG-26
- **IN HOUSE dates vary**: "NEED 05/22/26 IN HOUSE", "NEED 06/22/26", "NEED 07/13/26"
- **Price can be 0.00**: PO 2456 has $0.00 for all items (sample/promo PO)
- **Packing**: "FLAT PACK S-2XL 8PREPACK" vs "FLAT PACK 3X-5X 3PC PREPACK"
- **Color codes**: 3-digit code + short name (001 BLACK, 002 CAN, 004 MUSLI, 100 WHITE, 316 PINE, 486 CAR)
- **Multi-line descriptions**: "SUPER BOXY CROP DROP SHOULDER SOLID TEE" can wrap
- **Footer totals**: "Total Items: N", "Total Extn: $$$", "Total Order Qty: N", "Total Pcs: N"

---

## Problems Identified

### A. PDF Parser Failures (Backend: `PdfImportService.php`)

1. **PO Number not parsed** — The PO# is a bare number (2454) without "PO" prefix. Current regex expects "P.O. Number" or "PO-XXXX" patterns.

2. **PO Date not parsed** — PDF uses "ISSUE DATE: 12-FEB-26". Regex only checks "P.O. Date / Order Date / Date". Date format `dd-MMM-yy` (uppercase month abbreviation, 2-digit year) not in `parseDate()`.

3. **Retailer misidentified** — Parser maps `vendor_name` → `retailer_id`. Vendor is the factory (Crystal Apparels India). Actual retailer/buyer is "CUST: CITITRENDS". No regex for CUST/CUSTOMER label.

4. **Country wrongly parsed as "AL"** — "Origin" regex grabs stray text. No explicit "Country of Origin" label. The vendor address has "INDIA" but parser doesn't extract from address blocks.

5. **No line items extracted** — **Root cause: multi-row line item structure.** Each item spans 3-4 lines (main row + color name + SIZE row + QTY row). Current parser expects one row per item. Tokenizer splits on `\s{2,}` which fails on PDF text extraction whitespace.

6. **ETD not parsed** — PDF has "SHIP: 25-MAY-26" but no regex for "SHIP" as date label.

7. **IHD not parsed** — Footer says "NEED 05/22/26 IN HOUSE" but regex only checks "In-Warehouse" / "IHD".

8. **Payment terms not parsed** — PDF has "TERMS: NET 30" but regex only checks "Payment Terms".

9. **Currency not detected** — Prices are bare numbers (3.36). No explicit currency symbol in the table.

10. **Shipping term partially detected** — "DDP" appears standalone (not as "Shipping Term: DDP"), may or may not be caught.

### B. Missing Features in PDF Import Dialog (Frontend)

1. **No "+" buttons** for creating master data on-the-go (retailer, season, currency, payment term, country, warehouse).
2. **No payment_terms_structured support** — Manual PO uses `{ term: code, percentage?: number }` with conditional % field.
3. **No date auto-calculation logic** — No FOB/DDP auto-calculation chain.
4. **No sample schedule auto-generation** — No "Auto-Generate Schedule" button or API call.
5. **Missing fields** — No `packing_guidelines`, `other_terms`.
6. **Backend create endpoint** missing `payment_terms_structured` and `sample_schedule`.

---

## Implementation Plan

### Phase 1: Rewrite PDF Parser (Backend)

**File: `backend/app/Services/PdfImportService.php`**

Complete rewrite of parsing logic to handle the SCI "Master Cut Ticket" format.

#### 1.1 Fix Header Parsing — `parseHeaderSection()`

**PO Number** — Add patterns:
- `/PO\s*#?\s*[:\-]?\s*(\d{3,6})/i` (bare number after "PO#:")
- `/(?:Purchase\s+Order|Cut\s+Ticket).*?(\d{4,6})/i` (number near title)

**PO Date (ISSUE DATE)** — Add patterns:
- `/ISSUE\s*DATE\s*[:\-]?\s*(.+?)(?:\n|$)/i`
- `/(?:Issue|Issued)\s*(?:Date|Dt\.?)\s*[:\-]?\s*(.+?)(?:\n|$)/i`

**Fix `parseDate()`** — Add support for:
- `d-M-y` format (12-FEB-26) — requires ucfirst normalization: `FEB` → `Feb`
- `d-M-Y` format (12-FEB-2026)
- Normalize input: `strtolower()` then `ucfirst()` each word before parsing

**Customer/Retailer** — New extraction:
- `/(?:CUST|CUSTOMER|CLIENT)\s*[:\-]?\s*(.+?)(?:\n|$)/i` → `customer_name` field
- Map `customer_name` → retailer matching (NOT vendor_name)

**ETD Date (SHIP)** — Add patterns:
- `/(?:SHIP|SHIP\s*DATE|SHIPPING\s*DATE)\s*[:\-]?\s*(.+?)(?:\n|$)/i`

**Cancel Date** — New field:
- `/(?:CANCEL|CANCEL\s*DATE|CANCELLATION)\s*[:\-]?\s*(.+?)(?:\n|$)/i`

**In-Warehouse Date (NEED...IN HOUSE)** — Add patterns:
- `/NEED\s*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})\s*IN\s*HOUSE/i`
- `/(?:IN[\s\-]*HOUSE|IN[\s\-]*WAREHOUSE|IHD)\s*(?:DATE)?\s*[:\-]?\s*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/i`

**Payment Terms** — Add patterns:
- `/TERMS\s*[:\-]?\s*(.+?)(?:\n|$)/i`
- Keep existing "Payment Terms" patterns

**Labels / Brand** — New informational field:
- `/LABELS?\s*[:\-]?\s*(.+?)(?:\n|$)/i`

**Shipping Mode** — New informational field:
- `/AIR[\s\/]*SEA\s*[:\-]?\s*(.+?)(?:\n|$)/i`

**Country from vendor address** — Instead of "Country of Origin" label, parse country from the vendor address block by checking the last line for known country names (INDIA, CHINA, BANGLADESH, VIETNAM, etc.).

#### 1.2 Rewrite Line Item Parsing — `parseLineItems()`

**New approach: Multi-row block parsing**

1. Find table header row containing "STYLE" + ("QTY" or "PRICE")
2. After header, scan for **item blocks** — each block is a group of consecutive lines:
   - **Main row**: starts with a style number pattern (alphanumeric, 5+ chars)
   - **Sub-rows**: SIZE >, QTY >, color continuation, Category, PACK info
3. For each block:
   - Extract style number, color code + name from main row
   - Extract description from main row
   - Extract QTY, PRICE EA., EXTN from main row (rightmost numbers)
   - Find "SIZE >" row → extract size labels
   - Find "QTY >" row → extract size quantities → build `size_breakdown`
   - Extract PACK info if present
4. Handle the total/footer row ("Total Items:", "Total Extn:", etc.)

**Key detection patterns:**
- Style number: `/^[A-Z]{2,}[\d]+[A-Z]*/` (e.g., SAT301SBC, SAT301SBCX)
- SIZE row: `/SIZE\s*>/i`
- QTY row: `/QTY\s*>/i`
- Total row: `/^Total\s+(Items|Extn|Order|Pcs)/i`
- PACK info: `/PACK\s*\d+/i`

**Size breakdown construction:**
```php
// From: SIZE > XS  S   M   L   XL  2XL
//       QTY >  300 600 600 600 300 0
// Build: {"XS": 300, "S": 600, "M": 600, "L": 600, "XL": 300, "2XL": 0}
```

#### 1.3 Fix Footer Parsing — `parseFooter()`

Add patterns for this format:
- `/Total\s+Items\s*[:\-]?\s*(\d+)/i`
- `/Total\s+Extn\s*[:\-]?\s*[\$]?\s*([\d,]+\.?\d*)/i`
- `/Total\s+Order\s+Qty\s*[:\-]?\s*([\d,]+)/i`
- `/Total\s+Pcs\s*[:\-]?\s*([\d,]+)/i`

Extract packing instructions from footer area:
- `/FLAT\s+PACK\s+.+?POLYBAG/i`
- `/USE\s+SCI\s+RN#\d+/i`

#### 1.4 Fix `matchMasterData()` — Use customer_name for retailer

```php
// OLD: uses vendor_name → retailer (WRONG)
// NEW: uses customer_name → retailer (CORRECT)
if (isset($parsedHeader['customer_name']) && $parsedHeader['customer_name']['value'] !== null) {
    $matches['retailer_id'] = $this->fuzzyMatchModel(Retailer::class, 'name', $parsedHeader['customer_name']['value']);
}
```

#### 1.5 Fix `parseDate()` — Handle uppercase month abbreviations

```php
private function parseDate(string $dateStr): ?string
{
    // Normalize: "12-FEB-26" → "12-Feb-26"
    $normalized = preg_replace_callback('/[A-Z]{3,}/', function($m) {
        return ucfirst(strtolower($m[0]));
    }, trim($dateStr));

    // Add format: d-M-y (12-Feb-26)
    $formats = ['d-M-y', 'd-M-Y', /* ...existing formats... */];
    // ...
}
```

### Phase 2: Enhance PDF Import Dialog (Frontend)

**File: `frontend/src/components/purchase-orders/PdfImportDialog.tsx`**

#### 2.1 Add "+" buttons for master data creation
For each dropdown (Retailer, Season, Currency, Payment Term, Country, Warehouse):
- Add `<Button>` with `<Plus>` icon next to each `<Select>` (identical pattern to manual PO form)
- Open corresponding Create dialog (reuse `CreateRetailerDialog`, `CreateSeasonDialog`, etc.)
- On success → call `onRefreshMasterData()` prop to refresh dropdowns
- Add state for each dialog open/close

#### 2.2 Add payment terms with structured support
- Replace plain `payment_term_id` Select with:
  - Payment term Select using `code` as value (same as manual PO)
  - Conditional percentage input when `requires_percentage: true`
  - Store as `payment_terms_structured: { term: code, percentage?: number }`

#### 2.3 Add date auto-calculation logic (mirror manual PO creation exactly)
- **FOB**: ETD → Ex-Factory (ETD-7), ETA (ETD+sailing_time_days), IHD (ETA+5)
- **DDP**: IHD → ETD (IHD-transit-5), ETA (ETD+transit)
- Country change → recalculate using `sailing_time_days`
- Shipping term change → switch calculation mode, recalculate
- Auto-calculated fields as disabled/muted inputs

#### 2.4 Add sample schedule auto-generation
- "Auto-Generate Schedule" button
- Call `POST /purchase-orders/sample-schedule` with `po_date` + `etd_date`
- Display 8 milestone dates (Lab Dip, Fit Samples, Trim Approvals, 1st Proto, Bulk Fabric, PP Sample, Production Start, TOP Approval)
- Include in create request

#### 2.5 Add missing fields
- `packing_guidelines` textarea (pre-fill from PDF packing instructions)
- `other_terms` textarea

### Phase 3: Update Backend Create Endpoint

**File: `backend/app/Http/Controllers/Api/PdfImportController.php`**

#### 3.1 Add payment_terms_structured
- Validation: `po_header.payment_terms_structured` (object with `term` + optional `percentage`)
- Same percentage validation as PurchaseOrderController::store()
- Pass to PurchaseOrder::create()

#### 3.2 Add date auto-calculation (server-side fallback)
- Same FOB/DDP logic as PurchaseOrderController::store()

#### 3.3 Add sample_schedule + packing_guidelines
- Accept and validate both fields
- Auto-generate sample_schedule if missing but po_date + etd_date present
- Pass to PurchaseOrder::create()

### Phase 4: Update Types & Integration

**File: `frontend/src/types/index.ts`**
- Add `payment_terms_structured`, `sample_schedule`, `packing_guidelines` to `PdfCreatePORequest`

**File: `frontend/src/app/purchase-orders/page.tsx`**
- Add `onRefreshMasterData` prop wired to `fetchMasterData()`
- Render Create dialogs for PDF import (or share existing instances)

---

## Files to Modify

| # | File | Changes |
|---|------|---------|
| 1 | `backend/app/Services/PdfImportService.php` | Major rewrite: header parsing, multi-row line items, date parsing, customer detection (Phase 1) |
| 2 | `frontend/src/components/purchase-orders/PdfImportDialog.tsx` | Add + buttons, date logic, payment terms, sample schedule, missing fields (Phase 2) |
| 3 | `backend/app/Http/Controllers/Api/PdfImportController.php` | Add payment_terms_structured, date calc, sample_schedule, packing_guidelines (Phase 3) |
| 4 | `frontend/src/types/index.ts` | Update PdfCreatePORequest type (Phase 4) |
| 5 | `frontend/src/app/purchase-orders/page.tsx` | Pass refresh callback, wire create dialogs (Phase 4) |
