<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\DefectType;
use App\Services\ActivityLogService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class DefectCategoryController extends Controller
{
    protected ActivityLogService $activityLog;

    public function __construct(ActivityLogService $activityLog)
    {
        $this->activityLog = $activityLog;
    }

    /**
     * Get all defect categories
     */
    public function index(Request $request)
    {
        $query = DefectType::query();

        // Active filter
        if ($request->has('is_active')) {
            $query->where('is_active', filter_var($request->is_active, FILTER_VALIDATE_BOOLEAN));
        }

        // Severity filter
        if ($request->has('severity')) {
            $query->where('severity', $request->severity);
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

        $defectCategories = $query->get();

        // Group by severity
        $grouped = $defectCategories->groupBy('severity');

        return response()->json([
            'defect_categories' => $defectCategories,
            'grouped_by_severity' => $grouped,
        ]);
    }

    /**
     * Store a new defect category
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:100',
            'code' => 'required|string|max:50|unique:defect_categories,code',
            'description' => 'nullable|string',
            'severity' => 'required|in:critical,major,minor',
            'display_order' => 'nullable|integer',
            'is_active' => 'boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        $defectCategory = DefectType::create($request->all());

        $this->activityLog->log(
            'created',
            "Created defect category: {$defectCategory->name} ({$defectCategory->severity})",
            'DefectType',
            $defectCategory->id
        );

        return response()->json([
            'message' => 'Defect category created successfully',
            'defect_category' => $defectCategory,
        ], 201);
    }

    /**
     * Get a specific defect category
     */
    public function show($id)
    {
        $defectCategory = DefectType::findOrFail($id);

        return response()->json([
            'defect_category' => $defectCategory,
        ]);
    }

    /**
     * Update a defect category
     */
    public function update(Request $request, $id)
    {
        $defectCategory = DefectType::findOrFail($id);

        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:100',
            'code' => 'required|string|max:50|unique:defect_categories,code,' . $id,
            'description' => 'nullable|string',
            'severity' => 'required|in:critical,major,minor',
            'display_order' => 'nullable|integer',
            'is_active' => 'boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        $oldValues = $defectCategory->toArray();
        $defectCategory->update($request->all());

        $this->activityLog->log(
            'updated',
            "Updated defect category: {$defectCategory->name}",
            'DefectType',
            $defectCategory->id,
            ['old' => $oldValues, 'new' => $defectCategory->toArray()]
        );

        return response()->json([
            'message' => 'Defect category updated successfully',
            'defect_category' => $defectCategory,
        ]);
    }

    /**
     * Delete a defect category
     */
    public function destroy($id)
    {
        $defectCategory = DefectType::findOrFail($id);

        // Check if defect category is being used
        if ($defectCategory->inspectionDefects()->exists()) {
            return response()->json([
                'message' => 'Cannot delete defect category that has associated inspection defects',
            ], 422);
        }

        $name = $defectCategory->name;
        $defectCategory->delete();

        $this->activityLog->log(
            'deleted',
            "Deleted defect category: {$name}",
            'DefectType',
            $id
        );

        return response()->json([
            'message' => 'Defect category deleted successfully',
        ]);
    }

    /**
     * Reorder defect categories
     */
    public function reorder(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'order' => 'required|array',
            'order.*.id' => 'required|exists:defect_categories,id',
            'order.*.display_order' => 'required|integer',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        foreach ($request->order as $item) {
            DefectType::where('id', $item['id'])->update(['display_order' => $item['display_order']]);
        }

        $this->activityLog->log(
            'reordered',
            'Reordered defect categories',
            'DefectType',
            null
        );

        return response()->json([
            'message' => 'Defect categories reordered successfully',
        ]);
    }
}
