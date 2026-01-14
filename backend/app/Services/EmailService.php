<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class EmailService
{
    /**
     * Send email using template
     */
    public function sendFromTemplate(
        string $templateName,
        string $toEmail,
        array $variables = [],
        ?string $toName = null,
        ?array $attachments = null
    ): bool {
        // Get template
        $template = DB::table('email_templates')
            ->where('name', $templateName)
            ->where('is_active', true)
            ->first();

        if (!$template) {
            Log::error("Email template not found: {$templateName}");
            return false;
        }

        // Replace variables
        $subject = $this->replaceVariables($template->subject, $variables);
        $bodyText = (property_exists($template, 'body_text') && $template->body_text) ? $this->replaceVariables($template->body_text, $variables) : null;
        $bodyHtml = (property_exists($template, 'body_html') && $template->body_html) ? $this->replaceVariables($template->body_html, $variables) : null;

        // Send email with safe property access
        return $this->send(
            toEmail: $toEmail,
            subject: $subject,
            bodyHtml: $bodyHtml,
            bodyText: $bodyText,
            fromEmail: property_exists($template, 'from_email') ? $template->from_email : null,
            fromName: property_exists($template, 'from_name') ? $template->from_name : null,
            replyTo: property_exists($template, 'reply_to') ? $template->reply_to : null,
            cc: property_exists($template, 'cc') ? $template->cc : null,
            bcc: property_exists($template, 'bcc') ? $template->bcc : null,
            toName: $toName,
            attachments: $attachments,
            templateId: $template->id
        );
    }

    /**
     * Send email directly (without template)
     */
    public function send(
        string $toEmail,
        string $subject,
        ?string $bodyHtml = null,
        ?string $bodyText = null,
        ?string $fromEmail = null,
        ?string $fromName = null,
        ?string $replyTo = null,
        ?string $cc = null,
        ?string $bcc = null,
        ?string $toName = null,
        ?array $attachments = null,
        ?int $templateId = null
    ): bool {
        // Get default from settings if not provided
        $fromEmail = $fromEmail ?? $this->getSettingValue('email_from_address');
        $fromName = $fromName ?? $this->getSettingValue('email_from_name');

        // Validate required fields
        if (empty($toEmail) || empty($subject) || (empty($bodyHtml) && empty($bodyText))) {
            Log::error('Email validation failed: missing required fields');
            return false;
        }

        try {
            // In production, this would use AWS SES SDK
            // For now, we'll use Laravel's built-in Mail functionality
            // and log to database

            // TODO: Implement actual AWS SES sending
            // Example:
            // $sesClient = new SesClient([...]);
            // $result = $sesClient->sendEmail([...]);

            // For development, we'll simulate sending
            $emailSent = $this->simulateSend(
                $toEmail,
                $subject,
                $bodyHtml,
                $bodyText,
                $fromEmail,
                $fromName
            );

            // Log to email_logs table
            DB::table('email_logs')->insert([
                'email_template_id' => $templateId,
                'recipient_email' => $toEmail,
                'subject' => $subject,
                'body_html' => $bodyHtml,
                'status' => $emailSent ? 'sent' : 'failed',
                'sent_at' => $emailSent ? now() : null,
                'error_message' => $emailSent ? null : 'Simulated failure',
                'metadata' => json_encode([
                    'to_name' => $toName,
                    'from_email' => $fromEmail,
                    'from_name' => $fromName,
                    'reply_to' => $replyTo,
                    'cc' => $cc,
                    'bcc' => $bcc,
                    'attachments_count' => $attachments ? count($attachments) : 0,
                ]),
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            return $emailSent;

        } catch (\Exception $e) {
            Log::error('Email sending failed: ' . $e->getMessage());

            // Log failed attempt
            DB::table('email_logs')->insert([
                'email_template_id' => $templateId,
                'recipient_email' => $toEmail,
                'subject' => $subject,
                'body_html' => $bodyHtml,
                'status' => 'failed',
                'error_message' => $e->getMessage(),
                'metadata' => json_encode([
                    'from_email' => $fromEmail,
                ]),
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            return false;
        }
    }

    /**
     * Send bulk emails using template
     */
    public function sendBulkFromTemplate(
        string $templateName,
        array $recipients, // Array of ['email' => '', 'name' => '', 'variables' => []]
        array $globalVariables = []
    ): array {
        $results = [
            'total' => count($recipients),
            'sent' => 0,
            'failed' => 0,
            'errors' => [],
        ];

        foreach ($recipients as $recipient) {
            $email = $recipient['email'];
            $name = $recipient['name'] ?? null;
            $variables = array_merge($globalVariables, $recipient['variables'] ?? []);

            $sent = $this->sendFromTemplate($templateName, $email, $variables, $name);

            if ($sent) {
                $results['sent']++;
            } else {
                $results['failed']++;
                $results['errors'][] = [
                    'email' => $email,
                    'error' => 'Failed to send email',
                ];
            }
        }

        return $results;
    }

    /**
     * Get email sending statistics
     */
    public function getStatistics(array $filters = []): array
    {
        $query = DB::table('email_logs');

        // Date range filter
        if (isset($filters['date_from'])) {
            $query->where('created_at', '>=', $filters['date_from']);
        }

        if (isset($filters['date_to'])) {
            $query->where('created_at', '<=', $filters['date_to']);
        }

        // Status filter
        if (isset($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        // Template filter
        if (isset($filters['template_id'])) {
            $query->where('template_id', $filters['template_id']);
        }

        $total = $query->count();
        $sent = (clone $query)->where('status', 'sent')->count();
        $failed = (clone $query)->where('status', 'failed')->count();
        $pending = (clone $query)->where('status', 'pending')->count();

        return [
            'total' => $total,
            'sent' => $sent,
            'failed' => $failed,
            'pending' => $pending,
            'success_rate' => $total > 0 ? round(($sent / $total) * 100, 2) : 0,
        ];
    }

    /**
     * Retry failed email
     */
    public function retryFailed(int $emailLogId): bool
    {
        $log = DB::table('email_logs')->where('id', $emailLogId)->first();

        if (!$log || $log->status !== 'failed') {
            return false;
        }

        return $this->send(
            toEmail: $log->to_email,
            subject: $log->subject,
            bodyHtml: $log->body_html,
            bodyText: $log->body_text,
            fromEmail: $log->from_email,
            fromName: $log->from_name,
            replyTo: $log->reply_to,
            cc: $log->cc,
            bcc: $log->bcc,
            toName: $log->to_name,
            templateId: $log->template_id
        );
    }

    /**
     * Replace variables in template content
     */
    private function replaceVariables(string $content, array $variables): string
    {
        foreach ($variables as $key => $value) {
            // Replace {{variable}} with value
            $content = str_replace('{{' . $key . '}}', $value, $content);
        }

        return $content;
    }

    /**
     * Get setting value
     */
    private function getSettingValue(string $key): ?string
    {
        $setting = DB::table('system_settings')->where('key', $key)->first();
        return $setting ? $setting->value : null;
    }

    /**
     * Simulate email sending (for development)
     * In production, replace this with actual AWS SES integration
     */
    private function simulateSend(
        string $toEmail,
        string $subject,
        ?string $bodyHtml,
        ?string $bodyText,
        ?string $fromEmail,
        ?string $fromName
    ): bool {
        // Log the email details
        Log::info('Email sent (simulated)', [
            'to' => $toEmail,
            'from' => $fromEmail,
            'subject' => $subject,
        ]);

        // Simulate 95% success rate
        return rand(1, 100) <= 95;
    }

    /**
     * Validate email template variables
     */
    public function validateTemplateVariables(string $templateName, array $variables): array
    {
        $template = DB::table('email_templates')
            ->where('name', $templateName)
            ->first();

        if (!$template) {
            return [
                'valid' => false,
                'message' => 'Template not found',
            ];
        }

        $availableVariables = $template->available_variables ? json_decode($template->available_variables, true) : [];

        if (empty($availableVariables)) {
            return [
                'valid' => true,
                'message' => 'No variables required',
            ];
        }

        $missingVariables = array_diff($availableVariables, array_keys($variables));

        if (!empty($missingVariables)) {
            return [
                'valid' => false,
                'message' => 'Missing required variables',
                'missing_variables' => $missingVariables,
            ];
        }

        return [
            'valid' => true,
            'message' => 'All required variables provided',
        ];
    }
}
