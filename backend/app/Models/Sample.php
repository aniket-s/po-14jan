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
        'factory_status',
        'factory_approved_by',
        'factory_approved_at',
        'factory_rejection_reason',
        'importer_status',
        'importer_approved_by',
        'importer_approved_at',
        'importer_rejection_reason',
        'final_status',
        'metadata',
    ];

    protected $casts = [
        'submission_date' => 'date',
        'factory_approved_at' => 'datetime',
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
     * Get the factory approver
     */
    public function factoryApprovedBy()
    {
        return $this->belongsTo(User::class, 'factory_approved_by');
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
     * Check if sample is pending factory approval
     */
    public function isPendingFactoryApproval(): bool
    {
        return $this->factory_status === 'pending';
    }

    /**
     * Check if sample is pending importer approval
     */
    public function isPendingImporterApproval(): bool
    {
        return $this->factory_status === 'approved' && $this->importer_status === 'pending';
    }

    /**
     * Check if sample is fully approved
     */
    public function isFullyApproved(): bool
    {
        return $this->factory_status === 'approved' &&
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
     * Factory approves sample
     */
    public function factoryApprove(int $userId): void
    {
        $this->factory_status = 'approved';
        $this->factory_approved_by = $userId;
        $this->factory_approved_at = now();
        $this->factory_rejection_reason = null;

        // Check if this completes the approval process
        $this->updateFinalStatus();
        $this->save();
    }

    /**
     * Factory rejects sample
     */
    public function factoryReject(int $userId, ?string $reason = null): void
    {
        $this->factory_status = 'rejected';
        $this->factory_approved_by = $userId;
        $this->factory_approved_at = now();
        $this->factory_rejection_reason = $reason;
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

        // Check if this completes the approval process
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
     * Update final status based on both approvals
     */
    private function updateFinalStatus(): void
    {
        if ($this->factory_status === 'approved' && $this->importer_status === 'approved') {
            $this->final_status = 'approved';
        } elseif ($this->factory_status === 'rejected' || $this->importer_status === 'rejected') {
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
        // First 5 types have no prerequisites
        if ($this->canSubmitInParallel()) {
            return true;
        }

        // Check if prerequisite sample is approved
        $prerequisiteType = $this->getPrerequisiteSampleType();
        if (!$prerequisiteType) {
            return true; // No prerequisite required
        }

        $prerequisiteSample = Sample::where('style_id', $this->style_id)
            ->where('sample_type_id', $prerequisiteType->id)
            ->where('final_status', 'approved')
            ->exists();

        return $prerequisiteSample;
    }
}
