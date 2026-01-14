<?php

namespace App\Jobs;

use App\Models\Sample;
use App\Models\User;
use App\Notifications\SampleNotification;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class SendSampleNotification implements ShouldQueue
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
        public Sample $sample,
        public User $user,
        public string $action, // submitted, approved, rejected, revision_requested
        public ?string $comments = null
    ) {
        //
    }

    /**
     * Execute the job.
     */
    public function handle(): void
    {
        try {
            $this->user->notify(new SampleNotification(
                $this->sample,
                $this->action,
                $this->comments
            ));

            Log::info('Sample notification sent', [
                'user_id' => $this->user->id,
                'sample_id' => $this->sample->id,
                'action' => $this->action,
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to send sample notification', [
                'user_id' => $this->user->id,
                'sample_id' => $this->sample->id,
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
        Log::error('Sample notification job failed', [
            'user_id' => $this->user->id,
            'sample_id' => $this->sample->id,
            'action' => $this->action,
            'error' => $exception->getMessage(),
        ]);
    }
}
