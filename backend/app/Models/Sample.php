<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Sample extends Model
{
    use HasFactory;

    protected $fillable = [
        'style_id',
        'sample_type_id',
        'submitted_by',
        'submission_date',
        'sample_reference',
        'quantity',
        'attachment_paths',
        'images',
        'notes',
        'agency_status',
        'agency_approved_by',
        'agency_approved_at',
        'agency_rejection_reason',
        'importer_status',
        'importer_approved_by',
        'importer_approved_at',
        'importer_rejection_reason',
        'final_status',
        'metadata',
    ];

    protected $casts = [
        'submission_date' => 'date',
        'agency_approved_at' => 'datetime',
        'importer_approved_at' => 'datetime',
        'attachment_paths' => 'array',
        'images' => 'array',
        'metadata' => 'array',
    ];

    /**
     * Get the style
     */
    public function style()
    {
        return $this->belongsTo(Style::class);
    }

    /**
     * Get the sample type
     */
    public function sampleType()
    {
        return $this->belongsTo(SampleType::class);
    }

    /**
     * Get the user who submitted the sample
     */
    public function submittedBy()
    {
        return $this->belongsTo(User::class, 'submitted_by');
    }

    /**
     * Get the agency approver
     */
    public function agencyApprovedBy()
    {
        return $this->belongsTo(User::class, 'agency_approved_by');
    }

    /**
     * Get the importer approver
     */
    public function importerApprovedBy()
    {
        return $this->belongsTo(User::class, 'importer_approved_by');
    }

    /**
     * Scope to filter by style
     */
    public function scopeByStyle($query, $styleId)
    {
        return $query->where('style_id', $styleId);
    }

    /**
     * Scope to filter by sample type
     */
    public function scopeBySampleType($query, $sampleTypeId)
    {
        return $query->where('sample_type_id', $sampleTypeId);
    }

    /**
     * Scope to filter by final status
     */
    public function scopeByStatus($query, $status)
    {
        return $query->where('final_status', $status);
    }

    /**
     * Check if sample is pending agency approval
     */
    public function isPendingAgencyApproval(): bool
    {
        return $this->agency_status === 'pending';
    }

    /**
     * Check if sample is pending importer approval
     */
    public function isPendingImporterApproval(): bool
    {
        return $this->agency_status === 'approved' && $this->importer_status === 'pending';
    }

    /**
     * Check if sample is fully approved
     */
    public function isFullyApproved(): bool
    {
        return $this->agency_status === 'approved' &&
               $this->importer_status === 'approved' &&
               $this->final_status === 'approved';
    }

    /**
     * Check if sample is rejected
     */
    public function isRejected(): bool
    {
        return $this->final_status === 'rejected';
    }

    /**
     * Agency approves sample
     */
    public function agencyApprove(int $userId): void
    {
        $this->agency_status = 'approved';
        $this->agency_approved_by = $userId;
        $this->agency_approved_at = now();
        $this->agency_rejection_reason = null;

        $this->updateFinalStatus();
        $this->save();
    }

    /**
     * Agency rejects sample
     */
    public function agencyReject(int $userId, ?string $reason = null): void
    {
        $this->agency_status = 'rejected';
        $this->agency_approved_by = $userId;
        $this->agency_approved_at = now();
        $this->agency_rejection_reason = $reason;
        $this->final_status = 'rejected';
        $this->save();
    }

    /**
     * Importer approves sample
     */
    public function importerApprove(int $userId): void
    {
        $this->importer_status = 'approved';
        $this->importer_approved_by = $userId;
        $this->importer_approved_at = now();
        $this->importer_rejection_reason = null;

        $this->updateFinalStatus();
        $this->save();
    }

    /**
     * Importer rejects sample
     */
    public function importerReject(int $userId, ?string $reason = null): void
    {
        $this->importer_status = 'rejected';
        $this->importer_approved_by = $userId;
        $this->importer_approved_at = now();
        $this->importer_rejection_reason = $reason;
        $this->final_status = 'rejected';
        $this->save();
    }

    /**
     * Update final status based on agency + importer approvals
     */
    private function updateFinalStatus(): void
    {
        if ($this->agency_status === 'approved' && $this->importer_status === 'approved') {
            $this->final_status = 'approved';
        } elseif ($this->agency_status === 'rejected' || $this->importer_status === 'rejected') {
            $this->final_status = 'rejected';
        } else {
            $this->final_status = 'pending';
        }
    }

    /**
     * Check if sample type allows parallel submission
     */
    public function canSubmitInParallel(): bool
    {
        return $this->sampleType && $this->sampleType->allowsParallelSubmission();
    }

    /**
     * Get prerequisite sample type
     */
    public function getPrerequisiteSampleType()
    {
        return $this->sampleType?->prerequisiteSampleType;
    }

    /**
     * Check if prerequisites are met for this sample type
     */
    public function prerequisitesMet(): bool
    {
        if ($this->canSubmitInParallel()) {
            return true;
        }

        $prerequisiteType = $this->getPrerequisiteSampleType();
        if (!$prerequisiteType) {
            return true;
        }

        $prerequisiteSample = Sample::where('style_id', $this->style_id)
            ->where('sample_type_id', $prerequisiteType->id)
            ->where('final_status', 'approved')
            ->exists();

        return $prerequisiteSample;
    }
}
