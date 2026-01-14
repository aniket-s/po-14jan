<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Size extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'gender_id',
        'size_code',
        'size_name',
        'description',
        'is_active',
        'display_order',
    ];

    protected $casts = [
        'gender_id' => 'integer',
        'is_active' => 'boolean',
        'display_order' => 'integer',
    ];

    /**
     * Get the gender that owns the size
     */
    public function gender()
    {
        return $this->belongsTo(Gender::class);
    }

    /**
     * Scope to filter by gender
     */
    public function scopeByGender($query, $genderId)
    {
        return $query->where('gender_id', $genderId);
    }

    /**
     * Scope to filter active sizes
     */
    public function scopeActive($query)
    {
        return $query->where('is_active', true)->orderBy('display_order');
    }
}
