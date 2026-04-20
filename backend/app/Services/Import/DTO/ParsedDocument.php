<?php

namespace App\Services\Import\DTO;

/**
 * Normalized shape returned by every PoImportStrategy::analyze().
 *
 * - `kind` is either 'po' or 'buy_sheet' and tells the commit endpoint which table to write to.
 * - `header` mirrors the existing PdfAnalysisResult po_header format ({value,status,raw_text,confidence}).
 * - `styles` mirror the existing PdfAnalysisResult style entries.
 * - Unused fields may be left empty arrays; never null.
 */
class ParsedDocument
{
    public const KIND_PO = 'po';
    public const KIND_BUY_SHEET = 'buy_sheet';

    public string $kind = self::KIND_PO;
    public string $strategyKey = '';
    public array $header = [];
    public array $styles = [];
    public array $totals = ['total_quantity' => 0, 'total_value' => 0];
    public array $warnings = [];
    public array $errors = [];
    public string $rawText = '';
    public ?array $aiUsage = null;
    public bool $success = true;

    public function toArray(): array
    {
        return [
            'success' => $this->success,
            'kind' => $this->kind,
            'strategy_key' => $this->strategyKey,
            'po_header' => $this->header,
            'styles' => $this->styles,
            'totals' => $this->totals,
            'warnings' => $this->warnings,
            'errors' => $this->errors,
            'raw_text' => $this->rawText,
            'ai_usage' => $this->aiUsage,
        ];
    }

    public static function failure(string $strategyKey, string $error): self
    {
        $d = new self();
        $d->strategyKey = $strategyKey;
        $d->success = false;
        $d->errors = [$error];
        return $d;
    }
}
