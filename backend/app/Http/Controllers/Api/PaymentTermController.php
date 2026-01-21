<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PaymentTerm;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Validator;

class PaymentTermController extends Controller
{
    /**
     * Display a listing of payment terms.
     */
    public function index(Request $request): JsonResponse
    {
        $query = PaymentTerm::query();

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
        $paymentTerms = $query->orderBy('name')->paginate($perPage);

        return response()->json($paymentTerms);
    }

    /**
     * Store a newly created payment term.
     */
    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:100',
            'code' => 'required|string|max:50|unique:payment_terms,code',
            'days' => 'nullable|integer|min:0',
            'requires_percentage' => 'nullable|boolean',
            'description' => 'nullable|string|max:500',
            'is_active' => 'nullable|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $data = $validator->validated();
        $data['code'] = strtoupper(str_replace(' ', '_', $data['code'])); // Normalize code

        $paymentTerm = PaymentTerm::create($data);

        return response()->json([
            'message' => 'Payment term created successfully',
            'data' => $paymentTerm
        ], 201);
    }

    /**
     * Display the specified payment term.
     */
    public function show(PaymentTerm $paymentTerm): JsonResponse
    {
        return response()->json($paymentTerm);
    }

    /**
     * Update the specified payment term.
     */
    public function update(Request $request, PaymentTerm $paymentTerm): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'name' => 'sometimes|required|string|max:100',
            'code' => 'sometimes|required|string|max:50|unique:payment_terms,code,' . $paymentTerm->id,
            'days' => 'nullable|integer|min:0',
            'requires_percentage' => 'nullable|boolean',
            'description' => 'nullable|string|max:500',
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
            $data['code'] = strtoupper(str_replace(' ', '_', $data['code']));
        }

        $paymentTerm->update($data);

        return response()->json([
            'message' => 'Payment term updated successfully',
            'data' => $paymentTerm
        ]);
    }

    /**
     * Remove the specified payment term (soft delete).
     */
    public function destroy(PaymentTerm $paymentTerm): JsonResponse
    {
        $paymentTerm->delete();

        return response()->json([
            'message' => 'Payment term deleted successfully'
        ]);
    }
}
