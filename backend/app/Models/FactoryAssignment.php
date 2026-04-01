<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class FactoryAssignment extends Model
{
    use HasFactory;

    protected $fillable = [
        'purchase_order_id',
        'style_id',
        'factory_id',
        'invitation_id',
        'assigned_by',
        'assigned_at',
        'assignment_type',
        'status',
        'accepted_at',
        'rejected_at',
        'rejection_reason',
        'special_instructions',
        'notes',
        'expected_completion_date',
    ];

    protected $casts = [
        'assigned_at' => 'datetime',
        'accepted_at' => 'datetime',
        'rejected_at' => 'datetime',
        'expected_completion_date' => 'date',
    ];

    /**
     * Get the purchase order
     */
    public function purchaseOrder()
    {
        return $this->belongsTo(PurchaseOrder::class);
    }

    /**
     * Get the style
     */
    public function style()
    {
        return $this->belongsTo(Style::class);
    }

    /**
     * Get the factory user
     */
    public function factory()
    {
        return $this->belongsTo(User::class, 'factory_id');
    }

    /**
     * Get the user who assigned
     */
    public function assignedBy()
    {
        return $this->belongsTo(User::class, 'assigned_by');
    }

    /**
     * Get the invitation
     */
    public function invitation()
    {
        return $this->belongsTo(Invitation::class);
    }

    /**
     * Scope to filter by status
     */
    public function scopeByStatus($query, $status)
    {
        return $query->where('status', $status);
    }

    /**
     * Scope to filter by factory
     */
    public function scopeByFactory($query, $factoryId)
    {
        return $query->where('factory_id', $factoryId);
    }

    /**
     * Scope to filter by assignment type
     */
    public function scopeByType($query, $type)
    {
        return $query->where('assignment_type', $type);
    }

    /**
     * Check if assignment is pending
     */
    public function isPending(): bool
    {
        return $this->status === 'pending';
    }

    /**
     * Check if assignment is accepted
     */
    public function isAccepted(): bool
    {
        return $this->status === 'accepted';
    }

    /**
     * Check if assignment is rejected
     */
    public function isRejected(): bool
    {
        return $this->status === 'rejected';
    }

    /**
     * Accept assignment
     */
    public function accept(): void
    {
        $this->status = 'accepted';
        $this->accepted_at = now();
        $this->save();
    }

    /**
     * Reject assignment
     */
    public function reject(?string $reason = null): void
    {
        $this->status = 'rejected';
        $this->rejected_at = now();
        $this->rejection_reason = $reason;
        $this->save();
    }
}
