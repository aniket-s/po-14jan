<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\ActivityLogService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Spatie\Permission\Models\Role;

class AdminUserController extends Controller
{
    protected ActivityLogService $activityLog;

    public function __construct(ActivityLogService $activityLog)
    {
        $this->activityLog = $activityLog;
    }

    /**
     * Get all users with pagination and filters
     */
    public function index(Request $request)
    {
        $query = User::with(['roles', 'permissions']);

        // Search filter
        if ($request->has('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('email', 'like', "%{$search}%")
                  ->orWhere('company', 'like', "%{$search}%");
            });
        }

        // Status filter
        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        // Role filter
        if ($request->has('role')) {
            $query->role($request->role);
        }

        // Country filter
        if ($request->has('country')) {
            $query->where('country', $request->country);
        }

        // Sorting
        $sortBy = $request->get('sort_by', 'created_at');
        $sortOrder = $request->get('sort_order', 'desc');
        $query->orderBy($sortBy, $sortOrder);

        $perPage = $request->get('per_page', 15);
        $users = $query->paginate($perPage);

        return response()->json([
            'users' => $users->map(function ($user) {
                return [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'phone' => $user->phone,
                    'company' => $user->company,
                    'country' => $user->country,
                    'status' => $user->status,
                    'last_login_at' => $user->last_login_at,
                    'last_login_ip' => $user->last_login_ip,
                    'email_verified_at' => $user->email_verified_at,
                    'created_at' => $user->created_at,
                    'updated_at' => $user->updated_at,
                    'roles' => $user->roles->map(function ($role) {
                        return [
                            'id' => $role->id,
                            'name' => $role->name,
                            'guard_name' => $role->guard_name,
                        ];
                    }),
                    'permissions' => $user->getAllPermissions()->pluck('name'),
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

    /**
     * Get single user details
     */
    public function show($id)
    {
        $user = User::with(['roles', 'permissions'])->findOrFail($id);

        return response()->json([
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'phone' => $user->phone,
                'company' => $user->company,
                'country' => $user->country,
                'status' => $user->status,
                'internal_notes' => $user->internal_notes,
                'last_login_at' => $user->last_login_at,
                'last_login_ip' => $user->last_login_ip,
                'email_verified_at' => $user->email_verified_at,
                'created_at' => $user->created_at,
                'updated_at' => $user->updated_at,
                'roles' => $user->roles->map(function ($role) {
                    return [
                        'id' => $role->id,
                        'name' => $role->name,
                        'guard_name' => $role->guard_name,
                    ];
                }),
                'permissions' => $user->getAllPermissions()->pluck('name'),
            ],
        ]);
    }

    /**
     * Create new user
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:users',
            'password' => 'required|string|min:8|confirmed',
            'phone' => 'nullable|string|max:20',
            'company' => 'nullable|string|max:255',
            'country' => 'nullable|string|max:100',
            'status' => 'required|in:active,inactive,suspended',
            'internal_notes' => 'nullable|string',
            'role_ids' => 'nullable|array',
            'role_ids.*' => 'exists:roles,id',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $user = User::create([
            'name' => $request->name,
            'email' => $request->email,
            'password' => Hash::make($request->password),
            'phone' => $request->phone,
            'company' => $request->company,
            'country' => $request->country,
            'status' => $request->status,
            'internal_notes' => $request->internal_notes,
        ]);

        // Assign roles
        if ($request->has('role_ids') && !empty($request->role_ids)) {
            $roles = Role::whereIn('id', $request->role_ids)->get();
            $user->syncRoles($roles);
        } else {
            // Assign default Viewer role if no roles specified
            $user->assignRole('Viewer');
        }

        // Log creation
        $this->activityLog->logCreated('User', $user->id, [
            'email' => $user->email,
            'roles' => $user->getRoleNames()->toArray(),
        ]);

        return response()->json([
            'message' => 'User created successfully',
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'phone' => $user->phone,
                'company' => $user->company,
                'country' => $user->country,
                'status' => $user->status,
                'roles' => $user->roles->map(function ($role) {
                    return [
                        'id' => $role->id,
                        'name' => $role->name,
                        'guard_name' => $role->guard_name,
                    ];
                }),
                'permissions' => $user->getAllPermissions()->pluck('name'),
            ],
        ], 201);
    }

    /**
     * Update user
     */
    public function update(Request $request, $id)
    {
        $user = User::findOrFail($id);

        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:users,email,' . $id,
            'phone' => 'nullable|string|max:20',
            'company' => 'nullable|string|max:255',
            'country' => 'nullable|string|max:100',
            'status' => 'required|in:active,inactive,suspended',
            'internal_notes' => 'nullable|string',
            'password' => 'nullable|string|min:8|confirmed',
            'role_ids' => 'nullable|array',
            'role_ids.*' => 'exists:roles,id',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $oldData = [
            'name' => $user->name,
            'email' => $user->email,
            'phone' => $user->phone,
            'company' => $user->company,
            'country' => $user->country,
            'status' => $user->status,
            'roles' => $user->getRoleNames()->toArray(),
        ];

        // Update user fields
        $user->fill([
            'name' => $request->name,
            'email' => $request->email,
            'phone' => $request->phone,
            'company' => $request->company,
            'country' => $request->country,
            'status' => $request->status,
            'internal_notes' => $request->internal_notes,
        ]);

        // Update password if provided
        if ($request->filled('password')) {
            $user->password = Hash::make($request->password);
        }

        $user->save();

        // Update roles
        if ($request->has('role_ids')) {
            $roles = Role::whereIn('id', $request->role_ids)->get();
            $user->syncRoles($roles);
        }

        $newData = [
            'name' => $user->name,
            'email' => $user->email,
            'phone' => $user->phone,
            'company' => $user->company,
            'country' => $user->country,
            'status' => $user->status,
            'roles' => $user->getRoleNames()->toArray(),
        ];

        // Log update
        $this->activityLog->logUpdated('User', $user->id, $oldData, $newData);

        return response()->json([
            'message' => 'User updated successfully',
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'phone' => $user->phone,
                'company' => $user->company,
                'country' => $user->country,
                'status' => $user->status,
                'roles' => $user->roles->map(function ($role) {
                    return [
                        'id' => $role->id,
                        'name' => $role->name,
                        'guard_name' => $role->guard_name,
                    ];
                }),
                'permissions' => $user->getAllPermissions()->pluck('name'),
            ],
        ]);
    }

    /**
     * Delete user
     */
    public function destroy($id)
    {
        $user = User::findOrFail($id);

        // Prevent deleting self
        if ($user->id === auth()->id()) {
            return response()->json([
                'message' => 'You cannot delete your own account',
            ], 403);
        }

        // Prevent deleting Super Admin if this is the last one
        if ($user->hasRole('Super Admin')) {
            $superAdminCount = User::role('Super Admin')->count();
            if ($superAdminCount <= 1) {
                return response()->json([
                    'message' => 'Cannot delete the last Super Admin',
                ], 403);
            }
        }

        $userData = [
            'email' => $user->email,
            'roles' => $user->getRoleNames()->toArray(),
        ];

        // Log deletion
        $this->activityLog->logDeleted('User', $user->id, $userData);

        // Delete user
        $user->delete();

        return response()->json([
            'message' => 'User deleted successfully',
        ]);
    }

    /**
     * Bulk operations
     */
    public function bulkAction(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'action' => 'required|in:activate,deactivate,suspend,delete,assign_role,remove_role',
            'user_ids' => 'required|array|min:1',
            'user_ids.*' => 'exists:users,id',
            'role' => 'required_if:action,assign_role,remove_role|exists:roles,name',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => 'Validation failed',
                'errors' => $validator->errors()
            ], 422);
        }

        $users = User::whereIn('id', $request->user_ids)->get();
        $affected = 0;

        foreach ($users as $user) {
            // Prevent operating on self for certain actions
            if (in_array($request->action, ['deactivate', 'suspend', 'delete']) && $user->id === auth()->id()) {
                continue;
            }

            switch ($request->action) {
                case 'activate':
                    $user->status = 'active';
                    $user->save();
                    $affected++;
                    break;

                case 'deactivate':
                    $user->status = 'inactive';
                    $user->save();
                    $affected++;
                    break;

                case 'suspend':
                    $user->status = 'suspended';
                    $user->save();
                    $affected++;
                    break;

                case 'delete':
                    // Skip if Super Admin and last one
                    if ($user->hasRole('Super Admin')) {
                        $superAdminCount = User::role('Super Admin')->count();
                        if ($superAdminCount <= 1) {
                            continue 2;
                        }
                    }
                    $user->delete();
                    $affected++;
                    break;

                case 'assign_role':
                    $user->assignRole($request->role);
                    $affected++;
                    break;

                case 'remove_role':
                    $user->removeRole($request->role);
                    $affected++;
                    break;
            }
        }

        // Log bulk action
        $this->activityLog->log(
            'bulk_action',
            'User',
            null,
            "Bulk {$request->action} on {$affected} users",
            [
                'action' => $request->action,
                'user_ids' => $request->user_ids,
                'affected_count' => $affected,
                'role' => $request->role ?? null,
            ]
        );

        return response()->json([
            'message' => "Bulk action completed successfully. {$affected} users affected.",
            'affected_count' => $affected,
        ]);
    }

    /**
     * Verify user email
     */
    public function verifyEmail($id)
    {
        $user = User::findOrFail($id);

        if ($user->email_verified_at) {
            return response()->json([
                'message' => 'Email is already verified',
            ], 400);
        }

        $user->email_verified_at = now();
        $user->save();

        // Log verification
        $this->activityLog->log(
            'verified',
            'User',
            $user->id,
            "User email verified by admin",
            [
                'email' => $user->email,
                'verified_at' => $user->email_verified_at,
            ]
        );

        return response()->json([
            'message' => 'User email verified successfully',
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'email_verified_at' => $user->email_verified_at,
            ],
        ]);
    }

    /**
     * Get user activity logs
     */
    public function activityLogs($id, Request $request)
    {
        $limit = $request->get('limit', 50);
        $logs = $this->activityLog->getUserActivity($id, $limit);

        return response()->json([
            'logs' => $logs,
        ]);
    }
}
