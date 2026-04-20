<?php

namespace App\Services\Import\Policies;

use App\Services\Import\Contracts\DateCalculationPolicy;

/**
 * No-op date policy for buy-sheet-only imports. Buy sheets precede the PO and
 * don't carry shipment dates - we don't derive anything.
 */
class NoDatesPolicy implements DateCalculationPolicy
{
    public function key(): string { return 'none'; }

    public function apply(array $header, ?int $sailingDays = null): array
    {
        return $header;
    }
}
