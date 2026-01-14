<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class EmailLog extends Model
{
    use HasFactory;

    protected $fillable = [
        'email_template_id',
        'template_name',
        'recipient_email',
        'recipient_user_id',
        'subject',
        'body_html',
        'status',
        'error_message',
        'retry_count',
        'sent_at',
        'metadata',
    ];

    protected $casts = [
        'sent_at' => 'datetime',
        'metadata' => 'array',
    ];

    /**
     * Get the email template
     */
    public function emailTemplate()
    {
        return $this->belongsTo(EmailTemplate::class);
    }

    /**
     * Get the recipient user
     */
    public function recipientUser()
    {
        return $this->belongsTo(User::class, 'recipient_user_id');
    }

    /**
     * Log an email (static helper)
     */
    public static function logEmail(
        string $recipientEmail,
        string $subject,
        string $bodyHtml,
        ?int $templateId = null,
        ?string $templateName = null,
        ?int $recipientUserId = null,
        ?array $metadata = null
    ): self {
        return static::create([
            'email_template_id' => $templateId,
            'template_name' => $templateName,
            'recipient_email' => $recipientEmail,
            'recipient_user_id' => $recipientUserId,
            'subject' => $subject,
            'body_html' => $bodyHtml,
            'status' => 'queued',
            'metadata' => $metadata,
        ]);
    }

    /**
     * Mark email as sent
     */
    public function markAsSent(): void
    {
        $this->update([
            'status' => 'sent',
            'sent_at' => now(),
        ]);
    }

    /**
     * Mark email as failed
     */
    public function markAsFailed(string $errorMessage): void
    {
        $this->update([
            'status' => 'failed',
            'error_message' => $errorMessage,
            'retry_count' => $this->retry_count + 1,
        ]);
    }

    /**
     * Scope to filter by status
     */
    public function scopeByStatus($query, string $status)
    {
        return $query->where('status', $status);
    }

    /**
     * Scope to get queued emails
     */
    public function scopeQueued($query)
    {
        return $query->where('status', 'queued');
    }

    /**
     * Scope to get sent emails
     */
    public function scopeSent($query)
    {
        return $query->where('status', 'sent');
    }

    /**
     * Scope to get failed emails
     */
    public function scopeFailed($query)
    {
        return $query->where('status', 'failed');
    }
}
