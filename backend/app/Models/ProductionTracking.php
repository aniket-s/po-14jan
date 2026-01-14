<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ProductionTracking extends Model
{
    use HasFactory;

    protected $fillable = [
        'style_id',
        'production_stage_id',
        'tracking_date',
        'quantity_produced',
        'quantity_rejected',
        'quantity_reworked',
        'cumulative_quantity',
        'completion_percentage',
        'notes',
        'images',
        'submitted_by',
        'metadata',
    ];

    protected $casts = [
        'tracking_date' => 'date',
        'quantity_produced' => 'integer',
        'quantity_rejected' => 'integer',
        'quantity_reworked' => 'integer',
        'cumulative_quantity' => 'integer',
        'completion_percentage' => 'decimal:2',
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
     * Get the production stage
     */
    public function productionStage()
    {
        return $this->belongsTo(ProductionStage::class);
    }

    /**
     * Get the user who submitted the tracking
     */
    public function submittedBy()
    {
        return $this->belongsTo(User::class, 'submitted_by');
    }

    /**
     * Scope to filter by style
     */
    public function scopeByStyle($query, $styleId)
    {
        return $query->where('style_id', $styleId);
    }

    /**
     * Scope to filter by production stage
     */
    public function scopeByStage($query, $stageId)
    {
        return $query->where('production_stage_id', $stageId);
    }

    /**
     * Scope to filter by date range
     */
    public function scopeDateRange($query, $startDate, $endDate)
    {
        return $query->whereBetween('tracking_date', [$startDate, $endDate]);
    }

    /**
     * Calculate net quantity (produced - rejected)
     */
    public function getNetQuantityAttribute(): int
    {
        return $this->quantity_produced - $this->quantity_rejected;
    }

    /**
     * Calculate acceptance rate
     */
    public function getAcceptanceRateAttribute(): float
    {
        if ($this->quantity_produced == 0) {
            return 0.0;
        }

        return round(($this->getNetQuantityAttribute() / $this->quantity_produced) * 100, 2);
    }

    /**
     * Update cumulative quantity for the stage
     */
    public function updateCumulativeQuantity(): void
    {
        $cumulative = self::where('style_id', $this->style_id)
            ->where('production_stage_id', $this->production_stage_id)
            ->where('tracking_date', '<=', $this->tracking_date)
            ->sum('quantity_produced');

        $this->cumulative_quantity = $cumulative;
        $this->save();
    }

    /**
     * Calculate completion percentage for the stage
     */
    public function calculateCompletionPercentage(): void
    {
        $style = $this->style;
        $totalQuantity = $style->quantity;

        if ($totalQuantity > 0) {
            $this->completion_percentage = round(($this->cumulative_quantity / $totalQuantity) * 100, 2);
            $this->save();
        }
    }
}
