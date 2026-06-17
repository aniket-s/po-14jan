<?php

namespace App\Services\Import;

use App\Models\PurchaseOrder;
use App\Models\Retailer;
use App\Models\Style;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use PhpOffice\PhpSpreadsheet\Cell\Coordinate;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Shared\Date as ExcelDate;

/**
 * Bulk multi-PO Excel importer for back-filling historical purchase orders.
 *
 * Unlike the strategy-based importers (one document -> one PO), a bulk/WIP
 * tracking sheet carries MANY POs in a single file, with the PO number and the
 * style number living in per-row columns. This service:
 *
 *   1. analyze()  - detects the header row, proposes a per-column field mapping
 *                   (including the per-row po_number / po_date / retailer that
 *                   the other importers don't have), and returns the raw grid so
 *                   the frontend can render an Excel-like preview and let the
 *                   team correct the mapping / values before submitting.
 *   2. commit()   - groups the (possibly team-edited) rows by PO number and
 *                   creates each PO as a draft, with NO side effects
 *                   (notifications / TNA). Columns that aren't mapped to a
 *                   structured field are preserved losslessly in JSON metadata.
 *
 * Grouping and value-editing happen on the client against the raw grid this
 * service returns; commit() receives the resolved PO groups and is the
 * authoritative validation + persistence step.
 */
class BulkPoExcelImportService
{
    /** Hard cap on preview rows returned to the client (full files commit fine). */
    public const MAX_PREVIEW_ROWS = 1000;

    /** Special column targets that aren't structured fields. */
    public const TARGET_METADATA = '__metadata__';
    public const TARGET_IGNORE = '__ignore__';

    /** Size tokens recognised in the per-size grid (header sits on the header row). */
    private const SIZE_TOKENS = [
        'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL',
        '1XL', '2XL', '3XL', '4XL', '5XL', '6XL', '7XL',
        '2X', '3X', '4X', '5X', '6X', '7X', 'OS', 'OSFA',
    ];

    /**
     * Structured fields a column can be mapped to. `required` drives the
     * pre-submit checklist; `cardinality=single` means only one column may feed
     * the field (later duplicates fall back to metadata).
     *
     * @return array<int, array{key:string,label:string,group:string,required:bool}>
     */
    public function fieldCatalog(): array
    {
        return [
            ['key' => 'po_number',      'label' => 'PO Number',      'group' => 'Purchase Order', 'required' => true],
            ['key' => 'po_date',        'label' => 'PO Date',        'group' => 'Purchase Order', 'required' => false],
            ['key' => 'retailer_name',  'label' => 'Retailer',       'group' => 'Purchase Order', 'required' => false],
            ['key' => 'style_number',   'label' => 'Style Number',   'group' => 'Style',          'required' => true],
            ['key' => 'color_name',     'label' => 'Color',          'group' => 'Style',          'required' => false],
            ['key' => 'description',    'label' => 'Description',     'group' => 'Style',          'required' => false],
            ['key' => 'fabric',         'label' => 'Fabric',         'group' => 'Style',          'required' => false],
            ['key' => 'fit',            'label' => 'Fit',            'group' => 'Style',          'required' => false],
            ['key' => 'label',          'label' => 'Label',          'group' => 'Style',          'required' => false],
            ['key' => 'notes',          'label' => 'Notes',          'group' => 'Style',          'required' => false],
            ['key' => 'unit_price',     'label' => 'Unit Price',     'group' => 'Style',          'required' => true],
            ['key' => 'quantity',       'label' => 'Quantity',       'group' => 'Style',          'required' => true],
            ['key' => 'pre_pack_inner', 'label' => 'Pre-pack / Inner', 'group' => 'Style',        'required' => false],
            ['key' => 'packing',        'label' => 'Packing',        'group' => 'Style',          'required' => false],
            ['key' => 'ihd',            'label' => 'IHD',            'group' => 'Style',          'required' => false],
        ];
    }

    /** @return string[] keys of fields that are required to commit. */
    public function requiredFields(): array
    {
        return array_values(array_map(
            fn ($f) => $f['key'],
            array_filter($this->fieldCatalog(), fn ($f) => $f['required'])
        ));
    }

    /** Fields where only a single column may feed them (duplicates -> metadata). */
    private function singleCardinalityFields(): array
    {
        return array_map(fn ($f) => $f['key'], $this->fieldCatalog());
    }

