<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Retailer;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Validator;

class RetailerController extends Controller
{
    /**
     * Display a listing of retailers.
     */
    public function index(Request $request): JsonResponse
    {
        $query = Retailer::query();

        // Filter by active status
        if ($request->has('active_only')) {
            $query->active();
        }

        // Search by name or code
        if ($request->has('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('code', 'like', "%{$search}%")
                  ->orWhere('email', 'like', "%{$search}%");
            });
        }

        // Return all if requested (for dropdowns)
        if ($request->has('all') && $request->all === 'true') {
            return response()->json($query->active()->orderBy('name')->get());
        }

        // Paginated results
        $perPage = $request->get('per_page', 15);
        $retailers = $query->orderBy('name')->paginate($perPage);

        return response()->json($retailers);
    }

    /**
     * Store a newly created retailer.
     */
    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'code' => 'nullable|string|max:255|unique:retailers,code',
            'email' => 'nullable|email|max:255',
            'phone' => 'nullable|string|max:255',
            'address' => 'nullable|string',
            'city' => 'nullable|string|max:255',
            'state' => 'nullable|string|max:255',
            'country' => 'nullable|string|max:255',
            'zip_code' => 'nullable|string|max:20',
            'contact_info' => 'nullable|array',
            'is_active' => 'nullable|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $retailer = Retailer::create($validator->validated());

        return response()->json([
            'message' => 'Retailer created successfully',
            'data' => $retailer
        ], 201);
    }

    /**
     * Display the specified retailer.
     */
    public function show(Retailer $retailer): JsonResponse
    {
        return response()->json($retailer);
    }

    /**
     * Update the specified retailer.
     */
    public function update(Request $request, Retailer $retailer): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'name' => 'sometimes|required|string|max:255',
            'code' => 'nullable|string|max:255|unique:retailers,code,' . $retailer->id,
            'email' => 'nullable|email|max:255',
            'phone' => 'nullable|string|max:255',
            'address' => 'nullable|string',
            'city' => 'nullable|string|max:255',
            'state' => 'nullable|string|max:255',
            'country' => 'nullable|string|max:255',
            'zip_code' => 'nullable|string|max:20',
            'contact_info' => 'nullable|array',
            'is_active' => 'nullable|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $retailer->update($validator->validated());

        return response()->json([
            'message' => 'Retailer updated successfully',
            'data' => $retailer
        ]);
    }

    /**
     * Remove the specified retailer (soft delete).
     */
    public function destroy(Retailer $retailer): JsonResponse
    {
        $retailer->delete();

        return response()->json([
            'message' => 'Retailer deleted successfully'
        ]);
    }
}
