<?php

namespace App\Services;

use App\Models\PurchaseOrder;
use App\Models\Style;
use Illuminate\Support\Facades\Log;
use Maatwebsite\Excel\Facades\Excel;
use PhpOffice\PhpSpreadsheet\IOFactory;

class ExcelImportService
{
    /**
     * Analyze Excel file and suggest column mappings
     */
    public function analyzeFile(string $filePath): array
    {
        try {
            $spreadsheet = IOFactory::load($filePath);
            $worksheet = $spreadsheet->getActiveSheet();

            $highestColumn = $worksheet->getHighestColumn();
            $highestColumnIndex = \PhpOffice\PhpSpreadsheet\Cell\Coordinate::columnIndexFromString($highestColumn);
            $highestRow = $worksheet->getHighestRow();

            // Auto-detect header row by scanning first 10 rows for known column names
            $headerRow = $this->detectHeaderRow($worksheet, $highestColumnIndex, min($highestRow, 10));

            // Get headers from detected header row
            $headers = [];
            for ($col = 1; $col <= $highestColumnIndex; $col++) {
                $cellValue = $worksheet->getCellByColumnAndRow($col, $headerRow)->getValue();
                if ($cellValue) {
                    $headers[] = [
                        'index' => $col - 1,
                        'original_name' => trim((string) $cellValue),
                        'suggested_field' => $this->suggestFieldMapping((string) $cellValue),
                    ];
                }
            }

            $dataStartRow = $headerRow + 1;

            // Get sample rows (first 5 data rows after header)
            $sampleRows = [];
            $maxRows = min($highestRow, $dataStartRow + 4);

            for ($row = $dataStartRow; $row <= $maxRows; $row++) {
                $rowData = [];
                for ($col = 1; $col <= $highestColumnIndex; $col++) {
                    $cellValue = $worksheet->getCellByColumnAndRow($col, $row)->getValue();
                    $rowData[] = $cellValue;
                }
                // Skip completely empty rows
                if (array_filter($rowData, fn($v) => $v !== null && $v !== '') === []) {
                    continue;
                }
                $sampleRows[] = $rowData;
            }

            return [
                'success' => true,
                'headers' => $headers,
                'sample_rows' => $sampleRows,
                'total_rows' => $highestRow - $headerRow, // Data rows only
                'suggested_mappings' => $this->getSuggestedMappings($headers),
                'header_row' => $headerRow,
                'data_start_row' => $dataStartRow,
            ];

        } catch (\Exception $e) {
            Log::error('Excel analysis failed: ' . $e->getMessage());
            return [
                'success' => false,
                'error' => 'Failed to analyze Excel file: ' . $e->getMessage(),
            ];
        }
    }

    /**
     * Detect the header row by scanning for rows with known column name patterns
     */
    private function detectHeaderRow($worksheet, int $highestColumnIndex, int $maxScanRows): int
    {
        $knownHeaders = [
            'style', 'color', 'description', 'fabric', 'quantity', 'price', 'unit',
            'label', 'brand', 'fit', 'notes', 'packing', 'total', 'sku', 'item',
            'ddp', 'fob', 'cad', 'size', 'prepack', 'ihd', 'date',
        ];

        $bestRow = 1;
        $bestScore = 0;

        for ($row = 1; $row <= $maxScanRows; $row++) {
            $score = 0;
            for ($col = 1; $col <= $highestColumnIndex; $col++) {
                $cellValue = $worksheet->getCellByColumnAndRow($col, $row)->getValue();
                if (!$cellValue) continue;
                $normalized = strtolower(trim((string) $cellValue));
                foreach ($knownHeaders as $keyword) {
                    if (str_contains($normalized, $keyword)) {
                        $score++;
                        break;
                    }
                }
            }
            if ($score > $bestScore) {
                $bestScore = $score;
                $bestRow = $row;
            }
        }

        return $bestRow;
    }

