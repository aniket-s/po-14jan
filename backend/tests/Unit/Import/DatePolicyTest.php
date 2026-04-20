<?php

namespace Tests\Unit\Import;

use App\Services\Import\Policies\DdpDatePolicy;
use App\Services\Import\Policies\FobDatePolicy;
use App\Services\Import\Policies\MassiveFobDatePolicy;
use App\Services\Import\Policies\NoDatesPolicy;
use PHPUnit\Framework\TestCase;

/**
 * Pure-PHP unit tests for the date policies. No database, no container —
 * the policies are data transformations and should be cheap to exercise.
 */
class DatePolicyTest extends TestCase
{
    private function wrapped(?string $value): array
    {
        return ['value' => $value, 'status' => $value ? 'parsed' : 'missing', 'raw_text' => $value, 'confidence' => 'high'];
    }

    public function test_fob_policy_cascades_from_etd(): void
    {
        $policy = new FobDatePolicy();
        $header = ['etd_date' => $this->wrapped('2026-08-01')];

        $result = $policy->apply($header, 20);

        $this->assertSame('2026-07-25', $result['ex_factory_date']['value'], 'Ex-Factory = ETD - 7d');
        $this->assertSame('2026-08-21', $result['eta_date']['value'], 'ETA = ETD + sailing');
        $this->assertSame('2026-08-26', $result['in_warehouse_date']['value'], 'IHD = ETA + 5d');
    }

    public function test_fob_policy_is_noop_without_etd(): void
    {
        $policy = new FobDatePolicy();
        $result = $policy->apply([], 20);
        $this->assertArrayNotHasKey('ex_factory_date', $result);
    }

    public function test_fob_policy_does_not_overwrite_existing_dates(): void
    {
        $policy = new FobDatePolicy();
        $header = [
            'etd_date' => $this->wrapped('2026-08-01'),
            'ex_factory_date' => $this->wrapped('2026-07-10'), // user-provided
        ];
        $result = $policy->apply($header, 20);
        $this->assertSame('2026-07-10', $result['ex_factory_date']['value']);
    }

    public function test_ddp_policy_cascades_from_ihd(): void
    {
        $policy = new DdpDatePolicy();
        $header = ['in_warehouse_date' => $this->wrapped('2026-09-01')];

        $result = $policy->apply($header, 20);

        $this->assertSame('2026-08-27', $result['eta_date']['value'], 'ETA = IHD - 5d');
        $this->assertSame('2026-08-07', $result['etd_date']['value'], 'ETD = ETA - sailing');
        $this->assertSame('2026-07-31', $result['ex_factory_date']['value'], 'Ex-Factory = ETD - 7d');
    }

    public function test_massive_fob_policy_derives_ex_factory_only(): void
    {
        $policy = new MassiveFobDatePolicy();
        $header = ['fob_date' => $this->wrapped('2026-07-15')];

        $result = $policy->apply($header, 20);

        $this->assertSame('2026-06-30', $result['ex_factory_date']['value'], 'Ex-Factory = FOB - 15d');
        // Must NOT fill etd/eta/in_warehouse
        $this->assertArrayNotHasKey('etd_date', $result);
        $this->assertArrayNotHasKey('eta_date', $result);
        $this->assertArrayNotHasKey('in_warehouse_date', $result);
    }

    public function test_no_dates_policy_returns_header_unchanged(): void
    {
        $header = ['etd_date' => $this->wrapped('2026-08-01')];
        $this->assertSame($header, (new NoDatesPolicy())->apply($header, 20));
    }

    public function test_policy_keys_are_unique(): void
    {
        $keys = [
            (new FobDatePolicy())->key(),
            (new DdpDatePolicy())->key(),
            (new MassiveFobDatePolicy())->key(),
            (new NoDatesPolicy())->key(),
        ];
        $this->assertSame($keys, array_unique($keys), 'Policy keys collide');
    }
}
