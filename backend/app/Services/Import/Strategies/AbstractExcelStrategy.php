<?php

namespace App\Services\Import\Strategies;

use App\Models\Buyer;
use App\Models\Country;
use App\Models\Currency;
use App\Models\PaymentTerm;
use App\Models\Retailer;
use App\Models\Season;
use App\Models\User;
use App\Services\ExcelImageExtractionService;
use App\Services\Import\Contracts\PoImportStrategy;
use App\Services\Import\DTO\ParsedDocument;
use Illuminate\Support\Facades\Log;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

/**
 * Shared Excel parser scaffolding. Subclasses implement:
 *   - headerAliases(): map of canonical field => array of possible column names
 *   - extractDocumentMeta(Worksheet $s, array $allRows): associative array of
 *       document-level fields (buy_sheet_number, retailer_name, fob_date, etc.)
 *   - postProcessStyle($styleRow, $rowIndex): hook to tweak per-row mapping
 *
 * Subclasses should NOT reimplement the scan/iterate logic - that lives here.
 */
abstract class AbstractExcelStrategy implements PoImportStrategy
{
    public function __construct(protected ExcelImageExtractionService $imageService) {}

    public function format(): string { return 'excel'; }
    public function documentKind(): string { return 'po'; }
    public function supportsBuySheetReference(): bool { return false; }

    /**
     * Cell text fragments that mark the boundary between the style grid and the
     * Excel template's footer block. When any cell in a row contains one of
     * these, row iteration stops - otherwise things like `SPECIAL NOTES/DETAILS`
     * and `BUTTONS:` get hoovered up into the style-number column and turned
     * into phantom style rows.
     */
    protected const FOOTER_KEYWORDS = [
        'special notes', 'special instructions',
        'buttons:', 'main label', 'hang tag', 'pre-tkting', 'pre-ticket',
        'packing instruction', 'carton requirement', 'carton- height',
        'customer requirement', 'customer rqrments',
        'do not ship', 'deadmans fold', 'no staples',
        'total pcs', 'grand total',
        'accessories:', 'supplied by',
        'direct to consolidator',
    ];

    /**
     * Common per-size column labels found in the sub-header row beneath a
     * merged "SIZE SPECIFICATIONS" cell. The order doesn't matter - only
     * matching against the cell text does.
     */
    protected const SIZE_LABELS = [
        'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL',
        '2X', '3X', '4X', '5X', '6X', '7X',
        '2XL', '3XL', '4XL', '5XL', '6XL', '7XL',
        'OS', 'OSFA',
    ];

    /** @var array<int,string>|null Set during analyze() once the size sub-header is detected. */
    private ?array $sizeColumnMap = null;

    /** @return array<string, string[]> */
    abstract protected function headerAliases(): array;

    abstract protected function extractDocumentMeta(Worksheet $sheet, array $allRows): array;

    /** Per-strategy row fixups (defaults, type coercion). */
    protected function postProcessStyle(array $style, int $rowIndex): array { return $style; }

