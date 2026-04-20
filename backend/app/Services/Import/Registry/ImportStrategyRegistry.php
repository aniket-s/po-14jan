<?php

namespace App\Services\Import\Registry;

use App\Services\Import\Contracts\PoImportStrategy;
use App\Services\Import\Strategies\MassiveDdpExcelPoStrategy;
use App\Services\Import\Strategies\MassiveFobExcelPoStrategy;
use App\Services\Import\Strategies\RebelMindsPdfPoStrategy;
use App\Services\Import\Strategies\SciExcelBuySheetStrategy;
use App\Services\Import\Strategies\SciPdfPoStrategy;

/**
 * Single source of truth for all import strategies. The registry is resolved
 * from the container so strategies themselves can depend on other services
 * (ClaudeApiService, ExcelImportService, etc.) via constructor injection.
 */
class ImportStrategyRegistry
{
    /** @var PoImportStrategy[] keyed by strategy->key() */
    private array $strategies = [];

    public function __construct(
        SciPdfPoStrategy $sciPdfPo,
        SciExcelBuySheetStrategy $sciExcelBuySheet,
        MassiveDdpExcelPoStrategy $massiveDdp,
        MassiveFobExcelPoStrategy $massiveFob,
        RebelMindsPdfPoStrategy $rebelMinds,
    ) {
        foreach ([$sciPdfPo, $sciExcelBuySheet, $massiveDdp, $massiveFob, $rebelMinds] as $s) {
            $this->strategies[$s->key()] = $s;
        }
    }

    /** @return PoImportStrategy[] */
    public function all(): array
    {
        return array_values($this->strategies);
    }

    public function get(string $key): ?PoImportStrategy
    {
        return $this->strategies[$key] ?? null;
    }

    public function getOrFail(string $key): PoImportStrategy
    {
        $s = $this->get($key);
        if (!$s) {
            throw new \InvalidArgumentException("Unknown import strategy: {$key}");
        }
        return $s;
    }

    /**
     * Descriptor array suitable for returning to the frontend picker.
     */
    public function describe(): array
    {
        return array_map(fn(PoImportStrategy $s) => [
            'key' => $s->key(),
            'label' => $s->label(),
            'buyer_code' => $s->buyerCode(),
            'format' => $s->format(),
            'document_kind' => $s->documentKind(),
            'supports_buy_sheet' => $s->supportsBuySheetReference(),
            'date_policy' => $s->datePolicy()->key(),
        ], $this->all());
    }
}
