<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\ProductionStage;
use App\Services\ActivityLogService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class ProductionStageController extends Controller
{
    protected ActivityLogService $activityLog;

    public function __construct(ActivityLogService $activityLog)
    {
        $this->activityLog = $activityLog;
    }

    /**
     * Get all production stages
     */
    public function index(Request $request)
    {
        $query = ProductionStage::query();

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

        $productionStages = $query->get();

        // Calculate total weight percentage
        $totalWeight = $productionStages->where('is_active', true)->sum('weight_percentage');

        return response()->json([
            'production_stages' => $productionStages,
            'total_weight_percentage' => $totalWeight,
            'is_weight_valid' => abs($totalWeight - 100) < 0.01, // Allow small floating point variance
        ]);
    }

    /**
     * Store a new production stage
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:100',
            'code' => 'required|string|max:50|unique:production_stages,code',
            'description' => 'nullable|string',
            'weight_percentage' => 'required|numeric|min:0|max:100',
            'display_order' => 'nullable|integer',
            'is_active' => 'boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        // Validate total weight percentage
        $currentTotal = ProductionStage::where('is_active', true)->sum('weight_percentage');
        $newTotal = $currentTotal + $request->weight_percentage;

        if ($request->is_active !== false && $newTotal > 100.01) {
            return response()->json([
                'message' => 'Total weight percentage would exceed 100%',
                'current_total' => $currentTotal,
                'attempted_total' => $newTotal,
            ], 422);
        }

        $productionStage = ProductionStage::create($request->all());

        $this->activityLog->log(
            'created',
            "Created production stage: {$productionStage->name} ({$productionStage->weight_percentage}%)",
            'ProductionStage',
            $productionStage->id
        );

        return response()->json([
            'message' => 'Production stage created successfully',
            'production_stage' => $productionStage,
        ], 201);
    }

    /**
     * Get a specific production stage
     */
    public function show($id)
    {
        $productionStage = ProductionStage::findOrFail($id);

        return response()->json([
            'production_stage' => $productionStage,
        ]);
    }

    /**
     * Update a production stage
     */
    public function update(Request $request, $id)
    {
        $productionStage = ProductionStage::findOrFail($id);

        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:100',
            'code' => 'required|string|max:50|unique:production_stages,code,' . $id,
            'description' => 'nullable|string',
            'weight_percentage' => 'required|numeric|min:0|max:100',
            'display_order' => 'nullable|integer',
            'is_active' => 'boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        // Validate total weight percentage (excluding current stage)
        $currentTotal = ProductionStage::where('is_active', true)
            ->where('id', '!=', $id)
            ->sum('weight_percentage');
        $newTotal = $currentTotal + $request->weight_percentage;

        if ($request->is_active !== false && $newTotal > 100.01) {
            return response()->json([
                'message' => 'Total weight percentage would exceed 100%',
                'current_total' => $currentTotal,
                'attempted_total' => $newTotal,
            ], 422);
        }

        $oldValues = $productionStage->toArray();
        $productionStage->update($request->all());

        $this->activityLog->log(
            'updated',
            "Updated production stage: {$productionStage->name}",
            'ProductionStage',
            $productionStage->id,
            ['old' => $oldValues, 'new' => $productionStage->toArray()]
        );

        return response()->json([
            'message' => 'Production stage updated successfully',
            'production_stage' => $productionStage,
        ]);
    }

    /**
     * Delete a production stage
     */
    public function destroy($id)
    {
        $productionStage = ProductionStage::findOrFail($id);

        // Check if production stage is being used
        if ($productionStage->productionTracking()->exists()) {
            return response()->json([
                'message' => 'Cannot delete production stage that has associated production tracking records',
            ], 422);
        }

        $name = $productionStage->name;
        $productionStage->delete();

        $this->activityLog->log(
            'deleted',
            "Deleted production stage: {$name}",
            'ProductionStage',
            $id
        );

        return response()->json([
            'message' => 'Production stage deleted successfully',
        ]);
    }

    /**
     * Reorder production stages
     */
    public function reorder(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'order' => 'required|array',
            'order.*.id' => 'required|exists:production_stages,id',
            'order.*.display_order' => 'required|integer',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        foreach ($request->order as $item) {
            ProductionStage::where('id', $item['id'])->update(['display_order' => $item['display_order']]);
        }

        $this->activityLog->log(
            'reordered',
            'Reordered production stages',
            'ProductionStage',
            null
        );

        return response()->json([
            'message' => 'Production stages reordered successfully',
        ]);
    }

    /**
     * Validate weight percentages total to 100%
     */
    public function validateWeights()
    {
        $totalWeight = ProductionStage::where('is_active', true)->sum('weight_percentage');
        $isValid = abs($totalWeight - 100) < 0.01;

        return response()->json([
            'total_weight_percentage' => $totalWeight,
            'is_valid' => $isValid,
            'difference' => 100 - $totalWeight,
        ]);
    }
}
