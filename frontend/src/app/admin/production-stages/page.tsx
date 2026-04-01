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
import { Plus, Search, Edit, Trash2, ArrowUp, ArrowDown, Workflow, AlertCircle } from 'lucide-react';
import api from '@/lib/api';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

interface ProductionStage {
  id: number;
  name: string;
  description: string | null;
  display_order: number;
  weight_percentage: number;
  is_active: boolean;
  tracking_records_count?: number;
  created_at: string;
  updated_at: string;
}

const productionStageSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  description: z.string().optional(),
  display_order: z.number().min(1, 'Display order must be at least 1').max(100),
  weight_percentage: z.number().min(0, 'Weight must be at least 0').max(100, 'Weight cannot exceed 100'),
  is_active: z.boolean(),
});

type ProductionStageFormData = z.infer<typeof productionStageSchema>;

export default function ProductionStagesManagementPage() {
  const { user, can, loading: authLoading } = useAuth();
  const router = useRouter();
  const [stages, setStages] = useState<ProductionStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedStage, setSelectedStage] = useState<ProductionStage | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
  } = useForm<ProductionStageFormData>({
    resolver: zodResolver(productionStageSchema),
    defaultValues: {
      is_active: true,
      display_order: 1,
      weight_percentage: 10,
    },
  });

  const isActive = watch('is_active');

  // Check permissions
  useEffect(() => {
    if (authLoading) return;
    if (!can('admin.configuration.view')) {
      router.push('/dashboard');
    }
  }, [can, router, authLoading]);

  // Fetch production stages
  const fetchStages = async () => {
    try {
      setLoading(true);
      const response = await api.get<{ data: ProductionStage[] }>('/admin/production-stages', {
        params: {
          include: 'tracking_records_count',
        },
      });
      // Sort by display order
      const sorted = response.data.data.sort((a, b) => a.display_order - b.display_order);
      setStages(sorted);
    } catch (error) {
      console.error('Failed to fetch production stages:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    fetchStages();
  }, []);

  // Filter stages based on search
  const filteredStages = stages.filter((stage) =>
    stage.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    stage.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Calculate total weight percentage
  const totalWeightPercentage = stages
    .filter((s) => s.is_active)
    .reduce((sum, s) => sum + s.weight_percentage, 0);

  // Calculate total weight excluding selected stage (for edit validation)
  const getTotalWeightExcludingStage = (stageId: number): number => {
    return stages
      .filter((s) => s.is_active && s.id !== stageId)
      .reduce((sum, s) => sum + s.weight_percentage, 0);
  };

  // Handle create production stage
  const onSubmitCreate = async (data: ProductionStageFormData) => {
    try {
      // Validate total weight
      const newTotal = totalWeightPercentage + (data.is_active ? data.weight_percentage : 0);
      if (newTotal > 100) {
        alert(`Total weight percentage cannot exceed 100%. Current total: ${totalWeightPercentage}%. Adding ${data.weight_percentage}% would result in ${newTotal}%.`);
        return;
      }

      await api.post('/admin/production-stages', data);
      setShowCreateDialog(false);
      reset();
      fetchStages();
    } catch (error) {
      console.error('Failed to create production stage:', error);
    }
  };

  // Handle edit production stage
  const onSubmitEdit = async (data: ProductionStageFormData) => {
    if (!selectedStage) return;

    try {
      // Validate total weight
      const totalExcludingCurrent = getTotalWeightExcludingStage(selectedStage.id);
      const newTotal = totalExcludingCurrent + (data.is_active ? data.weight_percentage : 0);
      if (newTotal > 100) {
        alert(`Total weight percentage cannot exceed 100%. Current total (excluding this stage): ${totalExcludingCurrent}%. Setting this to ${data.weight_percentage}% would result in ${newTotal}%.`);
        return;
      }

      await api.put(`/admin/production-stages/${selectedStage.id}`, data);
      setShowEditDialog(false);
      setSelectedStage(null);
      reset();
      fetchStages();
    } catch (error) {
      console.error('Failed to update production stage:', error);
    }
  };

  // Handle delete production stage
  const handleDelete = async () => {
    if (!selectedStage) return;

    try {
      await api.delete(`/admin/production-stages/${selectedStage.id}`);
      setShowDeleteDialog(false);
      setSelectedStage(null);
      fetchStages();
    } catch (error) {
      console.error('Failed to delete production stage:', error);
    }
  };

  // Handle reorder (move up/down)
  const handleReorder = async (id: number, direction: 'up' | 'down') => {
    try {
      await api.post(`/admin/production-stages/${id}/reorder`, { direction });
      fetchStages();
    } catch (error) {
      console.error('Failed to reorder production stage:', error);
    }
  };

  // Open edit dialog
  const openEditDialog = (stage: ProductionStage) => {
    setSelectedStage(stage);
    setValue('name', stage.name);
    setValue('description', stage.description || '');
    setValue('display_order', stage.display_order);
    setValue('weight_percentage', stage.weight_percentage);
    setValue('is_active', stage.is_active);
    setShowEditDialog(true);
  };

  // Open delete dialog
  const openDeleteDialog = (stage: ProductionStage) => {
    setSelectedStage(stage);
    setShowDeleteDialog(true);
  };

  if (loading) {
    return (
      <DashboardLayout requiredPermissions={['admin.configuration.view']} requireAll={false}>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout requiredPermissions={['admin.configuration.view']} requireAll={false}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Production Stages Management</h1>
            <p className="text-muted-foreground mt-1">
              Configure production stages and weight percentages for progress tracking
            </p>
          </div>
          {can('admin.configuration.edit') && (
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Production Stage
            </Button>
          )}
        </div>

        {/* Weight Percentage Warning */}
        {totalWeightPercentage !== 100 && (
          <Card className="border-orange-200 bg-orange-50 dark:bg-orange-950 dark:border-orange-900">
            <CardContent className="flex items-center gap-3 pt-6">
              <AlertCircle className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              <div>
                <p className="font-medium text-orange-900 dark:text-orange-100">
                  Weight Percentage Warning
                </p>
                <p className="text-sm text-orange-800 dark:text-orange-200">
                  Total weight percentage is {totalWeightPercentage.toFixed(1)}%. It should equal 100% for accurate progress calculations.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Stages</CardTitle>
              <Workflow className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stages.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Stages</CardTitle>
              <Workflow className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stages.filter((s) => s.is_active).length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Weight %</CardTitle>
              <Workflow className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${totalWeightPercentage === 100 ? 'text-green-600' : 'text-orange-600'}`}>
                {totalWeightPercentage.toFixed(1)}%
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Tracking Records</CardTitle>
              <Workflow className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stages.reduce((sum, s) => sum + (s.tracking_records_count || 0), 0)}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <Card>
          <CardHeader>
            <CardTitle>Search Production Stages</CardTitle>
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

        {/* Production Stages Table */}
        <Card>
          <CardHeader>
            <CardTitle>Production Stages</CardTitle>
            <CardDescription>
              Showing {filteredStages.length} of {stages.length} production stages (sorted by display order)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20">Order</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Weight %</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Records</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStages.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No production stages found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredStages.map((stage, index) => (
                    <TableRow key={stage.id}>
                      <TableCell>
                        <Badge variant="secondary">{stage.display_order}</Badge>
                      </TableCell>
                      <TableCell className="font-medium">{stage.name}</TableCell>
                      <TableCell className="max-w-xs truncate">
                        {stage.description || '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">
                            {stage.weight_percentage.toFixed(1)}%
                          </Badge>
                          <div className="w-20 bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-primary h-2 rounded-full"
                              style={{ width: `${stage.weight_percentage}%` }}
                            ></div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={stage.is_active ? 'default' : 'secondary'}>
                          {stage.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">{stage.tracking_records_count || 0}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {can('admin.configuration.edit') && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleReorder(stage.id, 'up')}
                                disabled={index === 0}
                              >
                                <ArrowUp className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleReorder(stage.id, 'down')}
                                disabled={index === filteredStages.length - 1}
                              >
                                <ArrowDown className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openEditDialog(stage)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          {can('admin.configuration.edit') && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openDeleteDialog(stage)}
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
            <CardTitle>Production Workflow Visualization</CardTitle>
            <CardDescription>
              Visual representation of production stages and their weight distribution
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {/* Overall Progress Bar */}
              <div className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Total Weight Distribution</span>
                  <span className={`text-sm font-bold ${totalWeightPercentage === 100 ? 'text-green-600' : 'text-orange-600'}`}>
                    {totalWeightPercentage.toFixed(1)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-8 flex overflow-hidden">
                  {stages
                    .filter((s) => s.is_active)
                    .map((stage) => (
                      <div
                        key={stage.id}
                        className="h-8 flex items-center justify-center text-xs font-medium text-white"
                        style={{
                          width: `${stage.weight_percentage}%`,
                          backgroundColor: `hsl(${(stage.display_order * 360) / stages.length}, 70%, 50%)`,
                        }}
                        title={`${stage.name}: ${stage.weight_percentage}%`}
                      >
                        {stage.weight_percentage >= 5 && stage.weight_percentage.toFixed(0)}
                      </div>
                    ))}
                </div>
              </div>

              {/* Stage Cards */}
              {stages
                .filter((s) => s.is_active)
                .map((stage, index) => (
                  <div
                    key={stage.id}
                    className="flex items-center gap-3 p-4 border rounded-lg bg-muted/50"
                  >
                    <Badge variant="secondary" className="text-lg px-3 py-1">
                      {stage.display_order}
                    </Badge>
                    <div className="flex-1">
                      <div className="font-medium">{stage.name}</div>
                      {stage.description && (
                        <div className="text-sm text-muted-foreground">{stage.description}</div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-sm">
                        {stage.weight_percentage.toFixed(1)}%
                      </Badge>
                      <div className="w-24 bg-gray-200 rounded-full h-3">
                        <div
                          className="bg-primary h-3 rounded-full"
                          style={{ width: `${stage.weight_percentage}%` }}
                        ></div>
                      </div>
                    </div>
                    {index < stages.filter((s) => s.is_active).length - 1 && (
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
              <Workflow className="h-5 w-5" />
              About Production Stages
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              Production stages define the manufacturing workflow and enable weighted progress tracking
              across the entire production lifecycle.
            </p>
            <p>
              <strong>Display Order:</strong> Determines the sequence in which stages are completed.
              Lower numbers represent earlier stages in the production process.
            </p>
            <p>
              <strong>Weight Percentage:</strong> The relative importance of each stage in calculating
              overall production progress. The total weight of all active stages must equal 100%.
            </p>
            <p>
              <strong>Progress Calculation:</strong>
            </p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Overall Progress = Σ(Stage Completion × Stage Weight) for all stages</li>
              <li>Example: If Cutting (20% weight) is 50% complete: 50% × 20% = 10% contribution</li>
              <li>Sum all stage contributions to get total production progress</li>
            </ul>
            <p>
              <strong>Common Production Stages:</strong>
            </p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li><strong>Fabric Preparation:</strong> 10-15% (Cutting, Inspection)</li>
              <li><strong>Sewing:</strong> 30-40% (Assembly, Stitching)</li>
              <li><strong>Finishing:</strong> 20-25% (Pressing, Trimming)</li>
              <li><strong>Quality Control:</strong> 10-15% (Inspection, Testing)</li>
              <li><strong>Packing:</strong> 10-15% (Folding, Boxing, Labeling)</li>
            </ul>
          </CardContent>
        </Card>

        {/* Create Production Stage Dialog */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New Production Stage</DialogTitle>
              <DialogDescription>
                Add a new production stage to the workflow
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmitCreate)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  {...register('name')}
                  placeholder="e.g., Cutting & Preparation"
                />
                {errors.name && (
                  <p className="text-sm text-red-500">{errors.name.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input
                  id="description"
                  {...register('description')}
                  placeholder="Brief description of this production stage..."
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
                  <Label htmlFor="weight_percentage">Weight Percentage *</Label>
                  <Input
                    id="weight_percentage"
                    type="number"
                    step="0.1"
                    {...register('weight_percentage', { valueAsNumber: true })}
                    min={0}
                    max={100}
                  />
                  {errors.weight_percentage && (
                    <p className="text-sm text-red-500">{errors.weight_percentage.message}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Current total: {totalWeightPercentage.toFixed(1)}%
                  </p>
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
                  Only active production stages are available for tracking
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
                <Button type="submit">Create Production Stage</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Edit Production Stage Dialog */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Production Stage</DialogTitle>
              <DialogDescription>
                Update production stage configuration
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmitEdit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Name *</Label>
                <Input
                  id="edit-name"
                  {...register('name')}
                  placeholder="e.g., Cutting & Preparation"
                />
                {errors.name && (
                  <p className="text-sm text-red-500">{errors.name.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-description">Description</Label>
                <Input
                  id="edit-description"
                  {...register('description')}
                  placeholder="Brief description of this production stage..."
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
                  <Label htmlFor="edit-weight-percentage">Weight Percentage *</Label>
                  <Input
                    id="edit-weight-percentage"
                    type="number"
                    step="0.1"
                    {...register('weight_percentage', { valueAsNumber: true })}
                    min={0}
                    max={100}
                  />
                  {errors.weight_percentage && (
                    <p className="text-sm text-red-500">{errors.weight_percentage.message}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Current total (excluding this): {selectedStage ? getTotalWeightExcludingStage(selectedStage.id).toFixed(1) : '0'}%
                  </p>
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
                  Only active production stages are available for tracking
                </p>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowEditDialog(false);
                    setSelectedStage(null);
                    reset();
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit">Update Production Stage</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Production Stage</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this production stage? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            {selectedStage && (
              <div className="py-4">
                <p className="text-sm">
                  <span className="font-medium">Name:</span> {selectedStage.name}
                </p>
                <p className="text-sm">
                  <span className="font-medium">Display Order:</span> {selectedStage.display_order}
                </p>
                <p className="text-sm">
                  <span className="font-medium">Weight:</span> {selectedStage.weight_percentage}%
                </p>
                <p className="text-sm">
                  <span className="font-medium">Tracking Records:</span> {selectedStage.tracking_records_count || 0}
                </p>
                {(selectedStage.tracking_records_count || 0) > 0 && (
                  <p className="text-sm text-orange-600 mt-2">
                    Warning: This stage has {selectedStage.tracking_records_count} tracking records associated with it
                  </p>
                )}
              </div>
            )}
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowDeleteDialog(false);
                  setSelectedStage(null);
                }}
              >
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDelete}>
                Delete Production Stage
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
