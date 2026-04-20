<?php

namespace App\Services\Import\Policies;

use App\Services\Import\Contracts\DateCalculationPolicy;

/**
 * Massive FOB rule (per product direction):
 *   FOB Date    = "DIRECT TO CONSOLIDATOR" date (fob_date on header)
 *   Ex-Factory  = FOB - 15 calendar days
 *   ETD, ETA, IHD -> NOT computed (left null, In-House/ETD/ETA inapplicable for this flow)
 *
 * The strategy is responsible for populating header['fob_date']['value'] from
 * the consolidator date before this policy runs.
 */
class MassiveFobDatePolicy implements DateCalculationPolicy
{
    public function key(): string { return 'massive_fob'; }

    public function apply(array $header, ?int $sailingDays = null): array
    {
        $fobVal = $header['fob_date']['value'] ?? null;
        if (!$fobVal) {
            return $header;
        }
        try {
            $fob = new \DateTimeImmutable($fobVal);
        } catch (\Throwable $e) {
            return $header;
        }

        if (empty($header['ex_factory_date']['value'])) {
            $header['ex_factory_date'] = [
                'value' => $fob->modify('-15 days')->format('Y-m-d'),
                'status' => 'derived',
                'raw_text' => null,
                'confidence' => 'high',
            ];
        }
        return $header;
    }
}
