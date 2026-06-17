<?php

namespace Tests\Feature\Import;

use App\Models\PurchaseOrder;
use App\Models\Retailer;
use App\Models\User;
use Database\Seeders\BuySheetImportPermissionsSeeder;
use Database\Seeders\DefaultPermissionsSeeder;
use Database\Seeders\DefaultRolesSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Laravel\Sanctum\Sanctum;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use Tests\TestCase;

class BulkPoImportTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        // Same constraint as ImportEndpointsTest: a pre-existing migration is
        // SQLite-incompatible, so these run on MySQL/Postgres in CI.
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

    /** Build a small multi-PO WIP-style sheet and return it as an upload. */
    private function makeBulkSheet(): UploadedFile
    {
        $spreadsheet = new Spreadsheet();
        $sheet = $spreadsheet->getActiveSheet();

        $headers = [
            'S. NO #', 'PO', 'PO DATE', 'RETAILER / STORE NAME', 'LABEL',
            'STYLE # AS PER PO', 'COLOR', 'GRAPHIC DESCRIPTION', 'FINAL FABRIC',
            'BUYER PO PRICE DDP', 'TOTAL UNITS', 'S', 'M', 'L',
            'FACTORY NAME', 'FACTORY PRICE', 'ORIGINAL FACTORY DATE', 'TP STATUS',
        ];
        $sheet->fromArray($headers, null, 'A1');

        $rows = [
            [1, '5001', '2025-10-24', 'BURLINGTON', 'REBEL', 'RMT091', 'BLACK', 'FRENCH TERRY', 5.40, 1800, 600, 600, 600, 'ACME GARMENTS', 4.10, '2025-11-15', 'TP RECEIVED 10/31'],
            [2, '5001', '2025-10-24', 'BURLINGTON', 'REBEL', 'RMT093', 'CHARCOAL', 'TERRY', 5.20, 2400, 800, 800, 800, 'ACME GARMENTS', 4.05, '2025-11-20', 'TP RECEIVED 11/01'],
            [3, '5002', '2025-11-22', 'CITI TRENDS', 'SAINT', 'ST007X', 'RED', 'CVC TEE', 4.60, 1200, 400, 400, 400, 'PIONEER APPAREL', 3.80, '2025-12-10', 'SAMPLE SENT'],
        ];
        $sheet->fromArray($rows, null, 'A2');

        $tmp = tempnam(sys_get_temp_dir(), 'bulk_') . '.xlsx';
        (IOFactory::createWriter($spreadsheet, 'Xlsx'))->save($tmp);

        return new UploadedFile($tmp, 'bulk.xlsx', null, null, true);
    }

    public function test_analyze_detects_per_row_po_and_style_columns(): void
    {
        $this->actingAsAgency();
        // A pre-existing factory so the resolution block reports a match.
        $factory = User::factory()->create(['name' => 'ACME GARMENTS']);
        $factory->assignRole('Factory');

        $response = $this->post('/api/imports/bulk-po/analyze', [
            'file' => $this->makeBulkSheet(),
        ]);

        $response->assertOk()
            ->assertJson(['success' => true, 'header_row' => 1, 'total_data_rows' => 3]);

        $columns = collect($response->json('columns'));
        $targetFor = fn (string $name) => $columns->firstWhere('name', $name)['target'] ?? null;

        $this->assertSame('po_number', $targetFor('PO'));
        $this->assertSame('po_date', $targetFor('PO DATE'));
        $this->assertSame('retailer_name', $targetFor('RETAILER / STORE NAME'));
        $this->assertSame('style_number', $targetFor('STYLE # AS PER PO'));
        $this->assertSame('unit_price', $targetFor('BUYER PO PRICE DDP'));
        $this->assertSame('quantity', $targetFor('TOTAL UNITS'));
        $this->assertSame('size:S', $targetFor('S'));
        $this->assertSame('size:M', $targetFor('M'));
        // Factory columns are detected (not mis-mapped to unit_price / po_date / metadata).
        $this->assertSame('factory_name', $targetFor('FACTORY NAME'));
        $this->assertSame('factory_unit_price', $targetFor('FACTORY PRICE'));
        $this->assertSame('factory_date', $targetFor('ORIGINAL FACTORY DATE'));
        // An unrecognised WIP column is parked in metadata, never dropped.
        $this->assertSame('__metadata__', $targetFor('TP STATUS'));

        // Distinct retailer names are collected for the match-or-create step.
        $retailers = collect($response->json('retailers'));
        $this->assertEqualsCanonicalizing(['BURLINGTON', 'CITI TRENDS'], $retailers->pluck('name')->all());
        $burl = $retailers->firstWhere('name', 'BURLINGTON');
        $this->assertSame(2, $burl['style_count']);
        $this->assertSame(1, $burl['po_count']);

        // Distinct factory names are collected, with the existing one matched.
        $factories = collect($response->json('factories'));
        $this->assertEqualsCanonicalizing(['ACME GARMENTS', 'PIONEER APPAREL'], $factories->pluck('name')->all());
        $acme = $factories->firstWhere('name', 'ACME GARMENTS');
        $this->assertSame($factory->id, $acme['matched_factory_id']);
        $this->assertSame(2, $acme['style_count']);
        // A factory not in the system yet has no match (resolved via create on the client).
        $this->assertNull($factories->firstWhere('name', 'PIONEER APPAREL')['matched_factory_id']);
    }

    public function test_commit_creates_draft_pos_grouped_by_number(): void
    {
        $this->actingAsAgency();
        $retailer = Retailer::create(['name' => 'BURLINGTON', 'is_active' => true]);

        $response = $this->postJson('/api/imports/bulk-po/commit', [
            'options' => ['duplicate_strategy' => 'skip', 'default_shipping_term' => 'DDP'],
            'pos' => [
                [
                    'po_number' => '5001',
                    'po_date' => '2025-10-24',
                    'retailer_id' => $retailer->id,
                    'styles' => [
                        ['style_number' => 'RMT091', 'color_name' => 'BLACK', 'fabric' => '300 TERRY', 'quantity' => 1800, 'unit_price' => 5.40,
                         'size_breakdown' => ['S' => 600, 'M' => 600, 'L' => 600],
                         'metadata' => ['tp_status' => 'TP RECEIVED 10/31'],
                         // Only the import-dir path should persist; the traversal attempt is dropped.
                         'images' => ['imports/images/cad1.png', '../../etc/passwd']],
                        ['style_number' => 'RMT093', 'color_name' => 'CHARCOAL', 'quantity' => 2400, 'unit_price' => 5.20],
                    ],
                ],
                [
                    'po_number' => '5002',
                    'po_date' => '2025-11-22',
                    'styles' => [
                        ['style_number' => 'ST007X', 'color_name' => 'RED', 'quantity' => 1200, 'unit_price' => 4.60],
                    ],
                ],
            ],
        ]);

        $response->assertCreated()->assertJson([
            'summary' => ['pos_created' => 2, 'pos_skipped' => 0, 'styles_created' => 3],
        ]);

        $po = PurchaseOrder::where('po_number', '5001')->first();
        $this->assertNotNull($po);
        $this->assertSame('draft', $po->status);
        $this->assertSame('DDP', $po->shipping_term);
        $this->assertSame(4200, (int) $po->total_quantity); // 1800 + 2400
        $this->assertSame(2, (int) $po->total_styles);
        // Retailer used as resolved; buyer derived (find-or-create) from its name.
        $this->assertSame($retailer->id, (int) $po->retailer_id);
        $this->assertNotNull($po->buyer_id);
        $this->assertDatabaseHas('buyers', ['name' => 'BURLINGTON']);
        $this->assertSame((int) $po->buyer_id, (int) \App\Models\Buyer::where('name', 'BURLINGTON')->value('id'));
        // Per-row WIP columns preserved losslessly on the pivot.
        $style = $po->styles()->where('style_number', 'RMT091')->first();
        $this->assertSame('TP RECEIVED 10/31', $style->pivot->metadata['tp_status'] ?? null);
        // Excel image carried onto the style; path-traversal entry sanitised out.
        $this->assertSame(['imports/images/cad1.png'], $style->images);
        // Fabric populates the display column (fabric_type_name), not just `fabric`.
        $this->assertSame('300 TERRY', $style->fabric);
        $this->assertSame('300 TERRY', $style->fabric_type_name);
    }

    public function test_commit_skips_existing_po_numbers(): void
    {
        $user = $this->actingAsAgency();
        PurchaseOrder::create(['po_number' => '5001', 'po_date' => '2025-01-01', 'status' => 'draft', 'creator_id' => $user->id]);

        $response = $this->postJson('/api/imports/bulk-po/commit', [
            'options' => ['duplicate_strategy' => 'skip'],
            'pos' => [
                ['po_number' => '5001', 'po_date' => '2025-12-01', 'styles' => [['style_number' => 'X1', 'quantity' => 10, 'unit_price' => 1]]],
                ['po_number' => '5003', 'po_date' => '2025-12-01', 'styles' => [['style_number' => 'X2', 'quantity' => 20, 'unit_price' => 2]]],
            ],
        ]);

        $response->assertCreated()->assertJson([
            'summary' => ['pos_created' => 1, 'pos_skipped' => 1],
        ]);
        $this->assertSame(1, PurchaseOrder::where('po_number', '5001')->count());
        $this->assertTrue(PurchaseOrder::where('po_number', '5003')->exists());
    }

    private function existingPoWithStyle(): PurchaseOrder
    {
        $user = $this->actingAsAgency();
        $po = PurchaseOrder::create(['po_number' => '5001', 'po_date' => '2025-01-01', 'status' => 'draft', 'creator_id' => $user->id]);
        $style = \App\Models\Style::create(['style_number' => 'KEEP1', 'total_quantity' => 5, 'unit_price' => 1, 'created_by' => $user->id, 'is_active' => true]);
        $po->styles()->attach($style->id, ['quantity_in_po' => 5, 'unit_price_in_po' => 1, 'status' => 'pending']);
        return $po;
    }

    public function test_commit_append_adds_new_styles_and_leaves_existing_untouched(): void
    {
        $existing = $this->existingPoWithStyle();

        $this->postJson('/api/imports/bulk-po/commit', [
            'options' => ['duplicate_strategy' => 'append'],
            'pos' => [
                ['po_number' => '5001', 'po_date' => '2025-12-01', 'styles' => [
                    ['style_number' => 'KEEP1', 'quantity' => 999, 'unit_price' => 9], // already present -> left as-is
                    ['style_number' => 'NEW1', 'quantity' => 30, 'unit_price' => 3],   // appended
                ]],
            ],
        ])->assertCreated()->assertJson(['summary' => ['pos_updated' => 1, 'pos_created' => 0]]);

        $existing->refresh();
        $this->assertSame(2, (int) $existing->total_styles);
        $this->assertTrue($existing->styles()->where('style_number', 'NEW1')->exists());
        // Existing style's PO quantity is unchanged on append.
        $this->assertSame(5, (int) $existing->styles()->where('style_number', 'KEEP1')->first()->pivot->quantity_in_po);
    }

    public function test_commit_update_refreshes_existing_styles_and_appends_new(): void
    {
        $existing = $this->existingPoWithStyle();

        $this->postJson('/api/imports/bulk-po/commit', [
            'options' => ['duplicate_strategy' => 'update'],
            'pos' => [
                ['po_number' => '5001', 'po_date' => '2025-12-01', 'styles' => [
                    ['style_number' => 'KEEP1', 'quantity' => 999, 'unit_price' => 9], // refreshed
                    ['style_number' => 'NEW1', 'quantity' => 30, 'unit_price' => 3],   // appended
                ]],
            ],
        ])->assertCreated()->assertJson(['summary' => ['pos_updated' => 1, 'pos_created' => 0, 'styles_refreshed' => 1]]);

        $existing->refresh();
        $this->assertSame(2, (int) $existing->total_styles);
        $this->assertTrue($existing->styles()->where('style_number', 'NEW1')->exists());
        // Existing style's PO quantity/price refreshed from the sheet.
        $pivot = $existing->styles()->where('style_number', 'KEEP1')->first()->pivot;
        $this->assertSame(999, (int) $pivot->quantity_in_po);
        $this->assertSame('9.00', (string) $pivot->unit_price_in_po);
    }

    public function test_commit_rejects_invalid_fields(): void
    {
        $this->actingAsAgency();

        $response = $this->postJson('/api/imports/bulk-po/commit', [
            'pos' => [
                [
                    'po_number' => '6001',
                    'po_date' => 'MAIL RECD 12/21', // not a real date
                    'styles' => [
                        ['style_number' => 'A1', 'quantity' => 0, 'unit_price' => 5],        // qty must be >= 1
                        ['style_number' => 'A2', 'quantity' => 10, 'unit_price' => 'abc'],    // price not numeric
                        ['style_number' => str_repeat('X', 150), 'quantity' => 5, 'unit_price' => 1], // style # > 100
                    ],
                ],
            ],
        ]);

        $response->assertStatus(422);
        $errors = $response->json('errors');
        $this->assertArrayHasKey('pos.0.po_date', $errors);
        $this->assertArrayHasKey('pos.0.styles.0.quantity', $errors);
        $this->assertArrayHasKey('pos.0.styles.1.unit_price', $errors);
        $this->assertArrayHasKey('pos.0.styles.2.style_number', $errors);
        // Nothing is persisted when validation fails.
        $this->assertSame(0, PurchaseOrder::where('po_number', '6001')->count());
    }

    public function test_commit_assigns_factory_with_price_and_date(): void
    {
        $this->actingAsAgency();
        $factory = User::factory()->create(['name' => 'ACME GARMENTS']);
        $factory->assignRole('Factory');

        $this->postJson('/api/imports/bulk-po/commit', [
            'options' => ['duplicate_strategy' => 'skip'],
            'pos' => [
                ['po_number' => '7001', 'po_date' => '2025-10-24', 'styles' => [
                    ['style_number' => 'F1', 'quantity' => 100, 'unit_price' => 5,
                     'factory_id' => $factory->id, 'factory_unit_price' => 4.10, 'factory_date' => '2025-11-15'],
                ]],
            ],
        ])->assertCreated();

        $po = PurchaseOrder::where('po_number', '7001')->first();
        $style = $po->styles()->where('style_number', 'F1')->first();

        // Pivot is the single source of truth for the PO-style assignment.
        $this->assertSame($factory->id, (int) $style->pivot->assigned_factory_id);
        $this->assertSame('direct_to_factory', $style->pivot->assignment_type);
        $this->assertSame('4.10', (string) $style->pivot->factory_unit_price);
        $this->assertSame('2025-11-15', $style->pivot->factory_ex_factory_date->format('Y-m-d'));
        // Style model mirrors the assignment, and a FactoryAssignment record is created.
        $this->assertSame($factory->id, (int) $style->assigned_factory_id);
        $this->assertDatabaseHas('factory_assignments', [
            'purchase_order_id' => $po->id,
            'style_id' => $style->id,
            'factory_id' => $factory->id,
            'status' => 'accepted',
            'assignment_type' => 'direct_to_factory',
        ]);
    }

    public function test_commit_ignores_factory_id_that_is_not_a_factory(): void
    {
        $user = $this->actingAsAgency(); // Agency role - not a Factory.

        $this->postJson('/api/imports/bulk-po/commit', [
            'options' => ['duplicate_strategy' => 'skip'],
            'pos' => [
                ['po_number' => '7002', 'po_date' => '2025-10-24', 'styles' => [
                    ['style_number' => 'F2', 'quantity' => 10, 'unit_price' => 1,
                     'factory_id' => $user->id, 'factory_unit_price' => 2.50],
                ]],
            ],
        ])->assertCreated();

        $po = PurchaseOrder::where('po_number', '7002')->first();
        $style = $po->styles()->where('style_number', 'F2')->first();
        // A non-factory id is never trusted as an assignment...
        $this->assertNull($style->pivot->assigned_factory_id);
        $this->assertDatabaseMissing('factory_assignments', ['purchase_order_id' => $po->id]);
        // ...but the (column-independent) factory price is still preserved.
        $this->assertSame('2.50', (string) $style->pivot->factory_unit_price);
    }

    public function test_create_placeholder_factory_creates_inactive_factory_user(): void
    {
        $this->actingAsAgency();

        $response = $this->postJson('/api/imports/bulk-po/factories', ['name' => 'NEW FACTORY CO']);
        $response->assertCreated()->assertJsonStructure(['id', 'name']);

        $id = $response->json('id');
        $created = User::find($id);
        $this->assertNotNull($created);
        $this->assertSame('NEW FACTORY CO', $created->name);
        $this->assertSame('inactive', $created->status);
        $this->assertTrue($created->hasRole('Factory'));

        // Creating the same name again re-matches rather than duplicating.
        $again = $this->postJson('/api/imports/bulk-po/factories', ['name' => 'NEW FACTORY CO']);
        $again->assertCreated();
        $this->assertSame($id, $again->json('id'));
        $this->assertSame(1, User::where('name', 'NEW FACTORY CO')->count());
    }

    public function test_bulk_analyze_requires_permission(): void
    {
        $viewer = User::factory()->create();
        $viewer->assignRole('Viewer');
        Sanctum::actingAs($viewer);

        $this->post('/api/imports/bulk-po/analyze', ['file' => $this->makeBulkSheet()])
            ->assertForbidden();
    }
}
