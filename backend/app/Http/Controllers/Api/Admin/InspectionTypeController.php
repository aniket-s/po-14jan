<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\InspectionType;
use App\Services\ActivityLogService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class InspectionTypeController extends Controller
{
    protected ActivityLogService $activityLog;

    public function __construct(ActivityLogService $activityLog)
    {
        $this->activityLog = $activityLog;
    }

    /**
     * Get all inspection types
     */
    public function index(Request $request)
    {
        $query = InspectionType::query();

        // Active filter
        if ($request->has('is_active')) {
            $query->where('is_active', filter_var($request->is_active, FILTER_VALIDATE_BOOLEAN));
        }

        // Search filter
        if ($request->has('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('code', 'like', "%{$search}%")
                  ->orWhere('description', 'like', "%{$search}%");
            });
        }

        // Sorting
        $sortBy = $request->get('sort_by', 'display_order');
        $sortOrder = $request->get('sort_order', 'asc');
        $query->orderBy($sortBy, $sortOrder);

        $inspectionTypes = $query->get();

        return response()->json([
            'inspection_types' => $inspectionTypes,
        ]);
    }

    /**
     * Store a new inspection type
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:100|unique:inspection_types,name',
            'code' => 'required|string|max:50|unique:inspection_types,code',
            'description' => 'nullable|string',
            'requires_sample_size' => 'boolean',
            'requires_aql_level' => 'boolean',
            'can_generate_certificate' => 'boolean',
            'display_order' => 'nullable|integer',
            'is_active' => 'boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        $inspectionType = InspectionType::create($request->all());

        $this->activityLog->log(
            'created',
            "Created inspection type: {$inspectionType->name}",
            'InspectionType',
            $inspectionType->id
        );

        return response()->json([
            'message' => 'Inspection type created successfully',
            'inspection_type' => $inspectionType,
        ], 201);
    }

    /**
     * Get a specific inspection type
     */
    public function show($id)
    {
        $inspectionType = InspectionType::findOrFail($id);

        return response()->json([
            'inspection_type' => $inspectionType,
        ]);
    }

    /**
     * Update an inspection type
     */
    public function update(Request $request, $id)
    {
        $inspectionType = InspectionType::findOrFail($id);

        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:100|unique:inspection_types,name,' . $id,
            'code' => 'required|string|max:50|unique:inspection_types,code,' . $id,
            'description' => 'nullable|string',
            'requires_sample_size' => 'boolean',
            'requires_aql_level' => 'boolean',
            'can_generate_certificate' => 'boolean',
            'display_order' => 'nullable|integer',
            'is_active' => 'boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        $oldValues = $inspectionType->toArray();
        $inspectionType->update($request->all());

        $this->activityLog->log(
            'updated',
            "Updated inspection type: {$inspectionType->name}",
            'InspectionType',
            $inspectionType->id,
            ['old' => $oldValues, 'new' => $inspectionType->toArray()]
        );

        return response()->json([
            'message' => 'Inspection type updated successfully',
            'inspection_type' => $inspectionType,
        ]);
    }

    /**
     * Delete an inspection type
     */
    public function destroy($id)
    {
        $inspectionType = InspectionType::findOrFail($id);

        // Check if inspection type is being used
        if ($inspectionType->qualityInspections()->exists()) {
            return response()->json([
                'message' => 'Cannot delete inspection type that has associated quality inspections',
            ], 422);
        }

        $name = $inspectionType->name;
        $inspectionType->delete();

        $this->activityLog->log(
            'deleted',
            "Deleted inspection type: {$name}",
            'InspectionType',
            $id
        );

        return response()->json([
            'message' => 'Inspection type deleted successfully',
        ]);
    }

    /**
     * Reorder inspection types
     */
    public function reorder(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'order' => 'required|array',
            'order.*.id' => 'required|exists:inspection_types,id',
            'order.*.display_order' => 'required|integer',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        foreach ($request->order as $item) {
            InspectionType::where('id', $item['id'])->update(['display_order' => $item['display_order']]);
        }

        $this->activityLog->log(
            'reordered',
            'Reordered inspection types',
            'InspectionType',
            null
        );

        return response()->json([
            'message' => 'Inspection types reordered successfully',
        ]);
    }
}
