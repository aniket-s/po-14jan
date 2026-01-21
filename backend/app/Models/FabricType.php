<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class FabricType extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'name',
        'code',
        'description',
        'is_active',
        'created_by',
    ];

    protected $casts = [
        'is_active' => 'boolean',
    ];

    /**
     * Get the user who created this fabric type
     */
    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    /**
     * Get styles using this fabric type
     */
    public function styles()
    {
        return $this->hasMany(Style::class);
    }

    /**
     * Scope to filter active fabric types
     */
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }
}
