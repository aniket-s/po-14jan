<?php

namespace App\Services;

use App\Models\Buyer;
use App\Models\Country;
use App\Models\Currency;
use App\Models\PaymentTerm;
use App\Models\Retailer;
use App\Models\Season;
use App\Models\Style;
use App\Models\User;
use App\Models\Warehouse;
use Illuminate\Support\Facades\Log;

class ClaudePdfImportService
{
    private ClaudeApiService $claudeApi;

    public function __construct(ClaudeApiService $claudeApi)
    {
        $this->claudeApi = $claudeApi;
    }

    /**
     * Analyze a PDF purchase order file using Claude AI and extract structured data.
     */
    public function analyzePdf(string $filePath): array
    {
        try {
            // Read and encode the PDF file
            if (!file_exists($filePath)) {
                return [
                    'success' => false,
                    'error' => 'PDF file not found at the specified path.',
                ];
            }

            $fileSize = filesize($filePath);
            if ($fileSize > 32 * 1024 * 1024) {
                return [
                    'success' => false,
                    'error' => 'PDF file exceeds the 32MB limit.',
                ];
            }

            $pdfBase64 = base64_encode(file_get_contents($filePath));
            $prompt = $this->buildExtractionPrompt();

            // Call Claude API
            $result = $this->claudeApi->analyzePdf($pdfBase64, $prompt);

            if (!$result['success']) {
                return [
                    'success' => false,
                    'error' => $result['error'] ?? 'Claude API request failed.',
                ];
            }

            // Parse the JSON response from Claude
            $parsedData = $this->parseClaudeResponse($result['content']);

            if ($parsedData === null) {
                return [
                    'success' => false,
                    'error' => 'Failed to parse structured data from Claude response.',
                ];
            }

            // Build the response in the format expected by the frontend
            $poHeader = $this->buildPoHeader($parsedData);
            $lineItems = $this->buildLineItems($parsedData);

            // If Claude missed the shipping term, fall back to a regex scan over
            // the layout-preserved raw text. Claude occasionally returns null on
            // compact SCI-style header rows where the Incoterm (e.g. "DDP")
            // sits between two column labels without an explicit "TERMS:" prefix.
            $this->backfillShippingTermFromRawText($filePath, $poHeader);

            // Match against master data (retailers, seasons, currencies, etc.)
            $masterDataMatches = $this->matchMasterData($poHeader);
            foreach ($masterDataMatches as $field => $match) {
                $poHeader[$field] = $match;
            }

            // Calculate totals
            $calculatedQty = 0;
            $calculatedValue = 0;
            foreach ($lineItems as $item) {
                $qty = $item['quantity']['value'] ?? 0;
                $price = $item['unit_price']['value'] ?? 0;
                $calculatedQty += $qty;
                $calculatedValue += $qty * $price;
            }

            $pdfTotalQty = $parsedData['totals']['total_quantity'] ?? 0;
            $pdfTotalValue = $parsedData['totals']['total_value'] ?? 0;

            $totalQty = $pdfTotalQty > 0 ? $pdfTotalQty : $calculatedQty;
            $totalValue = $pdfTotalValue > 0 ? $pdfTotalValue : $calculatedValue;

            // Build warnings
            $warnings = [];

            $requiredFields = ['po_number', 'po_date'];
            foreach ($requiredFields as $field) {
                if (!isset($poHeader[$field]) || $poHeader[$field]['value'] === null) {
                    $warnings[] = ucfirst(str_replace('_', ' ', $field)) . ' could not be identified - please fill in manually';
                }
            }

            foreach (['retailer_id', 'buyer_id', 'agency_id', 'season_id', 'currency_id', 'payment_term_id', 'country_id', 'warehouse_id'] as $field) {
                if (isset($poHeader[$field]) && $poHeader[$field]['status'] === 'unrecognized') {
                    $rawText = $poHeader[$field]['raw_text'] ?? 'Unknown';
                    $label = ucfirst(str_replace('_id', '', str_replace('_', ' ', $field)));
                    $warnings[] = "{$label} '{$rawText}' not found in system - please select manually";
                }
            }

            if (empty($lineItems)) {
                $warnings[] = 'No line items (styles) could be extracted from the PDF';
            }

            // Check for styles with zero price
            $zeroPriceStyles = [];
            foreach ($lineItems as $item) {
                if (($item['unit_price']['value'] ?? 0) == 0) {
                    $zeroPriceStyles[] = $item['style_number']['value'] ?? 'Unknown';
                }
            }
            if (!empty($zeroPriceStyles)) {
                $styleList = implode(', ', array_slice($zeroPriceStyles, 0, 5));
                $more = count($zeroPriceStyles) > 5 ? ' and ' . (count($zeroPriceStyles) - 5) . ' more' : '';
                $warnings[] = "Price is \$0.00 for style(s): {$styleList}{$more} - please fill the price manually";
            }

            // Check for duplicate style number + color combinations
            $styleKeys = array_map(function ($item) {
                $sn = strtoupper(trim($item['style_number']['value'] ?? ''));
                $color = strtoupper(trim($item['color']['value'] ?? ''));
                return $color ? "{$sn} / {$color}" : $sn;
            }, $lineItems);
            $duplicates = array_unique(array_diff_assoc($styleKeys, array_unique($styleKeys)));
            if (!empty($duplicates)) {
                $warnings[] = 'Duplicate style/color combination(s) found: ' . implode(', ', array_unique($duplicates)) . ' - please review';
            }

            // Cross-validate totals
            if ($totalQty > 0 && $calculatedQty > 0 && abs($totalQty - $calculatedQty) >= 2) {
                $warnings[] = "PDF total quantity ({$totalQty}) differs from calculated sum ({$calculatedQty}) - please verify";
            }
            if ($totalValue > 0 && $calculatedValue > 0 && abs($totalValue - $calculatedValue) > 0.01) {
                $diff = round(abs($totalValue - $calculatedValue), 2);
                $warnings[] = "PDF total value (\${$totalValue}) differs from calculated sum (\${$calculatedValue}) by \${$diff} - please verify";
            }

            // Log token usage for cost tracking
            if ($result['usage']) {
                Log::info('Claude PDF analysis token usage', [
                    'input_tokens' => $result['usage']['input_tokens'] ?? 0,
                    'output_tokens' => $result['usage']['output_tokens'] ?? 0,
                ]);
            }

            return [
                'success' => true,
                'po_header' => $poHeader,
                'styles' => $lineItems,
                'totals' => [
                    'total_quantity' => $totalQty,
                    'total_value' => round($totalValue, 2),
                    'calculated_quantity' => $calculatedQty,
                    'calculated_value' => round($calculatedValue, 2),
                    'validation_passed' => abs($totalQty - $calculatedQty) < 2 || $totalQty == 0,
                ],
                'warnings' => $warnings,
                'errors' => [],
                'raw_text' => 'PDF analyzed using Claude AI (' . config('services.anthropic.model') . ')',
                'ai_usage' => $result['usage'],
            ];
        } catch (\Exception $e) {
            Log::error('Claude PDF analysis failed: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString(),
            ]);
            return [
                'success' => false,
                'error' => 'Failed to analyze PDF: ' . $e->getMessage(),
            ];
        }
    }

    /**
     * Build the extraction prompt that instructs Claude to extract structured PO data.
     */
    private function buildExtractionPrompt(): string
    {
        return <<<'PROMPT'
You are a purchase order (PO) data extraction specialist. Analyze this PDF document and extract ALL purchase order data into a structured JSON format.

IMPORTANT - Understanding the document structure:
- The **buyer** is the company issuing the PO (usually shown prominently at the top, e.g., "SPORT CASUAL INTERNATIONAL"). This is the buying/sourcing company.
- The **customer/retailer** is found in the "CUST" or "CUSTOMER" field (e.g., "BURLINGTON MERCHANDISE"). This is the end retailer the goods are destined for.
- The **vendor/agent** is found in the "Vendor:" section (e.g., "Crystal Apparels India"). This is the sourcing agent or supplier.
- These are three DISTINCT entities - do not confuse them.

Extract the following information:

1. **PO Header** - All header/metadata fields
2. **Line Items** - Every style/product row with full details
3. **Totals** - Summary totals from the document footer

Return ONLY valid JSON (no markdown, no explanation, no code blocks) in this exact structure:

{
  "po_header": {
    "po_number": "string or null",
    "po_date": "YYYY-MM-DD or null (ISSUE DATE field)",
    "revision_number": "integer or null",
    "revision_date": "YYYY-MM-DD or null",
    "buyer_name": "string or null (the company issuing the PO, shown at the top of the document, e.g. SPORT CASUAL INTERNATIONAL)",
    "vendor_name": "string or null (the Vendor/supplier/agent company, e.g. Crystal Apparels India)",
    "vendor_address": "string or null",
    "customer_name": "string or null (the CUST/CUSTOMER field - this is the retailer, e.g. BURLINGTON MERCHANDISE)",
    "customer_address": "string or null",
    "ship_to": "string or null (destination warehouse/location name)",
    "ship_to_address": "string or null (full ship-to address)",
    "country_of_origin": "string or null (manufacturing/vendor country, e.g. INDIA from vendor address)",
    "currency": "string or null (e.g. USD, INR, EUR)",
    "payment_terms": "string or null (e.g. NET 30, LC at sight - from TERMS field)",
    "shipping_term": "string or null (e.g. FOB, DDP, CIF, CFR, EXW - often appears near TERMS)",
    "ship_date": "YYYY-MM-DD or null (the SHIP date field - this is the shipping/ETD date)",
    "cancel_date": "YYYY-MM-DD or null (the CANCEL date field - this is the in-warehouse/cancel date)",
    "etd_date": "YYYY-MM-DD or null (estimated time of departure, if explicitly labeled ETD)",
    "ex_factory_date": "YYYY-MM-DD or null",
    "eta_date": "YYYY-MM-DD or null (estimated time of arrival)",
    "season": "string or null (e.g. SS25, AW24, Spring 2025)",
    "labels": "string or null (the LABELS field, e.g. REBEL VENGEANCE, SAINT ARCHIVES)",
    "pre_ticket": "string or null (PRE-TICKET field value: Y or N)",
    "sample_required": "string or null (SAMPLE field value: Y or N)",
    "packing_method": "string or null (packing instruction line, e.g. FLATPACK 1-2-2-1 6PCS IN 1 POLYBAG)",
    "carton_info": "string or null (carton specification, e.g. CARTON 24)",
    "packing_guidelines": "string or null (other packing guidelines)",
    "in_house_note": "string or null (any IN HOUSE or special delivery notes)",
    "additional_notes": "string or null (any other terms, conditions, notes)",
    "headline": "string or null (brief PO title/description if visible)"
  },
  "line_items": [
    {
      "style_number": "string (the style/item/SKU number - REQUIRED)",
      "description": "string or null (item/product description)",
      "color_name": "string or null",
      "hsn_code": "string or null",
      "fabric": "string or null",
      "size_breakdown": {"S": 10, "M": 20, "L": 15} or null,
      "quantity": "integer (total quantity - REQUIRED)",
      "unit_price": "number (price per unit - REQUIRED, use 0 if not found)",
      "total_amount": "number or null (quantity x unit_price)"
    }
  ],
  "totals": {
    "total_quantity": "integer or 0",
    "total_value": "number or 0 (grand total amount before tax)",
    "tax_amount": "number or 0",
    "grand_total": "number or 0 (total including tax)"
  }
}

CRITICAL TABLE PARSING RULES:
Many POs use a table layout like this (example):

  STYLE    COLOR      Ln  WH       DESCRIPTION              QTY   PRICE EA.   EXTN
  RLC442   100 WHITE  1   FE       SAINT HD THERMAL         3600  3.15        11,340.00
           WHITE                    Category :                               PACK 6
  SIZE >   XS     S       M        L         XL      2XL
  QTY >           600    1200    1200     600

In this example, the QTY > row has only 4 values but SIZE > row has 6 sizes. The quantities align RIGHT-TO-LEFT with the sizes: S=600, M=1200, L=1200, XL=600. XS and 2XL have NO quantity - they must NOT appear in size_breakdown.

- The STYLE column (RLC442, RLC443, etc.) is the style_number - it is an alphanumeric code, NOT a color word.
- The COLOR column (WHITE, SLATE, PINE, BLACK) is the color_name - do NOT use this as the style_number.
- The QTY column on the same row as the style (e.g., 3600) is the TOTAL quantity. Do NOT double count by also summing the size breakdown row.
- PRICE EA. column (e.g., 3.15) is the unit_price. Always extract this value.
- EXTN column is the total_amount (quantity × price).
- The SIZE > and QTY > rows below each style show the size breakdown. CAREFULLY align each quantity value with its corresponding size column. If there are fewer quantity values than size labels, the missing sizes have ZERO quantity and must NOT be included. The sum of size quantities MUST equal the total quantity for that line item.
- Each style block occupies multiple rows: header row (style, color, qty, price), category row, size label row, size quantity row.

IMPORTANT RULES:
- Extract ALL line items/styles from the document - do not skip any rows
- For style_number: Use the STYLE/Style#/Item/SKU/Article column value (an alphanumeric code like RLC442, NOT a color name like WHITE or BLACK). If you see both a code and a color, the code is the style_number and the color is the color_name.
- For quantity: Use the QTY column value from the style header row. Do NOT sum it again from the size breakdown - the size breakdown is just the detail of how that total breaks down by size.
- For unit_price: Use the PRICE EA./Rate/Price/Unit Price/FOB/Cost column. This is REQUIRED - look carefully for it. Use 0 only if truly not present.
- For dates: always convert to YYYY-MM-DD format regardless of the original format (e.g. 06-JUN-26 → 2026-06-06, 08-MAR-26 → 2026-03-08)
- For size_breakdown: extract individual size quantities from the QTY > row. ONLY include sizes that have an explicit non-zero quantity value. If there are fewer QTY values than SIZE labels, map them carefully by column position - do NOT blindly assign from left to right. Sizes with no corresponding quantity (e.g., XS and 2XL when only S/M/L/XL have values) must be EXCLUDED entirely. The sum MUST equal the total quantity. Do NOT create a second line item from the size breakdown.
- For buyer_name: Look at the prominent company name at the top of the document (NOT the vendor, NOT the customer). This is the buying house/sourcing company.
- For customer_name: Look for "CUST:", "CUSTOMER:", or "CLIENT:" label. This is the retailer.
- For vendor_name: Look for "Vendor:" label. This is the agent/supplier.
- For ship_date: Look for "SHIP:", "SHIP DATE:", "SHIPPING DATE:" labels. This represents when goods should ship (ETD).
- For cancel_date: Look for "CANCEL:", "CANCEL DATE:", "CANCELLATION:" labels. This represents the latest acceptable delivery date (in-warehouse date).
- For shipping_term: Return ONLY the Incoterm abbreviation (FOB, DDP, CIF, CFR, EXW, FCA, DAP, or CIP). Look under "TERMS", "SHIP TERMS", "DELIVERY TERMS", "INCOTERM" — on SCI cut tickets the Incoterm sits directly between the "TERMS" and "SHIP MODE" column headers (e.g. a standalone "DDP" in that column). Do NOT include surrounding words such as "Terms:" or "(Delivered Duty Paid)".
- For labels: Look for "LABELS:", "LABEL:" fields (brand/label info).
- For pre_ticket: Look for "PRE-TICKET:" field (Y/N).
- For sample_required: Look for "SAMPLE:" field (Y/N).
- For packing_method: Look for packing instructions like "FLATPACK...", "FLAT PACK...", "PREPACK..." usually near the footer.
- For carton_info: Look for "CARTON" followed by a number (e.g., "CARTON 24").
- For in_house_note: Look for "IN HOUSE" notes or similar delivery notes in the footer area.
- If a field is not present in the document, use null - do not guess
- Return ONLY the JSON object, nothing else
PROMPT;
    }

    /**
     * Parse Claude's text response into structured data.
     */
    private function parseClaudeResponse(?string $content): ?array
    {
        if (empty($content)) {
            return null;
        }

        // Remove markdown code blocks if Claude wrapped the response
        $content = trim($content);
        $content = preg_replace('/^```(?:json)?\s*/i', '', $content);
        $content = preg_replace('/\s*```$/', '', $content);
        $content = trim($content);

        // Remove any BOM or invisible control characters that break JSON parsing
        $content = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F]/', '', $content);

        $parsed = json_decode($content, true);
        $parseError = json_last_error();

        if ($parseError !== JSON_ERROR_NONE) {
            $errorMsg = json_last_error_msg();

            // Find the approximate position of the JSON error
            $errorPos = $this->findJsonErrorPosition($content);

            Log::warning('Initial JSON parse failed, attempting repair', [
                'error' => $errorMsg,
                'content_length' => strlen($content),
                'content_tail' => substr($content, -200),
                'error_context' => $errorPos !== null ? substr($content, max(0, $errorPos - 50), 100) : 'unknown',
            ]);

            // Try sanitizing common JSON issues before structural repair
            $sanitized = $content;
            // Fix trailing commas before } or ]
            $sanitized = preg_replace('/,\s*([\]}])/', '$1', $sanitized);
            // Fix NaN/Infinity which aren't valid JSON
            $sanitized = preg_replace('/:\s*NaN\b/', ': 0', $sanitized);
            $sanitized = preg_replace('/:\s*Infinity\b/', ': 0', $sanitized);
            // Fix single quotes used instead of double quotes
            // (only if there are no double quotes in the content - rare edge case)

            $parsed = json_decode($sanitized, true);
            $parseError = json_last_error();
            if ($parseError === JSON_ERROR_NONE) {
                Log::info('JSON fixed by sanitization (trailing commas, etc.)');
                $content = $sanitized;
            }

            // If sanitization didn't help, try structural repair
            if ($parseError !== JSON_ERROR_NONE) {
                $repaired = $this->repairTruncatedJson($sanitized);
            } else {
                $repaired = null;
            }
            if ($repaired !== null) {
                $parsed = json_decode($repaired, true);
                $parseError = json_last_error();
                if ($parseError === JSON_ERROR_NONE) {
                    Log::info('Successfully repaired truncated JSON response');
                } else {
                    $repairErrorMsg = json_last_error_msg();
                    Log::error('JSON repair failed', [
                        'error' => $repairErrorMsg,
                        'repaired_tail' => substr($repaired, -300),
                    ]);
                }
            }

            if ($parseError !== JSON_ERROR_NONE) {
                Log::error('Failed to parse Claude JSON response even after repair', [
                    'content_preview' => substr($content, 0, 500),
                    'content_tail' => substr($content, -300),
                ]);
                return null;
            }
        }

        // Validate minimum required structure
        if (!is_array($parsed) || !isset($parsed['po_header']) || !isset($parsed['line_items'])) {
            Log::error('Claude response missing required fields', [
                'keys' => is_array($parsed) ? array_keys($parsed) : 'not an array',
            ]);
            return null;
        }

        return $parsed;
    }

    /**
     * Find the approximate byte position where a JSON parse error occurs
     * by binary-searching for the longest valid JSON prefix.
     */
    private function findJsonErrorPosition(string $json): ?int
    {
        $len = strlen($json);
        // Try parsing progressively longer prefixes
        $lo = 0;
        $hi = $len;
        while ($lo < $hi - 1) {
            $mid = intdiv($lo + $hi, 2);
            $prefix = substr($json, 0, $mid);
            // Close any open structures minimally to test
            json_decode($prefix . ']}', true);
            if (json_last_error() === JSON_ERROR_NONE) {
                $lo = $mid;
            } else {
                // Could be just truncation, try with more closings
                json_decode($prefix . '"]}]}]}', true);
                if (json_last_error() === JSON_ERROR_NONE) {
                    $lo = $mid;
                } else {
                    $hi = $mid;
                }
            }
        }
        return $hi < $len ? $hi : null;
    }

    /**
     * Attempt to repair truncated JSON by closing unclosed brackets, braces, and strings.
     */
    private function repairTruncatedJson(string $json): ?string
    {
        // First, find the last complete JSON value by walking backwards
        // to find the last properly closed string, number, null, true, false, }, or ]
        $trimmed = rtrim($json);

        // Remove trailing incomplete content until we find a valid JSON ending character
        // Valid endings: "...", number, null, true, false, }, ]
        while (strlen($trimmed) > 0) {
            $lastChar = substr($trimmed, -1);
            if (in_array($lastChar, ['"', '}', ']', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'l', 'e'])) {
                // Check if this is a valid ending
                // For 'l' -> null, for 'e' -> true/false
                if ($lastChar === 'l' && preg_match('/null$/', $trimmed)) break;
                if ($lastChar === 'e' && preg_match('/(true|false)$/', $trimmed)) break;
                if (in_array($lastChar, ['"', '}', ']', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'])) break;
            }
            $trimmed = substr($trimmed, 0, -1);
            $trimmed = rtrim($trimmed);
        }

        // Remove trailing comma if present
        $trimmed = preg_replace('/,\s*$/', '', $trimmed);

        $json = $trimmed;

        // Track open brackets/braces
        $stack = [];
        $inString = false;
        $escape = false;
        $len = strlen($json);

        for ($i = 0; $i < $len; $i++) {
            $char = $json[$i];

            if ($escape) {
                $escape = false;
                continue;
            }

            if ($char === '\\' && $inString) {
                $escape = true;
                continue;
            }

            if ($char === '"') {
                $inString = !$inString;
                continue;
            }

            if ($inString) {
                continue;
            }

            if ($char === '{' || $char === '[') {
                $stack[] = $char;
            } elseif ($char === '}') {
                if (!empty($stack) && end($stack) === '{') {
                    array_pop($stack);
                }
            } elseif ($char === ']') {
                if (!empty($stack) && end($stack) === '[') {
                    array_pop($stack);
                }
            }
        }

        // If we're inside a string, close it
        if ($inString) {
            $json .= '"';
        }

        // Close all unclosed brackets/braces in reverse order
        while (!empty($stack)) {
            $open = array_pop($stack);
            $json .= ($open === '{') ? '}' : ']';
        }

        return $json;
    }

    /**
     * Last-resort regex scan over the layout-preserved raw PDF text to
     * populate shipping_term when Claude could not identify it. Mutates
     * the supplied $poHeader by reference.
     */
    private function backfillShippingTermFromRawText(string $filePath, array &$poHeader): void
    {
        $current = $poHeader['shipping_term']['value'] ?? null;
        if ($current !== null) {
            return;
        }

        try {
            $rawText = app(PdfImportService::class)->extractTextPreservingLayout($filePath);
        } catch (\Throwable $e) {
            Log::warning('Shipping-term backfill: raw text extraction failed', [
                'error' => $e->getMessage(),
            ]);
            return;
        }

        if (!is_string($rawText) || $rawText === '') {
            return;
        }

        if (preg_match('/\b(FOB|DDP|CIF|CFR|EXW|FCA|DAP|CIP)\b/i', $rawText, $m)) {
            $poHeader['shipping_term'] = [
                'value' => strtoupper($m[1]),
                'status' => 'parsed',
                'confidence' => 'medium',
            ];
        }
    }

    /**
     * Build the PO header in the PdfParsedField format expected by the frontend.
     */
    private function buildPoHeader(array $parsedData): array
    {
        $header = $parsedData['po_header'] ?? [];
        $result = [];

        // Map ship_date → etd_date if etd_date is not explicitly set.
        // Fall back to cancel_date when neither ETD nor SHIP is present (common
        // in SCI-style POs that only carry ISSUE DATE + CANCEL) so the user
        // sees a workable date and the sample schedule can auto-generate.
        $etdDate = $header['etd_date'] ?? null;
        if ($etdDate === null && isset($header['ship_date'])) {
            $etdDate = $header['ship_date'];
        }
        if ($etdDate === null && isset($header['cancel_date'])) {
            $etdDate = $header['cancel_date'];
        }
        $header['etd_date'] = $etdDate;

        // Map cancel_date → in_warehouse_date
        $inWarehouseDate = $header['in_warehouse_date'] ?? null;
        if ($inWarehouseDate === null && isset($header['cancel_date'])) {
            $inWarehouseDate = $header['cancel_date'];
        }
        $header['in_warehouse_date'] = $inWarehouseDate;

        // Build composite packing_method from packing_method field
        $packingMethod = $header['packing_method'] ?? null;

        // Build packing_guidelines from carton_info
        $packingGuidelines = $header['packing_guidelines'] ?? null;
        if ($packingGuidelines === null && isset($header['carton_info'])) {
            $packingGuidelines = $header['carton_info'];
        }
        $header['packing_guidelines'] = $packingGuidelines;

        // Build composite additional_notes
        $notesParts = [];
        if (!empty($header['in_house_note'])) {
            $notesParts[] = $header['in_house_note'];
        }
        if (!empty($header['labels'])) {
            $notesParts[] = 'Labels: ' . $header['labels'];
        }
        if (isset($header['pre_ticket'])) {
            $ptValue = strtoupper(trim($header['pre_ticket']));
            $notesParts[] = 'Pre-Ticket: ' . ($ptValue === 'Y' || $ptValue === 'YES' ? 'Yes' : 'No');
        }
        if (isset($header['sample_required'])) {
            $srValue = strtoupper(trim($header['sample_required']));
            $notesParts[] = 'Sample: ' . ($srValue === 'Y' || $srValue === 'YES' ? 'Yes' : 'No');
        }
        if (!empty($header['additional_notes'])) {
            $notesParts[] = $header['additional_notes'];
        }
        $compositeNotes = !empty($notesParts) ? implode("\n", $notesParts) : null;
        $header['additional_notes'] = $compositeNotes;

        // Direct mapped fields with their confidence
        $directFields = [
            'po_number' => 'po_number',
            'po_date' => 'po_date',
            'headline' => 'headline',
            'ship_to' => 'ship_to',
            'ship_to_address' => 'ship_to_address',
            'country_of_origin' => 'country_of_origin',
            'shipping_term' => 'shipping_term',
            'etd_date' => 'etd_date',
            'ex_factory_date' => 'ex_factory_date',
            'eta_date' => 'eta_date',
            'in_warehouse_date' => 'in_warehouse_date',
            'packing_method' => 'packing_method',
            'packing_guidelines' => 'packing_guidelines',
            'additional_notes' => 'additional_notes',
            'revision_number' => 'revision_number',
            'revision_date' => 'revision_date',
        ];

        foreach ($directFields as $outputKey => $sourceKey) {
            $value = $header[$sourceKey] ?? null;
            $result[$outputKey] = [
                'value' => $value,
                'status' => $value !== null ? 'parsed' : 'missing',
                'confidence' => $value !== null ? 'high' : 'low',
            ];
        }

        // Normalize shipping_term — extract the first recognized Incoterm token from
        // anywhere in the value (e.g. "Terms: DDP", "DDP (Delivered Duty Paid)").
        // If no recognized token is found, mark the field as missing so the UI
        // doesn't claim "Parsed" with a value the <Select> can't render.
        if ($result['shipping_term']['value'] !== null) {
            $raw = (string) $result['shipping_term']['value'];
            if (preg_match('/\b(FOB|DDP|CIF|CFR|EXW|FCA|DAP|CIP)\b/i', $raw, $m)) {
                $result['shipping_term']['value'] = strtoupper($m[1]);
                $result['shipping_term']['status'] = 'parsed';
            } else {
                $result['shipping_term']['value'] = null;
                $result['shipping_term']['status'] = 'missing';
                $result['shipping_term']['confidence'] = 'low';
            }
        }

        // Fields used for master data matching (raw text stored for fuzzy match)
        $result['vendor_name'] = [
            'value' => $header['vendor_name'] ?? null,
            'status' => ($header['vendor_name'] ?? null) !== null ? 'parsed' : 'missing',
            'confidence' => ($header['vendor_name'] ?? null) !== null ? 'high' : 'low',
        ];

        $result['customer_name'] = [
            'value' => $header['customer_name'] ?? null,
            'status' => ($header['customer_name'] ?? null) !== null ? 'parsed' : 'missing',
            'confidence' => ($header['customer_name'] ?? null) !== null ? 'high' : 'low',
        ];

        // Buyer name (the company issuing the PO)
        $result['buyer_name'] = [
            'value' => $header['buyer_name'] ?? null,
            'status' => ($header['buyer_name'] ?? null) !== null ? 'parsed' : 'missing',
            'confidence' => ($header['buyer_name'] ?? null) !== null ? 'high' : 'low',
        ];

        // Agent name (the vendor/supplier from the PDF)
        $result['agent_name'] = [
            'value' => $header['vendor_name'] ?? null,
            'status' => ($header['vendor_name'] ?? null) !== null ? 'parsed' : 'missing',
            'confidence' => ($header['vendor_name'] ?? null) !== null ? 'high' : 'low',
        ];

        $result['currency_raw'] = [
            'value' => $header['currency'] ?? null,
            'raw_text' => $header['currency'] ?? null,
            'status' => ($header['currency'] ?? null) !== null ? 'parsed' : 'missing',
            'confidence' => ($header['currency'] ?? null) !== null ? 'high' : 'low',
        ];

        $result['payment_terms_raw'] = [
            'value' => $header['payment_terms'] ?? null,
            'raw_text' => $header['payment_terms'] ?? null,
            'status' => ($header['payment_terms'] ?? null) !== null ? 'parsed' : 'missing',
            'confidence' => ($header['payment_terms'] ?? null) !== null ? 'high' : 'low',
        ];

        $result['season_raw'] = [
            'value' => $header['season'] ?? null,
            'raw_text' => $header['season'] ?? null,
            'status' => ($header['season'] ?? null) !== null ? 'parsed' : 'missing',
            'confidence' => ($header['season'] ?? null) !== null ? 'high' : 'low',
        ];

        return $result;
    }

    /**
     * Build line items in the PdfParsedStyle format expected by the frontend.
     */
    private function buildLineItems(array $parsedData): array
    {
        $items = $parsedData['line_items'] ?? [];

        // Post-processing: detect if Claude swapped style_number and color_name
        // Color names are common words (WHITE, BLACK, BLUE, RED, etc.) while style numbers are alphanumeric codes
        $commonColors = ['WHITE', 'BLACK', 'BLUE', 'RED', 'GREEN', 'YELLOW', 'PINK', 'ORANGE', 'PURPLE',
            'GREY', 'GRAY', 'NAVY', 'SLATE', 'PINE', 'BROWN', 'BEIGE', 'TAN', 'CREAM', 'IVORY',
            'TEAL', 'CORAL', 'BURGUNDY', 'CHARCOAL', 'OLIVE', 'KHAKI', 'MAROON', 'LAVENDER', 'INDIGO',
            'SAGE', 'MINT', 'ROSE', 'MAUVE', 'TAUPE', 'RUST', 'SAND', 'OATMEAL', 'HEATHER'];

        foreach ($items as &$item) {
            $styleNum = strtoupper(trim($item['style_number'] ?? ''));
            $colorName = strtoupper(trim($item['color_name'] ?? ''));

            // If style_number looks like a color name AND color_name looks like an alphanumeric code, swap them
            $styleIsColor = in_array($styleNum, $commonColors);
            $colorIsCode = !empty($colorName) && preg_match('/^[A-Z]{2,}[0-9]+/', $colorName);

            if ($styleIsColor && $colorIsCode) {
                Log::info('PDF import: swapping style_number and color_name', [
                    'style_number' => $item['style_number'],
                    'color_name' => $item['color_name'],
                ]);
                $temp = $item['style_number'];
                $item['style_number'] = $item['color_name'];
                $item['color_name'] = $temp;
            } elseif ($styleIsColor && empty($colorName)) {
                // style_number is a color name but no color_name field - likely misread
                Log::warning('PDF import: style_number appears to be a color name', [
                    'style_number' => $item['style_number'],
                ]);
            }
        }
        unset($item);

        // Post-processing: detect quantity doubling
        // If PDF footer total is about half the sum of line item quantities, quantities are likely doubled
        $pdfTotalQty = $parsedData['totals']['total_quantity'] ?? 0;
        if ($pdfTotalQty > 0) {
            $lineItemSum = array_sum(array_map(fn($i) => (int) ($i['quantity'] ?? 0), $items));
            if ($lineItemSum > 0 && abs($lineItemSum - $pdfTotalQty * 2) < $pdfTotalQty * 0.05) {
                // Line item quantities appear to be doubled - halve them
                Log::info('PDF import: detected doubled quantities, correcting', [
                    'pdf_total' => $pdfTotalQty,
                    'line_sum' => $lineItemSum,
                ]);
                foreach ($items as &$item) {
                    $item['quantity'] = (int) round(($item['quantity'] ?? 0) / 2);
                    if (is_array($item['size_breakdown'] ?? null)) {
                        foreach ($item['size_breakdown'] as $size => $sizeQty) {
                            $item['size_breakdown'][$size] = (int) round($sizeQty / 2);
                        }
                    }
                }
                unset($item);
            }
        }

        $result = [];

        foreach ($items as $item) {
            $qty = (int) ($item['quantity'] ?? 0);
            $price = (float) ($item['unit_price'] ?? 0);
            $totalAmount = isset($item['total_amount']) ? (float) $item['total_amount'] : $qty * $price;

            // If price is 0 but total_amount is available, calculate price from total/qty
            if ($price == 0 && $totalAmount > 0 && $qty > 0) {
                $price = round($totalAmount / $qty, 2);
            }

            // Validate and auto-correct size breakdown
            $sizeBreakdown = $item['size_breakdown'] ?? null;
            $styleNumber = $item['style_number'] ?? null;

            // Try to use prepack ratio from existing style in database
            $prepackInfo = null;
            $prepackBreakdown = null;
            if ($styleNumber && $qty > 0) {
                $prepackInfo = $this->getPrepackInfo($styleNumber, $qty);
                $prepackBreakdown = $prepackInfo['breakdown'] ?? null;
            }

            if ($prepackBreakdown !== null) {
                // Use prepack ratio from database - more reliable than PDF extraction
                $sizeBreakdown = $prepackBreakdown;
                Log::info('PDF import: using prepack ratio for size breakdown', [
                    'style_number' => $styleNumber,
                    'ratio' => $prepackInfo['ratio'] ?? null,
                    'breakdown' => $sizeBreakdown,
                ]);
            } elseif (is_array($sizeBreakdown) && !empty($sizeBreakdown)) {
                // Filter out sizes with zero or non-positive quantities
                $sizeBreakdown = array_filter($sizeBreakdown, fn($v) => (int) $v > 0);
                $sizeSum = array_sum($sizeBreakdown);

                if ($qty === 0 && $sizeSum > 0) {
                    // If no quantity provided, use the sum of sizes
                    $qty = $sizeSum;
                } elseif ($qty > 0 && $sizeSum > 0 && $sizeSum !== $qty) {
                    // Size breakdown total doesn't match explicit quantity - scale proportionally
                    $scaledBreakdown = [];
                    $scaledSum = 0;
                    $sizeKeys = array_keys($sizeBreakdown);
                    foreach ($sizeKeys as $i => $size) {
                        if ($i === count($sizeKeys) - 1) {
                            // Last size gets the remainder to avoid rounding errors
                            $scaledBreakdown[$size] = $qty - $scaledSum;
                        } else {
                            $scaled = (int) round($sizeBreakdown[$size] * $qty / $sizeSum);
                            $scaledBreakdown[$size] = $scaled;
                            $scaledSum += $scaled;
                        }
                    }
                    $sizeBreakdown = $scaledBreakdown;
                }
            }

            $result[] = [
                'style_number' => [
                    'value' => $item['style_number'] ?? null,
                    'status' => ($item['style_number'] ?? null) !== null ? 'parsed' : 'missing',
                    'confidence' => ($item['style_number'] ?? null) !== null ? 'high' : 'low',
                ],
                'description' => [
                    'value' => $item['description'] ?? null,
                    'status' => ($item['description'] ?? null) !== null ? 'parsed' : 'missing',
                    'confidence' => ($item['description'] ?? null) !== null ? 'high' : 'low',
                ],
                'color_name' => [
                    'value' => $item['color_name'] ?? null,
                    'status' => ($item['color_name'] ?? null) !== null ? 'parsed' : 'missing',
                    'confidence' => ($item['color_name'] ?? null) !== null ? 'high' : 'low',
                ],
                'size_breakdown' => [
                    'value' => $sizeBreakdown,
                    'status' => $sizeBreakdown !== null ? 'parsed' : 'missing',
                    'confidence' => $prepackBreakdown !== null ? 'high' : ($sizeBreakdown !== null ? 'medium' : 'low'),
                    'source' => $prepackBreakdown !== null ? 'prepack' : 'pdf',
                ],
                'prepack' => $prepackInfo ? [
                    'ratio' => $prepackInfo['ratio'],
                    'total_per_pack' => $prepackInfo['total_per_pack'],
                    'packs' => $prepackInfo['packs'],
                    'prepack_code' => $prepackInfo['prepack_code'],
                ] : null,
                'quantity' => [
                    'value' => $qty,
                    'status' => $qty > 0 ? 'parsed' : 'missing',
                    'confidence' => $qty > 0 ? 'high' : 'low',
                ],
                'unit_price' => [
                    'value' => $price,
                    'status' => $price > 0 ? 'parsed' : ($price === 0.0 ? 'parsed' : 'missing'),
                    'confidence' => $price > 0 ? 'high' : 'low',
                ],
                'total_amount' => [
                    'value' => round($totalAmount, 2),
                    'status' => 'parsed',
                    'confidence' => 'high',
                ],
            ];
        }

        return $result;
    }

    /**
     * Look up an existing style's prepack ratio and calculate size breakdown from it.
     *
     * @param string $styleNumber The style number to look up
     * @param int $qty The total quantity to distribute
     * @return array|null Array with ratio, breakdown, packs info, or null if no prepack found
     */
    private function getPrepackInfo(string $styleNumber, int $qty): ?array
    {
        $style = Style::where('style_number', $styleNumber)->first();
        if (!$style) {
            return null;
        }

        // Check if this style has prepack associations
        $stylePrepack = $style->prepacks()->with('prepackCode')->first();
        if (!$stylePrepack || !$stylePrepack->prepackCode) {
            return null;
        }

        $prepackCode = $stylePrepack->prepackCode;
        $sizes = $prepackCode->sizes; // e.g., {"S": 2, "M": 2, "L": 1, "XL": 1}
        $totalPerPack = $prepackCode->total_pieces_per_pack;

        if (!is_array($sizes) || empty($sizes) || $totalPerPack <= 0) {
            return null;
        }

        $result = [
            'ratio' => $sizes,
            'total_per_pack' => $totalPerPack,
            'prepack_code' => $prepackCode->code . ' - ' . $prepackCode->name,
        ];

        // Check if quantity divides evenly into packs
        if ($qty % $totalPerPack !== 0) {
            // Doesn't divide evenly - still use ratio but scale proportionally
            $breakdown = [];
            $ratioSum = array_sum($sizes);
            if ($ratioSum <= 0) {
                return null;
            }
            $assigned = 0;
            $sizeKeys = array_keys($sizes);
            foreach ($sizeKeys as $i => $size) {
                if ($i === count($sizeKeys) - 1) {
                    $breakdown[$size] = $qty - $assigned;
                } else {
                    $val = (int) round($sizes[$size] * $qty / $ratioSum);
                    $breakdown[$size] = $val;
                    $assigned += $val;
                }
            }
            $result['breakdown'] = $breakdown;
            $result['packs'] = round($qty / $totalPerPack, 2);
            return $result;
        }

        // Divides evenly - calculate exact breakdown
        $packs = $qty / $totalPerPack;
        $breakdown = [];
        foreach ($sizes as $size => $ratio) {
            $breakdown[$size] = (int) ($ratio * $packs);
        }

        $result['breakdown'] = $breakdown;
        $result['packs'] = $packs;
        return $result;
    }

    // ========================================================================
    // MASTER DATA MATCHING (preserved from original PdfImportService)
    // ========================================================================

    /**
     * Match extracted raw text values against master data tables.
     */
    private function matchMasterData(array $parsedHeader): array
    {
        $matches = [];

        // Match Retailer - only from customer_name (CUST field). vendor_name is the agent, never the retailer.
        if (isset($parsedHeader['customer_name']) && $parsedHeader['customer_name']['value'] !== null) {
            $rawName = $parsedHeader['customer_name']['value'];
            $matches['retailer_id'] = $this->fuzzyMatchModel(Retailer::class, 'name', $rawName);
        }

        // Match Buyer - buyer_name (company issuing the PO)
        if (isset($parsedHeader['buyer_name']) && $parsedHeader['buyer_name']['value'] !== null) {
            $rawBuyer = $parsedHeader['buyer_name']['value'];
            $match = $this->fuzzyMatchModel(Buyer::class, 'name', $rawBuyer);
            if ($match['status'] === 'unrecognized') {
                $match = $this->fuzzyMatchModel(Buyer::class, 'code', $rawBuyer);
            }
            $matches['buyer_id'] = $match;

            // If buyer is matched, check for default payment term association
            if ($match['status'] === 'matched' && $match['value']) {
                $buyer = Buyer::find($match['value']);
                if ($buyer) {
                    // Look for buyer-specific payment terms (e.g., "7 days before ETA" for SCI)
                    $buyerPaymentTerm = $this->findBuyerDefaultPaymentTerm($buyer);
                    if ($buyerPaymentTerm) {
                        $matches['payment_term_id'] = [
                            'value' => $buyerPaymentTerm->id,
                            'raw_text' => $buyerPaymentTerm->name,
                            'status' => 'matched',
                            'confidence' => 'medium',
                        ];
                    }
                }
            }
        }

        // Match Agent - vendor_name against Users with Agency role
        if (isset($parsedHeader['agent_name']) && $parsedHeader['agent_name']['value'] !== null) {
            $rawAgent = $parsedHeader['agent_name']['value'];
            $match = $this->matchAgencyUser($rawAgent);
            $matches['agency_id'] = $match;
        }

        // Match Season
        if (isset($parsedHeader['season_raw']) && $parsedHeader['season_raw']['value'] !== null) {
            $rawSeason = $parsedHeader['season_raw']['value'];
            $matches['season_id'] = $this->fuzzyMatchModel(Season::class, 'name', $rawSeason);
        }

        // Match Currency
        if (isset($parsedHeader['currency_raw']) && $parsedHeader['currency_raw']['value'] !== null) {
            $rawCurrency = $parsedHeader['currency_raw']['value'];
            $match = $this->fuzzyMatchModel(Currency::class, 'code', $rawCurrency);
            if ($match['status'] === 'unrecognized') {
                $match = $this->fuzzyMatchModel(Currency::class, 'name', $rawCurrency);
            }
            if ($match['status'] === 'unrecognized') {
                $match = $this->fuzzyMatchModel(Currency::class, 'symbol', $rawCurrency);
            }
            $matches['currency_id'] = $match;
        }

        // Match Payment Term (only if not already set by buyer default)
        if (!isset($matches['payment_term_id']) || $matches['payment_term_id']['status'] !== 'matched') {
            if (isset($parsedHeader['payment_terms_raw']) && $parsedHeader['payment_terms_raw']['value'] !== null) {
                $rawTerm = $parsedHeader['payment_terms_raw']['value'];
                $match = $this->fuzzyMatchModel(PaymentTerm::class, 'name', $rawTerm);
                if ($match['status'] === 'unrecognized') {
                    $match = $this->fuzzyMatchModel(PaymentTerm::class, 'code', str_replace(' ', '', $rawTerm));
                }
                $matches['payment_term_id'] = $match;
            }
        }

        // Match Country
        if (isset($parsedHeader['country_of_origin']) && $parsedHeader['country_of_origin']['value'] !== null) {
            $rawCountry = $parsedHeader['country_of_origin']['value'];
            $match = $this->fuzzyMatchModel(Country::class, 'name', $rawCountry);
            if ($match['status'] === 'unrecognized') {
                $match = $this->fuzzyMatchModel(Country::class, 'code', $rawCountry);
            }
            $matches['country_id'] = $match;
        }

        // Match Warehouse
        if (isset($parsedHeader['ship_to']) && $parsedHeader['ship_to']['value'] !== null) {
            $rawWarehouse = $parsedHeader['ship_to']['value'];
            $match = $this->fuzzyMatchModel(Warehouse::class, 'name', $rawWarehouse);
            if ($match['status'] === 'unrecognized') {
                $match = $this->fuzzyMatchModel(Warehouse::class, 'code', $rawWarehouse);
            }
            $matches['warehouse_id'] = $match;
        }

        return $matches;
    }

    /**
     * Find default payment term for a buyer.
     * For known buyers like SPORT CASUAL INTERNATIONAL, returns "7 days before ETA" term.
     */
    private function findBuyerDefaultPaymentTerm(Buyer $buyer): ?PaymentTerm
    {
        // Look for "7 days before ETA" or similar payment term
        $term = PaymentTerm::where('is_active', true)
            ->where(function ($query) {
                $query->whereRaw('LOWER(name) LIKE ?', ['%7 days before eta%'])
                    ->orWhereRaw('LOWER(code) LIKE ?', ['%7_days_before_eta%'])
                    ->orWhereRaw('LOWER(name) LIKE ?', ['%7 days before%']);
            })
            ->first();

        return $term;
    }

    /**
     * Match agent name against Users with Agency role.
     */
    private function matchAgencyUser(string $rawAgent): array
    {
        $rawAgent = trim($rawAgent);

        try {
            // Search users who have Agency role, matching on company or name
            $agencyUsers = User::whereHas('roles', function ($query) {
                $query->whereRaw('LOWER(name) = ?', ['agency']);
            })->get();

            foreach ($agencyUsers as $user) {
                // Try matching on company name
                $company = $user->company ?? '';
                if (!empty($company) && stripos($rawAgent, $company) !== false) {
                    return [
                        'value' => $user->id,
                        'raw_text' => $rawAgent,
                        'status' => 'matched',
                        'confidence' => 'high',
                    ];
                }
                if (!empty($company) && stripos($company, $rawAgent) !== false) {
                    return [
                        'value' => $user->id,
                        'raw_text' => $rawAgent,
                        'status' => 'matched',
                        'confidence' => 'medium',
                    ];
                }
                // Try matching on user name
                if (!empty($user->name) && stripos($rawAgent, $user->name) !== false) {
                    return [
                        'value' => $user->id,
                        'raw_text' => $rawAgent,
                        'status' => 'matched',
                        'confidence' => 'medium',
                    ];
                }
            }

            // Try normalized matching
            $normalizedRaw = strtolower(preg_replace('/[\s\-\.]+/', '', $rawAgent));
            foreach ($agencyUsers as $user) {
                $normalizedCompany = strtolower(preg_replace('/[\s\-\.]+/', '', $user->company ?? ''));
                $normalizedName = strtolower(preg_replace('/[\s\-\.]+/', '', $user->name ?? ''));
                if (!empty($normalizedCompany) && ($normalizedRaw === $normalizedCompany || strpos($normalizedRaw, $normalizedCompany) !== false || strpos($normalizedCompany, $normalizedRaw) !== false)) {
                    return [
                        'value' => $user->id,
                        'raw_text' => $rawAgent,
                        'status' => 'matched',
                        'confidence' => 'medium',
                    ];
                }
                if (!empty($normalizedName) && ($normalizedRaw === $normalizedName || strpos($normalizedRaw, $normalizedName) !== false)) {
                    return [
                        'value' => $user->id,
                        'raw_text' => $rawAgent,
                        'status' => 'matched',
                        'confidence' => 'medium',
                    ];
                }
            }
        } catch (\Exception $e) {
            Log::warning('Agent matching failed: ' . $e->getMessage());
        }

        return [
            'value' => null,
            'raw_text' => $rawAgent,
            'status' => 'unrecognized',
            'confidence' => 'low',
        ];
    }

    /**
     * Fuzzy match a value against a model's field.
     * Tries: exact -> case-insensitive -> normalized -> partial -> reverse partial.
     */
    private function fuzzyMatchModel(string $modelClass, string $field, string $rawValue): array
    {
        $rawValue = trim($rawValue);

        // Try exact match
        $record = $modelClass::where($field, $rawValue)->first();
        if ($record) {
            return [
                'value' => $record->id,
                'raw_text' => $rawValue,
                'status' => 'matched',
                'confidence' => 'high',
            ];
        }

        // Try case-insensitive match
        $record = $modelClass::whereRaw('LOWER(' . $field . ') = ?', [strtolower($rawValue)])->first();
        if ($record) {
            return [
                'value' => $record->id,
                'raw_text' => $rawValue,
                'status' => 'matched',
                'confidence' => 'high',
            ];
        }

        // Try normalized match (strip spaces, hyphens, dots)
        $normalized = strtolower(preg_replace('/[\s\-\.]+/', '', $rawValue));
        try {
            $allRecords = $modelClass::all();
            foreach ($allRecords as $record) {
                $dbNormalized = strtolower(preg_replace('/[\s\-\.]+/', '', $record->$field ?? ''));
                if ($normalized === $dbNormalized && !empty($normalized)) {
                    return [
                        'value' => $record->id,
                        'raw_text' => $rawValue,
                        'status' => 'matched',
                        'confidence' => 'high',
                    ];
                }
            }
        } catch (\Exception $e) {
            // Model may not support this query
        }

        // Try partial match (LIKE)
        $record = $modelClass::whereRaw('LOWER(' . $field . ') LIKE ?', ['%' . strtolower($rawValue) . '%'])->first();
        if ($record) {
            return [
                'value' => $record->id,
                'raw_text' => $rawValue,
                'status' => 'matched',
                'confidence' => 'medium',
            ];
        }

        // Try reverse partial match
        try {
            $records = $modelClass::where('is_active', true)->get();
            foreach ($records as $record) {
                $dbVal = $record->$field ?? '';
                if (!empty($dbVal) && stripos($rawValue, $dbVal) !== false) {
                    return [
                        'value' => $record->id,
                        'raw_text' => $rawValue,
                        'status' => 'matched',
                        'confidence' => 'medium',
                    ];
                }
            }
        } catch (\Exception $e) {
            // is_active column may not exist on all models
        }

        // Try word-boundary matching
        try {
            $records = $allRecords ?? $modelClass::all();
            foreach ($records as $record) {
                $dbVal = $record->$field ?? '';
                if (!empty($dbVal) && strlen($dbVal) >= 3) {
                    if (preg_match('/\b' . preg_quote($dbVal, '/') . '\b/i', $rawValue)) {
                        return [
                            'value' => $record->id,
                            'raw_text' => $rawValue,
                            'status' => 'matched',
                            'confidence' => 'medium',
                        ];
                    }
                }
            }
        } catch (\Exception $e) {
            // Fallthrough
        }

        return [
            'value' => null,
            'raw_text' => $rawValue,
            'status' => 'unrecognized',
            'confidence' => 'low',
        ];
    }
}
