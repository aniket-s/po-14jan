<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PurchaseOrder extends Model
{
    use HasFactory;

    protected $fillable = [
        'po_number',
        'headline',
        'importer_id',
        'agency_id',
        'creator_id',
        'currency_id',
        'buyer_id',
        'total_quantity',
        'total_value',
        'payment_terms',
        'payment_terms_structured',
        'payment_term_id',
        'status',
        'metadata',
        'revision_date',
        'etd_date',
        'ex_factory_date',
        'eta_date',
        'in_warehouse_date',
        'shipping_term',
        'ship_to',
        'ship_to_address',
        'sample_schedule',
        'packing_guidelines',
        'season_id',
        'retailer_id',
        'country_id',
        'warehouse_id',
        'payment_term',
        'country_of_origin',
        'packing_method',
        'other_terms',
        'revision_number',
        'revised_by',
        'po_date',
        'exchange_rate',
        'terms_of_delivery',
        'additional_notes',
        'total_styles',
    ];

    protected $casts = [
        'importer_id' => 'integer',
        'creator_id' => 'integer',
        'agency_id' => 'integer',
        'buyer_id' => 'integer',
        'total_quantity' => 'integer',
        'total_value' => 'decimal:2',
        'metadata' => 'array',
        'revision_date' => 'date',
        'etd_date' => 'date',
        'ex_factory_date' => 'date',
        'eta_date' => 'date',
        'in_warehouse_date' => 'date',
        'sample_schedule' => 'array',
        'payment_terms_structured' => 'array',
        'po_date' => 'date',
        'exchange_rate' => 'decimal:4',
        'revision_number' => 'integer',
        'total_styles' => 'integer',
    ];

    /**
     * Get the importer (user) that owns the PO
     */
    public function importer()
    {
        return $this->belongsTo(User::class, 'importer_id');
    }

    /**
     * Get the agency (user) assigned to the PO
     */
    public function agency()
    {
        return $this->belongsTo(User::class, 'agency_id');
    }

    /**
     * Get the creator (user) who created the PO
     */
    public function creator()
    {
        return $this->belongsTo(User::class, 'creator_id');
    }

    /**
     * Get the revisor (user) who last revised the PO
     */
    public function revisor()
    {
        return $this->belongsTo(User::class, 'revised_by');
    }

    /**
     * Get the currency for the PO
     */
    public function currency()
    {
        return $this->belongsTo(Currency::class);
    }

    /**
     * Get the payment term for the PO
     */
    public function paymentTerm()
    {
        return $this->belongsTo(PaymentTerm::class);
    }

    /**
     * Get the season for the PO
     */
    public function season()
    {
        return $this->belongsTo(Season::class);
    }

    /**
     * Get the buyer for the PO
     */
    public function buyer()
    {
        return $this->belongsTo(Buyer::class);
    }

    /**
     * Get the retailer for the PO
     */
    public function retailer()
    {
        return $this->belongsTo(Retailer::class);
    }

    /**
     * Get the country of origin for the PO
     */
    public function country()
    {
        return $this->belongsTo(Country::class);
    }

    /**
     * Get the warehouse for the PO
     */
    public function warehouse()
    {
        return $this->belongsTo(Warehouse::class);
    }

    /**
     * Get the revisions for the PO
     */
    public function revisions()
    {
        return $this->hasMany(PORevision::class, 'po_id');
    }

    /**
     * Get the styles for the purchase order (Many-to-Many)
     */
    public function styles()
    {
        return $this->belongsToMany(Style::class, 'purchase_order_style')
            ->using(PurchaseOrderStyle::class)
            ->withPivot([
                'quantity_in_po',
                'unit_price_in_po',
                'assigned_factory_id',
                'assigned_agency_id',
                'assigned_importer_id',
                'assignment_type',
                'assigned_at',
                'target_production_date',
                'target_shipment_date',
                'ex_factory_date',
                'status',
                'notes',
            ])
            ->withTimestamps();
    }

    /**
     * Get the factory assignments for the purchase order
     */
    public function factoryAssignments()
    {
        return $this->hasMany(FactoryAssignment::class);
    }

    /**
     * Get the invitations for the purchase order
     */
    public function invitations()
    {
        return $this->hasMany(Invitation::class);
    }

    /**
     * Scope to filter by importer
     */
    public function scopeByImporter($query, $importerId)
    {
        return $query->where('importer_id', $importerId);
    }

    /**
     * Scope to filter by agency
     */
    public function scopeByAgency($query, $agencyId)
    {
        return $query->where('agency_id', $agencyId);
    }

    /**
     * Scope to filter by status
     */
    public function scopeByStatus($query, $status)
    {
        return $query->where('status', $status);
    }

    /**
     * Check if PO has agency assigned
     */
    public function hasAgency(): bool
    {
        return !is_null($this->agency_id);
    }

    /**
     * Check if PO has any factory assignments
     */
    public function hasFactoryAssignments(): bool
    {
        return $this->factoryAssignments()->exists();
    }

    /**
     * Get all assigned factories
     */
    public function getAssignedFactories()
    {
        return $this->factoryAssignments()
            ->with('factory')
            ->where('status', 'accepted')
            ->get()
            ->pluck('factory');
    }

    /**
     * Calculate total quantity from styles (using pivot data)
     */
    public function calculateTotalQuantity(): int
    {
        return $this->styles()->sum('purchase_order_style.quantity_in_po');
    }

    /**
     * Calculate total value from styles (using pivot data)
     */
    public function calculateTotalValue(): float
    {
        $totalValue = 0;

        foreach ($this->styles as $style) {
            $quantity = $style->pivot->quantity_in_po;
            $price = $style->pivot->unit_price_in_po ?? $style->unit_price;
            $totalValue += $quantity * $price;
        }

        return $totalValue;
    }

    /**
     * Update totals from styles
     */
    public function updateTotals(): void
    {
        // Reload styles with pivot data
        $this->load('styles');

        $this->total_quantity = $this->calculateTotalQuantity();
        $this->total_value = $this->calculateTotalValue();
        $this->total_styles = $this->styles()->count();
        $this->save();
    }
}
