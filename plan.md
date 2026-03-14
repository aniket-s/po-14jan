# Plan: PDF Import - Intelligent Field Mapping & Interpretation

## Context
Based on the two sample POs (PO 2497 & 2498 from SPORT CASUAL INTERNATIONAL for BURLINGTON MERCHANDISE), the current system misinterprets several key fields from the PDF. This plan fixes how Claude AI extracts and how the backend/frontend interprets and maps the data.

---

## Key Business Rules (from user)

1. **Retailer** = BURLINGTON MERCHANDISE (CUST field), NOT Crystal Apparels (the vendor)
2. **Agent** = Crystal Apparels India (the vendor in the PDF). If agent doesn't exist, system should offer to create it
3. **Buyer** = SPORT CASUAL INTERNATIONAL (the company issuing the PO). If buyer doesn't exist, system should offer to create it. Use default payment term "7 days before ETA" if buyer is SPORT CASUAL INTERNATIONAL
4. **Cancel Date** = In Warehouse Date (CANCEL field in PDF = 06-JUL-26 / 07-AUG-26)
5. **Packing Guidelines** = "CARTON 24" (from the bottom of the PO)
6. **Additional Notes** should capture: IN HOUSE, REBEL VENGEANCE (labels), PRE-TICKET: No, SAMPLE: Yes
7. **Ship Date** = SHIP field from PDF (06-JUN-26 / 07-JUL-26) → maps to ETD
8. **Shipping Term** = DDP (from TERMS section in PDF header)
9. **Packing Method** = "FLATPACK 1-2-2-1 6PCS IN 1 POLYBAG"

---

## Changes Required

### 1. Backend: Update Claude AI Extraction Prompt
**File:** `backend/app/Services/ClaudePdfImportService.php` → `buildExtractionPrompt()`

**Changes to the prompt:**
- Add `buyer_name` field: "The company name at the top of the document issuing the PO (e.g., SPORT CASUAL INTERNATIONAL)"
- Add `agent_name` field: "The vendor/supplier (e.g., Crystal Apparels India) — this is the sourcing agent"
- Rename/clarify `customer_name`: "The CUST field — this is the retailer (e.g., BURLINGTON MERCHANDISE)"
- Add `cancel_date` field: "CANCEL date — this becomes the In Warehouse Date"
- Add `ship_date` field: "SHIP date — this is the Ship/ETD date"
- Add `labels` field: "The LABELS field (e.g., REBEL VENGEANCE)"
- Add `pre_ticket` field: "PRE-TICKET value (Y or N)"
- Add `sample_required` field: "SAMPLE value (Y or N)"
- Add `carton_info` field: "Carton specification (e.g., CARTON 24)"
- Add `in_house_note` field: "Any IN HOUSE or special notes from the footer"
- Add `packing_instruction` field: "Full packing instruction line (e.g., FLATPACK 1-2-2-1 6PCS IN 1 POLYBAG)"
- Add clear instruction: "IMPORTANT: The company at the top of the document (e.g., SPORT CASUAL INTERNATIONAL) is the buyer. The 'Vendor:' field is the agent/supplier. The 'CUST:' field is the retailer/customer."

### 2. Backend: Update `buildPoHeader()` in ClaudePdfImportService
**File:** `backend/app/Services/ClaudePdfImportService.php`

**Changes:**
- Map `cancel_date` → `in_warehouse_date`
- Map `ship_date` → `etd_date` (primary source for ETD)
- If `etd_date` is null but `ship_date` exists, use `ship_date`
- Pass `buyer_name` as a raw parsed field for frontend display + matching
- Pass `agent_name` as a raw parsed field for frontend display + matching
- Build composite `additional_notes` from: `in_house_note`, `labels` (as "Labels: REBEL VENGEANCE"), `pre_ticket` (as "Pre-Ticket: No/Yes"), `sample_required` (as "Sample: Yes/No"), plus any existing `additional_notes`
- Map `packing_instruction` → `packing_method`
- Map `carton_info` → `packing_guidelines`

### 3. Backend: Update `matchMasterData()` in ClaudePdfImportService
**File:** `backend/app/Services/ClaudePdfImportService.php`

**Changes:**
- Keep existing retailer match from `customer_name` (this is correct — CUST = retailer)
- Add **Buyer matching** from `buyer_name` against the `buyers` table (fuzzy match on `name`)
- Add **Agent matching** from `agent_name` — match against `users` table where role includes 'Agency', matching on `company` or `name` field
- When buyer is matched (e.g., SPORT CASUAL INTERNATIONAL), look up if there's a known default payment term and auto-select it. The system has "7 days before ETA" payment term already created.

