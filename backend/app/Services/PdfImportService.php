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
use Spatie\PdfToText\Pdf;
use Spatie\PdfToText\Exceptions\BinaryNotFoundException;
use Spatie\PdfToText\Exceptions\CouldNotExtractText;

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
            $text = $this->extractTextPreservingLayout($filePath);

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

            // Check for duplicate style numbers
            $styleNumbers = [];
            foreach ($lineItems as $item) {
                $sn = $item['style_number']['value'] ?? '';
                if (!empty($sn)) {
                    $styleNumbers[] = $sn;
                }
            }
            $duplicates = array_unique(array_diff_assoc($styleNumbers, array_unique($styleNumbers)));
            if (!empty($duplicates)) {
                $warnings[] = 'Duplicate style number(s) found: ' . implode(', ', array_unique($duplicates)) . ' - please review';
            }

            // Cross-validate size breakdown sums against total quantity per style
            foreach ($lineItems as $idx => $item) {
                $sizeBreakdown = $item['size_breakdown']['value'] ?? null;
                $itemQty = $item['quantity']['value'] ?? 0;
                if (is_array($sizeBreakdown) && !empty($sizeBreakdown) && $itemQty > 0) {
                    $sizeSum = array_sum($sizeBreakdown);
                    if ($sizeSum !== $itemQty) {
                        $styleName = $item['style_number']['value'] ?? 'Row ' . ($idx + 1);
                        $warnings[] = "Style '{$styleName}': size breakdown total ({$sizeSum}) does not match quantity ({$itemQty})";
                    }
                }
            }

            // Cross-validate parsed totals vs calculated totals
            if ($totalQty > 0 && $calculatedQty > 0 && abs($totalQty - $calculatedQty) >= 2) {
                $warnings[] = "PDF footer total quantity ({$totalQty}) differs from calculated sum ({$calculatedQty}) - please verify";
            }
            if ($totalValue > 0 && $calculatedValue > 0 && abs($totalValue - $calculatedValue) > 0.01) {
                $diff = round(abs($totalValue - $calculatedValue), 2);
                $warnings[] = "PDF footer total value (\${$totalValue}) differs from calculated sum (\${$calculatedValue}) by \${$diff} - please verify";
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

    // ========================================================================
    // TEXT EXTRACTION PIPELINE
    // ========================================================================

    /**
     * Extract text from PDF preserving visual layout.
     * Tries multiple strategies in order of quality.
     */
    private function extractTextPreservingLayout(string $filePath): string
    {
        // Strategy 1: spatie/pdf-to-text with -layout (best quality when available)
        $text = $this->extractWithSpatiePdfToText($filePath);
        if ($text !== null) {
            Log::debug('PDF text extracted via spatie/pdf-to-text (pdftotext -layout)');
            return $text;
        }

        // Strategy 2: Smalot position-aware reconstruction
        $text = $this->extractWithSmalotPositionAware($filePath);
        if ($text !== null) {
            Log::debug('PDF text extracted via Smalot position-aware reconstruction');
            return $text;
        }

        // Strategy 3: Smalot basic getText() (original fallback)
        Log::debug('PDF text extracted via Smalot getText() fallback');
        $parser = new Parser();
        $pdf = $parser->parseFile($filePath);
        return $pdf->getText();
    }

    /**
     * Extract text using spatie/pdf-to-text with layout option (poppler-utils).
     * Produces the best layout-preserving output with properly aligned columns.
     */
    private function extractWithSpatiePdfToText(string $filePath): ?string
    {
        try {
            $text = Pdf::getText($filePath, null, ['layout']);
            if (!empty(trim($text))) {
                return $text;
            }
        } catch (BinaryNotFoundException $e) {
            Log::debug('pdftotext binary not found (poppler-utils not installed): ' . $e->getMessage());
        } catch (CouldNotExtractText $e) {
            Log::debug('pdftotext could not extract text: ' . $e->getMessage());
        } catch (\Exception $e) {
            Log::debug('spatie/pdf-to-text extraction failed: ' . $e->getMessage());
        }
        return null;
    }

    /**
     * Extract text using Smalot PdfParser with position-aware reconstruction.
     * Groups text elements by Y-coordinate and sorts by X-coordinate
     * to reconstruct the visual layout of the PDF.
     */
    private function extractWithSmalotPositionAware(string $filePath): ?string
    {
        try {
            $parser = new Parser();
            $pdf = $parser->parseFile($filePath);
            $pages = $pdf->getPages();
            $allLines = [];

            foreach ($pages as $page) {
                $dataTm = $page->getDataTm();
                if (empty($dataTm)) {
                    continue;
                }

                // Group text elements by y-coordinate (with tolerance)
                $rows = [];
                foreach ($dataTm as $item) {
                    if (!is_array($item) || count($item) < 2) {
                        continue;
                    }
                    $matrix = $item[0];
                    $text = $item[1] ?? '';
                    if (empty(trim($text))) {
                        continue;
                    }

                    $x = is_array($matrix) && isset($matrix[4]) ? (float) $matrix[4] : 0;
                    $y = is_array($matrix) && isset($matrix[5]) ? (float) $matrix[5] : 0;

                    // Find existing row group within tolerance (3 points)
                    $foundRow = false;
                    foreach ($rows as &$row) {
                        if (abs($row['y'] - $y) < 3.0) {
                            $row['items'][] = ['x' => $x, 'text' => $text];
                            $foundRow = true;
                            break;
                        }
                    }
                    unset($row);

                    if (!$foundRow) {
                        $rows[] = ['y' => $y, 'items' => [['x' => $x, 'text' => $text]]];
                    }
                }

                // Sort rows top-to-bottom (PDF y-axis is bottom-up, so descending)
                usort($rows, fn ($a, $b) => $b['y'] <=> $a['y']);

                // Build lines: sort items left-to-right, join with spacing based on gap
                foreach ($rows as $row) {
                    $items = $row['items'];
                    usort($items, fn ($a, $b) => $a['x'] <=> $b['x']);

                    $lineText = '';
                    $prevEnd = 0;
                    foreach ($items as $idx => $item) {
                        if ($idx > 0) {
                            $gap = $item['x'] - $prevEnd;
                            if ($gap > 50) {
                                $lineText .= '    '; // large gap = column separator
                            } elseif ($gap > 15) {
                                $lineText .= '  '; // medium gap
                            } elseif ($gap > 2) {
                                $lineText .= ' '; // small gap
                            }
                        }
                        $lineText .= $item['text'];
                        // Estimate end position (rough: x + text length * average char width)
                        $prevEnd = $item['x'] + strlen($item['text']) * 5.5;
                    }
                    $allLines[] = $lineText;
                }
            }

            $result = implode("\n", $allLines);
            return empty(trim($result)) ? null : $result;
        } catch (\Exception $e) {
            Log::debug('Smalot position-aware extraction failed: ' . $e->getMessage());
            return null;
        }
    }

    // ========================================================================
    // HEADER PARSING
    // ========================================================================

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
                '/(?:VC\s+)?PO\s*#\s*[:\-]?\s*(\d{3,10})/i',
                '/\b(\d{4,10})\s+ORIGINAL\b/i',
                '/(?:P\.?O\.?\s*(?:Number|No\.?|#)?|Purchase\s*Order\s*(?:Number|No\.?|#)?)\s*[:\-]?\s*([A-Za-z0-9][\w\-\/\.]{1,49})/i',
                '/\b(PO[\-\s]?\d{4}[\-\s]?\d{2,10})\b/i',
                '/\bOrder\s*(?:Number|No\.?|#)\s*[:\-]?\s*([A-Za-z0-9][\w\-\/\.]{1,49})/i',
            ]
        );

        // ── PO Date (ISSUE DATE) ──
        // SCI format: "ISSUE DATE: 12-FEB-26"
        // Standard: "P.O. Date: 01/15/2025", "Order Date: Jan 15, 2025"
        $header['po_date'] = $this->extractDateField(
            $fullText,
            [
                '/(?:ISSUE\s*DATE|ISSUED?\s*(?:DATE|DT\.?))\s*[:\-]?\s*(.+?)(?:\n|$)/i',
                '/ORIGINAL\s+(\d{1,2}[\/-]\w{3}[\/-]\d{2,4})/i',
                '/(?:P\.?O\.?\s*Date|Order\s*Date)\s*[:\-]?\s*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/i',
                '/(?:P\.?O\.?\s*Date|Order\s*Date)\s*[:\-]?\s*(\w+\s+\d{1,2},?\s+\d{4})/i',
                '/(?:Date)\s*[:\-]?\s*(\d{4}[\/-]\d{1,2}[\/-]\d{1,2})/i',
            ]
        );

        // ── Customer / Retailer ──
        // SCI format: two-row header (CUST label above, value below) or "CUST: CITITRENDS"
        // With pdftotext -layout: "CUST            CITITRENDS    ISSUE DATE..."
        // Standard: "Customer: XXX", "Bill To: XXX"
        $header['customer_name'] = $this->extractField(
            $fullText,
            [
                '/(?:CUST|CUSTOMER|CLIENT)\s*[:\-]\s*(.+?)(?:\n|$)/i',
                // SCI layout: CUST followed by spaces then name, stop before next label
                '/\bCUST\s{2,}([A-Z][A-Z\s]*?)(?:\s{2,}|ISSUE|LABELS|SHIP|CANCEL|\n|$)/i',
                '/(?:Retailer|Buyer\s*Company|Bill\s*To|Sold\s*To)\s*(?:Name)?\s*[:\-]?\s*(.+?)(?:\n|$)/i',
            ]
        );

        // If label-based extraction failed or captured a header label, try SCI two-row header
        if ($header['customer_name']['value'] === null
            || preg_match('/^(LABELS|SAMPLE|PRE|SHIP|CANCEL)/i', $header['customer_name']['value'])) {
            $sciHeader = $this->parseSciTwoRowHeader($lines);
            if (!empty($sciHeader['customer'])) {
                $header['customer_name'] = [
                    'value' => $sciHeader['customer'],
                    'status' => 'parsed',
                    'confidence' => 'high',
                ];
            }
        }

        // Last resort: detect well-known retailer names directly in text
        if ($header['customer_name']['value'] === null) {
            $retailerPatterns = '/\b(CITITRENDS|CITI\s*TRENDS|WALMART|TARGET|ROSS\s*STORES?|TJX|MARSHALLS|BURLINGTON|NORDSTROM|MACYS|KOHLS|JC\s*PENNEY|OLD\s*NAVY|GAP|PRIMARK|SHEIN|FIVE\s*BELOW|DOLLAR\s*TREE|FAMILY\s*DOLLAR)\b/i';
            if (preg_match($retailerPatterns, $fullText, $rm)) {
                $header['customer_name'] = [
                    'value' => strtoupper(trim($rm[1])),
                    'status' => 'parsed',
                    'confidence' => 'medium',
                ];
            }
        }

        // ── Vendor / Factory ──
        $header['vendor_name'] = $this->extractField(
            $fullText,
            [
                '/(?:Vendor|Supplier|Factory|Manufacturer)\s*(?:Name)?\s*[:\-]?\s*(.+?)(?:\n|$)/i',
                '/Purchase\s*Vendor\s*[:\-]?\s*(.+?)(?:\n|$)/i',
            ]
        );

        // If no vendor found, try to find factory name near country or totals
        if ($header['vendor_name']['value'] === null) {
            // Look for "CompanyName" right before totals line
            if (preg_match('/^([A-Z][A-Za-z\s]+(?:Apparels?|Garments?|Textiles?|Fashions?|Clothing|Industries|Exports?|Int(?:ernational|l)?|Ltd|Pvt|Inc)[\w\s.]*?)[\r\n]/m', $fullText, $vm)) {
                $header['vendor_name'] = [
                    'value' => trim($vm[1]),
                    'status' => 'parsed',
                    'confidence' => 'medium',
                ];
            }
        }

        // ── ETD / Ship Date ──
        // SCI format: "SHIP25-MAY-26" or "SHIP 25-MAY-26" (standalone keyword, no "DATE")
        // Standard: "Ship Date: May 25, 2026", "ETD: 05/25/2026"
        $header['etd_date'] = $this->extractDateField(
            $fullText,
            [
                '/(?:SHIP\s*DATE|SHIPPING\s*DATE)\s*[:\-]?\s*(.+?)(?:\n|$)/i',
                // SCI: standalone SHIP followed by date (with or without space/colon)
                '/\bSHIP\s*[:\-]?\s*(\d{1,2}[\/-]\w{3}[\/-]\d{2,4})/i',
                '/(?:ETD|Estimated\s*Time\s*(?:of\s*)?Departure)\s*[:\-]?\s*(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/i',
                '/(?:ETD)\s*[:\-]?\s*(\w+\s+\d{1,2},?\s+\d{4})/i',
            ]
        );

        // If label-based extraction failed, try SCI two-row header for ship date
        if ($header['etd_date']['value'] === null) {
            if (!isset($sciHeader)) {
                $sciHeader = $this->parseSciTwoRowHeader($lines);
            }
            if (!empty($sciHeader['ship_date'])) {
                $parsed = $this->parseDate($sciHeader['ship_date']);
                if ($parsed) {
                    $header['etd_date'] = [
                        'value' => $parsed,
                        'raw_text' => $sciHeader['ship_date'],
                        'status' => 'parsed',
                        'confidence' => 'high',
                    ];
                }
            }
        }

        // ── Cancel Date ──
        // SCI format: "CANCEL01-JUN-26" or "CANCEL 01-JUN-26" (standalone keyword)
        $header['cancel_date'] = $this->extractDateField(
            $fullText,
            [
                '/(?:CANCEL\s*DATE|CANCELLATION\s*DATE)\s*[:\-]?\s*(.+?)(?:\n|$)/i',
                // SCI: standalone CANCEL followed by date (with or without space/colon)
                '/\bCANCEL\s*[:\-]?\s*(\d{1,2}[\/-]\w{3}[\/-]\d{2,4})/i',
            ]
        );

        // Try SCI two-row header for cancel date
        if ($header['cancel_date']['value'] === null) {
            if (!isset($sciHeader)) {
                $sciHeader = $this->parseSciTwoRowHeader($lines);
            }
            if (!empty($sciHeader['cancel_date'])) {
                $parsed = $this->parseDate($sciHeader['cancel_date']);
                if ($parsed) {
                    $header['cancel_date'] = [
                        'value' => $parsed,
                        'raw_text' => $sciHeader['cancel_date'],
                        'status' => 'parsed',
                        'confidence' => 'high',
                    ];
                }
            }
        }

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
        // SCI format: "TERMS: NET 30" or "TERMS    DDP    SHIP MODE NET 30"
        // Standard: "Payment Terms: Net 30 days"
        $header['payment_terms_raw'] = $this->extractField(
            $fullText,
            [
                '/TERMS\s*[:\-]?\s*(NET\s+\d+[^,\n]*)/i',
                '/(?:Payment\s*Terms?|Terms?\s*of\s*Payment|Pay(?:ment)?\s*Cond(?:ition)?s?)\s*[:\-]?\s*(.+?)(?:\n|$)/i',
                // Standalone NET pattern — works even when embedded in a noisy line
                '/\b(NET\s+\d+(?:\s*DAYS?)?)\b/i',
                // Broad TERMS capture only as last resort
                '/TERMS\s*[:\-]?\s*(.+?)(?:\n|$)/i',
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
                '/SHIP\s*MODE\s*[:\-]?\s*(AIR|SEA)\b/i',
                '/AIR[\s\/]*SEA\s*[:\-]?\s*(AIR|SEA)\b/i',
                '/AIR[\s\/]*SEA\s*[:\-]?\s*(.+?)(?:\s{2,}|\n|$)/i',
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

    /**
     * Parse SCI two-row column header format.
     *
     * Handles two layouts:
     *
     * Layout A (all labels on one line):
     *   SHIP        CANCEL      CUST          LABELS          SAMPLE  PRE-TICKET
     *   01-JUL-26               CITITRENDS    SAINT ARCHIVES  Y       Y
     *
     * Layout B (pdftotext -layout, labels spread across multiple lines):
     *   Vendor :                          CUST          CITITRENDS    ISSUE DATE12-FEB-26
     *   Crystal Apparels India            LABELS        SAINT ARCHIVES    SHIP25-MAY-26
     *   ...                               PRE-TICKET Y  SAMPLE Y         CANCEL01-JUN-26
     *
     * Returns associative array with extracted values.
     */
    private function parseSciTwoRowHeader(array $lines): array
    {
        $result = [];

        // ── Layout A: All on one line (SHIP + CANCEL + CUST) ──
        foreach ($lines as $index => $line) {
            if (preg_match('/\bSHIP\b/i', $line)
                && preg_match('/\bCANCEL\b/i', $line)
                && preg_match('/\bCUST\b/i', $line)) {

                $valueRow = null;
                for ($j = $index + 1; $j < min($index + 3, count($lines)); $j++) {
                    if (!empty(trim($lines[$j]))) {
                        $valueRow = $lines[$j];
                        break;
                    }
                }
                if ($valueRow === null) {
                    break;
                }

                $shipPos = stripos($line, 'SHIP');
                $cancelPos = stripos($line, 'CANCEL');
                $custPos = stripos($line, 'CUST');
                $labelsPos = stripos($line, 'LABEL');

                if ($shipPos !== false && $cancelPos !== false) {
                    $shipVal = trim(substr($valueRow, $shipPos, $cancelPos - $shipPos));
                    if (!empty($shipVal) && preg_match('/\d/', $shipVal)) {
                        $result['ship_date'] = $shipVal;
                    }
                }

                if ($cancelPos !== false && $custPos !== false) {
                    $cancelVal = trim(substr($valueRow, $cancelPos, $custPos - $cancelPos));
                    if (!empty($cancelVal) && preg_match('/\d/', $cancelVal)) {
                        $result['cancel_date'] = $cancelVal;
                    }
                }

                if ($custPos !== false) {
                    $endPos = $labelsPos !== false ? $labelsPos : strlen($valueRow);
                    $custVal = trim(substr($valueRow, $custPos, $endPos - $custPos));
                    if (!empty($custVal) && !preg_match('/^(LABELS|SAMPLE|PRE)/i', $custVal)) {
                        $result['customer'] = $custVal;
                    }
                }

                if ($labelsPos !== false) {
                    $samplePos = stripos($line, 'SAMPLE');
                    $endPos = $samplePos !== false ? $samplePos : strlen($valueRow);
                    $labelsVal = trim(substr($valueRow, $labelsPos, $endPos - $labelsPos));
                    if (!empty($labelsVal) && !preg_match('/^(SAMPLE|PRE)/i', $labelsVal)) {
                        $result['labels'] = $labelsVal;
                    }
                }

                return $result;
            }
        }

        // ── Layout B: Labels on separate lines (pdftotext -layout) ──
        // Scan each line individually for SCI keyword-value pairs
        foreach ($lines as $line) {
            // CUST followed by value (separated by whitespace)
            if (empty($result['customer']) && preg_match('/\bCUST\s{2,}([A-Z][A-Z\s]*?)(?:\s{2,}|ISSUE|LABELS|SHIP|$)/i', $line, $m)) {
                $result['customer'] = trim($m[1]);
            }

            // LABELS followed by value
            if (empty($result['labels']) && preg_match('/\bLABELS?\s{2,}([A-Z][A-Z\s]*?)(?:\s{2,}|SHIP|CANCEL|PRE|SAMPLE|$)/i', $line, $m)) {
                $result['labels'] = trim($m[1]);
            }

            // SHIP followed by date (on same line)
            if (empty($result['ship_date']) && preg_match('/\bSHIP\s*[:\-]?\s*(\d{1,2}[\/-]\w{3}[\/-]\d{2,4})/i', $line, $m)) {
                $result['ship_date'] = trim($m[1]);
            }

            // CANCEL followed by date (on same line)
            if (empty($result['cancel_date']) && preg_match('/\bCANCEL\s*[:\-]?\s*(\d{1,2}[\/-]\w{3}[\/-]\d{2,4})/i', $line, $m)) {
                $result['cancel_date'] = trim($m[1]);
            }
        }

        return $result;
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
            // No table header found — try columnar fallback for scrambled text
            return $this->parseColumnarLineItems($lines);
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

        // If block-based parsing found nothing, try columnar fallback
        if (empty($styles)) {
            $styles = $this->parseColumnarLineItems($lines);
        }

        return $styles;
    }

    /**
     * Parse line items from columnar/scrambled SCI text.
     *
     * Detects repeated style numbers, parallel color/quantity/price arrays,
     * and reconstructs individual line items from the columnar data.
     *
     * Example scrambled text patterns:
     *   "SAT301SBCX SAT301SBCX SAT301SBCX"  → 3 items with same style
     *   "017 100 104"                         → color codes
     *   "CHARCOAL WHITE CREAM"                → color names
     *   "600 720 600"                         → quantities
     *   "3.76  3.76  3.76"                   → prices
     */
    private function parseColumnarLineItems(array $lines): array
    {
        $fullText = implode("\n", $lines);
        $styles = [];

        // Detect repeated style numbers on a single line
        // Pattern: same alphanumeric style code repeated 2+ times
        $repeatedStyleLine = null;
        $styleNumber = null;
        $itemCount = 0;

        foreach ($lines as $line) {
            $tokens = preg_split('/\s+/', trim($line));
            $tokens = array_values(array_filter($tokens, fn($t) => !empty($t)));
            if (count($tokens) >= 2) {
                // Check if all tokens are the same and look like style numbers
                $unique = array_unique($tokens);
                if (count($unique) === 1
                    && preg_match('/^[A-Z]{2,}\d{2,}/i', $unique[0])
                    && count($tokens) >= 2) {
                    $styleNumber = $unique[0];
                    $itemCount = count($tokens);
                    $repeatedStyleLine = $line;
                    break;
                }
            }
        }

        if ($styleNumber === null || $itemCount < 2) {
            return $styles;
        }

        // Now search for parallel arrays of color codes, color names, quantities, prices, etc.
        $colorCodes = [];
        $colorNames = [];
        $quantities = [];
        $prices = [];
        $extensions = [];
        $description = null;
        $etaDates = [];

        // Known color name patterns
        $colorNamePattern = '/^(BLACK|WHITE|RED|BLUE|GREEN|NAVY|GREY|GRAY|PINK|TAN|CREAM|CHARCOAL|CHAR|PINE|KHAKI|BROWN|ORANGE|YELLOW|PURPLE|OLIVE|CORAL|TEAL|BURGUNDY|IVORY|BEIGE|MAUVE|SAGE|ROSE|FUCHSIA|HEATHER|OATMEAL|MUSTARD|INDIGO|LAVENDER|PLUM|MINT|MOSS|SAND|TAUPE|LILAC|ECRU|WHEAT|STONE|HUNTER|DENIM|RUST|WINE|LEMON|BERRY|BONE|ASH|SLATE|STEEL|PEWTER)/i';

        foreach ($lines as $line) {
            $trimmed = trim($line);
            if (empty($trimmed) || $trimmed === $repeatedStyleLine) {
                continue;
            }

            $tokens = preg_split('/\s+/', $trimmed);
            $tokens = array_values(array_filter($tokens, fn($t) => !empty($t)));

            if (count($tokens) !== $itemCount) {
                // Check for description lines (repeated description)
                if (count($tokens) >= 3 && $description === null) {
                    // Look for repeated multi-word descriptions
                    $descText = $trimmed;
                    if (preg_match('/^((?:[A-Z]+\s+){2,}[A-Z]+)\s+\1/i', $descText)) {
                        // Repeated description — extract just one copy
                        $words = preg_split('/\s+/', $trimmed);
                        $chunkSize = intval(count($words) / $itemCount);
                        if ($chunkSize >= 2) {
                            $description = implode(' ', array_slice($words, 0, $chunkSize));
                        }
                    }
                }
                continue;
            }

            // Check if all tokens are 3-digit color codes
            if (empty($colorCodes) && count(array_filter($tokens, fn($t) => preg_match('/^\d{3}$/', $t))) === $itemCount) {
                $colorCodes = $tokens;
                continue;
            }

            // Check if all tokens are color names
            if (empty($colorNames) && count(array_filter($tokens, fn($t) => preg_match($colorNamePattern, $t))) === $itemCount) {
                $colorNames = $tokens;
                continue;
            }

            // Check if all tokens are integers (potential quantities)
            $allIntegers = count(array_filter($tokens, fn($t) => preg_match('/^\d+$/', $t))) === $itemCount;

            // Check if all tokens are decimal numbers (potential prices)
            $allDecimals = count(array_filter($tokens, fn($t) => preg_match('/^\d+\.\d{2}$/', $t))) === $itemCount;

            // Check if all tokens are formatted amounts (potential extensions)
            $allAmounts = count(array_filter($tokens, fn($t) => preg_match('/^[\d,]+\.\d{2}$/', $t))) === $itemCount;

            if ($allAmounts && empty($extensions)) {
                $extensions = array_map(fn($t) => (float) str_replace(',', '', $t), $tokens);
                continue;
            }

            if ($allDecimals && empty($prices)) {
                $prices = array_map('floatval', $tokens);
                continue;
            }

            // For integers: could be quantities — pick the set with largest values
            if ($allIntegers) {
                $vals = array_map('intval', $tokens);
                $maxVal = max($vals);
                if (empty($quantities) || $maxVal > max($quantities)) {
                    // If quantities already set with smaller values, those were likely something else
                    if (!empty($quantities) && max($quantities) < 100 && $maxVal >= 100) {
                        $quantities = $vals;
                    } elseif (empty($quantities) && $maxVal >= 50) {
                        $quantities = $vals;
                    }
                }
                continue;
            }
        }

        // Try to extract description from repeated text blocks
        if ($description === null) {
            // Look for lines with the same description repeated N times
            foreach ($lines as $line) {
                $trimmed = trim($line);
                if (preg_match('/^((?:[A-Z][A-Z\s]{5,}?))\s{2,}\1/i', $trimmed, $dm)) {
                    $description = trim($dm[1]);
                    break;
                }
            }
        }

        // Look for dates that appear N times or a single ETA date
        if (preg_match_all('/(\d{1,2}[\/-]\w{3}[\/-]\d{2,4})/i', $fullText, $dateMatches)) {
            foreach (array_count_values($dateMatches[1]) as $date => $count) {
                if ($count >= $itemCount) {
                    $etaDates = array_fill(0, $itemCount, $date);
                    break;
                }
            }
        }

        // Build the line items
        for ($i = 0; $i < $itemCount; $i++) {
            $colorDisplay = null;
            if (isset($colorCodes[$i]) && isset($colorNames[$i])) {
                $colorDisplay = $colorCodes[$i] . ' ' . strtoupper($colorNames[$i]);
            } elseif (isset($colorNames[$i])) {
                $colorDisplay = strtoupper($colorNames[$i]);
            } elseif (isset($colorCodes[$i])) {
                $colorDisplay = $colorCodes[$i];
            }

            $qty = $quantities[$i] ?? null;
            $price = $prices[$i] ?? null;
            $extn = $extensions[$i] ?? null;

            // Calculate extension if missing
            if ($extn === null && $qty !== null && $price !== null) {
                $extn = round($qty * $price, 2);
            }

            $styles[] = [
                'style_number' => $this->buildParsedField($styleNumber),
                'description' => $this->buildParsedField($description),
                'color_name' => $this->buildParsedField($colorDisplay),
                'size_breakdown' => $this->buildParsedField(null, 'missing'),
                'quantity' => $this->buildParsedField($qty),
                'unit_price' => $this->buildParsedField($price),
                'total_amount' => $this->buildParsedField($extn),
            ];
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

            // SCI color format: "001 BLACK" or "092 CAN" — extract color code + name
            // from tokens like "001 BLACK 1 FE" (may include Ln and WH)
            if (preg_match('/^(\d{1,3}\s+[A-Z]+)/i', $first, $colorMatch)) {
                $colorName = trim($colorMatch[1]);
                $description = isset($textTokens[1]) ? $textTokens[1] : null;
                for ($t = 2; $t < count($textTokens); $t++) {
                    $description .= ' ' . $textTokens[$t];
                }
            } elseif (preg_match('/^(BLACK|WHITE|RED|BLUE|GREEN|NAVY|GREY|GRAY|PINK|TAN|CAN|CANYON|PINE|CAR|CAROLINA|MUSLI|CREAM|CHARCOAL|KHAKI|BROWN|ORANGE|YELLOW|PURPLE|OLIVE|CORAL|TEAL|BURGUNDY|IVORY|BEIGE|SAGE|ROSE|FUCHSIA|HEATHER|OATMEAL|MUSTARD|INDIGO|LAVENDER|PLUM|MINT|RUST|WINE|BONE|SLATE|STEEL)/i', $first)) {
                $colorName = $first;
                $description = isset($textTokens[1]) ? $textTokens[1] : null;
                for ($t = 2; $t < count($textTokens); $t++) {
                    $description .= ' ' . $textTokens[$t];
                }
            } else {
                // First text token might be line number / warehouse code — skip short ones
                // Look for a longer descriptive token
                foreach ($textTokens as $idx => $tt) {
                    if (strlen($tt) >= 3 && !preg_match('/^\d+$/', $tt) && !preg_match('/^[A-Z]{1,2}$/i', $tt)) {
                        if ($colorName === null && preg_match('/^(\d{1,3}\s+[A-Z]+)/i', $tt, $cm)) {
                            $colorName = trim($cm[1]);
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
            if ($trimmed !== $mainRow) {
                // If the line has substantial text (not SIZE/QTY/Category/PACK/footer)
                if (!preg_match('/^(SIZE|QTY|Category|PACK|FLAT|USE\s|NEED\s)/i', $trimmed) && strlen($trimmed) > 5) {
                    if ($description === null) {
                        $description = $trimmed;
                    } else {
                        // Append continuation text to existing description
                        $description .= ' ' . $trimmed;
                    }
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

        // Auto-correct size breakdown if sum doesn't match explicit quantity
        if (!empty($sizeBreakdown) && $totalQty !== null && $totalQty > 0) {
            $sizeSum = array_sum($sizeBreakdown);
            if ($sizeSum > 0 && $sizeSum !== $totalQty) {
                $scaledBreakdown = [];
                $scaledSum = 0;
                $sizeKeys = array_keys($sizeBreakdown);
                foreach ($sizeKeys as $i => $size) {
                    if ($i === count($sizeKeys) - 1) {
                        $scaledBreakdown[$size] = $totalQty - $scaledSum;
                    } else {
                        $scaled = (int) round($sizeBreakdown[$size] * $totalQty / $sizeSum);
                        $scaledBreakdown[$size] = $scaled;
                        $scaledSum += $scaled;
                    }
                }
                $sizeBreakdown = $scaledBreakdown;
            }
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
     * Uses bidirectional search: first forward from start, then backward from end.
     * Looks for rows containing "STYLE" + ("QTY" or "PRICE" or "EXTN").
     */
    private function findTableHeaderRow(array $lines): ?int
    {
        // Forward search (original behavior — finds first matching row)
        foreach ($lines as $index => $line) {
            if ($this->isTableHeaderLine($line)) {
                return $index;
            }
        }

        // Backward search — some PDFs place the header row after the data
        // (e.g., SCI format with scrambled text extraction)
        for ($i = count($lines) - 1; $i >= 0; $i--) {
            if ($this->isTableHeaderLine($lines[$i])) {
                return $i;
            }
        }

        return null;
    }

    /**
     * Check if a line looks like a table header row.
     */
    private function isTableHeaderLine(string $line): bool
    {
        $lower = strtolower($line);

        $hasStyleCol = preg_match('/(style|item|sku|product)\b/i', $lower);
        $hasQtyCol = preg_match('/(qty|quantity|total\s*qty|pcs)\b/i', $lower);
        $hasPriceCol = preg_match('/(price|cost|rate|amount|fob|extn)\b/i', $lower);
        $hasColorCol = preg_match('/(color|colour)\b/i', $lower);
        $hasDescCol = preg_match('/(desc|description)\b/i', $lower);

        // Standard: STYLE + (QTY or PRICE)
        if ($hasStyleCol && ($hasQtyCol || $hasPriceCol)) {
            return true;
        }

        // SCI: STYLE + COLOR + DESCRIPTION
        if ($hasStyleCol && $hasColorCol && $hasDescCol) {
            return true;
        }

        // SCI compact: has Ln + STYLE + EXTN on same line
        if ($hasStyleCol && preg_match('/\bLn\b/', $line) && $hasPriceCol) {
            return true;
        }

        return false;
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
        $qtyPatterns = [
            '/Total\s+(?:Order\s+)?(?:Qty|Quantity|Pcs|Pieces|Units)\s*[:\-]?\s*([\d,]+)/i',
            '/Total\s+Pcs\s*[:\-]?\s*([\d,]+)/i',
            '/(?:Grand|Sub)[\s\-]?Total\s+(?:Qty|Quantity|Pcs)\s*[:\-]?\s*([\d,]+)/i',
            '/(?:Qty|Quantity)\s+Total\s*[:\-]?\s*([\d,]+)/i',
        ];
        foreach ($qtyPatterns as $pattern) {
            if (preg_match($pattern, $fullText, $m)) {
                $footer['total_quantity'] = (int) str_replace(',', '', $m[1]);
                break;
            }
        }

        // Total Value — various formats
        $valuePatterns = [
            '/Total\s+Extn\s*[:\-]?\s*[\$]?\s*([\d,]+\.?\d*)/i',
            '/(?:Total|Grand\s*Total)\s*(?:Value|Amount|Cost|Price|Extn?)\s*[:\-]?\s*[\$]?\s*([\d,]+\.?\d*)/i',
            '/(?:Grand|Sub)[\s\-]?Total\s*[:\-]?\s*[\$]?\s*([\d,]+\.?\d*)/i',
            '/(?:Total|Net)\s+(?:FOB|Order)\s*(?:Value|Amount)?\s*[:\-]?\s*[\$]?\s*([\d,]+\.?\d*)/i',
        ];
        foreach ($valuePatterns as $pattern) {
            if (preg_match($pattern, $fullText, $m)) {
                $footer['total_value'] = (float) str_replace(',', '', $m[1]);
                break;
            }
        }

        // Total Items count
        if (preg_match('/Total\s+(?:Items|Styles|Line\s*Items?)\s*[:\-]?\s*(\d+)/i', $fullText, $m)) {
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

        // Match Warehouse — from ship_to field (e.g., "FE", "FTDI-EAST")
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
     * Tries: exact → case-insensitive → normalized → partial → reverse partial.
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

        // Try normalized match (strip spaces, hyphens, dots for comparison)
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

        // Try reverse partial match (raw value contains the db record name)
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

        // Try word-boundary matching for the raw value
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
        if (empty($dateStr)) {
            return null;
        }

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
            'n/j/Y',    // 1/15/2025 (no leading zeros)
            'j/n/Y',    // 15/1/2025 (no leading zeros)
            'n/j/y',    // 1/15/25 (no leading zeros, 2-digit year)
            'n-j-Y',    // 1-15-2025 (no leading zeros)
            'M d, Y',   // Jan 15, 2025
            'F d, Y',   // January 15, 2025
            'M d Y',    // Jan 15 2025
            'F d Y',    // January 15 2025
            'd M Y',    // 15 Jan 2025
            'd F Y',    // 15 January 2025
            'd M y',    // 15 Jan 25
            'd-F-Y',    // 15-January-2025
        ];

        // Try each format with lenient validation (check errors instead of roundtrip)
        foreach ([$normalized, $dateStr] as $candidate) {
            foreach ($formats as $format) {
                try {
                    $date = \DateTime::createFromFormat($format, $candidate);
                    if ($date) {
                        $errors = \DateTime::getLastErrors();
                        // Accept if no warnings/errors, or only minor ones
                        if ($errors === false || ($errors['warning_count'] === 0 && $errors['error_count'] === 0)) {
                            $result = $date->format('Y-m-d');
                            // Sanity check: year should be reasonable (1990-2099)
                            $year = (int) $date->format('Y');
                            if ($year >= 1990 && $year <= 2099) {
                                return $result;
                            }
                        }
                    }
                } catch (\Exception $e) {
                    continue;
                }
            }
        }

        // Try strtotime as fallback (handles "February 12, 2026", etc.)
        foreach ([$normalized, $dateStr] as $candidate) {
            $timestamp = strtotime($candidate);
            if ($timestamp !== false && $timestamp > 0) {
                $year = (int) date('Y', $timestamp);
                if ($year >= 1990 && $year <= 2099) {
                    return date('Y-m-d', $timestamp);
                }
            }
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
        return (bool) preg_match('/^(Total\s+Items|Total\s+Extn|Total\s+Order|Total\s+Pcs|Total\s+Qty|Total\s+Quantity|Total\s+Units|Total\s+Amount|Total\s+Value|Total\s+FOB|Net\s+Total|Grand\s*Total|Sub[\s\-]?Total|Special\s*Instructions?|Notes?|Remarks?|Authorized|Signature|Approval|NEED\s+\d)/i', trim($line));
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
