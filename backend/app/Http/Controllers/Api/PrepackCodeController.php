<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PrepackCode;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class PrepackCodeController extends Controller
{
    /**
     * Display a listing of prepack codes
     */
    public function index(Request $request)
    {
        $query = PrepackCode::query();

        // Filter by active status
        if ($request->has('is_active')) {
            $query->where('is_active', $request->boolean('is_active'));
        }

        // Search by code or name
        if ($request->has('search')) {
            $search = $request->input('search');
            $query->where(function($q) use ($search) {
                $q->where('code', 'like', "%{$search}%")
                  ->orWhere('name', 'like', "%{$search}%");
            });
        }

        // Get all or paginate
        if ($request->boolean('all')) {
            $prepacks = $query->orderBy('code')->get();
            return response()->json($prepacks);
        }

        $prepacks = $query->orderBy('code')->paginate($request->input('per_page', 15));
        return response()->json($prepacks);
    }

    /**
     * Store a newly created prepack code
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'code' => 'required|string|max:10|unique:prepack_codes,code',
            'name' => 'required|string|max:100',
            'size_range' => 'required|string|max:50',
            'ratio' => 'required|string|max:50',
            'sizes' => 'required|array',
            'total_pieces_per_pack' => 'required|integer|min:1',
            'description' => 'nullable|string',
            'is_active' => 'boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $prepack = PrepackCode::create($validator->validated());

        return response()->json([
            'message' => 'Prepack code created successfully',
            'data' => $prepack
        ], 201);
    }

    /**
     * Display the specified prepack code
     */
    public function show(string $id)
    {
        $prepack = PrepackCode::findOrFail($id);
        return response()->json($prepack);
    }

    /**
     * Update the specified prepack code
     */
    public function update(Request $request, string $id)
    {
        $prepack = PrepackCode::findOrFail($id);

        $validator = Validator::make($request->all(), [
            'code' => 'sometimes|required|string|max:10|unique:prepack_codes,code,' . $id,
            'name' => 'sometimes|required|string|max:100',
            'size_range' => 'sometimes|required|string|max:50',
            'ratio' => 'sometimes|required|string|max:50',
            'sizes' => 'sometimes|required|array',
            'total_pieces_per_pack' => 'sometimes|required|integer|min:1',
            'description' => 'nullable|string',
            'is_active' => 'boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $prepack->update($validator->validated());

        return response()->json([
            'message' => 'Prepack code updated successfully',
            'data' => $prepack
        ]);
    }

    /**
     * Remove the specified prepack code
     */
    public function destroy(string $id)
    {
        $prepack = PrepackCode::findOrFail($id);
        $prepack->delete();

        return response()->json([
            'message' => 'Prepack code deleted successfully'
        ]);
    }
}

