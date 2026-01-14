<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Season;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Validator;

class SeasonController extends Controller
{
    /**
     * Display a listing of seasons.
     */
    public function index(Request $request): JsonResponse
    {
        $query = Season::query();

        // Filter by active status
        if ($request->has('active_only')) {
            $query->where('is_active', true);
        }

        // Search by name or code
        if ($request->has('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('code', 'like', "%{$search}%")
                  ->orWhere('year', 'like', "%{$search}%");
            });
        }

        // Return all if requested (for dropdowns)
        if ($request->has('all') && $request->all === 'true') {
            return response()->json($query->where('is_active', true)->orderBy('year', 'desc')->orderBy('name')->get());
        }

        // Paginated results
        $perPage = $request->get('per_page', 15);
        $seasons = $query->orderBy('year', 'desc')->orderBy('name')->paginate($perPage);

        return response()->json($seasons);
    }

    /**
     * Store a newly created season.
     */
    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'code' => 'nullable|string|max:50',
            'year' => 'required|integer|min:2000|max:2100',
            'start_date' => 'nullable|date',
            'end_date' => 'nullable|date|after_or_equal:start_date',
            'is_active' => 'nullable|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $season = Season::create($validator->validated());

        return response()->json([
            'message' => 'Season created successfully',
            'data' => $season
        ], 201);
    }

    /**
     * Display the specified season.
     */
    public function show(Season $season): JsonResponse
    {
        return response()->json($season);
    }

    /**
     * Update the specified season.
     */
    public function update(Request $request, Season $season): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'name' => 'sometimes|required|string|max:255',
            'code' => 'nullable|string|max:50',
            'year' => 'sometimes|required|integer|min:2000|max:2100',
            'start_date' => 'nullable|date',
            'end_date' => 'nullable|date|after_or_equal:start_date',
            'is_active' => 'nullable|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $season->update($validator->validated());

        return response()->json([
            'message' => 'Season updated successfully',
            'data' => $season
        ]);
    }

    /**
     * Remove the specified season (soft delete).
     */
    public function destroy(Season $season): JsonResponse
    {
        $season->delete();

        return response()->json([
            'message' => 'Season deleted successfully'
        ]);
    }
}
