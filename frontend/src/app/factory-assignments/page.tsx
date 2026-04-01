'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
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
import { Plus, Search, Trash2, Factory, CheckCircle, XCircle, Clock } from 'lucide-react';
import api from '@/lib/api';
import { ListPageSkeleton } from '@/components/skeletons';

interface StyleSearchResult {
  id: number;
  style_number: string;
  description: string | null;
  quantity: number | null;
  status: string | null;
  assigned_factory_id: number | null;
  po_number: string | null;
  po_id: number | null;
}

interface FactoryOption {
  id: number;
  name: string;
  email: string;
  company: string | null;
}

interface AssignmentRecord {
  id: number;
  purchase_order_id: number | null;
  style_id: number;
  factory_id: number;
  assigned_by: number | null;
  assigned_at: string | null;
  assignment_type: string;
  status: string;
  accepted_at: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  notes: string | null;
  expected_completion_date: string | null;
  created_at: string;
  purchase_order?: {
    id: number;
    po_number: string;
    brand_name: string | null;
  } | null;
  style?: {
    id: number;
    style_number: string;
    description: string | null;
  } | null;
  factory?: {
    id: number;
    name: string;
    email: string;
    company: string | null;
  } | null;
  assigned_by_user?: {
    id: number;
    name: string;
  } | null;
}

