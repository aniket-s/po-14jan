<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class DefectType extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'code',
        'description',
        'severity', // critical, major, minor
        'display_order',
        'is_active',
    ];

    protected $casts = [
        'is_active' => 'boolean',
    ];

    /**
     * Get inspection defects of this type
     */
    public function inspectionDefects()
    {
        return $this->hasMany(InspectionDefect::class);
    }

    /**
     * Scope to get active defect types
     */
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    /**
     * Scope to get ordered defect types
     */
    public function scopeOrdered($query)
    {
        return $query->orderBy('display_order');
    }

    /**
     * Scope to filter by severity
     */
    public function scopeBySeverity($query, $severity)
    {
        return $query->where('severity', $severity);
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
