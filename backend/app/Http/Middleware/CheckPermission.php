<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CheckPermission
{
    /**
     * Handle an incoming request.
     *
     * Accepts comma-separated permissions via Laravel middleware params (any-of check).
     * Usage: middleware('permission:po.view,po.view_all,po.view_own')
     */
    public function handle(Request $request, Closure $next, string ...$permissions): Response
    {
        if (!$request->user()) {
            return response()->json([
                'message' => 'Unauthenticated',
            ], 401);
        }

        foreach ($permissions as $perm) {
            if ($request->user()->hasPermissionTo(trim($perm))) {
                return $next($request);
            }
        }

        return response()->json([
            'message' => 'You do not have permission to perform this action',
            'required_permission' => implode(', ', $permissions),
        ], 403);
    }
}