    public function analyze(string $filePath, array $ctx = []): ParsedDocument
    {
        $doc = new ParsedDocument();
        $doc->strategyKey = $this->key();
        $doc->kind = $this->documentKind() === 'buy_sheet'
            ? ParsedDocument::KIND_BUY_SHEET
            : ParsedDocument::KIND_PO;

        try {
            $spreadsheet = IOFactory::load($filePath);
            $sheet = $spreadsheet->getActiveSheet();

            $allRows = $sheet->toArray(null, true, false, false);
            $meta = $this->extractDocumentMeta($sheet, $allRows);

            $headerRow = $this->detectHeaderRow($allRows);
            if ($headerRow === null) {
                return ParsedDocument::failure($this->key(), 'Could not detect header row in Excel file.');
            }

            $fieldForColumn = $this->mapColumnsToFields($allRows[$headerRow]);

            // The Massive template uses a merged "SIZE SPECIFICATIONS" header
            // with S / M / L / XL labels in the row beneath. detectSizeColumnMap
            // returns an empty array when no sub-header is present, so SCI's
            // single-cell "SIZE SCALE / PREPACK" path stays untouched.
            $this->sizeColumnMap = $this->detectSizeColumnMap($allRows, $headerRow);
            // Where the sub-header sits, so iteration starts after it.
            $sizeSubHeaderRow = !empty($this->sizeColumnMap)
                ? $this->locateSizeSubHeader($allRows, $headerRow)
                : null;
            $firstDataRow = $sizeSubHeaderRow !== null ? $sizeSubHeaderRow + 1 : $headerRow + 1;

            // Extract images for row-based CAD preview
            $imageByRow = [];
            try {
                $extraction = $this->imageService->extractImagesForRowsAndColumns($filePath, $headerRow + 1);
                foreach (($extraction['images_by_cell'] ?? []) as $cell) {
                    $imageByRow[$cell['row_index']][] = $cell['url'];
                }
            } catch (\Throwable $e) {
                Log::debug('Image extraction failed: ' . $e->getMessage());
            }

            $styles = [];
            $totalQty = 0;
            $totalValue = 0.0;

            for ($i = $firstDataRow; $i < count($allRows); $i++) {
                $row = $allRows[$i];
                if ($this->isEmptyRow($row)) continue;

                // Hard stop at the template's footer block.
                if ($this->isFooterRow($row)) break;

                $mapped = $this->mapRow($row, $fieldForColumn);
                if (!$this->isUsableStyleRow($mapped)) continue;

                // Attach CAD images (phpspreadsheet rows are 1-indexed)
                $excelRow = $i + 1;
                if (!empty($imageByRow[$excelRow])) {
                    $mapped['images'] = $imageByRow[$excelRow];
                }

                $mapped = $this->postProcessStyle($mapped, $i);

                $qty = (int) ($mapped['quantity'] ?? 0);
                $price = (float) ($mapped['unit_price'] ?? 0);
                $totalQty += $qty;
                $totalValue += $qty * $price;

                $styles[] = $this->wrapStyleForFrontend($mapped);
            }

            $doc->header = $this->buildHeader($meta);
            $doc->styles = $styles;
            $doc->totals = ['total_quantity' => $totalQty, 'total_value' => $totalValue];

            // Master-data matches
            $this->applyMasterDataMatches($doc->header, $meta);

            $sailingDays = $this->resolveSailingDays($doc->header);
            $doc->header = $this->datePolicy()->apply($doc->header, $sailingDays);

            if (empty($styles)) {
                $doc->warnings[] = 'No style rows could be parsed from this Excel sheet.';
            }

            return $doc;
        } catch (\Throwable $e) {
            Log::error("Excel strategy {$this->key()} failed: " . $e->getMessage());
            return ParsedDocument::failure($this->key(), 'Excel parsing error: ' . $e->getMessage());
        }
    }

    protected function detectHeaderRow(array $allRows): ?int
    {
        $fingerprint = ['style', 'color', 'qty', 'price', 'description', 'label', 'fabric'];
        foreach ($allRows as $i => $row) {
            if ($i > 30) break;
            $normalized = array_map(fn($c) => strtolower(trim((string) $c)), $row);
            $hits = 0;
            foreach ($fingerprint as $f) {
                foreach ($normalized as $n) {
                    if ($n !== '' && str_contains($n, $f)) { $hits++; break; }
                }
            }
            if ($hits >= 3) return $i;
        }
        return null;
    }

    /** @return array<int,string> column-index => canonical field */
    protected function mapColumnsToFields(array $headerRow): array
    {
        $aliases = $this->headerAliases();
        $out = [];
        foreach ($headerRow as $colIdx => $cell) {
            $n = strtolower(trim((string) $cell));
            if ($n === '') continue;
            foreach ($aliases as $field => $variants) {
                foreach ($variants as $v) {
                    if (str_contains($n, strtolower($v))) {
                        $out[$colIdx] = $field;
                        continue 3;
                    }
                }
            }
        }
        return $out;
    }

