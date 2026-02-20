# PDF Import Feature - Comprehensive Fix & Enhancement Plan

## Problems Identified

### A. PDF Parser Failures (Backend: `PdfImportService.php`)

1. **PO Date not parsed** — Regex only looks for "P.O. Date / Order Date / Date" but this PDF uses **"ISSUE DATE"**. Also the date format `12-FEB-26` (dd-MMM-yy uppercase) isn't in `parseDate()`.

2. **Retailer misidentified** — The parser maps `vendor_name` → `retailer_id`, but in this PDF the vendor is the factory (Crystal Apparels India). The actual retailer/buyer is under **"CUST"** (CITITRENDS). There's no regex for CUST/CUSTOMER.

3. **Country wrongly parsed as "AL"** — The "Origin" regex grabs stray text. The PDF has "INDIA" in the vendor address but no explicit "Country of Origin" label. "AL" is likely a fragment from PDF text extraction.

4. **No line items extracted** — The table header detection works (STYLE + PRICE columns exist), but `parseLineItemRow()` splits on `\s{2,}` (2+ spaces). The PDF text extraction may use single spaces or inconsistent whitespace. Also the table has 15+ columns which is hard to tokenize.

5. **Currency not detected** — Prices are bare numbers ($3.36). The `$` symbol regex should catch it but depends on PDF text extraction.

6. **SHIP date / CANCEL date** — PDF has "SHIP: 25-MAY-26" and "CANCEL: 01-JUN-26" that map to ETD and cancel. No regex for "SHIP" as date label.

7. **IN HOUSE date** — Footer says "NEED 05/22/26 IN HOUSE". Current regex looks for "In-Warehouse" or "IHD" but not "NEED ... IN HOUSE".

8. **TERMS: NET 30** — Current regex looks for "Payment Terms" but not just "TERMS".

### B. Missing Features in PDF Import Dialog (Frontend: `PdfImportDialog.tsx`)

1. **No "+" buttons** for creating master data on-the-go (retailer, season, currency, payment term, country, warehouse). The manual PO creation modal has these for every dropdown.

2. **No payment_terms_structured support** — Manual PO creation uses `{ term: code, percentage?: number }` structure with conditional percentage field. PDF import only sends `payment_term_id`.

3. **No date auto-calculation logic** — Manual PO creation has:
   - **FOB mode**: ETD → auto-calculates Ex-Factory (ETD-7), ETA (ETD+sailing), IHD (ETA+5)
   - **DDP mode**: IHD → auto-calculates ETD (IHD-transit-5), ETA (ETD+transit)
   - Country selection triggers recalculation using `sailing_time_days`
   PDF import dialog has none of this.

4. **No sample schedule auto-generation** — Manual PO creation has "Auto-Generate Schedule" button calling `/purchase-orders/sample-schedule` API. PDF import doesn't generate or send `sample_schedule`.

5. **Missing fields** — No `packing_guidelines`, `other_terms`, or general `notes` fields.

6. **No `payment_terms_structured` in create request** — Backend controller doesn't handle it.

---

## Implementation Plan

### Phase 1: Fix PDF Parser (Backend)

**File: `backend/app/Services/PdfImportService.php`**

#### 1.1 Expand PO Date extraction
- Add "ISSUE DATE", "ISSUE DT", "SHIP DATE" to regex patterns for po_date
- Add "SHIP:" pattern → maps to `etd_date`
- Add "CANCEL:" pattern → maps to `cancel_date` (informational)
- Add date formats to `parseDate()`: `d-M-y` (12-FEB-26), plus ucfirst normalization for month abbreviations (FEB→Feb)

#### 1.2 Fix retailer/customer detection
- Add extraction for "CUST" / "CUSTOMER" / "CLIENT" / "BUYER" label → new `customer_name` field
- In `matchMasterData()`, use `customer_name` for retailer matching (not `vendor_name`)
- Keep `vendor_name` as informational display only

#### 1.3 Improve country extraction
- Reject 2-letter US state abbreviations (FL, NJ, AL, etc.)
- Parse country from vendor address block (look for known country names: INDIA, CHINA, BANGLADESH, etc.)
- Only match against Country records in DB, not arbitrary text

#### 1.4 Fix line item parsing
- Change tokenizer fallback: split on `\s{1,}|\t` (1+ spaces) if 2+ space split yields too few tokens
- Add position-based parsing: detect column positions from header row, then extract each data row by positions
- Parse "TTL QTY" alongside "QTY"/"QUANTITY"
- Parse "EXTN"/"EXT" alongside "AMOUNT"/"TOTAL"
- Handle rows where same style appears multiple times with different colors (group by STYLE column)

