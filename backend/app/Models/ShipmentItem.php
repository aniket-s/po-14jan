<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ShipmentItem extends Model
{
    use HasFactory;

    protected $fillable = [
        'shipment_id',
        'style_id',
        'quantity_shipped',
        'carton_numbers',
        'carton_count',
        'weight_per_carton',
        'volume_per_carton',
        'total_weight',
        'total_volume',
        'notes',
    ];

    protected $casts = [
        'quantity_shipped' => 'integer',
        'carton_count' => 'integer',
        'weight_per_carton' => 'decimal:2',
        'volume_per_carton' => 'decimal:2',
        'total_weight' => 'decimal:2',
        'total_volume' => 'decimal:2',
        'carton_numbers' => 'array',
    ];

    /**
     * Get the shipment
     */
    public function shipment()
    {
        return $this->belongsTo(Shipment::class);
    }

    /**
     * Get the style
     */
    public function style()
    {
        return $this->belongsTo(Style::class);
    }

    /**
     * Calculate totals based on carton details
     */
    public function calculateTotals(): void
    {
        if ($this->carton_count && $this->weight_per_carton) {
            $this->total_weight = $this->carton_count * $this->weight_per_carton;
        }

        if ($this->carton_count && $this->volume_per_carton) {
            $this->total_volume = $this->carton_count * $this->volume_per_carton;
        }

        $this->save();
    }
}
