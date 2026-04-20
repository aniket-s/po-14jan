<?php

namespace App\Services\Import\Policies;

use App\Services\Import\Contracts\DateCalculationPolicy;

/**
 * DDP inverse cascade, anchored on in_warehouse_date:
 *   ETA        = IHD - 5 days
 *   ETD        = ETA - sailing
 *   Ex-Factory = ETD - 7 days
 */
class DdpDatePolicy implements DateCalculationPolicy
{
    public function key(): string { return 'ddp'; }

    public function apply(array $header, ?int $sailingDays = null): array
    {
        $ihdVal = $header['in_warehouse_date']['value'] ?? null;
        if (!$ihdVal) {
            return $header;
        }
        try {
            $ihd = new \DateTimeImmutable($ihdVal);
        } catch (\Throwable $e) {
            return $header;
        }

        $set = function (array $h, string $key, \DateTimeInterface $d): array {
            if (empty($h[$key]['value'])) {
                $h[$key] = [
                    'value' => $d->format('Y-m-d'),
                    'status' => 'derived',
                    'raw_text' => null,
                    'confidence' => 'medium',
                ];
            }
            return $h;
        };

        $eta = $ihd->modify('-5 days');
        $header = $set($header, 'eta_date', $eta);

        if ($sailingDays !== null && $sailingDays > 0) {
            $etd = $eta->modify("-{$sailingDays} days");
            $header = $set($header, 'etd_date', $etd);
            $header = $set($header, 'ex_factory_date', $etd->modify('-7 days'));
        }
        return $header;
    }
}
