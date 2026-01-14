<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Buyer;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;

class BuyerController extends Controller
{
    /**
     * Display a listing of buyers
     */
    public function index(Request $request)
    {
        $query = Buyer::query();

        // Filter by active status
        if ($request->has('is_active')) {
            $query->where('is_active', $request->boolean('is_active'));
        }

        // Search by name or code
        if ($request->has('search')) {
            $search = $request->input('search');
            $query->where(function($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('code', 'like', "%{$search}%");
            });
        }

        // Get all or paginate
        if ($request->boolean('all')) {
            $buyers = $query->ordered()->get();
            return response()->json($buyers);
        }

        $buyers = $query->ordered()->paginate($request->input('per_page', 15));
        return response()->json($buyers);
    }

    /**
     * Store a newly created buyer
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'code' => 'required|string|max:50|unique:buyers,code',
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

        $buyer = Buyer::create(array_merge(
            $validator->validated(),
            ['created_by' => auth()->id()]
        ));

        return response()->json([
            'message' => 'Buyer created successfully',
            'data' => $buyer
        ], 201);
    }

    /**
     * Display the specified buyer
     */
    public function show(string $id)
    {
        $buyer = Buyer::findOrFail($id);
        return response()->json($buyer);
    }

    /**
     * Update the specified buyer
     */
    public function update(Request $request, string $id)
    {
        $buyer = Buyer::findOrFail($id);

        $validator = Validator::make($request->all(), [
            'name' => 'sometimes|required|string|max:255',
            'code' => 'sometimes|required|string|max:50|unique:buyers,code,' . $id,
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

        $buyer->update($validator->validated());

        return response()->json([
            'message' => 'Buyer updated successfully',
            'data' => $buyer
        ]);
    }

    /**
     * Remove the specified buyer
     */
    public function destroy(string $id)
    {
        $buyer = Buyer::findOrFail($id);

        // Soft delete
        $buyer->delete();

        return response()->json([
            'message' => 'Buyer deleted successfully'
        ]);
    }
}
