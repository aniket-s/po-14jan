<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Currency;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Validator;

class CurrencyController extends Controller
{
    /**
     * Display a listing of currencies.
     */
    public function index(Request $request): JsonResponse
    {
        $query = Currency::query();

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
            return response()->json($query->active()->orderBy('code')->get());
        }

        // Paginated results
        $perPage = $request->get('per_page', 15);
        $currencies = $query->orderBy('code')->paginate($perPage);

        return response()->json($currencies);
    }

    /**
     * Store a newly created currency.
     */
    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'code' => 'required|string|max:10|unique:currencies,code',
            'name' => 'required|string|max:100',
            'symbol' => 'nullable|string|max:10',
            'exchange_rate' => 'nullable|numeric|min:0',
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
        $data['code'] = strtoupper($data['code']); // Ensure uppercase

        $currency = Currency::create($data);

        return response()->json([
            'message' => 'Currency created successfully',
            'data' => $currency
        ], 201);
    }

    /**
     * Display the specified currency.
     */
    public function show(Currency $currency): JsonResponse
    {
        return response()->json($currency);
    }

    /**
     * Update the specified currency.
     */
    public function update(Request $request, Currency $currency): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'code' => 'sometimes|required|string|max:10|unique:currencies,code,' . $currency->id,
            'name' => 'sometimes|required|string|max:100',
            'symbol' => 'nullable|string|max:10',
            'exchange_rate' => 'nullable|numeric|min:0',
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
            $data['code'] = strtoupper($data['code']);
        }

        $currency->update($data);

        return response()->json([
            'message' => 'Currency updated successfully',
            'data' => $currency
        ]);
    }

    /**
     * Remove the specified currency (soft delete).
     */
    public function destroy(Currency $currency): JsonResponse
    {
        $currency->delete();

        return response()->json([
            'message' => 'Currency deleted successfully'
        ]);
    }
}
