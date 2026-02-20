<?php

namespace App\Services;

use App\Models\Country;
use App\Models\Currency;
use App\Models\PaymentTerm;
use App\Models\Retailer;
use App\Models\Season;
use App\Models\Warehouse;
use Illuminate\Support\Facades\Log;
use Smalot\PdfParser\Parser;

class PdfImportService
{
    /**
     * Analyze a PDF purchase order file and extract structured data
     */
    public function analyzePdf(string $filePath): array
    {
        try {
            $parser = new Parser();
            $pdf = $parser->parseFile($filePath);
            $text = $pdf->getText();

            if (empty(trim($text))) {
                return [
                    'success' => false,
                    'error' => 'Unable to extract text from this PDF. The file may be a scanned image or encrypted.',
                ];
            }

            $lines = array_map('trim', explode("\n", $text));
            $lines = array_values(array_filter($lines, fn($l) => $l !== ''));

            $poHeader = $this->parseHeaderSection($lines);
            $lineItems = $this->parseLineItems($lines);
            $footer = $this->parseFooter($lines);
            $masterDataMatches = $this->matchMasterData($poHeader);

            // Merge master data matches into header
            foreach ($masterDataMatches as $field => $match) {
                if (isset($poHeader[$field])) {
                    $poHeader[$field] = array_merge($poHeader[$field], $match);
                } else {
                    $poHeader[$field] = $match;
                }
            }

            // Cross-validate totals
            $calculatedQty = array_sum(array_column(array_map(fn($s) => $s['quantity'], $lineItems), 'value'));
            $calculatedValue = 0;
            foreach ($lineItems as $item) {
                $qty = $item['quantity']['value'] ?? 0;
                $price = $item['unit_price']['value'] ?? 0;
                $calculatedValue += $qty * $price;
            }

            $totalQty = $footer['total_quantity'] ?? $calculatedQty;
            $totalValue = $footer['total_value'] ?? $calculatedValue;

            $warnings = [];

            // Check for missing required fields
            $requiredFields = ['po_number', 'po_date'];
            foreach ($requiredFields as $field) {
                if (!isset($poHeader[$field]) || $poHeader[$field]['value'] === null) {
                    $warnings[] = ucfirst(str_replace('_', ' ', $field)) . ' could not be identified - please fill in manually';
                }
            }

            // Check for unrecognized master data
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

            // Check for styles with price = 0
            $zeroPriceStyles = [];
            foreach ($lineItems as $item) {
                $price = $item['unit_price']['value'] ?? 0;
                if ($price == 0) {
                    $zeroPriceStyles[] = $item['style_number']['value'] ?? 'Unknown';
                }
            }
            if (!empty($zeroPriceStyles)) {
                $styleList = implode(', ', array_slice($zeroPriceStyles, 0, 5));
                $more = count($zeroPriceStyles) > 5 ? ' and ' . (count($zeroPriceStyles) - 5) . ' more' : '';
                $warnings[] = "Price is $0.00 for style(s): {$styleList}{$more} - please ask importer or agency to fill the price manually";
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
                'raw_text' => $text,
            ];
        } catch (\Exception $e) {
            Log::error('PDF analysis failed: ' . $e->getMessage());
            return [
                'success' => false,
                'error' => 'Failed to analyze PDF file: ' . $e->getMessage(),
            ];
        }
    }

