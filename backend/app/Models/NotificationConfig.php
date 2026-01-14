<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class NotificationConfig extends Model
{
    use HasFactory;

    protected $fillable = [
        'event_name',
        'category',
        'email_enabled',
        'in_app_enabled',
        'sms_enabled',
        'recipients',
        'email_template_id',
        'in_app_message',
        'sms_message',
        'delay_minutes',
        'priority',
        'is_active',
    ];

    protected $casts = [
        'email_enabled' => 'boolean',
        'in_app_enabled' => 'boolean',
        'sms_enabled' => 'boolean',
        'recipients' => 'array',
        'is_active' => 'boolean',
    ];

    /**
     * Get the email template
     */
    public function emailTemplate()
    {
        return $this->belongsTo(EmailTemplate::class);
    }

    /**
     * Get config by event name
     */
    public static function getByEvent(string $eventName)
    {
        return static::where('event_name', $eventName)
            ->where('is_active', true)
            ->first();
    }

    /**
     * Check if email is enabled for this event
     */
    public function isEmailEnabled(): bool
    {
        return $this->email_enabled && $this->is_active;
    }

    /**
     * Check if in-app notification is enabled
     */
    public function isInAppEnabled(): bool
    {
        return $this->in_app_enabled && $this->is_active;
    }

    /**
     * Check if SMS is enabled
     */
    public function isSmsEnabled(): bool
    {
        return $this->sms_enabled && $this->is_active;
    }

    /**
     * Scope to get active configs
     */
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    /**
     * Scope to filter by category
     */
    public function scopeByCategory($query, string $category)
    {
        return $query->where('category', $category);
    }
}