    protected function mapRow(array $row, array $fieldForColumn): array
    {
        $mapped = [];
        foreach ($fieldForColumn as $colIdx => $field) {
            $val = $row[$colIdx] ?? null;
            if ($val === null || $val === '') continue;
            $mapped[$field] = $val;
        }
        if (isset($mapped['quantity'])) {
            $mapped['quantity'] = (int) preg_replace('/[^0-9]/', '', (string) $mapped['quantity']);
        }
        if (isset($mapped['unit_price'])) {
            $mapped['unit_price'] = (float) preg_replace('/[^0-9.]/', '', (string) $mapped['unit_price']);
        }

        // Structured size_breakdown from per-size sub-header columns. When
        // present, this overrides the single-cell text we may have captured
        // via headerAliases (the merged "SIZE SPECIFICATIONS" cell carries no
        // numeric data of its own). Sum-fallback fills quantity if the QTY
        // column was empty.
        if (!empty($this->sizeColumnMap)) {
            $breakdown = [];
            $sum = 0;
            foreach ($this->sizeColumnMap as $colIdx => $sizeName) {
                $raw = $row[$colIdx] ?? null;
                if ($raw === null || $raw === '') continue;
                $cleaned = preg_replace('/[^0-9.]/', '', (string) $raw);
                if ($cleaned === '' || !is_numeric($cleaned)) continue;
                $n = (int) round((float) $cleaned);
                if ($n <= 0) continue;
                $breakdown[$sizeName] = $n;
                $sum += $n;
            }
            if (!empty($breakdown)) {
                $mapped['size_breakdown'] = $breakdown;
                if (empty($mapped['quantity'])) {
                    $mapped['quantity'] = $sum;
                }
            }
        }

        return $mapped;
    }

    /**
     * Look at the 2 rows after the main header for size labels (S, M, L, XL,
     * etc.). When at least 2 are found, build a column-index → size-name map
     * so per-size cells can be read directly. Empty array when the template
     * doesn't use a sub-header (e.g. SCI's free-text "SIZE SCALE / PREPACK").
     *
     * @return array<int,string>
     */
    protected function detectSizeColumnMap(array $allRows, int $headerRow): array
    {
        $candidates = array_map('strtoupper', self::SIZE_LABELS);

        for ($probe = $headerRow + 1; $probe <= $headerRow + 2; $probe++) {
            $row = $allRows[$probe] ?? null;
            if ($row === null) continue;

            $found = [];
            foreach ($row as $colIdx => $cell) {
                $txt = strtoupper(trim((string) $cell));
                if ($txt === '') continue;
                // Cells like "S/M/L" or noise sneak in - only accept exact
                // matches against the known size labels.
                if (in_array($txt, $candidates, true)) {
                    $found[$colIdx] = $txt;
                }
            }
            if (count($found) >= 2) {
                return $found;
            }
        }
        return [];
    }

    /** Returns the absolute row index where the size sub-header sits, or null. */
    protected function locateSizeSubHeader(array $allRows, int $headerRow): ?int
    {
        $candidates = array_map('strtoupper', self::SIZE_LABELS);
        for ($probe = $headerRow + 1; $probe <= $headerRow + 2; $probe++) {
            $row = $allRows[$probe] ?? null;
            if ($row === null) continue;
            $hits = 0;
            foreach ($row as $cell) {
                $txt = strtoupper(trim((string) $cell));
                if ($txt !== '' && in_array($txt, $candidates, true)) $hits++;
            }
            if ($hits >= 2) return $probe;
        }
        return null;
    }

    /** True if the row contains a known footer label - signals end-of-grid. */
    protected function isFooterRow(array $row): bool
    {
        foreach ($row as $cell) {
            if ($cell === null) continue;
            $txt = strtolower(trim((string) $cell));
            if ($txt === '') continue;
            foreach (self::FOOTER_KEYWORDS as $kw) {
                if (str_contains($txt, $kw)) return true;
            }
        }
        return false;
    }

