<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Invitation extends Model
{
    use HasFactory;

    protected $fillable = [
        'purchase_order_id',
        'invitation_type',
        'invited_by',
        'invited_user_id',
        'invited_email',
        'invited_name',
        'invitation_token',
        'status',
        'expires_at',
        'accepted_at',
        'rejected_at',
        'rejection_reason',
        'message',
        'metadata',
    ];

    protected $casts = [
        'expires_at' => 'datetime',
        'accepted_at' => 'datetime',
        'rejected_at' => 'datetime',
        'metadata' => 'array',
    ];

    /**
     * Get the purchase order
     */
    public function purchaseOrder()
    {
        return $this->belongsTo(PurchaseOrder::class);
    }

    /**
     * Get the user who sent the invitation
     */
    public function invitedBy()
    {
        return $this->belongsTo(User::class, 'invited_by');
    }

    /**
     * Get the invited user (if exists)
     */
    public function invitedUser()
    {
        return $this->belongsTo(User::class, 'invited_user_id');
    }

    /**
     * Scope to filter by status
     */
    public function scopeByStatus($query, $status)
    {
        return $query->where('status', $status);
    }

    /**
     * Scope to filter by invitation type
     */
    public function scopeByType($query, $type)
    {
        return $query->where('invitation_type', $type);
    }

    /**
     * Scope to filter pending invitations
     */
    public function scopePending($query)
    {
        return $query->where('status', 'pending')
            ->where('expires_at', '>', now());
    }

    /**
     * Scope to filter expired invitations
     */
    public function scopeExpired($query)
    {
        return $query->where('status', 'pending')
            ->where('expires_at', '<=', now());
    }

    /**
     * Check if invitation is pending
     */
    public function isPending(): bool
    {
        return $this->status === 'pending' && $this->expires_at > now();
    }

    /**
     * Check if invitation is accepted
     */
    public function isAccepted(): bool
    {
        return $this->status === 'accepted';
    }

    /**
     * Check if invitation is rejected
     */
    public function isRejected(): bool
    {
        return $this->status === 'rejected';
    }

    /**
     * Check if invitation is expired
     */
    public function isExpired(): bool
    {
        return $this->status === 'pending' && $this->expires_at <= now();
    }

    /**
     * Accept invitation
     */
    public function accept(): void
    {
        $this->status = 'accepted';
        $this->accepted_at = now();
        $this->save();
    }

    /**
     * Reject invitation
     */
    public function reject(?string $reason = null): void
    {
        $this->status = 'rejected';
        $this->rejected_at = now();
        $this->rejection_reason = $reason;
        $this->save();
    }

    /**
     * Mark as expired
     */
    public function markExpired(): void
    {
        $this->status = 'expired';
        $this->save();
    }
}
