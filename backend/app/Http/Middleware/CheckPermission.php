<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CheckPermission
{
    /**
     * Handle an incoming request.
     */
    public function handle(Request $request, Closure $next, string $permission): Response
    {
        if (!$request->user()) {
            return response()->json([
                'message' => 'Unauthenticated',
            ], 401);
        }

        // Support pipe-separated permissions (any-of check)
        $permissions = explode('|', $permission);

        $hasAny = false;
        foreach ($permissions as $perm) {
            if ($request->user()->hasPermissionTo(trim($perm))) {
                $hasAny = true;
                break;
            }
        }

        if (!$hasAny) {
            return response()->json([
                'message' => 'You do not have permission to perform this action',
                'required_permission' => $permission,
            ], 403);
        }

        return $next($request);
    }
}