    /**
     * Reject rows where the parser snagged something footer-shaped in the
     * style-number column. Real style codes don't have spaces or trailing
     * colons, and almost always include at least one digit.
     */
    protected function isUsableStyleRow(array $mapped): bool
    {
        $sn = $mapped['style_number'] ?? null;
        if ($sn === null || $sn === '') return false;
        $sn = trim((string) $sn);
        if ($sn === '') return false;
        if (str_ends_with($sn, ':')) return false;
        // "SPECIAL NOTES/DETAILS" has internal spaces and matches no style code.
        if (preg_match('/\s/', $sn)) return false;
        if (!preg_match('/\d/', $sn)) return false;
        return true;
    }

    protected function isEmptyRow(array $row): bool
    {
        foreach ($row as $c) {
            if ($c !== null && trim((string) $c) !== '') return false;
        }
        return true;
    }

    /** Shape a mapped row as the frontend-expected style item. */
    protected function wrapStyleForFrontend(array $m): array
    {
        $ihdRaw = $m['ihd'] ?? null;
        $ihd = $ihdRaw !== null ? $this->normalizeDate((string) $ihdRaw) ?? $ihdRaw : null;

        return [
            'style_number' => ['value' => $m['style_number'] ?? null, 'status' => 'parsed', 'confidence' => 'high'],
            'description' => ['value' => $m['description'] ?? null, 'status' => 'parsed'],
            'color_name' => ['value' => $m['color_name'] ?? null, 'status' => 'parsed'],
            'colors' => !empty($m['color_name']) ? [['name' => $m['color_name'], 'code' => null]] : [],
            'label' => ['value' => $m['label'] ?? null, 'status' => 'parsed'],
            'fabric' => ['value' => $m['fabric'] ?? null, 'status' => 'parsed'],
            'fit' => ['value' => $m['fit'] ?? null, 'status' => 'parsed'],
            'notes' => ['value' => $m['notes'] ?? null, 'status' => 'parsed'],
            'size_breakdown' => ['value' => $m['size_breakdown'] ?? null, 'status' => 'parsed'],
            'pre_pack_inner' => ['value' => $m['pre_pack_inner'] ?? null, 'status' => 'parsed'],
            'quantity' => ['value' => $m['quantity'] ?? 0, 'status' => 'parsed', 'confidence' => 'high'],
            'unit_price' => ['value' => $m['unit_price'] ?? 0, 'status' => 'parsed', 'confidence' => 'high'],
            'packing' => ['value' => $m['packing'] ?? null, 'status' => 'parsed'],
            'ihd' => ['value' => $ihd, 'status' => 'parsed'],
            'images' => $m['images'] ?? [],
        ];
    }

    /**
     * Build the {value,status,raw_text,confidence} wrapped header from flat meta.
     * Strategies may add/override fields in extractDocumentMeta.
     */
    protected function buildHeader(array $meta): array
    {
        $wrap = fn($v, string $status = 'parsed', string $confidence = 'medium') => [
            'value' => $v,
            'status' => $v !== null && $v !== '' ? $status : 'missing',
            'raw_text' => is_scalar($v) ? (string) $v : null,
            'confidence' => $confidence,
        ];
        $h = [];
        foreach ([
            'po_number', 'po_date', 'buy_sheet_number', 'buy_sheet_name',
            'fob_date', 'etd_date', 'ex_factory_date', 'eta_date', 'in_warehouse_date',
            'retailer_name', 'buyer_name', 'customer_name', 'vendor_name', 'agent_name',
            'shipping_term', 'currency_raw', 'season_raw', 'country_of_origin',
            'ship_to', 'ship_to_address', 'packing_method', 'packing_guidelines',
            'other_terms', 'additional_notes', 'headline', 'payment_terms_raw',
        ] as $f) {
            $h[$f] = $wrap($meta[$f] ?? null);
        }
        return $h;
    }

