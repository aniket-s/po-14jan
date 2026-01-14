<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class StyleSampleProcess extends Model
{
    use HasFactory;

    protected $fillable = [
        'style_id',
        'sample_type_id',
        'priority',
        'is_required',
        'status',
    ];

    protected $casts = [
        'is_required' => 'boolean',
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
     * Get all submitted samples for this process
     */
    public function samples()
    {
        return $this->hasMany(Sample::class, 'sample_type_id', 'sample_type_id')
            ->where('style_id', $this->style_id);
    }

    /**
     * Scope to get processes ordered by priority
     */
    public function scopeOrdered($query)
    {
        return $query->orderBy('priority');
    }

    /**
     * Scope to get processes by status
     */
    public function scopeByStatus($query, $status)
    {
        return $query->where('status', $status);
    }

    /**
     * Scope to get required processes
     */
    public function scopeRequired($query)
    {
        return $query->where('is_required', true);
    }

    /**
     * Check if this process is completed
     */
    public function isCompleted(): bool
    {
        return in_array($this->status, ['approved', 'skipped']);
    }

    /**
     * Check if this process is pending
     */
    public function isPending(): bool
    {
        return $this->status === 'pending';
    }

    /**
     * Mark as in progress
     */
    public function markInProgress(): void
    {
        $this->status = 'in_progress';
        $this->save();
    }

    /**
     * Mark as approved
     */
    public function markApproved(): void
    {
        $this->status = 'approved';
        $this->save();
    }

    /**
     * Mark as rejected
     */
    public function markRejected(): void
    {
        $this->status = 'rejected';
        $this->save();
    }

    /**
     * Mark as skipped
     */
    public function markSkipped(): void
    {
        $this->status = 'skipped';
        $this->save();
    }
}
