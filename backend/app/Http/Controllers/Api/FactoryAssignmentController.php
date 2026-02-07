<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\FactoryAssignment;
use App\Models\PurchaseOrder;
use App\Services\ActivityLogService;
use App\Services\PermissionService;
use Illuminate\Http\Request;

class FactoryAssignmentController extends Controller
{
    protected ActivityLogService $activityLog;
    protected PermissionService $permissionService;

    public function __construct(ActivityLogService $activityLog, PermissionService $permissionService)
    {
        $this->activityLog = $activityLog;
        $this->permissionService = $permissionService;
    }

    /**
     * Get all factory assignments for a PO
     */
    public function index(Request $request, $poId)
    {
        $user = $request->user();
        $po = PurchaseOrder::findOrFail($poId);

        // Check permission
        if (!$this->permissionService->canAccessPO($user, $po)) {
            return response()->json([
                'message' => 'You do not have permission to view factory assignments for this purchase order',
            ], 403);
        }

        $query = FactoryAssignment::with(['factory', 'assignedBy'])
            ->where('purchase_order_id', $poId);

        // Status filter
        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        // Factory filter
        if ($request->has('factory_id')) {
            $query->where('factory_id', $request->factory_id);
        }

        // Assignment type filter
        if ($request->has('assignment_type')) {
            $query->where('assignment_type', $request->assignment_type);
        }

        $assignments = $query->orderBy('created_at', 'desc')->get();

        return response()->json([
            'assignments' => $assignments->map(function ($assignment) {
                return [
                    'id' => $assignment->id,
                    'factory' => [
                        'id' => $assignment->factory->id,
                        'name' => $assignment->factory->name,
                        'email' => $assignment->factory->email,
                        'company' => $assignment->factory->company,
                    ],
                    'assigned_by' => [
                        'id' => $assignment->assignedBy->id,
                        'name' => $assignment->assignedBy->name,
                    ],
                    'assignment_type' => $assignment->assignment_type,
                    'status' => $assignment->status,
                    'accepted_at' => $assignment->accepted_at,
                    'rejected_at' => $assignment->rejected_at,
                    'rejection_reason' => $assignment->rejection_reason,
                    'notes' => $assignment->notes,
                    'created_at' => $assignment->created_at,
                ];
            }),
        ]);
    }

    /**
     * Get single factory assignment
     */
    public function show(Request $request, $poId, $id)
    {
        $user = $request->user();
        $assignment = FactoryAssignment::with(['factory', 'assignedBy', 'purchaseOrder'])
            ->where('id', $id)
            ->where('purchase_order_id', $poId)
            ->firstOrFail();

        // Check permission
        if (!$this->permissionService->canAccessPO($user, $assignment->purchaseOrder)) {
            return response()->json([
                'message' => 'You do not have permission to view this factory assignment',
            ], 403);
        }

        return response()->json([
            'assignment' => [
                'id' => $assignment->id,
                'purchase_order' => [
                    'id' => $assignment->purchaseOrder->id,
                    'po_number' => $assignment->purchaseOrder->po_number,
                    'brand_name' => $assignment->purchaseOrder->brand_name,
                ],
                'factory' => [
                    'id' => $assignment->factory->id,
                    'name' => $assignment->factory->name,
                    'email' => $assignment->factory->email,
                    'company' => $assignment->factory->company,
                    'country' => $assignment->factory->country,
                ],
                'assigned_by' => [
                    'id' => $assignment->assignedBy->id,
                    'name' => $assignment->assignedBy->name,
                    'email' => $assignment->assignedBy->email,
                ],
                'assignment_type' => $assignment->assignment_type,
                'status' => $assignment->status,
                'accepted_at' => $assignment->accepted_at,
                'rejected_at' => $assignment->rejected_at,
                'rejection_reason' => $assignment->rejection_reason,
                'notes' => $assignment->notes,
                'metadata' => $assignment->metadata,
                'created_at' => $assignment->created_at,
                'updated_at' => $assignment->updated_at,
            ],
        ]);
    }

    /**
     * Get assignments for current user (factory view)
     */
    public function myAssignments(Request $request)
    {
        $user = $request->user();

        // User must be a factory
        if (!$user->hasRole('Factory')) {
            return response()->json([
                'message' => 'You must be a factory to view assignments',
            ], 403);
        }

        $query = FactoryAssignment::with(['purchaseOrder', 'assignedBy'])
            ->where('factory_id', $user->id);

        // Status filter
        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        $assignments = $query->orderBy('created_at', 'desc')->get();

        return response()->json([
            'assignments' => $assignments->map(function ($assignment) {
                return [
                    'id' => $assignment->id,
                    'purchase_order' => [
                        'id' => $assignment->purchaseOrder->id,
                        'po_number' => $assignment->purchaseOrder->po_number,
                        'brand_name' => $assignment->purchaseOrder->brand_name,
                        'order_date' => $assignment->purchaseOrder->order_date?->format('Y-m-d'),
                    ],
                    'assigned_by' => [
                        'id' => $assignment->assignedBy->id,
                        'name' => $assignment->assignedBy->name,
                        'company' => $assignment->assignedBy->company,
                    ],
                    'assignment_type' => $assignment->assignment_type,
                    'status' => $assignment->status,
                    'created_at' => $assignment->created_at,
                ];
            }),
        ]);
    }