    /**
     * Parse the file into columns (+ suggested targets) and a raw grid preview.
     *
     * @return array{success:bool,error?:string,...}
     */
    public function analyze(string $filePath): array
    {
        try {
            $spreadsheet = IOFactory::load($filePath);
            $sheet = $spreadsheet->getActiveSheet();

            $highestColumn = $sheet->getHighestDataColumn();
            $lastCol = Coordinate::columnIndexFromString($highestColumn);
            $lastRow = $sheet->getHighestDataRow();

            $headerRow = $this->detectHeaderRow($sheet, $lastCol, min($lastRow, 25));

            // Only surface columns up to the last one that actually has a header
            // label, so the dozens of trailing empty columns a wide tracking
            // sheet carries don't pollute the mapping UI.
            $lastNamedCol = 1;
            for ($c = 1; $c <= $lastCol; $c++) {
                if (trim((string) $this->cellString($sheet->getCellByColumnAndRow($c, $headerRow))) !== '') {
                    $lastNamedCol = $c;
                }
            }

            $columns = $this->buildColumns($sheet, $headerRow, $lastNamedCol);
            $poTarget = $this->columnForTarget($columns, 'po_number');

            // Raw grid (rows after the header), capped for payload size. PO numbers
            // are collected across ALL rows (not just the preview slice) so the
            // duplicate check stays accurate on large files.
            $dataStart = $headerRow + 1;
            $rows = [];
            $totalDataRows = 0;
            $filePoNumbers = [];
            for ($r = $dataStart; $r <= $lastRow; $r++) {
                $cells = [];
                $hasData = false;
                for ($c = 1; $c <= $lastNamedCol; $c++) {
                    $val = $this->cellString($sheet->getCellByColumnAndRow($c, $r));
                    if ($val !== '') {
                        $hasData = true;
                    }
                    $cells[] = $val;
                }
                if (!$hasData) {
                    continue;
                }
                $totalDataRows++;
                if ($poTarget !== null) {
                    $po = trim((string) ($cells[$poTarget] ?? ''));
                    if ($po !== '') {
                        $filePoNumbers[$po] = true;
                    }
                }
                if (count($rows) < self::MAX_PREVIEW_ROWS) {
                    $rows[] = ['row_number' => $r, 'cells' => $cells];
                }
            }

            // Flag which of the file's PO numbers already exist so the client can
            // mark duplicates live without a round-trip per remap.
            $existingPoNumbers = [];
            if (!empty($filePoNumbers)) {
                $existingPoNumbers = PurchaseOrder::whereIn('po_number', array_keys($filePoNumbers))
                    ->pluck('po_number')
                    ->map(fn ($v) => (string) $v)
                    ->all();
            }

            return [
                'success' => true,
                'sheet_name' => $sheet->getTitle(),
                'header_row' => $headerRow,
                'columns' => $columns,
                'rows' => $rows,
                'total_data_rows' => $totalDataRows,
                'preview_truncated' => $totalDataRows > count($rows),
                'field_catalog' => $this->fieldCatalog(),
                'required_fields' => $this->requiredFields(),
                'existing_po_numbers' => array_values($existingPoNumbers),
            ];
        } catch (\Throwable $e) {
            Log::error('Bulk PO Excel analysis failed: ' . $e->getMessage());
            return ['success' => false, 'error' => 'Failed to analyze file: ' . $e->getMessage()];
        }
    }

    /**
     * Build per-column descriptors with a suggested target, applying first-wins
     * so a second "TOTAL UNITS" / "IHD" column doesn't steal a structured field.
     *
     * @return array<int, array{index:int,letter:string,name:string,target:string,required:bool,size_token:?string,duplicate_of:?int}>
     */
    private function buildColumns($sheet, int $headerRow, int $lastNamedCol): array
    {
        $singleFields = $this->singleCardinalityFields();
        $requiredFields = $this->requiredFields();
        $assigned = []; // field => column index (0-based)
        $columns = [];

        for ($c = 1; $c <= $lastNamedCol; $c++) {
            $name = trim((string) $this->cellString($sheet->getCellByColumnAndRow($c, $headerRow)));
            $index = $c - 1;
            $sizeToken = $this->sizeToken($name);
            [$target, $duplicateOf] = $this->resolveTarget($name, $sizeToken, $assigned, $singleFields);

            if (in_array($target, $singleFields, true)) {
                $assigned[$target] = $index;
            }

            $columns[] = [
                'index' => $index,
                'letter' => Coordinate::stringFromColumnIndex($c),
                'name' => $name,
                'target' => $target,
                'required' => in_array($target, $requiredFields, true),
                'size_token' => str_starts_with($target, 'size:') ? $sizeToken : null,
                'duplicate_of' => $duplicateOf,
            ];
        }

        return $columns;
    }

