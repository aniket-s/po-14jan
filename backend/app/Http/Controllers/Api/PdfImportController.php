<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PurchaseOrder;
use App\Models\Style;
use App\Services\ActivityLogService;
use App\Services\PdfImportService;
use App\Services\TNAChartService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;

class PdfImportController extends Controller
{
    protected PdfImportService $pdfImportService;
    protected ActivityLogService $activityLog;

    public function __construct(PdfImportService $pdfImportService, ActivityLogService $activityLog)
    {
        $this->pdfImportService = $pdfImportService;
        $this->activityLog = $activityLog;
    }

    /**
     * Analyze a PDF purchase order file and return parsed data
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

        $result = $this->pdfImportService->analyzePdf($fullPath);

        if (!$result['success']) {
            // Clean up temp file on failure
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
            'raw_text' => $result['raw_text'],
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
            'po_header.agency_id' => 'nullable|exists:users,id',
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

        try {
            return DB::transaction(function () use ($headerData, $stylesData, $user) {
                // Create the Purchase Order
                $po = PurchaseOrder::create([
                    'po_number' => $headerData['po_number'],
                    'headline' => $headerData['headline'] ?? null,
                    'importer_id' => $user->id,
                    'creator_id' => $user->id,
                    'agency_id' => $headerData['agency_id'] ?? null,
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
                        $style = Style::create([
                            'style_number' => $styleData['style_number'],
                            'description' => $styleData['description'] ?? null,
                            'color_name' => $styleData['color_name'] ?? null,
                            'size_breakdown' => $styleData['size_breakdown'] ?? null,
                            'total_quantity' => $styleData['quantity'],
                            'unit_price' => $styleData['unit_price'],
                            'total_price' => round($styleData['quantity'] * $styleData['unit_price'], 2),
                            'fob_price' => $styleData['unit_price'],
                            'created_by' => $user->id,
                            'is_active' => true,
                        ]);

                        // Attach style to PO via pivot table
                        $po->styles()->attach($style->id, [
                            'quantity_in_po' => $styleData['quantity'],
                            'unit_price_in_po' => $styleData['unit_price'],
                            'size_breakdown' => json_encode($styleData['size_breakdown'] ?? null),
                            'status' => 'pending',
                        ]);

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