### 4. Backend: Add `buyer_id` to PurchaseOrder
**File:** `backend/app/Models/PurchaseOrder.php`

- Add `buyer_id` to `$fillable`
- Add `buyer_id` to `$casts` as integer
- Add `buyer()` relationship: `belongsTo(Buyer::class)`

**New Migration:** `database/migrations/XXXX_add_buyer_id_to_purchase_orders_table.php`
- Add `buyer_id` nullable foreign key referencing `buyers` table

### 5. Backend: Update PdfImportController
**File:** `backend/app/Http/Controllers/Api/PdfImportController.php`

**`create()` method changes:**
- Add `po_header.buyer_id` to validation: `'nullable|exists:buyers,id'`
- Pass `buyer_id` to `PurchaseOrder::create()`

### 6. Frontend: Update PdfImportDialog
**File:** `frontend/src/components/purchase-orders/PdfImportDialog.tsx`

**Changes:**
- **Add Buyer dropdown** in Master Data section with + button (CreateBuyerDialog)
- **Add Agent display** — show agent name extracted from PDF. Since agents are Users with "Agency" role, show a select of agencies or display the extracted name as info
- **Initialize `packing_guidelines`** from `ph.packing_guidelines?.value` (currently hardcoded to `''`)
- **Initialize `additional_notes`** from `ph.additional_notes?.value` (currently reads from parsed data but may need composite)
- **Initialize `packing_method`** from parsed data
- **Initialize `in_warehouse_date`** from parsed cancel_date mapping
- **Show buyer/agent info** in the "Extracted Reference Info" card instead of just vendor/buyer
- **Add buyer_id to the create request** (`PdfCreatePORequest`)
- **Auto-select payment term** when buyer is matched and has a default payment term

### 7. Frontend: Update Types
**File:** `frontend/src/types/index.ts`

- Add `buyer_id?: number | null` to `PdfCreatePORequest.po_header`

### 8. Frontend: Pass Buyers to Dialog
**File:** `frontend/src/app/purchase-orders/page.tsx`

- Fetch buyers list in `fetchMasterData()`
- Pass `buyers` in `masterData` prop to PdfImportDialog

### 9. Frontend: CreateBuyerDialog (if doesn't exist)
Check if `CreateBuyerDialog.tsx` exists. If not, create one similar to `CreateRetailerDialog` for inline buyer creation during PDF import.

---

## Field Mapping Summary (PDF → System)

| PDF Field | System Field | Notes |
|---|---|---|
| Company at top (SPORT CASUAL INTERNATIONAL) | `buyer_id` | New field on PO |
| CUST (BURLINGTON MERCHANDISE) | `retailer_id` | Already works via customer_name |
| Vendor (Crystal Apparels India) | `agency_id` | Match against Users with Agency role |
| SHIP date (06-JUN-26) | `etd_date` | Ship date = ETD |
| CANCEL date (06-JUL-26) | `in_warehouse_date` | Cancel = In Warehouse Date |
| ISSUE DATE (08-MAR-26) | `po_date` | Already works |
| TERMS (NET 30) + DDP | `shipping_term` = DDP | Parse DDP from terms |
| FLATPACK 1-2-2-1 6PCS IN 1 POLYBAG | `packing_method` | Packing instruction |
| CARTON 24 | `packing_guidelines` | Carton spec |
| IN HOUSE | `additional_notes` | Appended |
| LABELS (REBEL VENGEANCE) | `additional_notes` | "Labels: REBEL VENGEANCE" |
| PRE-TICKET (N) | `additional_notes` | "Pre-Ticket: No" |
| SAMPLE (Y) | `additional_notes` | "Sample: Yes" |
| Total Extn | `total_value` | Already works |
| Total Order Qty | `total_quantity` | Already works |

---

## Files Modified

| # | File | Changes |
|---|------|---------|
| 1 | `backend/app/Services/ClaudePdfImportService.php` | Update prompt, buildPoHeader, matchMasterData |
| 2 | `backend/app/Models/PurchaseOrder.php` | Add buyer_id, buyer() relationship |
| 3 | `backend/database/migrations/XXXX_add_buyer_id_to_purchase_orders.php` | New migration |
| 4 | `backend/app/Http/Controllers/Api/PdfImportController.php` | Accept buyer_id |
| 5 | `frontend/src/components/purchase-orders/PdfImportDialog.tsx` | Add Buyer dropdown, Agent info, fix field init |
| 6 | `frontend/src/types/index.ts` | Add buyer_id type |
| 7 | `frontend/src/app/purchase-orders/page.tsx` | Pass buyers to dialog |
| 8 | `frontend/src/components/master-data/CreateBuyerDialog.tsx` | New inline create dialog (if needed) |
