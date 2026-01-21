<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PurchaseOrder;
use App\Models\Retailer;
use App\Models\User;
use App\Services\ActivityLogService;
use App\Services\PermissionService;
use App\Services\PONumberService;
use App\Services\DateCalculationService;
use App\Services\SampleScheduleService;
use App\Services\TNAChartService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Storage;

class PurchaseOrderController extends Controller
{
    protected ActivityLogService $activityLog;
    protected PermissionService $permissionService;

    public function __construct(ActivityLogService $activityLog, PermissionService $permissionService)
    {
        $this->activityLog = $activityLog;
        $this->permissionService = $permissionService;
    }

    /**
     * Get all purchase orders with filters
     */
    public function index(Request $request)
    {
        $user = $request->user();
        $query = PurchaseOrder::with(['importer', 'agency', 'styles']);

        // Apply permission-based filtering
        if ($user->hasPermissionTo('po.view_all')) {
            // Can view all POs - no filtering needed
        } elseif ($user->hasPermissionTo('po.view_own')) {
            // Can view own POs - filter by accessible IDs
            $accessibleIds = $this->permissionService->getAccessiblePOIds($user);
            $query->whereIn('id', $accessibleIds);
        } elseif ($user->hasPermissionTo('po.view')) {
            // Basic view permission - show all POs (read-only)
            // No filtering needed - they can see all but not edit/delete
        } else {
            return response()->json([
                'message' => 'You do not have permission to view purchase orders',
            ], 403);
        }

        // Status filter
        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        // Importer filter
        if ($request->has('importer_id')) {
            $query->where('importer_id', $request->importer_id);
        }

        // Agency filter
        if ($request->has('agency_id')) {
            if ($request->agency_id === 'null') {
                $query->whereNull('agency_id');
            } else {
                $query->where('agency_id', $request->agency_id);
            }
        }

        // Brand filter
        if ($request->has('brand_name')) {
            $query->where('brand_name', 'like', "%{$request->brand_name}%");
        }

        // Season filter
        if ($request->has('season')) {
            $query->where('season', $request->season);
        }

        // Search filter
        if ($request->has('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('po_number', 'like', "%{$search}%")
                  ->orWhere('brand_name', 'like', "%{$search}%")
                  ->orWhere('special_instructions', 'like', "%{$search}%");
            });
        }

        // Date range filter
        if ($request->has('date_from')) {
            $query->where('order_date', '>=', $request->date_from);
        }

        if ($request->has('date_to')) {
            $query->where('order_date', '<=', $request->date_to);
        }

        // Sorting
        $sortBy = $request->get('sort_by', 'created_at');
        $sortOrder = $request->get('sort_order', 'desc');
        $query->orderBy($sortBy, $sortOrder);

        // Pagination
        $perPage = $request->get('per_page', 15);
        $pos = $query->paginate($perPage);

