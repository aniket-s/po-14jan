<?php

namespace App\Services\Import\Strategies;

use App\Models\Country;
use App\Services\ClaudePdfImportService;
use App\Services\Import\Contracts\PoImportStrategy;
use App\Services\Import\DTO\ParsedDocument;
use App\Services\PdfImportService;
use Illuminate\Support\Facades\Log;

/**
 * Base for PDF strategies. Delegates the heavy lifting to the existing
 * ClaudePdfImportService (with PdfImportService regex fallback) and then
 * applies the strategy's DateCalculationPolicy.
 *
 * Concrete subclasses only need to declare the key/label/buyerCode and
 * override `refineHeader` / `refineStyles` if they want buyer-specific
 * post-processing on top of the generic Claude extraction.
 */
abstract class AbstractClaudePdfStrategy implements PoImportStrategy
{
    public function __construct(
        protected ClaudePdfImportService $claude,
        protected PdfImportService $regex,
    ) {}

    public function format(): string { return 'pdf'; }
    public function documentKind(): string { return 'po'; }
    public function supportsBuySheetReference(): bool { return true; }

    public function analyze(string $filePath, array $ctx = []): ParsedDocument
    {
        $result = $this->claude->analyzePdf($filePath);
        if (empty($result['success'])) {
            Log::warning('Claude PDF extraction failed, falling back to regex', [
                'strategy' => $this->key(),
                'error' => $result['error'] ?? null,
            ]);
            $result = $this->regex->analyzePdf($filePath);
        }

        $doc = new ParsedDocument();
        $doc->strategyKey = $this->key();
        $doc->kind = $this->documentKind() === 'buy_sheet'
            ? ParsedDocument::KIND_BUY_SHEET
            : ParsedDocument::KIND_PO;

        if (empty($result['success'])) {
            return ParsedDocument::failure($this->key(), $result['error'] ?? 'PDF extraction failed.');
        }

        $doc->header = $result['po_header'] ?? [];
        $doc->styles = $result['styles'] ?? [];
        $doc->totals = $result['totals'] ?? ['total_quantity' => 0, 'total_value' => 0];
        $doc->warnings = $result['warnings'] ?? [];
        $doc->errors = $result['errors'] ?? [];
        $doc->rawText = $result['raw_text'] ?? '';
        $doc->aiUsage = $result['ai_usage'] ?? null;

        // Let subclasses tweak before date policy runs
        $doc->header = $this->refineHeader($doc->header, $ctx);
        $doc->styles = $this->refineStyles($doc->styles, $ctx);

        // Apply date policy
        $sailingDays = $this->resolveSailingDays($doc->header);
        $doc->header = $this->datePolicy()->apply($doc->header, $sailingDays);

        return $doc;
    }

    protected function refineHeader(array $header, array $ctx): array { return $header; }
    protected function refineStyles(array $styles, array $ctx): array { return $styles; }

    protected function resolveSailingDays(array $header): ?int
    {
        $countryId = $header['country_id']['value'] ?? null;
        if ($countryId) {
            $c = Country::find($countryId);
            return $c?->sailing_time_days !== null ? (int) $c->sailing_time_days : null;
        }
        return null;
    }
}