    /**
     * Import styles from Excel with column mapping
     */
    public function importStyles(
        string $filePath,
        int $purchaseOrderId,
        array $columnMapping,
        bool $skipFirstRow = true,
        ?int $startRow = null,
        ?int $endRow = null
    ): array {
        try {
            $po = PurchaseOrder::findOrFail($purchaseOrderId);
            $spreadsheet = IOFactory::load($filePath);
            $worksheet = $spreadsheet->getActiveSheet();

            $totalRows = $worksheet->getHighestRow();
            $startRow = $startRow ?? ($skipFirstRow ? 2 : 1);
            $endRow = $endRow ?? $totalRows;

            $imported = 0;
            $skipped = 0;
            $errors = [];
            $importedStyles = [];

            for ($row = $startRow; $row <= $endRow; $row++) {
                $rowData = $this->extractRowData($worksheet, $row, $columnMapping);

                // Validate required fields
                $validation = $this->validateRowData($rowData);
                if (!$validation['valid']) {
                    $errors[] = [
                        'row' => $row,
                        'error' => $validation['error'],
                        'data' => $rowData,
                    ];
                    $skipped++;
                    continue;
                }

                // Check if style number already exists in this PO (via pivot table)
                $exists = $po->styles()
                    ->where('styles.style_number', $rowData['style_number'])
                    ->exists();

                if ($exists) {
                    $errors[] = [
                        'row' => $row,
                        'error' => 'Style number already exists in this PO',
                        'style_number' => $rowData['style_number'],
                    ];
                    $skipped++;
                    continue;
                }

                $unitPrice = $rowData['unit_price'] ?? 0;
                $quantity = $rowData['quantity'] ?? 1;

                // Build packing details JSON if packing/pre_pack_inner provided
                $packingDetails = $rowData['packing_details'] ?? null;
                if (!empty($rowData['packing']) || !empty($rowData['pre_pack_inner'])) {
                    $packingDetails = array_filter([
                        'method' => $rowData['packing'] ?? null,
                        'pre_pack_inner' => $rowData['pre_pack_inner'] ?? null,
                    ]);
                }

                // Create style record (master data - no PO-specific fields)
                $style = Style::create([
                    'style_number' => $rowData['style_number'],
                    'description' => $rowData['description'] ?? null,
                    'fabric' => $rowData['fabric'] ?? null,
                    'color' => $rowData['color'] ?? 'N/A',
                    'fit' => $rowData['fit'] ?? null,
                    'size_breakup' => $rowData['size_breakdown'] ?? ['breakdown' => 1],
                    'packing_details' => $packingDetails,
                    'metadata' => array_filter([
                        'label' => $rowData['label'] ?? null,
                        'size_scale' => is_string($rowData['size_breakdown'] ?? null) ? $rowData['size_breakdown'] : null,
                    ]),
                    'total_quantity' => $quantity,
                    'unit_price' => $unitPrice,
                    'fob_price' => $unitPrice,
                    'created_by' => $po->created_by ?? null,
                    'is_active' => true,
                ]);

                // Determine ex_factory_date: use IHD from Excel if available, else PO delivery date
                $exFactoryDate = $rowData['ihd'] ?? $po->delivery_date ?? now()->addMonths(2);

                // Attach style to PO via pivot table with PO-specific data
                $po->styles()->attach($style->id, [
                    'quantity_in_po' => $quantity,
                    'unit_price_in_po' => $unitPrice,
                    'size_breakdown' => json_encode($rowData['size_breakdown'] ?? null),
                    'ex_factory_date' => $exFactoryDate,
                    'notes' => $rowData['notes'] ?? null,
                    'assignment_type' => $rowData['assignment_type'] ?? null,
                    'assigned_factory_id' => $rowData['assigned_factory_id'] ?? null,
                    'assigned_agency_id' => $rowData['assigned_agency_id'] ?? null,
                    'status' => 'pending',
                ]);

                $importedStyles[] = $style;
                $imported++;
            }

            // Update PO totals
            $po->updateTotals();

            return [
                'success' => true,
                'imported' => $imported,
                'skipped' => $skipped,
                'total_processed' => $imported + $skipped,
                'errors' => $errors,
                'styles' => array_map(function ($style) {
                    return [
                        'id' => $style->id,
                        'style_number' => $style->style_number,
                        'quantity' => $style->total_quantity,
                        'unit_price' => $style->unit_price,
                    ];
                }, $importedStyles),
            ];

        } catch (\Exception $e) {
            Log::error('Excel import failed: ' . $e->getMessage());
            return [
                'success' => false,
                'error' => 'Failed to import Excel file: ' . $e->getMessage(),
            ];
        }
    }

