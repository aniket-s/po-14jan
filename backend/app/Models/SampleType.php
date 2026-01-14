<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SampleType extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'display_name',
        'description',
        'prerequisites',
        'required_for_production',
        'parallel_submission_allowed',
        'typical_days',
        'display_order',
        'max_images',
        'is_active',
        'is_custom',
        'created_by',
    ];

    protected $casts = [
        'prerequisites' => 'array',
        'required_for_production' => 'boolean',
        'parallel_submission_allowed' => 'boolean',
        'is_active' => 'boolean',
        'is_custom' => 'boolean',
    ];

    /**
     * Get samples of this type
     */
    public function samples()
    {
        return $this->hasMany(Sample::class);
    }

    /**
     * Get the user who created this custom sample type
     */
    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * Get prerequisite sample types (from JSON array)
     */
    public function getPrerequisiteTypes()
    {
        if (empty($this->prerequisites)) {
            return collect();
        }

        return SampleType::whereIn('name', $this->prerequisites)->get();
    }

    /**
     * Check if all prerequisites are met for a given style
     */
    public function prerequisitesMet($styleId): bool
    {
        if (empty($this->prerequisites)) {
            return true;
        }

        $prerequisiteTypes = $this->getPrerequisiteTypes();

        foreach ($prerequisiteTypes as $prereqType) {
            $approvedSample = Sample::where('style_id', $styleId)
                ->where('sample_type_id', $prereqType->id)
                ->where('final_status', 'approved')
                ->exists();

            if (!$approvedSample) {
                return false;
            }
        }

        return true;
    }

    /**
     * Scope to get active sample types
     */
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    /**
     * Scope to get ordered sample types
     */
    public function scopeOrdered($query)
    {
        return $query->orderBy('display_order');
    }

    /**
     * Check if this sample type allows parallel submission
     */
    public function allowsParallelSubmission(): bool
    {
        return $this->parallel_submission_allowed ?? false;
    }
}
