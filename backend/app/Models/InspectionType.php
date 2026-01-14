<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class InspectionType extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'code',
        'description',
        'requires_sample_size',
        'requires_aql_level',
        'can_generate_certificate',
        'display_order',
        'is_active',
    ];

    protected $casts = [
        'requires_sample_size' => 'boolean',
        'requires_aql_level' => 'boolean',
        'can_generate_certificate' => 'boolean',
        'is_active' => 'boolean',
    ];

    /**
     * Get quality inspections of this type
     */
    public function qualityInspections()
    {
        return $this->hasMany(QualityInspection::class);
    }

    /**
     * Scope to get active inspection types
     */
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    /**
     * Scope to get ordered inspection types
     */
    public function scopeOrdered($query)
    {
        return $query->orderBy('display_order');
    }
}
