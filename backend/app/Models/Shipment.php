<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class Shipment extends Model
{
    use HasFactory;

    protected $fillable = [
        'purchase_order_id',
        'shipment_reference',
        'tracking_number',
        'tracking_token', // For public tracking page
        'carrier_name',
        'carrier_tracking_url',
        'shipment_method', // air, sea, courier, road
        'shipment_type', // full, partial
        'container_number',
        'seal_number',
        'vessel_name',
        'voyage_number',
        'port_of_loading',
        'port_of_discharge',
        'final_destination',
        'total_cartons',
        'total_weight',
        'total_volume',
        'status', // preparing, dispatched, in_transit, customs, out_for_delivery, delivered, cancelled
        'estimated_dispatch_date',
        'actual_dispatch_date',
        'estimated_arrival_date',
        'actual_arrival_date',
        'estimated_delivery_date',
        'actual_delivery_date',
        'documents',
        'notes',
        'metadata',
        'created_by',
        'last_updated_by',
    ];

    protected $casts = [
        'estimated_dispatch_date' => 'date',
        'actual_dispatch_date' => 'date',
        'estimated_arrival_date' => 'date',
        'actual_arrival_date' => 'date',
        'estimated_delivery_date' => 'date',
        'actual_delivery_date' => 'date',
        'total_cartons' => 'integer',
        'total_weight' => 'decimal:2',
        'total_volume' => 'decimal:2',
        'documents' => 'array',
        'metadata' => 'array',
    ];

    /**
     * Boot method to generate tracking token
     */
    protected static function boot()
    {
        parent::boot();

        static::creating(function ($shipment) {
            if (!$shipment->tracking_token) {
                $shipment->tracking_token = Str::random(32);
            }
        });
    }

    /**
     * Get the purchase order
     */
    public function purchaseOrder()
    {
        return $this->belongsTo(PurchaseOrder::class);
    }

    /**
     * Get shipment items (styles)
     */
    public function items()
    {
        return $this->hasMany(ShipmentItem::class);
    }

    /**
     * Get shipment updates
     */
    public function updates()
    {
        return $this->hasMany(ShipmentUpdate::class);
    }

    /**
     * Get the user who created the shipment
     */
    public function createdBy()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * Get the user who last updated the shipment
     */
    public function lastUpdatedBy()
    {
        return $this->belongsTo(User::class, 'last_updated_by');
    }

    /**
     * Scope to filter by PO
     */
    public function scopeByPurchaseOrder($query, $poId)
    {
        return $query->where('purchase_order_id', $poId);
    }

    /**
     * Scope to filter by status
     */
    public function scopeByStatus($query, $status)
    {
        return $query->where('status', $status);
    }

    /**
     * Scope to filter by shipment method
     */
    public function scopeByMethod($query, $method)
    {
        return $query->where('shipment_method', $method);
    }

    /**
     * Check if shipment is delivered
     */
    public function isDelivered(): bool
    {
        return $this->status === 'delivered';
    }

    /**
     * Check if shipment is in transit
     */
    public function isInTransit(): bool
    {
        return $this->status === 'in_transit';
    }

    /**
     * Check if shipment is cancelled
     */
    public function isCancelled(): bool
    {
        return $this->status === 'cancelled';
    }

    /**
     * Get days until estimated delivery
     */
    public function getDaysUntilDelivery(): ?int
    {
        if (!$this->estimated_delivery_date) {
            return null;
        }

        return now()->diffInDays($this->estimated_delivery_date, false);
    }

    /**
     * Check if shipment is delayed
     */
    public function isDelayed(): bool
    {
        if ($this->isDelivered() || !$this->estimated_delivery_date) {
            return false;
        }

        return now()->isAfter($this->estimated_delivery_date);
    }

    /**
     * Get latest shipment update
     */
    public function getLatestUpdate()
    {
        return $this->updates()->latest('update_date')->first();
    }

    /**
     * Update shipment status
     */
    public function updateStatus(string $newStatus, int $userId, ?string $notes = null, ?array $metadata = null): void
    {
        $oldStatus = $this->status;
        $this->status = $newStatus;
        $this->last_updated_by = $userId;

        // Update actual dates based on status
        switch ($newStatus) {
            case 'dispatched':
                if (!$this->actual_dispatch_date) {
                    $this->actual_dispatch_date = now();
                }
                break;
            case 'delivered':
                if (!$this->actual_delivery_date) {
                    $this->actual_delivery_date = now();
                }
                break;
        }

        $this->save();

        // Create shipment update record
        ShipmentUpdate::create([
            'shipment_id' => $this->id,
            'update_date' => now(),
            'status' => $newStatus,
            'location' => $metadata['location'] ?? null,
            'description' => $notes ?? "Status changed from {$oldStatus} to {$newStatus}",
            'updated_by' => $userId,
            'metadata' => $metadata ?? [],
        ]);
    }

    /**
     * Calculate total quantity shipped
     */
    public function getTotalQuantityAttribute(): int
    {
        return $this->items()->sum('quantity_shipped');
    }

    /**
     * Get public tracking URL
     */
    public function getPublicTrackingUrl(): string
    {
        return url("/track/{$this->tracking_token}");
    }

    /**
     * Get shipment progress percentage
     */
    public function getProgressPercentage(): int
    {
        $statusProgress = [
            'preparing' => 10,
            'dispatched' => 25,
            'in_transit' => 50,
            'customs' => 70,
            'out_for_delivery' => 85,
            'delivered' => 100,
            'cancelled' => 0,
        ];

        return $statusProgress[$this->status] ?? 0;
    }
}
