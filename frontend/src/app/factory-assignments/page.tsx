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
import { Plus, Search, Edit, Trash2, Factory, ShoppingCart, Calendar } from 'lucide-react';
import api from '@/lib/api';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

interface FactoryAssignment {
  id: number;
  purchase_order_id: number;
  factory_id: number;
  assigned_date: string;
  expected_completion_date: string | null;
  actual_completion_date: string | null;
  status: string;
  notes: string | null;
  purchase_order: {
    id: number;
    po_number: string;
    buyer_name: string | null;
  };
  factory: {
    id: number;
    name: string;
    email: string;
  };
  created_at: string;
  updated_at: string;
}

interface PurchaseOrder {
  id: number;
  po_number: string;
  buyer_name: string | null;
}

interface Factory {
  id: number;
  name: string;
  email: string;
  company_name: string | null;
  phone: string | null;
  country: string | null;
}

interface PaginatedAssignments {
  data: FactoryAssignment[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

const assignmentSchema = z.object({
  purchase_order_id: z.number().min(1, 'Purchase order is required'),
  factory_id: z.number().min(1, 'Factory is required'),
  assigned_date: z.string().min(1, 'Assigned date is required'),
  expected_completion_date: z.string().optional(),
  status: z.string().min(1, 'Status is required'),
  notes: z.string().optional(),
});

type AssignmentFormData = z.infer<typeof assignmentSchema>;

export default function FactoryAssignmentsPage() {
  const { user, can, loading: authLoading } = useAuth();
  const router = useRouter();
  const [assignments, setAssignments] = useState<FactoryAssignment[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [factories, setFactories] = useState<Factory[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    lastPage: 1,
    perPage: 15,
    total: 0,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<FactoryAssignment | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
  } = useForm<AssignmentFormData>({
    resolver: zodResolver(assignmentSchema),
    defaultValues: {
      status: 'assigned',
    },
  });

  const selectedPOId = watch('purchase_order_id');
  const selectedFactoryId = watch('factory_id');

  // Check permissions
  useEffect(() => {
    if (authLoading) return;
    if (!can('po.assign_factory') && !can('style.assign_factory')) {
      router.push('/dashboard');
    }
  }, [can, router, authLoading]);

  // Fetch factory assignments
  const fetchAssignments = async () => {
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

      const response = await api.get<PaginatedAssignments>('/factory-assignments', { params });
      setAssignments(response.data.data || []);
      setPagination({
        currentPage: response.data.current_page || 1,
        lastPage: response.data.last_page || 1,
        perPage: response.data.per_page || 15,
        total: response.data.total || 0,
      });
    } catch (error) {
      console.error('Failed to fetch factory assignments:', error);
      setAssignments([]);
      setPagination({
        currentPage: 1,
        lastPage: 1,
        perPage: 15,
        total: 0,
      });
    } finally {
      setLoading(false);
    }
  };

  // Fetch purchase orders for dropdown
  const fetchPurchaseOrders = async () => {
    try {
      const response = await api.get<{ data: PurchaseOrder[] }>('/purchase-orders', {
        params: { per_page: 100 },
      });
      setPurchaseOrders(response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch purchase orders:', error);
      setPurchaseOrders([]);
    }
  };

  // Fetch factories for dropdown
  const fetchFactories = async () => {
    try {
      const response = await api.get<{ data: Factory[] }>('/factories', {
        params: { per_page: 100 },
      });
      setFactories(response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch factories:', error);
      setFactories([]);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    fetchAssignments();
  }, [pagination.currentPage, searchQuery, statusFilter]);

  useEffect(() => {
    if (authLoading) return;
    if (can('po.assign_factory')) {
      fetchPurchaseOrders();
      fetchFactories();
    }
  }, [can]);

  // Handle create assignment
  const onSubmitCreate = async (data: AssignmentFormData) => {
    try {
      await api.post('/factory-assignments', {
        ...data,
        expected_completion_date: data.expected_completion_date || null,
        notes: data.notes || null,
      });
      setShowCreateDialog(false);
      reset();
      fetchAssignments();
    } catch (error) {
      console.error('Failed to create factory assignment:', error);
    }
  };

  // Handle edit assignment
  const onSubmitEdit = async (data: AssignmentFormData) => {
    if (!selectedAssignment) return;

    try {
      await api.put(`/factory-assignments/${selectedAssignment.id}`, {
        ...data,
        expected_completion_date: data.expected_completion_date || null,
        notes: data.notes || null,
      });
      setShowEditDialog(false);
      setSelectedAssignment(null);
      reset();
      fetchAssignments();
    } catch (error) {
      console.error('Failed to update factory assignment:', error);
    }
  };

  // Handle delete assignment
  const handleDelete = async () => {
    if (!selectedAssignment) return;

    try {
      await api.delete(`/factory-assignments/${selectedAssignment.id}`);
      setShowDeleteDialog(false);
      setSelectedAssignment(null);
      fetchAssignments();
    } catch (error) {
      console.error('Failed to delete factory assignment:', error);
    }
  };

  // Open edit dialog
  const openEditDialog = (assignment: FactoryAssignment) => {
    setSelectedAssignment(assignment);
    setValue('purchase_order_id', assignment.purchase_order_id);
    setValue('factory_id', assignment.factory_id);
    setValue('assigned_date', assignment.assigned_date.split('T')[0]);
    setValue('expected_completion_date', assignment.expected_completion_date?.split('T')[0] || '');
    setValue('status', assignment.status);
    setValue('notes', assignment.notes || '');
    setShowEditDialog(true);
  };

  // Open delete dialog
  const openDeleteDialog = (assignment: FactoryAssignment) => {
    setSelectedAssignment(assignment);
    setShowDeleteDialog(true);
  };

  // Get status badge variant
  const getStatusVariant = (status: string): 'default' | 'secondary' | 'outline' => {
    switch (status.toLowerCase()) {
      case 'completed':
        return 'default';
      case 'in_progress':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (loading && assignments.length === 0) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Factory Assignments</h1>
            <p className="text-muted-foreground mt-1">
              Manage factory assignments for purchase orders
            </p>
          </div>
          {can('po.assign_factory') && (
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Assign Factory
            </Button>
          )}
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Assignments</CardTitle>
              <Factory className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pagination.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">In Progress</CardTitle>
              <Factory className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {assignments.filter((a) => a.status === 'in_progress').length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completed</CardTitle>
              <Factory className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {assignments.filter((a) => a.status === 'completed').length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Factories</CardTitle>
              <Factory className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {new Set(assignments.map((a) => a.factory_id)).size}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Search</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by PO or factory..."
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
                    <SelectItem value="assigned">Assigned</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
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
                  }}
                >
                  Clear Filters
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Assignments Table */}
        <Card>
          <CardHeader>
            <CardTitle>Factory Assignments</CardTitle>
            <CardDescription>
              Showing {assignments.length} of {pagination.total} assignments
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>PO Number</TableHead>
                  <TableHead>Factory</TableHead>
                  <TableHead>Assigned Date</TableHead>
                  <TableHead>Expected Completion</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assignments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No factory assignments found
                    </TableCell>
                  </TableRow>
                ) : (
                  assignments.map((assignment) => (
                    <TableRow key={assignment.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{assignment.purchase_order.po_number}</span>
                          {assignment.purchase_order.buyer_name && (
                            <span className="text-xs text-muted-foreground">
                              {assignment.purchase_order.buyer_name}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{assignment.factory.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {assignment.factory.email}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>{formatDate(assignment.assigned_date)}</TableCell>
                      <TableCell>
                        {assignment.expected_completion_date ? (
                          formatDate(assignment.expected_completion_date)
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusVariant(assignment.status)}>
                          {assignment.status.replace('_', ' ').toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {assignment.notes || '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {can('po.assign_factory') && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openEditDialog(assignment)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openDeleteDialog(assignment)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
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
                    onClick={() =>
                      setPagination({ ...pagination, currentPage: pagination.currentPage - 1 })
                    }
                    disabled={pagination.currentPage === 1}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setPagination({ ...pagination, currentPage: pagination.currentPage + 1 })
                    }
                    disabled={pagination.currentPage === pagination.lastPage}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Create Assignment Dialog */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Assign Factory to PO</DialogTitle>
              <DialogDescription>
                Create a new factory assignment for a purchase order
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmitCreate)} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="purchase_order_id">Purchase Order *</Label>
                  <Select
                    value={selectedPOId?.toString()}
                    onValueChange={(value) => setValue('purchase_order_id', parseInt(value))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select PO..." />
                    </SelectTrigger>
                    <SelectContent>
                      {purchaseOrders.map((po) => (
                        <SelectItem key={po.id} value={po.id.toString()}>
                          {po.po_number} {po.buyer_name && `- ${po.buyer_name}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.purchase_order_id && (
                    <p className="text-sm text-red-500">{errors.purchase_order_id.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="factory_id">Factory *</Label>
                  <Select
                    value={selectedFactoryId?.toString()}
                    onValueChange={(value) => setValue('factory_id', parseInt(value))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select factory..." />
                    </SelectTrigger>
                    <SelectContent>
                      {factories.map((factory) => (
                        <SelectItem key={factory.id} value={factory.id.toString()}>
                          {factory.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.factory_id && (
                    <p className="text-sm text-red-500">{errors.factory_id.message}</p>
                  )}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="assigned_date">Assigned Date *</Label>
                  <Input
                    id="assigned_date"
                    type="date"
                    {...register('assigned_date')}
                  />
                  {errors.assigned_date && (
                    <p className="text-sm text-red-500">{errors.assigned_date.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="expected_completion_date">Expected Completion</Label>
                  <Input
                    id="expected_completion_date"
                    type="date"
                    {...register('expected_completion_date')}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status *</Label>
                <Select
                  value={watch('status')}
                  onValueChange={(value) => setValue('status', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="assigned">Assigned</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Input
                  id="notes"
                  {...register('notes')}
                  placeholder="Additional notes..."
                />
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
                <Button type="submit">Create Assignment</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Edit Assignment Dialog */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Factory Assignment</DialogTitle>
              <DialogDescription>
                Update factory assignment details
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmitEdit)} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="edit-purchase_order_id">Purchase Order *</Label>
                  <Select
                    value={selectedPOId?.toString()}
                    onValueChange={(value) => setValue('purchase_order_id', parseInt(value))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select PO..." />
                    </SelectTrigger>
                    <SelectContent>
                      {purchaseOrders.map((po) => (
                        <SelectItem key={po.id} value={po.id.toString()}>
                          {po.po_number} {po.buyer_name && `- ${po.buyer_name}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.purchase_order_id && (
                    <p className="text-sm text-red-500">{errors.purchase_order_id.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-factory_id">Factory *</Label>
                  <Select
                    value={selectedFactoryId?.toString()}
                    onValueChange={(value) => setValue('factory_id', parseInt(value))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select factory..." />
                    </SelectTrigger>
                    <SelectContent>
                      {factories.map((factory) => (
                        <SelectItem key={factory.id} value={factory.id.toString()}>
                          {factory.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.factory_id && (
                    <p className="text-sm text-red-500">{errors.factory_id.message}</p>
                  )}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="edit-assigned_date">Assigned Date *</Label>
                  <Input
                    id="edit-assigned_date"
                    type="date"
                    {...register('assigned_date')}
                  />
                  {errors.assigned_date && (
                    <p className="text-sm text-red-500">{errors.assigned_date.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="edit-expected_completion_date">Expected Completion</Label>
                  <Input
                    id="edit-expected_completion_date"
                    type="date"
                    {...register('expected_completion_date')}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-status">Status *</Label>
                <Select
                  value={watch('status')}
                  onValueChange={(value) => setValue('status', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="assigned">Assigned</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-notes">Notes</Label>
                <Input
                  id="edit-notes"
                  {...register('notes')}
                  placeholder="Additional notes..."
                />
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowEditDialog(false);
                    setSelectedAssignment(null);
                    reset();
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit">Update Assignment</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Factory Assignment</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this factory assignment? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            {selectedAssignment && (
              <div className="py-4">
                <p className="text-sm">
                  <span className="font-medium">PO:</span> {selectedAssignment.purchase_order.po_number}
                </p>
                <p className="text-sm">
                  <span className="font-medium">Factory:</span> {selectedAssignment.factory.name}
                </p>
                <p className="text-sm">
                  <span className="font-medium">Status:</span> {selectedAssignment.status}
                </p>
              </div>
            )}
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowDeleteDialog(false);
                  setSelectedAssignment(null);
                }}
              >
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDelete}>
                Delete Assignment
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
