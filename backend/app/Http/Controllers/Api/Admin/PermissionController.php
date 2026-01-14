<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Services\ActivityLogService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Spatie\Permission\Models\Permission;

class PermissionController extends Controller
{
    protected ActivityLogService $activityLog;

    public function __construct(ActivityLogService $activityLog)
    {
        $this->activityLog = $activityLog;
    }

    /**
     * Get all permissions
     */
    public function index(Request $request)
    {
        $query = Permission::query();

        // Search filter
        if ($request->has('search')) {
            $search = $request->search;
            $query->where('name', 'like', "%{$search}%");
        }

        // Category filter (based on permission prefix)
        if ($request->has('category')) {
            $category = $request->category;
            $query->where('name', 'like', "{$category}.%");
        }

        // Sorting
        $sortBy = $request->get('sort_by', 'name');
        $sortOrder = $request->get('sort_order', 'asc');
        $query->orderBy($sortBy, $sortOrder);

        $permissions = $query->get();

        // Group by category
        $grouped = $permissions->groupBy(function ($permission) {
            return explode('.', $permission->name)[0];
        });

        return response()->json([
            'permissions' => $permissions->map(function ($permission) {
                return [
                    'id' => $permission->id,
                    'name' => $permission->name,
                    'category' => explode('.', $permission->name)[0],
                    'guard_name' => $permission->guard_name,
                    'roles_count' => $permission->roles()->count(),
                    'users_count' => $permission->users()->count(),
                    'created_at' => $permission->created_at,
                ];
            }),
            'grouped' => $grouped->map(function ($items, $category) {
                return [
                    'category' => ucfirst($category),
                    'permissions' => $items->pluck('name'),
                    'count' => $items->count(),
                ];
            })->values(),
        ]);
    }

    /**
     * Get single permission details
     */
    public function show($id)
    {
        $permission = Permission::with(['roles', 'users'])->findOrFail($id);

        return response()->json([
            'permission' => [
                'id' => $permission->id,
                'name' => $permission->name,
                'category' => explode('.', $permission->name)[0],
                'guard_name' => $permission->guard_name,
                'roles' => $permission->roles->pluck('name'),
                'roles_count' => $permission->roles->count(),
                'users_count' => $permission->users()->count(),
                'created_at' => $permission->created_at,
                'updated_at' => $permission->updated_at,
            ],
        ]);
    }

    /**
     * Create new permission
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255|unique:permissions,name',
            'guard_name' => 'nullable|string|default:web',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $permission = Permission::create([
            'name' => $request->name,
            'guard_name' => $request->get('guard_name', 'web'),
        ]);

        // Log creation
        $this->activityLog->logCreated('Permission', $permission->id, [
            'name' => $permission->name,
        ]);

        return response()->json([
            'message' => 'Permission created successfully',
            'permission' => [
                'id' => $permission->id,
                'name' => $permission->name,
                'category' => explode('.', $permission->name)[0],
                'guard_name' => $permission->guard_name,
            ],
        ], 201);
    }

    /**
     * Update permission
     */
    public function update(Request $request, $id)
    {
        $permission = Permission::findOrFail($id);

        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255|unique:permissions,name,' . $id,
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $oldData = ['name' => $permission->name];

        $permission->name = $request->name;
        $permission->save();

        $newData = ['name' => $permission->name];

        // Log update
        $this->activityLog->logUpdated('Permission', $permission->id, $oldData, $newData);

        return response()->json([
            'message' => 'Permission updated successfully',
            'permission' => [
                'id' => $permission->id,
                'name' => $permission->name,
                'category' => explode('.', $permission->name)[0],
                'guard_name' => $permission->guard_name,
            ],
        ]);
    }

    /**
     * Delete permission
     */
    public function destroy($id)
    {
        $permission = Permission::findOrFail($id);

        // Check if permission is assigned to any roles
        $rolesCount = $permission->roles()->count();
        if ($rolesCount > 0) {
            return response()->json([
                'message' => "Cannot delete permission. {$rolesCount} roles have this permission.",
                'roles_count' => $rolesCount,
            ], 403);
        }

        // Check if permission is directly assigned to users
        $usersCount = $permission->users()->count();
        if ($usersCount > 0) {
            return response()->json([
                'message' => "Cannot delete permission. {$usersCount} users have this permission.",
                'users_count' => $usersCount,
            ], 403);
        }

        $permissionData = ['name' => $permission->name];

        // Log deletion
        $this->activityLog->logDeleted('Permission', $permission->id, $permissionData);

        // Delete permission
        $permission->delete();

        return response()->json([
            'message' => 'Permission deleted successfully',
        ]);
    }

    /**
     * Get roles that have this permission
     */
    public function roles($id)
    {
        $permission = Permission::with('roles')->findOrFail($id);

        return response()->json([
            'permission' => [
                'id' => $permission->id,
                'name' => $permission->name,
            ],
            'roles' => $permission->roles->map(function ($role) {
                return [
                    'id' => $role->id,
                    'name' => $role->name,
                    'users_count' => $role->users()->count(),
                ];
            }),
        ]);
    }

    /**
     * Get available permission categories
     */
    public function categories()
    {
        $permissions = Permission::all();

        $categories = $permissions->groupBy(function ($permission) {
            return explode('.', $permission->name)[0];
        })->map(function ($items, $category) {
            return [
                'name' => $category,
                'label' => ucfirst(str_replace('_', ' ', $category)),
                'count' => $items->count(),
            ];
        })->values();

        return response()->json([
            'categories' => $categories,
        ]);
    }
}
