<?php

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Relations\Pivot;

class PurchaseOrderStyle extends Pivot
{
    protected $table = 'purchase_order_style';

    public $incrementing = true;

    protected $fillable = [
        'purchase_order_id',
        'style_id',
        'quantity_in_po',
        'unit_price_in_po',
        'factory_unit_price',
        'shipping_term',
        'size_breakdown',
        'ratio',
        'assigned_factory_id',
        'assigned_agency_id',
        'assignment_type',
        'assigned_at',
        'target_production_date',
        'target_shipment_date',
        'ex_factory_date',
        'factory_ex_factory_date',
        'estimated_ex_factory_date',
        'production_status',
        'shipping_approval_status',
        'shipping_approval_requested_at',
        'shipping_approval_requested_by',
        'shipping_approval_agency_by',
        'shipping_approval_agency_at',
        'shipping_approval_importer_by',
        'shipping_approval_importer_at',
        'shipping_approval_notes',
        'shipping_approval_rejection_reason',
        'suggested_ship_option_id',
        'status',
        'notes',
    ];

    protected $casts = [
        'quantity_in_po' => 'integer',
        'unit_price_in_po' => 'decimal:2',
        'factory_unit_price' => 'decimal:2',
        'size_breakdown' => 'array',
        'ratio' => 'array',
        'assigned_at' => 'datetime',
        'target_production_date' => 'date',
        'target_shipment_date' => 'date',
        'ex_factory_date' => 'date',
        'factory_ex_factory_date' => 'date',
        'estimated_ex_factory_date' => 'date',
        'shipping_approval_requested_at' => 'datetime',
        'shipping_approval_agency_at' => 'datetime',
        'shipping_approval_importer_at' => 'datetime',
    ];

    public function purchaseOrder()
    {
        return $this->belongsTo(PurchaseOrder::class);
    }

    public function style()
    {
        return $this->belongsTo(Style::class);
    }

    public function assignedFactory()
    {
        return $this->belongsTo(User::class, 'assigned_factory_id');
    }

    public function assignedAgency()
    {
        return $this->belongsTo(User::class, 'assigned_agency_id');
    }

    public function suggestedShipOption()
    {
        return $this->belongsTo(ShipOption::class, 'suggested_ship_option_id');
    }

    public function getTotalPriceAttribute()
    {
        $price = $this->unit_price_in_po ?? $this->style->unit_price;
        return $this->quantity_in_po * $price;
    }

    public function getEffectiveUnitPriceAttribute()
    {
        return $this->unit_price_in_po ?? $this->style->unit_price;
    }

    /**
     * Request shipping approval from importer.
     * Can only be requested max 21 days before the PO's ex_factory_date.
     */
    public function requestShippingApproval(int $userId): array
    {
        if (!$this->estimated_ex_factory_date) {
            return ['success' => false, 'message' => 'Estimated ex-factory date must be set first'];
        }

        $po = $this->purchaseOrder;
        $poExFactoryDate = $po->ex_factory_date ? Carbon::parse($po->ex_factory_date) : null;

        if ($poExFactoryDate) {
            $earliestRequestDate = $poExFactoryDate->copy()->subDays(21);
            if (now()->lt($earliestRequestDate)) {
                return [
                    'success' => false,
                    'message' => "Shipping approval can only be requested within 21 days of PO ex-factory date ({$poExFactoryDate->format('Y-m-d')}). Earliest request date: {$earliestRequestDate->format('Y-m-d')}",
                ];
            }
        }

        $this->shipping_approval_status = 'requested';
        $this->shipping_approval_requested_at = now();
        $this->shipping_approval_requested_by = $userId;

        // Auto-suggest ship option
        $suggestedOption = ShipOption::findEarliestConnectable($this->estimated_ex_factory_date);
        if ($suggestedOption) {
            $this->suggested_ship_option_id = $suggestedOption->id;
        }

        $this->save();

        return ['success' => true, 'suggested_ship_option' => $suggestedOption];
    }

    /**
     * Agency approves shipping
     */
    public function agencyApproveShipping(int $userId, ?string $notes = null): void
    {
        $this->shipping_approval_status = 'agency_approved';
        $this->shipping_approval_agency_by = $userId;
        $this->shipping_approval_agency_at = now();
        if ($notes) {
            $this->shipping_approval_notes = $notes;
        }
        $this->save();
    }

    /**
     * Importer approves shipping (final approval)
     */
    public function importerApproveShipping(int $userId, ?string $notes = null): void
    {
        $this->shipping_approval_status = 'approved';
        $this->shipping_approval_importer_by = $userId;
        $this->shipping_approval_importer_at = now();
        if ($notes) {
            $this->shipping_approval_notes = ($this->shipping_approval_notes ?? '') . "\n" . $notes;
        }
        $this->save();
    }

    /**
     * Reject shipping approval
     */
    public function rejectShipping(int $userId, string $reason): void
    {
        $this->shipping_approval_status = 'rejected';
        $this->shipping_approval_rejection_reason = $reason;
        $this->save();
    }
}
