<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Color extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'name',
        'code',
        'pantone_code',
        'fabric_types',
        'is_active',
        'display_order',
        'description',
        'created_by',
    ];

    protected $casts = [
        'fabric_types' => 'array',
        'is_active' => 'boolean',
        'display_order' => 'integer',
    ];

    // Relationships
    public function styles()
    {
        return $this->hasMany(Style::class);
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    // Scopes
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    public function scopeByFabricType($query, $fabricType)
    {
        if (!$fabricType) {
            return $query;
        }

        return $query->whereJsonContains('fabric_types', $fabricType);
    }

    public function scopeOrdered($query)
    {
        return $query->orderBy('display_order')->orderBy('name');
    }
}