    /**
     * Parse header section from PDF text lines
     */
    private function parseHeaderSection(array $lines): array
    {
        $fullText = implode("\n", $lines);
        $header = [];

        // PO Number
        $header['po_number'] = $this->extractField(
            $fullText,
            [
                '/(?:P\.?O\.?\s*(?:Number|No\.?|#)?|Purchase\s*Order\s*(?:Number|No\.?|#)?)\s*[:\-]?\s*([A-Za-z0-9\-\/]+)/i',
                '/\b(PO[\-\s]?\d{4}[\-\s]?\d{2,6})\b/i',
                '/\bOrder\s*(?:Number|No\.?|#)\s*[:\-]?\s*([A-Za-z0-9\-\/]+)/i',
            ]
        );

        // PO Date
        $header['po_date'] = $this->extractDateField(
            $fullText,
            [
                '/(?:P\.?O\.?\s*Date|Order\s*Date|Date)\s*[:\-]?\s*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/i',
                '/(?:P\.?O\.?\s*Date|Order\s*Date|Date)\s*[:\-]?\s*(\w+\s+\d{1,2},?\s+\d{4})/i',
                '/(?:Date)\s*[:\-]?\s*(\d{4}[\/-]\d{1,2}[\/-]\d{1,2})/i',
            ]
        );

        // Revision Number
        $header['revision_number'] = $this->extractField(
            $fullText,
            [
                '/(?:Rev(?:ision)?\.?\s*(?:Number|No\.?|#)?)\s*[:\-]?\s*(\d+)/i',
            ]
        );
        if ($header['revision_number']['value'] !== null) {
            $header['revision_number']['value'] = (int) $header['revision_number']['value'];
        }

        // Shipping Term (FOB / DDP)
        $header['shipping_term'] = ['value' => null, 'status' => 'missing'];
        if (preg_match('/\bFOB\b/i', $fullText)) {
            $header['shipping_term'] = ['value' => 'FOB', 'status' => 'parsed', 'confidence' => 'high'];
        } elseif (preg_match('/\bDDP\b/i', $fullText)) {
            $header['shipping_term'] = ['value' => 'DDP', 'status' => 'parsed', 'confidence' => 'high'];
        }

        // Ship To
        $header['ship_to'] = $this->extractField(
            $fullText,
            [
                '/(?:Ship\s*To|Delivery\s*Address|Deliver\s*To)\s*[:\-]?\s*(.+?)(?:\n|$)/i',
            ]
        );

        // Ship To Address (try to get multi-line address after Ship To)
        $header['ship_to_address'] = $this->extractMultiLineField(
            $lines,
            ['Ship To', 'Delivery Address', 'Deliver To']
        );

        // Payment Terms (raw text for master data matching later)
        $header['payment_terms_raw'] = $this->extractField(
            $fullText,
            [
                '/(?:Payment\s*Terms?|Terms?\s*of\s*Payment|Pay(?:ment)?\s*Cond(?:ition)?s?)\s*[:\-]?\s*(.+?)(?:\n|$)/i',
            ]
        );

        // Season
        $header['season_raw'] = $this->extractField(
            $fullText,
            [
                '/(?:Season)\s*[:\-]?\s*(.+?)(?:\n|$)/i',
            ]
        );

        // Country of Origin
        $header['country_of_origin'] = $this->extractField(
            $fullText,
            [
                '/(?:Country\s*of\s*Origin|Origin|Made\s*In)\s*[:\-]?\s*(.+?)(?:\n|$)/i',
            ]
        );

        // Currency detection
        $header['currency_raw'] = ['value' => null, 'status' => 'missing'];
        if (preg_match('/\b(USD|US\s*Dollar)\b/i', $fullText)) {
            $header['currency_raw'] = ['value' => 'USD', 'status' => 'parsed', 'confidence' => 'high'];
        } elseif (preg_match('/\b(EUR|Euro)\b/i', $fullText)) {
            $header['currency_raw'] = ['value' => 'EUR', 'status' => 'parsed', 'confidence' => 'high'];
        } elseif (preg_match('/\b(GBP|Pound)\b/i', $fullText)) {
            $header['currency_raw'] = ['value' => 'GBP', 'status' => 'parsed', 'confidence' => 'high'];
        } elseif (preg_match('/\$/', $fullText)) {
            $header['currency_raw'] = ['value' => 'USD', 'status' => 'parsed', 'confidence' => 'medium'];
        }

        // Vendor / Factory info
        $header['vendor_name'] = $this->extractField(
            $fullText,
            [
                '/(?:Vendor|Supplier|Factory|Manufacturer)\s*(?:Name)?\s*[:\-]?\s*(.+?)(?:\n|$)/i',
            ]
        );

        // Customer / Retailer name (try to detect from header area)
        $header['customer_name'] = $this->extractField(
            $fullText,
            [
                '/(?:Customer|Retailer|Client|Buyer\s*Company|Bill\s*To)\s*(?:Name)?\s*[:\-]?\s*(.+?)(?:\n|$)/i',
                '/(?:Sold\s*To|Ordered\s*By\s*Company)\s*[:\-]?\s*(.+?)(?:\n|$)/i',
            ]
        );

        // Buyer
        $header['buyer_name'] = $this->extractField(
            $fullText,
            [
                '/(?:Buyer|Purchased?\s*By|Ordered?\s*By)\s*[:\-]?\s*(.+?)(?:\n|$)/i',
            ]
        );

        // Department
        $header['department'] = $this->extractField(
            $fullText,
            [
                '/(?:Department|Dept\.?)\s*[:\-]?\s*(.+?)(?:\n|$)/i',
            ]
        );

        // Division
        $header['division'] = $this->extractField(
            $fullText,
            [
                '/(?:Division|Div\.?)\s*[:\-]?\s*(.+?)(?:\n|$)/i',
            ]
        );

        // Notes / Special Instructions
        $header['additional_notes'] = $this->extractField(
            $fullText,
            [
                '/(?:Special\s*Instructions?|Notes?|Remarks?|Comments?)\s*[:\-]?\s*(.+?)(?:\n|$)/i',
            ]
        );

        // ETD date
        $header['etd_date'] = $this->extractDateField(
            $fullText,
            [
                '/(?:ETD|Estimated\s*Time\s*(?:of\s*)?Departure|Ship\s*Date)\s*[:\-]?\s*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/i',
                '/(?:ETD|Ship\s*Date)\s*[:\-]?\s*(\w+\s+\d{1,2},?\s+\d{4})/i',
            ]
        );

        // Ex-Factory date
        $header['ex_factory_date'] = $this->extractDateField(
            $fullText,
            [
                '/(?:Ex[\s\-]*Factory|Ex[\s\-]*Fty)\s*(?:Date)?\s*[:\-]?\s*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/i',
                '/(?:Ex[\s\-]*Factory|Ex[\s\-]*Fty)\s*(?:Date)?\s*[:\-]?\s*(\w+\s+\d{1,2},?\s+\d{4})/i',
            ]
        );

        // ETA date
        $header['eta_date'] = $this->extractDateField(
            $fullText,
            [
                '/(?:ETA|Estimated\s*Time\s*(?:of\s*)?Arrival)\s*[:\-]?\s*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/i',
                '/(?:ETA)\s*[:\-]?\s*(\w+\s+\d{1,2},?\s+\d{4})/i',
            ]
        );

        // In Warehouse date
        $header['in_warehouse_date'] = $this->extractDateField(
            $fullText,
            [
                '/(?:In[\s\-]*Warehouse|IHD|In[\s\-]*House)\s*(?:Date)?\s*[:\-]?\s*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/i',
            ]
        );

        // Packing Method — detect prepack / solid pack patterns
        $header['packing_method'] = $this->extractPackingMethod($fullText);

        return $header;
    }

