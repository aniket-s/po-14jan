<?php

namespace App\Jobs;

use App\Models\Shipment;
use App\Models\User;
use App\Notifications\ShipmentNotification;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Support\Facades\Log;

class SendShipmentNotification
{
    use Dispatchable;

    /**
     * Create a new job instance.
     */
    public function __construct(
        public Shipment $shipment,
        public User $user,
        public string $action, // created, status_updated, delivered
        public ?string $previousStatus = null
    ) {
        //
    }

    /**
     * Execute the job.
     */
    public function handle(): void
    {
        try {
            $this->user->notify(new ShipmentNotification(
                $this->shipment,
                $this->action,
                $this->previousStatus
            ));

            Log::info('Shipment notification sent', [
                'user_id' => $this->user->id,
                'shipment_id' => $this->shipment->id,
                'action' => $this->action,
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to send shipment notification', [
                'user_id' => $this->user->id,
                'shipment_id' => $this->shipment->id,
                'action' => $this->action,
                'error' => $e->getMessage(),
            ]);

            throw $e;
        }
    }

    /**
     * Handle a job failure.
     */
    public function failed(\Throwable $exception): void
    {
        Log::error('Shipment notification job failed', [
            'user_id' => $this->user->id,
            'shipment_id' => $this->shipment->id,
            'action' => $this->action,
            'error' => $exception->getMessage(),
        ]);
    }
}
