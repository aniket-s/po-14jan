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
     * Known country names for extraction from vendor address blocks
     */
    private const KNOWN_COUNTRIES = [
        'INDIA', 'CHINA', 'BANGLADESH', 'VIETNAM', 'PAKISTAN', 'CAMBODIA',
        'INDONESIA', 'SRI LANKA', 'MYANMAR', 'TURKEY', 'EGYPT', 'JORDAN',
        'THAILAND', 'PHILIPPINES', 'MOROCCO', 'TUNISIA', 'ETHIOPIA',
        'KENYA', 'MEXICO', 'GUATEMALA', 'HONDURAS', 'EL SALVADOR',
        'NICARAGUA', 'HAITI', 'DOMINICAN REPUBLIC', 'PERU', 'COLOMBIA',
        'BRAZIL', 'PORTUGAL', 'ITALY', 'SPAIN', 'USA', 'KOREA',
    ];

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
                $warnings[] = "Price is \$0.00 for style(s): {$styleList}{$more} - please ask importer or agency to fill the price manually";
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
     * Parse header section from PDF text lines.
     * Handles SCI "Master Cut Ticket" format and standard PO formats.
     */
    private function parseHeaderSection(array $lines): array
    {
        $fullText = implode("\n", $lines);
        $header = [];

        // ── PO Number ──
        // SCI format: "PO#: 2454" or "PO#:2454"
        // Standard: "P.O. Number: XXX", "Purchase Order #: XXX"
        $header['po_number'] = $this->extractField(
            $fullText,
            [
                '/PO\s*#\s*[:\-]?\s*(\d{3,6})/i',
                '/(?:P\.?O\.?\s*(?:Number|No\.?|#)?|Purchase\s*Order\s*(?:Number|No\.?|#)?)\s*[:\-]?\s*([A-Za-z0-9\-\/]+)/i',
                '/\b(PO[\-\s]?\d{4}[\-\s]?\d{2,6})\b/i',
                '/\bOrder\s*(?:Number|No\.?|#)\s*[:\-]?\s*([A-Za-z0-9\-\/]+)/i',
            ]
        );

        // ── PO Date (ISSUE DATE) ──
        // SCI format: "ISSUE DATE: 12-FEB-26"
        // Standard: "P.O. Date: 01/15/2025", "Order Date: Jan 15, 2025"
        $header['po_date'] = $this->extractDateField(
            $fullText,
            [
                '/(?:ISSUE\s*DATE|ISSUED?\s*(?:DATE|DT\.?))\s*[:\-]?\s*(.+?)(?:\n|$)/i',
                '/(?:P\.?O\.?\s*Date|Order\s*Date)\s*[:\-]?\s*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/i',
                '/(?:P\.?O\.?\s*Date|Order\s*Date)\s*[:\-]?\s*(\w+\s+\d{1,2},?\s+\d{4})/i',
                '/(?:Date)\s*[:\-]?\s*(\d{4}[\/-]\d{1,2}[\/-]\d{1,2})/i',
            ]
        );

        // ── Customer / Retailer ──
        // SCI format: "CUST: CITITRENDS"
        // Standard: "Customer: XXX", "Bill To: XXX"
        $header['customer_name'] = $this->extractField(
            $fullText,
            [
                '/(?:CUST|CUSTOMER|CLIENT)\s*[:\-]?\s*(.+?)(?:\n|$)/i',
                '/(?:Retailer|Buyer\s*Company|Bill\s*To|Sold\s*To)\s*(?:Name)?\s*[:\-]?\s*(.+?)(?:\n|$)/i',
            ]
        );

        // ── Vendor / Factory ──
        $header['vendor_name'] = $this->extractField(
            $fullText,
            [
                '/(?:Vendor|Supplier|Factory|Manufacturer)\s*(?:Name)?\s*[:\-]?\s*(.+?)(?:\n|$)/i',
            ]
        );

        // ── ETD / Ship Date ──
        // SCI format: "SHIP: 25-MAY-26"
        // Standard: "ETD: 05/25/2026", "Ship Date: May 25, 2026"
        $header['etd_date'] = $this->extractDateField(
            $fullText,
            [
                '/(?:SHIP|SHIP\s*DATE|SHIPPING\s*DATE)\s*[:\-]?\s*(.+?)(?:\n|$)/i',
                '/(?:ETD|Estimated\s*Time\s*(?:of\s*)?Departure)\s*[:\-]?\s*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/i',
                '/(?:ETD)\s*[:\-]?\s*(\w+\s+\d{1,2},?\s+\d{4})/i',
            ]
        );

        // ── Cancel Date ──
        // SCI format: "CANCEL: 01-JUN-26"
        $header['cancel_date'] = $this->extractDateField(
            $fullText,
            [
                '/(?:CANCEL|CANCEL\s*DATE|CANCELLATION)\s*[:\-]?\s*(.+?)(?:\n|$)/i',
            ]
        );

        // ── In-Warehouse / In-House Date ──
        // SCI format: "NEED 05/22/26 IN HOUSE" (in footer area)
        // Standard: "In-Warehouse Date: 05/22/2026"
        $header['in_warehouse_date'] = $this->extractDateField(
            $fullText,
            [
                '/NEED\s+(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})\s+IN\s*HOUSE/i',
                '/(?:In[\s\-]*Warehouse|IHD|In[\s\-]*House)\s*(?:Date)?\s*[:\-]?\s*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/i',
                '/(?:In[\s\-]*House)\s*[:\-]?\s*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/i',
            ]
        );

        // ── Payment Terms ──
        // SCI format: "TERMS: NET 30"
        // Standard: "Payment Terms: Net 30 days"
        $header['payment_terms_raw'] = $this->extractField(
            $fullText,
            [
                '/TERMS\s*[:\-]?\s*(.+?)(?:\n|$)/i',
                '/(?:Payment\s*Terms?|Terms?\s*of\s*Payment|Pay(?:ment)?\s*Cond(?:ition)?s?)\s*[:\-]?\s*(.+?)(?:\n|$)/i',
            ]
        );

        // ── Shipping Term (FOB / DDP) ──
        $header['shipping_term'] = ['value' => null, 'status' => 'missing'];
        if (preg_match('/\bDDP\b/i', $fullText)) {
            $header['shipping_term'] = ['value' => 'DDP', 'status' => 'parsed', 'confidence' => 'high'];
        } elseif (preg_match('/\bFOB\b/i', $fullText)) {
            $header['shipping_term'] = ['value' => 'FOB', 'status' => 'parsed', 'confidence' => 'high'];
        }

        // ── Ship To / Warehouse ──
        $header['ship_to'] = $this->extractField(
            $fullText,
            [
                '/(?:Ship\s*(?:to)?\s*Warehouse|Ship\s*To|Delivery\s*Address|Deliver\s*To)\s*[:\-]?\s*(.+?)(?:\n|$)/i',
            ]
        );

        $header['ship_to_address'] = $this->extractMultiLineField(
            $lines,
            ['Ship to Warehouse', 'Ship To', 'Delivery Address', 'Deliver To']
        );

        // ── Country of Origin ──
        // First try explicit label, then extract from vendor address block
        $header['country_of_origin'] = $this->extractField(
            $fullText,
            [
                '/(?:Country\s*of\s*Origin|Made\s*In)\s*[:\-]?\s*(.+?)(?:\n|$)/i',
            ]
        );

        // If no explicit country, try to detect from vendor address
        if ($header['country_of_origin']['value'] === null) {
            $header['country_of_origin'] = $this->extractCountryFromText($fullText);
        }

        // ── Labels / Brand ──
        $header['labels'] = $this->extractField(
            $fullText,
            [
                '/LABELS?\s*[:\-]?\s*(.+?)(?:\n|$)/i',
            ]
        );

        // ── Shipping Mode (AIR/SEA) ──
        $header['shipping_mode'] = $this->extractField(
            $fullText,
            [
                '/AIR[\s\/]*SEA\s*[:\-]?\s*(.+?)(?:\n|$)/i',
            ]
        );

        // ── Season ──
        $header['season_raw'] = $this->extractField(
            $fullText,
            [
                '/(?:Season)\s*[:\-]?\s*(.+?)(?:\n|$)/i',
            ]
        );

        // ── Currency detection ──
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

        // ── Revision Number ──
        $header['revision_number'] = $this->extractField(
            $fullText,
            [
                '/(?:Rev(?:ision)?\.?\s*(?:Number|No\.?|#)?)\s*[:\-]?\s*(\d+)/i',
            ]
        );
        if ($header['revision_number']['value'] !== null) {
            $header['revision_number']['value'] = (int) $header['revision_number']['value'];
        }

        // ── Buyer ──
        $header['buyer_name'] = $this->extractField(
            $fullText,
            [
                '/(?:Buyer|Purchased?\s*By|Ordered?\s*By)\s*[:\-]?\s*(.+?)(?:\n|$)/i',
            ]
        );

        // ── Department / Division ──
        $header['department'] = $this->extractField(
            $fullText,
            ['/(?:Department|Dept\.?)\s*[:\-]?\s*(.+?)(?:\n|$)/i']
        );
        $header['division'] = $this->extractField(
            $fullText,
            ['/(?:Division|Div\.?)\s*[:\-]?\s*(.+?)(?:\n|$)/i']
        );

        // ── Notes / Special Instructions ──
        $header['additional_notes'] = $this->extractField(
            $fullText,
            [
                '/(?:Special\s*Instructions?|Notes?|Remarks?|Comments?)\s*[:\-]?\s*(.+?)(?:\n|$)/i',
            ]
        );

        // ── Ex-Factory date ──
        $header['ex_factory_date'] = $this->extractDateField(
            $fullText,
            [
                '/(?:Ex[\s\-]*Factory|Ex[\s\-]*Fty)\s*(?:Date)?\s*[:\-]?\s*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/i',
                '/(?:Ex[\s\-]*Factory|Ex[\s\-]*Fty)\s*(?:Date)?\s*[:\-]?\s*(\w+\s+\d{1,2},?\s+\d{4})/i',
            ]
        );

        // ── ETA date ──
        $header['eta_date'] = $this->extractDateField(
            $fullText,
            [
                '/(?:ETA|Estimated\s*Time\s*(?:of\s*)?Arrival)\s*[:\-]?\s*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/i',
                '/(?:ETA)\s*[:\-]?\s*(\w+\s+\d{1,2},?\s+\d{4})/i',
            ]
        );

        // ── Packing Method ── detect prepack / solid pack / flat pack
        $header['packing_method'] = $this->extractPackingMethod($fullText);

        return $header;
    }

    // ========================================================================
    // LINE ITEM PARSING — Multi-row block approach for SCI format
    // ========================================================================

    /**
     * Parse line items (styles) from PDF text.
     *
     * Handles the SCI "Master Cut Ticket" multi-row format:
     *   Row 1: STYLE  COLOR  Ln  WH  DESCRIPTION  QTY  PRICE EA.  EXTN
     *   Row 2: (optional continuation — Category, PACK info)
     *   Row 3: SIZE >  XS  S  M  L  XL  2XL
     *   Row 4: QTY >   300 600 600 600 300 0
     *
     * Also handles standard single-row-per-item formats.
     */
    private function parseLineItems(array $lines): array
    {
        $styles = [];

        // Find the table header row
        $headerRowIndex = $this->findTableHeaderRow($lines);
        if ($headerRowIndex === null) {
            return $styles;
        }

        // Detect size columns from header row (for standard single-row formats)
        $headerLine = $lines[$headerRowIndex];
        $headerSizeColumns = $this->detectSizeColumns($headerLine);

        // Scan lines after the header and group them into item blocks
        $i = $headerRowIndex + 1;
        while ($i < count($lines)) {
            $line = trim($lines[$i]);

            // Stop at footer
            if ($this->isFooterLine($line)) {
                break;
            }

            // Skip empty / separator lines
            if (empty($line) || preg_match('/^[\-=_\s]+$/', $line)) {
                $i++;
                continue;
            }

            // Check if this line starts a new item block (begins with a style number)
            if ($this->looksLikeStyleNumber($line)) {
                // Collect the entire block (main row + continuation rows)
                $block = [$line];
                $j = $i + 1;
                while ($j < count($lines)) {
                    $nextLine = trim($lines[$j]);
                    if (empty($nextLine) || preg_match('/^[\-=_\s]+$/', $nextLine)) {
                        $j++;
                        continue;
                    }
                    if ($this->isFooterLine($nextLine) || $this->looksLikeStyleNumber($nextLine)) {
                        break;
                    }
                    $block[] = $nextLine;
                    $j++;
                }

                $parsed = $this->parseItemBlock($block, $headerSizeColumns);
                if ($parsed !== null) {
                    $styles[] = $parsed;
                }
                $i = $j;
            } else {
                $i++;
            }
        }

        return $styles;
    }

    /**
     * Check if a line looks like the start of a new style/item row.
     * Style numbers typically start with 2+ alpha chars followed by digits (e.g. SAT301SBC)
     * or are alphanumeric codes like "ABC-1234".
     */
    private function looksLikeStyleNumber(string $line): bool
    {
        $tokens = preg_split('/\s{2,}|\t/', $line);
        if (empty($tokens)) {
            return false;
        }
        $first = trim($tokens[0]);

        // Skip lines that start with footer/total keywords
        if (preg_match('/^(total|sub[\s\-]?total|grand|notes?|special|instructions?|size|qty|category|pack\s)/i', $first)) {
            return false;
        }

        // SCI style: 2+ uppercase letters followed by digits (SAT301SBC, SAT301SBCX)
        if (preg_match('/^[A-Z]{2,}\d{2,}/i', $first)) {
            return true;
        }

        // Standard style number patterns: alphanumeric with dashes/slashes
        if (preg_match('/^[A-Z0-9]{2,}[\-\/][A-Z0-9]+/i', $first)) {
            return true;
        }

        // Numeric style codes (5+ digits)
        if (preg_match('/^\d{5,}$/', $first)) {
            return true;
        }

        // Alphanumeric 4+ chars that isn't a common word
        if (preg_match('/^[A-Z0-9\-]{4,}$/i', $first) && !preg_match('/^(STYLE|COLOR|DESC|ITEM|SIZE|PACK|FLAT|NEED|SHIP|CUST|TERM)/i', $first)) {
            return true;
        }

        return false;
    }

    /**
     * Parse a multi-row item block into a structured line item.
     *
     * Block example:
     *   [0] "SAT301SBC  001 BLACK  1  FE  SUPER BOXY TEE  2400  3.36  8,064.00"
     *   [1] "Category:                    PACK 6"
     *   [2] "SIZE >  XS  S  M  L  XL  2XL"
     *   [3] "QTY >   300 600 600 600 300 0"
     */
    private function parseItemBlock(array $block, array $headerSizeColumns): ?array
    {
        if (empty($block)) {
            return null;
        }

        $mainRow = $block[0];
        $tokens = preg_split('/\s{2,}|\t/', $mainRow);
        $tokens = array_values(array_filter($tokens, fn($t) => trim($t) !== ''));

        if (count($tokens) < 2) {
            return null;
        }

        // First token = style number
        $styleNumber = trim($tokens[0]);

        // Separate remaining tokens into text and numeric
        $textTokens = [];
        $numericTokens = [];

        for ($i = 1; $i < count($tokens); $i++) {
            $token = trim($tokens[$i]);
            $cleaned = preg_replace('/[,$]/', '', $token);

            if (is_numeric($cleaned)) {
                $numericTokens[] = $cleaned;
            } else {
                $textTokens[] = $token;
            }
        }

        // Extract color (usually first text token — "001 BLACK" or just "BLACK")
        $colorName = null;
        $description = null;

        if (!empty($textTokens)) {
            // Check if first text token looks like a color code (digits + name)
            $first = $textTokens[0];
            if (preg_match('/^\d{1,3}\s+\w+/', $first) || preg_match('/^(BLACK|WHITE|RED|BLUE|GREEN|NAVY|GREY|GRAY|PINK|TAN|CAN|PINE|CAR|MUSLI)/i', $first)) {
                $colorName = $first;
                $description = isset($textTokens[1]) ? $textTokens[1] : null;
                // If there are more text tokens, append to description
                for ($t = 2; $t < count($textTokens); $t++) {
                    $description .= ' ' . $textTokens[$t];
                }
            } else {
                // First text token might be line number / warehouse code — skip short ones
                // Look for a longer descriptive token
                foreach ($textTokens as $idx => $tt) {
                    if (strlen($tt) >= 3 && !preg_match('/^\d+$/', $tt) && !preg_match('/^[A-Z]{1,2}$/i', $tt)) {
                        if ($colorName === null && preg_match('/^\d{1,3}\s+\w+/', $tt)) {
                            $colorName = $tt;
                        } elseif ($description === null && strlen($tt) > 3) {
                            $description = $tt;
                        } elseif ($colorName === null && $description !== null) {
                            $colorName = $tt;
                        }
                    }
                }
            }
        }

        // Extract QTY, PRICE, EXTN from numeric tokens on main row
        $totalQty = null;
        $unitPrice = null;
        $totalAmount = null;

        $numCount = count($numericTokens);
        if ($numCount >= 3) {
            // Last 3 numbers: QTY, PRICE, EXTN
            $totalAmount = (float) $numericTokens[$numCount - 1];
            $unitPrice = (float) $numericTokens[$numCount - 2];
            $totalQty = (int) $numericTokens[$numCount - 3];
        } elseif ($numCount == 2) {
            $unitPrice = (float) $numericTokens[$numCount - 1];
            $totalQty = (int) $numericTokens[$numCount - 2];
        } elseif ($numCount == 1) {
            $totalQty = (int) $numericTokens[0];
        }

        // Parse SIZE > and QTY > rows from the block for size breakdown
        $sizeBreakdown = [];
        $sizeLabels = [];
        $sizeQties = [];

        foreach ($block as $blockLine) {
            $trimmed = trim($blockLine);

            // SIZE > row
            if (preg_match('/^SIZE\s*>/i', $trimmed)) {
                $afterArrow = preg_replace('/^SIZE\s*>\s*/i', '', $trimmed);
                $sizeLabels = preg_split('/\s+/', trim($afterArrow));
                $sizeLabels = array_values(array_filter($sizeLabels, fn($s) => !empty(trim($s))));
            }

            // QTY > row
            if (preg_match('/^QTY\s*>/i', $trimmed)) {
                $afterArrow = preg_replace('/^QTY\s*>\s*/i', '', $trimmed);
                $sizeQties = preg_split('/\s+/', trim($afterArrow));
                $sizeQties = array_values(array_filter($sizeQties, fn($s) => trim($s) !== ''));
            }

            // Look for description continuation in sub-rows
            if ($trimmed !== $mainRow && $description === null) {
                // If the line has substantial text (not SIZE/QTY/Category/PACK)
                if (!preg_match('/^(SIZE|QTY|Category|PACK|FLAT|USE\s)/i', $trimmed) && strlen($trimmed) > 5) {
                    $description = $trimmed;
                }
            }

            // Extract PACK info into packing details
            if (preg_match('/PACK\s*(\d+)/i', $trimmed, $packMatch)) {
                // Store in a way that can be used later
            }
        }

        // Build size breakdown from SIZE > and QTY > rows
        if (!empty($sizeLabels) && !empty($sizeQties)) {
            $minCount = min(count($sizeLabels), count($sizeQties));
            for ($k = 0; $k < $minCount; $k++) {
                $qty = (int) $sizeQties[$k];
                if ($qty > 0) {
                    $sizeBreakdown[$sizeLabels[$k]] = $qty;
                }
            }
        }

        // If we got size breakdown but no totalQty from main row, calculate from sizes
        if (!empty($sizeBreakdown) && ($totalQty === null || $totalQty === 0)) {
            $totalQty = array_sum($sizeBreakdown);
        }

        // Skip if no style number or no quantity
        if (empty($styleNumber) || ($totalQty === null && empty($sizeBreakdown))) {
            return null;
        }

        // Calculate total amount if missing
        if ($totalAmount === null && $totalQty !== null && $unitPrice !== null) {
            $totalAmount = round($totalQty * $unitPrice, 2);
        }

        return [
            'style_number' => $this->buildParsedField($styleNumber),
            'description' => $this->buildParsedField($description ? trim($description) : null),
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
     * Find the table header row index.
     * Looks for rows containing "STYLE" + ("QTY" or "PRICE").
     */
    private function findTableHeaderRow(array $lines): ?int
    {
        foreach ($lines as $index => $line) {
            $lower = strtolower($line);

            $hasStyleCol = preg_match('/(style|item|sku|product)/i', $lower);
            $hasQtyCol = preg_match('/(qty|quantity|total\s*qty|pcs)/i', $lower);
            $hasPriceCol = preg_match('/(price|cost|rate|amount|fob|extn)/i', $lower);

            if ($hasStyleCol && ($hasQtyCol || $hasPriceCol)) {
                return $index;
            }
        }

        return null;
    }

    /**
     * Detect size column names from header row (for standard single-row formats)
     */
    private function detectSizeColumns(string $headerLine): array
    {
        $sizes = [];
        $standardSizes = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL', '3XL', '4XL', '5XL', 'XXXL',
                          '2', '4', '6', '8', '10', '12', '14', '16',
                          '28', '29', '30', '31', '32', '33', '34', '36', '38', '40', '42'];

        foreach ($standardSizes as $size) {
            if (preg_match('/\b' . preg_quote($size, '/') . '\b/i', $headerLine)) {
                $sizes[] = $size;
            }
        }

        return $sizes;
    }

    // ========================================================================
    // FOOTER PARSING
    // ========================================================================

    /**
     * Parse footer section for totals.
     * SCI format: "Total Items: 3", "Total Extn: $24,192.00", "Total Order Qty: 7200"
     * Standard: "Total Qty: 7200", "Grand Total: $24,192.00"
     */
    private function parseFooter(array $lines): array
    {
        $footer = [];
        $fullText = implode("\n", $lines);

        // Total Quantity — various formats
        if (preg_match('/Total\s+(?:Order\s+)?(?:Qty|Quantity|Pcs|Pieces)\s*[:\-]?\s*([\d,]+)/i', $fullText, $m)) {
            $footer['total_quantity'] = (int) str_replace(',', '', $m[1]);
        } elseif (preg_match('/Total\s+Pcs\s*[:\-]?\s*([\d,]+)/i', $fullText, $m)) {
            $footer['total_quantity'] = (int) str_replace(',', '', $m[1]);
        }

        // Total Value — various formats
        if (preg_match('/Total\s+Extn\s*[:\-]?\s*[\$]?\s*([\d,]+\.?\d*)/i', $fullText, $m)) {
            $footer['total_value'] = (float) str_replace(',', '', $m[1]);
        } elseif (preg_match('/(?:Total|Grand\s*Total)\s*(?:Value|Amount|Cost)\s*[:\-]?\s*[\$]?\s*([\d,]+\.?\d*)/i', $fullText, $m)) {
            $footer['total_value'] = (float) str_replace(',', '', $m[1]);
        }

        // Total Items count
        if (preg_match('/Total\s+Items\s*[:\-]?\s*(\d+)/i', $fullText, $m)) {
            $footer['total_items'] = (int) $m[1];
        }

        return $footer;
    }

    // ========================================================================
    // PACKING METHOD EXTRACTION
    // ========================================================================

    /**
     * Extract packing method with prepack / solid pack detection.
     * SCI format: "FLAT PACK S-2XL 8PREPACK" or "PACK 6"
     */
    private function extractPackingMethod(string $fullText): array
    {
        // Full packing instruction line: "FLAT PACK S-2XL 8PREPACK INTO 1 POLYBAG"
        if (preg_match('/(FLAT\s+PACK\s+.+?(?:POLYBAG|PREPACK|$))/im', $fullText, $m)) {
            $value = trim($m[1]);
            $packingType = preg_match('/PREPACK/i', $value) ? 'prepack' : 'other';
            $prepackQty = null;
            if (preg_match('/(\d+)\s*(?:PC\s*)?PREPACK/i', $value, $pq)) {
                $prepackQty = (int) $pq[1];
            }
            return [
                'value' => $value,
                'packing_type' => $packingType,
                'prepack_qty' => $prepackQty,
                'status' => 'parsed',
                'confidence' => 'high',
            ];
        }

        // Numeric prepack: "8PREPACK INTO 1 POLYBAG" or "8PREPACK"
        if (preg_match('/(\d+)\s*(?:PC\s*)?PREPACK\s*(?:INTO\s*\d+\s*\w+)?/i', $fullText, $m)) {
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

        if (preg_match('/SOLID\s*PACK/i', $fullText)) {
            return [
                'value' => 'SOLID PACK',
                'packing_type' => 'solid',
                'status' => 'parsed',
                'confidence' => 'high',
            ];
        }

        // Generic packing method label
        if (preg_match('/(?:Pack(?:ing|age)?\s*Method|Pack(?:ing)?\s*Type|Packing)\s*[:\-]?\s*(.+?)(?:\n|$)/i', $fullText, $m)) {
            $value = trim($m[1]);
            if (!empty($value)) {
                $packingType = 'other';
                if (preg_match('/prepack/i', $value)) $packingType = 'prepack';
                elseif (preg_match('/solid/i', $value)) $packingType = 'solid';
                return [
                    'value' => $value,
                    'packing_type' => $packingType,
                    'status' => 'parsed',
                    'confidence' => 'high',
                ];
            }
        }

        return ['value' => null, 'packing_type' => null, 'status' => 'missing'];
    }

    // ========================================================================
    // COUNTRY EXTRACTION FROM TEXT
    // ========================================================================

    /**
     * Try to extract a country name from the full text by looking for known country names,
     * especially in the vendor address block.
     */
    private function extractCountryFromText(string $fullText): array
    {
        $upperText = strtoupper($fullText);
        foreach (self::KNOWN_COUNTRIES as $country) {
            // Look for the country name as a standalone word (not part of a longer word)
            if (preg_match('/\b' . preg_quote($country, '/') . '\b/', $upperText)) {
                return [
                    'value' => ucwords(strtolower($country)),
                    'status' => 'parsed',
                    'confidence' => 'medium',
                ];
            }
        }

        return ['value' => null, 'status' => 'missing'];
    }

    // ========================================================================
    // MASTER DATA MATCHING
    // ========================================================================

    /**
     * Match extracted text values to master data records.
     * Uses customer_name (not vendor_name) for retailer matching.
     */
    private function matchMasterData(array $parsedHeader): array
    {
        $matches = [];

        // Match Retailer — customer_name first (CUST: CITITRENDS), then vendor_name fallback
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
                // Try matching by code (e.g. "NET 30" might match code "NET30")
                $match = $this->fuzzyMatchModel(PaymentTerm::class, 'code', str_replace(' ', '', $rawTerm));
            }
            $matches['payment_term_id'] = $match;
        }

        // Match Country — use country_of_origin (extracted from vendor address)
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

        // Try reverse partial match (raw value contains the db record name)
        try {
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
        } catch (\Exception $e) {
            // is_active column may not exist on all models
        }

        return [
            'value' => null,
            'raw_text' => $rawValue,
            'status' => 'unrecognized',
            'confidence' => 'low',
        ];
    }

    // ========================================================================
    // HELPER METHODS
    // ========================================================================

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
     * Parse various date formats to Y-m-d.
     *
     * Handles:
     * - "12-FEB-26" (d-M-y with uppercase month, 2-digit year) — SCI format
     * - "12-FEB-2026" (d-M-Y)
     * - "01/15/2025" (m/d/Y)
     * - "Jan 15, 2025" (M d, Y)
     * - "2025-01-15" (Y-m-d)
     */
    private function parseDate(string $dateStr): ?string
    {
        $dateStr = trim($dateStr);

        // Normalize uppercase month abbreviations: "12-FEB-26" → "12-Feb-26"
        $normalized = preg_replace_callback('/[A-Z]{3,}/', function ($m) {
            return ucfirst(strtolower($m[0]));
        }, $dateStr);

        $formats = [
            'd-M-y',    // 12-Feb-26 (SCI format — 2-digit year)
            'd-M-Y',    // 12-Feb-2026
            'd/M/y',    // 12/Feb/26
            'd/M/Y',    // 12/Feb/2026
            'm/d/Y',    // 01/15/2025
            'd/m/Y',    // 15/01/2025
            'Y-m-d',    // 2025-01-15
            'm-d-Y',    // 01-15-2025
            'd-m-Y',    // 15-01-2025
            'm/d/y',    // 01/15/25
            'd/m/y',    // 15/01/25
            'Y/m/d',    // 2025/01/15
            'M d, Y',   // Jan 15, 2025
            'F d, Y',   // January 15, 2025
            'M d Y',    // Jan 15 2025
            'F d Y',    // January 15 2025
            'd M Y',    // 15 Jan 2025
            'd F Y',    // 15 January 2025
            'd-M-Y',    // 15-Jan-2025 (already above but for clarity)
            'd-F-Y',    // 15-January-2025
        ];

        foreach ($formats as $format) {
            try {
                $date = \DateTime::createFromFormat($format, $normalized);
                if ($date) {
                    // Verify the parsed date matches (avoid false positives)
                    $formatted = $date->format($format);
                    if ($formatted === $normalized) {
                        return $date->format('Y-m-d');
                    }
                }
            } catch (\Exception $e) {
                continue;
            }
        }

        // Also try with the original (non-normalized) string
        foreach ($formats as $format) {
            try {
                $date = \DateTime::createFromFormat($format, $dateStr);
                if ($date) {
                    $formatted = $date->format($format);
                    if ($formatted === $dateStr) {
                        return $date->format('Y-m-d');
                    }
                }
            } catch (\Exception $e) {
                continue;
            }
        }

        // Try strtotime as fallback (handles "February 12, 2026", etc.)
        $timestamp = strtotime($normalized);
        if ($timestamp !== false && $timestamp > 0) {
            return date('Y-m-d', $timestamp);
        }

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
                    $value = preg_replace('/^.*?' . preg_quote($label, '/') . '\s*[:\-]?\s*/i', '', $line);

                    $addressLines = [];
                    if (!empty(trim($value))) {
                        $addressLines[] = trim($value);
                    }

                    for ($j = $index + 1; $j < min($index + 5, count($lines)); $j++) {
                        $nextLine = $lines[$j];
                        // Stop at another section
                        if (preg_match('/^(Payment|Ship\s*Via|FOB|DDP|Season|Terms|Date|P\.?O|Style|Item|Qty|CUST|LABELS|Vendor|ISSUE|SHIP|CANCEL|PRE[\-\s]?TICKET|SAMPLE|AIR)/i', $nextLine)) {
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
        return (bool) preg_match('/^(Total\s+Items|Total\s+Extn|Total\s+Order|Total\s+Pcs|Total\s+Qty|Grand\s*Total|Sub[\s\-]?Total|Special\s*Instructions?|Notes?|Remarks?|Authorized|Signature|Approval|NEED\s+\d)/i', trim($line));
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
