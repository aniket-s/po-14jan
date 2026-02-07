<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;

class FactoryController extends Controller
{
    /**
     * Get all factory users
     */
    public function index(Request $request)
    {
        $query = User::role('Factory')
            ->where('status', 'active')
            ->select('id', 'name', 'email', 'company', 'phone', 'country');

        // Optional search
        if ($request->has('search')) {
            $search = $request->search;
            $query->where(function($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('email', 'like', "%{$search}%")
                  ->orWhere('company', 'like', "%{$search}%");
            });
        }

        // Pagination
        if ($request->has('per_page')) {
            return $query->paginate($request->per_page);
        }

        return response()->json($query->get());
    }
}