    /**
     * Suggest field mapping based on header name
     */
    private function suggestFieldMapping(string $headerName): ?string
    {
        $normalized = strtolower(trim($headerName));

        // Style number variations
        if (preg_match('/(style|item|product|sku)[\s_-]*(number|no|#|code|id)/i', $normalized)) {
            return 'style_number';
        }
        if ($normalized === 'style' || $normalized === 'item' || $normalized === 'sku') {
            return 'style_number';
        }
        if ($normalized === 'style #' || $normalized === 'style#') {
            return 'style_number';
        }

        // Description variations
        if (preg_match('/(desc|description|detail|title)/i', $normalized)) {
            return 'description';
        }

        // Fabric variations
        if (preg_match('/(fabric|material|cloth|textile)/i', $normalized)) {
            return 'fabric';
        }

        // Color variations
        if (preg_match('/(color|colour|shade)/i', $normalized)) {
            return 'color';
        }

        // Quantity variations - "total units", "qty", "quantity", etc.
        if (preg_match('/(total[\s_-]*units|qty|quantity|pieces|pcs|units|amount)/i', $normalized)) {
            return 'quantity';
        }

        // Unit price variations - includes DDP, FOB
        if (preg_match('/(unit[\s_-]*price|price[\s_-]*per[\s_-]*unit|rate|unit[\s_-]*cost|fob|ddp)/i', $normalized)) {
            return 'unit_price';
        }
        if ($normalized === 'price' || $normalized === 'cost') {
            return 'unit_price';
        }

        // Label / Brand variations
        if (preg_match('/^(label|brand|brand[\s_-]*name|vendor)$/i', $normalized)) {
            return 'label';
        }

        // Fit variations
        if (preg_match('/^(fit|fit[\s_-]*type|fitting)$/i', $normalized)) {
            return 'fit';
        }

        // Notes variations
        if (preg_match('/^(notes?|comments?|remarks?|memo)$/i', $normalized)) {
            return 'notes';
        }

        // Packing variations
        if (preg_match('/^(packing|packaging|pack[\s_-]*method|carton[\s_-]*pack)$/i', $normalized)) {
            return 'packing';
        }

        // Pre Pack Inner variations
        if (preg_match('/(pre[\s_-]*pack[\s_-]*inner|inner[\s_-]*pack|pre[\s_-]*pack|prepack[\s_-]*inner)/i', $normalized)) {
            return 'pre_pack_inner';
        }

        // IHD / In-Hand Date / Ex-Factory Date variations
        if (preg_match('/(ihd|in[\s_-]*hand[\s_-]*date|ex[\s_-]*factory|delivery[\s_-]*date|ship[\s_-]*date)/i', $normalized)) {
            return 'ihd';
        }

        // Size scale / prepack variations
        if (preg_match('/(size[\s_-]*scale|size[\s_-]*breakdown|sizes|size[\s_-]*split|prepack|size[\s_-]*ratio)/i', $normalized)) {
            return 'size_breakdown';
        }

        // Pack columns (S1, S2, S3, etc.)
        if (preg_match('/^s(\d+)$/i', $normalized)) {
            return 'pack_' . strtoupper($normalized);
        }

        // Pack width columns (S1_Width, Pack1_Width, etc.)
        if (preg_match('/^(?:s|pack)(\d+)[\s_-]*(width|w)$/i', $normalized, $matches)) {
            return 'pack_S' . $matches[1] . '_width';
        }

        // Pack size columns (S1_XS, S1_M, Pack1_S, etc.)
        if (preg_match('/^(?:s|pack)(\d+)[\s_-]*(xs|s|m|l|xl|2xl|3xl|xxl|xxxl)$/i', $normalized, $matches)) {
            return 'pack_S' . $matches[1] . '_size_' . strtoupper($matches[2]);
        }

        // Pack cost columns (S1_Cost, S1_Price, etc.)
        if (preg_match('/^(?:s|pack)(\d+)[\s_-]*(cost|price)$/i', $normalized, $matches)) {
            return 'pack_S' . $matches[1] . '_cost';
        }

        // Size individual columns (S, M, L, XL, etc.) - for non-pack based import
        if (preg_match('/^(xs|s|m|l|xl|xxl|xxxl|\d+)$/i', $normalized)) {
            return 'size_' . strtoupper($normalized);
        }

        // Assignment type variations
        if (preg_match('/(assignment[\s_-]*type|assign[\s_-]*to|assignment)/i', $normalized)) {
            return 'assignment_type';
        }

        // Factory ID variations
        if (preg_match('/(factory[\s_-]*id|assigned[\s_-]*factory|factory)/i', $normalized)) {
            return 'assigned_factory_id';
        }

        // Agency ID variations
        if (preg_match('/(agency[\s_-]*id|assigned[\s_-]*agency|agency)/i', $normalized)) {
            return 'assigned_agency_id';
        }

        return null;
    }