    /** Populate *_id fields by fuzzy-matching master data against the raw names in the header. */
    protected function applyMasterDataMatches(array &$header, array $meta): void
    {
        $fuzzyMatch = function (string $modelClass, string $field, ?string $raw): array {
            if (!$raw) return ['value' => null, 'status' => 'missing'];
            $clean = trim($raw);
            $exact = $modelClass::where($field, $clean)->first();
            if ($exact) return ['value' => $exact->id, 'raw_text' => $raw, 'status' => 'matched', 'confidence' => 'high'];
            $like = $modelClass::where($field, 'LIKE', "%{$clean}%")->first();
            if ($like) return ['value' => $like->id, 'raw_text' => $raw, 'status' => 'matched', 'confidence' => 'medium'];
            return ['value' => null, 'raw_text' => $raw, 'status' => 'unrecognized', 'confidence' => 'low'];
        };

        $header['retailer_id'] = $fuzzyMatch(Retailer::class, 'name', $meta['retailer_name'] ?? null);
        $header['buyer_id'] = $fuzzyMatch(Buyer::class, 'name', $meta['buyer_name'] ?? null);
        if (($header['buyer_id']['status'] ?? '') === 'unrecognized') {
            $header['buyer_id'] = $fuzzyMatch(Buyer::class, 'code', $meta['buyer_name'] ?? null);
        }
        $header['season_id'] = $fuzzyMatch(Season::class, 'name', $meta['season_raw'] ?? null);
        $header['currency_id'] = $fuzzyMatch(Currency::class, 'code', $meta['currency_raw'] ?? null);
        if (($header['currency_id']['status'] ?? '') === 'unrecognized') {
            $header['currency_id'] = $fuzzyMatch(Currency::class, 'name', $meta['currency_raw'] ?? null);
        }
        $header['country_id'] = $fuzzyMatch(Country::class, 'name', $meta['country_of_origin'] ?? null);
        $header['payment_term_id'] = $fuzzyMatch(PaymentTerm::class, 'name', $meta['payment_terms_raw'] ?? null);

        // "Agent" on a PO maps to a User row with the Agency role - the supplier
        // name extracted from the spreadsheet is matched against User.name first,
        // then User.company so e.g. "CRYSTAL APPAREL" finds either form.
        $header['agency_id'] = $this->matchAgencyUser($meta['agent_name'] ?? null);
    }

    /** Match an extracted supplier/agent string against existing Agency users. */
    protected function matchAgencyUser(?string $raw): array
    {
        if (!$raw) return ['value' => null, 'status' => 'missing'];
        $clean = trim($raw);

        $base = User::role('Agency');
        $exact = (clone $base)->where(function ($q) use ($clean) {
            $q->where('name', $clean)->orWhere('company', $clean);
        })->first();
        if ($exact) {
            return ['value' => $exact->id, 'raw_text' => $raw, 'status' => 'matched', 'confidence' => 'high'];
        }

        $like = (clone $base)->where(function ($q) use ($clean) {
            $q->where('name', 'LIKE', "%{$clean}%")->orWhere('company', 'LIKE', "%{$clean}%");
        })->first();
        if ($like) {
            return ['value' => $like->id, 'raw_text' => $raw, 'status' => 'matched', 'confidence' => 'medium'];
        }

        return ['value' => null, 'raw_text' => $raw, 'status' => 'unrecognized', 'confidence' => 'low'];
    }

    protected function resolveSailingDays(array $header): ?int
    {
        $countryId = $header['country_id']['value'] ?? null;
        if ($countryId) {
            $c = Country::find($countryId);
            return $c?->sailing_time_days !== null ? (int) $c->sailing_time_days : null;
        }
        return null;
    }

