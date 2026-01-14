<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class GenericEmailNotification extends Notification implements ShouldQueue
{
    use Queueable;

    /**
     * Create a new notification instance.
     */
    public function __construct(
        public string $subject,
        public string $message,
        public array $data = [],
        public ?string $template = null
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
            ->subject($this->subject)
            ->greeting('Hello ' . $notifiable->name . ',')
            ->line($this->message);

        // Add additional lines if provided in data
        if (isset($this->data['lines']) && is_array($this->data['lines'])) {
            foreach ($this->data['lines'] as $line) {
                $mail->line($line);
            }
        }

        // Add action button if provided
        if (isset($this->data['action_url']) && isset($this->data['action_text'])) {
            $mail->action($this->data['action_text'], $this->data['action_url']);
        }

        // Add additional lines after action
        if (isset($this->data['footer_lines']) && is_array($this->data['footer_lines'])) {
            foreach ($this->data['footer_lines'] as $line) {
                $mail->line($line);
            }
        }

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
            'subject' => $this->subject,
            'message' => $this->message,
            'data' => $this->data,
            'template' => $this->template,
        ];
    }
}
