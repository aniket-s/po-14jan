<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PurchaseOrder;
use App\Models\Style;
use App\Services\ActivityLogService;
use App\Services\ClaudeApiService;
use App\Services\ClaudePdfImportService;
use App\Services\PdfImportService;
use App\Services\TNAChartService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use App\Jobs\SendPurchaseOrderNotification;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Validator;

class PdfImportController extends Controller
{
    protected ClaudePdfImportService $claudePdfImportService;
    protected PdfImportService $pdfImportService;
    protected ActivityLogService $activityLog;

    public function __construct(
        ClaudePdfImportService $claudePdfImportService,
        PdfImportService $pdfImportService,
        ActivityLogService $activityLog
    ) {
        $this->claudePdfImportService = $claudePdfImportService;
        $this->pdfImportService = $pdfImportService;
        $this->activityLog = $activityLog;
    }

    /**
     * Analyze a PDF purchase order file and return parsed data.
     * Uses Claude AI as primary extraction method, falls back to regex parser.
     */
    public function analyze(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'file' => 'required|file|mimes:pdf|max:20480',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        $file = $request->file('file');

        // Store the file temporarily
        $tempPath = $file->store('temp/pdf-imports');
        $fullPath = Storage::disk('local')->path($tempPath);

        // Try Claude AI extraction first (if configured)
        $claudeApi = app(ClaudeApiService::class);
        $analysisMethod = 'regex';
        $result = null;

        if ($claudeApi->isConfigured()) {
            Log::info('PDF analysis: attempting Claude AI extraction');
            $result = $this->claudePdfImportService->analyzePdf($fullPath);

            if ($result['success']) {
                $analysisMethod = 'claude_ai';
                Log::info('PDF analysis: Claude AI extraction successful', [
                    'styles_count' => count($result['styles'] ?? []),
                    'ai_usage' => $result['ai_usage'] ?? null,
                ]);
            } else {
                Log::warning('PDF analysis: Claude AI extraction failed, falling back to regex', [
                    'error' => $result['error'] ?? 'Unknown',
                ]);
                $result = null; // Reset so fallback runs
            }
        }

        // Fallback to regex-based parser
        if ($result === null || !$result['success']) {
            Log::info('PDF analysis: using regex-based extraction');
            $result = $this->pdfImportService->analyzePdf($fullPath);
        }

        if (!$result['success']) {
            Storage::disk('local')->delete($tempPath);
            return response()->json([
                'message' => $result['error'] ?? 'Failed to analyze PDF',
            ], 422);
        }

        return response()->json([
            'success' => true,
            'parsed_data' => [
                'po_header' => $result['po_header'],
                'styles' => $result['styles'],
                'totals' => $result['totals'],
            ],
            'temp_file_path' => $tempPath,
            'warnings' => $result['warnings'],
            'errors' => $result['errors'],
            'raw_text' => $result['raw_text'] ?? '',
            'analysis_method' => $analysisMethod,
        ]);
    }

