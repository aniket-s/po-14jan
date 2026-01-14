<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Agent;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Validator;

class AgentController extends Controller
{
    /**
     * Display a listing of agents.
     */
    public function index(Request $request): JsonResponse
    {
        $query = Agent::query();

        // Filter by active status
        if ($request->has('active_only')) {
            $query->where('is_active', true);
        }

        // Search by company name, contact person, or email
        if ($request->has('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('company_name', 'like', "%{$search}%")
                  ->orWhere('contact_person', 'like', "%{$search}%")
                  ->orWhere('email', 'like', "%{$search}%");
            });
        }

        // Return all if requested (for dropdowns)
        if ($request->has('all') && $request->all === 'true') {
            return response()->json($query->where('is_active', true)->orderBy('company_name')->get());
        }

        // Paginated results
        $perPage = $request->get('per_page', 15);
        $agents = $query->orderBy('company_name')->paginate($perPage);

        return response()->json($agents);
    }

    /**
     * Store a newly created agent.
     */
    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'company_name' => 'required|string|max:255',
            'contact_person' => 'nullable|string|max:255',
            'email' => 'required|email|max:255|unique:agents,email',
            'phone' => 'nullable|string|max:50',
            'address' => 'nullable|string',
            'country' => 'nullable|string|max:255',
            'payment_terms' => 'nullable|string|max:255',
            'is_active' => 'nullable|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $agent = Agent::create($validator->validated());

        return response()->json([
            'message' => 'Agent created successfully',
            'data' => $agent
        ], 201);
    }

    /**
     * Display the specified agent.
     */
    public function show(Agent $agent): JsonResponse
    {
        return response()->json($agent);
    }

    /**
     * Update the specified agent.
     */
    public function update(Request $request, Agent $agent): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'company_name' => 'sometimes|required|string|max:255',
            'contact_person' => 'nullable|string|max:255',
            'email' => 'sometimes|required|email|max:255|unique:agents,email,' . $agent->id,
            'phone' => 'nullable|string|max:50',
            'address' => 'nullable|string',
            'country' => 'nullable|string|max:255',
            'payment_terms' => 'nullable|string|max:255',
            'is_active' => 'nullable|boolean',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $agent->update($validator->validated());

        return response()->json([
            'message' => 'Agent updated successfully',
            'data' => $agent
        ]);
    }

    /**
     * Remove the specified agent (soft delete).
     */
    public function destroy(Agent $agent): JsonResponse
    {
        $agent->delete();

        return response()->json([
            'message' => 'Agent deleted successfully'
        ]);
    }
}
