<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Jobs\SendPurchaseOrderNotification;
use App\Models\FactoryAssignment;
use App\Models\PurchaseOrder;
use App\Models\Style;
use App\Models\User;
use App\Services\ActivityLogService;
use App\Services\PermissionService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

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

        if (!$this->permissionService->canAccessPO($user, $po)) {
            return response()->json([
                'message' => 'You do not have permission to view factory assignments for this purchase order',
            ], 403);
        }

        $query = FactoryAssignment::with(['style', 'factory', 'assignedBy'])
            ->where('purchase_order_id', $poId);

        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        if ($request->has('factory_id')) {
            $query->where('factory_id', $request->factory_id);
        }

        if ($request->has('assignment_type')) {
            $query->where('assignment_type', $request->assignment_type);
        }

        $assignments = $query->orderBy('created_at', 'desc')->get();

        return response()->json([
            'assignments' => $assignments->map(function ($assignment) {
                return [
                    'id' => $assignment->id,
                    'style' => $assignment->style ? [
                        'id' => $assignment->style->id,
                        'style_number' => $assignment->style->style_number,
                        'description' => $assignment->style->description,
                    ] : null,
                    'factory' => $assignment->factory ? [
                        'id' => $assignment->factory->id,
                        'name' => $assignment->factory->name,
                        'email' => $assignment->factory->email,
                        'company' => $assignment->factory->company,
                    ] : null,
                    'assigned_by' => $assignment->assignedBy ? [
                        'id' => $assignment->assignedBy->id,
                        'name' => $assignment->assignedBy->name,
                    ] : null,
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
        $assignment = FactoryAssignment::with(['factory', 'assignedBy', 'purchaseOrder', 'style'])
            ->where('id', $id)
            ->where('purchase_order_id', $poId)
            ->firstOrFail();

        if (!$this->permissionService->canAccessPO($user, $assignment->purchaseOrder)) {
            return response()->json([
                'message' => 'You do not have permission to view this factory assignment',
            ], 403);
        }

        return response()->json([
            'assignment' => [
                'id' => $assignment->id,
                'purchase_order' => $assignment->purchaseOrder ? [
                    'id' => $assignment->purchaseOrder->id,
                    'po_number' => $assignment->purchaseOrder->po_number,
                    'headline' => $assignment->purchaseOrder->headline,
                ] : null,
                'style' => $assignment->style ? [
                    'id' => $assignment->style->id,
                    'style_number' => $assignment->style->style_number,
                    'description' => $assignment->style->description,
                ] : null,
                'factory' => $assignment->factory ? [
                    'id' => $assignment->factory->id,
                    'name' => $assignment->factory->name,
                    'email' => $assignment->factory->email,
                    'company' => $assignment->factory->company,
                    'country' => $assignment->factory->country,
                ] : null,
                'assigned_by' => $assignment->assignedBy ? [
                    'id' => $assignment->assignedBy->id,
                    'name' => $assignment->assignedBy->name,
                    'email' => $assignment->assignedBy->email,
                ] : null,
                'assignment_type' => $assignment->assignment_type,
                'status' => $assignment->status,
                'accepted_at' => $assignment->accepted_at,
                'rejected_at' => $assignment->rejected_at,
                'rejection_reason' => $assignment->rejection_reason,
                'notes' => $assignment->notes,
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

        if (!$user->hasRole('Factory')) {
            return response()->json([
                'message' => 'You must be a factory to view assignments',
            ], 403);
        }

        $query = FactoryAssignment::with(['purchaseOrder', 'style', 'assignedBy'])
            ->where('factory_id', $user->id);

        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        $assignments = $query->orderBy('created_at', 'desc')->get();

        return response()->json([
            'assignments' => $assignments->map(function ($assignment) {
                return [
                    'id' => $assignment->id,
                    'purchase_order' => $assignment->purchaseOrder ? [
                        'id' => $assignment->purchaseOrder->id,
                        'po_number' => $assignment->purchaseOrder->po_number,
                        'headline' => $assignment->purchaseOrder->headline,
                        'po_date' => $assignment->purchaseOrder->po_date?->format('Y-m-d'),
                    ] : null,
                    'style' => $assignment->style ? [
                        'id' => $assignment->style->id,
                        'style_number' => $assignment->style->style_number,
                        'description' => $assignment->style->description,
                    ] : null,
                    'assigned_by' => $assignment->assignedBy ? [
                        'id' => $assignment->assignedBy->id,
                        'name' => $assignment->assignedBy->name,
                        'company' => $assignment->assignedBy->company,
                    ] : null,
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

        if (!$this->permissionService->canAccessPO($user, $assignment->purchaseOrder)) {
            return response()->json([
                'message' => 'You do not have permission to view styles for this assignment',
            ], 403);
        }

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
                    'quantity' => $style->total_quantity,
                    'unit_price' => $style->unit_price,
                    'fob_price' => $style->fob_price,
                    'status' => $style->status,
                ];
            }),
            'total_quantity' => $styles->sum('total_quantity'),
            'total_value' => $styles->sum('fob_price'),
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

        $this->activityLog->log(
            'assignment_notes_updated',
            'FactoryAssignment',
            $assignment->id,
            'Assignment notes updated',
            [
                'factory_id' => $assignment->factory_id,
                'purchase_order_id' => $assignment->purchase_order_id,
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
        $assignment = FactoryAssignment::with(['factory', 'purchaseOrder'])
            ->where('id', $id)
            ->where('purchase_order_id', $poId)
            ->firstOrFail();

        if ($assignment->assigned_by !== $user->id && !$user->hasRole('Super Admin')) {
            return response()->json([
                'message' => 'You are not authorized to remove this assignment',
            ], 403);
        }

        $assignmentData = [
            'factory_id' => $assignment->factory_id,
            'factory_name' => $assignment->factory?->name,
            'style_id' => $assignment->style_id,
            'purchase_order_id' => $assignment->purchase_order_id,
        ];

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

        if (!$this->permissionService->canAccessPO($user, $po)) {
            return response()->json([
                'message' => 'You do not have permission to view statistics for this purchase order',
            ], 403);
        }

        $assignments = FactoryAssignment::where('purchase_order_id', $poId)->get();

        $stats = [
            'total_assignments' => $assignments->count(),
            'accepted' => $assignments->where('status', 'accepted')->count(),
            'invited' => $assignments->where('status', 'invited')->count(),
            'rejected' => $assignments->where('status', 'rejected')->count(),
            'by_type' => [
                'direct_to_factory' => $assignments->where('assignment_type', 'direct_to_factory')->count(),
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

        $query = FactoryAssignment::with([
            'purchaseOrder:id,po_number,headline',
            'style:id,style_number,description',
            'factory:id,name,email,company',
            'assignedBy:id,name'
        ]);

        // Role-based filtering (Super Admin sees all)
        if (!$user->hasRole('Super Admin')) {
            if ($user->hasRole('Factory')) {
                $query->where('factory_id', $user->id);
            } elseif ($user->hasRole('Importer')) {
                $query->whereHas('purchaseOrder', function ($q) use ($user) {
                    $q->where('creator_id', $user->id)
                      ->orWhere('importer_id', $user->id);
                });
            } elseif ($user->hasRole('Agency')) {
                $query->where('assigned_by', $user->id);
            }
        }

        // Factory filter
        if ($request->has('factory_id')) {
            $query->where('factory_id', $request->factory_id);
        }

        // Status filter
        if ($request->has('status') && $request->status !== 'all') {
            $query->where('status', $request->status);
        }

        // Assignment type filter
        if ($request->has('assignment_type')) {
            $query->where('assignment_type', $request->assignment_type);
        }

        // Search by style number, PO number, or factory name
        if ($request->has('search') && $request->search) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->whereHas('style', function ($sq) use ($search) {
                    $sq->where('style_number', 'like', "%{$search}%")
                       ->orWhere('description', 'like', "%{$search}%");
                })->orWhereHas('purchaseOrder', function ($pq) use ($search) {
                    $pq->where('po_number', 'like', "%{$search}%");
                })->orWhereHas('factory', function ($fq) use ($search) {
                    $fq->where('name', 'like', "%{$search}%")
                       ->orWhere('company', 'like', "%{$search}%");
                });
            });
        }

        return response()->json(
            $query->orderBy('created_at', 'desc')
                ->paginate($request->input('per_page', 15))
        );
    }

    /**
     * Bulk assign styles to a factory
     * Importers and agencies can search and multi-select styles to assign to a factory
     */
    public function bulkAssign(Request $request)
    {
        $user = $request->user();

        $validator = Validator::make($request->all(), [
            'style_ids' => 'required|array|min:1',
            'style_ids.*' => 'required|integer|exists:styles,id',
            'factory_id' => 'required|integer|exists:users,id',
            'assignment_type' => 'required|in:direct_to_factory,via_agency',
            'notes' => 'nullable|string',
            'expected_completion_date' => 'nullable|date',
            // Agency-supplied factory economics, keyed by style_id as a map.
            'factory_unit_prices' => 'nullable|array',
            'factory_unit_prices.*' => 'nullable|numeric|min:0',
            'factory_ex_factory_dates' => 'nullable|array',
            'factory_ex_factory_dates.*' => 'nullable|date',
        ]);

        if ($validator->fails()) {
            return response()->json(['errors' => $validator->errors()], 422);
        }

        // Verify the target user is a factory
        $factoryUser = User::find($request->factory_id);
        if (!$factoryUser || !$factoryUser->hasRole('Factory')) {
            return response()->json(['message' => 'Selected user is not a factory'], 422);
        }

        $styles = Style::with('purchaseOrders')->whereIn('id', $request->style_ids)->get();

        if ($styles->isEmpty()) {
            return response()->json(['message' => 'No valid styles found'], 422);
        }

        $created = [];
        $skipped = [];

        DB::beginTransaction();
        try {
            foreach ($styles as $style) {
                // Get the PO for this style (first associated PO)
                $po = $style->purchaseOrders->first() ?? $style->purchaseOrder;

                // Check if already assigned to this factory
                $existing = FactoryAssignment::where('style_id', $style->id)
                    ->where('factory_id', $request->factory_id)
                    ->whereIn('status', ['invited', 'accepted'])
                    ->first();

                if ($existing) {
                    $skipped[] = [
                        'style_id' => $style->id,
                        'style_number' => $style->style_number,
                        'reason' => 'Already assigned to this factory',
                    ];
                    continue;
                }

                $assignment = FactoryAssignment::create([
                    'purchase_order_id' => $po?->id,
                    'style_id' => $style->id,
                    'factory_id' => $request->factory_id,
                    'assigned_by' => $user->id,
                    'assigned_at' => now(),
                    'assignment_type' => $request->assignment_type,
                    'status' => 'invited',
                    'notes' => $request->notes,
                    'expected_completion_date' => $request->expected_completion_date,
                ]);

                // Update style model
                $style->update([
                    'assignment_type' => $request->assignment_type,
                    'assigned_factory_id' => $request->factory_id,
                ]);

                // Update pivot table if PO exists
                if ($po) {
                    $pivotUpdate = [
                        'assignment_type' => $request->assignment_type,
                        'assigned_factory_id' => $request->factory_id,
                        'assigned_at' => now(),
                    ];

                    // Optional agency-supplied factory economics. Only write
                    // the fields that were sent so absent keys leave any
                    // prior values untouched.
                    $prices = $request->input('factory_unit_prices', []);
                    $dates = $request->input('factory_ex_factory_dates', []);

                    if (array_key_exists($style->id, $prices) && $prices[$style->id] !== null && $prices[$style->id] !== '') {
                        $pivotUpdate['factory_unit_price'] = $prices[$style->id];
                    }
                    if (array_key_exists($style->id, $dates) && $dates[$style->id] !== null && $dates[$style->id] !== '') {
                        $pivotUpdate['factory_ex_factory_date'] = $dates[$style->id];
                    }

                    $po->styles()->updateExistingPivot($style->id, $pivotUpdate);
                }

                $created[] = [
                    'id' => $assignment->id,
                    'style_id' => $style->id,
                    'style_number' => $style->style_number,
                ];
            }

            DB::commit();

            // Send notification to the factory
            if (!empty($created)) {
                $styleNumbers = collect($created)->pluck('style_number')->implode(', ');
                // Use the first PO for notification context
                $firstStyle = $styles->first();
                $po = $firstStyle->purchaseOrders->first() ?? $firstStyle->purchaseOrder;

                if ($po) {
                    SendPurchaseOrderNotification::dispatch(
                        $po,
                        $factoryUser,
                        'factory_assigned',
                        [
                            'style_number' => $styleNumbers,
                            'assigned_by' => $user->name,
                        ]
                    );
                }
            }

            $this->activityLog->log(
                'styles_bulk_assigned',
                'FactoryAssignment',
                null,
                'Bulk assigned ' . count($created) . ' style(s) to factory ' . $factoryUser->name,
                [
                    'factory_id' => $request->factory_id,
                    'style_ids' => collect($created)->pluck('style_id')->toArray(),
                    'assigned_by' => $user->id,
                ]
            );

            return response()->json([
                'message' => count($created) . ' style(s) assigned successfully',
                'created' => $created,
                'skipped' => $skipped,
            ], 201);

        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json(['message' => 'Failed to assign styles: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Factory accepts an assignment
     */
    public function accept(Request $request, $id)
    {
        $user = $request->user();

        if (!$user->hasRole('Factory')) {
            return response()->json(['message' => 'Only factories can accept assignments'], 403);
        }

        $assignment = FactoryAssignment::where('id', $id)
            ->where('factory_id', $user->id)
            ->firstOrFail();

        if ($assignment->status !== 'invited') {
            return response()->json([
                'message' => 'This assignment cannot be accepted (current status: ' . $assignment->status . ')',
            ], 422);
        }

        $assignment->accept();

        $this->activityLog->log(
            'assignment_accepted',
            'FactoryAssignment',
            $assignment->id,
            'Factory accepted assignment',
            [
                'factory_id' => $user->id,
                'style_id' => $assignment->style_id,
                'purchase_order_id' => $assignment->purchase_order_id,
            ]
        );

        // Notify the assigner
        if ($assignment->assignedBy && $assignment->purchaseOrder) {
            SendPurchaseOrderNotification::dispatch(
                $assignment->purchaseOrder,
                $assignment->assignedBy,
                'status_changed',
                [
                    'old_status' => 'invited',
                    'new_status' => 'accepted',
                    'changed_by' => $user->name,
                    'style_number' => $assignment->style?->style_number,
                ]
            );
        }

        return response()->json([
            'message' => 'Assignment accepted successfully',
            'assignment' => $assignment->fresh(['style', 'purchaseOrder']),
        ]);
    }

    /**
     * Factory rejects an assignment
     */
    public function reject(Request $request, $id)
    {
        $user = $request->user();

        if (!$user->hasRole('Factory')) {
            return response()->json(['message' => 'Only factories can reject assignments'], 403);
        }

        $assignment = FactoryAssignment::where('id', $id)
            ->where('factory_id', $user->id)
            ->firstOrFail();

        if ($assignment->status !== 'invited') {
            return response()->json([
                'message' => 'This assignment cannot be rejected (current status: ' . $assignment->status . ')',
            ], 422);
        }

        $request->validate([
            'rejection_reason' => 'nullable|string|max:1000',
        ]);

        $assignment->reject($request->rejection_reason);

        // Clear the style's factory assignment since it was rejected
        if ($assignment->style) {
            $assignment->style->update([
                'assigned_factory_id' => null,
                'assignment_type' => null,
            ]);
        }

        // Clear pivot if PO exists
        if ($assignment->purchase_order_id && $assignment->style_id) {
            $po = $assignment->purchaseOrder;
            if ($po) {
                $po->styles()->updateExistingPivot($assignment->style_id, [
                    'assigned_factory_id' => null,
                    'assignment_type' => null,
                    'assigned_at' => null,
                ]);
            }
        }

        $this->activityLog->log(
            'assignment_rejected',
            'FactoryAssignment',
            $assignment->id,
            'Factory rejected assignment',
            [
                'factory_id' => $user->id,
                'style_id' => $assignment->style_id,
                'rejection_reason' => $request->rejection_reason,
            ]
        );

        // Notify the assigner
        if ($assignment->assignedBy && $assignment->purchaseOrder) {
            SendPurchaseOrderNotification::dispatch(
                $assignment->purchaseOrder,
                $assignment->assignedBy,
                'status_changed',
                [
                    'old_status' => 'invited',
                    'new_status' => 'rejected',
                    'changed_by' => $user->name,
                    'style_number' => $assignment->style?->style_number,
                    'rejection_reason' => $request->rejection_reason,
                ]
            );
        }

        return response()->json([
            'message' => 'Assignment rejected',
            'assignment' => $assignment->fresh(['style', 'purchaseOrder']),
        ]);
    }

    /**
     * Search styles for assignment (used by the assignment dialog)
     */
    public function searchStyles(Request $request)
    {
        $user = $request->user();
        $search = $request->input('search', '');

        $query = Style::with(['purchaseOrders:id,po_number,headline'])
            ->select('id', 'style_number', 'description', 'total_quantity', 'status', 'assigned_factory_id', 'po_id');

        // Role-based filtering
        if ($user->hasRole('Importer')) {
            $query->where(function ($q) use ($user) {
                $q->where('created_by', $user->id)
                  ->orWhereHas('purchaseOrders', function ($pq) use ($user) {
                      $pq->where('creator_id', $user->id);
                  });
            });
        } elseif ($user->hasRole('Agency')) {
            $query->where(function ($q) use ($user) {
                $q->where('assigned_agency_id', $user->id)
                  ->orWhereHas('purchaseOrders', function ($pq) use ($user) {
                      $pq->where('agency_id', $user->id);
                  });
            });
        }

        // Search filter
        if ($search) {
            $query->where(function ($q) use ($search) {
                $q->where('style_number', 'like', "%{$search}%")
                  ->orWhere('description', 'like', "%{$search}%")
                  ->orWhereHas('purchaseOrders', function ($pq) use ($search) {
                      $pq->where('po_number', 'like', "%{$search}%");
                  });
            });
        }

        $styles = $query->orderBy('style_number', 'asc')
            ->limit(50)
            ->get()
            ->map(function ($style) {
                $po = $style->purchaseOrders->first() ?? $style->purchaseOrder;
                return [
                    'id' => $style->id,
                    'style_number' => $style->style_number,
                    'description' => $style->description,
                    'quantity' => $style->total_quantity,
                    'status' => $style->status,
                    'assigned_factory_id' => $style->assigned_factory_id,
                    'po_number' => $po?->po_number,
                    'po_id' => $po?->id,
                ];
            });

        return response()->json(['styles' => $styles]);
    }
}
