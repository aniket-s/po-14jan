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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Shield, Key } from 'lucide-react';
import api from '@/lib/api';

interface Permission {
  id: number;
  name: string;
  category: string;
  guard_name: string;
  roles_count?: number;
  users_count?: number;
  created_at: string;
}

interface PermissionCategory {
  category: string;
  permissions: Permission[];
}

export default function PermissionsManagementPage() {
  const { user, can, loading: authLoading } = useAuth();
  const router = useRouter();
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [permissionCategories, setPermissionCategories] = useState<PermissionCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('');

  // Check permissions
  useEffect(() => {
    if (authLoading) return;
    if (!can('admin.permissions.view')) {
      router.push('/dashboard');
    }
  }, [can, router, authLoading]);

  // Fetch permissions
  const fetchPermissions = async () => {
    try {
      setLoading(true);
      const response = await api.get<any>('/admin/permissions', {
        params: {
          include: 'roles_count',
        },
      });
      // API returns {permissions: [...], grouped: [...]}
      const permissionsData = response.data.permissions || [];
      setPermissions(permissionsData);

      // Group permissions by category
      const categoriesMap = new Map<string, Permission[]>();
      permissionsData.forEach((permission: Permission) => {
        if (!categoriesMap.has(permission.category)) {
          categoriesMap.set(permission.category, []);
        }
        categoriesMap.get(permission.category)?.push(permission);
      });

      const categories: PermissionCategory[] = Array.from(categoriesMap.entries()).map(
        ([category, permissions]) => ({
          category,
          permissions: permissions.sort((a, b) => a.name.localeCompare(b.name)),
        })
      );

      // Sort categories alphabetically
      categories.sort((a, b) => a.category.localeCompare(b.category));

      setPermissionCategories(categories);
      if (categories.length > 0 && !activeCategory) {
        setActiveCategory(categories[0].category);
      }
    } catch (error) {
      console.error('Failed to fetch permissions:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    fetchPermissions();
  }, []);

  // Filter permissions based on search
  const getFilteredCategories = (): PermissionCategory[] => {
    if (!searchQuery) return permissionCategories;

    const query = searchQuery.toLowerCase();
    return permissionCategories
      .map((cat) => ({
        category: cat.category,
        permissions: cat.permissions.filter(
          (p) =>
            p.name.toLowerCase().includes(query) ||
            p.category.toLowerCase().includes(query)
        ),
      }))
      .filter((cat) => cat.permissions.length > 0);
  };

  const filteredCategories = getFilteredCategories();

  // Get stats
  const totalPermissions = permissions.length;
  const categoriesCount = permissionCategories.length;
  const avgPermsPerCategory = categoriesCount > 0
    ? Math.round(totalPermissions / categoriesCount)
    : 0;

  if (loading) {
    return (
      <DashboardLayout requiredPermissions={['admin.permissions.view']} requireAll={false}>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout requiredPermissions={['admin.permissions.view']} requireAll={false}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Permissions Management</h1>
            <p className="text-muted-foreground mt-1">
              View and manage system permissions organized by category
            </p>
          </div>
          <Badge variant="secondary" className="text-sm">
            <Key className="mr-2 h-4 w-4" />
            Read Only
          </Badge>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Permissions</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalPermissions}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Categories</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{categoriesCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg per Category</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{avgPermsPerCategory}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Filtered Results</CardTitle>
              <Search className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {filteredCategories.reduce((sum, cat) => sum + cat.permissions.length, 0)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <Card>
          <CardHeader>
            <CardTitle>Search Permissions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, category, or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
          </CardContent>
        </Card>

        {/* Permissions by Category */}
        <Card>
          <CardHeader>
            <CardTitle>Permissions by Category</CardTitle>
            <CardDescription>
              All system permissions organized by functional category
            </CardDescription>
          </CardHeader>
          <CardContent>
            {filteredCategories.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No permissions found matching your search
              </div>
            ) : (
              <Tabs value={activeCategory} onValueChange={setActiveCategory} className="w-full">
                <TabsList className="grid w-full grid-cols-5 mb-4">
                  {filteredCategories.slice(0, 5).map((cat) => (
                    <TabsTrigger key={cat.category} value={cat.category}>
                      {cat.category.replace('_', ' ')}
                      <Badge variant="secondary" className="ml-2">
                        {cat.permissions.length}
                      </Badge>
                    </TabsTrigger>
                  ))}
                </TabsList>
                {filteredCategories.length > 5 && (
                  <TabsList className="grid w-full grid-cols-5 mb-4">
                    {filteredCategories.slice(5, 10).map((cat) => (
                      <TabsTrigger key={cat.category} value={cat.category}>
                        {cat.category.replace('_', ' ')}
                        <Badge variant="secondary" className="ml-2">
                          {cat.permissions.length}
                        </Badge>
                      </TabsTrigger>
                    ))}
                  </TabsList>
                )}

                {filteredCategories.map((cat) => (
                  <TabsContent key={cat.category} value={cat.category}>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-lg font-semibold">
                            {cat.category.replace('_', ' ').toUpperCase()}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {cat.permissions.length} permissions in this category
                          </p>
                        </div>
                      </div>

                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Permission Name</TableHead>
                            <TableHead>Category</TableHead>
                            <TableHead>Assigned Roles</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {cat.permissions.map((permission) => (
                            <TableRow key={permission.id}>
                              <TableCell className="font-medium">
                                <code className="text-xs bg-muted px-2 py-1 rounded">
                                  {permission.name}
                                </code>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">
                                  {permission.category}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1">
                                  <Shield className="h-4 w-4 text-muted-foreground" />
                                  <span>{permission.roles_count || 0} roles</span>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </TabsContent>
                ))}
              </Tabs>
            )}
          </CardContent>
        </Card>

        {/* All Permissions Table (Alternative View) */}
        <Card>
          <CardHeader>
            <CardTitle>All Permissions</CardTitle>
            <CardDescription>
              Complete list of all system permissions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-h-[600px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead>Permission Name</TableHead>
                    <TableHead>Roles</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {permissions
                    .filter((permission) => {
                      if (!searchQuery) return true;
                      const query = searchQuery.toLowerCase();
                      return (
                        permission.name.toLowerCase().includes(query) ||
                        permission.category.toLowerCase().includes(query)
                      );
                    })
                    .map((permission) => (
                      <TableRow key={permission.id}>
                        <TableCell>
                          <Badge variant="outline">
                            {permission.category.replace('_', ' ')}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">
                          <code className="text-xs bg-muted px-2 py-1 rounded">
                            {permission.name}
                          </code>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Shield className="h-4 w-4 text-muted-foreground" />
                            <span>{permission.roles_count || 0}</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Category Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Category Summary</CardTitle>
            <CardDescription>
              Overview of permissions distribution across categories
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {permissionCategories.map((cat) => (
                <Card key={cat.category}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                      {cat.category.replace('_', ' ').toUpperCase()}
                    </CardTitle>
                    <Shield className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{cat.permissions.length}</div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {((cat.permissions.length / totalPermissions) * 100).toFixed(1)}% of total
                    </p>
                    <div className="mt-3 space-y-1">
                      {cat.permissions.slice(0, 3).map((perm) => (
                        <div key={perm.id} className="text-xs text-muted-foreground truncate">
                          • {perm.name}
                        </div>
                      ))}
                      {cat.permissions.length > 3 && (
                        <div className="text-xs text-muted-foreground">
                          +{cat.permissions.length - 3} more...
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-900">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              About Permissions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              Permissions are system-defined capabilities that control access to specific features and actions.
              They are organized into categories for better management and understanding.
            </p>
            <p>
              <strong>Permission Categories:</strong>
            </p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li><strong>Admin:</strong> System administration and configuration</li>
              <li><strong>Purchase Orders:</strong> Managing purchase orders and styles</li>
              <li><strong>Samples:</strong> Sample submission and approval workflows</li>
              <li><strong>Production:</strong> Production tracking and stage management</li>
              <li><strong>Quality:</strong> Quality inspections and AQL calculations</li>
              <li><strong>Shipments:</strong> Shipment tracking and management</li>
              <li><strong>Reports:</strong> Analytics and reporting access</li>
              <li><strong>Invitations:</strong> User invitation management</li>
              <li><strong>Activity Logs:</strong> System activity monitoring</li>
              <li><strong>Factory Assignments:</strong> Factory-PO assignment management</li>
            </ul>
            <p className="pt-2">
              <strong>Note:</strong> Permissions cannot be created or deleted through the interface as they
              are defined by the system architecture. They can only be assigned to roles through the
              Roles Management page.
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
