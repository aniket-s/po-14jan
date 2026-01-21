<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class PaymentTerm extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'name',
        'code',
        'days',
        'requires_percentage',
        'description',
        'is_active',
    ];

    protected $casts = [
        'days' => 'integer',
        'requires_percentage' => 'boolean',
        'is_active' => 'boolean',
    ];

    /**
     * Get the purchase orders using this payment term
     */
    public function purchaseOrders()
    {
        return $this->hasMany(PurchaseOrder::class);
    }

    /**
     * Scope to filter active payment terms
     */
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    /**
     * Get formatted display name with days if applicable
     */
    public function getDisplayNameAttribute(): string
    {
        if ($this->days) {
            return "{$this->name} ({$this->days} days)";
        }
        return $this->name;
    }
}