    /**
     * Parse line items (styles) from PDF text
     * Supports multi-row line items where description/color/sizes span multiple lines
     */
    private function parseLineItems(array $lines): array
    {
        $styles = [];

        // Find the table header row to detect columns
        $headerRowIndex = $this->findTableHeaderRow($lines);
        if ($headerRowIndex === null) {
            return $styles;
        }

        // Determine available size columns from header
        $headerLine = $lines[$headerRowIndex];
        $sizeColumns = $this->detectSizeColumns($headerLine);

        // Parse rows after the header
        $i = $headerRowIndex + 1;
        while ($i < count($lines)) {
            $line = $lines[$i];

            // Stop at footer indicators
            if ($this->isFooterLine($line)) {
                break;
            }

            // Skip empty or separator lines
            if (empty(trim($line)) || preg_match('/^[\-=_\s]+$/', $line)) {
                $i++;
                continue;
            }

            $parsed = $this->parseLineItemRow($line, $sizeColumns, $lines, $i);
            if ($parsed !== null) {
                // Check if the next line(s) look like continuation rows (no style number, just text/numbers)
                $j = $i + 1;
                while ($j < count($lines)) {
                    $nextLine = trim($lines[$j]);
                    if (empty($nextLine) || preg_match('/^[\-=_\s]+$/', $nextLine) || $this->isFooterLine($nextLine)) {
                        break;
                    }
                    // Continuation row: doesn't look like a new style row (no leading alphanumeric style number pattern)
                    if ($this->isContinuationRow($nextLine, $sizeColumns)) {
                        $this->mergeContinuationRow($parsed, $nextLine, $sizeColumns);
                        $j++;
                    } else {
                        break;
                    }
                }
                $styles[] = $parsed;
                $i = $j;
            } else {
                $i++;
            }
        }

        return $styles;
    }