    /**
     * Get suggested column mappings
     */
    private function getSuggestedMappings(array $headers): array
    {
        $mappings = [];
        $requiredFields = ['style_number', 'quantity', 'unit_price'];
        $optionalFields = ['description', 'fabric', 'color', 'label', 'fit', 'notes', 'packing', 'pre_pack_inner', 'ihd', 'size_breakdown', 'assignment_type', 'assigned_factory_id', 'assigned_agency_id'];

        foreach ($requiredFields as $field) {
            $mappings[$field] = $this->findHeaderForField($headers, $field);
        }

        foreach ($optionalFields as $field) {
            $mappings[$field] = $this->findHeaderForField($headers, $field);
        }

        return $mappings;
    }

    /**
     * Find header index for a field
     */
    private function findHeaderForField(array $headers, string $field): ?int
    {
        foreach ($headers as $header) {
            if ($header['suggested_field'] === $field) {
                return $header['index'];
            }
        }
        return null;
    }

    /**
     * Extract row data based on column mapping
     */
    private function extractRowData($worksheet, int $row, array $columnMapping): array
    {
        $data = [];

        foreach ($columnMapping as $field => $columnIndex) {
            if ($columnIndex !== null) {
                $cellValue = $worksheet->getCellByColumnAndRow($columnIndex + 1, $row)->getValue();

                // Process based on field type
                switch ($field) {
                    case 'quantity':
                        $data[$field] = $this->parseNumeric($cellValue);
                        break;
                    case 'unit_price':
                        $data[$field] = $this->parseDecimal($cellValue);
                        break;
                    case 'size_breakdown':
                        $data[$field] = $this->parseSizeBreakdown($cellValue);
                        break;
                    case 'ihd':
                        // Parse date value (IHD / In-Hand Date)
                        $data[$field] = $this->parseDate($cellValue);
                        break;
                    case 'assignment_type':
                        // Validate assignment type enum
                        $value = strtolower(trim((string) $cellValue));
                        if (in_array($value, ['direct_to_factory', 'via_agency'])) {
                            $data[$field] = $value;
                        }
                        break;
                    case 'assigned_factory_id':
                    case 'assigned_agency_id':
                        // Parse as integer ID
                        if (!empty($cellValue)) {
                            $data[$field] = $this->parseNumeric($cellValue);
                        }
                        break;
                    default:
                        $data[$field] = trim((string) ($cellValue ?? '')) ?: null;
                }
            }
        }

        // Handle pack-based data (S1, S2, S3, etc.)
        $packColumns = array_filter($columnMapping, function ($key) {
            return preg_match('/^pack_S\d+_/', $key);
        }, ARRAY_FILTER_USE_KEY);

        if (!empty($packColumns)) {
            $packingDetails = $this->buildPackingDetails($worksheet, $row, $columnMapping, $packColumns);
            if (!empty($packingDetails)) {
                $data['packing_details'] = $packingDetails;
                // Override quantity and size breakdown from packing details
                $data['quantity'] = $packingDetails['total_quantity'];
                $data['size_breakdown'] = $packingDetails['overall_size_breakdown'];
            }
        }

        // Handle size breakdown from individual size columns (for non-pack based import)
        $sizeColumns = array_filter($columnMapping, function ($key) {
            return strpos($key, 'size_') === 0 && strpos($key, 'pack_') === false;
        }, ARRAY_FILTER_USE_KEY);

        if (!empty($sizeColumns) && !isset($data['size_breakdown']) && !isset($data['packing_details'])) {
            $sizeBreakdown = [];
            foreach ($sizeColumns as $sizeField => $columnIndex) {
                $size = str_replace('size_', '', $sizeField);
                $quantity = $this->parseNumeric(
                    $worksheet->getCellByColumnAndRow($columnIndex + 1, $row)->getValue()
                );
                if ($quantity > 0) {
                    $sizeBreakdown[$size] = $quantity;
                }
            }
            if (!empty($sizeBreakdown)) {
                $data['size_breakdown'] = $sizeBreakdown;
                $data['quantity'] = array_sum($sizeBreakdown);
            }
        }

        return $data;
    }

