<?php

namespace Tests\Unit\Import;

use App\Services\Import\DTO\ParsedDocument;
use PHPUnit\Framework\TestCase;

class ParsedDocumentTest extends TestCase
{
    public function test_defaults_are_success_and_po(): void
    {
        $doc = new ParsedDocument();
        $this->assertTrue($doc->success);
        $this->assertSame(ParsedDocument::KIND_PO, $doc->kind);
        $this->assertSame([], $doc->warnings);
        $this->assertSame([], $doc->errors);
        $this->assertSame(['total_quantity' => 0, 'total_value' => 0], $doc->totals);
    }

    public function test_failure_factory(): void
    {
        $doc = ParsedDocument::failure('sci.pdf.po', 'boom');
        $this->assertFalse($doc->success);
        $this->assertSame('sci.pdf.po', $doc->strategyKey);
        $this->assertSame(['boom'], $doc->errors);
    }

    public function test_to_array_contains_expected_keys(): void
    {
        $doc = new ParsedDocument();
        $doc->strategyKey = 'sci.pdf.po';
        $arr = $doc->toArray();
        $this->assertArrayHasKey('po_header', $arr);
        $this->assertArrayHasKey('styles', $arr);
        $this->assertArrayHasKey('totals', $arr);
        $this->assertArrayHasKey('strategy_key', $arr);
        $this->assertSame('sci.pdf.po', $arr['strategy_key']);
    }
}