        return response()->json([
            'data' => $pos->map(function ($po) {
                return [
                    'id' => $po->id,
                    'po_number' => $po->po_number,
                    'importer' => [
                        'id' => $po->importer->id,
                        'name' => $po->importer->name,
                        'company' => $po->importer->company,
                    ],
                    'agency' => $po->agency ? [
                        'id' => $po->agency->id,
                        'name' => $po->agency->name,
                        'company' => $po->agency->company,
                    ] : null,
                    'retailer' => $po->retailer,
                    'po_date' => $po->po_date?->format('Y-m-d'),
                    'delivery_date' => $po->delivery_date?->format('Y-m-d'),
                    'currency' => $po->currency,
                    'total_quantity' => $po->total_quantity,
                    'total_value' => $po->total_value,
                    'status' => $po->status,
                    'styles_count' => $po->styles->count(),
                    'created_at' => $po->created_at,
                ];
            }),
            'current_page' => $pos->currentPage(),
            'last_page' => $pos->lastPage(),
            'per_page' => $pos->perPage(),
            'total' => $pos->total(),
        ]);
    }

    /**
     * Get single purchase order
     */
    public function show(Request $request, $id)
    {
        $user = $request->user();
        $po = PurchaseOrder::with(['importer', 'agency', 'styles.assignedFactory'])->findOrFail($id);

        // Check permission
        if (!$this->permissionService->canAccessPO($user, $po)) {
            return response()->json([
                'message' => 'You do not have permission to view this purchase order',
            ], 403);
        }

        return response()->json([
            'purchase_order' => [
                'id' => $po->id,
                'po_number' => $po->po_number,
                'headline' => $po->headline,
                'importer_id' => $po->importer_id,
                'importer' => [
                    'id' => $po->importer->id,
                    'name' => $po->importer->name,
                    'email' => $po->importer->email,
                    'company' => $po->importer->company,
                ],
                'agency_id' => $po->agency_id,
                'agency' => $po->agency ? [
                    'id' => $po->agency->id,
                    'name' => $po->agency->name,
                    'email' => $po->agency->email,
                    'company' => $po->agency->company,
                ] : null,
                'brand_name' => $po->brand_name,
                'season' => $po->season,
                'category' => $po->category,
                'order_date' => $po->order_date?->format('Y-m-d'),
                'expected_delivery_date' => $po->expected_delivery_date?->format('Y-m-d'),
                'po_date' => $po->po_date?->format('Y-m-d'),
                'delivery_date' => $po->delivery_date?->format('Y-m-d'),
                'currency' => $po->currency,
                'exchange_rate' => $po->exchange_rate,
                'total_quantity' => $po->total_quantity,
                'total_value' => $po->total_value,
                'payment_terms' => $po->payment_terms,
                'payment_terms_structured' => $po->payment_terms_structured,
                'incoterms' => $po->incoterms,
                'destination_port' => $po->destination_port,
                'destination_country' => $po->destination_country,
                'special_instructions' => $po->special_instructions,
                'internal_notes' => $po->internal_notes,
                'additional_notes' => $po->additional_notes,
                'notes' => $po->additional_notes,
                'status' => $po->status,
                'metadata' => $po->metadata,
                // Enhanced PO fields
                'revision_date' => $po->revision_date?->format('Y-m-d'),
                'etd_date' => $po->etd_date?->format('Y-m-d'),
                'eta_date' => $po->eta_date?->format('Y-m-d'),
                'in_warehouse_date' => $po->in_warehouse_date?->format('Y-m-d'),
                'ship_from' => $po->ship_from,
                'ship_to' => $po->ship_to,
                'manufacturer' => $po->manufacturer,
                'ship_to_address' => $po->ship_to_address,
                'sample_schedule' => $po->sample_schedule,
                // REMOVED: buyer_details - moved to Style creation
                'packing_guidelines' => $po->packing_guidelines,
                // Master data foreign keys
                // 'brand_id' removed - brand is in Style
                'season_id' => $po->season_id,
                'retailer_id' => $po->retailer_id,
                'retailer' => $po->retailer,
                'country_id' => $po->country_id,
                'warehouse_id' => $po->warehouse_id,
                'agent_id' => $po->agent_id,
                'vendor_id' => $po->vendor_id,
                // NOTE: shipping_term is per-style in pivot table, not at PO level
                'payment_term' => $po->payment_term,
                'country_of_origin' => $po->country_of_origin,
                'packing_method' => $po->packing_method,
                'other_terms' => $po->other_terms,
                'shipping_method' => $po->metadata['shipping_method'] ?? null,
                'terms_of_delivery' => $po->terms_of_delivery,
                'styles' => $po->styles->map(function ($style) {
                    return [
                        'id' => $style->id,
                        'style_number' => $style->style_number,
                        'description' => $style->description,
                        'fabric' => $style->fabric,
                        'color' => $style->color,
                        'quantity' => $style->quantity,
                        'unit_price' => $style->unit_price,
                        'total_price' => $style->total_price,
                        'size_breakdown' => $style->size_breakdown,
                        'packing_details' => $style->packing_details,
                        'assigned_factory' => $style->assignedFactory ? [
                            'id' => $style->assignedFactory->id,
                            'name' => $style->assignedFactory->name,
                            'company' => $style->assignedFactory->company,
                        ] : null,
                        'assignment_type' => $style->assignment_type,
                        'status' => $style->status,
                    ];
                }),
                'created_at' => $po->created_at,
                'updated_at' => $po->updated_at,
            ],
        ]);
    }

    /**
     * Create new purchase order
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'po_number' => 'required|string|max:50|unique:purchase_orders,po_number',
            'headline' => 'nullable|string|max:255',
            'retailer' => 'nullable|string|max:255', // Backward compatibility
            'retailer_id' => 'nullable|exists:retailers,id',
            'po_date' => 'required|date',
            'currency' => 'nullable|string|max:10', // Changed from max:3 to support currency_id
            'currency_id' => 'nullable|exists:currencies,id', // NEW: Currency selection with + button
            'exchange_rate' => 'nullable|numeric|min:0',
            'payment_terms' => 'nullable|string',
            'payment_term_id' => 'nullable|exists:payment_terms,id', // NEW: Dynamic payment term
            'payment_terms_structured' => 'nullable|array', // For structured payment terms
            'payment_terms_structured.term' => 'nullable|string',
            'payment_terms_structured.percentage' => 'nullable|numeric|min:0|max:100',
            'terms_of_delivery' => 'nullable|string',
            'destination_country' => 'nullable|string|max:100',
            'additional_notes' => 'nullable|string',
            'agency_id' => 'nullable|exists:users,id',
            'status' => 'nullable|string|max:50',
            // Enhanced PO fields
            'revision_date' => 'nullable|date',
            'etd_date' => 'nullable|date', // Calculated based on shipping_term
            'eta_date' => 'nullable|date',
            'in_warehouse_date' => 'nullable|date', // Required for DDP
            'ex_factory_date' => 'nullable|date', // NEW: Required for FOB
            'ship_to' => 'nullable|string|max:100',
            'ship_to_address' => 'nullable|string',
            'sample_schedule' => 'nullable|array',
            'sample_schedule.general_approval' => 'nullable|date',
            'sample_schedule.first_pp' => 'nullable|date',
            'sample_schedule.sms' => 'nullable|date',
            'sample_schedule.top' => 'nullable|date',
            // REMOVED: buyer_details validation - moved to Style creation
            'packing_guidelines' => 'nullable|string',
            // Master data foreign keys (removed: division_id, customer_id)
            // 'brand_id' removed - brand is in Style
            'season_id' => 'nullable|exists:seasons,id',
            'retailer_id' => 'nullable|exists:retailers,id',
            'country_id' => 'nullable|exists:countries,id',
            'warehouse_id' => 'nullable|exists:warehouses,id',
            'agent_id' => 'nullable|exists:agents,id',
            'vendor_id' => 'nullable|exists:vendors,id',
            // Price/Shipping term - determines date calculation logic
            'shipping_term' => 'nullable|in:FOB,DDP',
            // Additional fields (removed: manufacturer, ship_from, loading_port)
            'payment_term' => 'nullable|string|max:100',
            'country_of_origin' => 'nullable|string|max:100',
            'packing_method' => 'nullable|string',
            'other_terms' => 'nullable|string',
            // Styles during PO creation
            'styles' => 'nullable|array',
            'styles.*.style_id' => 'required|exists:styles,id',
            'styles.*.quantity' => 'required|integer|min:1',
            'styles.*.ratio' => 'nullable|array',
            'styles.*.unit_price_in_po' => 'nullable|numeric|min:0',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        // VALIDATION: Either agent_id or vendor_id (factory) must be selected
        if (empty($request->agent_id) && empty($request->vendor_id)) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => [
                    'agent_id' => ['Either Agent or Factory (Vendor) must be selected'],
                    'vendor_id' => ['Either Agent or Factory (Vendor) must be selected'],
                ]
            ], 422);
        }

        // VALIDATION: If payment term requires percentage (e.g., ADVANCE), percentage is compulsory
        $paymentTermsStructured = $request->payment_terms_structured;
        $requiresPercentage = false;

        // Check if selected payment_term_id requires percentage
        if ($request->filled('payment_term_id')) {
            $paymentTermModel = \App\Models\PaymentTerm::find($request->payment_term_id);
            if ($paymentTermModel && $paymentTermModel->requires_percentage) {
                $requiresPercentage = true;
            }
        }

        // Also check legacy term field for backward compatibility
        if ($paymentTermsStructured &&
            isset($paymentTermsStructured['term']) &&
            strtoupper($paymentTermsStructured['term']) === 'ADVANCE') {
            $requiresPercentage = true;
        }

        if ($requiresPercentage) {
            if (!isset($paymentTermsStructured['percentage']) || $paymentTermsStructured['percentage'] === null) {
                return response()->json([
                    'message' => 'Validation failed',
                    'errors' => [
                        'payment_terms_structured.percentage' => ['Percentage is required for this payment term'],
                    ]
                ], 422);
            }
        }

        // DATE CALCULATION BASED ON SHIPPING TERM
        $etdDate = $request->etd_date;
        $exFactoryDate = $request->ex_factory_date;
        $etaDate = $request->eta_date;
        $inWarehouseDate = $request->in_warehouse_date;
        $shippingTerm = $request->shipping_term ?? 'FOB';

        if ($shippingTerm === 'FOB') {
            // FOB: User inputs ETD
            // Ex-Factory = ETD - 7 days
            // ETA = ETD + sailing_time_days
            // IHD (In-Warehouse) = ETA + 5 days
            if ($request->filled('etd_date') && $request->filled('country_id')) {
                $country = \App\Models\Country::find($request->country_id);
                $sailingDays = $country ? ($country->sailing_time_days ?? 0) : 0;

                // Ex-Factory = ETD - 7 days (if not provided)
                if (empty($exFactoryDate)) {
                    $exFactoryDate = \Carbon\Carbon::parse($request->etd_date)->subDays(7)->format('Y-m-d');
                }

                // ETA = ETD + sailing time (if not provided)
                if (empty($etaDate)) {
                    $etaDate = \Carbon\Carbon::parse($request->etd_date)->addDays($sailingDays)->format('Y-m-d');
                }

                // IHD (In-Warehouse) = ETA + 5 days (if not provided)
                if (empty($inWarehouseDate) && $etaDate) {
                    $inWarehouseDate = \Carbon\Carbon::parse($etaDate)->addDays(5)->format('Y-m-d');
                }
            }
        } elseif ($shippingTerm === 'DDP') {
            // DDP: ETD = in_warehouse_date - transit_time - 5 days
            if ($request->filled('in_warehouse_date') && $request->filled('country_id') && empty($etdDate)) {
                $country = \App\Models\Country::find($request->country_id);
                $transitDays = $country ? ($country->sailing_time_days ?? 0) : 0;
                $etdDate = \Carbon\Carbon::parse($request->in_warehouse_date)
                    ->subDays($transitDays)
                    ->subDays(5)
                    ->format('Y-m-d');
            }
        }

        // Verify agency has Agency role if provided
        if ($request->filled('agency_id')) {
            $agency = User::find($request->agency_id);
            if (!$agency->hasRole('Agency')) {
                return response()->json([
                    'message' => 'The selected user is not an agency',
                ], 422);
            }
        }

        // Fetch retailer name from retailer_id for backward compatibility
        $retailerName = null;
        if ($request->retailer_id) {
            $retailer = Retailer::find($request->retailer_id);
            $retailerName = $retailer ? $retailer->name : null;
        }

        // Get currency code from currency_id if provided
        $currencyCode = $request->currency; // Default to legacy currency field
        if ($request->filled('currency_id')) {
            $currency = \App\Models\Currency::find($request->currency_id);
            $currencyCode = $currency ? $currency->code : $currencyCode;
        }

        $po = PurchaseOrder::create([
            'po_number' => $request->po_number,
            'headline' => $request->headline,
            'importer_id' => $request->user()->id,
            'creator_id' => $request->user()->id,
            'agency_id' => $request->agency_id,
            'retailer' => $retailerName, // Backward compatibility - fetch from retailer_id
            'po_date' => $request->po_date,
            'currency' => $currencyCode, // Currency code (from currency_id or legacy field)
            'currency_id' => $request->currency_id, // NEW: Store foreign key
            'exchange_rate' => $request->exchange_rate ?? 1.0,
            'payment_terms' => $request->payment_terms,
            'payment_term_id' => $request->payment_term_id, // NEW: Dynamic payment term foreign key
            'payment_terms_structured' => $request->payment_terms_structured,
            'terms_of_delivery' => $request->terms_of_delivery,
            'destination_country' => $request->destination_country,
            'additional_notes' => $request->additional_notes,
            'status' => $request->get('status', 'draft'),
            'total_styles' => 0,
            'total_quantity' => 0,
            'total_value' => 0,
            // Enhanced PO fields (removed: ship_from, manufacturer)
            'revision_date' => $request->revision_date,
            'etd_date' => $etdDate, // Use provided or calculated ETD
            'ex_factory_date' => $exFactoryDate, // Auto-calculated for FOB: ETD - 7 days
            'eta_date' => $etaDate, // Auto-calculated: ETD + sailing time
            'in_warehouse_date' => $inWarehouseDate, // Auto-calculated for FOB: ETA + 5 days (IHD)
            'ship_to' => $request->ship_to,
            'ship_to_address' => $request->ship_to_address,
            'sample_schedule' => $request->sample_schedule,
            // REMOVED: buyer_details - moved to Style creation
            'packing_guidelines' => $request->packing_guidelines,
            // Master data foreign keys (removed: division_id, customer_id)
            // 'brand_id' removed - brand is in Style
            'season_id' => $request->season_id,
            'retailer_id' => $request->retailer_id,
            'country_id' => $request->country_id,
            'warehouse_id' => $request->warehouse_id,
            'agent_id' => $request->agent_id,
            'vendor_id' => $request->vendor_id,
            // Shipping term (FOB/DDP) - stored at PO level
            'shipping_term' => $shippingTerm,
            // Additional fields (removed: loading_port)
            'payment_term' => $request->payment_term,
            'country_of_origin' => $request->country_of_origin,
            'packing_method' => $request->packing_method,
            'other_terms' => $request->other_terms,
        ]);

        // Attach styles if provided
        if ($request->has('styles') && is_array($request->styles)) {
            foreach ($request->styles as $styleData) {
                $po->styles()->attach($styleData['style_id'], [
                    'quantity_in_po' => $styleData['quantity'],
                    'ratio' => $styleData['ratio'] ?? null,
                    'unit_price_in_po' => $styleData['unit_price_in_po'] ?? null,
                    'shipping_term' => $request->shipping_term ?? 'FOB', // Changed from price_term
                ]);
            }

            // Recalculate PO totals after adding styles
            $po->updateTotals();
        }

        // Log creation
        $this->activityLog->logCreated('PurchaseOrder', $po->id, [
            'po_number' => $po->po_number,
            'retailer' => $po->retailer,
        ]);

        // Auto-generate TNA chart for this PO
        try {
            $tnaService = app(TNAChartService::class);
            $tnaService->generateTNAChart($po);
        } catch (\Exception $e) {
            // Log the error but don't fail PO creation
            \Log::error('Failed to auto-generate TNA chart for PO ' . $po->id . ': ' . $e->getMessage());
        }

        return response()->json([
            'message' => 'Purchase order created successfully',
            'purchase_order' => [
                'id' => $po->id,
                'po_number' => $po->po_number,
                'brand_name' => $po->brand_name,
                'status' => $po->status,
            ],
        ], 201);
    }

    /**
     * Update purchase order
     */
    public function update(Request $request, $id)
    {
        $user = $request->user();
        $po = PurchaseOrder::findOrFail($id);

        // Check permission
        if (!$this->permissionService->canAccessPO($user, $po) || !$user->hasPermissionTo('po.edit')) {
            return response()->json([
                'message' => 'You do not have permission to edit this purchase order',
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'po_number' => 'required|string|max:50|unique:purchase_orders,po_number,' . $id,
            'headline' => 'nullable|string|max:255',
            'retailer' => 'nullable|string|max:255', // Backward compatibility
            'retailer_id' => 'nullable|exists:retailers,id',
            'po_date' => 'required|date',
            'currency' => 'nullable|string|max:10',
            'currency_id' => 'nullable|exists:currencies,id',
            'exchange_rate' => 'nullable|numeric|min:0',
            'payment_terms' => 'nullable|string',
            'payment_term_id' => 'nullable|exists:payment_terms,id', // NEW: Dynamic payment term
            'payment_terms_structured' => 'nullable|array', // For structured payment terms
            'payment_terms_structured.term' => 'nullable|string',
            'payment_terms_structured.percentage' => 'nullable|numeric|min:0|max:100',
            'terms_of_delivery' => 'nullable|string',
            'destination_country' => 'nullable|string|max:100',
            'additional_notes' => 'nullable|string',
            'agency_id' => 'nullable|exists:users,id',
            'status' => 'nullable|string|max:50',
            // Enhanced PO fields
            'revision_date' => 'nullable|date',
            'ex_factory_date' => 'nullable|date', // For FOB shipping term
            'etd_date' => 'nullable|date', // Auto-calculated based on shipping term
            'eta_date' => 'nullable|date',
            'in_warehouse_date' => 'nullable|date',
            'ship_to' => 'nullable|string|max:100',
            'ship_to_address' => 'nullable|string',
            'sample_schedule' => 'nullable|array',
            'sample_schedule.general_approval' => 'nullable|date',
            'sample_schedule.first_pp' => 'nullable|date',
            'sample_schedule.sms' => 'nullable|date',
            'sample_schedule.top' => 'nullable|date',
            // REMOVED: buyer_details validation - moved to Style creation
            'packing_guidelines' => 'nullable|string',
            // Master data foreign keys (removed: division_id, customer_id)
            // 'brand_id' removed - brand is in Style
            'season_id' => 'nullable|exists:seasons,id',
            'retailer_id' => 'nullable|exists:retailers,id',
            'country_id' => 'nullable|exists:countries,id',
            'warehouse_id' => 'nullable|exists:warehouses,id',
            'agent_id' => 'nullable|exists:agents,id',
            'vendor_id' => 'nullable|exists:vendors,id',
            // Price term
            'shipping_term' => 'nullable|in:FOB,DDP',
            // Additional fields (removed: manufacturer, ship_from, loading_port)
            'payment_term' => 'nullable|string|max:100',
            'country_of_origin' => 'nullable|string|max:100',
            'packing_method' => 'nullable|string',
            'other_terms' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        // Verify agency has Agency role if provided
        if ($request->filled('agency_id')) {
            $agency = User::find($request->agency_id);
            if (!$agency->hasRole('Agency')) {
                return response()->json([
                    'message' => 'The selected user is not an agency',
                ], 422);
            }
        }

        $oldData = [
            'po_number' => $po->po_number,
            'retailer' => $po->retailer,
            'status' => $po->status,
            'agency_id' => $po->agency_id,
        ];

        // Fetch retailer name from retailer_id for backward compatibility
        $retailerName = $request->retailer; // Keep if provided directly
        if ($request->filled('retailer_id') && !$request->filled('retailer')) {
            $retailer = Retailer::find($request->retailer_id);
            $retailerName = $retailer ? $retailer->name : $po->retailer;
        }

        // Get currency code from currency_id if provided
        $currencyCode = $request->currency ?? $po->currency;
        if ($request->filled('currency_id')) {
            $currency = \App\Models\Currency::find($request->currency_id);
            $currencyCode = $currency ? $currency->code : $currencyCode;
        }

        $po->update([
            'po_number' => $request->po_number,
            'headline' => $request->headline,
            'retailer' => $retailerName, // Backward compatibility - fetch from retailer_id if needed
            'po_date' => $request->po_date,
            'currency' => $currencyCode, // Currency code (from currency_id or legacy field)
            'currency_id' => $request->currency_id ?? $po->currency_id,
            'exchange_rate' => $request->exchange_rate ?? $po->exchange_rate,
            'payment_terms' => $request->payment_terms,
            'payment_term_id' => $request->payment_term_id ?? $po->payment_term_id,
            'payment_terms_structured' => $request->payment_terms_structured ?? $po->payment_terms_structured,
            'terms_of_delivery' => $request->terms_of_delivery,
            'destination_country' => $request->destination_country,
            'additional_notes' => $request->additional_notes,
            'agency_id' => $request->agency_id,
            'status' => $request->get('status', $po->status),
            // Enhanced PO fields (removed: ship_from, manufacturer)
            'revision_date' => $request->revision_date,
            'ex_factory_date' => $request->ex_factory_date, // For FOB shipping term
            'etd_date' => $request->etd_date,
            'eta_date' => $request->eta_date,
            'in_warehouse_date' => $request->in_warehouse_date,
            'ship_to' => $request->ship_to,
            'ship_to_address' => $request->ship_to_address,
            'sample_schedule' => $request->sample_schedule,
            // REMOVED: buyer_details - moved to Style creation
            'packing_guidelines' => $request->packing_guidelines,
            // Master data foreign keys (removed: division_id, customer_id)
            // 'brand_id' removed - brand is in Style
            'season_id' => $request->season_id,
            'retailer_id' => $request->retailer_id,
            'country_id' => $request->country_id,
            'warehouse_id' => $request->warehouse_id,
            'agent_id' => $request->agent_id,
            'vendor_id' => $request->vendor_id,
            // Shipping term (FOB/DDP) - stored at PO level
            'shipping_term' => $request->shipping_term ?? $po->shipping_term,
            // Additional fields (removed: loading_port)
            'payment_term' => $request->payment_term,
            'country_of_origin' => $request->country_of_origin,
            'packing_method' => $request->packing_method,
            'other_terms' => $request->other_terms,
        ]);

        $newData = [
            'po_number' => $po->po_number,
            'retailer' => $po->retailer,
            'status' => $po->status,
            'agency_id' => $po->agency_id,
        ];

        // Log update
        $this->activityLog->logUpdated('PurchaseOrder', $po->id, $oldData, $newData);

        return response()->json([
            'message' => 'Purchase order updated successfully',
            'purchase_order' => [
                'id' => $po->id,
                'po_number' => $po->po_number,
                'brand_name' => $po->brand_name,
                'status' => $po->status,
            ],
        ]);
    }

    /**
     * Delete purchase order
     */
    public function destroy(Request $request, $id)
    {
        $user = $request->user();
        $po = PurchaseOrder::findOrFail($id);

        // Check permission
        if (!$this->permissionService->canAccessPO($user, $po) || !$user->hasPermissionTo('po.delete')) {
            return response()->json([
                'message' => 'You do not have permission to delete this purchase order',
            ], 403);
        }

        // Check if PO has styles
        if ($po->styles()->exists()) {
            return response()->json([
                'message' => 'Cannot delete purchase order with existing styles. Delete styles first.',
                'styles_count' => $po->styles()->count(),
            ], 422);
        }

        $poData = [
            'po_number' => $po->po_number,
            'brand_name' => $po->brand_name,
        ];

        // Log deletion
        $this->activityLog->logDeleted('PurchaseOrder', $po->id, $poData);

        $po->delete();

        return response()->json([
            'message' => 'Purchase order deleted successfully',
        ]);
    }

    /**
     * Update PO status
     */
    public function updateStatus(Request $request, $id)
    {
        $user = $request->user();
        $po = PurchaseOrder::findOrFail($id);

        // Check permission
        if (!$this->permissionService->canAccessPO($user, $po) || !$user->hasPermissionTo('po.edit')) {
            return response()->json([
                'message' => 'You do not have permission to update this purchase order status',
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'status' => 'required|string|max:50',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $oldStatus = $po->status;
        $po->status = $request->status;
        $po->save();

        // Log status change
        $this->activityLog->log(
            'status_changed',
            'PurchaseOrder',
            $po->id,
            "PO status changed from {$oldStatus} to {$request->status}",
            [
                'old_status' => $oldStatus,
                'new_status' => $request->status,
            ]
        );

        return response()->json([
            'message' => 'Purchase order status updated successfully',
            'status' => $po->status,
        ]);
    }

    /**
     * Recalculate PO totals from styles
     */
    public function recalculateTotals(Request $request, $id)
    {
        $user = $request->user();
        $po = PurchaseOrder::findOrFail($id);

        // Check permission
        if (!$this->permissionService->canAccessPO($user, $po)) {
            return response()->json([
                'message' => 'You do not have permission to access this purchase order',
            ], 403);
        }

        $oldQuantity = $po->total_quantity;
        $oldValue = $po->total_value;

        $po->updateTotals();

        // Log recalculation
        $this->activityLog->log(
            'totals_recalculated',
            'PurchaseOrder',
            $po->id,
            'PO totals recalculated',
            [
                'old_quantity' => $oldQuantity,
                'new_quantity' => $po->total_quantity,
                'old_value' => $oldValue,
                'new_value' => $po->total_value,
            ]
        );

        return response()->json([
            'message' => 'Purchase order totals recalculated successfully',
            'totals' => [
                'total_quantity' => $po->total_quantity,
                'total_value' => $po->total_value,
            ],
        ]);
    }

    /**
     * Get PO statistics
     */
    public function statistics(Request $request)
    {
        $user = $request->user();
        $query = PurchaseOrder::query();

        // Apply permission-based filtering
        if ($user->hasPermissionTo('po.view_all')) {
            // Can view all POs - no filtering needed
        } elseif ($user->hasPermissionTo('po.view_own')) {
            // Can view own POs - filter by accessible IDs
            $accessibleIds = $this->permissionService->getAccessiblePOIds($user);
            $query->whereIn('id', $accessibleIds);
        } elseif ($user->hasPermissionTo('po.view')) {
            // Basic view permission - show all PO statistics (read-only)
            // No filtering needed
        } else {
            return response()->json([
                'message' => 'You do not have permission to view purchase order statistics',
            ], 403);
        }

        $total = $query->count();
        $byStatus = DB::table('purchase_orders')
            ->select('status', DB::raw('count(*) as count'))
            ->groupBy('status')
            ->get();

        $totalValue = $query->sum('total_value');
        $totalQuantity = $query->sum('total_quantity');

        return response()->json([
            'statistics' => [
                'total_pos' => $total,
                'by_status' => $byStatus,
                'total_value' => $totalValue,
                'total_quantity' => $totalQuantity,
            ],
        ]);
    }

    /**
     * Generate next PO number
     */
    public function generatePONumber(Request $request)
    {
        $poNumberService = app(PONumberService::class);
        $year = $request->get('year');

        $poNumber = $poNumberService->getNextAvailablePONumber($year);

        return response()->json([
            'po_number' => $poNumber,
            'stats' => $poNumberService->getYearStats($year),
        ]);
    }

    /**
     * Calculate shipping dates based on ETD and country
     */
    public function calculateDates(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'etd_date' => 'required|date',
            'country_id' => 'required|exists:countries,id',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $dateService = app(DateCalculationService::class);
        $dates = $dateService->calculateShippingDates(
            $request->etd_date,
            $request->country_id
        );

        return response()->json([
            'etd_date' => $request->etd_date,
            'eta_date' => $dates['eta'] ? $dates['eta']->format('Y-m-d') : null,
            'in_warehouse_date' => $dates['in_warehouse'] ? $dates['in_warehouse']->format('Y-m-d') : null,
        ]);
    }

    /**
     * Get sample schedule for a PO or based on dates
     */
    public function getSampleSchedule(Request $request, $id = null)
    {
        if ($id) {
            // Get schedule for existing PO
            $po = PurchaseOrder::findOrFail($id);

            if (!$po->po_date || !$po->etd_date) {
                return response()->json([
                    'message' => 'PO must have both PO date and ETD date to generate schedule',
                ], 400);
            }

            $scheduleService = app(SampleScheduleService::class);
            $schedule = $scheduleService->generateSchedule($po->po_date, $po->etd_date);
            $validation = $scheduleService->validateSchedule($po->po_date, $po->etd_date);

            return response()->json([
                'po_number' => $po->po_number,
                'schedule' => $schedule,
                'validation' => $validation,
            ]);
        } else {
            // Calculate schedule based on provided dates
            $validator = Validator::make($request->all(), [
                'po_date' => 'required|date',
                'etd_date' => 'required|date|after:po_date',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'message' => 'Validation failed',
                    'errors' => $validator->errors()
                ], 422);
            }

            $scheduleService = app(SampleScheduleService::class);
            $schedule = $scheduleService->generateSchedule($request->po_date, $request->etd_date);
            $validation = $scheduleService->validateSchedule($request->po_date, $request->etd_date);

            return response()->json([
                'schedule' => $schedule,
                'validation' => $validation,
            ]);
        }
    }

    /**
     * Generate TNA chart for a PO
     */
    public function generateTNAChart($id)
    {
        $po = PurchaseOrder::with(['retailer', 'country'])->findOrFail($id);

        if (!$po->po_date || !$po->etd_date) {
            return response()->json([
                'message' => 'PO must have both PO date and ETD date to generate TNA chart',
            ], 400);
        }

        $tnaService = app(TNAChartService::class);

        // Delete old charts
        $tnaService->deleteOldTNACharts($po);

        // Generate new chart
        $filePath = $tnaService->generateTNAChart($po);

        // Log activity
        $this->activityLog->log(
            'tna_chart_generated',
            'PurchaseOrder',
            $po->id,
            'TNA chart generated for PO ' . $po->po_number,
            ['file_path' => $filePath]
        );

        return response()->json([
            'message' => 'TNA chart generated successfully',
            'file_path' => $filePath,
            'download_url' => Storage::url($filePath),
        ]);
    }

    /**
     * Download TNA chart for a PO
     */
    public function downloadTNAChart($id)
    {
        $po = PurchaseOrder::findOrFail($id);
        $tnaService = app(TNAChartService::class);

        $filePath = $tnaService->getTNAChartPath($po);

        if (!$filePath) {
            return response()->json([
                'message' => 'TNA chart not found. Please generate it first.',
            ], 404);
        }

        return Storage::disk('public')->download($filePath);
    }
}