    /**
     * Decide a column's target. Returns [target, duplicateOfColumnIndex|null].
     * A single-cardinality field already claimed earlier is demoted to metadata.
     */
    private function resolveTarget(string $name, ?string $sizeToken, array $assigned, array $singleFields): array
    {
        $field = $this->suggestField($name, $sizeToken);

        if ($field === null) {
            return [self::TARGET_METADATA, null];
        }
        if (str_starts_with($field, 'size:')) {
            return [$field, null]; // multi-cardinality
        }
        if (in_array($field, $singleFields, true) && array_key_exists($field, $assigned)) {
            return [self::TARGET_METADATA, $assigned[$field]];
        }
        return [$field, null];
    }

    /**
     * Header -> structured field heuristic. Order matters: more specific labels
     * (po date, ddp price) are tested before broader ones. Returns null for
     * columns that should default to metadata.
     */
    private function suggestField(string $header, ?string $sizeToken): ?string
    {
        $n = preg_replace('/\s+/', ' ', strtolower(trim($header)));
        if ($n === '') {
            return null;
        }

        if (str_contains($n, 'style')) return 'style_number';
        if (str_contains($n, 'po date')) return 'po_date';
        if ($n === 'po' || preg_match('/\bpo\s*(number|no|#)\b/', $n)) return 'po_number';
        if (str_contains($n, 'retailer') || str_contains($n, 'store name')) return 'retailer_name';
        if (str_contains($n, 'ihd')) return 'ihd';
        if (str_contains($n, 'ddp') || (str_contains($n, 'price') && str_contains($n, 'buyer'))) return 'unit_price';
        if (str_contains($n, 'total units') || in_array($n, ['qty', 'quantity', 'total qty', 'units'], true)) return 'quantity';
        if ($sizeToken !== null) return 'size:' . $sizeToken;
        if (str_contains($n, 'prepack') || str_contains($n, 'pre pack') || str_contains($n, 'pre-pack') || str_contains($n, 'inner')) return 'pre_pack_inner';
        if (str_contains($n, 'packing')) return 'packing';
        if (str_contains($n, 'color') || str_contains($n, 'colour')) return 'color_name';
        if (str_contains($n, 'description') || str_contains($n, 'graphic')) return 'description';
        if (str_contains($n, 'fabric')) return 'fabric';
        if (str_contains($n, 'fit')) return 'fit';
        if ($n === 'label') return 'label';
        if (str_contains($n, 'notes')) return 'notes';

        return null;
    }

    /** Return the canonical size token if the header denotes a single size column. */
    private function sizeToken(string $header): ?string
    {
        $h = strtoupper(trim($header));
        if ($h === '') {
            return null;
        }
        if (in_array($h, self::SIZE_TOKENS, true)) {
            return $h;
        }
        // Accept "S (8)", "M(10/12)", "XL (18/20)" etc. - a leading size token
        // followed by a parenthetical size-scale note.
        if (preg_match('/^([0-9]?X{0,3}L|XS|S|M|L|OS|OSFA)\s*\(/', $h, $m)) {
            $tok = $m[1];
            return in_array($tok, self::SIZE_TOKENS, true) ? $tok : null;
        }
        return null;
    }

    private function columnForTarget(array $columns, string $target): ?int
    {
        foreach ($columns as $col) {
            if ($col['target'] === $target) {
                return $col['index'];
            }
        }
        return null;
    }

    /**
     * Safely render a cell as a display string: dates as Y-m-d, formula cells as
     * their cached value, errors ("#VALUE!") passed through as-is.
     */
    private function cellString($cell): string
    {
        try {
            $val = $cell->getValue();
            if ($val === null) {
                return '';
            }
            if (is_string($val) && str_starts_with($val, '=')) {
                try {
                    $val = $cell->getCalculatedValue();
                } catch (\Throwable $e) {
                    $val = $cell->getOldCalculatedValue();
                }
            }
            if ($val === null) {
                return '';
            }
            if (is_numeric($val) && ExcelDate::isDateTime($cell)) {
                return ExcelDate::excelToDateTimeObject((float) $val)->format('Y-m-d');
            }
            return trim((string) $val);
        } catch (\Throwable $e) {
            return '';
        }
    }

    private function detectHeaderRow($sheet, int $lastCol, int $maxScanRows): int
    {
        $keywords = [
            'style', 'color', 'description', 'fabric', 'quantity', 'price', 'unit',
            'label', 'fit', 'notes', 'packing', 'total', 'ddp', 'fob', 'size',
            'prepack', 'ihd', 'po', 'retailer',
        ];
        $bestRow = 1;
        $bestScore = 0;
        for ($r = 1; $r <= $maxScanRows; $r++) {
            $score = 0;
            for ($c = 1; $c <= $lastCol; $c++) {
                $v = strtolower(trim((string) $this->cellString($sheet->getCellByColumnAndRow($c, $r))));
                if ($v === '') {
                    continue;
                }
                foreach ($keywords as $kw) {
                    if (str_contains($v, $kw)) {
                        $score++;
                        break;
                    }
                }
            }
            if ($score > $bestScore) {
                $bestScore = $score;
                $bestRow = $r;
            }
        }
        return $bestRow;
    }

