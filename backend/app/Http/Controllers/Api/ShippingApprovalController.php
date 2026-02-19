<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderStyle;
use App\Models\ShipOption;
use App\Models\User;
use App\Services\ActivityLogService;
use App\Services\PermissionService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class ShippingApprovalController extends Controller
{
    protected ActivityLogService $activityLog;
    protected PermissionService $permissionService;

    public function __construct(ActivityLogService $activityLog, PermissionService $permissionService)
    {
        $this->activityLog = $activityLog;
        $this->permissionService = $permissionService;
    }

    /**
     * Aggregate endpoint: get shipping approval data across all POs with filters.
     * Role-based: Factory sees their assigned styles, Agency sees their POs, Importer sees their POs, Admin sees all.
     */
    public function indexAll(Request $request)
    {
        $user = $request->user();

        $query = PurchaseOrderStyle::with([
            'style:id,style_number,description',
            'purchaseOrder:id,po_number,ex_factory_date,agency_id,importer_id',
            'purchaseOrder.agency:id,name',
            'purchaseOrder.importer:id,name',
            'assignedFactory:id,name',
            'suggestedShipOption',
        ]);

        // Role-based scoping
        if ($user->hasRole('Factory')) {
            $query->where('purchase_order_style.assigned_factory_id', $user->id);
        } elseif ($user->hasRole('Agency')) {
            $query->whereHas('purchaseOrder', fn($q) => $q->where('agency_id', $user->id));
        } elseif ($user->hasRole('Importer')) {
            $query->whereHas('purchaseOrder', fn($q) => $q->where('importer_id', $user->id));
        }
        // Admin / Super Admin see all

        // Filter: factory_id
        if ($request->filled('factory_id')) {
            $query->where('purchase_order_style.assigned_factory_id', $request->factory_id);
        }

        // Filter: agency_id (on PO)
        if ($request->filled('agency_id')) {
            $query->whereHas('purchaseOrder', fn($q) => $q->where('agency_id', $request->agency_id));
        }

        // Filter: po_number (search)
        if ($request->filled('po_number')) {
            $query->whereHas('purchaseOrder', fn($q) => $q->where('po_number', 'like', '%' . $request->po_number . '%'));
        }

        // Filter: style_number (search)
        if ($request->filled('style_number')) {
            $query->whereHas('style', fn($q) => $q->where('style_number', 'like', '%' . $request->style_number . '%'));
        }

        // Filter: production_status
        if ($request->filled('production_status')) {
            $query->where('production_status', $request->production_status);
        }

        // Filter: shipping_approval_status
        if ($request->filled('shipping_approval_status')) {
            $query->where('shipping_approval_status', $request->shipping_approval_status);
        }

        // Filter: ex_factory date range (PO ex_factory_date)
        if ($request->filled('ex_factory_from')) {
            $query->whereHas('purchaseOrder', fn($q) => $q->whereDate('ex_factory_date', '>=', $request->ex_factory_from));
        }
        if ($request->filled('ex_factory_to')) {
            $query->whereHas('purchaseOrder', fn($q) => $q->whereDate('ex_factory_date', '<=', $request->ex_factory_to));
        }

        // Filter: estimated_ex_factory date range
        if ($request->filled('est_ex_factory_from')) {
            $query->whereDate('estimated_ex_factory_date', '>=', $request->est_ex_factory_from);
        }
        if ($request->filled('est_ex_factory_to')) {
            $query->whereDate('estimated_ex_factory_date', '<=', $request->est_ex_factory_to);
        }

        // Filter: ETD range (via suggested ship option)
        if ($request->filled('etd_from') || $request->filled('etd_to')) {
            $query->whereHas('suggestedShipOption', function ($q) use ($request) {
                if ($request->filled('etd_from')) {
                    $q->whereDate('etd', '>=', $request->etd_from);
                }
                if ($request->filled('etd_to')) {
                    $q->whereDate('etd', '<=', $request->etd_to);
                }
            });
        }

        $pivots = $query->orderBy('updated_at', 'desc')
            ->paginate($request->input('per_page', 50));

        $items = $pivots->getCollection()->map(function ($pivot) {
            return $this->formatPivotData($pivot);
        });

        return response()->json([
            'data' => $items,
            'meta' => [
                'current_page' => $pivots->currentPage(),
                'last_page' => $pivots->lastPage(),
                'per_page' => $pivots->perPage(),
                'total' => $pivots->total(),
            ],
        ]);
    }

    /**
     * Get shipping approval status for all styles in a PO (with optional filters)
     */
    public function index(Request $request, $poId)
    {
        $user = $request->user();
        $po = PurchaseOrder::findOrFail($poId);

        if (!$this->permissionService->canAccessPO($user, $po)) {
            return response()->json(['message' => 'Access denied'], 403);
        }

        $query = PurchaseOrderStyle::where('purchase_order_id', $poId)
            ->with(['style:id,style_number,description', 'suggestedShipOption', 'assignedFactory:id,name']);

        // Optional filters
        if ($request->filled('factory_id')) {
            $query->where('purchase_order_style.assigned_factory_id', $request->factory_id);
        }
        if ($request->filled('style_number')) {
            $query->whereHas('style', fn($q) => $q->where('style_number', 'like', '%' . $request->style_number . '%'));
        }
        if ($request->filled('production_status')) {
            $query->where('production_status', $request->production_status);
        }
        if ($request->filled('shipping_approval_status')) {
            $query->where('shipping_approval_status', $request->shipping_approval_status);
        }

        $pivots = $query->get();

        return response()->json([
            'po_id' => (int) $poId,
            'po_number' => $po->po_number,
            'po_ex_factory_date' => $po->ex_factory_date?->format('Y-m-d'),
            'styles' => $pivots->map(function ($pivot) {
                return [
                    'pivot_id' => $pivot->id,
                    'style_id' => $pivot->style_id,
                    'style_number' => $pivot->style->style_number ?? null,
                    'style_description' => $pivot->style->description ?? null,
                    'quantity_in_po' => $pivot->quantity_in_po,
                    'factory_name' => $pivot->assignedFactory->name ?? null,
                    'assigned_factory_id' => $pivot->assigned_factory_id,
                    'ex_factory_date' => $pivot->ex_factory_date?->format('Y-m-d'),
                    'estimated_ex_factory_date' => $pivot->estimated_ex_factory_date?->format('Y-m-d'),
                    'production_status' => $pivot->production_status,
                    'shipping_approval_status' => $pivot->shipping_approval_status,
                    'shipping_approval_requested_at' => $pivot->shipping_approval_requested_at,
                    'shipping_approval_notes' => $pivot->shipping_approval_notes,
                    'shipping_approval_rejection_reason' => $pivot->shipping_approval_rejection_reason,
                    'shipping_approval_agency_at' => $pivot->shipping_approval_agency_at,
                    'shipping_approval_importer_at' => $pivot->shipping_approval_importer_at,
                    'suggested_ship_option' => $pivot->suggestedShipOption ? [
                        'id' => $pivot->suggestedShipOption->id,
                        'name' => $pivot->suggestedShipOption->name,
                        'etd' => $pivot->suggestedShipOption->etd->format('Y-m-d'),
                        'eta' => $pivot->suggestedShipOption->eta->format('Y-m-d'),
                        'vessel_name' => $pivot->suggestedShipOption->vessel_name,
                        'cutoff_date' => $pivot->suggestedShipOption->cutoff_date?->format('Y-m-d'),
                    ] : null,
                ];
            }),
        ]);
    }

    /**
     * Update production status for a style in a PO
     */
    public function updateProductionStatus(Request $request, $poId, $styleId)
    {
        $user = $request->user();
        $po = PurchaseOrder::findOrFail($poId);

        $validator = Validator::make($request->all(), [
            'production_status' => 'required|in:pending,submitted,in_production,estimated_ex_factory',
            'estimated_ex_factory_date' => 'nullable|date',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        $pivot = PurchaseOrderStyle::where('purchase_order_id', $poId)
            ->where('style_id', $styleId)
            ->firstOrFail();

        $pivot->production_status = $request->production_status;

        if ($request->has('estimated_ex_factory_date')) {
            $pivot->estimated_ex_factory_date = $request->estimated_ex_factory_date;
        }

        $pivot->save();

        // Auto-suggest ship option if estimated ex-factory date is set
        $suggestedOption = null;
        if ($pivot->estimated_ex_factory_date) {
            $suggestedOption = ShipOption::findEarliestConnectable($pivot->estimated_ex_factory_date);
            $pivot->suggested_ship_option_id = $suggestedOption?->id;
            $pivot->save();
        }

        $this->activityLog->log(
            'production_status_updated',
            'PurchaseOrderStyle',
            $pivot->id,
            "Updated production status to {$request->production_status}",
            [
                'po_id' => $poId,
                'style_id' => $styleId,
                'production_status' => $request->production_status,
                'estimated_ex_factory_date' => $request->estimated_ex_factory_date,
            ]
        );

        return response()->json([
            'message' => 'Production status updated successfully',
            'production_status' => $pivot->production_status,
            'estimated_ex_factory_date' => $pivot->estimated_ex_factory_date?->format('Y-m-d'),
            'suggested_ship_option' => $suggestedOption ? [
                'id' => $suggestedOption->id,
                'name' => $suggestedOption->name,
                'etd' => $suggestedOption->etd->format('Y-m-d'),
                'eta' => $suggestedOption->eta->format('Y-m-d'),
                'cutoff_date' => $suggestedOption->cutoff_date->format('Y-m-d'),
            ] : null,
        ]);
    }

    /**
     * Factory requests shipping approval
     * Can only be requested max 21 days before PO ex_factory_date
     */
    public function requestApproval(Request $request, $poId, $styleId)
    {
        $user = $request->user();

        $validator = Validator::make($request->all(), [
            'notes' => 'nullable|string|max:500',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        $pivot = PurchaseOrderStyle::where('purchase_order_id', $poId)
            ->where('style_id', $styleId)
            ->with('purchaseOrder')
            ->firstOrFail();

        if ($request->has('notes')) {
            $pivot->shipping_approval_notes = $request->notes;
            $pivot->save();
        }

        $result = $pivot->requestShippingApproval($user->id);

        if (!$result['success']) {
            return response()->json([
                'message' => $result['message'],
            ], 422);
        }

        $this->activityLog->log(
            'shipping_approval_requested',
            'PurchaseOrderStyle',
            $pivot->id,
            "Shipping approval requested for style in PO",
            [
                'po_id' => $poId,
                'style_id' => $styleId,
            ]
        );

        return response()->json([
            'message' => 'Shipping approval requested successfully',
            'shipping_approval_status' => $pivot->shipping_approval_status,
            'suggested_ship_option' => $result['suggested_ship_option'] ? [
                'id' => $result['suggested_ship_option']->id,
                'name' => $result['suggested_ship_option']->name,
                'etd' => $result['suggested_ship_option']->etd->format('Y-m-d'),
                'eta' => $result['suggested_ship_option']->eta->format('Y-m-d'),
            ] : null,
        ]);
    }

    /**
     * Agency approves shipping (with optional ship option selection)
     */
    public function agencyApprove(Request $request, $poId, $styleId)
    {
        $user = $request->user();
        $po = PurchaseOrder::findOrFail($poId);

        // Check agency role
        if ($po->agency_id !== $user->id && !$user->hasRole('Super Admin')) {
            return response()->json(['message' => 'Only the assigned agency can approve shipping'], 403);
        }

        $pivot = PurchaseOrderStyle::where('purchase_order_id', $poId)
            ->where('style_id', $styleId)
            ->firstOrFail();

        if ($pivot->shipping_approval_status !== 'requested') {
            return response()->json(['message' => 'Shipping approval must be in requested status'], 422);
        }

        // Allow agency to select a specific ship option
        if ($request->filled('ship_option_id')) {
            $shipOption = ShipOption::findOrFail($request->ship_option_id);
            $pivot->suggested_ship_option_id = $shipOption->id;
            $pivot->save();
        }

        $pivot->agencyApproveShipping($user->id, $request->notes);

        $this->activityLog->log(
            'shipping_approval_agency_approved',
            'PurchaseOrderStyle',
            $pivot->id,
            "Agency approved shipping for style in PO",
            ['po_id' => $poId, 'style_id' => $styleId, 'ship_option_id' => $request->ship_option_id]
        );

        return response()->json([
            'message' => 'Shipping approved by agency',
            'shipping_approval_status' => $pivot->shipping_approval_status,
        ]);
    }

    /**
     * Importer approves shipping (final)
     */
    public function importerApprove(Request $request, $poId, $styleId)
    {
        $user = $request->user();
        $po = PurchaseOrder::findOrFail($poId);

        if ($po->importer_id !== $user->id && !$user->hasRole('Super Admin')) {
            return response()->json(['message' => 'Only the importer can give final shipping approval'], 403);
        }

        $pivot = PurchaseOrderStyle::where('purchase_order_id', $poId)
            ->where('style_id', $styleId)
            ->firstOrFail();

        if ($pivot->shipping_approval_status !== 'agency_approved') {
            return response()->json(['message' => 'Shipping must be approved by agency first'], 422);
        }

        $pivot->importerApproveShipping($user->id, $request->notes);

        $this->activityLog->log(
            'shipping_approval_importer_approved',
            'PurchaseOrderStyle',
            $pivot->id,
            "Importer approved shipping for style in PO",
            ['po_id' => $poId, 'style_id' => $styleId]
        );

        return response()->json([
            'message' => 'Shipping approved by importer (final approval)',
            'shipping_approval_status' => $pivot->shipping_approval_status,
        ]);
    }

    /**
     * Reject shipping approval (agency or importer)
     */
    public function reject(Request $request, $poId, $styleId)
    {
        $user = $request->user();
        $po = PurchaseOrder::findOrFail($poId);

        $isAgency = $po->agency_id === $user->id;
        $isImporter = $po->importer_id === $user->id;
        $isSuperAdmin = $user->hasRole('Super Admin');

        if (!$isAgency && !$isImporter && !$isSuperAdmin) {
            return response()->json(['message' => 'Only agency or importer can reject shipping approval'], 403);
        }

        $validator = Validator::make($request->all(), [
            'reason' => 'required|string|max:500',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        $pivot = PurchaseOrderStyle::where('purchase_order_id', $poId)
            ->where('style_id', $styleId)
            ->firstOrFail();

        if (!in_array($pivot->shipping_approval_status, ['requested', 'agency_approved'])) {
            return response()->json(['message' => 'No pending shipping approval to reject'], 422);
        }

        $pivot->rejectShipping($user->id, $request->reason);

        $this->activityLog->log(
            'shipping_approval_rejected',
            'PurchaseOrderStyle',
            $pivot->id,
            "Shipping approval rejected: {$request->reason}",
            ['po_id' => $poId, 'style_id' => $styleId, 'reason' => $request->reason]
        );

        return response()->json([
            'message' => 'Shipping approval rejected',
            'shipping_approval_status' => $pivot->shipping_approval_status,
        ]);
    }

    /**
     * Format a PurchaseOrderStyle pivot for the aggregate response.
     */
    private function formatPivotData(PurchaseOrderStyle $pivot): array
    {
        return [
            'pivot_id' => $pivot->id,
            'purchase_order_id' => $pivot->purchase_order_id,
            'po_number' => $pivot->purchaseOrder->po_number ?? null,
            'po_ex_factory_date' => $pivot->purchaseOrder?->ex_factory_date?->format('Y-m-d'),
            'agency_name' => $pivot->purchaseOrder?->agency?->name ?? null,
            'agency_id' => $pivot->purchaseOrder?->agency_id,
            'importer_name' => $pivot->purchaseOrder?->importer?->name ?? null,
            'factory_name' => $pivot->assignedFactory?->name ?? null,
            'assigned_factory_id' => $pivot->assigned_factory_id,
            'style_id' => $pivot->style_id,
            'style_number' => $pivot->style->style_number ?? null,
            'quantity_in_po' => $pivot->quantity_in_po,
            'ex_factory_date' => $pivot->ex_factory_date?->format('Y-m-d'),
            'estimated_ex_factory_date' => $pivot->estimated_ex_factory_date?->format('Y-m-d'),
            'production_status' => $pivot->production_status,
            'shipping_approval_status' => $pivot->shipping_approval_status,
            'shipping_approval_requested_at' => $pivot->shipping_approval_requested_at,
            'shipping_approval_agency_at' => $pivot->shipping_approval_agency_at,
            'shipping_approval_importer_at' => $pivot->shipping_approval_importer_at,
            'shipping_approval_notes' => $pivot->shipping_approval_notes,
            'shipping_approval_rejection_reason' => $pivot->shipping_approval_rejection_reason,
            'suggested_ship_option' => $pivot->suggestedShipOption ? [
                'id' => $pivot->suggestedShipOption->id,
                'name' => $pivot->suggestedShipOption->name,
                'etd' => $pivot->suggestedShipOption->etd->format('Y-m-d'),
                'eta' => $pivot->suggestedShipOption->eta->format('Y-m-d'),
                'vessel_name' => $pivot->suggestedShipOption->vessel_name,
                'cutoff_date' => $pivot->suggestedShipOption->cutoff_date?->format('Y-m-d'),
            ] : null,
        ];
    }
}
