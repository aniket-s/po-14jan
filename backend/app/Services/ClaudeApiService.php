<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class ClaudeApiService
{
    private string $apiKey;
    private string $model;
    private int $maxTokens;
    private string $apiUrl;

    public function __construct()
    {
        // config() returns null when the underlying env var is unset, which would
        // blow up the typed string property. Coerce so the service is safely
        // constructible in environments where the key isn't configured; callers
        // should gate actual API calls on isConfigured().
        $this->apiKey = (string) (config('services.anthropic.api_key') ?? '');
        $this->model = (string) (config('services.anthropic.model') ?? 'claude-haiku-4-5-20251001');
        $this->maxTokens = (int) (config('services.anthropic.max_tokens') ?? 8192);
        $this->apiUrl = (string) (config('services.anthropic.api_url') ?? 'https://api.anthropic.com/v1/messages');
    }

    /**
     * Send a PDF document to Claude for analysis and return the response.
     *
     * @param string $pdfBase64 Base64-encoded PDF data
     * @param string $prompt The extraction prompt
     * @return array{success: bool, content: ?string, usage: ?array, error: ?string}
     */
    public function analyzePdf(string $pdfBase64, string $prompt): array
    {
        if (empty($this->apiKey)) {
            return [
                'success' => false,
                'content' => null,
                'usage' => null,
                'error' => 'Anthropic API key is not configured. Set ANTHROPIC_API_KEY in your .env file.',
            ];
        }

        $payload = [
            'model' => $this->model,
            'max_tokens' => $this->maxTokens,
            'messages' => [
                [
                    'role' => 'user',
                    'content' => [
                        [
                            'type' => 'document',
                            'source' => [
                                'type' => 'base64',
                                'media_type' => 'application/pdf',
                                'data' => $pdfBase64,
                            ],
                        ],
                        [
                            'type' => 'text',
                            'text' => $prompt,
                        ],
                    ],
                ],
            ],
        ];

        // Retry with exponential backoff (up to 3 attempts)
        $maxAttempts = 3;
        $lastError = null;

        for ($attempt = 1; $attempt <= $maxAttempts; $attempt++) {
            try {
                $response = Http::withHeaders([
                    'x-api-key' => $this->apiKey,
                    'anthropic-version' => '2023-06-01',
                    'content-type' => 'application/json',
                ])->timeout(120)->post($this->apiUrl, $payload);

                if ($response->successful()) {
                    $body = $response->json();
                    $textContent = $this->extractTextContent($body);
                    $stopReason = $body['stop_reason'] ?? null;

                    if ($stopReason === 'max_tokens') {
                        Log::warning('Claude API response truncated due to max_tokens limit', [
                            'max_tokens' => $this->maxTokens,
                        ]);
                    }

                    return [
                        'success' => true,
                        'content' => $textContent,
                        'usage' => $body['usage'] ?? null,
                        'error' => null,
                        'stop_reason' => $stopReason,
                    ];
                }

                $lastError = $response->json('error.message') ?? $response->body();

                // Don't retry on client errors (4xx) except 429 (rate limit)
                if ($response->status() >= 400 && $response->status() < 500 && $response->status() !== 429) {
                    break;
                }

                Log::warning("Claude API attempt {$attempt} failed with status {$response->status()}", [
                    'error' => $lastError,
                ]);
            } catch (\Exception $e) {
                $lastError = $e->getMessage();
                Log::warning("Claude API attempt {$attempt} exception: {$lastError}");
            }

            if ($attempt < $maxAttempts) {
                $delay = pow(2, $attempt); // 2s, 4s
                sleep($delay);
            }
        }

        Log::error('Claude API failed after all attempts', ['error' => $lastError]);

        return [
            'success' => false,
            'content' => null,
            'usage' => null,
            'error' => 'Claude API request failed: ' . ($lastError ?? 'Unknown error'),
        ];
    }

    /**
     * Extract text content from Claude API response body.
     */
    private function extractTextContent(array $body): ?string
    {
        $content = $body['content'] ?? [];

        foreach ($content as $block) {
            if (($block['type'] ?? '') === 'text') {
                return $block['text'] ?? null;
            }
        }

        return null;
    }

    /**
     * Check if the Claude API is configured and available.
     */
    public function isConfigured(): bool
    {
        return !empty($this->apiKey);
    }
}
