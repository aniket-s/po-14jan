<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Retailer extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'name',
        'code',
        'email',
        'phone',
        'address',
        'city',
        'state',
        'country',
        'zip_code',
        'contact_info',
        'is_active',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'contact_info' => 'array',
    ];

    /**
     * Get the purchase orders for this retailer
     */
    public function purchaseOrders()
    {
        return $this->hasMany(PurchaseOrder::class);
    }

    /**
     * Scope to filter active retailers
     */
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }
}
