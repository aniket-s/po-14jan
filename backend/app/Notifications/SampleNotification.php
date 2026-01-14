<?php

namespace App\Notifications;

use App\Models\Sample;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class SampleNotification extends Notification implements ShouldQueue
{
    use Queueable;

    /**
     * Create a new notification instance.
     */
    public function __construct(
        public Sample $sample,
        public string $action, // submitted, approved, rejected, revision_requested
        public ?string $comments = null
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
        return ['mail', 'database'];
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
        $this->sample->load('style.purchaseOrder', 'sampleType');

        switch ($this->action) {
            case 'submitted':
                $mail->line('A new sample has been submitted for review.')
                    ->line('**Sample Type:** ' . $this->sample->sampleType->name)
                    ->line('**Style:** ' . $this->sample->style->style_number)
                    ->line('**PO Number:** ' . $this->sample->style->purchaseOrder->po_number);
                break;

            case 'approved':
                $mail->line('Your sample has been approved!')
                    ->line('**Sample Type:** ' . $this->sample->sampleType->name)
                    ->line('**Style:** ' . $this->sample->style->style_number);
                if ($this->comments) {
                    $mail->line('**Comments:** ' . $this->comments);
                }
                break;

            case 'rejected':
                $mail->line('Unfortunately, your sample has been rejected.')
                    ->line('**Sample Type:** ' . $this->sample->sampleType->name)
                    ->line('**Style:** ' . $this->sample->style->style_number);
                if ($this->comments) {
                    $mail->line('**Reason:** ' . $this->comments);
                }
                $mail->line('Please review the feedback and resubmit.');
                break;

            case 'revision_requested':
                $mail->line('Revisions have been requested for your sample.')
                    ->line('**Sample Type:** ' . $this->sample->sampleType->name)
                    ->line('**Style:** ' . $this->sample->style->style_number);
                if ($this->comments) {
                    $mail->line('**Required Changes:** ' . $this->comments);
                }
                break;
        }

        $mail->action('View Sample', url('/samples/' . $this->sample->id));

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
            'sample_id' => $this->sample->id,
            'style_id' => $this->sample->style_id,
            'sample_type_id' => $this->sample->sample_type_id,
            'action' => $this->action,
            'comments' => $this->comments,
            'status' => $this->sample->status,
        ];
    }

    /**
     * Get the notification subject.
     */
    private function getSubject(): string
    {
        return match ($this->action) {
            'submitted' => 'New Sample Submitted for Review',
            'approved' => 'Sample Approved',
            'rejected' => 'Sample Rejected',
            'revision_requested' => 'Sample Revision Requested',
            default => 'Sample Notification',
        };
    }
}
