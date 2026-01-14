<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SystemStatus extends Model
{
    use HasFactory;

    protected $fillable = [
        'type',
        'value',
        'label',
        'color',
        'icon',
        'display_order',
        'transition_rules',
        'description',
        'is_active',
    ];

    protected $casts = [
        'transition_rules' => 'array',
        'is_active' => 'boolean',
    ];

    /**
     * Get statuses by type
     */
    public static function byType(string $type)
    {
        return static::where('type', $type)
            ->where('is_active', true)
            ->orderBy('display_order')
            ->get();
    }

    /**
     * Get single status
     */
    public static function getStatus(string $type, string $value)
    {
        return static::where('type', $type)
            ->where('value', $value)
            ->first();
    }

    /**
     * Check if transition is valid
     */
    public function canTransitionTo(string $newStatus): bool
    {
        if (!$this->transition_rules) {
            return true; // No rules means any transition allowed
        }

        return in_array($newStatus, $this->transition_rules);
    }

    /**
     * Scope to get active statuses
     */
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    /**
     * Scope to get ordered statuses
     */
    public function scopeOrdered($query)
    {
        return $query->orderBy('display_order');
    }

    /**
     * Scope to filter by type
     */
    public function scopeOfType($query, string $type)
    {
        return $query->where('type', $type);
    }
}
