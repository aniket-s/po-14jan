<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Relations\Pivot;

/**
 * Pivot model for buy_sheet_style. Exists so JSON columns cast to arrays
 * on read and are not double-encoded on write (the default anonymous pivot
 * returns JSON as strings to the client).
 */
class BuySheetStyle extends Pivot
{
    protected $table = 'buy_sheet_style';

    public $incrementing = true;

    public $timestamps = true;

    protected $casts = [
        'quantity' => 'integer',
        'unit_price' => 'decimal:2',
        'size_breakdown' => 'array',
        'metadata' => 'array',
    ];
}
