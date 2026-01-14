<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class StylePrepack extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'style_id',
        'prepack_code_id',
        'quantity',
        'total_pieces',
        'piece_breakdown',
        'notes',
    ];

    protected $casts = [
        'quantity' => 'integer',
        'total_pieces' => 'integer',
        'piece_breakdown' => 'array',
    ];

    public function style()
    {
        return $this->belongsTo(Style::class);
    }

    public function prepackCode()
    {
        return $this->belongsTo(PrepackCode::class);
    }
}