    /**
     * Build packing details from pack columns
     */
    private function buildPackingDetails($worksheet, int $row, array $columnMapping, array $packColumns): ?array
    {
        // Group columns by pack number
        $packs = [];
        foreach ($packColumns as $field => $columnIndex) {
            // Extract pack number (S1, S2, etc.)
            if (preg_match('/^pack_(S\d+)_(.+)$/', $field, $matches)) {
                $packId = $matches[1];
                $attribute = $matches[2];

                if (!isset($packs[$packId])) {
                    $packs[$packId] = [
                        'pack_size' => $packId,
                        'width' => 'M', // Default width
                        'size_breakdown' => [],
                        'quantity' => 0,
                        'cost_per_unit' => 0,
                        'total_cost' => 0,
                    ];
                }

                $cellValue = $worksheet->getCellByColumnAndRow($columnIndex + 1, $row)->getValue();

                if ($attribute === 'width') {
                    $packs[$packId]['width'] = $cellValue ?: 'M';
                } elseif ($attribute === 'cost') {
                    $packs[$packId]['cost_per_unit'] = $this->parseDecimal($cellValue);
                } elseif (strpos($attribute, 'size_') === 0) {
                    // Extract size name (XS, S, M, L, etc.)
                    $size = str_replace('size_', '', $attribute);
                    $quantity = $this->parseNumeric($cellValue);
                    if ($quantity > 0) {
                        $packs[$packId]['size_breakdown'][$size] = $quantity;
                    }
                }
            }
        }

        // Calculate quantities and totals for each pack
        foreach ($packs as $packId => &$pack) {
            $pack['quantity'] = array_sum($pack['size_breakdown']);
            $pack['total_cost'] = $pack['quantity'] * $pack['cost_per_unit'];
        }

        // Remove packs with no sizes
        $packs = array_filter($packs, function ($pack) {
            return !empty($pack['size_breakdown']) && $pack['quantity'] > 0;
        });

        if (empty($packs)) {
            return null;
        }

        // Calculate overall totals
        $totalQuantity = 0;
        $overallSizeBreakdown = [];

        foreach ($packs as $pack) {
            $totalQuantity += $pack['quantity'];
            foreach ($pack['size_breakdown'] as $size => $qty) {
                if (!isset($overallSizeBreakdown[$size])) {
                    $overallSizeBreakdown[$size] = 0;
                }
                $overallSizeBreakdown[$size] += $qty;
            }
        }

        return [
            'packs' => array_values($packs), // Re-index array
            'total_quantity' => $totalQuantity,
            'overall_size_breakdown' => $overallSizeBreakdown,
        ];
    }

    /**
     * Validate row data
     */
    private function validateRowData(array $data): array
    {
        // Check required fields
        if (empty($data['style_number'])) {
            return [
                'valid' => false,
                'error' => 'Style number is required',
            ];
        }

        if (!isset($data['quantity']) || $data['quantity'] <= 0) {
            return [
                'valid' => false,
                'error' => 'Valid quantity is required',
            ];
        }

        if (!isset($data['unit_price']) || $data['unit_price'] < 0) {
            return [
                'valid' => false,
                'error' => 'Valid unit price is required',
            ];
        }

        return ['valid' => true];
    }