    /**
     * Parse the "128- CITI TRENDS TOPS" retailer/buyer-name cell into buy_sheet_number + name.
     * Shared helper used by SCI strategies.
     */
    protected function parseBuySheetNumberCell(?string $cell): array
    {
        if (!$cell) return ['buy_sheet_number' => null, 'buy_sheet_name' => null];
        $cell = trim($cell);
        if (preg_match('/^(\d{1,6})\s*[-:]\s*(.+)$/u', $cell, $m)) {
            return ['buy_sheet_number' => $m[1], 'buy_sheet_name' => trim($m[2])];
        }
        return ['buy_sheet_number' => null, 'buy_sheet_name' => $cell];
    }

    /**
     * Scan the top N rows for a label-adjacent value. Returns the first non-empty
     * neighbouring cell (right / down / left). Pass an array to try multiple label
     * variants (e.g. `['BUYER APPROVALS REQUIRED', 'BUYER APPROVAL REQUIRED']`)
     * for templates that aren't quite uniform across customers.
     *
     * @param string|array<string> $label
     */
    protected function findLabelledValue(array $allRows, $label, int $maxRow = 25): ?string
    {
        $labels = is_array($label) ? $label : [$label];
        $labelsLc = array_map(fn($l) => strtolower($l), $labels);

        foreach ($allRows as $r => $row) {
            if ($r > $maxRow) break;
            foreach ($row as $c => $cell) {
                $str = strtolower(trim((string) $cell));
                if ($str === '') continue;
                $matched = false;
                foreach ($labelsLc as $needle) {
                    if (str_contains($str, $needle)) { $matched = true; break; }
                }
                if (!$matched) continue;
                // Probe right (1-4 cells), then below, then left (1-3 cells).
                // Right-leaning templates dominate but Massive's header puts
                // the value cell to the right with a few merged spacers in
                // between, hence the wider right reach.
                foreach ([
                    [$r, $c + 1], [$r, $c + 2], [$r, $c + 3], [$r, $c + 4],
                    [$r + 1, $c], [$r + 1, $c + 1],
                    [$r, $c - 1], [$r, $c - 2], [$r, $c - 3],
                ] as [$rr, $cc]) {
                    if ($cc < 0) continue;
                    $v = $allRows[$rr][$cc] ?? null;
                    if ($v === null) continue;
                    $vStr = trim((string) $v);
                    if ($vStr === '') continue;
                    // Skip cells that look like another label (end with `:`) or
                    // contain the same label substring - both would shadow the
                    // real value cell we're after.
                    if (str_ends_with($vStr, ':')) continue;
                    $vLc = strtolower($vStr);
                    $isAnotherLabel = false;
                    foreach ($labelsLc as $needle) {
                        if (str_contains($vLc, $needle)) { $isAnotherLabel = true; break; }
                    }
                    if ($isAnotherLabel) continue;
                    return $vStr;
                }
            }
        }
        return null;
    }

    protected function normalizeDate(?string $v): ?string
    {
        if ($v === null) return null;
        $v = trim($v);
        if ($v === '') return null;

        // PhpSpreadsheet returns typed-date cells as numeric serials when toArray()
        // is called with formatData=false. Translate before falling through to the
        // string-format ladder so IHD / DATE SUBMITTED don't end up as "46070".
        if (is_numeric($v) && (float) $v > 20000 && (float) $v < 80000) {
            try {
                $d = \PhpOffice\PhpSpreadsheet\Shared\Date::excelToDateTimeObject((float) $v);
                return $d->format('Y-m-d');
            } catch (\Throwable $e) {
                // fall through to string parsing
            }
        }

        $formats = ['m/d/Y', 'm/d/y', 'n/j/Y', 'n/j/y', 'Y-m-d', 'd/m/Y', 'd-m-Y'];
        foreach ($formats as $f) {
            $d = \DateTimeImmutable::createFromFormat($f, $v);
            if ($d !== false) return $d->format('Y-m-d');
        }
        $ts = strtotime($v);
        return $ts ? date('Y-m-d', $ts) : null;
    }
}
