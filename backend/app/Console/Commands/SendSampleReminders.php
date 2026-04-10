<?php

namespace App\Console\Commands;

use App\Models\PurchaseOrder;
use App\Models\Sample;
use App\Models\SampleType;
use App\Models\User;
use App\Notifications\SampleReminderNotification;
use Carbon\Carbon;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Log;

class SendSampleReminders extends Command
{
    protected $signature = 'sample:send-reminders
                            {--days-before=3 : Days before deadline to send approaching reminder}';

    protected $description = 'Send reminder notifications for upcoming, due, and overdue sample deadlines';

    /**
     * Map PO sample_schedule keys to SampleType.name values.
     */
    private const SCHEDULE_TO_SAMPLE_TYPE = [
        'lab_dip_submission' => 'lab_dip',
        'fit_sample_submission' => 'fit_sample',
        'trim_approvals' => 'trim_card',
        'pp_sample_submission' => 'pp_sample',
        'top_approval' => 'top_sample',
    ];

    private const SCHEDULE_DISPLAY_NAMES = [
        'lab_dip_submission' => 'Lab Dip',
        'fit_sample_submission' => 'Fit Sample',
        'trim_approvals' => 'Trim Approvals',
        'pp_sample_submission' => 'PP Sample',
        'top_approval' => 'TOP Approval',
    ];

    public function handle(): int
    {
        $daysBefore = (int) $this->option('days-before');
        $today = Carbon::today();

        $this->info("Checking sample deadlines (approaching within {$daysBefore} days)...");

        // Preload sample type IDs by name
        $sampleTypeIds = SampleType::pluck('id', 'name')->toArray();

        // Get all POs that have a sample_schedule and are not cancelled
        $pos = PurchaseOrder::whereNotNull('sample_schedule')
            ->where('status', '!=', 'cancelled')
            ->with(['styles' => function ($q) {
                $q->select('styles.id');
            }])
            ->get();

        $sentCount = 0;

        foreach ($pos as $po) {
            $schedule = $po->sample_schedule;
            if (!is_array($schedule) || empty($schedule)) {
                continue;
            }

            // Get style IDs for this PO
            $styleIds = $po->styles->pluck('id')->toArray();
            if (empty($styleIds)) {
                continue;
            }

            // Find Factory users assigned to styles in this PO
            $factoryUserIds = \Illuminate\Support\Facades\DB::table('purchase_order_style')
                ->where('purchase_order_id', $po->id)
                ->whereNotNull('assigned_factory_id')
                ->pluck('assigned_factory_id')
                ->unique()
                ->toArray();

            if (empty($factoryUserIds)) {
                continue;
            }

            $factoryUsers = User::whereIn('id', $factoryUserIds)->get();

            foreach (self::SCHEDULE_TO_SAMPLE_TYPE as $scheduleKey => $sampleTypeName) {
                $dueDate = $schedule[$scheduleKey] ?? null;
                if (!$dueDate) {
                    continue;
                }

                $dueDateCarbon = Carbon::parse($dueDate);
                $daysUntilDue = $today->diffInDays($dueDateCarbon, false);

                // Skip if already far in the future
                if ($daysUntilDue > $daysBefore) {
                    continue;
                }

                // Skip if the date was more than 14 days ago (avoid ancient reminders)
                if ($daysUntilDue < -14) {
                    continue;
                }

                $sampleTypeId = $sampleTypeIds[$sampleTypeName] ?? null;
                if (!$sampleTypeId) {
                    continue;
                }

                // Check if an approved sample of this type exists for any style in this PO
                $hasApprovedSample = Sample::where('sample_type_id', $sampleTypeId)
                    ->whereIn('style_id', $styleIds)
                    ->where('final_status', 'approved')
                    ->exists();

                if ($hasApprovedSample) {
                    continue; // Already done, no reminder needed
                }

                // Check if a pending sample exists (submitted, awaiting approval)
                $hasPendingSample = Sample::where('sample_type_id', $sampleTypeId)
                    ->whereIn('style_id', $styleIds)
                    ->where('final_status', 'pending')
                    ->exists();

                // Determine reminder type
                if ($daysUntilDue > 0 && $daysUntilDue <= $daysBefore) {
                    $reminderType = 'approaching';
                } elseif ($daysUntilDue === 0) {
                    $reminderType = 'due_today';
                } else {
                    $reminderType = 'overdue';
                }

                $displayName = self::SCHEDULE_DISPLAY_NAMES[$scheduleKey] ?? $sampleTypeName;

                // Send to Factory users - remind to submit if not submitted
                if (!$hasPendingSample) {
                    foreach ($factoryUsers as $factoryUser) {
                        $factoryUser->notify(new SampleReminderNotification(
                            $reminderType,
                            $displayName,
                            $po->po_number,
                            $dueDateCarbon->format('Y-m-d'),
                            $po->id,
                            (int) $daysUntilDue,
                        ));
                        $sentCount++;
                    }
                }

                // If sample is pending approval, remind Agency/Importer
                if ($hasPendingSample && ($reminderType === 'due_today' || $reminderType === 'overdue')) {
                    // Notify Agency
                    if ($po->agency_id) {
                        $agency = User::find($po->agency_id);
                        if ($agency) {
                            $agency->notify(new SampleReminderNotification(
                                $reminderType,
                                $displayName . ' (awaiting your approval)',
                                $po->po_number,
                                $dueDateCarbon->format('Y-m-d'),
                                $po->id,
                                (int) $daysUntilDue,
                            ));
                            $sentCount++;
                        }
                    }

                    // Notify Importer
                    if ($po->importer_id) {
                        $importer = User::find($po->importer_id);
                        if ($importer) {
                            $importer->notify(new SampleReminderNotification(
                                $reminderType,
                                $displayName . ' (awaiting approval)',
                                $po->po_number,
                                $dueDateCarbon->format('Y-m-d'),
                                $po->id,
                                (int) $daysUntilDue,
                            ));
                            $sentCount++;
                        }
                    }
                }
            }
        }

        $this->info("Done. Sent {$sentCount} reminder notification(s).");
        Log::info("Sample reminders: sent {$sentCount} notifications.");

        return self::SUCCESS;
    }
}