    /**
     * Parse numeric value
     */
    private function parseNumeric($value): int
    {
        if (is_numeric($value)) {
            return (int) $value;
        }

        // Remove common non-numeric characters
        $cleaned = preg_replace('/[^0-9.]/', '', $value);
        return is_numeric($cleaned) ? (int) $cleaned : 0;
    }

    /**
     * Parse decimal value
     */
    private function parseDecimal($value): float
    {
        if (is_numeric($value)) {
            return (float) $value;
        }

        // Remove common non-numeric characters except decimal point
        $cleaned = preg_replace('/[^0-9.]/', '', $value);
        return is_numeric($cleaned) ? (float) $cleaned : 0.0;
    }

    /**
     * Parse date value from Excel cell (handles Excel serial dates and common formats)
     */
    private function parseDate($value): ?string
    {
        if (empty($value)) {
            return null;
        }

        // Handle Excel serial date number
        if (is_numeric($value) && $value > 40000 && $value < 60000) {
            try {
                $date = \PhpOffice\PhpSpreadsheet\Shared\Date::excelToDateTimeObject((float) $value);
                return $date->format('Y-m-d');
            } catch (\Exception $e) {
                // Fall through to string parsing
            }
        }

        // Handle string date formats
        $value = trim((string) $value);
        $formats = ['n/j/y', 'n/j/Y', 'm/d/y', 'm/d/Y', 'Y-m-d', 'd-M-y', 'd-M-Y', 'M d, Y'];
        foreach ($formats as $format) {
            $date = \DateTime::createFromFormat($format, $value);
            if ($date !== false) {
                return $date->format('Y-m-d');
            }
        }

        // Try PHP's strtotime as fallback
        $timestamp = strtotime($value);
        if ($timestamp !== false) {
            return date('Y-m-d', $timestamp);
        }

        return null;
    }

    /**
     * Parse size breakdown from string
     */
    private function parseSizeBreakdown($value): ?array
    {
        if (empty($value)) {
            return null;
        }

        if (is_array($value)) {
            return $value;
        }

        // Try to parse JSON
        if (is_string($value) && (strpos($value, '{') === 0 || strpos($value, '[') === 0)) {
            $decoded = json_decode($value, true);
            if (is_array($decoded)) {
                return $decoded;
            }
        }

        // Try to parse comma-separated format: "S:10, M:20, L:15"
        if (strpos($value, ':') !== false) {
            $breakdown = [];
            $pairs = explode(',', $value);
            foreach ($pairs as $pair) {
                $parts = explode(':', trim($pair));
                if (count($parts) === 2) {
                    $size = trim($parts[0]);
                    $qty = $this->parseNumeric(trim($parts[1]));
                    if ($qty > 0) {
                        $breakdown[$size] = $qty;
                    }
                }
            }
            return !empty($breakdown) ? $breakdown : null;
        }

        return null;
    }