    /**
     * Get styles assigned to a factory for a PO
     */
    public function assignedStyles(Request $request, $poId, $assignmentId)
    {
        $user = $request->user();
        $assignment = FactoryAssignment::with(['purchaseOrder'])
            ->where('id', $assignmentId)
            ->where('purchase_order_id', $poId)
            ->firstOrFail();

        // Check permission
        if (!$this->permissionService->canAccessPO($user, $assignment->purchaseOrder)) {
            return response()->json([
                'message' => 'You do not have permission to view styles for this assignment',
            ], 403);
        }

        // Get styles assigned to this factory for this PO
        $styles = $assignment->purchaseOrder->styles()
            ->where('assigned_factory_id', $assignment->factory_id)
            ->get();

        return response()->json([
            'assignment' => [
                'id' => $assignment->id,
                'factory' => [
                    'id' => $assignment->factory->id,
                    'name' => $assignment->factory->name,
                ],
            ],
            'styles' => $styles->map(function ($style) {
                return [
                    'id' => $style->id,
                    'style_number' => $style->style_number,
                    'description' => $style->description,
                    'quantity' => $style->quantity,
                    'unit_price' => $style->unit_price,
                    'total_price' => $style->total_price,
                    'status' => $style->status,
                ];
            }),
            'total_quantity' => $styles->sum('quantity'),
            'total_value' => $styles->sum('total_price'),
        ]);
    }

    /**
     * Update assignment notes
     */
    public function updateNotes(Request $request, $poId, $id)
    {
        $user = $request->user();
        $assignment = FactoryAssignment::where('id', $id)
            ->where('purchase_order_id', $poId)
            ->firstOrFail();

        // Check permission - only assigned_by user can update notes
        if ($assignment->assigned_by !== $user->id) {
            return response()->json([
                'message' => 'You are not authorized to update notes for this assignment',
            ], 403);
        }

        $request->validate([
            'notes' => 'nullable|string',
        ]);

        $assignment->notes = $request->notes;
        $assignment->save();

        // Log update
        $this->activityLog->log(
            'assignment_notes_updated',
            'FactoryAssignment',
            $assignment->id,
            'Assignment notes updated',
            [
                'factory_id' => $assignment->factory_id,
                'po_number' => $assignment->purchaseOrder->po_number,
            ]
        );

        return response()->json([
            'message' => 'Notes updated successfully',
            'notes' => $assignment->notes,
        ]);
    }

    /**
     * Remove factory assignment
     */
    public function destroy(Request $request, $poId, $id)
    {
        $user = $request->user();
        $assignment = FactoryAssignment::where('id', $id)
            ->where('purchase_order_id', $poId)
            ->firstOrFail();

        // Check permission - only assigned_by user can remove
        if ($assignment->assigned_by !== $user->id) {
            return response()->json([
                'message' => 'You are not authorized to remove this assignment',
            ], 403);
        }

        // Check if factory has styles assigned
        $stylesCount = $assignment->purchaseOrder->styles()
            ->where('assigned_factory_id', $assignment->factory_id)
            ->count();

        if ($stylesCount > 0) {
            return response()->json([
                'message' => "Cannot remove assignment. Factory has {$stylesCount} style(s) assigned.",
                'styles_count' => $stylesCount,
            ], 422);
        }

        $assignmentData = [
            'factory_id' => $assignment->factory_id,
            'factory_name' => $assignment->factory->name,
            'po_number' => $assignment->purchaseOrder->po_number,
        ];

        // Log deletion
        $this->activityLog->logDeleted('FactoryAssignment', $assignment->id, $assignmentData);

        $assignment->delete();

        return response()->json([
            'message' => 'Factory assignment removed successfully',
        ]);
    }

    /**
     * Get assignment statistics for a PO
     */
    public function statistics(Request $request, $poId)
    {
        $user = $request->user();
        $po = PurchaseOrder::findOrFail($poId);

        // Check permission
        if (!$this->permissionService->canAccessPO($user, $po)) {
            return response()->json([
                'message' => 'You do not have permission to view statistics for this purchase order',
            ], 403);
        }

        $assignments = FactoryAssignment::where('purchase_order_id', $poId)->get();

        $stats = [
            'total_assignments' => $assignments->count(),
            'accepted' => $assignments->where('status', 'accepted')->count(),
            'pending' => $assignments->where('status', 'pending')->count(),
            'rejected' => $assignments->where('status', 'rejected')->count(),
            'by_type' => [
                'direct' => $assignments->where('assignment_type', 'direct')->count(),
                'via_agency' => $assignments->where('assignment_type', 'via_agency')->count(),
            ],
            'factories' => $assignments->unique('factory_id')->count(),
        ];

        return response()->json([
            'statistics' => $stats,
        ]);
    }

    /**
     * Get all factory assignments across all POs (aggregate view)
     */
    public function indexAll(Request $request)
    {
        $user = $request->user();

        $query = \App\Models\FactoryAssignment::with([
            'purchaseOrder:id,po_number',
            'factory:id,name,company',
            'assignedBy:id,name'
        ]);

        // Apply role-based filtering
        if ($user->hasRole('Factory')) {
            $query->where('factory_id', $user->id);
        } elseif ($user->hasRole('Importer')) {
            $query->whereHas('purchaseOrder', function($q) use ($user) {
                $q->where('created_by', $user->id);
            });
        }

        // Factory filter
        if ($request->has('factory_id')) {
            $query->where('factory_id', $request->factory_id);
        }

        // Assignment type filter
        if ($request->has('assignment_type')) {
            $query->where('assignment_type', $request->assignment_type);
        }

        // Search
        if ($request->has('search')) {
            $search = $request->search;
            $query->where(function($q) use ($search) {
                $q->whereHas('purchaseOrder', function($pq) use ($search) {
                    $pq->where('po_number', 'like', "%{$search}%");
                })->orWhereHas('factory', function($fq) use ($search) {
                    $fq->where('name', 'like', "%{$search}%")
                       ->orWhere('company', 'like', "%{$search}%");
                });
            });
        }

        return response()->json($query->orderBy('assigned_at', 'desc')->paginate($request->input('per_page', 15)));
    }
}
