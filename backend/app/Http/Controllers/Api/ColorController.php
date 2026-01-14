<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Color;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class ColorController extends Controller
{
    /**
     * Display a listing of colors
     */
    public function index(Request $request)
    {
        $query = Color::query();

        // Filter by active status
        if ($request->has('is_active')) {
            $query->where('is_active', $request->boolean('is_active'));
        }

        // Filter by fabric type (for searchable dropdown in style form)
        if ($request->has('fabric_type')) {
            $fabricType = $request->input('fabric_type');
            $query->byFabricType($fabricType);
        }

        // Search by name, code, or pantone code
        if ($request->has('search')) {
            $search = $request->input('search');
            $query->where(function($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('code', 'like', "%{$search}%")
                  ->orWhere('pantone_code', 'like', "%{$search}%");
            });
        }

        // Get all or paginate
        if ($request->boolean('all')) {
            $colors = $query->ordered()->get();
            return response()->json($colors);
        }

        $colors = $query->ordered()->paginate($request->input('per_page', 15));
        return response()->json($colors);
    }

    /**
     * Store a newly created color
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'code' => 'required|string|max:50|unique:colors,code',
            'pantone_code' => 'nullable|string|max:50',
            'fabric_types' => 'nullable|array',
            'fabric_types.*' => 'string',
            'description' => 'nullable|string',
            'is_active' => 'boolean',
            'display_order' => 'nullable|integer',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $color = Color::create(array_merge(
            $validator->validated(),
            ['created_by' => auth()->id()]
        ));

        return response()->json([
            'message' => 'Color created successfully',
            'data' => $color
        ], 201);
    }

    /**
     * Display the specified color
     */
    public function show(string $id)
    {
        $color = Color::findOrFail($id);
        return response()->json($color);
    }

    /**
     * Update the specified color
     */
    public function update(Request $request, string $id)
    {
        $color = Color::findOrFail($id);

        $validator = Validator::make($request->all(), [
            'name' => 'sometimes|required|string|max:255',
            'code' => 'sometimes|required|string|max:50|unique:colors,code,' . $id,
            'pantone_code' => 'nullable|string|max:50',
            'fabric_types' => 'nullable|array',
            'fabric_types.*' => 'string',
            'description' => 'nullable|string',
            'is_active' => 'boolean',
            'display_order' => 'nullable|integer',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $color->update($validator->validated());

        return response()->json([
            'message' => 'Color updated successfully',
            'data' => $color
        ]);
    }

    /**
     * Remove the specified color
     */
    public function destroy(string $id)
    {
        $color = Color::findOrFail($id);

        // Soft delete
        $color->delete();

        return response()->json([
            'message' => 'Color deleted successfully'
        ]);
    }
}
