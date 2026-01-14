<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Warehouse extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'name',
        'code',
        'location',
        'address',
        'city',
        'state',
        'zip_code',
        'country',
        'manager_id',
        'contact_info',
        'is_active',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'contact_info' => 'array',
    ];

    public function manager()
    {
        return $this->belongsTo(User::class, 'manager_id');
    }
}
