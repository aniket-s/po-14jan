<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Trim extends Model
{
    use SoftDeletes;

    const TRIM_TYPES = [
        'main_label' => 'Main Label',
        'size_label' => 'Size Label',
        'tag_1' => 'Tag 1',
        'tag_2' => 'Tag 2',
        'wash_care_label' => 'Wash Care Label',
        'special_label' => 'Special Label',
        'special_tag' => 'Special Tag',
        'price_ticket' => 'Price Ticket',
    ];

    protected $fillable = [
        'brand_id',
        'trim_type',
        'trim_code',
        'image_path',
        'file_path',
        'description',
        'is_active',
    ];

    protected $casts = [
        'is_active' => 'boolean',
    ];

    /**
     * Get the brand that owns the trim
     */
    public function brand()
    {
        return $this->belongsTo(Brand::class);
    }

    /**
     * Get the styles using this trim
     */
    public function styles()
    {
        return $this->belongsToMany(Style::class, 'style_trims')
            ->withPivot('quantity', 'notes')
            ->withTimestamps();
    }

    /**
     * Scope to filter by brand
     */
    public function scopeByBrand($query, $brandId)
    {
        return $query->where('brand_id', $brandId);
    }

    /**
     * Scope to filter by trim type
     */
    public function scopeByType($query, $trimType)
    {
        return $query->where('trim_type', $trimType);
    }

    /**
     * Scope to filter active trims
     */
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    /**
     * Get the human-readable trim type name
     */
    public function getTrimTypeNameAttribute(): string
    {
        return self::TRIM_TYPES[$this->trim_type] ?? $this->trim_type;
    }
}
