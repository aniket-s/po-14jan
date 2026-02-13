<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Shipment;
use App\Models\ShipmentItem;
use App\Models\ShipmentUpdate;
use App\Models\PurchaseOrder;
use App\Services\ActivityLogService;
use App\Services\EmailService;
use App\Services\PermissionService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class ShipmentController extends Controller
{
    protected $activityLog;
    protected $emailService;
    protected $permissionService;

    public function __construct(
        ActivityLogService $activityLog,
        EmailService $emailService,
        PermissionService $permissionService
    ) {
        $this->activityLog = $activityLog;
        $this->emailService = $emailService;
        $this->permissionService = $permissionService;
    }

    /**
     * Get shipments for a purchase order
     */
    public function index(Request $request, $poId)
    {
        $user = $request->user();
        $po = PurchaseOrder::findOrFail($poId);

        // Check access permission
        if (!$this->permissionService->canAccessPurchaseOrder($user, $po)) {
            return response()->json([
                'message' => 'You do not have permission to view shipments',
            ], 403);
        }

        $query = Shipment::with([
            'items.style:id,style_number,description',
            'createdBy:id,name',
        ])
            ->where('purchase_order_id', $poId);

        // Filter by status
        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        // Filter by shipment method
        if ($request->has('method')) {
            $query->where('shipment_method', $request->method);
        }

        // Sort
        $sortField = $request->input('sort_field', 'created_at');
        $sortOrder = $request->input('sort_order', 'desc');
        $query->orderBy($sortField, $sortOrder);

        $perPage = $request->input('per_page', 25);
        $shipments = $query->paginate($perPage);

        // Add computed attributes
        $shipments->getCollection()->transform(function ($shipment) {
            $shipment->total_quantity = $shipment->getTotalQuantityAttribute();
            $shipment->progress_percentage = $shipment->getProgressPercentage();
            $shipment->is_delayed = $shipment->isDelayed();
            $shipment->days_until_delivery = $shipment->getDaysUntilDelivery();
            $shipment->public_tracking_url = $shipment->getPublicTrackingUrl();
            return $shipment;
        });

        return response()->json($shipments);
    }

    /**
     * Create new shipment
     */
    public function store(Request $request, $poId)
    {
        $user = $request->user();
        $po = PurchaseOrder::findOrFail($poId);

        // Check permission
        if (!$this->canManageShipment($user, $po)) {
            return response()->json([
                'message' => 'You do not have permission to create shipments',
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'tracking_number' => 'nullable|string|max:255',
            'carrier_name' => 'required|string|max:255',
            'carrier_tracking_url' => 'nullable|url|max:500',
            'shipment_method' => 'required|string|in:air,sea,courier,road',
            'shipment_type' => 'required|string|in:full,partial',
            'container_number' => 'nullable|string|max:255',
            'seal_number' => 'nullable|string|max:255',
            'vessel_name' => 'nullable|string|max:255',
            'voyage_number' => 'nullable|string|max:255',
            'port_of_loading' => 'nullable|string|max:255',
            'port_of_discharge' => 'nullable|string|max:255',
            'final_destination' => 'nullable|string|max:255',
            'total_cartons' => 'nullable|integer|min:0',
            'total_weight' => 'nullable|numeric|min:0',
            'total_volume' => 'nullable|numeric|min:0',
            'estimated_dispatch_date' => 'nullable|date',
            'estimated_arrival_date' => 'nullable|date',
            'estimated_delivery_date' => 'nullable|date',
            'documents' => 'nullable|array',
            'documents.*' => 'nullable|string|max:500',
            'notes' => 'nullable|string|max:2000',
            'items' => 'required|array|min:1',
            'items.*.style_id' => 'required|exists:styles,id',
            'items.*.quantity_shipped' => 'required|integer|min:1',
            'items.*.carton_count' => 'nullable|integer|min:0',
            'items.*.weight_per_carton' => 'nullable|numeric|min:0',
            'items.*.volume_per_carton' => 'nullable|numeric|min:0',
            'items.*.carton_numbers' => 'nullable|array',
            'items.*.notes' => 'nullable|string|max:500',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        DB::beginTransaction();
        try {
            // Generate shipment reference
            $shipmentReference = $this->generateShipmentReference($po);

            // Create shipment
            $shipment = Shipment::create([
                'purchase_order_id' => $poId,
                'shipment_reference' => $shipmentReference,
                'tracking_number' => $request->tracking_number,
                'carrier_name' => $request->carrier_name,
                'carrier_tracking_url' => $request->carrier_tracking_url,
                'shipment_method' => $request->shipment_method,
                'shipment_type' => $request->shipment_type,
                'container_number' => $request->container_number,
                'seal_number' => $request->seal_number,
                'vessel_name' => $request->vessel_name,
                'voyage_number' => $request->voyage_number,
                'port_of_loading' => $request->port_of_loading,
                'port_of_discharge' => $request->port_of_discharge,
                'final_destination' => $request->final_destination,
                'total_cartons' => $request->total_cartons,
                'total_weight' => $request->total_weight,
                'total_volume' => $request->total_volume,
                'status' => 'preparing',
                'estimated_dispatch_date' => $request->estimated_dispatch_date,
                'estimated_arrival_date' => $request->estimated_arrival_date,
                'estimated_delivery_date' => $request->estimated_delivery_date,
                'documents' => $request->documents ?? [],
                'notes' => $request->notes,
                'created_by' => $user->id,
                'last_updated_by' => $user->id,
            ]);

            // Add shipment items
            foreach ($request->items as $itemData) {
                $item = ShipmentItem::create([
                    'shipment_id' => $shipment->id,
                    'style_id' => $itemData['style_id'],
                    'quantity_shipped' => $itemData['quantity_shipped'],
                    'carton_count' => $itemData['carton_count'] ?? null,
                    'weight_per_carton' => $itemData['weight_per_carton'] ?? null,
                    'volume_per_carton' => $itemData['volume_per_carton'] ?? null,
                    'carton_numbers' => $itemData['carton_numbers'] ?? [],
                    'notes' => $itemData['notes'] ?? null,
                ]);

                // Calculate totals
                $item->calculateTotals();
            }

            // Create initial shipment update
            ShipmentUpdate::create([
                'shipment_id' => $shipment->id,
                'update_date' => now(),
                'status' => 'preparing',
                'description' => 'Shipment created and preparing for dispatch',
                'is_milestone' => true,
                'updated_by' => $user->id,
            ]);

            // Reload with relationships
            $shipment->load([
                'items.style',
                'updates' => function ($query) {
                    $query->ordered('asc');
                },
            ]);

            // Send notification
            $this->sendShipmentCreatedNotification($shipment);

            // Log activity
            $this->activityLog->log(
                'shipment_created',
                'Shipment',
                $shipment->id,
                "Shipment {$shipmentReference} created",
                [
                    'po_number' => $po->po_number,
                    'carrier' => $shipment->carrier_name,
                    'method' => $shipment->shipment_method,
                ]
            );

            DB::commit();

            $shipment->public_tracking_url = $shipment->getPublicTrackingUrl();

            return response()->json([
                'message' => 'Shipment created successfully',
                'shipment' => $shipment,
            ], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'message' => 'Failed to create shipment',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get single shipment
     */
    public function show(Request $request, $poId, $id)
    {
        $user = $request->user();
        $shipment = Shipment::with([
            'purchaseOrder',
            'items.style',
            'updates' => function ($query) {
                $query->ordered('desc')->with('updatedBy:id,name');
            },
            'createdBy:id,name',
            'lastUpdatedBy:id,name',
        ])->findOrFail($id);

        // Check access permission
        if (!$this->permissionService->canAccessPurchaseOrder($user, $shipment->purchaseOrder)) {
            return response()->json([
                'message' => 'You do not have permission to view this shipment',
            ], 403);
        }

        // Add computed attributes
        $shipment->total_quantity = $shipment->getTotalQuantityAttribute();
        $shipment->progress_percentage = $shipment->getProgressPercentage();
        $shipment->is_delayed = $shipment->isDelayed();
        $shipment->days_until_delivery = $shipment->getDaysUntilDelivery();
        $shipment->public_tracking_url = $shipment->getPublicTrackingUrl();

        return response()->json($shipment);
    }

    /**
     * Update shipment
     */
    public function update(Request $request, $poId, $id)
    {
        $user = $request->user();
        $shipment = Shipment::with('purchaseOrder')->findOrFail($id);

        // Check permission
        if (!$this->canManageShipment($user, $shipment->purchaseOrder)) {
            return response()->json([
                'message' => 'You do not have permission to update this shipment',
            ], 403);
        }

        // Cannot update delivered or cancelled shipments
        if ($shipment->isDelivered() || $shipment->isCancelled()) {
            return response()->json([
                'message' => 'Cannot update delivered or cancelled shipments',
            ], 422);
        }

        $validator = Validator::make($request->all(), [
            'tracking_number' => 'nullable|string|max:255',
            'carrier_name' => 'sometimes|string|max:255',
            'carrier_tracking_url' => 'nullable|url|max:500',
            'container_number' => 'nullable|string|max:255',
            'seal_number' => 'nullable|string|max:255',
            'vessel_name' => 'nullable|string|max:255',
            'voyage_number' => 'nullable|string|max:255',
            'port_of_loading' => 'nullable|string|max:255',
            'port_of_discharge' => 'nullable|string|max:255',
            'final_destination' => 'nullable|string|max:255',
            'total_cartons' => 'nullable|integer|min:0',
            'total_weight' => 'nullable|numeric|min:0',
            'total_volume' => 'nullable|numeric|min:0',
            'estimated_dispatch_date' => 'nullable|date',
            'estimated_arrival_date' => 'nullable|date',
            'estimated_delivery_date' => 'nullable|date',
            'actual_dispatch_date' => 'nullable|date',
            'actual_arrival_date' => 'nullable|date',
            'documents' => 'nullable|array',
            'documents.*' => 'nullable|string|max:500',
            'notes' => 'nullable|string|max:2000',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        $shipment->fill($request->only([
            'tracking_number',
            'carrier_name',
            'carrier_tracking_url',
            'container_number',
            'seal_number',
            'vessel_name',
            'voyage_number',
            'port_of_loading',
            'port_of_discharge',
            'final_destination',
            'total_cartons',
            'total_weight',
            'total_volume',
            'estimated_dispatch_date',
            'estimated_arrival_date',
            'estimated_delivery_date',
            'actual_dispatch_date',
            'actual_arrival_date',
            'documents',
            'notes',
        ]));
        $shipment->last_updated_by = $user->id;
        $shipment->save();

        // Reload with relationships
        $shipment->load(['items.style', 'updates']);

        // Log activity
        $this->activityLog->log(
            'shipment_updated',
            'Shipment',
            $shipment->id,
            "Shipment {$shipment->shipment_reference} updated",
            ['po_number' => $shipment->purchaseOrder->po_number]
        );

        return response()->json([
            'message' => 'Shipment updated successfully',
            'shipment' => $shipment,
        ]);
    }

    /**
     * Update shipment status
     */
    public function updateStatus(Request $request, $poId, $id)
    {
        $user = $request->user();
        $shipment = Shipment::with('purchaseOrder')->findOrFail($id);

        // Check permission
        if (!$this->canManageShipment($user, $shipment->purchaseOrder)) {
            return response()->json([
                'message' => 'You do not have permission to update shipment status',
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'status' => 'required|string|in:preparing,dispatched,in_transit,customs,out_for_delivery,delivered,cancelled',
            'location' => 'nullable|string|max:255',
            'notes' => 'nullable|string|max:1000',
            'is_milestone' => 'nullable|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        DB::beginTransaction();
        try {
            $oldStatus = $shipment->status;
            $newStatus = $request->status;

            // Update status with automatic date tracking
            $shipment->updateStatus(
                $newStatus,
                $user->id,
                $request->notes,
                [
                    'location' => $request->location,
                    'is_milestone' => $request->input('is_milestone', $this->isMilestoneStatus($newStatus)),
                ]
            );

            // Send notification if status is significant
            if ($this->shouldNotifyStatusChange($oldStatus, $newStatus)) {
                $this->sendStatusChangeNotification($shipment, $oldStatus, $newStatus);
            }

            // Reload with relationships
            $shipment->load(['updates' => function ($query) {
                $query->ordered('desc');
            }]);

            // Log activity
            $this->activityLog->log(
                'shipment_status_updated',
                'Shipment',
                $shipment->id,
                "Shipment {$shipment->shipment_reference} status changed from {$oldStatus} to {$newStatus}",
                [
                    'po_number' => $shipment->purchaseOrder->po_number,
                    'old_status' => $oldStatus,
                    'new_status' => $newStatus,
                ]
            );

            DB::commit();

            return response()->json([
                'message' => 'Shipment status updated successfully',
                'shipment' => $shipment,
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'message' => 'Failed to update shipment status',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Add shipment update/tracking event
     */
    public function addUpdate(Request $request, $poId, $id)
    {
        $user = $request->user();
        $shipment = Shipment::with('purchaseOrder')->findOrFail($id);

        // Check permission
        if (!$this->canManageShipment($user, $shipment->purchaseOrder)) {
            return response()->json([
                'message' => 'You do not have permission to add shipment updates',
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'update_date' => 'required|date',
            'location' => 'nullable|string|max:255',
            'description' => 'required|string|max:1000',
            'is_milestone' => 'nullable|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        $update = ShipmentUpdate::create([
            'shipment_id' => $shipment->id,
            'update_date' => $request->update_date,
            'status' => $shipment->status,
            'location' => $request->location,
            'description' => $request->description,
            'is_milestone' => $request->input('is_milestone', false),
            'updated_by' => $user->id,
        ]);

        $update->load('updatedBy:id,name');

        // Log activity
        $this->activityLog->log(
            'shipment_update_added',
            'ShipmentUpdate',
            $update->id,
            "Tracking update added to shipment {$shipment->shipment_reference}",
            ['description' => $request->description]
        );

        return response()->json([
            'message' => 'Shipment update added successfully',
            'update' => $update,
        ], 201);
    }

    /**
     * Get shipment statistics for a PO
     */
    public function statistics(Request $request, $poId)
    {
        $user = $request->user();
        $po = PurchaseOrder::findOrFail($poId);

        // Check access permission
        if (!$this->permissionService->canAccessPurchaseOrder($user, $po)) {
            return response()->json([
                'message' => 'You do not have permission to view shipment statistics',
            ], 403);
        }

        $totalShipments = Shipment::where('purchase_order_id', $poId)->count();
        $deliveredShipments = Shipment::where('purchase_order_id', $poId)->where('status', 'delivered')->count();
        $inTransitShipments = Shipment::where('purchase_order_id', $poId)->where('status', 'in_transit')->count();
        $delayedShipments = Shipment::where('purchase_order_id', $poId)
            ->whereNotIn('status', ['delivered', 'cancelled'])
            ->where('estimated_delivery_date', '<', now())
            ->count();

        $byStatus = Shipment::where('purchase_order_id', $poId)
            ->select('status', DB::raw('count(*) as count'))
            ->groupBy('status')
            ->get()
            ->pluck('count', 'status');

        $byMethod = Shipment::where('purchase_order_id', $poId)
            ->select('shipment_method', DB::raw('count(*) as count'))
            ->groupBy('shipment_method')
            ->get()
            ->pluck('count', 'shipment_method');

        return response()->json([
            'po_number' => $po->po_number,
            'total_shipments' => $totalShipments,
            'delivered_shipments' => $deliveredShipments,
            'in_transit_shipments' => $inTransitShipments,
            'delayed_shipments' => $delayedShipments,
            'by_status' => $byStatus,
            'by_method' => $byMethod,
        ]);
    }

    /**
     * Public tracking page (no authentication required)
     */
    public function publicTrack(Request $request, $token)
    {
        $shipment = Shipment::where('tracking_token', $token)
            ->with([
                'purchaseOrder:id,po_number',
                'items.style:id,style_number,description',
                'updates' => function ($query) {
                    $query->ordered('desc');
                },
            ])
            ->first();

        if (!$shipment) {
            return response()->json([
                'message' => 'Shipment not found or tracking token is invalid',
            ], 404);
        }

        // Return limited public information
        return response()->json([
            'shipment_reference' => $shipment->shipment_reference,
            'tracking_number' => $shipment->tracking_number,
            'carrier_name' => $shipment->carrier_name,
            'carrier_tracking_url' => $shipment->carrier_tracking_url,
            'status' => $shipment->status,
            'progress_percentage' => $shipment->getProgressPercentage(),
            'estimated_delivery_date' => $shipment->estimated_delivery_date,
            'actual_delivery_date' => $shipment->actual_delivery_date,
            'is_delayed' => $shipment->isDelayed(),
            'days_until_delivery' => $shipment->getDaysUntilDelivery(),
            'port_of_loading' => $shipment->port_of_loading,
            'port_of_discharge' => $shipment->port_of_discharge,
            'final_destination' => $shipment->final_destination,
            'items' => $shipment->items->map(function ($item) {
                return [
                    'style_number' => $item->style->style_number,
                    'description' => $item->style->description,
                    'quantity_shipped' => $item->quantity_shipped,
                ];
            }),
            'updates' => $shipment->updates->map(function ($update) {
                return [
                    'date' => $update->update_date->format('Y-m-d H:i'),
                    'status' => $update->status,
                    'location' => $update->location,
                    'description' => $update->description,
                    'is_milestone' => $update->is_milestone,
                ];
            }),
        ]);
    }

    /**
     * Generate shipment reference
     */
    private function generateShipmentReference(PurchaseOrder $po): string
    {
        $date = now()->format('Ymd');
        $random = strtoupper(substr(md5(uniqid()), 0, 4));
        return "SH-{$po->po_number}-{$date}-{$random}";
    }

    /**
     * Check if user can manage shipment
     */
    private function canManageShipment(object $user, PurchaseOrder $po): bool
    {
        // Admin can always manage
        if ($user->hasRole('admin')) {
            return true;
        }

        // Check if user has shipment permissions and PO access
        return $this->permissionService->canAccessPurchaseOrder($user, $po);
    }

    /**
     * Check if status is a milestone
     */
    private function isMilestoneStatus(string $status): bool
    {
        return in_array($status, ['dispatched', 'in_transit', 'customs', 'out_for_delivery', 'delivered']);
    }

    /**
     * Check if status change should trigger notification
     */
    private function shouldNotifyStatusChange(string $oldStatus, string $newStatus): bool
    {
        $notifiableStatuses = ['dispatched', 'in_transit', 'out_for_delivery', 'delivered', 'cancelled'];
        return in_array($newStatus, $notifiableStatuses);
    }

    /**
     * Send shipment created notification
     */
    private function sendShipmentCreatedNotification(Shipment $shipment): void
    {
        try {
            $po = $shipment->purchaseOrder;

            $this->emailService->sendTemplatedEmail(
                'shipment_created',
                $po->importer->email,
                [
                    'importer_name' => $po->importer->name,
                    'shipment_reference' => $shipment->shipment_reference,
                    'po_number' => $po->po_number,
                    'carrier_name' => $shipment->carrier_name,
                    'tracking_number' => $shipment->tracking_number,
                    'public_tracking_url' => $shipment->getPublicTrackingUrl(),
                ]
            );
        } catch (\Exception $e) {
            \Log::error('Failed to send shipment created notification: ' . $e->getMessage());
        }
    }

    /**
     * Send status change notification
     */
    private function sendStatusChangeNotification(Shipment $shipment, string $oldStatus, string $newStatus): void
    {
        try {
            $po = $shipment->purchaseOrder;

            $this->emailService->sendTemplatedEmail(
                'shipment_status_changed',
                $po->importer->email,
                [
                    'importer_name' => $po->importer->name,
                    'shipment_reference' => $shipment->shipment_reference,
                    'po_number' => $po->po_number,
                    'old_status' => ucfirst(str_replace('_', ' ', $oldStatus)),
                    'new_status' => ucfirst(str_replace('_', ' ', $newStatus)),
                    'public_tracking_url' => $shipment->getPublicTrackingUrl(),
                ]
            );

            // Notify agency if assigned
            if ($po->agency_id) {
                $this->emailService->sendTemplatedEmail(
                    'shipment_status_changed',
                    $po->agency->email,
                    [
                        'importer_name' => $po->agency->name,
                        'shipment_reference' => $shipment->shipment_reference,
                        'po_number' => $po->po_number,
                        'old_status' => ucfirst(str_replace('_', ' ', $oldStatus)),
                        'new_status' => ucfirst(str_replace('_', ' ', $newStatus)),
                        'public_tracking_url' => $shipment->getPublicTrackingUrl(),
                    ]
                );
            }
        } catch (\Exception $e) {
            \Log::error('Failed to send status change notification: ' . $e->getMessage());
        }
    }

    /**
     * Get all shipments across all POs (aggregate view)
     */
    public function indexAll(Request $request)
    {
        $user = $request->user();

        $query = \App\Models\Shipment::with(['purchaseOrder:id,po_number,importer_id']);

        // Apply role-based filtering
        if ($user->hasRole('Factory')) {
            // Factories can see shipments for POs with their assigned styles
            $query->whereHas('purchaseOrder.styles', function($q) use ($user) {
                $q->where('assigned_factory_id', $user->id);
            });
        } elseif ($user->hasRole('Importer')) {
            $query->whereHas('purchaseOrder', function($q) use ($user) {
                $q->where('created_by', $user->id);
            });
        }

        // Status filter
        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        // Search
        if ($request->has('search')) {
            $search = $request->search;
            $query->where(function($q) use ($search) {
                $q->where('tracking_number', 'like', "%{$search}%")
                  ->orWhere('carrier', 'like', "%{$search}%")
                  ->orWhereHas('purchaseOrder', function($pq) use ($search) {
                    $pq->where('po_number', 'like', "%{$search}%");
                  });
            });
        }

        return response()->json($query->orderBy('shipped_date', 'desc')->paginate($request->input('per_page', 20)));
    }
}
