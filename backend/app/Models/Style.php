<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Style extends Model
{
    use HasFactory;

    protected $fillable = [
        'style_number',
        'description',
        'fabric',
        'color',
        'size_breakup',
        'total_quantity',
        'unit_price',
        'fob_price',
        'technical_file_paths',
        'images',
        'packing_details',
        'metadata',
        'fit',
        // Master data foreign keys
        'brand_id',
        'retailer_id',
        'category_id',
        'season_id',
        'gender_id',
        'color_id',
        'fabric_type_id',
        'fabric_quality_id',
        // Enhanced fields
        'color_code',
        'color_name',
        'fabric_name',
        'fabric_type',
        'fabric_type_name',
        'fabric_weight',
        'country_of_origin',
        'item_description',
        'created_by',
        'updated_by',
        'tp_date',
        // Pricing fields
        'msrp',
        'wholesale_price',
        // Status
        'is_active',
        'status',
        // Relationships & assignment
        'po_id',
        'ex_factory_date',
        'destination_port',
        'assignment_type',
        'assigned_factory_id',
        'assigned_agency_id',
    ];

    protected $casts = [
        'size_breakup' => 'array',
        'total_quantity' => 'integer',
        'unit_price' => 'decimal:2',
        'fob_price' => 'decimal:2',
        'msrp' => 'decimal:2',
        'wholesale_price' => 'decimal:2',
        'tp_date' => 'date',
        'images' => 'array',
        'technical_file_paths' => 'array',
        'packing_details' => 'array',
        'metadata' => 'array',
        'is_active' => 'boolean',
        'ex_factory_date' => 'date',
    ];

    protected $appends = ['quantity'];

    protected $hidden = [
        'season_id',
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
     * Get the primary purchase order this style belongs to (via po_id foreign key)
     */
    public function purchaseOrder()
    {
        return $this->belongsTo(PurchaseOrder::class, 'po_id');
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
                'status',
                'notes',
            ])
            ->withTimestamps();
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
     * Get the retailer for the style
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
     * Get the assigned factory for the style
     */
    public function assignedFactory()
    {
        return $this->belongsTo(User::class, 'assigned_factory_id');
    }

    /**
     * Get the factory assignments for the style
     */
    public function factoryAssignments()
    {
        return $this->hasMany(FactoryAssignment::class);
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
