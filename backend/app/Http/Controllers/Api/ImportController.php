<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Jobs\SendPurchaseOrderNotification;
use App\Models\BuySheet;
use App\Models\PurchaseOrder;
use App\Models\Style;
use App\Services\ActivityLogService;
use App\Services\Import\DTO\ParsedDocument;
use App\Services\Import\Registry\ImportStrategyRegistry;
use App\Services\TNAChartService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;

/**
 * Unified import endpoint that dispatches to the right strategy and commits
 * the result as either a PurchaseOrder or a BuySheet.
 *
 * Legacy /purchase-orders/pdf-import/* routes still work - they go through
 * PdfImportController unchanged. New flows use this controller.
 */
class ImportController extends Controller
{
    public function __construct(
        protected ImportStrategyRegistry $registry,
        protected ActivityLogService $activityLog,
    ) {}

    /** GET /api/imports/strategies */
    public function strategies(): JsonResponse
    {
        return response()->json(['strategies' => $this->registry->describe()]);
    }

    /** GET /api/imports/buy-sheets?buyer_id=&search= */
    public function buySheets(Request $request): JsonResponse
    {
        $query = BuySheet::with(['buyer:id,name,code', 'retailer:id,name'])
            ->whereIn('status', [BuySheet::STATUS_OPEN, BuySheet::STATUS_PO_ISSUED])
            ->orderByDesc('created_at');

        if ($request->filled('buyer_id')) {
            $query->where('buyer_id', (int) $request->buyer_id);
        }
        if ($request->filled('search')) {
            $s = $request->string('search');
            $query->where(function ($q) use ($s) {
                $q->where('buy_sheet_number', 'LIKE', "%{$s}%")
                    ->orWhere('name', 'LIKE', "%{$s}%");
            });
        }

        return response()->json([
            'buy_sheets' => $query->limit(100)->get(),
        ]);
    }

    /**
     * POST /api/imports/analyze
     *   multipart: strategy_key, buyer_id?, buy_sheet_id?, file
     */
    public function analyze(Request $request): JsonResponse
    {
        $v = Validator::make($request->all(), [
            'strategy_key' => 'required|string',
            'buyer_id' => 'nullable|exists:buyers,id',
            'buy_sheet_id' => 'nullable|exists:buy_sheets,id',
            'file' => 'required|file|max:20480',
        ]);
        if ($v->fails()) {
            return response()->json(['message' => 'Validation failed', 'errors' => $v->errors()], 422);
        }

        $strategy = $this->registry->get($request->input('strategy_key'));
        if (!$strategy) {
            return response()->json(['message' => 'Unknown import strategy'], 422);
        }

        $file = $request->file('file');
        $ext = strtolower($file->getClientOriginalExtension());
        $expectedFormat = $strategy->format();
        if ($expectedFormat === 'pdf' && $ext !== 'pdf') {
            return response()->json(['message' => 'This strategy expects a PDF file.'], 422);
        }
        if ($expectedFormat === 'excel' && !in_array($ext, ['xlsx', 'xls', 'csv'])) {
            return response()->json(['message' => 'This strategy expects an Excel/CSV file.'], 422);
        }

        $tempPath = $file->store('temp/imports');
        $fullPath = Storage::disk('local')->path($tempPath);

        $ctx = [
            'buyer_id' => $request->input('buyer_id'),
            'buy_sheet_id' => $request->input('buy_sheet_id'),
        ];

        $doc = $strategy->analyze($fullPath, $ctx);

        if (!$doc->success) {
            Storage::disk('local')->delete($tempPath);
            return response()->json([
                'message' => $doc->errors[0] ?? 'Analysis failed.',
                'errors' => $doc->errors,
            ], 422);
        }

        return response()->json(array_merge($doc->toArray(), [
            'temp_file_path' => $tempPath,
            'strategy' => [
                'key' => $strategy->key(),
                'label' => $strategy->label(),
                'buyer_code' => $strategy->buyerCode(),
                'format' => $strategy->format(),
                'document_kind' => $strategy->documentKind(),
                'date_policy' => $strategy->datePolicy()->key(),
            ],
        ]));
    }