    /**
     * Check if a line looks like a continuation of a previous line item
     * (no style number at start, mostly text or size quantities)
     */
    private function isContinuationRow(string $line, array $sizeColumns): bool
    {
        $tokens = preg_split('/\s{2,}|\t/', $line);
        $tokens = array_values(array_filter($tokens, fn($t) => trim($t) !== ''));

        if (empty($tokens)) {
            return false;
        }

        // If first token looks like a style number (alphanumeric with possible dashes), it's a new row
        $firstToken = trim($tokens[0]);
        if (preg_match('/^[A-Z]{1,5}[\-\s]?\d{3,}/i', $firstToken)) {
            return false;
        }

        // If the line has very few tokens and they're all text, likely a description continuation
        $allText = true;
        foreach ($tokens as $token) {
            $cleaned = preg_replace('/[,$]/', '', trim($token));
            if (is_numeric($cleaned)) {
                $allText = false;
                break;
            }
        }

        return $allText || count($tokens) <= 2;
    }

    /**
     * Merge a continuation row's data into the existing parsed line item
     */
    private function mergeContinuationRow(array &$parsed, string $line, array $sizeColumns): void
    {
        $tokens = preg_split('/\s{2,}|\t/', $line);
        $tokens = array_values(array_filter($tokens, fn($t) => trim($t) !== ''));

        foreach ($tokens as $token) {
            $token = trim($token);
            $cleaned = preg_replace('/[,$]/', '', $token);

            if (!is_numeric($cleaned)) {
                // Text token — fill in missing description or color
                if ($parsed['description']['value'] === null) {
                    $parsed['description'] = $this->buildParsedField($token);
                } elseif ($parsed['color_name']['value'] === null) {
                    $parsed['color_name'] = $this->buildParsedField($token);
                }
            }
        }
    }

    /**
     * Find the table header row index
     */
    private function findTableHeaderRow(array $lines): ?int
    {
        foreach ($lines as $index => $line) {
            $lower = strtolower($line);

            // Look for common table header indicators
            $hasStyleCol = preg_match('/(style|item|sku|product)/i', $lower);
            $hasQtyCol = preg_match('/(qty|quantity|total\s*qty|pcs)/i', $lower);
            $hasPriceCol = preg_match('/(price|cost|rate|amount|fob)/i', $lower);

            if ($hasStyleCol && ($hasQtyCol || $hasPriceCol)) {
                return $index;
            }
        }

        return null;
    }

    /**
     * Detect size column names from the header row
     */
    private function detectSizeColumns(string $headerLine): array
    {
        $sizes = [];
        $standardSizes = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL', '3XL', 'XXXL',
                          '2', '4', '6', '8', '10', '12', '14', '16',
                          '28', '29', '30', '31', '32', '33', '34', '36', '38', '40', '42'];

        // Check for standard size labels in header
        foreach ($standardSizes as $size) {
            if (preg_match('/\b' . preg_quote($size, '/') . '\b/i', $headerLine)) {
                $sizes[] = $size;
            }
        }

