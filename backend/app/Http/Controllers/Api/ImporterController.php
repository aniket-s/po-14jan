<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;

class ImporterController extends Controller
{
    /**
     * Get all importer users
     */
    public function index(Request $request)
    {
        $query = User::role('Importer')
            ->where('status', 'active')
            ->select('id', 'name', 'email', 'company', 'phone', 'country');

        if ($request->has('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('email', 'like', "%{$search}%")
                  ->orWhere('company', 'like', "%{$search}%");
            });
        }

        if ($request->has('per_page')) {
            return $query->paginate($request->per_page);
        }

        return response()->json($query->get());
    }
}