    /**
     * Persist resolved PO groups as draft purchase orders. No notifications, no
     * TNA generation - this is a historical back-fill. Each PO commits in its own
     * transaction so one bad group can't roll back the whole batch.
     *
     * @param  array<int, array<string, mixed>>  $pos
     * @param  array<string, mixed>  $options
     * @return array<string, mixed>
     */
    public function commit(array $pos, array $options, int $userId): array
    {
        $duplicateStrategy = ($options['duplicate_strategy'] ?? 'skip') === 'update' ? 'update' : 'skip';
        $defaultShippingTerm = in_array($options['default_shipping_term'] ?? 'DDP', ['FOB', 'DDP'], true)
            ? $options['default_shipping_term'] : 'DDP';
        $buyerId = $options['buyer_id'] ?? null;
        $sourceFilename = $options['filename'] ?? null;
        $batchId = (string) \Illuminate\Support\Str::uuid();

        $created = [];
        $skipped = [];
        $updated = [];
        $errors = [];

        foreach ($pos as $poInput) {
            $poNumber = trim((string) ($poInput['po_number'] ?? ''));
            if ($poNumber === '') {
                $errors[] = ['po_number' => null, 'message' => 'A PO group is missing its PO number and was skipped.'];
                continue;
            }

            $existing = PurchaseOrder::where('po_number', $poNumber)->first();
            if ($existing && $duplicateStrategy === 'skip') {
                $skipped[] = ['po_number' => $poNumber, 'reason' => 'already_exists', 'id' => $existing->id];
                continue;
            }

            try {
                $result = DB::transaction(function () use (
                    $poInput, $poNumber, $existing, $duplicateStrategy, $defaultShippingTerm,
                    $buyerId, $sourceFilename, $batchId, $userId
                ) {
                    $retailerId = $this->resolveRetailerId($poInput);

                    if ($existing && $duplicateStrategy === 'update') {
                        $po = $existing;
                    } else {
                        $po = PurchaseOrder::create([
                            'po_number' => $poNumber,
                            // po_date is NOT NULL in the schema; historical sheets
                            // usually carry it, but fall back to today so a missing
                            // date never blocks a back-fill insert.
                            'po_date' => $this->normalizeDate($poInput['po_date'] ?? null) ?? now()->format('Y-m-d'),
                            'status' => 'draft',
                            'creator_id' => $userId,
                            'buyer_id' => $buyerId,
                            'retailer_id' => $retailerId,
                            'shipping_term' => $this->cleanShippingTerm($poInput['shipping_term'] ?? null) ?? $defaultShippingTerm,
                            'total_styles' => 0,
                            'total_quantity' => 0,
                            'total_value' => 0,
                            'metadata' => array_merge(
                                is_array($poInput['metadata'] ?? null) ? $poInput['metadata'] : [],
                                ['bulk_import_batch' => $batchId]
                            ),
                            'import_source' => [
                                'strategy_key' => 'bulk_po_excel',
                                'filename' => $sourceFilename,
                                'batch_id' => $batchId,
                                'parser_version' => 1,
                                'imported_at' => now()->toIso8601String(),
                            ],
                        ]);
                    }

                    $existingStyleNumbers = [];
                    if ($existing && $duplicateStrategy === 'update') {
                        foreach ($po->styles as $s) {
                            $existingStyleNumbers[strtoupper(trim($s->style_number))] = true;
                        }
                    }

                    $stylesCreated = 0;
                    foreach (($poInput['styles'] ?? []) as $styleInput) {
                        $styleNumber = trim((string) ($styleInput['style_number'] ?? ''));
                        if ($styleNumber === '') {
                            continue;
                        }
                        // On update, don't re-add a style already on the PO.
                        if (isset($existingStyleNumbers[strtoupper($styleNumber)])) {
                            continue;
                        }

                        $quantity = (int) ($styleInput['quantity'] ?? 0);
                        $unitPrice = (float) ($styleInput['unit_price'] ?? 0);
                        $sizeBreakdown = $this->cleanSizeBreakdown($styleInput['size_breakdown'] ?? null);
                        $rowMeta = is_array($styleInput['metadata'] ?? null) ? array_filter(
                            $styleInput['metadata'],
                            fn ($v) => $v !== null && $v !== ''
                        ) : [];

                        $packingDetails = array_filter([
                            'method' => $styleInput['packing'] ?? null,
                            'pre_pack_inner' => $styleInput['pre_pack_inner'] ?? null,
                        ], fn ($v) => $v !== null && $v !== '');

                        $style = Style::create([
                            'style_number' => $styleNumber,
                            'description' => $styleInput['description'] ?? null,
                            'color_name' => $styleInput['color_name'] ?? null,
                            'color' => $styleInput['color_name'] ?? null,
                            'fabric' => $styleInput['fabric'] ?? null,
                            'fit' => $styleInput['fit'] ?? null,
                            'size_breakup' => $sizeBreakdown,
                            'packing_details' => $packingDetails ?: null,
                            'total_quantity' => $quantity,
                            'unit_price' => $unitPrice,
                            'fob_price' => $unitPrice,
                            'retailer_id' => $po->retailer_id,
                            'metadata' => array_filter([
                                'label' => $styleInput['label'] ?? null,
                            ], fn ($v) => $v !== null && $v !== ''),
                            'created_by' => $userId,
                            'is_active' => true,
                            'status' => 'pending',
                        ]);

                        $po->styles()->syncWithoutDetaching([
                            $style->id => [
                                'quantity_in_po' => $quantity,
                                'unit_price_in_po' => $unitPrice,
                                'size_breakdown' => $sizeBreakdown ? json_encode($sizeBreakdown) : null,
                                'ex_factory_date' => $this->normalizeDate($styleInput['ihd'] ?? null),
                                'notes' => $styleInput['notes'] ?? null,
                                'status' => 'pending',
                                'metadata' => !empty($rowMeta) ? json_encode($rowMeta) : null,
                            ],
                        ]);
                        $stylesCreated++;
                    }

                    $po->updateTotals();

                    return ['po' => $po, 'styles_created' => $stylesCreated, 'was_update' => (bool) ($existing && $duplicateStrategy === 'update')];
                });

                $entry = [
                    'po_number' => $poNumber,
                    'id' => $result['po']->id,
                    'styles' => $result['styles_created'],
                ];
                if ($result['was_update']) {
                    $updated[] = $entry;
                } else {
                    $created[] = $entry;
                }
            } catch (\Throwable $e) {
                Log::error("Bulk PO import failed for PO {$poNumber}: " . $e->getMessage());
                $errors[] = ['po_number' => $poNumber, 'message' => $e->getMessage()];
            }
        }

        return [
            'success' => empty($errors) || !empty($created) || !empty($updated),
            'batch_id' => $batchId,
            'created' => $created,
            'updated' => $updated,
            'skipped' => $skipped,
            'errors' => $errors,
            'summary' => [
                'pos_created' => count($created),
                'pos_updated' => count($updated),
                'pos_skipped' => count($skipped),
                'pos_failed' => count($errors),
                'styles_created' => array_sum(array_column($created, 'styles')) + array_sum(array_column($updated, 'styles')),
            ],
        ];
    }

