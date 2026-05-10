<?php

namespace App\Services;

use Carbon\Carbon;

class SampleScheduleService
{
    /**
     * Generate complete sample schedule based on PO date and ETD date
     *
     * Milestones:
     * - Lab Dip: PO Date + 7 days
     * - Fit Samples: PO Date + 7 days
     * - Trim Approvals: PO Date + 10 days
     * - 1st Proto Samples: PO Date + 10 days
     * - Bulk Fabric In-house: ETD Date - 40 days
     * - PP Sample: ETD Date - 35 days
     * - Production Start: ETD Date - 30 days
     * - TOP Approval: Ex-Factory Date - 10 days
     *
     * @param Carbon|string $poDate
     * @param Carbon|string $etdDate
     * @param Carbon|string|null $exFactoryDate
     * @return array
     */
    public function generateSchedule($poDate, $etdDate, $exFactoryDate = null): array
    {
        $po = $poDate instanceof Carbon ? $poDate : Carbon::parse($poDate);
        $etd = $etdDate instanceof Carbon ? $etdDate : Carbon::parse($etdDate);
        $exFactory = $exFactoryDate
            ? ($exFactoryDate instanceof Carbon ? $exFactoryDate : Carbon::parse($exFactoryDate))
            : $etd->copy()->subDays(7);

        return [
            'lab_dip' => [
                'name' => 'Lab Dip',
                'date' => $po->copy()->addDays(7),
                'description' => 'Within 7 days of PO Date',
                'days_from_po' => 7,
                'type' => 'po_based',
            ],
            'fit_samples' => [
                'name' => 'Fit Samples',
                'date' => $po->copy()->addDays(7),
                'description' => 'Within 7 days of PO Date',
                'days_from_po' => 7,
                'type' => 'po_based',
            ],
            'trim_approvals' => [
                'name' => 'Trim Approvals',
                'date' => $po->copy()->addDays(10),
                'description' => 'Within 10 days of PO Date',
                'days_from_po' => 10,
                'type' => 'po_based',
            ],
            'first_proto_samples' => [
                'name' => '1st Proto Samples',
                'date' => $po->copy()->addDays(10),
                'description' => 'Within 10 days of PO Date',
                'days_from_po' => 10,
                'type' => 'po_based',
            ],
            'bulk_fabric_inhouse' => [
                'name' => 'Bulk Fabric In-house',
                'date' => $etd->copy()->subDays(40),
                'description' => '40 days before ETD',
                'days_before_etd' => 40,
                'type' => 'etd_based',
            ],
            'pp_sample' => [
                'name' => 'PP Sample',
                'date' => $etd->copy()->subDays(35),
                'description' => '35 days before ETD',
                'days_before_etd' => 35,
                'type' => 'etd_based',
            ],
            'production_start' => [
                'name' => 'Production Start',
                'date' => $etd->copy()->subDays(30),
                'description' => '30 days before ETD',
                'days_before_etd' => 30,
                'type' => 'etd_based',
            ],
            'top_approval' => [
                'name' => 'TOP Approval',
                'date' => $exFactory->copy()->subDays(10),
                'description' => '10 days before Ex-Factory',
                'type' => 'ex_factory_based',
            ],
        ];
    }

    /**
     * @deprecated Use generateScheduleFromFactoryPoDate(). Retained until all
     * callers migrate to the factory-PO-date anchor.
     *
     * @param Carbon|string $factoryExFactoryDate
     * @return array
     */
    public function generateScheduleFromExFactory($factoryExFactoryDate): array
    {
        $anchor = $factoryExFactoryDate instanceof Carbon
            ? $factoryExFactoryDate
            : Carbon::parse($factoryExFactoryDate);

        $milestones = [
            'lab_dip'             => ['Lab Dip',            53],
            'fit_samples'         => ['Fit Samples',        53],
            'trim_approvals'      => ['Trim Approvals',     50],
            'first_proto_samples' => ['1st Proto Samples',  50],
            'bulk_fabric_inhouse' => ['Bulk Fabric In-house', 40],
            'pp_sample'           => ['PP Sample',          35],
            'production_start'   => ['Production Start',    30],
            'top_approval'        => ['TOP Approval',       10],
        ];

        $schedule = [];
        foreach ($milestones as $key => [$name, $daysBefore]) {
            $schedule[$key] = [
                'name' => $name,
                'date' => $anchor->copy()->subDays($daysBefore),
                'description' => "{$daysBefore} days before Ex-Factory",
                'days_before_ex_factory' => $daysBefore,
                'type' => 'ex_factory_anchored',
            ];
        }

        return $schedule;
    }

