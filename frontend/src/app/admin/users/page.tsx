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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Search, Edit, Trash2, UserCheck, UserX, Shield, Activity, ShieldCheck } from 'lucide-react';
import api from '@/lib/api';
import { ListPageSkeleton } from '@/components/skeletons';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

interface User {
  id: number;
  name: string;
  email: string;
  company: string | null;
  status: 'active' | 'inactive';
  email_verified_at: string | null;
  roles: Role[];
  created_at: string;
  updated_at: string;
}

interface Role {
  id: number;
  name: string;
  guard_name: string;
}

interface PaginatedUsers {
  data: User[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

const userSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  email: z.string().email('Invalid email address'),
  company: z.string().optional(),
  password: z.string().optional().refine((val) => !val || val.length >= 8, {
    message: 'Password must be at least 8 characters',
  }),
  password_confirmation: z.string().optional(),
  role_ids: z.array(z.number()).min(1, 'At least one role is required'),
  status: z.enum(['active', 'inactive']),
}).refine((data) => {
  if (data.password && data.password !== data.password_confirmation) {
    return false;
  }
  return true;
}, {
  message: "Passwords don't match",
  path: ["password_confirmation"],
});

type UserFormData = z.infer<typeof userSchema>;

export default function UsersManagementPage() {
  const { user, can, loading: authLoading } = useAuth();
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    lastPage: 1,
    perPage: 15,
    total: 0,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedUsers, setSelectedUsers] = useState<number[]>([]);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
  } = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      status: 'active',
      role_ids: [],
    },
  });

  const selectedRoleIds = watch('role_ids');

  // Check permissions only after auth is loaded
  useEffect(() => {
    if (authLoading) return; // Wait for auth to finish loading
    if (!can('admin.users.view')) {
      router.push('/dashboard');
    }
  }, [can, router, authLoading]);

  // Fetch users
  const fetchUsers = async () => {
    try {
      setLoading(true);
      const params: any = {
        page: pagination.currentPage,
        per_page: pagination.perPage,
      };

      if (searchQuery) {
        params.search = searchQuery;
      }
      if (statusFilter !== 'all') {
        params.status = statusFilter;
      }
      if (roleFilter !== 'all') {
        params.role = roleFilter;
      }

      const response = await api.get<any>('/admin/users', { params });
      // API returns {users: [...], pagination: {...}}
      setUsers(response.data.users || []);
      setPagination({
        currentPage: response.data.pagination?.current_page || 1,
        lastPage: response.data.pagination?.last_page || 1,
        perPage: response.data.pagination?.per_page || 15,
        total: response.data.pagination?.total || 0,
      });
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch roles
  const fetchRoles = async () => {
    try {
      const response = await api.get<any>('/admin/roles');
      // API returns {data: [...]}
      setRoles(response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch roles:', error);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [pagination.currentPage, searchQuery, statusFilter, roleFilter]);

  useEffect(() => {
    fetchRoles();
  }, []);

  // Handle create user
  const onSubmitCreate = async (data: UserFormData) => {
    try {
      await api.post('/admin/users', data);
      setShowCreateDialog(false);
      reset();
      fetchUsers();
    } catch (error) {
      console.error('Failed to create user:', error);
    }
  };

  // Handle edit user
  const onSubmitEdit = async (data: UserFormData) => {
    if (!selectedUser) return;

    try {
      // Remove password fields if empty
      const updateData = { ...data };
      if (!updateData.password) {
        delete updateData.password;
        delete updateData.password_confirmation;
      }

      await api.put(`/admin/users/${selectedUser.id}`, updateData);
      setShowEditDialog(false);
      setSelectedUser(null);
      reset();
      fetchUsers();
    } catch (error) {
      console.error('Failed to update user:', error);
    }
  };

  // Handle delete user
  const handleDelete = async () => {
    if (!selectedUser) return;

    try {
      await api.delete(`/admin/users/${selectedUser.id}`);
      setShowDeleteDialog(false);
      setSelectedUser(null);
      fetchUsers();
    } catch (error) {
      console.error('Failed to delete user:', error);
    }
  };

  // Handle activate/deactivate user
  const handleToggleStatus = async (userId: number, currentStatus: string) => {
    try {
      const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
      await api.patch(`/admin/users/${userId}/status`, { status: newStatus });
      fetchUsers();
    } catch (error) {
      console.error('Failed to update user status:', error);
    }
  };

  // Handle verify email
  const handleVerifyEmail = async (userId: number) => {
    try {
      await api.patch(`/admin/users/${userId}/verify-email`);
      fetchUsers();
    } catch (error) {
      console.error('Failed to verify user email:', error);
    }
  };

  // Handle bulk activate
  const handleBulkActivate = async () => {
    try {
      await api.post('/admin/users/bulk-action', {
        user_ids: selectedUsers,
        action: 'activate',
      });
      setSelectedUsers([]);
      fetchUsers();
    } catch (error) {
      console.error('Failed to activate users:', error);
    }
  };

  // Handle bulk deactivate
  const handleBulkDeactivate = async () => {
    try {
      await api.post('/admin/users/bulk-action', {
        user_ids: selectedUsers,
        action: 'deactivate',
      });
      setSelectedUsers([]);
      fetchUsers();
    } catch (error) {
      console.error('Failed to deactivate users:', error);
    }
  };

  // Handle bulk delete
  const handleBulkDelete = async () => {
    if (!confirm(`Are you sure you want to delete ${selectedUsers.length} users?`)) {
      return;
    }

    try {
      await api.post('/admin/users/bulk-action', {
        user_ids: selectedUsers,
        action: 'delete',
      });
      setSelectedUsers([]);
      fetchUsers();
    } catch (error) {
      console.error('Failed to delete users:', error);
    }
  };

  // Open edit dialog
  const openEditDialog = (user: User) => {
    setSelectedUser(user);
    setValue('name', user.name);
    setValue('email', user.email);
    setValue('company', user.company || '');
    setValue('status', user.status);
    setValue('role_ids', user.roles.map(r => r.id));
    setValue('password', '');
    setValue('password_confirmation', '');
    setShowEditDialog(true);
  };

  // Open delete dialog
  const openDeleteDialog = (user: User) => {
    setSelectedUser(user);
    setShowDeleteDialog(true);
  };

  // Handle select all
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedUsers(users.map(u => u.id));
    } else {
      setSelectedUsers([]);
    }
  };

  // Handle select user
  const handleSelectUser = (userId: number, checked: boolean) => {
    if (checked) {
      setSelectedUsers([...selectedUsers, userId]);
    } else {
      setSelectedUsers(selectedUsers.filter(id => id !== userId));
    }
  };

  // Toggle role selection
  const toggleRole = (roleId: number) => {
    const currentRoles = selectedRoleIds || [];
    if (currentRoles.includes(roleId)) {
      setValue('role_ids', currentRoles.filter(id => id !== roleId));
    } else {
      setValue('role_ids', [...currentRoles, roleId]);
    }
  };

  if (loading && users.length === 0) {
    return (
      <DashboardLayout requiredPermissions={['admin.users.view']} requireAll={false}>
        <ListPageSkeleton statCards={4} filterCount={4} columns={9} rows={5} />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout requiredPermissions={['admin.users.view']} requireAll={false}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Users Management</h1>
            <p className="text-muted-foreground mt-1">
              Manage user accounts, roles, and permissions
            </p>
          </div>
          {can('admin.users.create') && (
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create User
            </Button>
          )}
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pagination.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {users.filter(u => u.status === 'active').length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Verified Users</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {users.filter(u => u.email_verified_at).length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Selected</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{selectedUsers.length}</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters and Search */}
        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-4">
              <div className="space-y-2">
                <Label>Search</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name or email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={roleFilter} onValueChange={setRoleFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Roles</SelectItem>
                    {roles.map((role) => (
                      <SelectItem key={role.id} value={role.name}>
                        {role.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>&nbsp;</Label>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setSearchQuery('');
                    setStatusFilter('all');
                    setRoleFilter('all');
                  }}
                >
                  Clear Filters
                </Button>
              </div>
            </div>

            {/* Bulk Actions */}
            {selectedUsers.length > 0 && can('admin.users.edit') && (
              <div className="flex items-center gap-2 pt-4 border-t">
                <span className="text-sm text-muted-foreground">
                  {selectedUsers.length} users selected
                </span>
                <div className="flex gap-2 ml-auto">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleBulkActivate}
                  >
                    <UserCheck className="mr-2 h-4 w-4" />
                    Activate
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleBulkDeactivate}
                  >
                    <UserX className="mr-2 h-4 w-4" />
                    Deactivate
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleBulkDelete}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Users Table */}
        <Card>
          <CardHeader>
            <CardTitle>Users</CardTitle>
            <CardDescription>
              Showing {users.length} of {pagination.total} users
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  {can('admin.users.edit') && (
                    <TableHead className="w-12">
                      <input
                        type="checkbox"
                        checked={selectedUsers.length === users.length && users.length > 0}
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        className="rounded border-gray-300"
                      />
                    </TableHead>
                  )}
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Verified</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      No users found
                    </TableCell>
                  </TableRow>
                ) : (
                  users.map((user) => (
                    <TableRow key={user.id}>
                      {can('admin.users.edit') && (
                        <TableCell>
                          <input
                            type="checkbox"
                            checked={selectedUsers.includes(user.id)}
                            onChange={(e) => handleSelectUser(user.id, e.target.checked)}
                            className="rounded border-gray-300"
                          />
                        </TableCell>
                      )}
                      <TableCell className="font-medium">{user.name}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>{user.company || '-'}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {user.roles.map((role) => (
                            <Badge key={role.id} variant="secondary">
                              {role.name}
                            </Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.status === 'active' ? 'default' : 'secondary'}>
                          {user.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {user.email_verified_at ? (
                          <Badge variant="default">Verified</Badge>
                        ) : (
                          <Badge variant="outline">Unverified</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {new Date(user.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {can('admin.activity_logs.view') && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => router.push(`/admin/activity-logs?user_id=${user.id}`)}
                            >
                              <Activity className="h-4 w-4" />
                            </Button>
                          )}
                          {can('admin.users.edit') && !user.email_verified_at && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleVerifyEmail(user.id)}
                              title="Verify Email"
                            >
                              <ShieldCheck className="h-4 w-4" />
                            </Button>
                          )}
                          {can('admin.users.edit') && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleToggleStatus(user.id, user.status)}
                            >
                              {user.status === 'active' ? (
                                <UserX className="h-4 w-4" />
                              ) : (
                                <UserCheck className="h-4 w-4" />
                              )}
                            </Button>
                          )}
                          {can('admin.users.edit') && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditDialog(user)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          )}
                          {can('admin.users.delete') && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openDeleteDialog(user)}
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

            {/* Pagination */}
            {pagination.lastPage > 1 && (
              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-muted-foreground">
                  Page {pagination.currentPage} of {pagination.lastPage}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPagination({ ...pagination, currentPage: pagination.currentPage - 1 })}
                    disabled={pagination.currentPage === 1}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPagination({ ...pagination, currentPage: pagination.currentPage + 1 })}
                    disabled={pagination.currentPage === pagination.lastPage}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Create User Dialog */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New User</DialogTitle>
              <DialogDescription>
                Add a new user to the system with assigned roles
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmitCreate)} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    {...register('name')}
                    placeholder="John Doe"
                  />
                  {errors.name && (
                    <p className="text-sm text-red-500">{errors.name.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    {...register('email')}
                    placeholder="john@example.com"
                  />
                  {errors.email && (
                    <p className="text-sm text-red-500">{errors.email.message}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="company">Company</Label>
                <Input
                  id="company"
                  {...register('company')}
                  placeholder="Company Name"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="password">Password *</Label>
                  <Input
                    id="password"
                    type="password"
                    {...register('password')}
                    placeholder="••••••••"
                  />
                  {errors.password && (
                    <p className="text-sm text-red-500">{errors.password.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password_confirmation">Confirm Password *</Label>
                  <Input
                    id="password_confirmation"
                    type="password"
                    {...register('password_confirmation')}
                    placeholder="••••••••"
                  />
                  {errors.password_confirmation && (
                    <p className="text-sm text-red-500">{errors.password_confirmation.message}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Status *</Label>
                <Select
                  value={watch('status')}
                  onValueChange={(value: any) => setValue('status', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Roles *</Label>
                <div className="grid gap-2 md:grid-cols-2 border rounded-md p-4">
                  {roles.map((role) => (
                    <div key={role.id} className="flex items-start space-x-2">
                      <input
                        type="checkbox"
                        id={`role-${role.id}`}
                        checked={selectedRoleIds?.includes(role.id)}
                        onChange={() => toggleRole(role.id)}
                        className="mt-1 rounded border-gray-300"
                      />
                      <label
                        htmlFor={`role-${role.id}`}
                        className="text-sm font-medium cursor-pointer"
                      >
                        {role.name}
                      </label>
                    </div>
                  ))}
                </div>
                {errors.role_ids && (
                  <p className="text-sm text-red-500">{errors.role_ids.message}</p>
                )}
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
                <Button type="submit">Create User</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Edit User Dialog */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit User</DialogTitle>
              <DialogDescription>
                Update user information and roles
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmitEdit)} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="edit-name">Name *</Label>
                  <Input
                    id="edit-name"
                    {...register('name')}
                    placeholder="John Doe"
                  />
                  {errors.name && (
                    <p className="text-sm text-red-500">{errors.name.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-email">Email *</Label>
                  <Input
                    id="edit-email"
                    type="email"
                    {...register('email')}
                    placeholder="john@example.com"
                  />
                  {errors.email && (
                    <p className="text-sm text-red-500">{errors.email.message}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-company">Company</Label>
                <Input
                  id="edit-company"
                  {...register('company')}
                  placeholder="Company Name"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="edit-password">Password</Label>
                  <Input
                    id="edit-password"
                    type="password"
                    {...register('password')}
                    placeholder="Leave blank to keep current"
                  />
                  {errors.password && (
                    <p className="text-sm text-red-500">{errors.password.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-password-confirmation">Confirm Password</Label>
                  <Input
                    id="edit-password-confirmation"
                    type="password"
                    {...register('password_confirmation')}
                    placeholder="Leave blank to keep current"
                  />
                  {errors.password_confirmation && (
                    <p className="text-sm text-red-500">{errors.password_confirmation.message}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Status *</Label>
                <Select
                  value={watch('status')}
                  onValueChange={(value: any) => setValue('status', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Roles *</Label>
                <div className="grid gap-2 md:grid-cols-2 border rounded-md p-4">
                  {roles.map((role) => (
                    <div key={role.id} className="flex items-start space-x-2">
                      <input
                        type="checkbox"
                        id={`edit-role-${role.id}`}
                        checked={selectedRoleIds?.includes(role.id)}
                        onChange={() => toggleRole(role.id)}
                        className="mt-1 rounded border-gray-300"
                      />
                      <label
                        htmlFor={`edit-role-${role.id}`}
                        className="text-sm font-medium cursor-pointer"
                      >
                        {role.name}
                      </label>
                    </div>
                  ))}
                </div>
                {errors.role_ids && (
                  <p className="text-sm text-red-500">{errors.role_ids.message}</p>
                )}
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowEditDialog(false);
                    setSelectedUser(null);
                    reset();
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit">Update User</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete User</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this user? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            {selectedUser && (
              <div className="py-4">
                <p className="text-sm">
                  <span className="font-medium">Name:</span> {selectedUser.name}
                </p>
                <p className="text-sm">
                  <span className="font-medium">Email:</span> {selectedUser.email}
                </p>
              </div>
            )}
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowDeleteDialog(false);
                  setSelectedUser(null);
                }}
              >
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDelete}>
                Delete User
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