    /**
     * POST /api/imports/commit
     * Creates either a PurchaseOrder or a BuySheet depending on kind.
     */
    public function commit(Request $request): JsonResponse
    {
        $kind = $request->input('kind');
        if ($kind === ParsedDocument::KIND_BUY_SHEET) {
            return $this->commitBuySheet($request);
        }
        return $this->commitPurchaseOrder($request);
    }

    private function commitBuySheet(Request $request): JsonResponse
    {
        $v = Validator::make($request->all(), [
            'strategy_key' => 'required|string',
            'header.buyer_id' => 'required|exists:buyers,id',
            'header.buy_sheet_number' => 'required|string|max:50',
            'header.name' => 'nullable|string|max:255',
            'header.retailer_id' => 'nullable|exists:retailers,id',
            'header.season_id' => 'nullable|exists:seasons,id',
            'header.date_submitted' => 'nullable|date',
            'header.tickets_required' => 'nullable|boolean',
            'header.buyer_approvals_required' => 'nullable|boolean',
            'styles' => 'required|array|min:1',
            'styles.*.style_number' => 'required|string|max:100',
            'styles.*.quantity' => 'nullable|integer|min:0',
            'styles.*.unit_price' => 'nullable|numeric|min:0',
            'styles.*.description' => 'nullable|string',
            'styles.*.color_name' => 'nullable|string',
        ]);
        $v->setAttributeNames($this->attributeNames());
        if ($v->fails()) {
            return response()->json(['message' => 'Validation failed', 'errors' => $v->errors()], 422);
        }

        $user = $request->user();
        $header = $request->input('header');
        $styles = $request->input('styles');

        // Explicit composite-unique pre-check. The DB index is authoritative (for race
        // safety we also catch QueryException below), but a friendly 422 is better UX.
        $duplicate = BuySheet::where('buyer_id', $header['buyer_id'])
            ->where('buy_sheet_number', $header['buy_sheet_number'])
            ->exists();
        if ($duplicate) {
            return response()->json([
                'message' => "Buy sheet #{$header['buy_sheet_number']} already exists for this buyer.",
                'errors' => ['header.buy_sheet_number' => ['Already exists for this buyer.']],
            ], 422);
        }

        // Dedupe styles by style_number (case-insensitive) to avoid losing data when
        // the pivot's unique (buy_sheet_id, style_id) would otherwise silently collapse
        // two rows for the same style into the last-write-wins pivot record.
        $stylesByKey = [];
        foreach ($styles as $s) {
            $key = strtoupper(trim($s['style_number']));
            if (!isset($stylesByKey[$key])) {
                $stylesByKey[$key] = $s;
            }
        }
        $styles = array_values($stylesByKey);

        try {
            return DB::transaction(function () use ($user, $header, $styles, $request) {
                $buySheet = BuySheet::create([
                    'buy_sheet_number' => $header['buy_sheet_number'],
                    'buyer_id' => $header['buyer_id'],
                    'retailer_id' => $header['retailer_id'] ?? null,
                    'season_id' => $header['season_id'] ?? null,
                    'name' => $header['name'] ?? null,
                    'date_submitted' => $header['date_submitted'] ?? null,
                    'status' => BuySheet::STATUS_OPEN,
                    'tickets_required' => $header['tickets_required'] ?? null,
                    'buyer_approvals_required' => $header['buyer_approvals_required'] ?? null,
                    'source_file_path' => $request->input('temp_file_path'),
                    'strategy_key' => $request->input('strategy_key'),
                    'metadata' => $request->input('metadata'),
                    'created_by' => $user->id,
                ]);

                $totalQty = 0; $totalValue = 0.0; $created = 0;
                foreach ($styles as $s) {
                    $style = Style::firstOrCreate(
                        ['style_number' => $s['style_number'], 'retailer_id' => $header['retailer_id'] ?? null],
                        [
                            'description' => $s['description'] ?? null,
                            'color_name' => $s['color_name'] ?? null,
                            'total_quantity' => (int) ($s['quantity'] ?? 0),
                            'unit_price' => (float) ($s['unit_price'] ?? 0),
                            'season_id' => $header['season_id'] ?? null,
                            'created_by' => $user->id,
                            'is_active' => true,
                        ]
                    );
                    $qty = (int) ($s['quantity'] ?? 0);
                    $price = (float) ($s['unit_price'] ?? 0);

                    // Style-grid columns the SCI buy-sheet template carries that the
                    // pivot doesn't have first-class columns for - parked in metadata
                    // so they're preserved without widening the schema.
                    $extraMeta = array_filter([
                        'fabric' => $s['fabric'] ?? null,
                        'fit' => $s['fit'] ?? null,
                        'notes' => $s['notes'] ?? null,
                        'pre_pack_inner' => $s['pre_pack_inner'] ?? null,
                    ], fn ($v) => $v !== null && $v !== '');

                    // size_breakdown must be json_encode'd for the INSERT binding; the
                    // BuySheetStyle pivot's array cast decodes it on read.
                    $buySheet->styles()->syncWithoutDetaching([
                        $style->id => [
                            'quantity' => $qty,
                            'unit_price' => $price,
                            'size_breakdown' => isset($s['size_breakdown']) ? json_encode($s['size_breakdown']) : null,
                            'packing' => $s['packing'] ?? null,
                            'label' => $s['label'] ?? null,
                            'ihd' => $s['ihd'] ?? null,
                            'metadata' => !empty($extraMeta) ? json_encode($extraMeta) : null,
                        ],
                    ]);
                    $totalQty += $qty; $totalValue += $qty * $price; $created++;
                }

                $buySheet->total_styles = $created;
                $buySheet->total_quantity = $totalQty;
                $buySheet->total_value = $totalValue;
                $buySheet->save();

                $this->activityLog->logCreated('BuySheet', $buySheet->id, [
                    'buy_sheet_number' => $buySheet->buy_sheet_number,
                    'source' => 'import',
                    'strategy' => $request->input('strategy_key'),
                ]);

                // Clean up the temp upload. source_file_path recorded above would
                // dangle after cleanup, so null it; durable archival is a follow-up.
                if ($tempPath = $request->input('temp_file_path')) {
                    if (str_starts_with($tempPath, 'temp/imports/') && Storage::disk('local')->exists($tempPath)) {
                        Storage::disk('local')->delete($tempPath);
                    }
                    $buySheet->update(['source_file_path' => null]);
                }

                return response()->json([
                    'success' => true,
                    'kind' => 'buy_sheet',
                    'buy_sheet' => $buySheet->load(['buyer', 'retailer']),
                    'styles_created' => $created,
                ], 201);
            });
        } catch (\Illuminate\Database\QueryException $e) {
            // Race: another request inserted the same (buyer_id, buy_sheet_number)
            // between our pre-check and the INSERT. Unique-constraint codes vary
            // by driver (23000 for MySQL/Postgres); match by message text for safety.
            if (str_contains($e->getMessage(), 'buy_sheets_buyer_number_unique')
                || in_array($e->getCode(), [23000, '23000'], true)) {
                return response()->json([
                    'message' => "Buy sheet #{$header['buy_sheet_number']} already exists for this buyer.",
                    'errors' => ['header.buy_sheet_number' => ['Already exists for this buyer.']],
                ], 422);
            }
            throw $e;
        }
    }

