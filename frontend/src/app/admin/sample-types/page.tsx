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
import { Plus, Search, Edit, Trash2, ArrowUp, ArrowDown, Layers, Check } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import api from '@/lib/api';
import { ListPageSkeleton } from '@/components/skeletons';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

interface SampleType {
  id: number;
  name: string;
  display_name: string;
  description: string | null;
  display_order: number;
  prerequisites: string[] | null;
  parallel_submission_allowed?: boolean;
  is_active: boolean;
  samples_count?: number;
  created_at: string;
  updated_at: string;
}

const sampleTypeSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  display_name: z.string().min(1, 'Display name is required').max(100),
  description: z.string().optional(),
  display_order: z.number().min(1, 'Display order must be at least 1').max(100),
  prerequisites: z.array(z.string()).nullable().optional(),
  parallel_submission_allowed: z.boolean().optional(),
  is_active: z.boolean(),
});

type SampleTypeFormData = z.infer<typeof sampleTypeSchema>;

export default function SampleTypesManagementPage() {
  const { user, can, loading: authLoading } = useAuth();
  const router = useRouter();
  const [sampleTypes, setSampleTypes] = useState<SampleType[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedSampleType, setSelectedSampleType] = useState<SampleType | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
  } = useForm<SampleTypeFormData>({
    resolver: zodResolver(sampleTypeSchema),
    defaultValues: {
      is_active: true,
      display_order: 1,
      prerequisites: null,
      parallel_submission_allowed: false,
    },
  });

  const isActive = watch('is_active');
  const prerequisites = watch('prerequisites');
  const [selectedPrerequisites, setSelectedPrerequisites] = useState<string[]>([]);

  // Check permissions
  useEffect(() => {
    if (authLoading) return;
    if (!can('admin.configuration.view')) {
      router.push('/dashboard');
    }
  }, [can, router, authLoading]);

  // Fetch sample types
  const fetchSampleTypes = async () => {
    try {
      setLoading(true);
      const response = await api.get<{ data: SampleType[] }>('/admin/sample-types');
      // Sort by display order
      const sorted = response.data.data.sort((a, b) => a.display_order - b.display_order);
      setSampleTypes(sorted);
    } catch (error) {
      console.error('Failed to fetch sample types:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    fetchSampleTypes();
  }, []);

  // Filter sample types based on search
  const filteredSampleTypes = sampleTypes.filter((type) =>
    type.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    type.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Handle create sample type
  const onSubmitCreate = async (data: SampleTypeFormData) => {
    try {
      await api.post('/admin/sample-types', {
        ...data,
        prerequisites: selectedPrerequisites.length > 0 ? selectedPrerequisites : null,
      });
      setShowCreateDialog(false);
      reset();
      setSelectedPrerequisites([]);
      fetchSampleTypes();
    } catch (error) {
      console.error('Failed to create sample type:', error);
    }
  };

  // Handle edit sample type
  const onSubmitEdit = async (data: SampleTypeFormData) => {
    if (!selectedSampleType) return;

    try {
      await api.put(`/admin/sample-types/${selectedSampleType.id}`, {
        ...data,
        prerequisites: selectedPrerequisites.length > 0 ? selectedPrerequisites : null,
      });
      setShowEditDialog(false);
      setSelectedSampleType(null);
      reset();
      setSelectedPrerequisites([]);
      fetchSampleTypes();
    } catch (error) {
      console.error('Failed to update sample type:', error);
    }
  };

  // Handle delete sample type
  const handleDelete = async () => {
    if (!selectedSampleType) return;

    try {
      await api.delete(`/admin/sample-types/${selectedSampleType.id}`);
      setShowDeleteDialog(false);
      setSelectedSampleType(null);
      fetchSampleTypes();
    } catch (error) {
      console.error('Failed to delete sample type:', error);
    }
  };

  // Handle reorder (move up/down)
  const handleReorder = async (id: number, direction: 'up' | 'down') => {
    try {
      await api.post(`/admin/sample-types/${id}/reorder`, { direction });
      fetchSampleTypes();
    } catch (error) {
      console.error('Failed to reorder sample type:', error);
    }
  };

  // Open edit dialog
  const openEditDialog = (sampleType: SampleType) => {
    setSelectedSampleType(sampleType);
    setValue('name', sampleType.name);
    setValue('display_name', sampleType.display_name);
    setValue('description', sampleType.description || '');
    setValue('display_order', sampleType.display_order);
    setValue('prerequisites', sampleType.prerequisites);
    setValue('parallel_submission_allowed', sampleType.parallel_submission_allowed || false);
    setValue('is_active', sampleType.is_active);
    setSelectedPrerequisites(sampleType.prerequisites || []);
    setShowEditDialog(true);
  };

  // Open delete dialog
  const openDeleteDialog = (sampleType: SampleType) => {
    setSelectedSampleType(sampleType);
    setShowDeleteDialog(true);
  };

  // Get available prerequisite options (exclude self)
  const getPrerequisiteOptions = (): SampleType[] => {
    return sampleTypes.filter(
      (type) =>
        type.id !== selectedSampleType?.id && // Exclude self when editing
        type.is_active // Only active types
    );
  };

  // Toggle prerequisite selection
  const togglePrerequisite = (typeName: string) => {
    setSelectedPrerequisites(prev =>
      prev.includes(typeName)
        ? prev.filter(name => name !== typeName)
        : [...prev, typeName]
    );
  };

  if (loading) {
    return (
      <DashboardLayout requiredPermissions={['admin.configuration.view']} requireAll={false}>
        <ListPageSkeleton statCards={4} filterCount={1} columns={7} rows={5} />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout requiredPermissions={['admin.configuration.view']} requireAll={false}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Sample Types Management</h1>
            <p className="text-muted-foreground mt-1">
              Configure sample types and workflow prerequisites
            </p>
          </div>
          {can('admin.configuration.edit') && (
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Sample Type
            </Button>
          )}
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Sample Types</CardTitle>
              <Layers className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{sampleTypes.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Types</CardTitle>
              <Layers className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {sampleTypes.filter((t) => t.is_active).length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">With Prerequisites</CardTitle>
              <Layers className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {sampleTypes.filter((t) => t.prerequisites && t.prerequisites.length > 0).length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Samples</CardTitle>
              <Layers className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {sampleTypes.reduce((sum, t) => sum + (t.samples_count || 0), 0)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <Card>
          <CardHeader>
            <CardTitle>Search Sample Types</CardTitle>
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

        {/* Sample Types Table */}
        <Card>
          <CardHeader>
            <CardTitle>Sample Types</CardTitle>
            <CardDescription>
              Showing {filteredSampleTypes.length} of {sampleTypes.length} sample types (sorted by display order)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">Order</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Prerequisite</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Samples</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSampleTypes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No sample types found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredSampleTypes.map((type, index) => (
                    <TableRow key={type.id}>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Badge variant="secondary">{type.display_order}</Badge>
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{type.name}</TableCell>
                      <TableCell className="max-w-xs truncate">
                        {type.description || '-'}
                      </TableCell>
                      <TableCell>
                        {type.prerequisites && type.prerequisites.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {type.prerequisites.map((prereqName, idx) => (
                              <Badge key={idx} variant="outline" className="text-xs">
                                {prereqName}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">None</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={type.is_active ? 'default' : 'secondary'}>
                          {type.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{type.samples_count || 0}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {can('admin.configuration.edit') && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleReorder(type.id, 'up')}
                                disabled={index === 0}
                              >
                                <ArrowUp className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleReorder(type.id, 'down')}
                                disabled={index === filteredSampleTypes.length - 1}
                              >
                                <ArrowDown className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openEditDialog(type)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          {can('admin.configuration.edit') && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openDeleteDialog(type)}
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

        {/* Workflow Visualization */}
        <Card>
          <CardHeader>
            <CardTitle>Sample Workflow Visualization</CardTitle>
            <CardDescription>
              Visual representation of sample approval sequence and prerequisites
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {sampleTypes
                .filter((t) => t.is_active)
                .map((type, index) => (
                  <div
                    key={type.id}
                    className="flex items-center gap-3 p-4 border rounded-lg bg-muted/50"
                  >
                    <Badge variant="secondary" className="text-lg px-3 py-1">
                      {type.display_order}
                    </Badge>
                    <div className="flex-1">
                      <div className="font-medium">{type.name}</div>
                      {type.description && (
                        <div className="text-sm text-muted-foreground">{type.description}</div>
                      )}
                    </div>
                    {type.prerequisites && type.prerequisites.length > 0 && (
                      <div className="text-sm text-muted-foreground">
                        Requires:{' '}
                        <div className="inline-flex flex-wrap gap-1 ml-1">
                          {type.prerequisites.map((prereqName, idx) => (
                            <Badge key={idx} variant="outline">
                              {prereqName}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    {index < sampleTypes.filter((t) => t.is_active).length - 1 && (
                      <div className="text-muted-foreground">→</div>
                    )}
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-900">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5" />
              About Sample Types
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              Sample types define the approval workflow for purchase orders. Each sample type represents
              a stage in the sample approval process.
            </p>
            <p>
              <strong>Display Order:</strong> Determines the sequence in which samples are submitted.
              Lower numbers come first in the workflow.
            </p>
            <p>
              <strong>Prerequisites:</strong> Sample types can require approval of a previous sample type
              before submission. This enforces sequential approval workflows.
            </p>
            <p>
              <strong>Parallel vs Sequential:</strong>
            </p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Sample types without prerequisites can be submitted in parallel</li>
              <li>Sample types with prerequisites must wait for the prerequisite to be approved</li>
              <li>Typically, the first 5 samples (Proto, Fit, Pre-Production, Size Set, Photo) can be parallel</li>
              <li>Later samples (Shipment, Color, Production, Bulk, Final) usually require prerequisites</li>
            </ul>
          </CardContent>
        </Card>

        {/* Create Sample Type Dialog */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New Sample Type</DialogTitle>
              <DialogDescription>
                Add a new sample type to the workflow
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmitCreate)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  {...register('name')}
                  placeholder="e.g., proto_sample"
                />
                {errors.name && (
                  <p className="text-sm text-red-500">{errors.name.message}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Internal name (lowercase, underscores allowed)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="display_name">Display Name *</Label>
                <Input
                  id="display_name"
                  {...register('display_name')}
                  placeholder="e.g., Prototype Sample"
                />
                {errors.display_name && (
                  <p className="text-sm text-red-500">{errors.display_name.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  {...register('description')}
                  placeholder="Brief description of this sample type..."
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="display_order">Display Order *</Label>
                  <Input
                    id="display_order"
                    type="number"
                    {...register('display_order', { valueAsNumber: true })}
                    min={1}
                    max={100}
                  />
                  {errors.display_order && (
                    <p className="text-sm text-red-500">{errors.display_order.message}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Lower numbers appear first in the workflow
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Prerequisites</Label>
                  <div className="border rounded-md p-3 max-h-40 overflow-y-auto space-y-2">
                    {getPrerequisiteOptions().length > 0 ? (
                      getPrerequisiteOptions().map((type) => (
                        <div key={type.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`prereq-create-${type.id}`}
                            checked={selectedPrerequisites.includes(type.name)}
                            onCheckedChange={() => togglePrerequisite(type.name)}
                          />
                          <label
                            htmlFor={`prereq-create-${type.id}`}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                          >
                            {type.display_name} ({type.name})
                          </label>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">No other sample types available</p>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Selected types must be approved before this can be submitted
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="parallel_submission"
                    {...register('parallel_submission_allowed')}
                  />
                  <label
                    htmlFor="parallel_submission"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Allow parallel submission (ignore prerequisites)
                  </label>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setValue('is_active', e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  Active
                </Label>
                <p className="text-xs text-muted-foreground">
                  Only active sample types are available for selection
                </p>
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
                <Button type="submit">Create Sample Type</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Edit Sample Type Dialog */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Sample Type</DialogTitle>
              <DialogDescription>
                Update sample type configuration
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmitEdit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Name *</Label>
                <Input
                  id="edit-name"
                  {...register('name')}
                  placeholder="e.g., proto_sample"
                />
                {errors.name && (
                  <p className="text-sm text-red-500">{errors.name.message}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Internal name (lowercase, underscores allowed)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-display-name">Display Name *</Label>
                <Input
                  id="edit-display-name"
                  {...register('display_name')}
                  placeholder="e.g., Prototype Sample"
                />
                {errors.display_name && (
                  <p className="text-sm text-red-500">{errors.display_name.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-description">Description</Label>
                <Input
                  id="edit-description"
                  {...register('description')}
                  placeholder="Brief description of this sample type..."
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="edit-display-order">Display Order *</Label>
                  <Input
                    id="edit-display-order"
                    type="number"
                    {...register('display_order', { valueAsNumber: true })}
                    min={1}
                    max={100}
                  />
                  {errors.display_order && (
                    <p className="text-sm text-red-500">{errors.display_order.message}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Lower numbers appear first in the workflow
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>Prerequisites</Label>
                  <div className="border rounded-md p-3 max-h-40 overflow-y-auto space-y-2">
                    {getPrerequisiteOptions().length > 0 ? (
                      getPrerequisiteOptions().map((type) => (
                        <div key={type.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`prereq-edit-${type.id}`}
                            checked={selectedPrerequisites.includes(type.name)}
                            onCheckedChange={() => togglePrerequisite(type.name)}
                          />
                          <label
                            htmlFor={`prereq-edit-${type.id}`}
                            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                          >
                            {type.display_name} ({type.name})
                          </label>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">No other sample types available</p>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Selected types must be approved before this can be submitted
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="edit-parallel_submission"
                    {...register('parallel_submission_allowed')}
                  />
                  <label
                    htmlFor="edit-parallel_submission"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Allow parallel submission (ignore prerequisites)
                  </label>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setValue('is_active', e.target.checked)}
                    className="rounded border-gray-300"
                  />
                  Active
                </Label>
                <p className="text-xs text-muted-foreground">
                  Only active sample types are available for selection
                </p>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowEditDialog(false);
                    setSelectedSampleType(null);
                    reset();
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit">Update Sample Type</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Sample Type</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this sample type? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            {selectedSampleType && (
              <div className="py-4">
                <p className="text-sm">
                  <span className="font-medium">Name:</span> {selectedSampleType.name}
                </p>
                <p className="text-sm">
                  <span className="font-medium">Display Order:</span> {selectedSampleType.display_order}
                </p>
                <p className="text-sm">
                  <span className="font-medium">Samples:</span> {selectedSampleType.samples_count || 0}
                </p>
                {(selectedSampleType.samples_count || 0) > 0 && (
                  <p className="text-sm text-orange-600 mt-2">
                    Warning: This sample type has {selectedSampleType.samples_count} samples associated with it
                  </p>
                )}
              </div>
            )}
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowDeleteDialog(false);
                  setSelectedSampleType(null);
                }}
              >
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDelete}>
                Delete Sample Type
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
