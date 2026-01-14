<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Agent extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'user_id',
        'company_name',
        'contact_person',
        'email',
        'phone',
        'address',
        'country',
        'payment_terms',
        'account_balance',
        'additional_info',
        'is_active',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'account_balance' => 'decimal:2',
        'additional_info' => 'array',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function purchaseOrders()
    {
        return $this->hasMany(PurchaseOrder::class);
    }

    public function styles()
    {
        return $this->hasMany(Style::class);
    }
}