interface PaginatedResponse {
  data: AssignmentRecord[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

export default function FactoryAssignmentsPage() {
  const { user, can, loading: authLoading } = useAuth();

  // List state
  const [assignments, setAssignments] = useState<AssignmentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    lastPage: 1,
    perPage: 15,
    total: 0,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Assign dialog state
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [styleSearch, setStyleSearch] = useState('');
  const [styleResults, setStyleResults] = useState<StyleSearchResult[]>([]);
  const [selectedStyles, setSelectedStyles] = useState<StyleSearchResult[]>([]);
  const [factories, setFactories] = useState<FactoryOption[]>([]);
  const [selectedFactoryId, setSelectedFactoryId] = useState<string>('');
  const [assignNotes, setAssignNotes] = useState('');
  const [assignLoading, setAssignLoading] = useState(false);
  const [styleSearchLoading, setStyleSearchLoading] = useState(false);

  // Reject dialog state
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectingAssignment, setRejectingAssignment] = useState<AssignmentRecord | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  // Delete dialog state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deletingAssignment, setDeletingAssignment] = useState<AssignmentRecord | null>(null);

  const isFactory = user?.roles?.some((r: any) => (typeof r === 'string' ? r : r.name) === 'Factory');
  const canAssign = can('po.assign_factory') || can('style.assign_factory');

  // Fetch assignments list
  const fetchAssignments = useCallback(async () => {
    try {
      setLoading(true);
      const params: any = {
        page: pagination.currentPage,
        per_page: pagination.perPage,
      };
      if (searchQuery) params.search = searchQuery;
      if (statusFilter !== 'all') params.status = statusFilter;

      const response = await api.get<PaginatedResponse>('/factory-assignments', { params });
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
    } finally {
      setLoading(false);
    }
  }, [pagination.currentPage, pagination.perPage, searchQuery, statusFilter]);

  useEffect(() => {
    if (authLoading) return;
    fetchAssignments();
  }, [fetchAssignments, authLoading]);

  // Fetch factories for dropdown
  useEffect(() => {
    if (authLoading || !canAssign) return;
    api.get<{ data: FactoryOption[] } | FactoryOption[]>('/factories', { params: { per_page: 100 } })
      .then((res) => {
        const data = Array.isArray(res.data) ? res.data : res.data.data || [];
        setFactories(data);
      })
      .catch(() => setFactories([]));
  }, [authLoading, canAssign]);

  // Fetch styles - load all by default, filter on search
  const fetchStyles = useCallback(async (search: string = '') => {
    try {
      setStyleSearchLoading(true);
      const params: any = {};
      if (search) params.search = search;
      const response = await api.get<{ styles: StyleSearchResult[] }>(
        '/factory-assignments/search-styles',
        { params }
      );
      setStyleResults(response.data.styles || []);
    } catch (error) {
      console.error('Style search failed:', error);
      setStyleResults([]);
    } finally {
      setStyleSearchLoading(false);
    }
  }, []);

  // Load all styles when dialog opens
  useEffect(() => {
    if (showAssignDialog) {
      fetchStyles();
    }
  }, [showAssignDialog, fetchStyles]);

  // Debounced search
  useEffect(() => {
    if (!showAssignDialog) return;
    const timer = setTimeout(() => {
      fetchStyles(styleSearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [styleSearch, showAssignDialog, fetchStyles]);

  // Toggle style selection
  const toggleStyleSelection = (style: StyleSearchResult) => {
    setSelectedStyles((prev) => {
      const exists = prev.find((s) => s.id === style.id);
      if (exists) {
        return prev.filter((s) => s.id !== style.id);
      }
      return [...prev, style];
    });
  };

  // Remove selected style
  const removeSelectedStyle = (styleId: number) => {
    setSelectedStyles((prev) => prev.filter((s) => s.id !== styleId));
  };

  // Handle bulk assign
  const handleBulkAssign = async () => {
    if (selectedStyles.length === 0 || !selectedFactoryId) return;

    try {
      setAssignLoading(true);
      await api.post('/factory-assignments/bulk-assign', {
        style_ids: selectedStyles.map((s) => s.id),
        factory_id: parseInt(selectedFactoryId),
        assignment_type: 'direct_to_factory',
        notes: assignNotes || null,
      });

      setShowAssignDialog(false);
      resetAssignForm();
      fetchAssignments();
    } catch (error: any) {
      console.error('Failed to assign styles:', error);
      alert(error.response?.data?.message || 'Failed to assign styles');
    } finally {
      setAssignLoading(false);
    }
  };

  const resetAssignForm = () => {
    setStyleSearch('');
    setStyleResults([]);
    setSelectedStyles([]);
    setSelectedFactoryId('');
    setAssignNotes('');
  };

  // Accept assignment
  const handleAccept = async (assignment: AssignmentRecord) => {
    try {
      await api.post(`/factory-assignments/${assignment.id}/accept`);
      fetchAssignments();
    } catch (error: any) {
      console.error('Failed to accept:', error);
      alert(error.response?.data?.message || 'Failed to accept assignment');
    }
  };

  // Reject assignment
  const handleReject = async () => {
    if (!rejectingAssignment) return;
    try {
      await api.post(`/factory-assignments/${rejectingAssignment.id}/reject`, {
        rejection_reason: rejectionReason || null,
      });
      setShowRejectDialog(false);
      setRejectingAssignment(null);
      setRejectionReason('');
      fetchAssignments();
    } catch (error: any) {
      console.error('Failed to reject:', error);
      alert(error.response?.data?.message || 'Failed to reject assignment');
    }
  };

  // Delete assignment
  const handleDelete = async () => {
    if (!deletingAssignment) return;
    try {
      // Need to find the PO ID from the assignment
      const poId = deletingAssignment.purchase_order_id || deletingAssignment.purchase_order?.id;
      if (poId) {
        await api.delete(`/purchase-orders/${poId}/factory-assignments/${deletingAssignment.id}`);
      }
      setShowDeleteDialog(false);
      setDeletingAssignment(null);
      fetchAssignments();
    } catch (error: any) {
      console.error('Failed to delete:', error);
      alert(error.response?.data?.message || 'Failed to delete assignment');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'invited':
        return <Badge variant="outline" className="gap-1"><Clock className="h-3 w-3" />Invited</Badge>;
      case 'accepted':
        return <Badge variant="default" className="gap-1 bg-green-600"><CheckCircle className="h-3 w-3" />Accepted</Badge>;
      case 'rejected':
        return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" />Rejected</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (loading && assignments.length === 0) {
    return (
      <DashboardLayout requiredPermissions={['po.assign_factory', 'style.assign_factory']} requireAll={false}>
        <ListPageSkeleton statCards={0} filterCount={2} columns={7} />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout requiredPermissions={['po.assign_factory', 'style.assign_factory']} requireAll={false}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Factory Assignments</h1>
            <p className="text-muted-foreground mt-1">
              {isFactory
                ? 'View and respond to style assignments from importers and agencies'
                : 'Assign styles to factories for production'}
            </p>
          </div>
          {canAssign && (
            <Button onClick={() => setShowAssignDialog(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Assign Styles
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
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {assignments.filter((a) => a.status === 'invited').length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Accepted</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {assignments.filter((a) => a.status === 'accepted').length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Rejected</CardTitle>
              <XCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {assignments.filter((a) => a.status === 'rejected').length}
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
                    placeholder="Search by style, PO, or factory..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setPagination((p) => ({ ...p, currentPage: 1 }));
                    }}
                    className="pl-8"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={statusFilter}
                  onValueChange={(v) => {
                    setStatusFilter(v);
                    setPagination((p) => ({ ...p, currentPage: 1 }));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    <SelectItem value="invited">Invited (Pending)</SelectItem>
                    <SelectItem value="accepted">Accepted</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
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
                    setPagination((p) => ({ ...p, currentPage: 1 }));
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
            <CardTitle>Style Assignments</CardTitle>
            <CardDescription>
              Showing {assignments.length} of {pagination.total} assignments
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Style</TableHead>
                  <TableHead>PO Number</TableHead>
                  <TableHead>Factory</TableHead>
                  <TableHead>Assigned Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assignments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No style assignments found
                    </TableCell>
                  </TableRow>
                ) : (
                  assignments.map((assignment) => (
                    <TableRow key={assignment.id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {assignment.style?.style_number || '-'}
                          </span>
                          {assignment.style?.description && (
                            <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                              {assignment.style.description}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">
                          {assignment.purchase_order?.po_number || '-'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {assignment.factory?.name || '-'}
                          </span>
                          {assignment.factory?.company && (
                            <span className="text-xs text-muted-foreground">
                              {assignment.factory.company}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{formatDate(assignment.assigned_at || assignment.created_at)}</TableCell>
                      <TableCell>
                        {getStatusBadge(assignment.status)}
                        {assignment.rejection_reason && (
                          <p className="text-xs text-red-500 mt-1 max-w-[150px] truncate" title={assignment.rejection_reason}>
                            {assignment.rejection_reason}
                          </p>
                        )}
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {assignment.notes || '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {/* Factory can accept/reject invited assignments */}
                          {isFactory && assignment.status === 'invited' && (
                            <>
                              <Button
                                variant="default"
                                size="sm"
                                className="bg-green-600 hover:bg-green-700"
                                onClick={() => handleAccept(assignment)}
                              >
                                <CheckCircle className="h-4 w-4 mr-1" />
                                Accept
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => {
                                  setRejectingAssignment(assignment);
                                  setShowRejectDialog(true);
                                }}
                              >
                                <XCircle className="h-4 w-4 mr-1" />
                                Reject
                              </Button>
                            </>
                          )}
                          {/* Importer/Agency can delete */}
                          {canAssign && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setDeletingAssignment(assignment);
                                setShowDeleteDialog(true);
                              }}
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

        {/* Assign Styles Dialog */}
        <Dialog
          open={showAssignDialog}
          onOpenChange={(open) => {
            setShowAssignDialog(open);
            if (!open) resetAssignForm();
          }}
        >
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Assign Styles to Factory</DialogTitle>
              <DialogDescription>
                Search and select styles, then choose a factory to assign them to
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              {/* Style Search */}
              <div className="space-y-3">
                <Label>Search Styles</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Type style number, description, or PO number to search..."
                    value={styleSearch}
                    onChange={(e) => setStyleSearch(e.target.value)}
                    className="pl-8"
                  />
                </div>

                {/* Search Results */}
                {styleSearchLoading && (
                  <div className="text-sm text-muted-foreground py-2">Searching...</div>
                )}
                {styleResults.length > 0 && (
                  <div className="border rounded-md max-h-[250px] overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10"></TableHead>
                          <TableHead>Style #</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead>PO</TableHead>
                          <TableHead>Qty</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {styleResults.map((style) => {
                          const isSelected = selectedStyles.some((s) => s.id === style.id);
                          return (
                            <TableRow
                              key={style.id}
                              className="cursor-pointer hover:bg-muted/50"
                              onClick={() => toggleStyleSelection(style)}
                            >
                              <TableCell>
                                <Checkbox
                                  checked={isSelected}
                                  onCheckedChange={() => toggleStyleSelection(style)}
                                />
                              </TableCell>
                              <TableCell className="font-medium">{style.style_number}</TableCell>
                              <TableCell className="text-sm text-muted-foreground truncate max-w-[200px]">
                                {style.description || '-'}
                              </TableCell>
                              <TableCell className="text-sm">{style.po_number || '-'}</TableCell>
                              <TableCell className="text-sm">{style.quantity || '-'}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
                {!styleSearchLoading && styleResults.length === 0 && (
                  <div className="text-sm text-muted-foreground py-2">No styles found</div>
                )}
              </div>

              {/* Selected Styles */}
              {selectedStyles.length > 0 && (
                <div className="space-y-2">
                  <Label>Selected Styles ({selectedStyles.length})</Label>
                  <div className="flex flex-wrap gap-2">
                    {selectedStyles.map((style) => (
                      <Badge
                        key={style.id}
                        variant="secondary"
                        className="gap-1 py-1 px-2 cursor-pointer hover:bg-destructive hover:text-destructive-foreground"
                        onClick={() => removeSelectedStyle(style.id)}
                      >
                        {style.style_number}
                        {style.po_number && ` (${style.po_number})`}
                        <XCircle className="h-3 w-3 ml-1" />
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Factory Selection */}
              <div className="space-y-2">
                <Label htmlFor="factory">Factory *</Label>
                <Select value={selectedFactoryId} onValueChange={setSelectedFactoryId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a factory..." />
                  </SelectTrigger>
                  <SelectContent>
                    {factories.map((factory) => (
                      <SelectItem key={factory.id} value={factory.id.toString()}>
                        {factory.name}
                        {factory.company && ` - ${factory.company}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="notes">Notes (optional)</Label>
                <Textarea
                  id="notes"
                  value={assignNotes}
                  onChange={(e) => setAssignNotes(e.target.value)}
                  placeholder="Add any special instructions or notes..."
                  rows={3}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowAssignDialog(false);
                  resetAssignForm();
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleBulkAssign}
                disabled={selectedStyles.length === 0 || !selectedFactoryId || assignLoading}
              >
                {assignLoading
                  ? 'Assigning...'
                  : `Assign ${selectedStyles.length} Style${selectedStyles.length !== 1 ? 's' : ''}`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Reject Dialog */}
        <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reject Assignment</DialogTitle>
              <DialogDescription>
                Provide a reason for rejecting this style assignment.
              </DialogDescription>
            </DialogHeader>
            {rejectingAssignment && (
              <div className="py-2 space-y-2">
                <p className="text-sm">
                  <span className="font-medium">Style:</span>{' '}
                  {rejectingAssignment.style?.style_number || '-'}
                </p>
                <p className="text-sm">
                  <span className="font-medium">PO:</span>{' '}
                  {rejectingAssignment.purchase_order?.po_number || '-'}
                </p>
                <div className="space-y-2 mt-3">
                  <Label>Reason (optional)</Label>
                  <Textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Reason for rejecting this assignment..."
                    rows={3}
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowRejectDialog(false);
                  setRejectingAssignment(null);
                  setRejectionReason('');
                }}
              >
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleReject}>
                Reject Assignment
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Dialog */}
        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Assignment</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this assignment? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            {deletingAssignment && (
              <div className="py-2">
                <p className="text-sm">
                  <span className="font-medium">Style:</span>{' '}
                  {deletingAssignment.style?.style_number || '-'}
                </p>
                <p className="text-sm">
                  <span className="font-medium">Factory:</span>{' '}
                  {deletingAssignment.factory?.name || '-'}
                </p>
                <p className="text-sm">
                  <span className="font-medium">Status:</span> {deletingAssignment.status}
                </p>
              </div>
            )}
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowDeleteDialog(false);
                  setDeletingAssignment(null);
                }}
              >
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleDelete}>
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
