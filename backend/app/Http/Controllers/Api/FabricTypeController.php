<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\FabricType;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Validator;

class FabricTypeController extends Controller
{
    /**
     * Display a listing of fabric types.
     */
    public function index(Request $request): JsonResponse
    {
        $query = FabricType::query();

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
        $fabricTypes = $query->orderBy('name')->paginate($perPage);

        return response()->json($fabricTypes);
    }

    /**
     * Store a newly created fabric type.
     */
    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:100|unique:fabric_types,name',
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

        $fabricType = FabricType::create($data);

        return response()->json([
            'message' => 'Fabric type created successfully',
            'data' => $fabricType
        ], 201);
    }

    /**
     * Display the specified fabric type.
     */
    public function show(FabricType $fabricType): JsonResponse
    {
        return response()->json($fabricType);
    }

    /**
     * Update the specified fabric type.
     */
    public function update(Request $request, FabricType $fabricType): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'name' => 'sometimes|required|string|max:100|unique:fabric_types,name,' . $fabricType->id,
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

        $fabricType->update($validator->validated());

        return response()->json([
            'message' => 'Fabric type updated successfully',
            'data' => $fabricType
        ]);
    }

    /**
     * Remove the specified fabric type (soft delete).
     */
    public function destroy(FabricType $fabricType): JsonResponse
    {
        $fabricType->delete();

        return response()->json([
            'message' => 'Fabric type deleted successfully'
        ]);
    }
}
