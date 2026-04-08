<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ProductionTracking;
use App\Models\ProductionStage;
use App\Models\PurchaseOrder;
use App\Models\Style;
use App\Services\ActivityLogService;
use App\Services\EmailService;
use App\Services\PermissionService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class ProductionTrackingController extends Controller
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
     * Get production tracking records for a style
     */
    public function index(Request $request, $poId, $styleId)
    {
        $user = $request->user();
        $style = Style::findOrFail($styleId);
        $po = PurchaseOrder::findOrFail($poId);

        // Check access permission
        if (!$this->permissionService->canAccessPurchaseOrder($user, $po)) {
            return response()->json([
                'message' => 'You do not have permission to view this production tracking',
            ], 403);
        }

        $query = ProductionTracking::with([
            'productionStage',
            'submittedBy:id,name,email',
        ])
            ->where('style_id', $styleId);

        // Filter by stage
        if ($request->has('stage_id')) {
            $query->where('production_stage_id', $request->stage_id);
        }

        // Filter by date range
        if ($request->has('start_date') && $request->has('end_date')) {
            $query->whereBetween('tracking_date', [$request->start_date, $request->end_date]);
        }

        // Sort by date desc by default
        $sortField = $request->input('sort_field', 'tracking_date');
        $sortOrder = $request->input('sort_order', 'desc');
        $query->orderBy($sortField, $sortOrder);

        $perPage = $request->input('per_page', 50);
        $records = $query->paginate($perPage);

        return response()->json($records);
    }

    /**
     * Submit daily production update
     */
    public function store(Request $request, $poId, $styleId)
    {
        $user = $request->user();
        $style = Style::findOrFail($styleId);
        $po = PurchaseOrder::findOrFail($poId);

        // Check if user is assigned factory
        if (!$this->canSubmitProductionUpdate($user, $style, $po)) {
            return response()->json([
                'message' => 'You do not have permission to submit production updates for this style',
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'production_stage_id' => 'required|exists:production_stages,id',
            'tracking_date' => 'required|date|before_or_equal:today',
            'quantity_produced' => 'required|integer|min:0',
            'quantity_rejected' => 'nullable|integer|min:0',
            'quantity_reworked' => 'nullable|integer|min:0',
            'notes' => 'nullable|string|max:1000',
            'images' => 'nullable|array',
            'images.*' => 'nullable|string|max:500',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        // Check for duplicate entry (same style, stage, date)
        $exists = ProductionTracking::where('style_id', $styleId)
            ->where('production_stage_id', $request->production_stage_id)
            ->where('tracking_date', $request->tracking_date)
            ->exists();

        if ($exists) {
            return response()->json([
                'message' => 'Production tracking record already exists for this stage and date. Please update the existing record instead.',
            ], 422);
        }

        DB::beginTransaction();
        try {
            $tracking = ProductionTracking::create([
                'style_id' => $styleId,
                'production_stage_id' => $request->production_stage_id,
                'tracking_date' => $request->tracking_date,
                'quantity_produced' => $request->quantity_produced,
                'quantity_rejected' => $request->quantity_rejected ?? 0,
                'quantity_reworked' => $request->quantity_reworked ?? 0,
                'notes' => $request->notes,
                'images' => $request->images ?? [],
                'submitted_by' => $user->id,
            ]);

            // Calculate cumulative quantity and completion percentage
            $tracking->updateCumulativeQuantity();
            $tracking->calculateCompletionPercentage();

            // Reload with relationships
            $tracking->load(['productionStage', 'submittedBy:id,name,email']);

            // Send notification if stage is completed
            if ($tracking->completion_percentage >= 100) {
                $this->sendStageCompletedNotification($tracking);
            }

            // Log activity
            $this->activityLog->log(
                'production_tracking_submitted',
                'ProductionTracking',
                $tracking->id,
                "Production update submitted for {$tracking->productionStage->name}",
                [
                    'style_number' => $style->style_number,
                    'stage' => $tracking->productionStage->name,
                    'quantity_produced' => $tracking->quantity_produced,
                    'completion_percentage' => $tracking->completion_percentage,
                ]
            );

            DB::commit();

            return response()->json([
                'message' => 'Production tracking record created successfully',
                'tracking' => $tracking,
            ], 201);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'message' => 'Failed to create production tracking record',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Get single production tracking record
     */
    public function show(Request $request, $poId, $styleId, $id)
    {
        $user = $request->user();
        $tracking = ProductionTracking::with([
            'style',
            'productionStage',
            'submittedBy:id,name,email',
        ])->findOrFail($id);
        $po = PurchaseOrder::findOrFail($poId);

        // Check access permission
        if (!$this->permissionService->canAccessPurchaseOrder($user, $po)) {
            return response()->json([
                'message' => 'You do not have permission to view this production tracking',
            ], 403);
        }

        return response()->json($tracking);
    }

    /**
     * Update production tracking record
     */
    public function update(Request $request, $poId, $styleId, $id)
    {
        $user = $request->user();
        $tracking = ProductionTracking::with('style')->findOrFail($id);

        // Check if user is assigned factory
        if (!$this->canSubmitProductionUpdate($user, $tracking->style, PurchaseOrder::findOrFail($poId))) {
            return response()->json([
                'message' => 'You do not have permission to update this production tracking',
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'quantity_produced' => 'sometimes|integer|min:0',
            'quantity_rejected' => 'sometimes|integer|min:0',
            'quantity_reworked' => 'sometimes|integer|min:0',
            'notes' => 'nullable|string|max:1000',
            'images' => 'nullable|array',
            'images.*' => 'nullable|string|max:500',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        DB::beginTransaction();
        try {
            $tracking->fill($request->only([
                'quantity_produced',
                'quantity_rejected',
                'quantity_reworked',
                'notes',
                'images',
            ]));
            $tracking->save();

            // Recalculate cumulative quantity and completion percentage
            $tracking->updateCumulativeQuantity();
            $tracking->calculateCompletionPercentage();

            // Reload with relationships
            $tracking->load(['productionStage', 'submittedBy:id,name,email']);

            // Log activity
            $this->activityLog->log(
                'production_tracking_updated',
                'ProductionTracking',
                $tracking->id,
                "Production update modified for {$tracking->productionStage->name}",
                [
                    'style_number' => $tracking->style->style_number,
                    'stage' => $tracking->productionStage->name,
                ]
            );

            DB::commit();

            return response()->json([
                'message' => 'Production tracking record updated successfully',
                'tracking' => $tracking,
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'message' => 'Failed to update production tracking record',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Delete production tracking record
     */
    public function destroy(Request $request, $poId, $styleId, $id)
    {
        $user = $request->user();
        $tracking = ProductionTracking::with('style')->findOrFail($id);

        // Only admin or the submitter can delete
        if (!$user->hasRole('Super Admin') && $tracking->submitted_by !== $user->id) {
            return response()->json([
                'message' => 'You do not have permission to delete this production tracking',
            ], 403);
        }

        $stage = $tracking->productionStage->name;
        $tracking->delete();

        // Log activity
        $this->activityLog->log(
            'production_tracking_deleted',
            'ProductionTracking',
            $id,
            "Production update deleted for {$stage}",
            [
                'style_number' => $tracking->style->style_number,
            ]
        );

        return response()->json([
            'message' => 'Production tracking record deleted successfully',
        ]);
    }

    /**
     * Get production statistics for a style
     */
    public function statistics(Request $request, $poId, $styleId)
    {
        $user = $request->user();
        $style = Style::findOrFail($styleId);
        $po = PurchaseOrder::findOrFail($poId);

        // Check access permission
        if (!$this->permissionService->canAccessPurchaseOrder($user, $po)) {
            return response()->json([
                'message' => 'You do not have permission to view production statistics',
            ], 403);
        }

        // Get all production stages with their latest tracking data
        $stages = ProductionStage::active()
            ->ordered()
            ->get()
            ->map(function ($stage) use ($styleId) {
                $latestTracking = ProductionTracking::where('style_id', $styleId)
                    ->where('production_stage_id', $stage->id)
                    ->orderBy('tracking_date', 'desc')
                    ->first();

                $totalProduced = ProductionTracking::where('style_id', $styleId)
                    ->where('production_stage_id', $stage->id)
                    ->sum('quantity_produced');

                $totalRejected = ProductionTracking::where('style_id', $styleId)
                    ->where('production_stage_id', $stage->id)
                    ->sum('quantity_rejected');

                return [
                    'stage_id' => $stage->id,
                    'stage_name' => $stage->name,
                    'stage_code' => $stage->code,
                    'weight_percentage' => $stage->weight_percentage,
                    'display_order' => $stage->display_order,
                    'total_produced' => $totalProduced,
                    'total_rejected' => $totalRejected,
                    'net_quantity' => $totalProduced - $totalRejected,
                    'cumulative_quantity' => $latestTracking?->cumulative_quantity ?? 0,
                    'completion_percentage' => $latestTracking?->completion_percentage ?? 0,
                    'last_update_date' => $latestTracking?->tracking_date,
                    'is_completed' => ($latestTracking?->completion_percentage ?? 0) >= 100,
                ];
            });

        // Calculate overall production progress (weighted by stage percentages)
        $overallProgress = $stages->sum(function ($stage) {
            return ($stage['completion_percentage'] * $stage['weight_percentage']) / 100;
        });

        return response()->json([
            'style_number' => $style->style_number,
            'total_quantity' => $style->quantity,
            'overall_progress' => round($overallProgress, 2),
            'stages' => $stages,
        ]);
    }

    /**
     * Get production timeline for a style
     */
    public function timeline(Request $request, $poId, $styleId)
    {
        $user = $request->user();
        $style = Style::findOrFail($styleId);
        $po = PurchaseOrder::findOrFail($poId);

        // Check access permission
        if (!$this->permissionService->canAccessPurchaseOrder($user, $po)) {
            return response()->json([
                'message' => 'You do not have permission to view production timeline',
            ], 403);
        }

        $tracking = ProductionTracking::with([
            'productionStage:id,name,code,display_order',
            'submittedBy:id,name',
        ])
            ->where('style_id', $styleId)
            ->orderBy('tracking_date', 'asc')
            ->orderBy('production_stage_id', 'asc')
            ->get()
            ->map(function ($record) {
                return [
                    'id' => $record->id,
                    'date' => $record->tracking_date->format('Y-m-d'),
                    'stage' => $record->productionStage->name,
                    'stage_code' => $record->productionStage->code,
                    'quantity_produced' => $record->quantity_produced,
                    'quantity_rejected' => $record->quantity_rejected,
                    'net_quantity' => $record->getNetQuantityAttribute(),
                    'acceptance_rate' => $record->getAcceptanceRateAttribute(),
                    'cumulative_quantity' => $record->cumulative_quantity,
                    'completion_percentage' => $record->completion_percentage,
                    'submitted_by' => $record->submittedBy->name,
                    'notes' => $record->notes,
                ];
            });

        return response()->json([
            'style_number' => $style->style_number,
            'timeline' => $tracking,
        ]);
    }

    /**
     * Get production stages (master data)
     */
    public function stages(Request $request)
    {
        $stages = ProductionStage::active()->ordered()->get();

        return response()->json($stages);
    }

    /**
     * Check if user can submit production updates for a style
     */
    private function canSubmitProductionUpdate(object $user, Style $style, ?PurchaseOrder $po = null): bool
    {
        // Admin can always submit
        if ($user->hasRole('Super Admin')) {
            return true;
        }

        // Check if user is factory role
        if (!$user->hasRole('Factory')) {
            return false;
        }

        // Check if factory is assigned to this style's PO
        $effectivePo = $po ?? $style->getEffectivePurchaseOrder();
        if (!$effectivePo) {
            return false;
        }

        return $effectivePo->factoryAssignments()
            ->where('factory_id', $user->id)
            ->where('status', 'accepted')
            ->exists();
    }

    /**
     * Send notification when production stage is completed
     */
    private function sendStageCompletedNotification(ProductionTracking $tracking): void
    {
        try {
            $style = $tracking->style;
            $po = $style->getEffectivePurchaseOrder();
            if (!$po) {
                return;
            }
            $stage = $tracking->productionStage;

            // Notify importer
            $this->emailService->sendTemplatedEmail(
                'production_stage_completed',
                $po->importer->email,
                [
                    'importer_name' => $po->importer->name,
                    'po_number' => $po->po_number,
                    'style_number' => $style->style_number,
                    'stage_name' => $stage->name,
                    'completion_date' => $tracking->tracking_date->format('Y-m-d'),
                    'quantity_produced' => $tracking->cumulative_quantity,
                    'total_quantity' => $style->quantity,
                ]
            );

            // Notify agency if assigned
            if ($po->agency_id) {
                $this->emailService->sendTemplatedEmail(
                    'production_stage_completed',
                    $po->agency->email,
                    [
                        'importer_name' => $po->agency->name,
                        'po_number' => $po->po_number,
                        'style_number' => $style->style_number,
                        'stage_name' => $stage->name,
                        'completion_date' => $tracking->tracking_date->format('Y-m-d'),
                        'quantity_produced' => $tracking->cumulative_quantity,
                        'total_quantity' => $style->quantity,
                    ]
                );
            }
        } catch (\Exception $e) {
            \Log::error('Failed to send stage completed notification: ' . $e->getMessage());
        }
    }

    /**
     * Get all production tracking records across all POs and styles (aggregate view)
     */
    public function indexAll(Request $request)
    {
        $user = $request->user();

        $query = \App\Models\ProductionTracking::with([
            'style.purchaseOrders:id,po_number',
            'style:id,style_number,total_quantity',
            'productionStage:id,name,sequence'
        ]);

        // Apply role-based filtering
        if ($user->hasRole('Factory')) {
            $query->whereHas('style', function($q) use ($user) {
                $q->where('styles.assigned_factory_id', $user->id);
            });
        } elseif ($user->hasRole('Importer')) {
            $query->whereHas('style.purchaseOrders', function($q) use ($user) {
                $q->where('importer_id', $user->id);
            });
        }

        // Search
        if ($request->has('search')) {
            $search = $request->search;
            $query->where(function($q) use ($search) {
                $q->whereHas('style', function($sq) use ($search) {
                    $sq->where('style_number', 'like', "%{$search}%");
                })->orWhereHas('style.purchaseOrders', function($pq) use ($search) {
                    $pq->where('po_number', 'like', "%{$search}%");
                });
            });
        }

        return response()->json($query->orderBy('updated_date', 'desc')->paginate($request->input('per_page', 20)));
    }
}
