<?php

namespace App\Services\Import\Contracts;

/**
 * Date-policy interface. A policy transforms a parsed PO header by filling in
 * the four shipment dates (fob_date, ex_factory_date, etd_date, eta_date,
 * in_warehouse_date) according to a buyer-specific rule.
 *
 * Input/output `header` uses the same {value,status,raw_text,confidence} shape as
 * ClaudePdfImportService::buildPoHeader, so policies can plug in without touching
 * the rest of the pipeline.
 */
interface DateCalculationPolicy
{
    public function key(): string;

    /**
     * @param array $header  PO header array (by reference is not used; returned copy).
     * @param int|null $sailingDays  Resolved sailing days from the matched country, if any.
     * @return array Modified header.
     */
    public function apply(array $header, ?int $sailingDays = null): array;
}
