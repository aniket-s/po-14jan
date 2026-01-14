<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class PrepackCode extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'code',
        'name',
        'size_range',
        'ratio',
        'sizes',
        'total_pieces_per_pack',
        'description',
        'is_active',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'sizes' => 'array',
        'total_pieces_per_pack' => 'integer',
    ];

    public function stylePrepacks()
    {
        return $this->hasMany(StylePrepack::class);
    }
}
