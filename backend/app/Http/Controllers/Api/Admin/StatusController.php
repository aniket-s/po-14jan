<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Services\ActivityLogService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;

class StatusController extends Controller
{
    protected ActivityLogService $activityLog;

    public function __construct(ActivityLogService $activityLog)
    {
        $this->activityLog = $activityLog;
    }

    /**
     * Get all system statuses
     */
    public function index(Request $request)
    {
        $query = DB::table('system_statuses');

        // Type filter
        if ($request->has('type')) {
            $query->where('type', $request->type);
        }

        // Active filter
        if ($request->has('is_active')) {
            $query->where('is_active', filter_var($request->is_active, FILTER_VALIDATE_BOOLEAN));
        }

        // Search filter
        if ($request->has('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('value', 'like', "%{$search}%")
                  ->orWhere('label', 'like', "%{$search}%")
                  ->orWhere('description', 'like', "%{$search}%");
            });
        }

        // Sorting
        $sortBy = $request->get('sort_by', 'display_order');
        $sortOrder = $request->get('sort_order', 'asc');
        $query->orderBy($sortBy, $sortOrder);

        $statuses = $query->get();

        // Group by type
        $grouped = $statuses->groupBy('type')->map(function ($items, $type) {
            return [
                'type' => $type,
                'label' => ucfirst(str_replace('_', ' ', $type)),
                'statuses' => $items->map(function ($status) {
                    return [
                        'id' => $status->id,
                        'value' => $status->value,
                        'label' => $status->label,
                        'color' => $status->color,
                        'icon' => $status->icon,
                        'display_order' => $status->display_order,
                        'transition_rules' => $status->transition_rules ? json_decode($status->transition_rules, true) : null,
                        'description' => $status->description,
                        'is_active' => (bool) $status->is_active,
                    ];
                })->values(),
            ];
        })->values();

