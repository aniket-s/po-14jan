<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\TrimType;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Validator;

class TrimTypeController extends Controller
{
    /**
     * Display a listing of trim types.
     */
    public function index(Request $request): JsonResponse
    {
        $query = TrimType::query();

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
            return response()->json($query->active()->ordered()->get());
        }

        // Paginated results
        $perPage = $request->get('per_page', 15);
        $trimTypes = $query->ordered()->paginate($perPage);

        return response()->json($trimTypes);
    }

    /**
     * Store a newly created trim type.
     */
    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:100',
            'code' => 'required|string|max:50|unique:trim_types,code',
            'description' => 'nullable|string',
            'display_order' => 'nullable|integer|min:0',
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
        $data['code'] = strtolower(str_replace(' ', '_', $data['code'])); // Normalize code

        // Auto-set display order if not provided
        if (!isset($data['display_order'])) {
            $data['display_order'] = TrimType::max('display_order') + 1;
        }

        $trimType = TrimType::create($data);

        return response()->json([
            'message' => 'Trim type created successfully',
            'data' => $trimType
        ], 201);
    }

    /**
     * Display the specified trim type.
     */
    public function show(TrimType $trimType): JsonResponse
    {
        return response()->json($trimType);
    }

    /**
     * Update the specified trim type.
     */
    public function update(Request $request, TrimType $trimType): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'name' => 'sometimes|required|string|max:100',
            'code' => 'sometimes|required|string|max:50|unique:trim_types,code,' . $trimType->id,
            'description' => 'nullable|string',
            'display_order' => 'nullable|integer|min:0',
            'is_active' => 'nullable|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $data = $validator->validated();
        if (isset($data['code'])) {
            $data['code'] = strtolower(str_replace(' ', '_', $data['code']));
        }

        $trimType->update($data);

        return response()->json([
            'message' => 'Trim type updated successfully',
            'data' => $trimType
        ]);
    }

    /**
     * Remove the specified trim type (soft delete).
     */
    public function destroy(TrimType $trimType): JsonResponse
    {
        $trimType->delete();

        return response()->json([
            'message' => 'Trim type deleted successfully'
        ]);
    }

    /**
     * Reorder trim types
     */
    public function reorder(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'order' => 'required|array',
            'order.*.id' => 'required|exists:trim_types,id',
            'order.*.display_order' => 'required|integer|min:0',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        foreach ($request->order as $item) {
            TrimType::where('id', $item['id'])->update(['display_order' => $item['display_order']]);
        }

        return response()->json([
            'message' => 'Trim types reordered successfully'
        ]);
    }
}
