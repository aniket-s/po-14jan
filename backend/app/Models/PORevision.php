<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PORevision extends Model
{
    protected $table = 'po_revisions';

    protected $fillable = [
        'po_id',
        'revision_number',
        'revised_by',
        'changes',
        'reason',
        'notified_parties',
        'revised_at',
    ];

    protected $casts = [
        'changes' => 'array',
        'notified_parties' => 'array',
        'revised_at' => 'datetime',
    ];

    public function purchaseOrder()
    {
        return $this->belongsTo(PurchaseOrder::class, 'po_id');
    }

    public function revisor()
    {
        return $this->belongsTo(User::class, 'revised_by');
    }
}
