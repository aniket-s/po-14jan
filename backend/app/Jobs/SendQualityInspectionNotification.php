<?php

namespace App\Jobs;

use App\Models\QualityInspection;
use App\Models\User;
use App\Notifications\QualityInspectionNotification;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Support\Facades\Log;

class SendQualityInspectionNotification
{
    use Dispatchable;

    /**
     * Create a new job instance.
     */
    public function __construct(
        public QualityInspection $inspection,
        public User $user,
        public string $action // created, completed, failed
    ) {
        //
    }

    /**
     * Execute the job.
     */
    public function handle(): void
    {
        try {
            $this->user->notify(new QualityInspectionNotification(
                $this->inspection,
                $this->action
            ));

            Log::info('Quality inspection notification sent', [
                'user_id' => $this->user->id,
                'inspection_id' => $this->inspection->id,
                'action' => $this->action,
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to send quality inspection notification', [
                'user_id' => $this->user->id,
                'inspection_id' => $this->inspection->id,
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
        Log::error('Quality inspection notification job failed', [
            'user_id' => $this->user->id,
            'inspection_id' => $this->inspection->id,
            'action' => $this->action,
            'error' => $exception->getMessage(),
        ]);
    }
}
