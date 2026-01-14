<?php

namespace App\Jobs;

use App\Models\User;
use App\Notifications\GenericEmailNotification;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

class SendEmailNotification implements ShouldQueue
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
        public User $user,
        public string $subject,
        public string $message,
        public array $data = [],
        public ?string $template = null
    ) {
        //
    }

    /**
     * Execute the job.
     */
    public function handle(): void
    {
        try {
            $this->user->notify(new GenericEmailNotification(
                $this->subject,
                $this->message,
                $this->data,
                $this->template
            ));

            Log::info('Email notification sent', [
                'user_id' => $this->user->id,
                'subject' => $this->subject,
                'template' => $this->template,
            ]);
        } catch (\Exception $e) {
            Log::error('Failed to send email notification', [
                'user_id' => $this->user->id,
                'subject' => $this->subject,
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
        Log::error('Email notification job failed', [
            'user_id' => $this->user->id,
            'subject' => $this->subject,
            'error' => $exception->getMessage(),
        ]);
    }
}
