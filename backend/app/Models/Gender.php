<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Gender extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'name',
        'code',
        'description',
        'is_active',
        'display_order',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'display_order' => 'integer',
    ];

    /**
     * Get the sizes for this gender
     */
    public function sizes()
    {
        return $this->hasMany(Size::class)->orderBy('display_order');
    }

    /**
     * Get active sizes for this gender
     */
    public function activeSizes()
    {
        return $this->hasMany(Size::class)->where('is_active', true)->orderBy('display_order');
    }

    /**
     * Get the styles for this gender
     */
    public function styles()
    {
        return $this->hasMany(Style::class);
    }

    /**
     * Scope to filter active genders
     */
    public function scopeActive($query)
    {
        return $query->where('is_active', true)->orderBy('display_order');
    }
}
