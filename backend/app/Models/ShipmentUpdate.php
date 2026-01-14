<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class ShipmentUpdate extends Model
{
    use HasFactory;

    protected $fillable = [
        'shipment_id',
        'update_date',
        'status',
        'location',
        'description',
        'is_milestone',
        'updated_by',
        'metadata',
    ];

    protected $casts = [
        'update_date' => 'datetime',
        'is_milestone' => 'boolean',
        'metadata' => 'array',
    ];

    /**
     * Get the shipment
     */
    public function shipment()
    {
        return $this->belongsTo(Shipment::class);
    }

    /**
     * Get the user who created the update
     */
    public function updatedBy()
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

    /**
     * Scope to get milestone updates
     */
    public function scopeMilestones($query)
    {
        return $query->where('is_milestone', true);
    }

    /**
     * Scope to order by date
     */
    public function scopeOrdered($query, $direction = 'desc')
    {
        return $query->orderBy('update_date', $direction);
    }
}
