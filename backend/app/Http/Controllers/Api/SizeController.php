<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Size;
use App\Models\Gender;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class SizeController extends Controller
{
    /**
     * Get all sizes
     */
    public function index(Request $request)
    {
        $query = Size::with('gender');

        // Filter by gender
        if ($request->has('gender_id')) {
            $query->byGender($request->input('gender_id'));
        }

        // Filter by active status
        if ($request->boolean('active_only')) {
            $query->active();
        }

        // Get all or paginated
        if ($request->boolean('all')) {
            $sizes = $query->orderBy('gender_id')->orderBy('display_order')->get();
            return response()->json($sizes);
        }

        $sizes = $query->orderBy('gender_id')->orderBy('display_order')
            ->paginate($request->input('per_page', 20));

        return response()->json($sizes);
    }

    /**
     * Get a single size
     */
    public function show($id)
    {
        $size = Size::with('gender')->findOrFail($id);
        return response()->json($size);
    }

    /**
     * Create a new size
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'gender_id' => 'required|exists:genders,id',
            'size_code' => 'required|string|max:20',
            'size_name' => 'required|string|max:50',
            'description' => 'nullable|string',
            'is_active' => 'boolean',
            'display_order' => 'integer|min:0',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        // Check unique combination
        $exists = Size::where('gender_id', $request->gender_id)
            ->where('size_code', $request->size_code)
            ->exists();

        if ($exists) {
            return response()->json([
                'message' => 'Size code already exists for this gender'
            ], 422);
        }

        $size = Size::create($request->all());
        $size->load('gender');

        return response()->json([
            'message' => 'Size created successfully',
            'data' => $size
        ], 201);
    }

    /**
     * Update a size
     */
    public function update(Request $request, $id)
    {
        $size = Size::findOrFail($id);

        $validator = Validator::make($request->all(), [
            'gender_id' => 'sometimes|exists:genders,id',
            'size_code' => 'sometimes|string|max:20',
            'size_name' => 'sometimes|string|max:50',
            'description' => 'nullable|string',
            'is_active' => 'boolean',
            'display_order' => 'integer|min:0',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        // Check unique combination if changed
        if ($request->has('gender_id') || $request->has('size_code')) {
            $genderId = $request->input('gender_id', $size->gender_id);
            $sizeCode = $request->input('size_code', $size->size_code);

            $exists = Size::where('gender_id', $genderId)
                ->where('size_code', $sizeCode)
                ->where('id', '!=', $id)
                ->exists();

            if ($exists) {
                return response()->json([
                    'message' => 'Size code already exists for this gender'
                ], 422);
            }
        }

        $size->update($request->all());
        $size->load('gender');

        return response()->json([
            'message' => 'Size updated successfully',
            'data' => $size
        ]);
    }

    /**
     * Delete a size
     */
    public function destroy($id)
    {
        $size = Size::findOrFail($id);
        $size->delete();

        return response()->json([
            'message' => 'Size deleted successfully'
        ]);
    }
}