    /** Resolve a retailer id from an explicit id or a fuzzy name match. */
    private function resolveRetailerId(array $poInput): ?int
    {
        $id = $poInput['retailer_id'] ?? null;
        if ($id && Retailer::whereKey($id)->exists()) {
            return (int) $id;
        }
        $name = trim((string) ($poInput['retailer_name'] ?? ''));
        if ($name === '') {
            return null;
        }
        $exact = Retailer::where('name', $name)->first();
        if ($exact) {
            return $exact->id;
        }
        $like = Retailer::where('name', 'LIKE', '%' . $name . '%')->first();
        return $like?->id;
    }

    private function cleanShippingTerm(?string $term): ?string
    {
        $term = strtoupper(trim((string) $term));
        return in_array($term, ['FOB', 'DDP'], true) ? $term : null;
    }

    /** @return array<string,int>|null */
    private function cleanSizeBreakdown($raw): ?array
    {
        if (!is_array($raw)) {
            return null;
        }
        $out = [];
        foreach ($raw as $size => $qty) {
            $n = (int) round((float) preg_replace('/[^0-9.]/', '', (string) $qty));
            if ($n > 0) {
                $out[(string) $size] = $n;
            }
        }
        return $out ?: null;
    }

    private function normalizeDate($value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }
        $value = trim((string) $value);
        if ($value === '') {
            return null;
        }
        try {
            return \Carbon\Carbon::parse($value)->format('Y-m-d');
        } catch (\Throwable $e) {
            return null;
        }
    }
}
