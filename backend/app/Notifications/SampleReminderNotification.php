<?php

namespace App\Notifications;

use Illuminate\Notifications\Notification;

class SampleReminderNotification extends Notification
{
    /**
     * @param string $reminderType  approaching|due_today|overdue
     * @param string $sampleTypeName  e.g. "Lab Dip"
     * @param string $poNumber
     * @param string $dueDate  Y-m-d
     * @param int    $poId
     * @param int|null $daysUntilDue  positive = days left, negative = days overdue
     */
    public function __construct(
        public string $reminderType,
        public string $sampleTypeName,
        public string $poNumber,
        public string $dueDate,
        public int $poId,
        public ?int $daysUntilDue = null,
    ) {
    }

    public function via(object $notifiable): array
    {
        return ['database'];
    }

    public function toArray(object $notifiable): array
    {
        return [
            'title' => $this->getTitle(),
            'message' => $this->getMessage(),
            'po_id' => $this->poId,
            'po_number' => $this->poNumber,
            'sample_type' => $this->sampleTypeName,
            'due_date' => $this->dueDate,
            'reminder_type' => $this->reminderType,
        ];
    }

    private function getTitle(): string
    {
        return match ($this->reminderType) {
            'approaching' => 'Sample Due Soon',
            'due_today' => 'Sample Due Today',
            'overdue' => 'Sample Overdue',
            default => 'Sample Reminder',
        };
    }

    private function getMessage(): string
    {
        $formattedDate = date('M j, Y', strtotime($this->dueDate));

        return match ($this->reminderType) {
            'approaching' => "{$this->sampleTypeName} for PO {$this->poNumber} is due in {$this->daysUntilDue} day(s) ({$formattedDate}).",
            'due_today' => "{$this->sampleTypeName} for PO {$this->poNumber} is due today ({$formattedDate}).",
            'overdue' => "{$this->sampleTypeName} for PO {$this->poNumber} was due on {$formattedDate} and is overdue.",
            default => "{$this->sampleTypeName} for PO {$this->poNumber} reminder.",
        };
    }
}
