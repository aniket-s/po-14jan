<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Style extends Model
{
    use HasFactory;

    protected $fillable = [
        'po_id', // Kept for backward compatibility (nullable)
        'purchase_order_id', // Alias for po_id
        'style_number', // Now unique globally
        'description',
        'fabric',
        'color',
        'size_breakdown',
        'size_breakup',
        'quantity',
        'total_quantity',  // Base/reference quantity
        'unit_price', // Base price (nullable, set at PO level now)
        'total_price',
        'fob_price', // Nullable
        'technical_file_paths', // Changed from technical_file_path to support multiple files
        'images',
        'packing_details',
        'metadata',
        'fit',
        // destination_port - REMOVED (not for styles)
        // Master data foreign keys
        'brand_id',
        'retailer_id', // CHANGED: Replaced buyer_id with retailer_id
        'category_id', // Product category
        'season_id', // Season/collection - "Styles Created for Season"
        'gender_id', // Gender for size management
        'color_id', // Foreign key to colors table
        'fabric_type_id', // NEW: Foreign key to fabric_types table
        'fabric_quality_id', // NEW: Foreign key to fabric_qualities table
        // division_id - REMOVED
        // customer_id - REMOVED
        // buyer_id - REMOVED (replaced by retailer_id)
        // agent_id - REMOVED (not for styles)
        // vendor_id - REMOVED (not for styles)
        // Enhanced fields
        'color_code', // Pantone number
        'color_name',
        'fabric_name',
        'fabric_type',
        'fabric_type_name', // New field - combined fabric type and name
        'fabric_weight',
        'country_of_origin',
        'item_description',
        'created_by',
        'updated_by', // NEW: User who last updated
        'tp_date',
        // Pricing fields
        'msrp', // NEW: Manufacturer Suggested Retail Price
        'wholesale_price', // NEW: Wholesale price for bulk customers
        // Status
        'is_active', // NEW: Active/Inactive flag
        // loading_port - REMOVED (not for styles)
        // packing_method - REMOVED (not for styles)
        // shipping_term - REMOVED (not for styles)
        // payment_term - REMOVED (not for styles)
        // current_milestone - REMOVED (not for styles)
        // REMOVED buyer/trim detail fields:
        // - price_ticket_spec
        // - labels_hangtags
        // - price_ticket_info
        // NOTE: PO-specific fields moved to pivot table:
        // - assigned_factory_id
        // - assigned_agency_id
        // - assignment_type
        // - assigned_at
        // - target_production_date
        // - target_shipment_date
        // - ex_factory_date
        // - status
        // - shipping_term (per PO) - changed from price_term
        // - size_breakdown (per PO)
    ];

    protected $casts = [
        'size_breakdown' => 'array',
        'size_breakup' => 'array',
        'quantity' => 'integer',
        'total_quantity' => 'integer',
        'unit_price' => 'decimal:2',
        'total_price' => 'decimal:2',
        'fob_price' => 'decimal:2',
        'msrp' => 'decimal:2',
        'wholesale_price' => 'decimal:2',
        'tp_date' => 'date',
        'images' => 'array',
        'technical_file_paths' => 'array', // NEW: Support multiple technical files
        'packing_details' => 'array',
        'metadata' => 'array',
        'is_active' => 'boolean',
        // NOTE: PO-specific field casts moved to pivot model:
        // - assigned_at
        // - target_production_date
        // - target_shipment_date
        // - ex_factory_date
    ];

    protected $appends = ['quantity'];

    /**
     * Fields hidden from JSON responses (removed from styles, moved to PO-pivot table)
     */
    protected $hidden = [
        'season_id',
        'agent_id',
        'vendor_id',
        'loading_port',
        'destination_port',
        'shipping_term',
        'payment_term',
        'packing_method',
        'current_milestone',
    ];


    /**
     * Accessor for quantity (aliases total_quantity for backwards compatibility)
     */
    public function getQuantityAttribute()
    {
        return $this->total_quantity;
    }

    /**
     * Accessor for images - ensures all URLs are absolute with API domain
     */
    public function getImagesAttribute($value)
    {
        $images = json_decode($value, true);

        if (!is_array($images)) {
            return [];
        }

        return array_map(function($imageUrl) {
            // If it's already an absolute URL, return as-is
            if (str_starts_with($imageUrl, 'http://') || str_starts_with($imageUrl, 'https://')) {
                return $imageUrl;
            }

            // If it starts with /storage/, convert to absolute URL
            if (str_starts_with($imageUrl, '/storage/')) {
                return request()->getSchemeAndHttpHost() . $imageUrl;
            }

            // If it's just a path like 'styles/images/...', convert to absolute URL
            return request()->getSchemeAndHttpHost() . '/storage/' . $imageUrl;
        }, $images);
    }

    /**
     * Accessor for technical_file_paths - ensures all URLs are absolute with API domain
     */
    public function getTechnicalFilePathsAttribute($value)
    {
        $paths = json_decode($value, true);

        if (!is_array($paths)) {
            return [];
        }

        return array_map(function($fileUrl) {
            // If it's already an absolute URL, return as-is
            if (str_starts_with($fileUrl, 'http://') || str_starts_with($fileUrl, 'https://')) {
                return $fileUrl;
            }

            // If it starts with /storage/, convert to absolute URL
            if (str_starts_with($fileUrl, '/storage/')) {
                return request()->getSchemeAndHttpHost() . $fileUrl;
            }

            // If it's just a path like 'styles/technical/...', convert to absolute URL
            return request()->getSchemeAndHttpHost() . '/storage/' . $fileUrl;
        }, $paths);
    }

    /**
     * Get all purchase orders that use this style (Many-to-Many)
     */
    public function purchaseOrders()
    {
        return $this->belongsToMany(PurchaseOrder::class, 'purchase_order_style')
            ->using(PurchaseOrderStyle::class)
            ->withPivot([
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
            ])
            ->withTimestamps();
    }

    /**
     * Get the purchase order that owns the style (DEPRECATED - kept for backward compatibility)
     * Use purchaseOrders() for the new many-to-many relationship
     */
    public function purchaseOrder()
    {
        return $this->belongsTo(PurchaseOrder::class, 'po_id');
    }

    /**
     * Get the creator (user) who created the style
     */
    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * Get the brand for the style
     */
    public function brand()
    {
        return $this->belongsTo(Brand::class);
    }

    /**
     * Get the retailer for the style (replaced buyer)
     */
    public function retailer()
    {
        return $this->belongsTo(Retailer::class);
    }

    /**
     * Get the fabric type for the style
     */
    public function fabricType()
    {
        return $this->belongsTo(FabricType::class);
    }

    /**
     * Get the fabric quality for the style
     */
    public function fabricQuality()
    {
        return $this->belongsTo(FabricQuality::class);
    }

    /**
     * Get the category for the style
     */
    public function category()
    {
        return $this->belongsTo(Category::class);
    }

    /**
     * Get the season for the style
     */
    public function season()
    {
        return $this->belongsTo(Season::class);
    }

    /**
     * Get the gender for the style
     */
    public function gender()
    {
        return $this->belongsTo(Gender::class);
    }

    /**
     * Get the color for the style
     */
    public function color()
    {
        return $this->belongsTo(Color::class);
    }

    /**
     * Get the user who last updated the style
     */
    public function updatedBy()
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

    /**
     * Get the trims for the style
     */
    public function trims()
    {
        return $this->belongsToMany(Trim::class, 'style_trims')
            ->withPivot('quantity', 'notes')
            ->withTimestamps();
    }

    /**
     * Get the agent for the style
     */
    public function agent()
    {
        return $this->belongsTo(Agent::class);
    }

    /**
     * Get the vendor for the style
     */
    public function vendor()
    {
        return $this->belongsTo(Vendor::class);
    }

    /**
     * Get the assigned factory (DEPRECATED - for backward compatibility only)
     * For new code, use purchaseOrders()->wherePivot('assigned_factory_id', ...)
     * This relationship exists for legacy po_id-based styles
     */
    public function assignedFactory()
    {
        return $this->belongsTo(User::class, 'assigned_factory_id');
    }

    /**
     * Get the assigned agency (DEPRECATED - for backward compatibility only)
     * For new code, use purchaseOrders()->wherePivot('assigned_agency_id', ...)
     * This relationship exists for legacy po_id-based styles
     */
    public function assignedAgency()
    {
        return $this->belongsTo(User::class, 'assigned_agency_id');
    }

    /**
     * Get the prepacks for the style
     */
    public function prepacks()
    {
        return $this->hasMany(StylePrepack::class);
    }

    /**
     * Get the samples for the style
     */
    public function samples()
    {
        return $this->hasMany(Sample::class);
    }

    /**
     * Get the sample processes for the style
     */
    public function sampleProcesses()
    {
        return $this->hasMany(StyleSampleProcess::class)->ordered();
    }

    /**
     * Get the production tracking for the style
     */
    public function productionTracking()
    {
        return $this->hasMany(ProductionTracking::class);
    }

    /**
     * Get the quality inspections for the style
     */
    public function qualityInspections()
    {
        return $this->hasMany(QualityInspection::class);
    }

    /**
     * Get the factory assignments for the style
     */
    public function factoryAssignments()
    {
        return $this->hasMany(FactoryAssignment::class);
    }

    /**
     * Scope to filter by purchase order
     */
    public function scopeByPurchaseOrder($query, $purchaseOrderId)
    {
        return $query->where('po_id', $purchaseOrderId);
    }

    /**
     * Check if style is used in any purchase orders
     */
    public function isUsedInPurchaseOrders(): bool
    {
        return $this->purchaseOrders()->exists();
    }

    /**
     * Get the count of purchase orders using this style
     */
    public function getPurchaseOrdersCountAttribute(): int
    {
        return $this->purchaseOrders()->count();
    }

    /**
     * NOTE: The following methods are DEPRECATED as factory assignment
     * is now PO-specific (stored in pivot table):
     * - scopeByFactory()
     * - scopeByStatus()
     * - scopeByAssignmentType()
     * - isAssigned()
     * - isDirectAssignment()
     * - isAgencyAssignment()
     *
     * Access these via the pivot relationship instead:
     * $po->styles()->wherePivot('assigned_factory_id', $factoryId)
     * $style->purchaseOrders()->wherePivot('status', 'approved')
     */

    /**
     * Calculate total price from quantity and unit price
     */
    public function calculateTotalPrice(): float
    {
        return $this->quantity * $this->unit_price;
    }

    /**
     * Update total price
     */
    public function updateTotalPrice(): void
    {
        $this->total_price = $this->calculateTotalPrice();
        $this->save();
    }

    /**
     * Get total size breakdown quantity
     */
    public function getSizeBreakdownTotal(): int
    {
        if (empty($this->size_breakdown)) {
            return 0;
        }

        return array_sum($this->size_breakdown);
    }

    /**
     * Get total quantity from packing details
     */
    public function getPackingDetailsTotal(): int
    {
        if (empty($this->packing_details) || !isset($this->packing_details['packs'])) {
            return 0;
        }

        $total = 0;
        foreach ($this->packing_details['packs'] as $pack) {
            $total += $pack['quantity'] ?? 0;
        }

        return $total;
    }

    /**
     * Get overall size breakdown from packing details
     */
    public function getOverallSizeBreakdown(): array
    {
        if (empty($this->packing_details) || !isset($this->packing_details['packs'])) {
            return [];
        }

        $overall = [];
        foreach ($this->packing_details['packs'] as $pack) {
            if (isset($pack['size_breakdown']) && is_array($pack['size_breakdown'])) {
                foreach ($pack['size_breakdown'] as $size => $qty) {
                    if (!isset($overall[$size])) {
                        $overall[$size] = 0;
                    }
                    $overall[$size] += $qty;
                }
            }
        }

        return $overall;
    }

    /**
     * Calculate total cost from packing details
     */
    public function getPackingDetailsTotalCost(): float
    {
        if (empty($this->packing_details) || !isset($this->packing_details['packs'])) {
            return 0.0;
        }

        $total = 0.0;
        foreach ($this->packing_details['packs'] as $pack) {
            $total += $pack['total_cost'] ?? 0.0;
        }

        return $total;
    }
}
