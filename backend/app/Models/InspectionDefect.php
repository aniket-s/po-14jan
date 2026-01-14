<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class InspectionDefect extends Model
{
    use HasFactory;

    protected $fillable = [
        'quality_inspection_id',
        'defect_type_id',
        'quantity',
        'description',
        'location', // e.g., "Front pocket", "Collar", "Sleeve"
        'images',
        'severity', // Denormalized from defect_type for quick access
    ];

    protected $casts = [
        'quantity' => 'integer',
        'images' => 'array',
    ];

    /**
     * Get the quality inspection
     */
    public function qualityInspection()
    {
        return $this->belongsTo(QualityInspection::class);
    }

    /**
     * Get the defect type
     */
    public function defectType()
    {
        return $this->belongsTo(DefectType::class);
    }

    /**
     * Check if defect is critical
     */
    public function isCritical(): bool
    {
        return $this->severity === 'critical';
    }

    /**
     * Check if defect is major
     */
    public function isMajor(): bool
    {
        return $this->severity === 'major';
    }

    /**
     * Check if defect is minor
     */
    public function isMinor(): bool
    {
        return $this->severity === 'minor';
    }
}
