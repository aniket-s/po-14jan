<?php

namespace App\Services\Import\Contracts;

use App\Services\Import\DTO\ParsedDocument;

/**
 * A strategy parses one (buyer, format, document-kind) combination. Strategies
 * are registered in ImportStrategyRegistry and selected by their unique key.
 *
 * Strategies must:
 *  - return a ParsedDocument that conforms to the current
 *    PdfAnalysisResult contract used by the frontend wizard;
 *  - apply their DateCalculationPolicy internally so controllers don't need to;
 *  - never throw for parsing failures - return ParsedDocument::failure() instead.
 */
interface PoImportStrategy
{
    public function key(): string;

    public function label(): string;

    public function buyerCode(): string;

    /** 'pdf' | 'excel' */
    public function format(): string;

    /** 'po' | 'buy_sheet' */
    public function documentKind(): string;

    public function supportsBuySheetReference(): bool;

    public function datePolicy(): DateCalculationPolicy;

    /**
     * @param string $filePath  Absolute path to the uploaded temp file.
     * @param array $ctx        Optional context: buyer_id, buy_sheet_id, retailer_id.
     */
    public function analyze(string $filePath, array $ctx = []): ParsedDocument;
}
