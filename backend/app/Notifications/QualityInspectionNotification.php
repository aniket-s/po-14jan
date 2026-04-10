<?php

namespace App\Notifications;

use App\Models\QualityInspection;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class QualityInspectionNotification extends Notification
{

    /**
     * Create a new notification instance.
     */
    public function __construct(
        public QualityInspection $inspection,
        public string $action // created, completed, failed
    ) {
        //
    }

    /**
     * Get the notification's delivery channels.
     *
     * @return array<int, string>
     */
    public function via(object $notifiable): array
    {
        return ['database'];
    }

    /**
     * Get the mail representation of the notification.
     */
    public function toMail(object $notifiable): MailMessage
    {
        $mail = (new MailMessage)
            ->subject($this->getSubject())
            ->greeting('Hello ' . $notifiable->name . ',');

        // Load relationships if needed
        $this->inspection->load('style.purchaseOrders:id,po_number');
        $poNumber = $this->inspection->style->getEffectivePurchaseOrder()?->po_number ?? 'N/A';

        switch ($this->action) {
            case 'created':
                $mail->line('A new quality inspection has been scheduled.')
                    ->line('**Inspection Date:** ' . $this->inspection->inspected_at->format('M d, Y'))
                    ->line('**Style:** ' . $this->inspection->style->style_number)
                    ->line('**PO Number:** ' . $poNumber);
                break;

            case 'completed':
                $statusColor = $this->inspection->result === 'passed' ? '✅' : ($this->inspection->result === 'failed' ? '❌' : '⚠️');
                $mail->line('Quality inspection has been completed.')
                    ->line('**Result:** ' . $statusColor . ' ' . strtoupper($this->inspection->result))
                    ->line('**Style:** ' . $this->inspection->style->style_number)
                    ->line('**Inspected Quantity:** ' . number_format($this->inspection->inspected_quantity))
                    ->line('**Defects Found:** ' . number_format($this->inspection->defects_found));

                if ($this->inspection->result === 'failed') {
                    $mail->line('⚠️ **Action Required:** Please review the defects and take corrective measures.');
                } elseif ($this->inspection->result === 'conditional') {
                    $mail->line('⚠️ **Conditional Approval:** Minor issues found. Please review comments.');
                }

                if ($this->inspection->notes) {
                    $mail->line('**Notes:** ' . $this->inspection->notes);
                }
                break;

            case 'failed':
                $mail->line('Quality inspection has **FAILED**.')
                    ->line('**Style:** ' . $this->inspection->style->style_number)
                    ->line('**Defects Found:** ' . number_format($this->inspection->defects_found))
                    ->line('**Critical Issues:** Immediate action required');

                if ($this->inspection->notes) {
                    $mail->line('**Details:** ' . $this->inspection->notes);
                }

                $mail->line('Please contact the QC team for detailed defect analysis.');
                break;
        }

        $mail->action('View Inspection Report', url('/quality-inspections/' . $this->inspection->id));

        return $mail;
    }

    /**
     * Get the array representation of the notification.
     *
     * @return array<string, mixed>
     */
    public function toArray(object $notifiable): array
    {
        return [
            'title' => $this->getSubject(),
            'message' => $this->getMessage(),
            'inspection_id' => $this->inspection->id,
            'style_id' => $this->inspection->style_id,
            'action' => $this->action,
            'result' => $this->inspection->result,
            'defects_found' => $this->inspection->defects_found,
            'inspected_at' => $this->inspection->inspected_at?->toDateString(),
        ];
    }

    private function getMessage(): string
    {
        $styleName = $this->inspection->style?->style_number ?? '';
        return match ($this->action) {
            'created' => 'Quality inspection scheduled for style ' . $styleName . '.',
            'completed' => 'Quality inspection for style ' . $styleName . ' completed: ' . strtoupper($this->inspection->result ?? '') . '.',
            'failed' => 'Quality inspection FAILED for style ' . $styleName . '. Immediate action required.',
            default => 'Quality inspection notification for style ' . $styleName . '.',
        };
    }

    /**
     * Get the notification subject.
     */
    private function getSubject(): string
    {
        return match ($this->action) {
            'created' => 'Quality Inspection Scheduled',
            'completed' => 'Quality Inspection Completed - ' . strtoupper($this->inspection->result),
            'failed' => '⚠️ Quality Inspection FAILED - Immediate Action Required',
            default => 'Quality Inspection Notification',
        };
    }
}