    private function commitPurchaseOrder(Request $request): JsonResponse
    {
        // Delegate to the existing PdfImportController::create logic (body format is compatible)
        // by rebinding the request payload into the shape it expects.
        $v = Validator::make($request->all(), [
            'strategy_key' => 'required|string',
            'header.po_number' => 'required|string|max:50|unique:purchase_orders,po_number',
            'header.po_date' => 'required|date',
            'header.buyer_id' => 'nullable|exists:buyers,id',
            'header.buy_sheet_id' => 'nullable|exists:buy_sheets,id',
            'header.buy_sheet_number' => 'nullable|string|max:50',
            'header.retailer_id' => 'nullable|exists:retailers,id',
            'header.season_id' => 'nullable|exists:seasons,id',
            'header.currency_id' => 'nullable|exists:currencies,id',
            'header.payment_term_id' => 'nullable|exists:payment_terms,id',
            'header.country_id' => 'nullable|exists:countries,id',
            'header.warehouse_id' => 'nullable|exists:warehouses,id',
            'header.importer_id' => 'nullable|exists:users,id',
            'header.agency_id' => 'nullable|exists:users,id',
            'header.shipping_term' => 'nullable|in:FOB,DDP',
            'header.etd_date' => 'nullable|date',
            'header.ex_factory_date' => 'nullable|date',
            'header.eta_date' => 'nullable|date',
            'header.in_warehouse_date' => 'nullable|date',
            'header.fob_date' => 'nullable|date',
            // Additional free-form / structured fields that the legacy PDF flow
            // already persists. Without these rules Laravel silently drops them
            // before the PurchaseOrder::create() call sees them.
            'header.headline' => 'nullable|string|max:255',
            'header.ship_to' => 'nullable|string|max:100',
            'header.ship_to_address' => 'nullable|string',
            'header.country_of_origin' => 'nullable|string|max:100',
            'header.packing_method' => 'nullable|string',
            'header.packing_guidelines' => 'nullable|string',
            'header.other_terms' => 'nullable|string',
            'header.additional_notes' => 'nullable|string',
            'header.revision_number' => 'nullable|integer',
            'header.exchange_rate' => 'nullable|numeric|min:0',
            'header.payment_terms_structured' => 'nullable|array',
            'header.payment_terms_structured.term' => 'nullable|string',
            'header.payment_terms_structured.percentage' => 'nullable|numeric|min:0|max:100',
            'header.sample_schedule' => 'nullable|array',
            'header.sample_schedule.lab_dip_submission' => 'nullable|date',
            'header.sample_schedule.fit_sample_submission' => 'nullable|date',
            'header.sample_schedule.trim_approvals' => 'nullable|date',
            'header.sample_schedule.first_proto_submission' => 'nullable|date',
            'header.sample_schedule.second_proto_submission' => 'nullable|date',
            'header.sample_schedule.bulk_fabric_inhouse' => 'nullable|date',
            'header.sample_schedule.pp_sample_submission' => 'nullable|date',
            'header.sample_schedule.production_start' => 'nullable|date',
            'header.sample_schedule.top_approval' => 'nullable|date',
            'styles' => 'required|array|min:1',
            'styles.*.style_number' => 'required|string|max:100',
            'styles.*.quantity' => 'required|integer|min:1',
            'styles.*.unit_price' => 'required|numeric|min:0',
            'styles.*.description' => 'nullable|string',
            'styles.*.color_name' => 'nullable|string',
            'styles.*.colors' => 'nullable|array',
            'styles.*.size_breakdown' => 'nullable',
            'styles.*.ratio' => 'nullable',
            'styles.*.packing_method' => 'nullable|string',
            'styles.*.images' => 'nullable|array',
            'styles.*.images.*' => 'nullable|string',
        ]);
        $v->setAttributeNames($this->attributeNames());
        if ($v->fails()) {
            return response()->json(['message' => 'Validation failed', 'errors' => $v->errors()], 422);
        }

        $user = $request->user();
        $h = $request->input('header');
        $stylesData = $request->input('styles');

        // Integrity check: the buy sheet (if any) must belong to the same buyer as the PO.
        // Without this, a client could supply any buy_sheet_id and link a PO to a
        // different buyer's sheet, corrupting reporting and status transitions.
        if (!empty($h['buy_sheet_id'])) {
            $refSheet = BuySheet::find($h['buy_sheet_id']);
            if ($refSheet && !empty($h['buyer_id']) && (int) $refSheet->buyer_id !== (int) $h['buyer_id']) {
                return response()->json([
                    'message' => 'The selected buy sheet belongs to a different buyer.',
                    'errors' => ['header.buy_sheet_id' => ['Buyer mismatch.']],
                ], 422);
            }
        }

        return DB::transaction(function () use ($request, $user, $h, $stylesData) {
            // "If Buyer is set on the PO the importer/agency linkage is implied"
            // Skip auto-assigning the creator as importer/agency when buyer_id is present
            // so the existing importer/agency relationships on the buyer side remain in charge.
            $buyerIsSet = !empty($h['buyer_id']);
            $importerId = $h['importer_id'] ?? null;
            $agencyId = $h['agency_id'] ?? null;
            if (!$buyerIsSet) {
                if ($user->hasRole('Agency')) {
                    $agencyId = $agencyId ?? $user->id;
                } else {
                    $importerId = $importerId ?? $user->id;
                }
            }

            // If linked to a buy sheet, pull over buy_sheet_number for denormalized search
            $buySheet = !empty($h['buy_sheet_id']) ? BuySheet::find($h['buy_sheet_id']) : null;

            $po = PurchaseOrder::create([
                'po_number' => $h['po_number'],
                'headline' => $h['headline'] ?? ($buySheet?->name),
                'importer_id' => $importerId,
                'agency_id' => $agencyId,
                'creator_id' => $user->id,
                'buyer_id' => $h['buyer_id'] ?? null,
                'buy_sheet_id' => $buySheet?->id,
                'buy_sheet_number' => $buySheet?->buy_sheet_number ?? ($h['buy_sheet_number'] ?? null),
                'po_date' => $h['po_date'],
                'currency_id' => $h['currency_id'] ?? null,
                'exchange_rate' => $h['exchange_rate'] ?? 1.0,
                'payment_term_id' => $h['payment_term_id'] ?? null,
                'payment_terms_structured' => $h['payment_terms_structured'] ?? null,
                'status' => 'draft',
                'total_styles' => 0, 'total_quantity' => 0, 'total_value' => 0,
                'etd_date' => $h['etd_date'] ?? null,
                'ex_factory_date' => $h['ex_factory_date'] ?? null,
                'eta_date' => $h['eta_date'] ?? null,
                'in_warehouse_date' => $h['in_warehouse_date'] ?? null,
                'fob_date' => $h['fob_date'] ?? null,
                'ship_to' => $h['ship_to'] ?? null,
                'ship_to_address' => $h['ship_to_address'] ?? null,
                'season_id' => $h['season_id'] ?? null,
                'retailer_id' => $h['retailer_id'] ?? ($buySheet?->retailer_id),
                'country_id' => $h['country_id'] ?? null,
                'warehouse_id' => $h['warehouse_id'] ?? null,
                'shipping_term' => $h['shipping_term'] ?? 'FOB',
                'country_of_origin' => $h['country_of_origin'] ?? null,
                'packing_method' => $h['packing_method'] ?? null,
                'packing_guidelines' => $h['packing_guidelines'] ?? null,
                'other_terms' => $h['other_terms'] ?? null,
                'additional_notes' => $h['additional_notes'] ?? null,
                'sample_schedule' => $h['sample_schedule'] ?? null,
                'import_source' => [
                    'strategy_key' => $request->input('strategy_key'),
                    'filename' => $request->input('original_filename'),
                    'buy_sheet_id' => $buySheet?->id,
                    'parser_version' => 1,
                    'imported_at' => now()->toIso8601String(),
                ],
            ]);

            $styleIdsByNumber = [];
            if ($buySheet) {
                // Pre-load styles already on the buy sheet for auto-match
                foreach ($buySheet->styles as $s) {
                    $styleIdsByNumber[strtoupper($s->style_number)] = $s->id;
                }
            }

            $stylesCreated = 0;
            foreach ($stylesData as $s) {
                $styleNumKey = strtoupper(trim($s['style_number']));

                if (isset($styleIdsByNumber[$styleNumKey])) {
                    $style = Style::find($styleIdsByNumber[$styleNumKey]);
                } else {
                    $style = Style::create([
                        'style_number' => $s['style_number'],
                        'description' => $s['description'] ?? null,
                        'color_name' => $s['color_name'] ?? null,
                        'size_breakup' => $s['size_breakdown'] ?? null,
                        'images' => !empty($s['images']) ? $s['images'] : null,
                        'total_quantity' => $s['quantity'],
                        'unit_price' => $s['unit_price'],
                        'fob_price' => $s['unit_price'],
                        'retailer_id' => $po->retailer_id,
                        'season_id' => $po->season_id,
                        'country_of_origin' => $po->country_of_origin,
                        'created_by' => $user->id,
                        'is_active' => true,
                    ]);
                }

                $pivotData = [
                    'quantity_in_po' => (int) $s['quantity'],
                    'unit_price_in_po' => (float) $s['unit_price'],
                    'status' => 'pending',
                ];
                if (Schema::hasColumn('purchase_order_style', 'size_breakdown')) {
                    $pivotData['size_breakdown'] = json_encode($s['size_breakdown'] ?? null);
                }
                $po->styles()->attach($style->id, $pivotData);
                $stylesCreated++;
            }

            $po->updateTotals();

            if ($buySheet && $buySheet->status === BuySheet::STATUS_OPEN) {
                $buySheet->status = BuySheet::STATUS_PO_ISSUED;
                $buySheet->save();
            }

            $this->activityLog->logCreated('PurchaseOrder', $po->id, [
                'po_number' => $po->po_number,
                'source' => 'import',
                'strategy' => $request->input('strategy_key'),
                'styles_count' => $stylesCreated,
                'buy_sheet_id' => $buySheet?->id,
            ]);

            try {
                app(TNAChartService::class)->generateTNAChart($po);
            } catch (\Throwable $e) {
                Log::warning("TNA generation failed for imported PO {$po->id}: " . $e->getMessage());
            }

            if ($po->agency_id) {
                $agency = \App\Models\User::find($po->agency_id);
                if ($agency) {
                    SendPurchaseOrderNotification::dispatch($po, $agency, 'created', [
                        'created_by' => $user->name,
                        'source' => 'import',
                        'styles_count' => $stylesCreated,
                    ]);
                }
            }

            // Clean up the temp upload; the original filename is preserved on
            // import_source for auditability.
            if ($tempPath = $request->input('temp_file_path')) {
                if (str_starts_with($tempPath, 'temp/imports/') && Storage::disk('local')->exists($tempPath)) {
                    Storage::disk('local')->delete($tempPath);
                }
            }

            return response()->json([
                'success' => true,
                'kind' => 'po',
                'purchase_order' => [
                    'id' => $po->id,
                    'po_number' => $po->po_number,
                    'status' => $po->status,
                    'total_quantity' => $po->total_quantity,
                    'total_value' => $po->total_value,
                    'total_styles' => $po->total_styles,
                    'buy_sheet_id' => $po->buy_sheet_id,
                ],
                'styles_created' => $stylesCreated,
            ], 201);
        });
    }

