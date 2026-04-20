<?php

namespace App\Services\Import\Policies;

use App\Services\Import\Contracts\DateCalculationPolicy;

/**
 * Standard FOB date cascade:
 *   Ex-Factory = ETD - 7 days
 *   ETA        = ETD + country.sailing_time_days
 *   IHD        = ETA + 5 days
 *
 * Matches the existing frontend calculation (PdfImportDialog) so imports and
 * manual entry produce identical results.
 */
class FobDatePolicy implements DateCalculationPolicy
{
    public function key(): string { return 'fob'; }

    public function apply(array $header, ?int $sailingDays = null): array
    {
        $etdVal = $header['etd_date']['value'] ?? null;
        if (!$etdVal) {
            return $header;
        }
        try {
            $etd = new \DateTimeImmutable($etdVal);
        } catch (\Throwable $e) {
            return $header;
        }

        $set = function (array $h, string $key, \DateTimeInterface $d, string $confidence = 'medium'): array {
            if (empty($h[$key]['value'])) {
                $h[$key] = [
                    'value' => $d->format('Y-m-d'),
                    'status' => 'derived',
                    'raw_text' => null,
                    'confidence' => $confidence,
                ];
            }
            return $h;
        };

        $header = $set($header, 'ex_factory_date', $etd->modify('-7 days'));

        if ($sailingDays !== null && $sailingDays > 0) {
            $eta = $etd->modify("+{$sailingDays} days");
            $header = $set($header, 'eta_date', $eta);
            $header = $set($header, 'in_warehouse_date', $eta->modify('+5 days'));
        }
        return $header;
    }
}
