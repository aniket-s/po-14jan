<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Country;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Validator;

class CountryController extends Controller
{
    /**
     * Display a listing of countries.
     */
    public function index(Request $request): JsonResponse
    {
        $query = Country::query();

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
        $countries = $query->orderBy('name')->paginate($perPage);

        return response()->json($countries);
    }

    /**
     * Store a newly created country.
     * Note: code field is now optional (removed from UI)
     */
    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255|unique:countries,name',
            'code' => 'nullable|string|max:10', // Made optional - auto-generate if not provided
            'sailing_time_days' => 'nullable|integer|min:0|max:365',
            'shipping_days' => 'nullable|integer|min:0|max:365', // Alias for sailing_time_days (frontend uses this)
            'is_active' => 'nullable|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $data = $validator->validated();

        // Handle alias: shipping_days -> sailing_time_days
        if (isset($data['shipping_days']) && !isset($data['sailing_time_days'])) {
            $data['sailing_time_days'] = $data['shipping_days'];
        }
        unset($data['shipping_days']);

        // Auto-generate code from name if not provided
        if (empty($data['code'])) {
            $data['code'] = strtoupper(substr(preg_replace('/[^a-zA-Z]/', '', $data['name']), 0, 3));
            // Ensure uniqueness
            $baseCode = $data['code'];
            $counter = 1;
            while (Country::where('code', $data['code'])->exists()) {
                $data['code'] = $baseCode . $counter++;
            }
        }

        $country = Country::create($data);

        return response()->json([
            'message' => 'Country created successfully',
            'data' => $country
        ], 201);
    }

    /**
     * Display the specified country.
     */
    public function show(Country $country): JsonResponse
    {
        return response()->json($country);
    }

    /**
     * Update the specified country.
     */
    public function update(Request $request, Country $country): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'name' => 'sometimes|required|string|max:255',
            'code' => 'sometimes|required|string|max:3|unique:countries,code,' . $country->id,
            'sailing_time_days' => 'sometimes|required|integer|min:0|max:365',
            'is_active' => 'nullable|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $country->update($validator->validated());

        return response()->json([
            'message' => 'Country updated successfully',
            'data' => $country
        ]);
    }

    /**
     * Remove the specified country (soft delete).
     */
    public function destroy(Country $country): JsonResponse
    {
        $country->delete();

        return response()->json([
            'message' => 'Country deleted successfully'
        ]);
    }
}