    /**
     * Export template Excel file for styles
     */
    public function exportTemplate(): string
    {
        $spreadsheet = new \PhpOffice\PhpSpreadsheet\Spreadsheet();
        $worksheet = $spreadsheet->getActiveSheet();

        // Set headers matching standard PO Excel format
        $headers = [
            'LABEL',
            'STYLE #',
            'COLOR',
            'DESCRIPTION',
            'NOTES',
            'FABRIC',
            'FIT',
            'DDP',
            'TOTAL UNITS',
            'SIZE SCALE / PREPACK',
            'PRE PACK INNER',
            'PACKING',
            'IHD',
        ];

        $col = 1;
        foreach ($headers as $header) {
            $worksheet->setCellValueByColumnAndRow($col, 1, $header);
            $col++;
        }

        // Add sample data row
        $sampleData = [
            'BRAND NAME',
            'RTF-001X',
            'BLACK',
            'PRINTED GRAPHIC TWO FER',
            '',
            '220 CVC BODY + 220 THERMAL BODY',
            'REGULAR',
            4.00,
            1200,
            '2X-3X 3-1',
            '4 PCS',
            'FLATPACK - 1 PREPACK IN MASTER POLYBAG - 24 PC CARTONS',
            '7/6/26',
        ];

        $col = 1;
        foreach ($sampleData as $value) {
            $worksheet->setCellValueByColumnAndRow($col, 2, $value);
            $col++;
        }

        // Style header row
        $styleArray = [
            'font' => ['bold' => true],
            'fill' => [
                'fillType' => \PhpOffice\PhpSpreadsheet\Style\Fill::FILL_SOLID,
                'startColor' => ['rgb' => 'E0E0E0'],
            ],
        ];
        $lastColumn = \PhpOffice\PhpSpreadsheet\Cell\Coordinate::stringFromColumnIndex(count($headers));
        $worksheet->getStyle('A1:' . $lastColumn . '1')->applyFromArray($styleArray);

        // Auto-size columns
        foreach (range(1, count($headers)) as $colIndex) {
            $colLetter = \PhpOffice\PhpSpreadsheet\Cell\Coordinate::stringFromColumnIndex($colIndex);
            $worksheet->getColumnDimension($colLetter)->setAutoSize(true);
        }

        // Save to temp file
        $tempFile = tempnam(sys_get_temp_dir(), 'style_template_') . '.xlsx';
        $writer = IOFactory::createWriter($spreadsheet, 'Xlsx');
        $writer->save($tempFile);

        return $tempFile;
    }

    /**
     * Import standalone styles from Excel (not attached to any PO)
     */
    public function importStandaloneStyles(
        string $filePath,
        int $createdBy,
        array $columnMapping,
        bool $skipFirstRow = true,
        ?int $startRow = null,
        ?int $endRow = null
    ): array {
        try {
            $spreadsheet = IOFactory::load($filePath);
            $worksheet = $spreadsheet->getActiveSheet();

            $totalRows = $worksheet->getHighestRow();
            $startRow = $startRow ?? ($skipFirstRow ? 2 : 1);
            $endRow = $endRow ?? $totalRows;

            $imported = 0;
            $skipped = 0;
            $errors = [];
            $importedStyles = [];

            for ($row = $startRow; $row <= $endRow; $row++) {
                $rowData = $this->extractRowData($worksheet, $row, $columnMapping);

                // Validate required fields
                $validation = $this->validateRowData($rowData);
                if (!$validation['valid']) {
                    $errors[] = [
                        'row' => $row,
                        'error' => $validation['error'],
                        'data' => $rowData,
                    ];
                    $skipped++;
                    continue;
                }

                // Check if style number already exists globally
                $exists = Style::where('style_number', $rowData['style_number'])->exists();

                if ($exists) {
                    $errors[] = [
                        'row' => $row,
                        'error' => 'Style number already exists',
                        'style_number' => $rowData['style_number'],
                    ];
                    $skipped++;
                    continue;
                }

                $unitPrice = $rowData['unit_price'] ?? 0;

                // Create standalone style with po_id = null
                $style = Style::create([
                    'po_id' => null,  // Standalone style
                    'style_number' => $rowData['style_number'],
                    'description' => $rowData['description'] ?? null,
                    'fabric' => $rowData['fabric'] ?? null,
                    'color' => $rowData['color'] ?? null,
                    'size_breakup' => $rowData['size_breakdown'] ?? null,
                    'total_quantity' => $rowData['quantity'] ?? 0,
                    'unit_price' => $unitPrice,
                    'fob_price' => $unitPrice,
                    'created_by' => $createdBy,
                    'status' => 'pending',
                ]);

                $importedStyles[] = $style;
                $imported++;
            }

            return [
                'success' => true,
                'imported' => $imported,
                'skipped' => $skipped,
                'total_processed' => $imported + $skipped,
                'errors' => $errors,
                'styles' => array_map(function ($style) {
                    return [
                        'id' => $style->id,
                        'style_number' => $style->style_number,
                        'quantity' => $style->total_quantity,
                        'unit_price' => $style->unit_price,
                    ];
                }, $importedStyles),
            ];

        } catch (\Exception $e) {
            Log::error('Standalone styles Excel import failed: ' . $e->getMessage());
            return [
                'success' => false,
                'error' => 'Failed to import Excel file: ' . $e->getMessage(),
            ];
        }
    }
}