        return response()->json([
            'statuses' => $grouped,
            'all_statuses' => $statuses->map(function ($status) {
                return [
                    'id' => $status->id,
                    'type' => $status->type,
                    'value' => $status->value,
                    'label' => $status->label,
                    'color' => $status->color,
                    'icon' => $status->icon,
                    'display_order' => $status->display_order,
                    'transition_rules' => $status->transition_rules ? json_decode($status->transition_rules, true) : null,
                    'description' => $status->description,
                    'is_active' => (bool) $status->is_active,
                ];
            }),
        ]);
    }

    /**
     * Get single status
     */
    public function show($id)
    {
        $status = DB::table('system_statuses')->where('id', $id)->first();

        if (!$status) {
            return response()->json([
                'message' => 'Status not found',
            ], 404);
        }

        return response()->json([
            'status' => [
                'id' => $status->id,
                'type' => $status->type,
                'value' => $status->value,
                'label' => $status->label,
                'color' => $status->color,
                'icon' => $status->icon,
                'display_order' => $status->display_order,
                'transition_rules' => $status->transition_rules ? json_decode($status->transition_rules, true) : null,
                'description' => $status->description,
                'is_active' => (bool) $status->is_active,
                'created_at' => $status->created_at,
                'updated_at' => $status->updated_at,
            ],
        ]);
    }

    /**
     * Create new status
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'type' => 'required|string|max:50',
            'value' => 'required|string|max:50',
            'label' => 'required|string|max:100',
            'color' => 'nullable|string|max:20',
            'icon' => 'nullable|string|max:50',
            'display_order' => 'nullable|integer',
            'transition_rules' => 'nullable|array',
            'description' => 'nullable|string',
            'is_active' => 'nullable|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        // Check for unique type+value combination
        $exists = DB::table('system_statuses')
            ->where('type', $request->type)
            ->where('value', $request->value)
            ->exists();

        if ($exists) {
            return response()->json([
                'message' => 'A status with this type and value already exists',
            ], 422);
        }

        $id = DB::table('system_statuses')->insertGetId([
            'type' => $request->type,
            'value' => $request->value,
            'label' => $request->label,
            'color' => $request->color,
            'icon' => $request->icon,
            'display_order' => $request->get('display_order', 0),
            'transition_rules' => $request->transition_rules ? json_encode($request->transition_rules) : null,
            'description' => $request->description,
            'is_active' => $request->get('is_active', true),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Log creation
        $this->activityLog->logCreated('SystemStatus', $id, [
            'type' => $request->type,
            'value' => $request->value,
            'label' => $request->label,
        ]);

        $status = DB::table('system_statuses')->where('id', $id)->first();

        return response()->json([
            'message' => 'Status created successfully',
            'status' => [
                'id' => $status->id,
                'type' => $status->type,
                'value' => $status->value,
                'label' => $status->label,
                'color' => $status->color,
                'icon' => $status->icon,
                'display_order' => $status->display_order,
                'transition_rules' => $status->transition_rules ? json_decode($status->transition_rules, true) : null,
                'description' => $status->description,
                'is_active' => (bool) $status->is_active,
            ],
        ], 201);
    }

    /**
     * Update status
     */
    public function update(Request $request, $id)
    {
        $status = DB::table('system_statuses')->where('id', $id)->first();

        if (!$status) {
            return response()->json([
                'message' => 'Status not found',
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'type' => 'required|string|max:50',
            'value' => 'required|string|max:50',
            'label' => 'required|string|max:100',
            'color' => 'nullable|string|max:20',
            'icon' => 'nullable|string|max:50',
            'display_order' => 'nullable|integer',
            'transition_rules' => 'nullable|array',
            'description' => 'nullable|string',
            'is_active' => 'nullable|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        // Check for unique type+value combination (excluding current record)
        $exists = DB::table('system_statuses')
            ->where('type', $request->type)
            ->where('value', $request->value)
            ->where('id', '!=', $id)
            ->exists();

        if ($exists) {
            return response()->json([
                'message' => 'A status with this type and value already exists',
            ], 422);
        }

        $oldData = [
            'type' => $status->type,
            'value' => $status->value,
            'label' => $status->label,
            'is_active' => $status->is_active,
        ];

        DB::table('system_statuses')->where('id', $id)->update([
            'type' => $request->type,
            'value' => $request->value,
            'label' => $request->label,
            'color' => $request->color,
            'icon' => $request->icon,
            'display_order' => $request->get('display_order', 0),
            'transition_rules' => $request->transition_rules ? json_encode($request->transition_rules) : null,
            'description' => $request->description,
            'is_active' => $request->get('is_active', true),
            'updated_at' => now(),
        ]);

        $newData = [
            'type' => $request->type,
            'value' => $request->value,
            'label' => $request->label,
            'is_active' => $request->get('is_active', true),
        ];

        // Log update
        $this->activityLog->logUpdated('SystemStatus', $id, $oldData, $newData);

        $updated = DB::table('system_statuses')->where('id', $id)->first();

        return response()->json([
            'message' => 'Status updated successfully',
            'status' => [
                'id' => $updated->id,
                'type' => $updated->type,
                'value' => $updated->value,
                'label' => $updated->label,
                'color' => $updated->color,
                'icon' => $updated->icon,
                'display_order' => $updated->display_order,
                'transition_rules' => $updated->transition_rules ? json_decode($updated->transition_rules, true) : null,
                'description' => $updated->description,
                'is_active' => (bool) $updated->is_active,
            ],
        ]);
    }

    /**
     * Delete status
     */
    public function destroy($id)
    {
        $status = DB::table('system_statuses')->where('id', $id)->first();

        if (!$status) {
            return response()->json([
                'message' => 'Status not found',
            ], 404);
        }

        $statusData = [
            'type' => $status->type,
            'value' => $status->value,
            'label' => $status->label,
        ];

        // Log deletion
        $this->activityLog->logDeleted('SystemStatus', $id, $statusData);

        // Delete status
        DB::table('system_statuses')->where('id', $id)->delete();

        return response()->json([
            'message' => 'Status deleted successfully',
        ]);
    }

    /**
     * Get statuses by type
     */
    public function byType($type)
    {
        $statuses = DB::table('system_statuses')
            ->where('type', $type)
            ->where('is_active', true)
            ->orderBy('display_order')
            ->get();

        return response()->json([
            'type' => $type,
            'statuses' => $statuses->map(function ($status) {
                return [
                    'id' => $status->id,
                    'value' => $status->value,
                    'label' => $status->label,
                    'color' => $status->color,
                    'icon' => $status->icon,
                    'display_order' => $status->display_order,
                    'transition_rules' => $status->transition_rules ? json_decode($status->transition_rules, true) : null,
                    'description' => $status->description,
                ];
            }),
        ]);
    }

    /**
     * Get available status types
     */
    public function types()
    {
        $types = DB::table('system_statuses')
            ->select('type')
            ->distinct()
            ->orderBy('type')
            ->pluck('type');

        return response()->json([
            'types' => $types->map(function ($type) {
                return [
                    'value' => $type,
                    'label' => ucfirst(str_replace('_', ' ', $type)),
                    'count' => DB::table('system_statuses')->where('type', $type)->count(),
                ];
            }),
        ]);
    }

    /**
     * Validate status transition
     */
    public function validateTransition(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'type' => 'required|string',
            'current_status' => 'required|string',
            'new_status' => 'required|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $currentStatus = DB::table('system_statuses')
            ->where('type', $request->type)
            ->where('value', $request->current_status)
            ->first();

        if (!$currentStatus) {
            return response()->json([
                'valid' => false,
                'message' => 'Current status not found',
            ], 404);
        }

        $transitionRules = $currentStatus->transition_rules ? json_decode($currentStatus->transition_rules, true) : null;

        // If no transition rules, allow any transition
        if (!$transitionRules || empty($transitionRules)) {
            return response()->json([
                'valid' => true,
                'message' => 'Transition allowed (no restrictions)',
            ]);
        }

        // Check if new status is in allowed transitions
        $isValid = in_array($request->new_status, $transitionRules);

        return response()->json([
            'valid' => $isValid,
            'message' => $isValid ? 'Transition allowed' : 'Transition not allowed',
            'allowed_transitions' => $transitionRules,
        ]);
    }

    /**
     * Reorder statuses
     */
    public function reorder(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'statuses' => 'required|array',
            'statuses.*.id' => 'required|exists:system_statuses,id',
            'statuses.*.display_order' => 'required|integer',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        foreach ($request->statuses as $statusData) {
            DB::table('system_statuses')
                ->where('id', $statusData['id'])
                ->update([
                    'display_order' => $statusData['display_order'],
                    'updated_at' => now(),
                ]);
        }

        // Log reorder action
        $this->activityLog->log(
            'statuses_reordered',
            'SystemStatus',
            null,
            'Reordered statuses',
            ['statuses' => $request->statuses]
        );

        return response()->json([
            'message' => 'Statuses reordered successfully',
        ]);
    }

    /**
     * Toggle status active state
     */
    public function toggleActive($id)
    {
        $status = DB::table('system_statuses')->where('id', $id)->first();

        if (!$status) {
            return response()->json([
                'message' => 'Status not found',
            ], 404);
        }

        $newActiveState = !$status->is_active;

        DB::table('system_statuses')->where('id', $id)->update([
            'is_active' => $newActiveState,
            'updated_at' => now(),
        ]);

        // Log toggle
        $this->activityLog->log(
            'status_toggled',
            'SystemStatus',
            $id,
            "Status {$status->label} " . ($newActiveState ? 'activated' : 'deactivated'),
            [
                'old_state' => $status->is_active,
                'new_state' => $newActiveState,
            ]
        );

        return response()->json([
            'message' => 'Status ' . ($newActiveState ? 'activated' : 'deactivated') . ' successfully',
            'is_active' => $newActiveState,
        ]);
    }
}
