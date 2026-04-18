<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class StyleColor extends Model
{
    use HasFactory;

    protected $fillable = [
        'style_id',
        'color_id',
        'color_name',
        'color_code',
        'is_primary',
        'display_order',
    ];

    protected $casts = [
        'is_primary' => 'boolean',
        'display_order' => 'integer',
    ];

    public function style()
    {
        return $this->belongsTo(Style::class);
    }

    public function color()
    {
        return $this->belongsTo(Color::class);
    }
}
