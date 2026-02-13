'use client';

// Disable static generation for this authenticated page
export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Search, Edit, Trash2, Shield, Users } from 'lucide-react';
import api from '@/lib/api';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

interface Role {
  id: number;
  name: string;
  display_name: string;
  description: string | null;
  is_system: boolean;
  permissions: Permission[];
  users_count?: number;
  created_at: string;
  updated_at: string;
}

interface Permission {
  id: number;
  name: string;
  display_name: string;
  description: string | null;
  category: string;
}

interface PermissionCategory {
  category: string;
  permissions: Permission[];
}

const roleSchema = z.object({
  name: z.string().min(1, 'Role name is required').max(50).regex(/^[a-z_]+$/, 'Name must be lowercase letters and underscores only'),
  display_name: z.string().min(1, 'Display name is required').max(255),
  description: z.string().optional(),
  permission_ids: z.array(z.number()),
});

type RoleFormData = z.infer<typeof roleSchema>;

export default function RolesManagementPage() {
  const { user, can, loading: authLoading } = useAuth();
  const router = useRouter();
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [permissionCategories, setPermissionCategories] = useState<PermissionCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
  } = useForm<RoleFormData>({
    resolver: zodResolver(roleSchema),
    defaultValues: {
      permission_ids: [],
    },
  });

  const selectedPermissionIds = watch('permission_ids');

  // Check permissions
  useEffect(() => {
    if (authLoading) return;
    if (!can('admin.roles.view')) {
      router.push('/dashboard');
    }
  }, [can, router, authLoading]);

  // Fetch roles
  const fetchRoles = async () => {
    try {
      setLoading(true);
      const response = await api.get<{ data: Role[] }>('/admin/roles', {
        params: {
          include: 'permissions,users_count',
        },
      });
      setRoles(response.data.data);
    } catch (error) {
      console.error('Failed to fetch roles:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch permissions
  const fetchPermissions = async () => {
    try {
      const response = await api.get<{ permissions: Permission[] }>('/admin/permissions');
      // API returns {permissions: [...], grouped: [...]}
      const permissionsData = response.data.permissions || [];
      setPermissions(permissionsData);

      // Group permissions by category
      const categoriesMap = new Map<string, Permission[]>();
      permissionsData.forEach((permission) => {
        if (!categoriesMap.has(permission.category)) {
          categoriesMap.set(permission.category, []);
        }
        categoriesMap.get(permission.category)?.push(permission);
      });

      const categories: PermissionCategory[] = Array.from(categoriesMap.entries()).map(
        ([category, permissions]) => ({
          category,
          permissions,
        })
      );
      setPermissionCategories(categories);
    } catch (error) {
      console.error('Failed to fetch permissions:', error);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    fetchRoles();
    fetchPermissions();
  }, []);

  // Filter roles based on search
  const filteredRoles = roles.filter((role) =>
    role.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    role.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    role.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Handle create role
  const onSubmitCreate = async (data: RoleFormData) => {
    try {
      await api.post('/admin/roles', data);
      setShowCreateDialog(false);
      reset();
      fetchRoles();
    } catch (error) {
      console.error('Failed to create role:', error);
    }
  };

  // Handle edit role
  const onSubmitEdit = async (data: RoleFormData) => {
    if (!selectedRole) return;

    try {
      await api.put(`/admin/roles/${selectedRole.id}`, data);
      setShowEditDialog(false);
      setSelectedRole(null);
      reset();
      fetchRoles();
    } catch (error) {
      console.error('Failed to update role:', error);
    }
  };

  // Handle delete role
  const handleDelete = async () => {
    if (!selectedRole) return;

    try {
      await api.delete(`/admin/roles/${selectedRole.id}`);
      setShowDeleteDialog(false);
      setSelectedRole(null);
      fetchRoles();
    } catch (error) {
      console.error('Failed to delete role:', error);
    }
  };

  // Open edit dialog
  const openEditDialog = (role: Role) => {
    setSelectedRole(role);
    setValue('name', role.name);
    setValue('display_name', role.display_name);
    setValue('description', role.description || '');
    setValue('permission_ids', role.permissions.map(p => p.id));
    setShowEditDialog(true);
  };

  // Open view dialog
  const openViewDialog = (role: Role) => {
    setSelectedRole(role);
    setShowViewDialog(true);
  };

  // Open delete dialog
  const openDeleteDialog = (role: Role) => {
    setSelectedRole(role);
    setShowDeleteDialog(true);
  };

  // Toggle permission
  const togglePermission = (permissionId: number) => {
    const currentPermissions = selectedPermissionIds || [];
    if (currentPermissions.includes(permissionId)) {
      setValue('permission_ids', currentPermissions.filter(id => id !== permissionId));
    } else {
      setValue('permission_ids', [...currentPermissions, permissionId]);
    }
  };

  // Select all permissions in a category
  const selectCategoryPermissions = (category: string, select: boolean) => {
    const categoryPermissions = permissionCategories.find(c => c.category === category)?.permissions || [];
    const categoryPermissionIds = categoryPermissions.map(p => p.id);
    const currentPermissions = selectedPermissionIds || [];

    if (select) {
      const newPermissions = [...new Set([...currentPermissions, ...categoryPermissionIds])];
      setValue('permission_ids', newPermissions);
    } else {
      setValue('permission_ids', currentPermissions.filter(id => !categoryPermissionIds.includes(id)));
    }
  };

  // Check if all permissions in a category are selected
  const isCategorySelected = (category: string): boolean => {
    const categoryPermissions = permissionCategories.find(c => c.category === category)?.permissions || [];
    const categoryPermissionIds = categoryPermissions.map(p => p.id);
    const currentPermissions = selectedPermissionIds || [];
    return categoryPermissionIds.every(id => currentPermissions.includes(id));
  };

  if (loading) {
    return (
      <DashboardLayout requiredPermissions={['admin.roles.view']} requireAll={false}>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout requiredPermissions={['admin.roles.view']} requireAll={false}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Roles Management</h1>
            <p className="text-muted-foreground mt-1">
              Manage roles and assign permissions
            </p>
          </div>
          {can('admin.roles.create') && (
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Role
            </Button>
          )}
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Roles</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{roles.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">System Roles</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {roles.filter(r => r.is_system).length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Custom Roles</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {roles.filter(r => !r.is_system).length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Permissions</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{permissions.length}</div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <Card>
          <CardHeader>
            <CardTitle>Search Roles</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
          </CardContent>
        </Card>

        {/* Roles Table */}
        <Card>
          <CardHeader>
            <CardTitle>Roles</CardTitle>
            <CardDescription>
              Showing {filteredRoles.length} of {roles.length} roles
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Display Name</TableHead>
                  <TableHead>System Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Permissions</TableHead>
                  <TableHead>Users</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRoles.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No roles found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRoles.map((role) => (
                    <TableRow key={role.id}>
                      <TableCell className="font-medium">{role.display_name}</TableCell>
                      <TableCell>
                        <code className="text-sm bg-muted px-2 py-1 rounded">{role.name}</code>
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {role.description || '-'}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="link"
                          size="sm"
                          onClick={() => openViewDialog(role)}
                          className="p-0 h-auto"
                        >
                          {role.permissions.length} permissions
                        </Button>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <span>{role.users_count || 0}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {role.is_system ? (
                          <Badge variant="secondary">System</Badge>
                        ) : (
                          <Badge variant="outline">Custom</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openViewDialog(role)}
                          >
                            <Shield className="h-4 w-4" />
                          </Button>
                          {can('admin.roles.edit') && !role.is_system && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditDialog(role)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          )}
                          {can('admin.roles.delete') && !role.is_system && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openDeleteDialog(role)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Create Role Dialog */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Role</DialogTitle>
              <DialogDescription>
                Create a new role and assign permissions
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmitCreate)} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">System Name *</Label>
                  <Input
                    id="name"
                    {...register('name')}
                    placeholder="e.g., custom_role"
                  />
                  {errors.name && (
                    <p className="text-sm text-red-500">{errors.name.message}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Lowercase letters and underscores only
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="display_name">Display Name *</Label>
                  <Input
                    id="display_name"
                    {...register('display_name')}
                    placeholder="Custom Role"
                  />
                  {errors.display_name && (
                    <p className="text-sm text-red-500">{errors.display_name.message}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  {...register('description')}
                  placeholder="Role description..."
                />
              </div>

              <div className="space-y-2">
                <Label>Permissions</Label>
                <Tabs defaultValue={permissionCategories[0]?.category} className="w-full">
                  <TabsList className="grid w-full grid-cols-5">
                    {permissionCategories.map((cat) => (
                      <TabsTrigger key={cat.category} value={cat.category}>
                        {cat.category.replace('_', ' ')}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  {permissionCategories.map((cat) => (
                    <TabsContent key={cat.category} value={cat.category} className="space-y-4">
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">
                          {cat.permissions.length} permissions
                        </p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => selectCategoryPermissions(cat.category, !isCategorySelected(cat.category))}
                        >
                          {isCategorySelected(cat.category) ? 'Deselect All' : 'Select All'}
                        </Button>
                      </div>
                      <div className="grid gap-3 md:grid-cols-2 border rounded-md p-4 max-h-[300px] overflow-y-auto">
                        {cat.permissions.map((permission) => (
                          <div key={permission.id} className="flex items-start space-x-2">
                            <input
                              type="checkbox"
                              id={`perm-${permission.id}`}
                              checked={selectedPermissionIds?.includes(permission.id)}
                              onChange={() => togglePermission(permission.id)}
                              className="mt-1 rounded border-gray-300"
                            />
                            <div className="flex flex-col">
                              <label
                                htmlFor={`perm-${permission.id}`}
                                className="text-sm font-medium cursor-pointer"
                              >
                                {permission.display_name}
                              </label>
                              {permission.description && (
                                <span className="text-xs text-muted-foreground">
                                  {permission.description}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </TabsContent>
                  ))}
                </Tabs>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowCreateDialog(false);
                    reset();
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit">Create Role</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Edit Role Dialog */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Role</DialogTitle>
              <DialogDescription>
                Update role information and permissions
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmitEdit)} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="edit-name">System Name *</Label>
                  <Input
                    id="edit-name"
                    {...register('name')}
                    placeholder="e.g., custom_role"
                  />
                  {errors.name && (
                    <p className="text-sm text-red-500">{errors.name.message}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Lowercase letters and underscores only
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-display-name">Display Name *</Label>
                  <Input
                    id="edit-display-name"
                    {...register('display_name')}
                    placeholder="Custom Role"
                  />
                  {errors.display_name && (
                    <p className="text-sm text-red-500">{errors.display_name.message}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-description">Description</Label>
                <Input
                  id="edit-description"
                  {...register('description')}
                  placeholder="Role description..."
                />
              </div>

              <div className="space-y-2">
                <Label>Permissions</Label>
                <Tabs defaultValue={permissionCategories[0]?.category} className="w-full">
                  <TabsList className="grid w-full grid-cols-5">
                    {permissionCategories.map((cat) => (
                      <TabsTrigger key={cat.category} value={cat.category}>
                        {cat.category.replace('_', ' ')}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                  {permissionCategories.map((cat) => (
                    <TabsContent key={cat.category} value={cat.category} className="space-y-4">
                      <div className="flex items-center justify-between">
                        <p className="text-sm text-muted-foreground">
                          {cat.permissions.length} permissions
                        </p>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => selectCategoryPermissions(cat.category, !isCategorySelected(cat.category))}
                        >
                          {isCategorySelected(cat.category) ? 'Deselect All' : 'Select All'}
                        </Button>
                      </div>
                      <div className="grid gap-3 md:grid-cols-2 border rounded-md p-4 max-h-[300px] overflow-y-auto">
                        {cat.permissions.map((permission) => (
                          <div key={permission.id} className="flex items-start space-x-2">
                            <input
                              type="checkbox"
                              id={`edit-perm-${permission.id}`}
                              checked={selectedPermissionIds?.includes(permission.id)}
                              onChange={() => togglePermission(permission.id)}
                              className="mt-1 rounded border-gray-300"
                            />
                            <div className="flex flex-col">
                              <label
                                htmlFor={`edit-perm-${permission.id}`}
                                className="text-sm font-medium cursor-pointer"
                              >
                                {permission.display_name}
                              </label>
                              {permission.description && (
                                <span className="text-xs text-muted-foreground">
                                  {permission.description}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </TabsContent>
                  ))}
                </Tabs>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowEditDialog(false);
                    setSelectedRole(null);
                    reset();
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit">Update Role</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* View Permissions Dialog */}
        <Dialog open={showViewDialog} onOpenChange={setShowViewDialog}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{selectedRole?.display_name}</DialogTitle>
              <DialogDescription>
                {selectedRole?.description || 'Role permissions'}
              </DialogDescription>
            </DialogHeader>
            {selectedRole && (
              <div className="space-y-4">
                <div className="grid gap-2">
                  <div>
                    <span className="text-sm font-medium">System Name: </span>
                    <code className="text-sm bg-muted px-2 py-1 rounded">{selectedRole.name}</code>
                  </div>
                  <div>
                    <span className="text-sm font-medium">Type: </span>
                    {selectedRole.is_system ? (
                      <Badge variant="secondary">System</Badge>
                    ) : (
                      <Badge variant="outline">Custom</Badge>
                    )}
                  </div>
                  <div>
                    <span className="text-sm font-medium">Users: </span>
                    <span className="text-sm">{selectedRole.users_count || 0}</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="font-medium">Permissions ({selectedRole.permissions.length})</h4>
                  {permissionCategories.map((cat) => {
                    const categoryPerms = selectedRole.permissions.filter(p => p.category === cat.category);
                    if (categoryPerms.length === 0) return null;

                    return (
                      <div key={cat.category} className="space-y-2">
                        <h5 className="text-sm font-medium text-muted-foreground">
                          {cat.category.replace('_', ' ').toUpperCase()}
                        </h5>
                        <div className="grid gap-2 md:grid-cols-2">
                          {categoryPerms.map((permission) => (
                            <div key={permission.id} className="flex items-start space-x-2 text-sm">
                              <Badge variant="secondary" className="mt-0.5">
                                ✓
                              </Badge>
                              <div className="flex flex-col">
                                <span className="font-medium">{permission.display_name}</span>
                                {permission.description && (
                                  <span className="text-xs text-muted-foreground">
                                    {permission.description}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowViewDialog(false);
                  setSelectedRole(null);
                }}
              >
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Role</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this role? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            {selectedRole && (
              <div className="py-4">
                <p className="text-sm">
                  <span className="font-medium">Role:</span> {selectedRole.display_name}
                </p>
                <p className="text-sm">
                  <span className="font-medium">Permissions:</span> {selectedRole.permissions.length}
                </p>
                <p className="text-sm">
                  <span className="font-medium">Users:</span> {selectedRole.users_count || 0}
                </p>
                {(selectedRole.users_count || 0) > 0 && (
                  <p className="text-sm text-orange-600 mt-2">
                    Warning: This role is assigned to {selectedRole.users_count} user(s)
                  </p>
                )}
              </div>
            )}
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowDeleteDialog(false);
                  setSelectedRole(null);
                }}
              >
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDelete}>
                Delete Role
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