#### 1.5 Add more field extractions
- "SHIP: date" → `etd_date`
- "CANCEL: date" → `cancel_date`
- "NEED date IN HOUSE" or "IN HOUSE" → `in_warehouse_date`
- "TERMS: NET 30" → `payment_terms_raw`
- "LABELS: ..." → informational
- "AIR/SEA: SEA" → shipping mode info

### Phase 2: Enhance PDF Import Dialog (Frontend)

**File: `frontend/src/components/purchase-orders/PdfImportDialog.tsx`**

#### 2.1 Add "+" buttons for master data creation
For each dropdown (Retailer, Season, Currency, Payment Term, Country, Warehouse):
- Add `<Button>` with `<Plus>` icon next to each `<Select>` (same pattern as manual PO create form)
- Open corresponding Create dialog (reuse existing `CreateRetailerDialog`, `CreateSeasonDialog`, etc.)
- On create success, call `onRefreshMasterData()` prop to refresh dropdowns
- Add state variables for each create dialog open state

#### 2.2 Add payment terms with structured support
- Replace plain `payment_term_id` Select with:
  - Payment term Select using `code` as value (same as manual PO)
  - Conditional percentage input when `requires_percentage: true`
  - Store as `payment_terms_structured: { term: code, percentage?: number }`
- Update `PdfCreatePORequest` type

#### 2.3 Add date auto-calculation logic (mirror manual PO creation)
- **FOB**: ETD input → auto-fill Ex-Factory (ETD-7), ETA (ETD+sailing_time_days), IHD (ETA+5)
- **DDP**: IHD input → auto-fill ETD (IHD-transit-5), ETA (ETD+transit)
- When shipping_term changes → recalculate
- When country changes → recalculate (get `sailing_time_days` from countries list)
- Auto-calculated fields shown as disabled/muted

#### 2.4 Add sample schedule auto-generation
- Add "Auto-Generate Schedule" button in review-header step
- Call `POST /purchase-orders/sample-schedule` with `po_date` and `etd_date`
- Display 8 milestone dates in disabled fields (same as manual PO)
- Include `sample_schedule` in the create request

#### 2.5 Add missing fields
- Add `packing_guidelines` textarea
- Add `other_terms` textarea

### Phase 3: Update Backend Create Endpoint

**File: `backend/app/Http/Controllers/Api/PdfImportController.php`**

#### 3.1 Add payment_terms_structured handling
- Validation for `po_header.payment_terms_structured` (term + optional percentage)
- Percentage validation when `requires_percentage` is true (same as PurchaseOrderController::store)
- Pass to `PurchaseOrder::create()`

#### 3.2 Add date auto-calculation on backend
- Same FOB/DDP date calculation logic as `PurchaseOrderController::store()`
- Fallback server-side calculation if frontend didn't compute

#### 3.3 Add sample_schedule + packing_guidelines
- Accept `po_header.sample_schedule`, `po_header.packing_guidelines` in validation
- Pass to `PurchaseOrder::create()`
- Auto-generate sample_schedule if not provided but po_date + etd_date present

### Phase 4: Update Types & Integration

**File: `frontend/src/types/index.ts`**
- Add `payment_terms_structured`, `sample_schedule`, `packing_guidelines`, `notes` to `PdfCreatePORequest.po_header`

**File: `frontend/src/app/purchase-orders/page.tsx`**
- Add `onRefreshMasterData` prop to `PdfImportDialog` wired to `fetchMasterData()`
- Add instances of all Create dialogs for PDF import usage (or share the existing ones)

---

## Files to Modify

| # | File | Changes |
|---|------|---------|
| 1 | `backend/app/Services/PdfImportService.php` | Major rewrite of parsing logic (Phase 1) |
| 2 | `frontend/src/components/purchase-orders/PdfImportDialog.tsx` | Add + buttons, date logic, payment terms, sample schedule (Phase 2) |
| 3 | `backend/app/Http/Controllers/Api/PdfImportController.php` | Add payment_terms_structured, date calc, sample_schedule (Phase 3) |
| 4 | `frontend/src/types/index.ts` | Update PdfCreatePORequest type (Phase 4) |
| 5 | `frontend/src/app/purchase-orders/page.tsx` | Pass refresh callback, wire create dialogs (Phase 4) |
