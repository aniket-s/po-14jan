<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Services\ActivityLogService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Spatie\Permission\Models\Role;
use Spatie\Permission\Models\Permission;

class RoleController extends Controller
{
    protected ActivityLogService $activityLog;

    public function __construct(ActivityLogService $activityLog)
    {
        $this->activityLog = $activityLog;
    }

    /**
     * Get all roles with their permissions
     */
    public function index(Request $request)
    {
        $query = Role::with('permissions');

        // Search filter
        if ($request->has('search')) {
            $search = $request->search;
            $query->where('name', 'like', "%{$search}%");
        }

        // Sorting
        $sortBy = $request->get('sort_by', 'name');
        $sortOrder = $request->get('sort_order', 'asc');
        $query->orderBy($sortBy, $sortOrder);

        $roles = $query->get();

        return response()->json([
            'data' => $roles->map(function ($role) {
                return [
                    'id' => $role->id,
                    'name' => $role->name,
                    'display_name' => $role->name, // Add display_name for frontend
                    'description' => null, // Add description field
                    'guard_name' => $role->guard_name,
                    'permissions' => $role->permissions->map(function ($perm) {
                        return [
                            'id' => $perm->id,
                            'name' => $perm->name,
                        ];
                    }),
                    'permissions_count' => $role->permissions->count(),
                    'users_count' => $role->users()->count(),
                    'is_system' => in_array($role->name, ['Super Admin', 'Importer', 'Factory', 'Agency', 'Quality Inspector', 'Viewer']),
                    'created_at' => $role->created_at,
                    'updated_at' => $role->updated_at,
                ];
            }),
        ]);
    }

    /**
     * Get single role details
     */
    public function show($id)
    {
        $role = Role::with(['permissions', 'users'])->findOrFail($id);

        return response()->json([
            'role' => [
                'id' => $role->id,
                'name' => $role->name,
                'guard_name' => $role->guard_name,
                'permissions' => $role->permissions->pluck('name'),
                'users_count' => $role->users()->count(),
                'created_at' => $role->created_at,
                'updated_at' => $role->updated_at,
            ],
        ]);
    }

    /**
     * Create new role
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255|unique:roles,name',
            'permissions' => 'nullable|array',
            'permissions.*' => 'exists:permissions,name',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $role = Role::create(['name' => $request->name]);

        // Assign permissions
        if ($request->has('permissions') && !empty($request->permissions)) {
            $role->syncPermissions($request->permissions);
        }

        // Log creation
        $this->activityLog->logCreated('Role', $role->id, [
            'name' => $role->name,
            'permissions' => $role->permissions->pluck('name')->toArray(),
        ]);

        return response()->json([
            'message' => 'Role created successfully',
            'role' => [
                'id' => $role->id,
                'name' => $role->name,
                'permissions' => $role->permissions->pluck('name'),
                'permissions_count' => $role->permissions->count(),
            ],
        ], 201);
    }

    /**
     * Update role
     */
    public function update(Request $request, $id)
    {
        $role = Role::findOrFail($id);

        // Prevent editing Super Admin role
        if ($role->name === 'Super Admin') {
            return response()->json([
                'message' => 'Cannot edit Super Admin role',
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255|unique:roles,name,' . $id,
            'permissions' => 'nullable|array',
            'permissions.*' => 'exists:permissions,name',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $oldData = [
            'name' => $role->name,
            'permissions' => $role->permissions->pluck('name')->toArray(),
        ];

        // Update role name
        $role->name = $request->name;
        $role->save();

        // Update permissions
        if ($request->has('permissions')) {
            $role->syncPermissions($request->permissions);
        }

        $newData = [
            'name' => $role->name,
            'permissions' => $role->permissions->pluck('name')->toArray(),
        ];

        // Log update
        $this->activityLog->logUpdated('Role', $role->id, $oldData, $newData);

        return response()->json([
            'message' => 'Role updated successfully',
            'role' => [
                'id' => $role->id,
                'name' => $role->name,
                'permissions' => $role->permissions->pluck('name'),
                'permissions_count' => $role->permissions->count(),
            ],
        ]);
    }

    /**
     * Delete role
     */
    public function destroy($id)
    {
        $role = Role::findOrFail($id);

        // Prevent deleting default roles
        $protectedRoles = ['Super Admin', 'Importer', 'Agency', 'Factory', 'Quality Inspector', 'Viewer'];
        if (in_array($role->name, $protectedRoles)) {
            return response()->json([
                'message' => 'Cannot delete default system roles',
            ], 403);
        }

        // Check if role has users
        $usersCount = $role->users()->count();
        if ($usersCount > 0) {
            return response()->json([
                'message' => "Cannot delete role. {$usersCount} users are assigned to this role.",
                'users_count' => $usersCount,
            ], 403);
        }

        $roleData = [
            'name' => $role->name,
            'permissions' => $role->permissions->pluck('name')->toArray(),
        ];

        // Log deletion
        $this->activityLog->logDeleted('Role', $role->id, $roleData);

        // Delete role
        $role->delete();

        return response()->json([
            'message' => 'Role deleted successfully',
        ]);
    }

    /**
     * Get all available permissions grouped by category
     */
    public function permissions()
    {
        $permissions = Permission::all();

        // Group permissions by category (first part before dot)
        $grouped = $permissions->groupBy(function ($permission) {
            return explode('.', $permission->name)[0];
        });

        return response()->json([
            'permissions' => $grouped->map(function ($items, $category) {
                return [
                    'category' => ucfirst($category),
                    'permissions' => $items->map(function ($permission) {
                        return [
                            'name' => $permission->name,
                            'guard_name' => $permission->guard_name,
                        ];
                    })->values(),
                ];
            })->values(),
            'all_permissions' => $permissions->pluck('name'),
        ]);
    }

    /**
     * Sync role permissions
     */
    public function syncPermissions(Request $request, $id)
    {
        $role = Role::findOrFail($id);

        // Prevent editing Super Admin permissions
        if ($role->name === 'Super Admin') {
            return response()->json([
                'message' => 'Cannot edit Super Admin permissions',
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'permissions' => 'required|array',
            'permissions.*' => 'exists:permissions,name',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $oldPermissions = $role->permissions->pluck('name')->toArray();

        // Sync permissions
        $role->syncPermissions($request->permissions);

        // Log permission sync
        $this->activityLog->log(
            'permissions_synced',
            'Role',
            $role->id,
            "Updated permissions for role {$role->name}",
            [
                'old_permissions' => $oldPermissions,
                'new_permissions' => $request->permissions,
                'added' => array_diff($request->permissions, $oldPermissions),
                'removed' => array_diff($oldPermissions, $request->permissions),
            ]
        );

        return response()->json([
            'message' => 'Permissions updated successfully',
            'role' => [
                'id' => $role->id,
                'name' => $role->name,
                'permissions' => $role->permissions->pluck('name'),
                'permissions_count' => $role->permissions->count(),
            ],
        ]);
    }

    /**
     * Get users assigned to a role
     */
    public function users($id, Request $request)
    {
        $role = Role::findOrFail($id);

        $perPage = $request->get('per_page', 15);
        $users = $role->users()->paginate($perPage);

        return response()->json([
            'role' => [
                'id' => $role->id,
                'name' => $role->name,
            ],
            'users' => $users->map(function ($user) {
                return [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'status' => $user->status,
                    'roles' => $user->getRoleNames(),
                ];
            }),
            'pagination' => [
                'current_page' => $users->currentPage(),
                'last_page' => $users->lastPage(),
                'per_page' => $users->perPage(),
                'total' => $users->total(),
            ],
        ]);
    }
}
