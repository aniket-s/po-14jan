'use client';

import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Plus,
  Loader2,
  Edit,
  Trash2,
  CheckCircle2,
  XCircle,
  ArrowUp,
  ArrowDown,
  Workflow,
} from 'lucide-react';
import api from '@/lib/api';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

interface Status {
  id: number;
  name: string;
  type: string;
  color: string;
  display_order: number;
  is_active: boolean;
  description?: string;
  created_at: string;
  updated_at: string;
}

const statusSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  type: z.string().min(1, 'Type is required'),
  color: z.string().min(1, 'Color is required'),
  description: z.string().optional(),
});

type StatusFormData = z.infer<typeof statusSchema>;

export default function StatusManagementPage() {
  const [statuses, setStatuses] = useState<Status[]>([]);
  const [types, setTypes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<Status | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<StatusFormData>({
    resolver: zodResolver(statusSchema),
  });

  useEffect(() => {
    fetchStatuses();
    fetchTypes();
  }, []);

  const fetchStatuses = async () => {
    try {
      setLoading(true);
      const response = await api.get<any>('/admin/statuses');
      // API returns {statuses: [...], all_statuses: [...]}
      // Use all_statuses for the flat array
      setStatuses(response.data.all_statuses || []);
    } catch (error) {
      console.error('Failed to fetch statuses:', error);
      setStatuses([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchTypes = async () => {
    try {
      const response = await api.get<any>('/admin/statuses/types/all');
      // API returns {types: [{value, label, count}, ...]}
      // Extract just the values for the dropdown
      const typeValues = response.data.types?.map((t: any) => t.value) || [];
      setTypes(typeValues);
    } catch (error) {
      console.error('Failed to fetch types:', error);
      setTypes([]);
    }
  };

  const handleCreate = async (data: StatusFormData) => {
    try {
      setSubmitting(true);
      await api.post('/admin/statuses', data);
      await fetchStatuses();
      setIsCreateDialogOpen(false);
      form.reset();
    } catch (error) {
      console.error('Failed to create status:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async (data: StatusFormData) => {
    if (!selectedStatus) return;
    try {
      setSubmitting(true);
      await api.put(`/admin/statuses/${selectedStatus.id}`, data);
      await fetchStatuses();
      setIsEditDialogOpen(false);
      setSelectedStatus(null);
      form.reset();
    } catch (error) {
      console.error('Failed to update status:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedStatus) return;
    try {
      setSubmitting(true);
      await api.delete(`/admin/statuses/${selectedStatus.id}`);
      await fetchStatuses();
      setIsDeleteDialogOpen(false);
      setSelectedStatus(null);
    } catch (error) {
      console.error('Failed to delete status:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (status: Status) => {
    try {
      await api.post(`/admin/statuses/${status.id}/toggle-active`);
      await fetchStatuses();
    } catch (error) {
      console.error('Failed to toggle status:', error);
    }
  };

  const handleReorder = async (type: string, statusId: number, direction: 'up' | 'down') => {
    const typeStatuses = statuses
      .filter((s) => s.type === type)
      .sort((a, b) => a.display_order - b.display_order);

    const currentIndex = typeStatuses.findIndex((s) => s.id === statusId);
    if (currentIndex === -1) return;

    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= typeStatuses.length) return;

    // Swap display orders
    const newOrder = typeStatuses.map((status, index) => {
      if (index === currentIndex) {
        return { id: status.id, display_order: typeStatuses[newIndex].display_order };
      } else if (index === newIndex) {
        return { id: status.id, display_order: typeStatuses[currentIndex].display_order };
      }
      return { id: status.id, display_order: status.display_order };
    });

    try {
      await api.post('/admin/statuses/reorder', {
        statuses: newOrder,
      });
      await fetchStatuses();
    } catch (error) {
      console.error('Failed to reorder statuses:', error);
    }
  };

  const openEditDialog = (status: Status) => {
    setSelectedStatus(status);
    form.reset({
      name: status.name,
      type: status.type,
      color: status.color,
      description: status.description || '',
    });
    setIsEditDialogOpen(true);
  };

  const openDeleteDialog = (status: Status) => {
    setSelectedStatus(status);
    setIsDeleteDialogOpen(true);
  };

  const filteredStatuses = statuses.filter((status) => {
    return typeFilter === 'all' || status.type === typeFilter;
  });

  const getStatusesByType = (type: string) => {
    return statuses
      .filter((s) => s.type === type)
      .sort((a, b) => a.display_order - b.display_order);
  };

  const getTypeIcon = (type: string) => {
    const icons: Record<string, string> = {
      purchase_orders: '🛒',
      samples: '📦',
      production: '🏭',
      quality_inspections: '🔍',
      shipments: '🚚',
    };
    return icons[type] || '📋';
  };

  const colorOptions = [
    { value: 'gray', label: 'Gray', class: 'bg-gray-100 text-gray-800' },
    { value: 'blue', label: 'Blue', class: 'bg-blue-100 text-blue-800' },
    { value: 'green', label: 'Green', class: 'bg-green-100 text-green-800' },
    { value: 'yellow', label: 'Yellow', class: 'bg-yellow-100 text-yellow-800' },
    { value: 'orange', label: 'Orange', class: 'bg-orange-100 text-orange-800' },
    { value: 'red', label: 'Red', class: 'bg-red-100 text-red-800' },
    { value: 'purple', label: 'Purple', class: 'bg-purple-100 text-purple-800' },
    { value: 'pink', label: 'Pink', class: 'bg-pink-100 text-pink-800' },
  ];

  const getColorClass = (color: string) => {
    const option = colorOptions.find((o) => o.value === color);
    return option?.class || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <DashboardLayout
        requiredPermissions={['admin.statuses.view', 'admin.statuses.manage']}
        requireAll={false}
      >
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      requiredPermissions={['admin.statuses.view', 'admin.statuses.manage']}
      requireAll={false}
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Status Management</h1>
            <p className="text-muted-foreground mt-1">
              Manage workflow statuses for different modules
            </p>
          </div>
          <Button onClick={() => setIsCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Status
          </Button>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Statuses</CardTitle>
              <Workflow className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{statuses.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {statuses.filter((s) => s.is_active).length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Inactive</CardTitle>
              <XCircle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {statuses.filter((s) => !s.is_active).length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Status Types</CardTitle>
              <Workflow className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{types.length}</div>
            </CardContent>
          </Card>
        </div>

        {/* Status Types Tabs */}
        <Tabs defaultValue={types[0] || 'all'} className="w-full">
          <TabsList className="grid w-full" style={{ gridTemplateColumns: `repeat(${Math.min(types.length, 5)}, 1fr)` }}>
            {types.map((type) => (
              <TabsTrigger key={type} value={type}>
                {getTypeIcon(type)} {type.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
              </TabsTrigger>
            ))}
          </TabsList>

          {types.map((type) => {
            const typeStatuses = getStatusesByType(type);
            return (
              <TabsContent key={type} value={type} className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>{type.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())} Statuses</CardTitle>
                    <CardDescription>
                      Manage workflow statuses for {type.replace(/_/g, ' ')}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">Order</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Color</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {typeStatuses.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center text-muted-foreground">
                              No statuses defined for this type
                            </TableCell>
                          </TableRow>
                        ) : (
                          typeStatuses.map((status, index) => (
                            <TableRow key={status.id}>
                              <TableCell>
                                <div className="flex gap-1">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleReorder(type, status.id, 'up')}
                                    disabled={index === 0}
                                  >
                                    <ArrowUp className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleReorder(type, status.id, 'down')}
                                    disabled={index === typeStatuses.length - 1}
                                  >
                                    <ArrowDown className="h-3 w-3" />
                                  </Button>
                                </div>
                              </TableCell>
                              <TableCell className="font-medium">{status.name}</TableCell>
                              <TableCell>
                                <Badge className={getColorClass(status.color)}>
                                  {status.color}
                                </Badge>
                              </TableCell>
                              <TableCell className="max-w-xs truncate">
                                {status.description || '-'}
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleToggleActive(status)}
                                >
                                  {status.is_active ? (
                                    <Badge className="bg-green-100 text-green-800">Active</Badge>
                                  ) : (
                                    <Badge variant="secondary">Inactive</Badge>
                                  )}
                                </Button>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-2">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => openEditDialog(status)}
                                    title="Edit"
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => openDeleteDialog(status)}
                                    title="Delete"
                                  >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>
            );
          })}
        </Tabs>

        {/* Create Dialog */}
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create Status</DialogTitle>
              <DialogDescription>
                Create a new workflow status
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={form.handleSubmit(handleCreate)} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Status Name</Label>
                  <Input
                    id="name"
                    {...form.register('name')}
                    placeholder="e.g., In Progress"
                  />
                  {form.formState.errors.name && (
                    <p className="text-sm text-destructive">
                      {form.formState.errors.name.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="type">Status Type</Label>
                  <Select
                    value={form.watch('type')}
                    onValueChange={(value) => form.setValue('type', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {types.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {form.formState.errors.type && (
                    <p className="text-sm text-destructive">
                      {form.formState.errors.type.message}
                    </p>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="color">Color</Label>
                <Select
                  value={form.watch('color')}
                  onValueChange={(value) => form.setValue('color', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select color" />
                  </SelectTrigger>
                  <SelectContent>
                    {colorOptions.map((color) => (
                      <SelectItem key={color.value} value={color.value}>
                        <div className="flex items-center gap-2">
                          <div className={`w-4 h-4 rounded ${color.class}`} />
                          {color.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.color && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.color.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description (Optional)</Label>
                <Input
                  id="description"
                  {...form.register('description')}
                  placeholder="Brief description of this status"
                />
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create Status
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Edit Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Status</DialogTitle>
              <DialogDescription>
                Update the status configuration
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={form.handleSubmit(handleEdit)} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="edit-name">Status Name</Label>
                  <Input id="edit-name" {...form.register('name')} />
                  {form.formState.errors.name && (
                    <p className="text-sm text-destructive">
                      {form.formState.errors.name.message}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-type">Status Type</Label>
                  <Select
                    value={form.watch('type')}
                    onValueChange={(value) => form.setValue('type', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {types.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {form.formState.errors.type && (
                    <p className="text-sm text-destructive">
                      {form.formState.errors.type.message}
                    </p>
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-color">Color</Label>
                <Select
                  value={form.watch('color')}
                  onValueChange={(value) => form.setValue('color', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {colorOptions.map((color) => (
                      <SelectItem key={color.value} value={color.value}>
                        <div className="flex items-center gap-2">
                          <div className={`w-4 h-4 rounded ${color.class}`} />
                          {color.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.color && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.color.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-description">Description (Optional)</Label>
                <Input id="edit-description" {...form.register('description')} />
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Update Status
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Delete Dialog */}
        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete the status "{selectedStatus?.name}".
                This action cannot be undone. Make sure no records are using this status.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={submitting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Delete Status
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </DashboardLayout>
  );
}
