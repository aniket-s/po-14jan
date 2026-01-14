<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ImportMapping extends Model
{
    protected $fillable = [
        'user_id',
        'name',
        'import_type',
        'column_mapping',
        'is_default',
    ];

    protected $casts = [
        'column_mapping' => 'array',
        'is_default' => 'boolean',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
