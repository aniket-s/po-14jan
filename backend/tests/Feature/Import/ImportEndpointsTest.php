<?php

namespace Tests\Feature\Import;

use App\Models\BuySheet;
use App\Models\Buyer;
use App\Models\User;
use Database\Seeders\BuySheetImportPermissionsSeeder;
use Database\Seeders\DefaultPermissionsSeeder;
use Database\Seeders\DefaultRolesSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class ImportEndpointsTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        // A pre-existing migration (2026_01_21_100005_update_trims_multiselect_remove_filepath)
        // uses dropColumn on a rename-migrated column, which SQLite's in-memory
        // driver rejects due to index state. Skip against SQLite so CI (MySQL/Postgres)
        // can still exercise these endpoints without blocking local runs.
        if (($_ENV['DB_CONNECTION'] ?? getenv('DB_CONNECTION')) === 'sqlite') {
            $this->markTestSkipped('Feature tests require MySQL/Postgres; pre-existing migration is SQLite-incompatible.');
        }

        parent::setUp();

        $this->seed(DefaultPermissionsSeeder::class);
        $this->seed(DefaultRolesSeeder::class);
        $this->seed(BuySheetImportPermissionsSeeder::class);
    }

    private function actingAsAgency(): User
    {
        $user = User::factory()->create();
        $user->assignRole('Agency');
        Sanctum::actingAs($user);
        return $user;
    }

    private function actingAsViewer(): User
    {
        $user = User::factory()->create();
        $user->assignRole('Viewer');
        Sanctum::actingAs($user);
        return $user;
    }

    public function test_strategies_endpoint_returns_all_registered_strategies(): void
    {
        $this->actingAsAgency();

        $response = $this->getJson('/api/imports/strategies');

        $response->assertOk()
            ->assertJsonStructure(['strategies' => [['key', 'label', 'buyer_code', 'format', 'document_kind', 'supports_buy_sheet', 'date_policy']]]);

        $keys = collect($response->json('strategies'))->pluck('key')->all();
        $this->assertContains('sci.pdf.po', $keys);
        $this->assertContains('sci.excel.buy_sheet', $keys);
        $this->assertContains('massive.excel.ddp.po', $keys);
        $this->assertContains('massive.excel.fob.po', $keys);
        $this->assertContains('rebel_minds.pdf.po', $keys);
    }

    public function test_buy_sheets_list_endpoint_filters_by_buyer(): void
    {
        $this->actingAsAgency();

        $buyerA = Buyer::create(['name' => 'Buyer A', 'code' => 'A', 'is_active' => true]);
        $buyerB = Buyer::create(['name' => 'Buyer B', 'code' => 'B', 'is_active' => true]);

        BuySheet::create(['buy_sheet_number' => '100', 'buyer_id' => $buyerA->id, 'name' => 'Sheet A']);
        BuySheet::create(['buy_sheet_number' => '200', 'buyer_id' => $buyerB->id, 'name' => 'Sheet B']);

        $response = $this->getJson("/api/imports/buy-sheets?buyer_id={$buyerA->id}");

        $response->assertOk();
        $numbers = collect($response->json('buy_sheets'))->pluck('buy_sheet_number')->all();
        $this->assertSame(['100'], $numbers);
    }

    public function test_commit_buy_sheet_creates_record(): void
    {
        $user = $this->actingAsAgency();
        $buyer = Buyer::create(['name' => 'Sports Casual International', 'code' => 'SCI', 'is_active' => true]);

        $response = $this->postJson('/api/imports/commit', [
            'kind' => 'buy_sheet',
            'strategy_key' => 'sci.excel.buy_sheet',
            'header' => [
                'buyer_id' => $buyer->id,
                'buy_sheet_number' => '128',
                'name' => 'CITI TRENDS TOPS',
                'date_submitted' => '2026-04-09',
                'tickets_required' => true,
                'buyer_approvals_required' => true,
            ],
            'styles' => [
                ['style_number' => 'STF337', 'description' => 'VINTAGE WASH', 'color_name' => 'VINTAGE GREY', 'quantity' => 1200, 'unit_price' => 5.20],
                ['style_number' => 'STF328', 'description' => '2FER', 'color_name' => 'VINTAGE CHARCOAL', 'quantity' => 1200, 'unit_price' => 5.20],
            ],
        ]);

        $response->assertCreated()
            ->assertJson(['success' => true, 'kind' => 'buy_sheet']);

        $this->assertDatabaseHas('buy_sheets', [
            'buy_sheet_number' => '128',
            'buyer_id' => $buyer->id,
            'total_styles' => 2,
            'total_quantity' => 2400,
        ]);
    }

    public function test_buy_sheet_endpoints_require_permission(): void
    {
        // Viewer role has no buy_sheet.view - list endpoint should 403
        $this->actingAsViewer();
        $this->getJson('/api/buy-sheets')->assertForbidden();
    }

    public function test_commit_po_rejects_missing_required_fields(): void
    {
        $this->actingAsAgency();
        $response = $this->postJson('/api/imports/commit', [
            'kind' => 'po',
            'strategy_key' => 'sci.pdf.po',
            'header' => [], // missing po_number, po_date
            'styles' => [],
        ]);
        $response->assertStatus(422);
    }

    public function test_analyze_rejects_wrong_format_for_strategy(): void
    {
        $this->actingAsAgency();
        $buyer = Buyer::create(['name' => 'SCI', 'code' => 'SCI', 'is_active' => true]);

        // sci.pdf.po expects PDF, send an xlsx instead
        $response = $this->postJson('/api/imports/analyze', [
            'strategy_key' => 'sci.pdf.po',
            'buyer_id' => $buyer->id,
            'file' => \Illuminate\Http\UploadedFile::fake()->create('sheet.xlsx', 10, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
        ]);
        $response->assertStatus(422)->assertJson(['message' => 'This strategy expects a PDF file.']);
    }
}
