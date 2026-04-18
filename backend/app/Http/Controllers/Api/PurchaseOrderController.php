<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PurchaseOrder;
use App\Models\User;
use App\Services\ActivityLogService;
use App\Services\PermissionService;
use App\Services\PONumberService;
use App\Services\DateCalculationService;
use App\Services\SampleScheduleService;
use App\Models\Style;
use App\Models\PurchaseOrderStyle;
use App\Services\TNAChartService;
use App\Jobs\SendPurchaseOrderNotification;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Broadcast;

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
        $isExcelView = $request->get('view') === 'excel';

        // Eager-load relationships based on view mode
        // For Factory users, constrain styles eager load to only their assigned styles
        $isFactory = $user->hasRole('Factory');
        $factoryUserId = $user->id;
        $stylesConstraint = $isFactory
            ? ['styles' => function ($query) use ($factoryUserId) {
                $query->wherePivot('assigned_factory_id', $factoryUserId);
            }]
            : ['styles'];

        if ($isExcelView) {
            $query = PurchaseOrder::with(array_merge([
                'importer', 'agency',
                'retailer', 'season', 'country', 'warehouse', 'currency',
            ], $stylesConstraint));
        } else {
            $query = PurchaseOrder::with(array_merge(['importer', 'agency'], $stylesConstraint));
        }

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

        // Shipping term filter
        if ($request->has('shipping_term')) {
            $query->where('shipping_term', $request->shipping_term);
        }

        // Retailer filter
        if ($request->has('retailer_id')) {
            $query->where('retailer_id', $request->retailer_id);
        }

        // Season filter
        if ($request->has('season_id')) {
            $query->where('season_id', $request->season_id);
        }

        // Country filter
        if ($request->has('country_id')) {
            $query->where('country_id', $request->country_id);
        }

        // Search filter
        if ($request->has('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('po_number', 'like', "%{$search}%")
                  ->orWhere('headline', 'like', "%{$search}%");
            });
        }

        // Date range filter (using po_date)
        if ($request->has('date_from')) {
            $query->where('po_date', '>=', $request->date_from);
        }

        if ($request->has('date_to')) {
            $query->where('po_date', '<=', $request->date_to);
        }

        // Buyer filter
        if ($request->filled('buyer_id')) {
            $query->where('buyer_id', $request->buyer_id);
        }

        // Warehouse filter
        if ($request->filled('warehouse_id')) {
            $query->where('warehouse_id', $request->warehouse_id);
        }

        // Factory filter — match POs that have styles assigned to the given factory
        if ($request->filled('factory_id')) {
            $factoryId = $request->factory_id;
            $query->whereHas('styles', function ($q) use ($factoryId) {
                $q->where('purchase_order_style.assigned_factory_id', $factoryId);
            });
        }

        // ETD date range
        if ($request->filled('etd_date_from')) {
            $query->where('etd_date', '>=', $request->etd_date_from);
        }
        if ($request->filled('etd_date_to')) {
            $query->where('etd_date', '<=', $request->etd_date_to);
        }

        // Ex-factory date range
        if ($request->filled('ex_factory_date_from')) {
            $query->where('ex_factory_date', '>=', $request->ex_factory_date_from);
        }
        if ($request->filled('ex_factory_date_to')) {
            $query->where('ex_factory_date', '<=', $request->ex_factory_date_to);
        }

        // Total value range
        if ($request->filled('total_value_min')) {
            $query->where('total_value', '>=', $request->total_value_min);
        }
        if ($request->filled('total_value_max')) {
            $query->where('total_value', '<=', $request->total_value_max);
        }

        // Total quantity range
        if ($request->filled('total_quantity_min')) {
            $query->where('total_quantity', '>=', $request->total_quantity_min);
        }
        if ($request->filled('total_quantity_max')) {
            $query->where('total_quantity', '<=', $request->total_quantity_max);
        }

        // Revised only (has at least one revision)
        if ($request->boolean('revised')) {
            $query->where('revision_number', '>', 0);
        }

        // Overdue ETD — ETD in the past and PO not completed/cancelled
        if ($request->boolean('overdue_etd')) {
            $query->whereNotNull('etd_date')
                  ->whereDate('etd_date', '<', now()->toDateString())
                  ->whereNotIn('status', ['completed', 'cancelled']);
        }

        // Sorting — handle join-based sorting for related fields
        $sortBy = $request->get('sort_by', 'created_at');
        $sortOrder = $request->get('sort_order', 'desc');

        $joinSortFields = [
            'retailer' => ['retailers', 'retailer_id'],
            'season' => ['seasons', 'season_id'],
        ];

        if (isset($joinSortFields[$sortBy])) {
            [$joinTable, $foreignKey] = $joinSortFields[$sortBy];
            $query->leftJoin($joinTable, "purchase_orders.{$foreignKey}", '=', "{$joinTable}.id")
                ->orderBy("{$joinTable}.name", $sortOrder)
                ->select('purchase_orders.*');
        } else {
            $query->orderBy($sortBy, $sortOrder);
        }

        // Pagination — allow up to 100 for Excel view
        $perPage = min((int) $request->get('per_page', $isExcelView ? 50 : 15), $isExcelView ? 100 : 50);
        $pos = $query->paginate($perPage);

        // Helper to get styles - factory filtering is already applied via eager load constraint
        $getVisibleStyles = function ($po) {
            return $po->styles;
        };

        // Return enriched data for Excel view
        if ($isExcelView) {
            // Batch-load factory names from pivot assigned_factory_id to avoid N+1
            $factoryIds = $pos->flatMap(function ($po) {
                return $po->styles->pluck('pivot.assigned_factory_id');
            })->filter()->unique()->values();
            $factoryNames = $factoryIds->isNotEmpty()
                ? User::whereIn('id', $factoryIds)->pluck('name', 'id')
                : collect();

            return response()->json([
                'data' => $pos->map(function ($po) use ($factoryNames, $getVisibleStyles) {
                    $visibleStyles = $getVisibleStyles($po);
                    return [
                        'id' => $po->id,
                        'po_number' => $po->po_number,
                        'headline' => $po->headline,
                        'status' => $po->status,
                        'allowed_transitions' => $this->getAllowedTransitions($po->status),
                        'po_date' => $po->po_date?->format('Y-m-d'),
                        'revision_date' => $po->revision_date?->format('Y-m-d'),
                        'shipping_term' => $po->shipping_term,
                        'etd_date' => $po->etd_date?->format('Y-m-d'),
                        'eta_date' => $po->eta_date?->format('Y-m-d'),
                        'ex_factory_date' => $po->ex_factory_date?->format('Y-m-d'),
                        'in_warehouse_date' => $po->in_warehouse_date?->format('Y-m-d'),
                        'total_quantity' => $po->total_quantity,
                        'total_value' => $po->total_value,
                        'styles_count' => $visibleStyles->count(),
                        'payment_terms' => $po->payment_term,
                        'ship_to' => $po->ship_to,
                        'importer' => $po->importer_id ? [
                            'id' => $po->getRelation('importer')?->id,
                            'name' => $po->getRelation('importer')?->name,
                            'company' => $po->getRelation('importer')?->company,
                        ] : null,
                        'agency' => $po->agency_id ? [
                            'id' => $po->getRelation('agency')?->id,
                            'name' => $po->getRelation('agency')?->name,
                            'company' => $po->getRelation('agency')?->company,
                        ] : null,
                        'retailer' => $po->retailer_id ? [
                            'id' => $po->getRelation('retailer')?->id,
                            'name' => $po->getRelation('retailer')?->name,
                        ] : null,
                        'season' => $po->season_id ? [
                            'id' => $po->getRelation('season')?->id,
                            'name' => $po->getRelation('season')?->name,
                        ] : null,
                        'country' => $po->country_id ? [
                            'id' => $po->getRelation('country')?->id,
                            'name' => $po->getRelation('country')?->name,
                        ] : null,
                        'warehouse' => $po->warehouse_id ? [
                            'id' => $po->getRelation('warehouse')?->id,
                            'name' => $po->getRelation('warehouse')?->name,
                        ] : null,
                        'currency' => $po->currency_id ? [
                            'id' => $po->getRelation('currency')?->id,
                            'code' => $po->getRelation('currency')?->code,
                            'symbol' => $po->getRelation('currency')?->symbol ?? '',
                        ] : null,
                        'styles' => $visibleStyles->map(function ($style) use ($factoryNames) {
                            $pivotFactoryId = $style->pivot->assigned_factory_id;
                            return [
                                'id' => $style->id,
                                'style_number' => $style->style_number,
                                'description' => $style->description,
                                'color_name' => $style->color_name ?? ($style->color?->name ?? null),
                                'quantity_in_po' => $style->pivot->quantity_in_po,
                                'unit_price_in_po' => $style->pivot->unit_price_in_po,
                                'total_price' => ($style->pivot->quantity_in_po ?? 0) * ($style->pivot->unit_price_in_po ?? 0),
                                'production_status' => $style->pivot->status,
                                'shipping_approval_status' => null,
                                'assigned_factory' => $pivotFactoryId ? ($factoryNames[$pivotFactoryId] ?? null) : null,
                                'assignment_type' => $style->pivot->assignment_type,
                                'ex_factory_date' => $style->pivot->ex_factory_date,
                                'target_shipment_date' => $style->pivot->target_shipment_date,
                            ];
                        }),
                        'created_at' => $po->created_at,
                    ];
                }),
                'current_page' => $pos->currentPage(),
                'last_page' => $pos->lastPage(),
                'per_page' => $pos->perPage(),
                'total' => $pos->total(),
            ]);
        }

        return response()->json([
            'data' => $pos->map(function ($po) use ($getVisibleStyles) {
                $importerRel = $po->getRelation('importer');
                $agencyRel   = $po->getRelation('agency');
                return [
                    'id' => $po->id,
                    'po_number' => $po->po_number,
                    'headline' => $po->headline,
                    'importer' => $importerRel ? [
                        'id' => $importerRel->id,
                        'name' => $importerRel->name,
                        'company' => $importerRel->company,
                    ] : null,
                    'agency' => $agencyRel ? [
                        'id' => $agencyRel->id,
                        'name' => $agencyRel->name,
                        'company' => $agencyRel->company,
                    ] : null,
                    'po_date' => $po->po_date?->format('Y-m-d'),
                    'ex_factory_date' => $po->ex_factory_date?->format('Y-m-d'),
                    'etd_date' => $po->etd_date?->format('Y-m-d'),
                    'total_quantity' => $po->total_quantity,
                    'total_value' => $po->total_value,
                    'currency' => ($po->relationLoaded('currency') ? $po->getRelation('currency')?->code : null) ?? $po->getAttributes()['currency'] ?? 'USD',
                    'status' => $po->status,
                    'allowed_transitions' => $this->getAllowedTransitions($po->status),
                    'styles_count' => $getVisibleStyles($po)->count(),
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
        // For Factory users, constrain styles eager load to only their assigned styles
        $stylesEagerLoad = $user->hasRole('Factory')
            ? ['styles' => function ($query) use ($user) {
                $query->wherePivot('assigned_factory_id', $user->id);
            }]
            : ['styles'];

        $po = PurchaseOrder::with(array_merge(['importer', 'agency', 'currency'], $stylesEagerLoad))->findOrFail($id);

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
                'importer' => $po->getRelation('importer') ? [
                    'id' => $po->getRelation('importer')->id,
                    'name' => $po->getRelation('importer')->name,
                    'email' => $po->getRelation('importer')->email,
                    'company' => $po->getRelation('importer')->company,
                ] : null,
                'agency_id' => $po->agency_id,
                'agency' => $po->getRelation('agency') ? [
                    'id' => $po->getRelation('agency')->id,
                    'name' => $po->getRelation('agency')->name,
                    'email' => $po->getRelation('agency')->email,
                    'company' => $po->getRelation('agency')->company,
                ] : null,
                'po_date' => $po->po_date?->format('Y-m-d'),
                'total_quantity' => $po->total_quantity,
                'total_value' => $po->total_value,
                'currency_id' => $po->currency_id,
                'currency' => $po->getRelation('currency')?->code ?? 'USD',
                'exchange_rate' => $po->exchange_rate,
                'payment_term_id' => $po->payment_term_id,
                'buyer_id' => $po->buyer_id,
                'payment_terms' => $po->payment_terms,
                'payment_terms_structured' => $po->payment_terms_structured,
                'additional_notes' => $po->additional_notes,
                'status' => $po->status,
                'allowed_transitions' => $this->getAllowedTransitions($po->status),
                'metadata' => $po->metadata,
                'shipping_term' => $po->shipping_term,
                'revision_date' => $po->revision_date?->format('Y-m-d'),
                'ex_factory_date' => $po->ex_factory_date?->format('Y-m-d'),
                'etd_date' => $po->etd_date?->format('Y-m-d'),
                'eta_date' => $po->eta_date?->format('Y-m-d'),
                'in_warehouse_date' => $po->in_warehouse_date?->format('Y-m-d'),
                'ship_to' => $po->ship_to,
                'ship_to_address' => $po->ship_to_address,
                'sample_schedule' => $po->sample_schedule,
                'packing_guidelines' => $po->packing_guidelines,
                'season_id' => $po->season_id,
                'retailer_id' => $po->retailer_id,
                'country_id' => $po->country_id,
                'warehouse_id' => $po->warehouse_id,
                'payment_term' => $po->payment_term,
                'country_of_origin' => $po->country_of_origin,
                'packing_method' => $po->packing_method,
                'other_terms' => $po->other_terms,
                'shipping_method' => $po->metadata['shipping_method'] ?? null,
                'terms_of_delivery' => $po->terms_of_delivery,
                'styles' => $po->styles
                    ->map(function ($style) {
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
                        'pivot' => [
                            'assigned_factory_id' => $style->pivot->assigned_factory_id,
                            'assigned_agency_id' => $style->pivot->assigned_agency_id,
                            'assignment_type' => $style->pivot->assignment_type,
                            'status' => $style->pivot->status,
                            'quantity_in_po' => $style->pivot->quantity_in_po,
                            'unit_price_in_po' => $style->pivot->unit_price_in_po,
                        ],
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
            'retailer_id' => 'nullable|exists:retailers,id',
            'po_date' => 'required|date',
            'currency_id' => 'nullable|exists:currencies,id',
            'exchange_rate' => 'nullable|numeric|min:0',
            'payment_term_id' => 'nullable|exists:payment_terms,id',
            'payment_terms_structured' => 'nullable|array',
            'payment_terms_structured.term' => 'nullable|string',
            'payment_terms_structured.percentage' => 'nullable|numeric|min:0|max:100',
            'additional_notes' => 'nullable|string',
            'importer_id' => 'nullable|exists:users,id',
            'agency_id' => 'nullable|exists:users,id',
            'buyer_id' => 'nullable|exists:buyers,id',
            'revision_date' => 'nullable|date',
            'etd_date' => 'nullable|date',
            'eta_date' => 'nullable|date',
            'in_warehouse_date' => 'nullable|date',
            'ex_factory_date' => 'nullable|date',
            'ship_to' => 'nullable|string|max:100',
            'ship_to_address' => 'nullable|string',
            'sample_schedule' => 'nullable|array',
            'packing_guidelines' => 'nullable|string',
            'season_id' => 'nullable|exists:seasons,id',
            'country_id' => 'nullable|exists:countries,id',
            'warehouse_id' => 'nullable|exists:warehouses,id',
            'shipping_term' => 'nullable|in:FOB,DDP',
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

        // Validate payment term percentage if required
        $paymentTermsStructured = $request->payment_terms_structured;
        $requiresPercentage = false;

        if ($request->filled('payment_term_id')) {
            $paymentTermModel = \App\Models\PaymentTerm::find($request->payment_term_id);
            if ($paymentTermModel && $paymentTermModel->requires_percentage) {
                $requiresPercentage = true;
            }
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

        // Validate date sequence: po_date < ex_factory_date < etd_date < eta_date < in_warehouse_date
        if ($request->filled('po_date') && $request->filled('etd_date')) {
            if (strtotime($request->etd_date) <= strtotime($request->po_date)) {
                return response()->json([
                    'message' => 'Validation failed',
                    'errors' => ['etd_date' => ['ETD date must be after PO date']],
                ], 422);
            }
        }
        if ($request->filled('ex_factory_date') && $request->filled('etd_date')) {
            if (strtotime($request->etd_date) < strtotime($request->ex_factory_date)) {
                return response()->json([
                    'message' => 'Validation failed',
                    'errors' => ['etd_date' => ['ETD date must be on or after ex-factory date']],
                ], 422);
            }
        }
        if ($request->filled('eta_date') && $request->filled('etd_date')) {
            if (strtotime($request->eta_date) < strtotime($request->etd_date)) {
                return response()->json([
                    'message' => 'Validation failed',
                    'errors' => ['eta_date' => ['ETA date must be on or after ETD date']],
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

        // Verify importer has Importer role if provided
        if ($request->filled('importer_id')) {
            $importer = User::find($request->importer_id);
            if (!$importer->hasRole('Importer')) {
                return response()->json([
                    'message' => 'The selected user is not an importer',
                ], 422);
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

        // Determine importer_id and agency_id based on the creator's role
        $user = $request->user();
        $importerId = $request->importer_id;
        $agencyId = $request->agency_id;

        if ($user->hasRole('Agency')) {
            // Agency creating a PO: set themselves as the agency, importer is optional
            $agencyId = $agencyId ?? $user->id;
            // importer_id stays as provided (nullable)
        } else {
            // Importer or Super Admin: default importer to self if not specified
            $importerId = $importerId ?? $user->id;
        }

        $po = PurchaseOrder::create([
            'po_number' => $request->po_number,
            'headline' => $request->headline,
            'importer_id' => $importerId,
            'creator_id' => $user->id,
            'agency_id' => $agencyId,
            'buyer_id' => $request->buyer_id,
            'po_date' => $request->po_date,
            'currency_id' => $request->currency_id,
            'exchange_rate' => $request->exchange_rate ?? 1.0,
            'payment_term_id' => $request->payment_term_id,
            'payment_terms_structured' => $request->payment_terms_structured,
            'additional_notes' => $request->additional_notes,
            'status' => 'draft',
            'total_styles' => 0,
            'total_quantity' => 0,
            'total_value' => 0,
            'revision_date' => $request->revision_date,
            'etd_date' => $etdDate,
            'ex_factory_date' => $exFactoryDate,
            'eta_date' => $etaDate,
            'in_warehouse_date' => $inWarehouseDate,
            'ship_to' => $request->ship_to,
            'ship_to_address' => $request->ship_to_address,
            'sample_schedule' => $request->sample_schedule,
            'packing_guidelines' => $request->packing_guidelines,
            'season_id' => $request->season_id,
            'retailer_id' => $request->retailer_id,
            'country_id' => $request->country_id,
            'warehouse_id' => $request->warehouse_id,
            'shipping_term' => $shippingTerm,
            'payment_term' => $request->payment_term,
            'country_of_origin' => $request->country_of_origin,
            'packing_method' => $request->packing_method,
            'other_terms' => $request->other_terms,
        ]);

        // Log creation
        $this->activityLog->logCreated('PurchaseOrder', $po->id, [
            'po_number' => $po->po_number,
        ]);

        // Auto-generate TNA chart for this PO
        try {
            $tnaService = app(TNAChartService::class);
            $tnaService->generateTNAChart($po);
        } catch (\Exception $e) {
            // Log the error but don't fail PO creation
            \Log::error('Failed to auto-generate TNA chart for PO ' . $po->id . ': ' . $e->getMessage());
        }

        // Send notifications
        if ($po->agency_id) {
            $agency = User::find($po->agency_id);
            if ($agency) {
                SendPurchaseOrderNotification::dispatch($po, $agency, 'created', [
                    'created_by' => $request->user()->name,
                ]);
            }
        }

        // Notify importer if different from creator
        if ($po->importer_id && $po->importer_id !== $user->id) {
            $importerUser = User::find($po->importer_id);
            if ($importerUser) {
                SendPurchaseOrderNotification::dispatch($po, $importerUser, 'created', [
                    'created_by' => $request->user()->name,
                ]);
            }
        }

        return response()->json([
            'message' => 'Purchase order created successfully',
            'purchase_order' => [
                'id' => $po->id,
                'po_number' => $po->po_number,
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
            'retailer_id' => 'nullable|exists:retailers,id',
            'po_date' => 'required|date',
            'currency_id' => 'nullable|exists:currencies,id',
            'exchange_rate' => 'nullable|numeric|min:0',
            'payment_term_id' => 'nullable|exists:payment_terms,id',
            'payment_terms_structured' => 'nullable|array',
            'payment_terms_structured.term' => 'nullable|string',
            'payment_terms_structured.percentage' => 'nullable|numeric|min:0|max:100',
            'additional_notes' => 'nullable|string',
            'importer_id' => 'nullable|exists:users,id',
            'agency_id' => 'nullable|exists:users,id',
            'buyer_id' => 'nullable|exists:buyers,id',
            'revision_date' => 'nullable|date',
            'ex_factory_date' => 'nullable|date',
            'etd_date' => 'nullable|date',
            'eta_date' => 'nullable|date',
            'in_warehouse_date' => 'nullable|date',
            'ship_to' => 'nullable|string|max:100',
            'ship_to_address' => 'nullable|string',
            'sample_schedule' => 'nullable|array',
            'packing_guidelines' => 'nullable|string',
            'season_id' => 'nullable|exists:seasons,id',
            'country_id' => 'nullable|exists:countries,id',
            'warehouse_id' => 'nullable|exists:warehouses,id',
            'shipping_term' => 'nullable|in:FOB,DDP',
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

        // Validate date sequence: po_date < ex_factory_date < etd_date < eta_date < in_warehouse_date
        $poDate = $request->po_date ?? $po->po_date;
        $etdDate = $request->has('etd_date') ? $request->etd_date : $po->etd_date;
        $exFactoryDate = $request->has('ex_factory_date') ? $request->ex_factory_date : $po->ex_factory_date;
        $etaDate = $request->has('eta_date') ? $request->eta_date : $po->eta_date;

        if ($poDate && $etdDate && strtotime($etdDate) <= strtotime($poDate)) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => ['etd_date' => ['ETD date must be after PO date']],
            ], 422);
        }
        if ($exFactoryDate && $etdDate && strtotime($etdDate) < strtotime($exFactoryDate)) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => ['etd_date' => ['ETD date must be on or after ex-factory date']],
            ], 422);
        }
        if ($etaDate && $etdDate && strtotime($etaDate) < strtotime($etdDate)) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => ['eta_date' => ['ETA date must be on or after ETD date']],
            ], 422);
        }

        // Verify importer has Importer role if provided
        if ($request->filled('importer_id')) {
            $importer = User::find($request->importer_id);
            if (!$importer->hasRole('Importer')) {
                return response()->json([
                    'message' => 'The selected user is not an importer',
                ], 422);
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

        $oldData = [
            'po_number' => $po->po_number,
            'status' => $po->status,
            'importer_id' => $po->importer_id,
            'agency_id' => $po->agency_id,
        ];

        $po->update([
            'po_number' => $request->po_number,
            'headline' => $request->headline,
            'importer_id' => $request->has('importer_id') ? $request->importer_id : $po->importer_id,
            'po_date' => $request->po_date,
            'currency_id' => $request->has('currency_id') ? $request->currency_id : $po->currency_id,
            'exchange_rate' => $request->has('exchange_rate') ? $request->exchange_rate : $po->exchange_rate,
            'payment_term_id' => $request->has('payment_term_id') ? $request->payment_term_id : $po->payment_term_id,
            'payment_terms_structured' => $request->has('payment_terms_structured') ? $request->payment_terms_structured : $po->payment_terms_structured,
            'additional_notes' => $request->additional_notes,
            'agency_id' => $request->has('agency_id') ? $request->agency_id : $po->agency_id,
            'buyer_id' => $request->buyer_id,
            // Status changes must go through updateStatus() endpoint for transition validation
            'status' => $po->status,
            'revision_date' => $request->revision_date,
            'ex_factory_date' => $request->ex_factory_date,
            'etd_date' => $request->etd_date,
            'eta_date' => $request->eta_date,
            'in_warehouse_date' => $request->in_warehouse_date,
            'ship_to' => $request->ship_to,
            'ship_to_address' => $request->ship_to_address,
            'sample_schedule' => $request->sample_schedule,
            'packing_guidelines' => $request->packing_guidelines,
            'season_id' => $request->season_id,
            'retailer_id' => $request->retailer_id,
            'country_id' => $request->country_id,
            'warehouse_id' => $request->warehouse_id,
            'shipping_term' => $request->has('shipping_term') ? $request->shipping_term : $po->shipping_term,
            'payment_term' => $request->payment_term,
            'country_of_origin' => $request->country_of_origin,
            'packing_method' => $request->packing_method,
            'other_terms' => $request->other_terms,
        ]);

        $newData = [
            'po_number' => $po->po_number,
            'status' => $po->status,
            'agency_id' => $po->agency_id,
        ];

        // Log update
        $this->activityLog->logUpdated('PurchaseOrder', $po->id, $oldData, $newData);

        // Send in-app notification to agency
        if ($po->agency_id) {
            $agency = User::find($po->agency_id);
            if ($agency && $agency->id !== $user->id) {
                SendPurchaseOrderNotification::dispatch($po, $agency, 'updated', [
                    'updated_by' => $user->name,
                    'changes' => array_keys(array_diff_assoc($newData, $oldData)),
                ]);
            }
        }

        return response()->json([
            'message' => 'Purchase order updated successfully',
            'purchase_order' => [
                'id' => $po->id,
                'po_number' => $po->po_number,
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

        // Prevent deleting completed or active POs
        if (in_array($po->status, ['completed', 'active'])) {
            return response()->json([
                'message' => "Cannot delete a purchase order with status '{$po->status}'. Cancel it first.",
            ], 422);
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
            'status' => 'required|string|in:' . implode(',', self::VALID_STATUSES),
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $oldStatus = $po->status;
        $newStatus = $request->status;

        if ($oldStatus === $newStatus) {
            return response()->json([
                'message' => 'Status is already ' . $newStatus,
                'status' => $po->status,
                'allowed_transitions' => $this->getAllowedTransitions($po->status),
            ]);
        }

        // Validate transition is allowed
        $allowedTransitions = $this->getAllowedTransitions($oldStatus);
        if (!empty($allowedTransitions) && !in_array($newStatus, $allowedTransitions)) {
            return response()->json([
                'message' => "Cannot transition from '{$oldStatus}' to '{$newStatus}'. Allowed: " . implode(', ', $allowedTransitions),
                'allowed_transitions' => $allowedTransitions,
            ], 422);
        }

        $po->status = $newStatus;
        $po->save();

        // Log status change
        $this->activityLog->log(
            'status_changed',
            'PurchaseOrder',
            $po->id,
            "PO status changed from {$oldStatus} to {$newStatus}",
            [
                'old_status' => $oldStatus,
                'new_status' => $newStatus,
            ]
        );

        // Send in-app notification to agency
        if ($po->agency_id) {
            $agency = User::find($po->agency_id);
            if ($agency && $agency->id !== $user->id) {
                SendPurchaseOrderNotification::dispatch($po, $agency, 'status_changed', [
                    'old_status' => $oldStatus,
                    'new_status' => $newStatus,
                    'changed_by' => $user->name,
                ]);
            }
        }

        return response()->json([
            'message' => 'Purchase order status updated successfully',
            'status' => $po->status,
            'allowed_transitions' => $this->getAllowedTransitions($po->status),
        ]);
    }

    /**
     * Get allowed status transitions for a given status
     */
    private function getAllowedTransitions(string $currentStatus): array
    {
        $transitions = [
            'draft' => ['active', 'cancelled'],
            'pending_agency' => ['active', 'cancelled'],
            'pending_factory' => ['active', 'cancelled'],
            'pending_assignments' => ['active', 'cancelled'],
            'active' => ['completed', 'cancelled'],
            'completed' => [],
            'cancelled' => [],
        ];

        return $transitions[$currentStatus] ?? ['active', 'cancelled'];
    }

    private const VALID_STATUSES = [
        'draft', 'pending_agency', 'pending_factory', 'pending_assignments',
        'active', 'completed', 'cancelled',
    ];

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

        $total = (clone $query)->count();
        $byStatus = (clone $query)
            ->select('status', DB::raw('count(*) as count'))
            ->groupBy('status')
            ->get();

        $totalValue = (clone $query)->sum('total_value');
        $totalQuantity = (clone $query)->sum('total_quantity');

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
            $schedule = $scheduleService->generateSchedule($po->po_date, $po->etd_date, $po->ex_factory_date);
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
                'ex_factory_date' => 'nullable|date',
            ]);

            if ($validator->fails()) {
                return response()->json([
                    'message' => 'Validation failed',
                    'errors' => $validator->errors()
                ], 422);
            }

            $scheduleService = app(SampleScheduleService::class);
            $schedule = $scheduleService->generateSchedule($request->po_date, $request->etd_date, $request->ex_factory_date);
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

    // =========================================================================
    // SPREADSHEET VIEW ENDPOINTS
    // =========================================================================

    /**
     * Return all styles for a PO in a flat spreadsheet-ready format.
     *
     * GET /api/purchase-orders/{id}/spreadsheet-data
     */
    public function spreadsheetData(Request $request, $id)
    {
        $user = $request->user();
        $po = PurchaseOrder::with([
            'importer', 'agency', 'retailer', 'season', 'country', 'warehouse', 'currency',
            'styles.category', 'styles.season', 'styles.brand', 'styles.color',
        ])->findOrFail($id);

        if (!$this->permissionService->canAccessPO($user, $po)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        // Batch-load factory & agency names from pivot
        $factoryIds = $po->styles->pluck('pivot.assigned_factory_id')->filter()->unique();
        $agencyIds  = $po->styles->pluck('pivot.assigned_agency_id')->filter()->unique();
        $userIds    = $factoryIds->merge($agencyIds)->unique();
        $userNames  = $userIds->isNotEmpty()
            ? User::whereIn('id', $userIds)->pluck('name', 'id')
            : collect();

        // All factories / agencies for dropdown lookups
        $factories = User::role('factory')->select('id', 'name')->orderBy('name')->get();
        $agencies  = User::role('agency')->select('id', 'name')->orderBy('name')->get();

        $rows = $po->styles->map(function ($style) use ($userNames) {
            $pivot = $style->pivot;
            $qty   = $pivot->quantity_in_po ?? 0;
            $price = $pivot->unit_price_in_po ?? $style->unit_price ?? 0;

            return [
                '_styleId'  => $style->id,
                '_pivotId'  => $pivot->id,

                // Style fields
                'style_number'       => $style->style_number,
                'description'        => $style->description,
                'color_name'         => $style->color_name ?? ($style->color?->name ?? null),
                'color_code'         => $style->color_code ?? ($style->color?->code ?? null),
                'fabric'             => $style->fabric,
                'fabric_type_name'   => $style->fabric_type_name,
                'fit'                => $style->fit,
                'country_of_origin'  => $style->country_of_origin,
                'item_description'   => $style->item_description,
                'images'             => $style->images ?? [],
                'fob_price'          => $style->fob_price,
                'msrp'               => $style->msrp,
                'wholesale_price'    => $style->wholesale_price,
                'unit_price'         => $style->unit_price,
                'total_price_style'  => $style->total_price,
                'category_name'      => $style->category?->name,
                'season_name'        => $style->season?->name,
                'brand_name'         => $style->brand?->name,

                // Pivot fields
                'quantity_in_po'             => $qty,
                'unit_price_in_po'           => $pivot->unit_price_in_po,
                'total_price'                => $qty * $price,
                'size_breakdown'             => $pivot->size_breakdown,
                'ratio'                      => $pivot->ratio,
                'status'                     => $pivot->status ?? 'pending',
                'production_status'          => $pivot->production_status,
                'shipping_approval_status'   => null,
                'assigned_factory_id'        => $pivot->assigned_factory_id,
                'assigned_factory_name'      => $pivot->assigned_factory_id ? ($userNames[$pivot->assigned_factory_id] ?? null) : null,
                'assigned_agency_id'         => $pivot->assigned_agency_id,
                'assignment_type'            => $pivot->assignment_type,
                'ex_factory_date'            => $pivot->ex_factory_date?->format('Y-m-d'),
                'estimated_ex_factory_date'  => $pivot->estimated_ex_factory_date?->format('Y-m-d'),
                'target_production_date'     => $pivot->target_production_date?->format('Y-m-d'),
                'target_shipment_date'       => $pivot->target_shipment_date?->format('Y-m-d'),
                'notes'                      => $pivot->notes,
            ];
        })->values();

        return response()->json([
            'po' => [
                'id'              => $po->id,
                'po_number'       => $po->po_number,
                'headline'        => $po->headline,
                'status'          => $po->status,
                'po_date'         => $po->po_date?->format('Y-m-d'),
                'etd_date'        => $po->etd_date?->format('Y-m-d'),
                'eta_date'        => $po->eta_date?->format('Y-m-d'),
                'ex_factory_date' => $po->ex_factory_date?->format('Y-m-d'),
                'in_warehouse_date' => $po->in_warehouse_date?->format('Y-m-d'),
                'shipping_term'   => $po->shipping_term,
                'total_quantity'  => $po->total_quantity,
                'total_value'     => $po->total_value,
                'currency_code'   => $po->getRelation('currency')?->code ?? $po->getAttributes()['currency'] ?? 'USD',
                'currency_symbol' => $po->getRelation('currency')?->symbol ?? '$',
                'retailer_name'   => $po->getRelation('retailer')?->name,
                'season_name'     => $po->getRelation('season')?->name,
                'country_name'    => $po->getRelation('country')?->name,
                'importer_name'   => $po->getRelation('importer')?->name ?? 'Unknown',
                'agency_name'     => $po->getRelation('agency')?->name,
                'creator_id'      => $po->creator_id ?? $po->importer_id,
            ],
            'rows' => $rows,
            'lookups' => [
                'factories'           => $factories,
                'agencies'            => $agencies,
                'statuses'            => ['pending', 'confirmed', 'in_production', 'completed', 'cancelled'],
                'production_statuses' => ['pending', 'cutting', 'sewing', 'finishing', 'packing', 'ready_to_ship', 'shipped'],
            ],
        ]);
    }

    /**
     * Update a single cell (field) for a style within a PO.
     *
     * PATCH /api/purchase-orders/{poId}/styles/{styleId}/cell
     */
    public function updateStyleCell(Request $request, $poId, $styleId)
    {
        $user = $request->user();
        $po   = PurchaseOrder::findOrFail($poId);

        if (!$this->permissionService->canAccessPO($user, $po)) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $validator = Validator::make($request->all(), [
            'field'  => 'required|string|max:100',
            'value'  => 'present',
            'target' => 'required|in:style,pivot',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        $field  = $request->input('field');
        $value  = $request->input('value');
        $target = $request->input('target');

        // ---- Whitelist of editable fields per target ----
        $styleFields = [
            'style_number', 'description', 'color_name', 'color_code',
            'fabric', 'fabric_type_name', 'fit', 'country_of_origin',
            'item_description', 'fob_price', 'msrp', 'wholesale_price',
        ];
        $pivotFields = [
            'quantity_in_po', 'unit_price_in_po', 'size_breakdown', 'ratio',
            'status', 'production_status', 'notes',
            'assigned_factory_id', 'assigned_agency_id', 'assignment_type',
            'ex_factory_date', 'estimated_ex_factory_date',
            'target_production_date', 'target_shipment_date',
        ];

        $allowed = $target === 'style' ? $styleFields : $pivotFields;
        if (!in_array($field, $allowed, true)) {
            return response()->json(['message' => "Field '{$field}' is not editable"], 422);
        }

        $style = Style::findOrFail($styleId);

        // Ensure style is attached to this PO
        $pivotRow = PurchaseOrderStyle::where('purchase_order_id', $poId)
            ->where('style_id', $styleId)
            ->firstOrFail();

        $oldValue = $target === 'style' ? $style->{$field} : $pivotRow->{$field};

        DB::beginTransaction();
        try {
            if ($target === 'style') {
                $style->update([$field => $value]);
            } else {
                $pivotRow->update([$field => $value]);

                // Recalculate PO totals if qty or price changed
                if (in_array($field, ['quantity_in_po', 'unit_price_in_po'])) {
                    $po->updateTotals();
                }
            }
            DB::commit();
        } catch (\Throwable $e) {
            DB::rollBack();
            return response()->json(['message' => 'Update failed', 'error' => $e->getMessage()], 500);
        }

        // Compute new total_price for the row
        $pivotRow->refresh();
        $effectivePrice = $pivotRow->unit_price_in_po ?? $style->unit_price ?? 0;
        $newTotalPrice  = ($pivotRow->quantity_in_po ?? 0) * $effectivePrice;

        return response()->json([
            'success'     => true,
            'field'       => $field,
            'value'       => $value,
            'old_value'   => $oldValue,
            'total_price' => $newTotalPrice,
            'po_totals'   => [
                'total_quantity' => $po->fresh()->total_quantity,
                'total_value'    => $po->fresh()->total_value,
            ],
        ]);
    }
}
