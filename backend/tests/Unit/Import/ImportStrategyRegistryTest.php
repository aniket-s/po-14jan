<?php

namespace Tests\Unit\Import;

use App\Services\Import\Registry\ImportStrategyRegistry;
use Tests\TestCase;

/**
 * Laravel-aware test - the registry depends on strategies that depend on
 * services (ClaudeApiService, ExcelImageExtractionService) which need the
 * application container to resolve.
 */
class ImportStrategyRegistryTest extends TestCase
{
    public function test_all_expected_strategies_are_registered(): void
    {
        /** @var ImportStrategyRegistry $r */
        $r = app(ImportStrategyRegistry::class);
        $keys = array_map(fn($s) => $s->key(), $r->all());

        $this->assertContains('sci.pdf.po', $keys);
        $this->assertContains('sci.excel.buy_sheet', $keys);
        $this->assertContains('massive.excel.ddp.po', $keys);
        $this->assertContains('massive.excel.fob.po', $keys);
        $this->assertContains('rebel_minds.pdf.po', $keys);
    }

    public function test_strategy_keys_are_unique(): void
    {
        $r = app(ImportStrategyRegistry::class);
        $keys = array_map(fn($s) => $s->key(), $r->all());
        $this->assertSame($keys, array_unique($keys));
    }

    public function test_describe_returns_frontend_shape(): void
    {
        $r = app(ImportStrategyRegistry::class);
        $first = $r->describe()[0];
        foreach (['key', 'label', 'buyer_code', 'format', 'document_kind', 'supports_buy_sheet', 'date_policy'] as $field) {
            $this->assertArrayHasKey($field, $first, "Missing $field in descriptor");
        }
    }

    public function test_sci_excel_buy_sheet_uses_no_dates_policy(): void
    {
        $r = app(ImportStrategyRegistry::class);
        $s = $r->getOrFail('sci.excel.buy_sheet');
        $this->assertSame('none', $s->datePolicy()->key());
        $this->assertSame('buy_sheet', $s->documentKind());
    }

    public function test_massive_fob_uses_massive_fob_policy(): void
    {
        $r = app(ImportStrategyRegistry::class);
        $s = $r->getOrFail('massive.excel.fob.po');
        $this->assertSame('massive_fob', $s->datePolicy()->key());
    }

    public function test_get_fails_for_unknown_key(): void
    {
        $r = app(ImportStrategyRegistry::class);
        $this->assertNull($r->get('does.not.exist'));
        $this->expectException(\InvalidArgumentException::class);
        $r->getOrFail('does.not.exist');
    }
}
