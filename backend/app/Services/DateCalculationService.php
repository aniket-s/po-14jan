<?php

namespace App\Services;

use Carbon\Carbon;
use App\Models\Country;

class DateCalculationService
{
    /**
     * Calculate ETA date based on ETD and country sailing time
     *
     * @param Carbon|string $etdDate
     * @param int $countryId
     * @return Carbon|null
     */
    public function calculateETA($etdDate, ?int $countryId): ?Carbon
    {
        if (!$etdDate || !$countryId) {
            return null;
        }

        $etd = $etdDate instanceof Carbon ? $etdDate : Carbon::parse($etdDate);
        $country = Country::find($countryId);

        if (!$country) {
            return null;
        }

        return $etd->copy()->addDays($country->sailing_time_days);
    }

    /**
     * Calculate in-warehouse date (ETA + 4 working days)
     * Working days exclude Saturday and Sunday
     *
     * @param Carbon|string $etaDate
     * @return Carbon|null
     */
    public function calculateInWarehouseDate($etaDate): ?Carbon
    {
        if (!$etaDate) {
            return null;
        }

        $eta = $etaDate instanceof Carbon ? $etaDate : Carbon::parse($etaDate);

        return $this->addWorkingDays($eta, 4);
    }

    /**
     * Add working days to a date (excluding weekends)
     *
     * @param Carbon $date
     * @param int $days
     * @return Carbon
     */
    public function addWorkingDays(Carbon $date, int $days): Carbon
    {
        $result = $date->copy();
        $addedDays = 0;

        while ($addedDays < $days) {
            $result->addDay();

            // Skip Saturday (6) and Sunday (0)
            if ($result->dayOfWeek !== Carbon::SATURDAY && $result->dayOfWeek !== Carbon::SUNDAY) {
                $addedDays++;
            }
        }

        return $result;
    }

    /**
     * Calculate all shipping dates at once
     *
     * @param Carbon|string $etdDate
     * @param int|null $countryId
     * @return array ['eta' => Carbon|null, 'in_warehouse' => Carbon|null]
     */
    public function calculateShippingDates($etdDate, ?int $countryId): array
    {
        $eta = $this->calculateETA($etdDate, $countryId);
        $inWarehouse = $eta ? $this->calculateInWarehouseDate($eta) : null;

        return [
            'eta' => $eta,
            'in_warehouse' => $inWarehouse,
        ];
    }

    /**
     * Calculate business days between two dates
     *
     * @param Carbon $startDate
     * @param Carbon $endDate
     * @return int
     */
    public function businessDaysBetween(Carbon $startDate, Carbon $endDate): int
    {
        $days = 0;
        $current = $startDate->copy();

        while ($current->lessThan($endDate)) {
            if ($current->dayOfWeek !== Carbon::SATURDAY && $current->dayOfWeek !== Carbon::SUNDAY) {
                $days++;
            }
            $current->addDay();
        }

        return $days;
    }
}
