<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\FabricQuality;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Validator;

class FabricQualityController extends Controller
{
    /**
     * Display a listing of fabric qualities.
     */
    public function index(Request $request): JsonResponse
    {
        $query = FabricQuality::query();

        // Filter by active status
        if ($request->has('active_only')) {
            $query->active();
        }

        // Search by name or code
        if ($request->has('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('code', 'like', "%{$search}%");
            });
        }

        // Return all if requested (for dropdowns)
        if ($request->has('all') && $request->all === 'true') {
            return response()->json($query->active()->orderBy('name')->get());
        }

        // Paginated results
        $perPage = $request->get('per_page', 15);
        $fabricQualities = $query->orderBy('name')->paginate($perPage);

        return response()->json($fabricQualities);
    }

    /**
     * Store a newly created fabric quality.
     */
    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:100|unique:fabric_qualities,name',
            'code' => 'nullable|string|max:50',
            'description' => 'nullable|string',
            'is_active' => 'nullable|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $data = $validator->validated();
        $data['created_by'] = auth()->id();

        $fabricQuality = FabricQuality::create($data);

        return response()->json([
            'message' => 'Fabric quality created successfully',
            'data' => $fabricQuality
        ], 201);
    }

    /**
     * Display the specified fabric quality.
     */
    public function show(FabricQuality $fabricQuality): JsonResponse
    {
        return response()->json($fabricQuality);
    }

    /**
     * Update the specified fabric quality.
     */
    public function update(Request $request, FabricQuality $fabricQuality): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'name' => 'sometimes|required|string|max:100|unique:fabric_qualities,name,' . $fabricQuality->id,
            'code' => 'nullable|string|max:50',
            'description' => 'nullable|string',
            'is_active' => 'nullable|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $fabricQuality->update($validator->validated());

        return response()->json([
            'message' => 'Fabric quality updated successfully',
            'data' => $fabricQuality
        ]);
    }

    /**
     * Remove the specified fabric quality (soft delete).
     */
    public function destroy(FabricQuality $fabricQuality): JsonResponse
    {
        $fabricQuality->delete();

        return response()->json([
            'message' => 'Fabric quality deleted successfully'
        ]);
    }
}
