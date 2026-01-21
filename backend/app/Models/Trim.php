<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Trim extends Model
{
    use SoftDeletes;

    // DEPRECATED: Use trim_types table instead for dynamic types
    // Kept for backward compatibility
    const TRIM_TYPES = [
        'main_label' => 'Main Label',
        'size_label' => 'Size Label',
        'tag_1' => 'Tag 1',
        'tag_2' => 'Tag 2',
        'wash_care_label' => 'Wash Care Label',
        'special_label' => 'Special Label',
        'special_tag' => 'Special Tag',
        'price_ticket' => 'Price Ticket',
        'hangtag' => 'Hangtag',
        'button' => 'Button',
        'zipper' => 'Zipper',
        'thread' => 'Thread',
    ];

    // Allowed file extensions for trim images (includes PDF, AI)
    const ALLOWED_FILE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf', 'ai', 'eps', 'svg'];

    protected $fillable = [
        'brand_id',
        'trim_types', // Changed from trim_type - now JSON array for multiple selection
        'trim_code',
        'image_path', // Now accepts PDF, AI, and images
        // 'file_path' - REMOVED (specification document no longer needed)
        'description',
        'is_active',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'trim_types' => 'array', // JSON array for multiple trim type selection
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
     * Scope to filter by trim type (checks if type is in the JSON array)
     */
    public function scopeByType($query, $trimType)
    {
        return $query->whereJsonContains('trim_types', $trimType);
    }

    /**
     * Scope to filter by any of the given trim types
     */
    public function scopeByTypes($query, array $trimTypes)
    {
        return $query->where(function ($q) use ($trimTypes) {
            foreach ($trimTypes as $type) {
                $q->orWhereJsonContains('trim_types', $type);
            }
        });
    }

    /**
     * Scope to filter active trims
     */
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    /**
     * Get the human-readable trim type names
     */
    public function getTrimTypeNamesAttribute(): array
    {
        if (empty($this->trim_types)) {
            return [];
        }

        return array_map(function ($type) {
            return self::TRIM_TYPES[$type] ?? $type;
        }, $this->trim_types);
    }

    /**
     * Get image URL with proper domain
     */
    public function getImageUrlAttribute(): ?string
    {
        if (empty($this->image_path)) {
            return null;
        }

        // If it's already an absolute URL, return as-is
        if (str_starts_with($this->image_path, 'http://') || str_starts_with($this->image_path, 'https://')) {
            return $this->image_path;
        }

        // If it starts with /storage/, convert to absolute URL
        if (str_starts_with($this->image_path, '/storage/')) {
            return request()->getSchemeAndHttpHost() . $this->image_path;
        }

        // Otherwise, prepend /storage/
        return request()->getSchemeAndHttpHost() . '/storage/' . $this->image_path;
    }

    /**
     * Check if the image is a PDF/AI file (for display purposes)
     */
    public function getIsDocumentAttribute(): bool
    {
        if (empty($this->image_path)) {
            return false;
        }

        $extension = strtolower(pathinfo($this->image_path, PATHINFO_EXTENSION));
        return in_array($extension, ['pdf', 'ai', 'eps']);
    }
}
