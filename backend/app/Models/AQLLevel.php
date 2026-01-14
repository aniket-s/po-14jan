<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class AQLLevel extends Model
{
    use HasFactory;

    protected $fillable = [
        'level',
        'name',
        'description',
        'sample_size_table',
        'is_default',
        'is_active',
    ];

    protected $casts = [
        'sample_size_table' => 'array',
        'is_default' => 'boolean',
        'is_active' => 'boolean',
    ];

    /**
     * Get quality inspections using this AQL level
     */
    public function qualityInspections()
    {
        return $this->hasMany(QualityInspection::class);
    }

    /**
     * Get sample size parameters for a given lot size
     */
    public function getSampleSizeParams(int $lotSize): ?array
    {
        if (!$this->sample_size_table) {
            return null;
        }

        foreach ($this->sample_size_table as $row) {
            if ($lotSize >= ($row['lot_size_min'] ?? 0) && $lotSize <= ($row['lot_size_max'] ?? PHP_INT_MAX)) {
                return [
                    'sample_size' => $row['sample_size'],
                    'accept_point' => $row['accept_point'],
                    'reject_point' => $row['reject_point'],
                ];
            }
        }

        return null;
    }

    /**
     * Get default AQL level
     */
    public static function getDefault()
    {
        return static::where('is_default', true)
            ->where('is_active', true)
            ->first() ?? static::where('is_active', true)->first();
    }

    /**
     * Get AQL level by level value
     */
    public static function getByLevel(string $level)
    {
        return static::where('level', $level)
            ->where('is_active', true)
            ->first();
    }

    /**
     * Scope to get active levels
     */
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    /**
     * Scope to get default level
     */
    public function scopeDefault($query)
    {
        return $query->where('is_default', true);
    }
}
