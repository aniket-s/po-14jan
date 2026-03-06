<?php

namespace App\Services;

use App\Models\Country;
use App\Models\Currency;
use App\Models\PaymentTerm;
use App\Models\Retailer;
use App\Models\Season;
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

            foreach (['retailer_id', 'season_id', 'currency_id', 'payment_term_id', 'country_id', 'warehouse_id'] as $field) {
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

            // Check for duplicate style numbers
            $styleNumbers = array_filter(array_map(fn($item) => $item['style_number']['value'] ?? '', $lineItems));
            $duplicates = array_unique(array_diff_assoc($styleNumbers, array_unique($styleNumbers)));
            if (!empty($duplicates)) {
                $warnings[] = 'Duplicate style number(s) found: ' . implode(', ', array_unique($duplicates)) . ' - please review';
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

Extract the following information:

1. **PO Header** - All header/metadata fields
2. **Line Items** - Every style/product row with full details
3. **Totals** - Summary totals from the document footer

Return ONLY valid JSON (no markdown, no explanation, no code blocks) in this exact structure:

{
  "po_header": {
    "po_number": "string or null",
    "po_date": "YYYY-MM-DD or null",
    "revision_number": "integer or null",
    "revision_date": "YYYY-MM-DD or null",
    "vendor_name": "string or null",
    "vendor_address": "string or null",
    "customer_name": "string or null (the buyer/retailer company name)",
    "customer_address": "string or null",
    "ship_to": "string or null (destination warehouse/location name)",
    "ship_to_address": "string or null",
    "country_of_origin": "string or null (manufacturing/vendor country)",
    "currency": "string or null (e.g. USD, INR, EUR)",
    "payment_terms": "string or null (e.g. NET 30, LC at sight)",
    "shipping_term": "string or null (e.g. FOB, DDP, CIF, CFR, EXW)",
    "etd_date": "YYYY-MM-DD or null (estimated time of departure)",
    "ex_factory_date": "YYYY-MM-DD or null",
    "eta_date": "YYYY-MM-DD or null (estimated time of arrival)",
    "season": "string or null (e.g. SS25, AW24, Spring 2025)",
    "packing_method": "string or null",
    "packing_guidelines": "string or null",
    "additional_notes": "string or null (any terms, conditions, notes)",
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

IMPORTANT RULES:
- Extract ALL line items/styles from the document - do not skip any rows
- For style_number: look for columns labeled Style, Style#, Item, SKU, Article, Ref, Part No, etc.
- For quantity: sum all size quantities if size breakdown is available, or use the Qty/Quantity column
- For unit_price: look for Rate, Price, Unit Price, FOB, Cost columns. Use 0 if not clearly stated.
- For dates: always convert to YYYY-MM-DD format regardless of the original format
- For size_breakdown: extract individual size quantities if the document has size columns (XS, S, M, L, XL, XXL, 2XL, 3XL, 4XL, 5XL, or numeric sizes like 28, 30, 32, etc.). ONLY include sizes that have an explicit quantity value - do NOT assume or fill in quantities for sizes that appear as column headers but have no quantity underneath them. The sum of all size quantities MUST equal the total quantity for that line item.
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

        $parsed = json_decode($content, true);

        if (json_last_error() !== JSON_ERROR_NONE) {
            Log::error('Failed to parse Claude JSON response', [
                'error' => json_last_error_msg(),
                'content_preview' => substr($content, 0, 500),
            ]);
            return null;
        }

        // Validate minimum required structure
        if (!isset($parsed['po_header']) || !isset($parsed['line_items'])) {
            Log::error('Claude response missing required fields', [
                'keys' => array_keys($parsed),
            ]);
            return null;
        }

        return $parsed;
    }

    /**
     * Build the PO header in the PdfParsedField format expected by the frontend.
     */
    private function buildPoHeader(array $parsedData): array
    {
        $header = $parsedData['po_header'] ?? [];
        $result = [];

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

        // Normalize shipping_term to FOB/DDP if possible
        if ($result['shipping_term']['value'] !== null) {
            $term = strtoupper(trim($result['shipping_term']['value']));
            if (in_array($term, ['FOB', 'DDP'])) {
                $result['shipping_term']['value'] = $term;
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
        $result = [];

        foreach ($items as $item) {
            $qty = (int) ($item['quantity'] ?? 0);
            $price = (float) ($item['unit_price'] ?? 0);
            $totalAmount = isset($item['total_amount']) ? (float) $item['total_amount'] : $qty * $price;

            // Validate and auto-correct size breakdown if present
            $sizeBreakdown = $item['size_breakdown'] ?? null;
            if (is_array($sizeBreakdown) && !empty($sizeBreakdown)) {
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
                    'confidence' => $sizeBreakdown !== null ? 'high' : 'low',
                ],
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

    // ========================================================================
    // MASTER DATA MATCHING (preserved from original PdfImportService)
    // ========================================================================

    /**
     * Match extracted raw text values against master data tables.
     */
    private function matchMasterData(array $parsedHeader): array
    {
        $matches = [];

        // Match Retailer - customer_name first, then vendor_name fallback
        $retailerMatched = false;
        if (isset($parsedHeader['customer_name']) && $parsedHeader['customer_name']['value'] !== null) {
            $rawName = $parsedHeader['customer_name']['value'];
            $match = $this->fuzzyMatchModel(Retailer::class, 'name', $rawName);
            $matches['retailer_id'] = $match;
            $retailerMatched = ($match['status'] === 'matched');
        }
        if (!$retailerMatched && isset($parsedHeader['vendor_name']) && $parsedHeader['vendor_name']['value'] !== null) {
            $rawName = $parsedHeader['vendor_name']['value'];
            $matches['retailer_id'] = $this->fuzzyMatchModel(Retailer::class, 'name', $rawName);
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

        // Match Payment Term
        if (isset($parsedHeader['payment_terms_raw']) && $parsedHeader['payment_terms_raw']['value'] !== null) {
            $rawTerm = $parsedHeader['payment_terms_raw']['value'];
            $match = $this->fuzzyMatchModel(PaymentTerm::class, 'name', $rawTerm);
            if ($match['status'] === 'unrecognized') {
                $match = $this->fuzzyMatchModel(PaymentTerm::class, 'code', str_replace(' ', '', $rawTerm));
            }
            $matches['payment_term_id'] = $match;
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
