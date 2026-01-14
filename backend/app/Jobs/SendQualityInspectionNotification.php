<?php

namespace App\Jobs;

use App\Models\QualityInspection;
use App\Models\User;
use App\Notifications\QualityInspectionNotification;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class SendQualityInspectionNotification implements ShouldQueue
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
