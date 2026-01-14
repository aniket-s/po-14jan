<?php

namespace App\Jobs;

use App\Models\PurchaseOrder;
use App\Models\User;
use App\Notifications\PurchaseOrderNotification;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class SendPurchaseOrderNotification implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    /**
     * The number of times the job may be attempted.
     *
     * @var int
     */
    public $tries = 3;

    /**
     * The number of seconds the job can run before timing out.
     *
     * @var int
     */
    public $timeout = 60;

    /**
     * Create a new job instance.
     */
    public function __construct(
        public PurchaseOrder $purchaseOrder,
        public User $user,
        public string $action, // created, updated, status_changed, cancelled
        public array $changes = []
    ) {
        //
    }

    /**
     * Execute the job.
     */
    public function handle(): void
    {
        try {
            $this->user->notify(new PurchaseOrderNotification(
                $this->purchaseOrder,
                $this->action,
                $this->changes
            ));

            Log::info('Purchase order notification sent', [
                'user_id' => $this->user->id,
                'po_id' => $this->purchaseOrder->id,
                'po_number' => $this->purchaseOrder->po_number,
                'action' => $this->action,
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to send purchase order notification', [
                'user_id' => $this->user->id,
                'po_id' => $this->purchaseOrder->id,
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
        Log::error('Purchase order notification job failed', [
            'user_id' => $this->user->id,
            'po_id' => $this->purchaseOrder->id,
            'action' => $this->action,
            'error' => $exception->getMessage(),
        ]);
    }
}
