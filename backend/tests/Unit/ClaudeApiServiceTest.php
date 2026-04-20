<?php

namespace Tests\Unit;

use App\Services\ClaudeApiService;
use Tests\TestCase;

/**
 * Guards against a regression where the service's typed string properties
 * would crash on null `config()` values when the env var is unset.
 */
class ClaudeApiServiceTest extends TestCase
{
    public function test_service_constructs_when_api_key_is_null(): void
    {
        config(['services.anthropic.api_key' => null]);
        $svc = new ClaudeApiService();
        $this->assertFalse($svc->isConfigured(), 'null key should mean not configured');
    }

    public function test_service_constructs_when_api_key_is_empty_string(): void
    {
        config(['services.anthropic.api_key' => '']);
        $svc = new ClaudeApiService();
        $this->assertFalse($svc->isConfigured());
    }

    public function test_service_is_configured_when_key_present(): void
    {
        config(['services.anthropic.api_key' => 'sk-ant-test']);
        $svc = new ClaudeApiService();
        $this->assertTrue($svc->isConfigured());
    }
}
