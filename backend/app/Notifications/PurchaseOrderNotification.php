<?php

namespace App\Notifications;

use App\Models\PurchaseOrder;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class PurchaseOrderNotification extends Notification
{

    /**
     * Create a new notification instance.
     */
    public function __construct(
        public PurchaseOrder $purchaseOrder,
        public string $action, // created, updated, status_changed, cancelled
        public array $changes = []
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

        switch ($this->action) {
            case 'created':
                $mail->line('A new purchase order has been created.')
                    ->line('**PO Number:** ' . $this->purchaseOrder->po_number)
                    ->line('**Total Quantity:** ' . number_format($this->purchaseOrder->total_quantity))
                    ->line('**Total Value:** ' . $this->formatCurrency($this->purchaseOrder->total_value));
                break;

            case 'updated':
                $mail->line('Purchase order ' . $this->purchaseOrder->po_number . ' has been updated.');
                if (!empty($this->changes)) {
                    $mail->line('**Changes made:**');
                    foreach ($this->changes as $field => $values) {
                        $mail->line("- {$field}: {$values['old']} → {$values['new']}");
                    }
                }
                break;

            case 'status_changed':
                $mail->line('Purchase order ' . $this->purchaseOrder->po_number . ' status has changed.')
                    ->line('**New Status:** ' . ucwords(str_replace('_', ' ', $this->purchaseOrder->status)));
                if (isset($this->changes['status'])) {
                    $mail->line('**Previous Status:** ' . ucwords(str_replace('_', ' ', $this->changes['status']['old'])));
                }
                break;

            case 'cancelled':
                $mail->line('Purchase order ' . $this->purchaseOrder->po_number . ' has been cancelled.')
                    ->line('Please review and take necessary actions.');
                break;

            case 'factory_assigned':
                $mail->line('You have been assigned as the factory for a style in purchase order ' . $this->purchaseOrder->po_number . '.');
                if (isset($this->changes['style_number'])) {
                    $mail->line('**Style:** ' . $this->changes['style_number']);
                }
                if (isset($this->changes['assigned_by'])) {
                    $mail->line('**Assigned by:** ' . $this->changes['assigned_by']);
                }
                $mail->line('Please review and confirm the assignment.');
                break;

            case 'agency_assigned':
                $mail->line('You have been assigned as the agency for a style in purchase order ' . $this->purchaseOrder->po_number . '.');
                if (isset($this->changes['style_number'])) {
                    $mail->line('**Style:** ' . $this->changes['style_number']);
                }
                if (isset($this->changes['assigned_by'])) {
                    $mail->line('**Assigned by:** ' . $this->changes['assigned_by']);
                }
                break;
        }

        $mail->action('View Purchase Order', url('/purchase-orders/' . $this->purchaseOrder->id));

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
            'purchase_order_id' => $this->purchaseOrder->id,
            'po_number' => $this->purchaseOrder->po_number,
            'action' => $this->action,
            'changes' => $this->changes,
            'total_value' => $this->purchaseOrder->total_value,
            'currency' => $this->purchaseOrder->currency,
        ];
    }

    private function getMessage(): string
    {
        return match ($this->action) {
            'created' => 'New purchase order ' . $this->purchaseOrder->po_number . ' has been created.',
            'updated' => 'Purchase order ' . $this->purchaseOrder->po_number . ' has been updated.',
            'status_changed' => 'PO ' . $this->purchaseOrder->po_number . ' status changed to ' . $this->purchaseOrder->status . '.',
            'cancelled' => 'Purchase order ' . $this->purchaseOrder->po_number . ' has been cancelled.',
            'factory_assigned' => 'You have been assigned to a style in PO ' . $this->purchaseOrder->po_number . '.',
            'agency_assigned' => 'You have been assigned as agency for PO ' . $this->purchaseOrder->po_number . '.',
            default => 'Purchase order ' . $this->purchaseOrder->po_number . ' notification.',
        };
    }

    /**
     * Get the notification subject.
     */
    private function getSubject(): string
    {
        return match ($this->action) {
            'created' => 'New Purchase Order: ' . $this->purchaseOrder->po_number,
            'updated' => 'Purchase Order Updated: ' . $this->purchaseOrder->po_number,
            'status_changed' => 'PO Status Changed: ' . $this->purchaseOrder->po_number,
            'cancelled' => 'Purchase Order Cancelled: ' . $this->purchaseOrder->po_number,
            'factory_assigned' => 'Factory Assignment: ' . $this->purchaseOrder->po_number,
            'agency_assigned' => 'Agency Assignment: ' . $this->purchaseOrder->po_number,
            default => 'Purchase Order Notification: ' . $this->purchaseOrder->po_number,
        };
    }

    /**
     * Format currency value.
     */
    private function formatCurrency(float $value): string
    {
        return number_format($value, 2) . ' ' . $this->purchaseOrder->currency;
    }
}
