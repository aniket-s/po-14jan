<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\Pivot;

class PurchaseOrderStyle extends Pivot
{
    /**
     * The table associated with the pivot model.
     *
     * @var string
     */
    protected $table = 'purchase_order_style';

    /**
     * Indicates if the IDs are auto-incrementing.
     *
     * @var bool
     */
    public $incrementing = true;

    /**
     * The attributes that are mass assignable.
     *
     * @var array<int, string>
     */
    protected $fillable = [
        'purchase_order_id',
        'style_id',
        'quantity_in_po',
        'unit_price_in_po',
        'shipping_term', // FOB or DDP - changed from price_term
        'size_breakdown', // Size quantities for this style in this PO
        'ratio', // NEW: Size ratio for this style in PO
        'assigned_factory_id',
        'assigned_agency_id',
        'assignment_type',
        'assigned_at',
        'target_production_date',
        'target_shipment_date',
        'ex_factory_date',
        'status',
        'notes',
    ];

    /**
     * The attributes that should be cast.
     *
     * @var array<string, string>
     */
    protected $casts = [
        'quantity_in_po' => 'integer',
        'unit_price_in_po' => 'decimal:2',
        'size_breakdown' => 'array', // JSON cast for size breakdown
        'ratio' => 'array', // NEW: JSON cast for ratio
        'assigned_at' => 'datetime',
        'target_production_date' => 'date',
        'target_shipment_date' => 'date',
        'ex_factory_date' => 'date',
    ];

    /**
     * Get the purchase order that owns this pivot.
     */
    public function purchaseOrder()
    {
        return $this->belongsTo(PurchaseOrder::class);
    }

    /**
     * Get the style that owns this pivot.
     */
    public function style()
    {
        return $this->belongsTo(Style::class);
    }

    /**
     * Get the assigned factory user.
     */
    public function assignedFactory()
    {
        return $this->belongsTo(User::class, 'assigned_factory_id');
    }

    /**
     * Get the assigned agency user.
     */
    public function assignedAgency()
    {
        return $this->belongsTo(User::class, 'assigned_agency_id');
    }

    /**
     * Calculate the total price for this style in this PO.
     *
     * @return float
     */
    public function getTotalPriceAttribute()
    {
        $price = $this->unit_price_in_po ?? $this->style->unit_price;
        return $this->quantity_in_po * $price;
    }

    /**
     * Get the effective unit price (override or base price).
     *
     * @return float
     */
    public function getEffectiveUnitPriceAttribute()
    {
        return $this->unit_price_in_po ?? $this->style->unit_price;
    }
}