    /**
     * Human-readable names for the nested `header.*` / `styles.*.*` paths so
     * Laravel's default validation messages don't read as "The header.po number
     * has already been taken." and similar nonsense to end users.
     */
    private function attributeNames(): array
    {
        return [
            'header.po_number' => 'PO Number',
            'header.po_date' => 'PO Date',
            'header.buyer_id' => 'Buyer',
            'header.buy_sheet_id' => 'Buy Sheet',
            'header.buy_sheet_number' => 'Buy Sheet Number',
            'header.retailer_id' => 'Retailer',
            'header.season_id' => 'Season',
            'header.currency_id' => 'Currency',
            'header.payment_term_id' => 'Payment Term',
            'header.country_id' => 'Country',
            'header.warehouse_id' => 'Warehouse',
            'header.shipping_term' => 'Shipping Term',
            'header.etd_date' => 'ETD',
            'header.ex_factory_date' => 'Ex-Factory Date',
            'header.eta_date' => 'ETA',
            'header.in_warehouse_date' => 'In-Warehouse Date',
            'header.fob_date' => 'FOB Date',
            'header.name' => 'Name',
            'header.date_submitted' => 'Date Submitted',
            'header.tickets_required' => 'Tickets Required',
            'header.buyer_approvals_required' => 'Buyer Approvals Required',
            'styles' => 'Styles',
            'styles.*.style_number' => 'Style Number',
            'styles.*.quantity' => 'Quantity',
            'styles.*.unit_price' => 'Unit Price',
        ];
    }
}
