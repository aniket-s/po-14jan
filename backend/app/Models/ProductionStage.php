<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ProductionStage extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'code',
        'description',
        'display_order',
        'weight_percentage',
        'is_active',
    ];

    protected $casts = [
        'weight_percentage' => 'decimal:2',
        'is_active' => 'boolean',
    ];

    /**
     * Get production tracking records for this stage
     */
    public function productionTracking()
    {
        return $this->hasMany(ProductionTracking::class);
    }

    /**
     * Scope to get active stages
     */
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    /**
     * Scope to get ordered stages
     */
    public function scopeOrdered($query)
    {
        return $query->orderBy('display_order');
    }
}