    /**
     * Generate a sample schedule anchored to the Factory PO Date (the date the
     * agency assigned the PO to the factory — i.e. purchase_order_style.assigned_at).
     *
     * Offsets are days AFTER Factory PO Date:
     * - Lab Dip:       +7
     * - Fit Sample:    +7
     * - 1st Proto:     +10
     * - Trim Approval: +10
     * - 2nd Proto:     +18
     * - Bulk Fabric:   +30
     * - PP Sample:     +35
     * - TOP:           +50
     *
     * @param Carbon|string $factoryPoDate
     * @return array
     */
    public function generateScheduleFromFactoryPoDate($factoryPoDate): array
    {
        $anchor = $factoryPoDate instanceof Carbon
            ? $factoryPoDate
            : Carbon::parse($factoryPoDate);

        $milestones = [
            'lab_dip'              => ['Lab Dip',        7],
            'fit_samples'          => ['Fit Sample',     7],
            'first_proto_samples'  => ['1st Proto',     10],
            'trim_approvals'       => ['Trim Approval', 10],
            'second_proto_samples' => ['2nd Proto',     18],
            'bulk_fabric_inhouse'  => ['Bulk Fabric',   30],
            'pp_sample'            => ['PP Sample',     35],
            'top_approval'         => ['TOP',           50],
        ];

        $schedule = [];
        foreach ($milestones as $key => [$name, $daysAfter]) {
            $schedule[$key] = [
                'name' => $name,
                'date' => $anchor->copy()->addDays($daysAfter),
                'description' => "{$daysAfter} days after Factory PO Date",
                'days_after_factory_po' => $daysAfter,
                'type' => 'factory_po_anchored',
            ];
        }

        return $schedule;
    }

    /**
     * Get sample schedule as simple date array
     *
     * @param Carbon|string $poDate
     * @param Carbon|string $etdDate
     * @return array
     */
    public function getScheduleDates($poDate, $etdDate): array
    {
        $schedule = $this->generateSchedule($poDate, $etdDate);

        return array_map(function ($milestone) {
            return $milestone['date']->format('Y-m-d');
        }, $schedule);
    }

    /**
     * Get schedule formatted for database storage
     *
     * @param Carbon|string $poDate
     * @param Carbon|string $etdDate
     * @return array
     */
    public function getScheduleForDatabase($poDate, $etdDate): array
    {
        $schedule = $this->generateSchedule($poDate, $etdDate);

        $result = [];
        foreach ($schedule as $key => $milestone) {
            $result[$key] = [
                'name' => $milestone['name'],
                'planned_date' => $milestone['date']->format('Y-m-d'),
                'actual_date' => null,
                'status' => 'pending',
                'notes' => $milestone['description'],
            ];
        }

        return $result;
    }

    /**
     * Check if sample schedule is achievable (no negative timelines)
     *
     * @param Carbon|string $poDate
     * @param Carbon|string $etdDate
     * @return array ['achievable' => bool, 'issues' => array]
     */
    public function validateSchedule($poDate, $etdDate): array
    {
        $po = $poDate instanceof Carbon ? $poDate : Carbon::parse($poDate);
        $etd = $etdDate instanceof Carbon ? $etdDate : Carbon::parse($etdDate);

        $issues = [];
        $schedule = $this->generateSchedule($poDate, $etdDate);

        // Check if ETD-based milestones happen before PO-based ones
        $latestPOBased = null;
        foreach ($schedule as $key => $milestone) {
            if ($milestone['type'] === 'po_based') {
                if (!$latestPOBased || $milestone['date']->greaterThan($latestPOBased)) {
                    $latestPOBased = $milestone['date'];
                }
            }
        }

        $earliestETDBased = null;
        foreach ($schedule as $key => $milestone) {
            if ($milestone['type'] === 'etd_based') {
                if (!$earliestETDBased || $milestone['date']->lessThan($earliestETDBased)) {
                    $earliestETDBased = $milestone['date'];
                    $earliestETDBasedKey = $key;
                }
            }
        }

        // Check for timeline conflicts
        if ($earliestETDBased && $latestPOBased && $earliestETDBased->lessThan($latestPOBased)) {
            $issues[] = "Timeline conflict: {$schedule[$earliestETDBasedKey]['name']} ({$earliestETDBased->format('Y-m-d')}) occurs before PO-based milestones are complete ({$latestPOBased->format('Y-m-d')})";
        }

        // Check minimum lead time (at least 40 days from PO to ETD)
        $daysBetween = $po->diffInDays($etd);
        if ($daysBetween < 40) {
            $issues[] = "Insufficient lead time: Only {$daysBetween} days between PO and ETD. Minimum 40 days recommended.";
        }

        return [
            'achievable' => empty($issues),
            'issues' => $issues,
            'days_between_po_etd' => $daysBetween,
        ];
    }

    /**
     * Get milestone status counts
     *
     * @param array $schedule Database schedule with actual dates
     * @return array
     */
    public function getMilestoneStats(array $schedule): array
    {
        $completed = 0;
        $pending = 0;
        $overdue = 0;
        $today = Carbon::today();

        foreach ($schedule as $milestone) {
            if (isset($milestone['actual_date']) && $milestone['actual_date']) {
                $completed++;
            } else {
                $plannedDate = Carbon::parse($milestone['planned_date']);
                if ($plannedDate->lessThan($today)) {
                    $overdue++;
                } else {
                    $pending++;
                }
            }
        }

        return [
            'total' => count($schedule),
            'completed' => $completed,
            'pending' => $pending,
            'overdue' => $overdue,
            'completion_percentage' => count($schedule) > 0 ? round(($completed / count($schedule)) * 100, 2) : 0,
        ];
    }
}
