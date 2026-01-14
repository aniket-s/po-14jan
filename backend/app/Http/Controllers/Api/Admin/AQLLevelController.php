<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\AQLLevel;
use App\Services\ActivityLogService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class AQLLevelController extends Controller
{
    protected ActivityLogService $activityLog;

    public function __construct(ActivityLogService $activityLog)
    {
        $this->activityLog = $activityLog;
    }

    /**
     * Get all AQL levels
     */
    public function index(Request $request)
    {
        $query = AQLLevel::query();

        // Active filter
        if ($request->has('is_active')) {
            $query->where('is_active', filter_var($request->is_active, FILTER_VALIDATE_BOOLEAN));
        }

        // Search filter
        if ($request->has('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('level', 'like', "%{$search}%")
                  ->orWhere('name', 'like', "%{$search}%")
                  ->orWhere('description', 'like', "%{$search}%");
            });
        }

        $aqlLevels = $query->orderBy('level')->get();

        return response()->json([
            'aql_levels' => $aqlLevels,
        ]);
    }

    /**
     * Store a new AQL level
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'level' => 'required|string|max:20|unique:aql_levels,level',
            'name' => 'required|string|max:100',
            'description' => 'nullable|string',
            'sample_size_table' => 'required|array',
            'sample_size_table.*.lot_size_min' => 'required|integer|min:0',
            'sample_size_table.*.lot_size_max' => 'required|integer',
            'sample_size_table.*.sample_size' => 'required|integer|min:1',
            'sample_size_table.*.accept_point' => 'required|integer|min:0',
            'sample_size_table.*.reject_point' => 'required|integer|min:1',
            'is_default' => 'boolean',
            'is_active' => 'boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        // If this is set as default, unset other defaults
        if ($request->is_default) {
            AQLLevel::where('is_default', true)->update(['is_default' => false]);
        }

        $aqlLevel = AQLLevel::create($request->all());

        $this->activityLog->log(
            'created',
            "Created AQL level: {$aqlLevel->level} ({$aqlLevel->name})",
            'AQLLevel',
            $aqlLevel->id
        );

        return response()->json([
            'message' => 'AQL level created successfully',
            'aql_level' => $aqlLevel,
        ], 201);
    }

    /**
     * Get a specific AQL level
     */
    public function show($id)
    {
        $aqlLevel = AQLLevel::findOrFail($id);

        return response()->json([
            'aql_level' => $aqlLevel,
        ]);
    }

    /**
     * Update an AQL level
     */
    public function update(Request $request, $id)
    {
        $aqlLevel = AQLLevel::findOrFail($id);

        $validator = Validator::make($request->all(), [
            'level' => 'required|string|max:20|unique:aql_levels,level,' . $id,
            'name' => 'required|string|max:100',
            'description' => 'nullable|string',
            'sample_size_table' => 'required|array',
            'sample_size_table.*.lot_size_min' => 'required|integer|min:0',
            'sample_size_table.*.lot_size_max' => 'required|integer',
            'sample_size_table.*.sample_size' => 'required|integer|min:1',
            'sample_size_table.*.accept_point' => 'required|integer|min:0',
            'sample_size_table.*.reject_point' => 'required|integer|min:1',
            'is_default' => 'boolean',
            'is_active' => 'boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors(),
            ], 422);
        }

        // If this is set as default, unset other defaults
        if ($request->is_default && !$aqlLevel->is_default) {
            AQLLevel::where('id', '!=', $id)
                ->where('is_default', true)
                ->update(['is_default' => false]);
        }

        $oldValues = $aqlLevel->toArray();
        $aqlLevel->update($request->all());

        $this->activityLog->log(
            'updated',
            "Updated AQL level: {$aqlLevel->level}",
            'AQLLevel',
            $aqlLevel->id,
            ['old' => $oldValues, 'new' => $aqlLevel->toArray()]
        );

        return response()->json([
            'message' => 'AQL level updated successfully',
            'aql_level' => $aqlLevel,
        ]);
    }

    /**
     * Delete an AQL level
     */
    public function destroy($id)
    {
        $aqlLevel = AQLLevel::findOrFail($id);

        // Check if AQL level is being used
        if ($aqlLevel->qualityInspections()->exists()) {
            return response()->json([
                'message' => 'Cannot delete AQL level that has associated quality inspections',
            ], 422);
        }

        // Don't allow deleting default level if it's the only active one
        if ($aqlLevel->is_default && AQLLevel::where('is_active', true)->count() === 1) {
            return response()->json([
                'message' => 'Cannot delete the only active AQL level',
            ], 422);
        }

        $level = $aqlLevel->level;
        $aqlLevel->delete();

        $this->activityLog->log(
            'deleted',
            "Deleted AQL level: {$level}",
            'AQLLevel',
            $id
        );

        return response()->json([
            'message' => 'AQL level deleted successfully',
        ]);
    }
}
