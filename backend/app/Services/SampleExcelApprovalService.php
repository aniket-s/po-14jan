<?php

namespace App\Services;

use App\Models\Sample;
use App\Models\SampleType;
use App\Models\Style;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Maatwebsite\Excel\Facades\Excel;

class SampleExcelApprovalService
{
    /**
     * Process sample approvals from an uploaded Excel file.
     * Expected columns: style_number, sample_type, status (approved/rejected), rejection_reason
     */
    public function processApprovals(UploadedFile $file, User $agencyUser): array
    {
        $data = Excel::toArray(null, $file);

        if (empty($data) || empty($data[0])) {
            return [
                'processed' => 0,
                'approved' => 0,
                'rejected' => 0,
                'errors' => ['File is empty or could not be parsed'],
            ];
        }

        $rows = $data[0];
        $headers = array_map('strtolower', array_map('trim', $rows[0]));

        // Find column indexes
        $styleCol = $this->findColumn($headers, ['style_number', 'style', 'style_no', 'style #']);
        $sampleTypeCol = $this->findColumn($headers, ['sample_type', 'type', 'sample type']);
        $statusCol = $this->findColumn($headers, ['status', 'approval_status', 'approval', 'decision']);
        $reasonCol = $this->findColumn($headers, ['reason', 'rejection_reason', 'reject_reason', 'comments', 'notes']);

        if ($styleCol === null || $sampleTypeCol === null || $statusCol === null) {
            return [
                'processed' => 0,
                'approved' => 0,
                'rejected' => 0,
                'errors' => ['Required columns not found. Expected: style_number, sample_type, status'],
            ];
        }

        // Cache sample types
        $sampleTypes = SampleType::all()->keyBy(function ($type) {
            return strtolower($type->name);
        });
        $sampleTypesByDisplayName = SampleType::all()->keyBy(function ($type) {
            return strtolower($type->display_name);
        });

        $processed = 0;
        $approved = 0;
        $rejected = 0;
        $errors = [];

        // Skip header row
        for ($i = 1; $i < count($rows); $i++) {
            $row = $rows[$i];

            $styleNumber = trim($row[$styleCol] ?? '');
            $sampleTypeName = strtolower(trim($row[$sampleTypeCol] ?? ''));
            $status = strtolower(trim($row[$statusCol] ?? ''));
            $reason = trim($row[$reasonCol] ?? '') ?: null;

            if (empty($styleNumber) || empty($sampleTypeName) || empty($status)) {
                continue;
            }

            // Find style
            $style = Style::where('style_number', $styleNumber)->first();
            if (!$style) {
                $errors[] = "Row {$i}: Style '{$styleNumber}' not found";
                continue;
            }

            // Find sample type
            $sampleType = $sampleTypes->get($sampleTypeName) ?? $sampleTypesByDisplayName->get($sampleTypeName);
            if (!$sampleType) {
                $errors[] = "Row {$i}: Sample type '{$sampleTypeName}' not found";
                continue;
            }

            // Find sample
            $sample = Sample::where('style_id', $style->id)
                ->where('sample_type_id', $sampleType->id)
                ->where('agency_status', 'pending')
                ->first();

            if (!$sample) {
                $errors[] = "Row {$i}: No pending sample found for style '{$styleNumber}' type '{$sampleTypeName}'";
                continue;
            }

            // Process approval/rejection
            if (in_array($status, ['approved', 'approve', 'yes', 'pass'])) {
                $sample->agencyApprove($agencyUser->id);
                $approved++;
                $processed++;
            } elseif (in_array($status, ['rejected', 'reject', 'no', 'fail'])) {
                if (!$reason) {
                    $errors[] = "Row {$i}: Rejection reason required for style '{$styleNumber}'";
                    continue;
                }
                $sample->agencyReject($agencyUser->id, $reason);
                $rejected++;
                $processed++;
            } else {
                $errors[] = "Row {$i}: Invalid status '{$status}'. Use 'approved' or 'rejected'";
            }
        }

        return [
            'processed' => $processed,
            'approved' => $approved,
            'rejected' => $rejected,
            'errors' => $errors,
        ];
    }

    /**
     * Find column index by possible header names
     */
    private function findColumn(array $headers, array $possibleNames): ?int
    {
        foreach ($possibleNames as $name) {
            $index = array_search($name, $headers);
            if ($index !== false) {
                return $index;
            }
        }
        return null;
    }
}
