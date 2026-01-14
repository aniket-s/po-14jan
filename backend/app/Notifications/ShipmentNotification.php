<?php

namespace App\Notifications;

use App\Models\Shipment;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class ShipmentNotification extends Notification implements ShouldQueue
{
    use Queueable;

    /**
     * Create a new notification instance.
     */
    public function __construct(
        public Shipment $shipment,
        public string $action, // created, status_updated, delivered
        public ?string $previousStatus = null
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
        $this->shipment->load('purchaseOrder');

        switch ($this->action) {
            case 'created':
                $mail->line('A new shipment has been created for your order.')
                    ->line('**Tracking Number:** ' . $this->shipment->tracking_number)
                    ->line('**PO Number:** ' . $this->shipment->purchaseOrder->po_number)
                    ->line('**Shipping Method:** ' . ucfirst($this->shipment->shipping_method))
                    ->line('**Destination:** ' . $this->shipment->destination);

                if ($this->shipment->estimated_delivery_date) {
                    $mail->line('**Estimated Delivery:** ' . $this->shipment->estimated_delivery_date->format('M d, Y'));
                }
                break;

            case 'status_updated':
                $mail->line('Your shipment status has been updated.')
                    ->line('**Tracking Number:** ' . $this->shipment->tracking_number)
                    ->line('**New Status:** ' . $this->getStatusLabel($this->shipment->status));

                if ($this->previousStatus) {
                    $mail->line('**Previous Status:** ' . $this->getStatusLabel($this->previousStatus));
                }

                if ($this->shipment->current_location) {
                    $mail->line('**Current Location:** ' . $this->shipment->current_location);
                }

                // Add status-specific messages
                switch ($this->shipment->status) {
                    case 'dispatched':
                        $mail->line('📦 Your order has been dispatched and is on its way!');
                        break;
                    case 'in_transit':
                        $mail->line('🚚 Your shipment is in transit.');
                        break;
                    case 'customs':
                        $mail->line('🛃 Your shipment is currently in customs clearance.');
                        break;
                    case 'out_for_delivery':
                        $mail->line('🚛 Your shipment is out for delivery and will arrive soon!');
                        break;
                }
                break;

            case 'delivered':
                $mail->line('🎉 Your shipment has been delivered successfully!')
                    ->line('**Tracking Number:** ' . $this->shipment->tracking_number)
                    ->line('**Delivered On:** ' . $this->shipment->actual_delivery_date?->format('M d, Y H:i'));

                if ($this->shipment->delivered_to) {
                    $mail->line('**Received By:** ' . $this->shipment->delivered_to);
                }

                $mail->line('Thank you for your business!');
                break;
        }

        // Add tracking link if available
        if ($this->shipment->tracking_url) {
            $mail->action('Track Shipment', $this->shipment->tracking_url);
        } else {
            $mail->action('View Shipment Details', url('/shipments/' . $this->shipment->id));
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
            'shipment_id' => $this->shipment->id,
            'tracking_number' => $this->shipment->tracking_number,
            'purchase_order_id' => $this->shipment->purchase_order_id,
            'action' => $this->action,
            'status' => $this->shipment->status,
            'previous_status' => $this->previousStatus,
            'current_location' => $this->shipment->current_location,
        ];
    }

    /**
     * Get the notification subject.
     */
    private function getSubject(): string
    {
        return match ($this->action) {
            'created' => 'New Shipment Created - ' . $this->shipment->tracking_number,
            'status_updated' => 'Shipment Update - ' . $this->getStatusLabel($this->shipment->status),
            'delivered' => '🎉 Shipment Delivered - ' . $this->shipment->tracking_number,
            default => 'Shipment Notification',
        };
    }

    /**
     * Get human-readable status label.
     */
    private function getStatusLabel(string $status): string
    {
        return match ($status) {
            'preparing' => 'Preparing',
            'dispatched' => 'Dispatched',
            'in_transit' => 'In Transit',
            'customs' => 'In Customs',
            'out_for_delivery' => 'Out for Delivery',
            'delivered' => 'Delivered',
            'cancelled' => 'Cancelled',
            default => ucfirst($status),
        };
    }
}