    /**
     * Create a purchase order from parsed PDF data (user-reviewed)
     */
    public function create(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'po_header' => 'required|array',
            'po_header.po_number' => 'required|string|max:50|unique:purchase_orders,po_number',
            'po_header.po_date' => 'required|date',
            'po_header.headline' => 'nullable|string|max:255',
            'po_header.retailer_id' => 'nullable|exists:retailers,id',
            'po_header.season_id' => 'nullable|exists:seasons,id',
            'po_header.currency_id' => 'nullable|exists:currencies,id',
            'po_header.payment_term_id' => 'nullable|exists:payment_terms,id',
            'po_header.country_id' => 'nullable|exists:countries,id',
            'po_header.warehouse_id' => 'nullable|exists:warehouses,id',
            'po_header.shipping_term' => 'nullable|in:FOB,DDP',
            'po_header.ship_to' => 'nullable|string|max:100',
            'po_header.ship_to_address' => 'nullable|string',
            'po_header.country_of_origin' => 'nullable|string|max:100',
            'po_header.etd_date' => 'nullable|date',
            'po_header.ex_factory_date' => 'nullable|date',
            'po_header.eta_date' => 'nullable|date',
            'po_header.in_warehouse_date' => 'nullable|date',
            'po_header.importer_id' => 'nullable|exists:users,id',
            'po_header.agency_id' => 'nullable|exists:users,id',
            'po_header.buyer_id' => 'nullable|exists:buyers,id',
            'po_header.packing_method' => 'nullable|string',
            'po_header.packing_guidelines' => 'nullable|string',
            'po_header.other_terms' => 'nullable|string',
            'po_header.additional_notes' => 'nullable|string',
            'po_header.revision_number' => 'nullable|integer',
            'po_header.payment_terms_structured' => 'nullable|array',
            'po_header.payment_terms_structured.term' => 'nullable|string',
            'po_header.payment_terms_structured.percentage' => 'nullable|numeric|min:0|max:100',
            'po_header.sample_schedule' => 'nullable|array',
            'po_header.sample_schedule.lab_dip_submission' => 'nullable|date',
            'po_header.sample_schedule.fit_sample_submission' => 'nullable|date',
            'po_header.sample_schedule.trim_approvals' => 'nullable|date',
            'po_header.sample_schedule.first_proto_submission' => 'nullable|date',
            'po_header.sample_schedule.bulk_fabric_inhouse' => 'nullable|date',
            'po_header.sample_schedule.pp_sample_submission' => 'nullable|date',
            'po_header.sample_schedule.production_start' => 'nullable|date',
            'po_header.sample_schedule.top_approval' => 'nullable|date',
            'styles' => 'required|array|min:1',
            'styles.*.style_number' => 'required|string|max:100',
            'styles.*.description' => 'nullable|string|max:500',
            'styles.*.color_name' => 'nullable|string|max:100',
            'styles.*.size_breakdown' => 'nullable|array',
            'styles.*.quantity' => 'required|integer|min:1',
            'styles.*.unit_price' => 'required|numeric|min:0',
            'styles.*.images' => 'nullable|array',
            'styles.*.images.*' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        $user = $request->user();
        $headerData = $request->input('po_header');
        $stylesData = $request->input('styles');

        // Additional cross-validation
        $crossErrors = [];

        // Check for duplicate style number + color combinations within this PO
        $styleKeys = array_map(function ($s) {
            $sn = strtoupper(trim($s['style_number'] ?? ''));
            $color = strtoupper(trim($s['color_name'] ?? ''));
            return $color ? "{$sn}|{$color}" : $sn;
        }, $stylesData);
        $duplicates = array_unique(array_diff_assoc($styleKeys, array_unique($styleKeys)));
        if (!empty($duplicates)) {
            $displayDuplicates = array_map(fn($key) => str_replace('|', ' / ', $key), array_unique($duplicates));
            $crossErrors['styles'] = ['Duplicate style/color combinations found: ' . implode(', ', $displayDuplicates)];
        }

        // Validate size breakdown sums match quantity for each style
        foreach ($stylesData as $index => $styleData) {
            if (!empty($styleData['size_breakdown']) && is_array($styleData['size_breakdown'])) {
                $sizeSum = array_sum($styleData['size_breakdown']);
                $qty = (int) ($styleData['quantity'] ?? 0);
                if ($sizeSum > 0 && $qty > 0 && $sizeSum !== $qty) {
                    $crossErrors["styles.{$index}.quantity"] = [
                        "Size breakdown total ({$sizeSum}) does not match quantity ({$qty}) for style '{$styleData['style_number']}'"
                    ];
                }
            }
        }

        if (!empty($crossErrors)) {
            return response()->json([
                'message' => 'Data validation failed',
                'errors' => $crossErrors,
            ], 422);
        }

        try {
            return DB::transaction(function () use ($headerData, $stylesData, $user) {
                // Determine importer_id and agency_id based on the creator's role
                $importerId = $headerData['importer_id'] ?? null;
                $agencyId = $headerData['agency_id'] ?? null;

                if ($user->hasRole('Agency')) {
                    // Agency creating a PO: set themselves as the agency, importer is optional
                    $agencyId = $agencyId ?? $user->id;
                } else {
                    // Importer or Super Admin: default importer to self if not specified
                    $importerId = $importerId ?? $user->id;
                }

                // Create the Purchase Order
                $po = PurchaseOrder::create([
                    'po_number' => $headerData['po_number'],
                    'headline' => $headerData['headline'] ?? null,
                    'importer_id' => $importerId,
                    'creator_id' => $user->id,
                    'agency_id' => $agencyId,
                    'buyer_id' => $headerData['buyer_id'] ?? null,
                    'po_date' => $headerData['po_date'],
                    'currency_id' => $headerData['currency_id'] ?? null,
                    'exchange_rate' => $headerData['exchange_rate'] ?? 1.0,
                    'payment_term_id' => $headerData['payment_term_id'] ?? null,
                    'payment_terms_structured' => $headerData['payment_terms_structured'] ?? null,
                    'additional_notes' => $headerData['additional_notes'] ?? null,
                    'status' => 'draft',
                    'total_styles' => 0,
                    'total_quantity' => 0,
                    'total_value' => 0,
                    'revision_number' => $headerData['revision_number'] ?? 1,
                    'revision_date' => $headerData['revision_date'] ?? null,
                    'etd_date' => $headerData['etd_date'] ?? null,
                    'ex_factory_date' => $headerData['ex_factory_date'] ?? null,
                    'eta_date' => $headerData['eta_date'] ?? null,
                    'in_warehouse_date' => $headerData['in_warehouse_date'] ?? null,
                    'ship_to' => $headerData['ship_to'] ?? null,
                    'ship_to_address' => $headerData['ship_to_address'] ?? null,
                    'season_id' => $headerData['season_id'] ?? null,
                    'retailer_id' => $headerData['retailer_id'] ?? null,
                    'country_id' => $headerData['country_id'] ?? null,
                    'warehouse_id' => $headerData['warehouse_id'] ?? null,
                    'shipping_term' => $headerData['shipping_term'] ?? 'FOB',
                    'payment_term' => $headerData['payment_term'] ?? null,
                    'country_of_origin' => $headerData['country_of_origin'] ?? null,
                    'packing_method' => $headerData['packing_method'] ?? null,
                    'packing_guidelines' => $headerData['packing_guidelines'] ?? null,
                    'other_terms' => $headerData['other_terms'] ?? null,
                    'sample_schedule' => $headerData['sample_schedule'] ?? null,
                ]);

                // Create styles and attach to PO
                $stylesCreated = 0;
                $stylesErrors = [];

                foreach ($stylesData as $index => $styleData) {
                    try {
                        // Attempt to look up color_id from colors table
                        $colorId = null;
                        $colorName = $styleData['color_name'] ?? null;
                        if ($colorName) {
                            $color = \App\Models\Color::where('name', $colorName)->first();
                            if ($color) {
                                $colorId = $color->id;
                            }
                        }

                        $style = Style::create([
                            'style_number' => $styleData['style_number'],
                            'description' => $styleData['description'] ?? null,
                            'color_name' => $colorName,
                            'color_id' => $colorId,
                            'size_breakup' => $styleData['size_breakdown'] ?? null,
                            'images' => !empty($styleData['images']) ? $styleData['images'] : null,
                            'total_quantity' => $styleData['quantity'],
                            'unit_price' => $styleData['unit_price'],
                            'fob_price' => $styleData['unit_price'],
                            'retailer_id' => $headerData['retailer_id'] ?? null,
                            'season_id' => $headerData['season_id'] ?? null,
                            'country_of_origin' => $headerData['country_of_origin'] ?? null,
                            'created_by' => $user->id,
                            'is_active' => true,
                        ]);

                        // Attach style to PO via pivot table
                        $pivotData = [
                            'quantity_in_po' => $styleData['quantity'],
                            'unit_price_in_po' => $styleData['unit_price'],
                            'status' => 'pending',
                        ];

                        // Add size_breakdown to pivot if the column exists
                        if (Schema::hasColumn('purchase_order_style', 'size_breakdown')) {
                            $pivotData['size_breakdown'] = json_encode($styleData['size_breakdown'] ?? null);
                        }

                        $po->styles()->attach($style->id, $pivotData);

                        $stylesCreated++;
                    } catch (\Exception $e) {
                        $stylesErrors[] = [
                            'row' => $index + 1,
                            'style_number' => $styleData['style_number'] ?? 'Unknown',
                            'error' => $e->getMessage(),
                        ];
                    }
                }

                // Update PO totals
                $po->updateTotals();

                // Log activity
                $this->activityLog->logCreated('PurchaseOrder', $po->id, [
                    'po_number' => $po->po_number,
                    'source' => 'pdf_import',
                    'styles_count' => $stylesCreated,
                ]);

                // Auto-generate TNA chart
                try {
                    $tnaService = app(TNAChartService::class);
                    $tnaService->generateTNAChart($po);
                } catch (\Exception $e) {
                    \Log::error('Failed to auto-generate TNA chart for PDF-imported PO ' . $po->id . ': ' . $e->getMessage());
                }

                // Send notifications
                if ($po->agency_id) {
                    $agency = \App\Models\User::find($po->agency_id);
                    if ($agency) {
                        SendPurchaseOrderNotification::dispatch($po, $agency, 'created', [
                            'created_by' => $user->name,
                            'source' => 'pdf_import',
                            'styles_count' => $stylesCreated,
                        ]);
                    }
                }

                // Clean up temp file if provided
                if (request()->has('temp_file_path')) {
                    Storage::disk('local')->delete(request()->input('temp_file_path'));
                }

                return response()->json([
                    'success' => true,
                    'message' => 'Purchase order created successfully from PDF',
                    'purchase_order' => [
                        'id' => $po->id,
                        'po_number' => $po->po_number,
                        'status' => $po->status,
                        'total_quantity' => $po->total_quantity,
                        'total_value' => $po->total_value,
                        'total_styles' => $po->total_styles,
                    ],
                    'styles_created' => $stylesCreated,
                    'styles_errors' => $stylesErrors,
                ], 201);
            });
        } catch (\Exception $e) {
            \Log::error('PDF PO creation failed: ' . $e->getMessage());
            return response()->json([
                'message' => 'Failed to create purchase order: ' . $e->getMessage(),
            ], 500);
        }
    }
}
