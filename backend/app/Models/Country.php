<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Country extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'name',
        'code',
        'sailing_time_days',
        'is_active',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'sailing_time_days' => 'integer',
    ];

    /**
     * Get the purchase orders from this country
     */
    public function purchaseOrders()
    {
        return $this->hasMany(PurchaseOrder::class);
    }

    /**
     * Scope to filter active countries
     */
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    /**
     * Get the shipping time in a human-readable format
     */
    public function getShippingTimeTextAttribute(): string
    {
        return $this->sailing_time_days . ' ' . ($this->sailing_time_days === 1 ? 'day' : 'days');
    }
}
