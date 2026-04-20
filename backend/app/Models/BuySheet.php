<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class BuySheet extends Model
{
    use HasFactory, SoftDeletes;

    public const STATUS_OPEN = 'open';
    public const STATUS_PO_ISSUED = 'po_issued';
    public const STATUS_CLOSED = 'closed';
    public const STATUS_CANCELLED = 'cancelled';

    protected $fillable = [
        'buy_sheet_number',
        'buyer_id',
        'retailer_id',
        'season_id',
        'name',
        'date_submitted',
        'status',
        'total_styles',
        'total_quantity',
        'total_value',
        'tickets_required',
        'buyer_approvals_required',
        'source_file_path',
        'strategy_key',
        'metadata',
        'created_by',
    ];

    protected $casts = [
        'buyer_id' => 'integer',
        'retailer_id' => 'integer',
        'season_id' => 'integer',
        'date_submitted' => 'date',
        'total_styles' => 'integer',
        'total_quantity' => 'integer',
        'total_value' => 'decimal:2',
        'tickets_required' => 'boolean',
        'buyer_approvals_required' => 'boolean',
        'metadata' => 'array',
        'created_by' => 'integer',
    ];

    public function buyer()
    {
        return $this->belongsTo(Buyer::class);
    }

    public function retailer()
    {
        return $this->belongsTo(Retailer::class);
    }

    public function season()
    {
        return $this->belongsTo(Season::class);
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function styles()
    {
        return $this->belongsToMany(Style::class, 'buy_sheet_style')
            ->withPivot(['quantity', 'unit_price', 'size_breakdown', 'packing', 'label', 'ihd', 'metadata'])
            ->withTimestamps();
    }

    public function purchaseOrders()
    {
        return $this->hasMany(PurchaseOrder::class, 'buy_sheet_id');
    }

    public function scopeOpen($query)
    {
        return $query->where('status', self::STATUS_OPEN);
    }

    public function scopeForBuyer($query, int $buyerId)
    {
        return $query->where('buyer_id', $buyerId);
    }

    public function refreshTotals(): void
    {
        $agg = $this->styles()->selectRaw('COUNT(*) as c, SUM(quantity) as q, SUM(quantity * unit_price) as v')->first();
        $this->total_styles = (int) ($agg->c ?? 0);
        $this->total_quantity = (int) ($agg->q ?? 0);
        $this->total_value = (float) ($agg->v ?? 0);
        $this->save();
    }
}