        return $sizes;
    }

    /**
     * Parse a single line item row
     */
    private function parseLineItemRow(string $line, array $sizeColumns, array $allLines, int $currentIndex): ?array
    {
        // Extract numbers from the line
        $tokens = preg_split('/\s{2,}|\t/', $line);
        $tokens = array_values(array_filter($tokens, fn($t) => trim($t) !== ''));

        if (count($tokens) < 3) {
            return null;
        }

        // Try to identify fields by position and format
        $styleNumber = null;
        $description = null;
        $colorName = null;
        $sizeBreakdown = [];
        $totalQty = null;
        $unitPrice = null;
        $totalAmount = null;

        // First token is typically the style number
        $styleNumber = trim($tokens[0]);

        // Skip if first token looks like a total or non-style-number
        if (preg_match('/^(total|sub[\s\-]?total|grand|notes?|special|instructions?)/i', $styleNumber)) {
            return null;
        }

        // Parse remaining tokens
        $numericTokens = [];
        $textTokens = [];

        for ($i = 1; $i < count($tokens); $i++) {
            $token = trim($tokens[$i]);
            $cleaned = preg_replace('/[,$]/', '', $token);

            if (is_numeric($cleaned)) {
                $numericTokens[] = ['index' => $i, 'value' => $cleaned, 'original' => $token];
            } else {
                $textTokens[] = ['index' => $i, 'value' => $token];
            }
        }

        // Description is usually the first text token after style number
        if (!empty($textTokens)) {
            $description = $textTokens[0]['value'];

            // Color is usually the second text token
            if (count($textTokens) > 1) {
                $colorName = $textTokens[1]['value'];
            }
        }

        // Determine size breakdown and totals from numeric tokens
        if (!empty($numericTokens)) {
            $numCount = count($numericTokens);
            $sizeCount = count($sizeColumns);

            if ($sizeCount > 0 && $numCount >= $sizeCount + 2) {
                // We have size columns + total qty + unit price (+ possibly total amount)
                for ($j = 0; $j < $sizeCount; $j++) {
                    $qty = (int) $numericTokens[$j]['value'];
                    if ($qty > 0) {
                        $sizeBreakdown[$sizeColumns[$j]] = $qty;
                    }
                }

                $totalQty = (int) $numericTokens[$sizeCount]['value'];
                $unitPrice = (float) $numericTokens[$sizeCount + 1]['value'];

                if ($numCount > $sizeCount + 2) {
                    $totalAmount = (float) $numericTokens[$sizeCount + 2]['value'];
                }
            } elseif ($numCount >= 3) {
                // No size columns detected or sizes not matching
                // Last 3 numeric values are likely: total qty, unit price, total amount
                $totalAmount = (float) $numericTokens[$numCount - 1]['value'];
                $unitPrice = (float) $numericTokens[$numCount - 2]['value'];
                $totalQty = (int) $numericTokens[$numCount - 3]['value'];

                // Remaining numeric tokens might be size quantities
                for ($j = 0; $j < $numCount - 3; $j++) {
                    $qty = (int) $numericTokens[$j]['value'];
                    if ($qty > 0) {
                        $sizeLabel = isset($sizeColumns[$j]) ? $sizeColumns[$j] : "Size" . ($j + 1);
                        $sizeBreakdown[$sizeLabel] = $qty;
                    }
                }
            } elseif ($numCount == 2) {
                // Just total qty and unit price
                $totalQty = (int) $numericTokens[0]['value'];
                $unitPrice = (float) $numericTokens[1]['value'];
            }
        }

        // Skip if no style number or no quantity
        if (empty($styleNumber) || ($totalQty === null && empty($sizeBreakdown))) {
            return null;
        }

        // Calculate total qty from size breakdown if not provided
        if ($totalQty === null && !empty($sizeBreakdown)) {
            $totalQty = array_sum($sizeBreakdown);
        }

        // Calculate total amount if not provided
        if ($totalAmount === null && $totalQty !== null && $unitPrice !== null) {
            $totalAmount = round($totalQty * $unitPrice, 2);
        }

        return [
            'style_number' => $this->buildParsedField($styleNumber),
            'description' => $this->buildParsedField($description),
            'color_name' => $this->buildParsedField($colorName),
            'size_breakdown' => $this->buildParsedField(
                !empty($sizeBreakdown) ? $sizeBreakdown : null,
                empty($sizeBreakdown) ? 'missing' : 'parsed'
            ),
            'quantity' => $this->buildParsedField($totalQty),
            'unit_price' => $this->buildParsedField($unitPrice),
            'total_amount' => $this->buildParsedField($totalAmount),
        ];
    }

    /**
     * Parse footer section for totals and notes
     */
    private function parseFooter(array $lines): array
    {
        $footer = [];
        $fullText = implode("\n", $lines);

        // Total Quantity
        if (preg_match('/(?:Total|Grand\s*Total)\s*(?:Qty|Quantity|Pcs|Pieces)\s*[:\-]?\s*([\d,]+)/i', $fullText, $m)) {
            $footer['total_quantity'] = (int) str_replace(',', '', $m[1]);
        }

        // Total Value / Amount
        if (preg_match('/(?:Total|Grand\s*Total)\s*(?:Value|Amount|Cost)\s*[:\-]?\s*[\$]?\s*([\d,]+\.?\d*)/i', $fullText, $m)) {
            $footer['total_value'] = (float) str_replace(',', '', $m[1]);
        }

        return $footer;
    }

    /**
     * Extract packing method with prepack / solid pack detection
     */
    private function extractPackingMethod(string $fullText): array
    {
        // Try to detect prepack patterns like "8PREPACK INTO 1 POLYBAG", "6-PREPACK", "PREPACK 12 PCS"
        if (preg_match('/(\d+)\s*PREPACK\s*(?:INTO\s*\d+\s*\w+)?/i', $fullText, $m)) {
            return [
                'value' => trim($m[0]),
                'packing_type' => 'prepack',
                'prepack_qty' => (int) $m[1],
                'status' => 'parsed',
                'confidence' => 'high',
            ];
        }

        if (preg_match('/PREPACK/i', $fullText)) {
            return [
                'value' => 'PREPACK',
                'packing_type' => 'prepack',
                'status' => 'parsed',
                'confidence' => 'high',
            ];
        }

        // Solid pack patterns
        if (preg_match('/SOLID\s*PACK/i', $fullText)) {
            return [
                'value' => 'SOLID PACK',
                'packing_type' => 'solid',
                'status' => 'parsed',
                'confidence' => 'high',
            ];
        }

        // Generic packing method extraction
        $patterns = [
            '/(?:Pack(?:ing|age)?\s*Method|Pack(?:ing)?\s*Type|Packing)\s*[:\-]?\s*(.+?)(?:\n|$)/i',
        ];
        foreach ($patterns as $pattern) {
            if (preg_match($pattern, $fullText, $m)) {
                $value = trim($m[1]);
                if (!empty($value)) {
                    // Determine type from the extracted value
                    $packingType = 'other';
                    if (preg_match('/prepack/i', $value)) {
                        $packingType = 'prepack';
                    } elseif (preg_match('/solid/i', $value)) {
                        $packingType = 'solid';
                    }
                    return [
                        'value' => $value,
                        'packing_type' => $packingType,
                        'status' => 'parsed',
                        'confidence' => 'high',
                    ];
                }
            }
        }

        return ['value' => null, 'packing_type' => null, 'status' => 'missing'];
    }

    /**
     * Match extracted text values to master data records
     */
    private function matchMasterData(array $parsedHeader): array
    {
        $matches = [];

        // Match Retailer - try customer_name first, then vendor_name as fallback
        $retailerMatched = false;
        if (isset($parsedHeader['customer_name']) && $parsedHeader['customer_name']['value'] !== null) {
            $rawName = $parsedHeader['customer_name']['value'];
            $match = $this->fuzzyMatchModel(Retailer::class, 'name', $rawName);
            if ($match['status'] === 'matched') {
                $matches['retailer_id'] = $match;
                $retailerMatched = true;
            }
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
            $matches['payment_term_id'] = $this->fuzzyMatchModel(PaymentTerm::class, 'name', $rawTerm);
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

        return $matches;
    }

    /**
     * Fuzzy match a value against a model's field
     */
    private function fuzzyMatchModel(string $modelClass, string $field, string $rawValue): array
    {
        $rawValue = trim($rawValue);

        // Try exact match first
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

        // Try reverse partial match (value contains the db record)
        $records = $modelClass::where('is_active', true)->get();
        foreach ($records as $record) {
            if (stripos($rawValue, $record->$field) !== false) {
                return [
                    'value' => $record->id,
                    'raw_text' => $rawValue,
                    'status' => 'matched',
                    'confidence' => 'medium',
                ];
            }
        }

        return [
            'value' => null,
            'raw_text' => $rawValue,
            'status' => 'unrecognized',
            'confidence' => 'low',
        ];
    }

    /**
     * Extract a field using multiple regex patterns
     */
    private function extractField(string $text, array $patterns): array
    {
        foreach ($patterns as $pattern) {
            if (preg_match($pattern, $text, $matches)) {
                $value = trim($matches[1]);
                if (!empty($value)) {
                    return [
                        'value' => $value,
                        'status' => 'parsed',
                        'confidence' => 'high',
                    ];
                }
            }
        }

        return ['value' => null, 'status' => 'missing'];
    }

    /**
     * Extract a date field and normalize to Y-m-d format
     */
    private function extractDateField(string $text, array $patterns): array
    {
        foreach ($patterns as $pattern) {
            if (preg_match($pattern, $text, $matches)) {
                $rawDate = trim($matches[1]);
                $parsed = $this->parseDate($rawDate);
                if ($parsed) {
                    return [
                        'value' => $parsed,
                        'raw_text' => $rawDate,
                        'status' => 'parsed',
                        'confidence' => 'high',
                    ];
                }
            }
        }

        return ['value' => null, 'status' => 'missing'];
    }

    /**
     * Parse various date formats to Y-m-d
     */
    private function parseDate(string $dateStr): ?string
    {
        $formats = [
            'm/d/Y', 'd/m/Y', 'Y-m-d', 'm-d-Y', 'd-m-Y',
            'm/d/y', 'd/m/y', 'Y/m/d',
            'M d, Y', 'F d, Y', 'M d Y', 'F d Y',
            'd M Y', 'd F Y', 'd-M-Y', 'd-F-Y',
        ];

        foreach ($formats as $format) {
            try {
                $date = \DateTime::createFromFormat($format, trim($dateStr));
                if ($date && $date->format($format) === trim($dateStr)) {
                    return $date->format('Y-m-d');
                }
            } catch (\Exception $e) {
                continue;
            }
        }

        // Try strtotime as fallback
        $timestamp = strtotime($dateStr);
        if ($timestamp !== false && $timestamp > 0) {
            return date('Y-m-d', $timestamp);
        }

        return null;
    }

    /**
     * Extract multi-line field value (like an address block)
     */
    private function extractMultiLineField(array $lines, array $startLabels): array
    {
        foreach ($lines as $index => $line) {
            foreach ($startLabels as $label) {
                if (stripos($line, $label) !== false) {
                    // Get the value on the same line (after the label)
                    $value = preg_replace('/^.*?' . preg_quote($label, '/') . '\s*[:\-]?\s*/i', '', $line);

                    // Also collect subsequent lines that look like address continuation
                    $addressLines = [];
                    if (!empty(trim($value))) {
                        $addressLines[] = trim($value);
                    }

                    for ($j = $index + 1; $j < min($index + 5, count($lines)); $j++) {
                        $nextLine = $lines[$j];
                        // Stop if we hit another label/section or empty line pattern
                        if (preg_match('/^(Payment|Ship\s*Via|FOB|Season|Terms|Date|P\.?O|Style|Item|Qty)/i', $nextLine)) {
                            break;
                        }
                        if (!empty(trim($nextLine))) {
                            $addressLines[] = trim($nextLine);
                        }
                    }

                    if (!empty($addressLines)) {
                        return [
                            'value' => implode(', ', $addressLines),
                            'status' => 'parsed',
                            'confidence' => 'medium',
                        ];
                    }
                }
            }
        }

        return ['value' => null, 'status' => 'missing'];
    }

    /**
     * Check if a line is a footer/total indicator
     */
    private function isFooterLine(string $line): bool
    {
        return (bool) preg_match('/^(Total|Grand\s*Total|Sub[\s\-]?Total|Special\s*Instructions?|Notes?|Remarks?|Authorized|Signature|Approval)/i', trim($line));
    }

    /**
     * Build a standard parsed field structure
     */
    private function buildParsedField($value, ?string $status = null): array
    {
        if ($value === null) {
            return ['value' => null, 'status' => $status ?? 'missing'];
        }

        return [
            'value' => $value,
            'status' => $status ?? 'parsed',
            'confidence' => 'high',
        ];
    }
}
