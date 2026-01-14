<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\SampleType;
use App\Services\ActivityLogService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class SampleTypeController extends Controller
{
    protected ActivityLogService $activityLog;

    public function __construct(ActivityLogService $activityLog)
    {
        $this->activityLog = $activityLog;
    }

    /**
     * Get all sample types
     */
    public function index(Request $request)
    {
        $query = SampleType::query();

        // Active filter
        if ($request->has('is_active')) {
            $query->where('is_active', filter_var($request->is_active, FILTER_VALIDATE_BOOLEAN));
        }

        // Search filter
        if ($request->has('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('description', 'like', "%{$search}%");
            });
        }

        // Sorting
        $sortBy = $request->get('sort_by', 'display_order');
        $sortOrder = $request->get('sort_order', 'asc');
        $query->orderBy($sortBy, $sortOrder);

        $sampleTypes = $query->get();

        return response()->json([
            'sample_types' => $sampleTypes,
        ]);
    }

    /**
     * Store a new sample type
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:50|unique:sample_types,name',
            'display_name' => 'required|string|max:100',
            'description' => 'nullable|string',
            'prerequisites' => 'nullable|array',
            'prerequisites.*' => 'string|exists:sample_types,name',
            'parallel_submission_allowed' => 'boolean',
            'required_for_production' => 'boolean',
            'max_images' => 'nullable|integer|min:1|max:20',
            'typical_days' => 'nullable|integer|min:1',
            'display_order' => 'nullable|integer',
            'is_active' => 'boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        $sampleType = SampleType::create($request->all());

        $this->activityLog->log(
            'created',
            "Created sample type: {$sampleType->name}",
            'SampleType',
            $sampleType->id
        );

        return response()->json([
            'message' => 'Sample type created successfully',
            'sample_type' => $sampleType,
        ], 201);
    }

    /**
     * Get a specific sample type
     */
    public function show($id)
    {
        $sampleType = SampleType::findOrFail($id);

        return response()->json([
            'sample_type' => $sampleType,
        ]);
    }

    /**
     * Update a sample type
     */
    public function update(Request $request, $id)
    {
        $sampleType = SampleType::findOrFail($id);

        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:50|unique:sample_types,name,' . $id,
            'display_name' => 'required|string|max:100',
            'description' => 'nullable|string',
            'prerequisites' => 'nullable|array',
            'prerequisites.*' => 'string|exists:sample_types,name',
            'parallel_submission_allowed' => 'boolean',
            'required_for_production' => 'boolean',
            'max_images' => 'nullable|integer|min:1|max:20',
            'typical_days' => 'nullable|integer|min:1',
            'display_order' => 'nullable|integer',
            'is_active' => 'boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        $oldValues = $sampleType->toArray();
        $sampleType->update($request->all());

        $this->activityLog->log(
            'updated',
            "Updated sample type: {$sampleType->name}",
            'SampleType',
            $sampleType->id,
            ['old' => $oldValues, 'new' => $sampleType->toArray()]
        );

        return response()->json([
            'message' => 'Sample type updated successfully',
            'sample_type' => $sampleType,
        ]);
    }

    /**
     * Delete a sample type
     */
    public function destroy($id)
    {
        $sampleType = SampleType::findOrFail($id);

        // Check if sample type is being used
        if ($sampleType->samples()->exists()) {
            return response()->json([
                'message' => 'Cannot delete sample type that has associated samples',
            ], 422);
        }

        $name = $sampleType->name;
        $sampleType->delete();

        $this->activityLog->log(
            'deleted',
            "Deleted sample type: {$name}",
            'SampleType',
            $id
        );

        return response()->json([
            'message' => 'Sample type deleted successfully',
        ]);
    }

    /**
     * Reorder sample types
     */
    public function reorder(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'order' => 'required|array',
            'order.*.id' => 'required|exists:sample_types,id',
            'order.*.display_order' => 'required|integer',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        foreach ($request->order as $item) {
            SampleType::where('id', $item['id'])->update(['display_order' => $item['display_order']]);
        }

        $this->activityLog->log(
            'reordered',
            'Reordered sample types',
            'SampleType',
            null
        );

        return response()->json([
            'message' => 'Sample types reordered successfully',
        ]);
    }
}
