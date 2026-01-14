<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Gender;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class GenderController extends Controller
{
    /**
     * Get all genders
     */
    public function index(Request $request)
    {
        $query = Gender::query();

        // Filter by active status
        if ($request->boolean('active_only')) {
            $query->active();
        }

        // Get all or paginated
        if ($request->boolean('all')) {
            $genders = $query->orderBy('display_order')->get();
            return response()->json($genders);
        }

        $genders = $query->orderBy('display_order')->paginate($request->input('per_page', 20));
        return response()->json($genders);
    }

    /**
     * Get a single gender
     */
    public function show($id)
    {
        $gender = Gender::with('sizes')->findOrFail($id);
        return response()->json($gender);
    }

    /**
     * Create a new gender
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:50|unique:genders,name',
            'code' => 'required|string|max:20|unique:genders,code',
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

        $gender = Gender::create($request->all());

        return response()->json([
            'message' => 'Gender created successfully',
            'data' => $gender
        ], 201);
    }

    /**
     * Update a gender
     */
    public function update(Request $request, $id)
    {
        $gender = Gender::findOrFail($id);

        $validator = Validator::make($request->all(), [
            'name' => 'sometimes|string|max:50|unique:genders,name,' . $id,
            'code' => 'sometimes|string|max:20|unique:genders,code,' . $id,
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

        $gender->update($request->all());

        return response()->json([
            'message' => 'Gender updated successfully',
            'data' => $gender
        ]);
    }

    /**
     * Delete a gender
     */
    public function destroy($id)
    {
        $gender = Gender::findOrFail($id);

        // Check if gender has associated styles
        if ($gender->styles()->exists()) {
            return response()->json([
                'message' => 'Cannot delete gender with associated styles'
            ], 422);
        }

        $gender->delete();

        return response()->json([
            'message' => 'Gender deleted successfully'
        ]);
    }

    /**
     * Get sizes for a gender
     */
    public function getSizes($id, Request $request)
    {
        $gender = Gender::findOrFail($id);

        $query = $gender->sizes();

        if ($request->boolean('active_only')) {
            $query->where('is_active', true);
        }

        $sizes = $query->orderBy('display_order')->get();

        return response()->json($sizes);
    }
}
