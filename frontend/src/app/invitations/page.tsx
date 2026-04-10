'use client';

// Disable static generation for this authenticated page
export const dynamic = 'force-dynamic';

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
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Search, Copy, Check, Loader2, Mail, X, CheckCircle, XCircle, Factory, UserPlus } from 'lucide-react';
import api from '@/lib/api';
import { TableSkeleton } from '@/components/skeletons';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuth } from '@/contexts/AuthContext';

interface Invitation {
  id: number;
  purchase_order_id: number;
  invitation_type: string;
  invitee_email: string;
  invitee_name: string;
  invited_email: string;
  invited_name: string;
  invited_by: { id: number; name: string } | number;
  invited_user_id: number | null;
  status: string;
  invitation_token: string;
  expires_at: string;
  accepted_at: string | null;
  created_at: string;
  purchase_order?: {
    id: number;
    po_number: string;
  };
  inviter?: {
    name: string;
  };
}

interface PurchaseOrder {
  id: number;
  po_number: string;
  importer_id?: number | null;
  importer?: { id: number; name: string; company?: string } | null;
}

interface ImporterOption {
  id: number;
  name: string;
  company?: string;
}

interface POStyle {
  id: number;
  style_number: string;
  description: string | null;
  total_quantity?: number;
  pivot?: {
    quantity_in_po?: number;
    assigned_factory_id?: number;
  };
}

interface FactoryOption {
  id: number;
  name: string;
  company?: string;
}

interface FactoryAssignment {
  id: number;
  purchase_order_id: number;
  style_id: number;
  factory_id: number;
  assignment_type: string;
  status: string;
  notes: string | null;
  created_at: string;
  accepted_at: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  purchase_order?: { id: number; po_number: string };
  style?: { id: number; style_number: string; description: string | null };
  factory?: { id: number; name: string; email: string; company: string | null };
  assigned_by?: { id: number; name: string } | number;
}

const invitationSchema = z.object({
  invitation_type: z.string().min(1, 'Invitation type is required'),
  purchase_order_id: z.coerce.number().min(1, 'Purchase order is required'),
  invitee_email: z.string().email('Invalid email address'),
  invitee_name: z.string().min(1, 'Name is required'),
  message: z.string().optional(),
  expires_in_days: z.coerce.number().min(1).max(90).default(7),
});

type InvitationFormData = z.infer<typeof invitationSchema>;

export default function InvitationsPage() {
  const { user, can } = useAuth();
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [factoryAssignments, setFactoryAssignments] = useState<FactoryAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  // Factory assignment state
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [assignSelectedPOId, setAssignSelectedPOId] = useState<string>('');
  const [poStyles, setPOStyles] = useState<POStyle[]>([]);
  const [poStylesLoading, setPOStylesLoading] = useState(false);
  const [styleSearchFilter, setStyleSearchFilter] = useState('');
  const [selectedStyleIds, setSelectedStyleIds] = useState<number[]>([]);
  const [factories, setFactories] = useState<FactoryOption[]>([]);
  const [selectedFactoryId, setSelectedFactoryId] = useState<string>('');
  const [assignNotes, setAssignNotes] = useState('');
  const [assignLoading, setAssignLoading] = useState(false);
  const canAssignFactory = can('po.assign_factory');

  // Importer assignment state
  const [showAssignImporterDialog, setShowAssignImporterDialog] = useState(false);
  const [assignImporterPOId, setAssignImporterPOId] = useState<string>('');
  const [importers, setImporters] = useState<ImporterOption[]>([]);
  const [selectedImporterId, setSelectedImporterId] = useState<string>('');
  const [assignImporterLoading, setAssignImporterLoading] = useState(false);
  const isAgency = user?.roles?.some((r: any) => (typeof r === 'string' ? r : r.name) === 'Agency');

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
  } = useForm({
    resolver: zodResolver(invitationSchema),
    defaultValues: {
      expires_in_days: 7,
    },
  });

  const selectedInvitationType = watch('invitation_type');

  useEffect(() => {
    fetchInvitations();
    fetchFactoryAssignments();
    fetchPurchaseOrders();
  }, [searchTerm, statusFilter]);

  // Fetch factories for assignment dialog
  useEffect(() => {
    if (!canAssignFactory) return;
    api.get('/factories', { params: { per_page: 100 } })
      .then((res) => {
        const data = Array.isArray(res.data) ? res.data : res.data.data || [];
        setFactories(data);
      })
      .catch(() => setFactories([]));
  }, [canAssignFactory]);

  // Fetch importers for importer assignment dialog (Agency users)
  useEffect(() => {
    if (!isAgency) return;
    api.get('/importers')
      .then((res) => {
        const data = Array.isArray(res.data) ? res.data : res.data.data || [];
        setImporters(data);
      })
      .catch(() => setImporters([]));
  }, [isAgency]);

  const fetchInvitations = async () => {
    try {
      setLoading(true);
      const params: any = {};

      if (searchTerm) {
        params.search = searchTerm;
      }

      if (statusFilter !== 'all') {
        params.status = statusFilter;
      }

      const response = await api.get('/invitations', { params });
      setInvitations(response.data.invitations || response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch invitations:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchFactoryAssignments = async () => {
    try {
      const params: any = { per_page: 100 };
      if (searchTerm) params.search = searchTerm;
      if (statusFilter !== 'all') params.status = statusFilter;

      const response = await api.get('/factory-assignments', { params });
      setFactoryAssignments(response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch factory assignments:', error);
    }
  };

  const fetchPurchaseOrders = async () => {
    try {
      const response = await api.get('/purchase-orders', {
        params: { per_page: 100 },
      });
      setPurchaseOrders(response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch purchase orders:', error);
    }
  };

  // Fetch styles for a specific PO
  const fetchPOStyles = async (poId: string) => {
    if (!poId) {
      setPOStyles([]);
      return;
    }
    setPOStylesLoading(true);
    try {
      const response = await api.get(`/purchase-orders/${poId}/styles`, {
        params: { per_page: 200 },
      });
      const styles = response.data.styles || response.data.data || [];
      setPOStyles(Array.isArray(styles) ? styles : []);
    } catch (error) {
      console.error('Failed to fetch PO styles:', error);
      setPOStyles([]);
    } finally {
      setPOStylesLoading(false);
    }
  };

  // Handle PO selection in assign dialog
  const handleAssignPOChange = (poId: string) => {
    setAssignSelectedPOId(poId);
    setSelectedStyleIds([]);
    setStyleSearchFilter('');
    fetchPOStyles(poId);
  };

  // Filter styles by search term
  const filteredPOStyles = poStyles.filter((style) => {
    if (!styleSearchFilter) return true;
    const search = styleSearchFilter.toLowerCase();
    return (
      style.style_number.toLowerCase().includes(search) ||
      (style.description || '').toLowerCase().includes(search)
    );
  });

  // Toggle single style selection
  const toggleStyleSelection = (styleId: number) => {
    setSelectedStyleIds((prev) =>
      prev.includes(styleId)
        ? prev.filter((id) => id !== styleId)
        : [...prev, styleId]
    );
  };

  // Toggle all visible styles
  const toggleSelectAll = () => {
    const visibleIds = filteredPOStyles.map((s) => s.id);
    const allSelected = visibleIds.every((id) => selectedStyleIds.includes(id));
    if (allSelected) {
      setSelectedStyleIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
    } else {
      setSelectedStyleIds((prev) => [...new Set([...prev, ...visibleIds])]);
    }
  };

  // Submit factory assignment
  const handleAssignFactory = async () => {
    if (selectedStyleIds.length === 0 || !selectedFactoryId) return;
    setAssignLoading(true);
    try {
      await api.post('/factory-assignments/bulk-assign', {
        style_ids: selectedStyleIds,
        factory_id: parseInt(selectedFactoryId),
        assignment_type: 'via_agency',
        notes: assignNotes || null,
      });
      setShowAssignDialog(false);
      resetAssignForm();
      fetchFactoryAssignments();
    } catch (error: any) {
      console.error('Failed to assign styles:', error);
      alert(error.response?.data?.message || 'Failed to assign styles to factory');
    } finally {
      setAssignLoading(false);
    }
  };

  const resetAssignForm = () => {
    setAssignSelectedPOId('');
    setPOStyles([]);
    setStyleSearchFilter('');
    setSelectedStyleIds([]);
    setSelectedFactoryId('');
    setAssignNotes('');
  };

  // POs that don't have an importer assigned yet
  const posWithoutImporter = purchaseOrders.filter((po) => !po.importer_id);

  const handleAssignImporter = async () => {
    if (!assignImporterPOId || !selectedImporterId) return;
    setAssignImporterLoading(true);
    try {
      // Fetch current PO data first, then update with importer_id
      const poRes = await api.get(`/purchase-orders/${assignImporterPOId}`);
      const po = poRes.data.purchase_order || poRes.data;
      await api.put(`/purchase-orders/${assignImporterPOId}`, {
        po_number: po.po_number,
        po_date: po.po_date,
        importer_id: parseInt(selectedImporterId),
      });
      setShowAssignImporterDialog(false);
      setAssignImporterPOId('');
      setSelectedImporterId('');
      fetchPurchaseOrders();
    } catch (error: any) {
      console.error('Failed to assign importer:', error);
      alert(error.response?.data?.message || 'Failed to assign importer');
    } finally {
      setAssignImporterLoading(false);
    }
  };

  const onSubmit = async (data: InvitationFormData) => {
    setIsSubmitting(true);
    try {
      // Transform payload to match backend expectations
      const payload = {
        invitation_type: data.invitation_type,
        invited_users: [
          {
            email: data.invitee_email,
            name: data.invitee_name,
            user_id: null, // Will be null for new invitations
          },
        ],
        message: data.message,
        expires_in_days: data.expires_in_days,
      };

      // Use correct endpoint with PO ID in path
      await api.post(`/purchase-orders/${data.purchase_order_id}/invitations/send`, payload);
      setIsCreateDialogOpen(false);
      reset();
      fetchInvitations();
    } catch (error) {
      console.error('Failed to send invitation:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async (invitation: Invitation) => {
    try {
      await api.post(`/purchase-orders/${invitation.purchase_order_id}/invitations/${invitation.id}/resend`);
      fetchInvitations();
    } catch (error) {
      console.error('Failed to resend invitation:', error);
    }
  };

  const handleRevoke = async (invitation: Invitation) => {
    if (!confirm('Are you sure you want to revoke this invitation?')) {
      return;
    }

    try {
      await api.post(`/purchase-orders/${invitation.purchase_order_id}/invitations/${invitation.id}/cancel`);
      fetchInvitations();
    } catch (error) {
      console.error('Failed to revoke invitation:', error);
    }
  };

  const isReceivedInvitation = (invitation: Invitation) => {
    const invitedEmail = invitation.invited_email || invitation.invitee_email;
    return invitedEmail === user?.email;
  };

  const handleAccept = async (invitation: Invitation) => {
    try {
      await api.post(`/invitations/${invitation.id}/accept`);
      fetchInvitations();
    } catch (error) {
      console.error('Failed to accept invitation:', error);
    }
  };

  const handleReject = async (invitation: Invitation) => {
    if (!confirm('Are you sure you want to reject this invitation?')) {
      return;
    }

    try {
      await api.post(`/invitations/${invitation.id}/reject`);
      fetchInvitations();
    } catch (error) {
      console.error('Failed to reject invitation:', error);
    }
  };

  const copyInvitationLink = (token: string) => {
    const link = `${window.location.origin}/invitations/accept/${token}`;
    navigator.clipboard.writeText(link);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'secondary',
      accepted: 'default',
      expired: 'destructive',
      revoked: 'destructive',
    };
    return colors[status] || 'secondary';
  };

  const getInvitationTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      invite_agency: 'Agency',
      invite_factory_direct: 'Factory (Direct)',
      invite_factory_via_agency: 'Factory (via Agency)',
      invite_qc_inspector: 'QC Inspector',
    };
    return labels[type] || type;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getAvailableInvitationTypes = () => {
    const types = [];

    // Super Admin can send all invitation types
    if (user?.roles.some(r => r.name === 'Super Admin')) {
      types.push(
        { value: 'invite_agency', label: 'Invite Agency' },
        { value: 'invite_factory_direct', label: 'Invite Factory (Direct)' },
        { value: 'invite_factory_via_agency', label: 'Invite Factory (via Agency)' },
        { value: 'invite_qc_inspector', label: 'Invite QC Inspector' }
      );
      return types;
    }

    // Importers can invite agencies, factories directly, and QC inspectors
    if (user?.roles.some(r => r.name === 'Importer')) {
      types.push(
        { value: 'invite_agency', label: 'Invite Agency' },
        { value: 'invite_factory_direct', label: 'Invite Factory (Direct)' },
        { value: 'invite_qc_inspector', label: 'Invite QC Inspector' }
      );
    }

    // Agencies can invite factories and QC inspectors
    if (user?.roles.some(r => r.name === 'Agency')) {
      types.push(
        { value: 'invite_factory_via_agency', label: 'Invite Factory (via Agency)' },
        { value: 'invite_qc_inspector', label: 'Invite QC Inspector' }
      );
    }

    return types;
  };

  return (
    <DashboardLayout requiredPermissions={['invitation.send', 'invitation.view_all', 'invitation.respond']} requireAll={false}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Invitations</h1>
            <p className="text-muted-foreground">Send and manage invitations to partners</p>
          </div>
          <div className="flex gap-2">
            {isAgency && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowAssignImporterDialog(true)}
              >
                <UserPlus className="mr-2 h-4 w-4" />
                Assign Importer
              </Button>
            )}
            {canAssignFactory && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowAssignDialog(true)}
              >
                <Factory className="mr-2 h-4 w-4" />
                Assign Factory
              </Button>
            )}
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Send Invitation
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <form onSubmit={handleSubmit(onSubmit)}>
                <DialogHeader>
                  <DialogTitle>Send Invitation</DialogTitle>
                  <DialogDescription>
                    Invite partners to collaborate on purchase orders
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="invitation_type">Invitation Type *</Label>
                      <Select onValueChange={(value) => setValue('invitation_type', value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          {getAvailableInvitationTypes().length > 0 ? (
                            getAvailableInvitationTypes().map((type) => (
                              <SelectItem key={type.value} value={type.value}>
                                {type.label}
                              </SelectItem>
                            ))
                          ) : (
                            <div className="px-2 py-1.5 text-sm text-muted-foreground">
                              No invitation types available for your role
                            </div>
                          )}
                        </SelectContent>
                      </Select>
                      {errors.invitation_type && (
                        <p className="text-sm text-destructive">{errors.invitation_type.message}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="purchase_order_id">Purchase Order *</Label>
                      <Select onValueChange={(value) => setValue('purchase_order_id', parseInt(value))}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select PO" />
                        </SelectTrigger>
                        <SelectContent>
                          {purchaseOrders.map((po) => (
                            <SelectItem key={po.id} value={po.id.toString()}>
                              {po.po_number}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {errors.purchase_order_id && (
                        <p className="text-sm text-destructive">{errors.purchase_order_id.message}</p>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="invitee_name">Invitee Name *</Label>
                    <Input
                      id="invitee_name"
                      placeholder="John Doe"
                      {...register('invitee_name')}
                    />
                    {errors.invitee_name && (
                      <p className="text-sm text-destructive">{errors.invitee_name.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="invitee_email">Invitee Email *</Label>
                    <Input
                      id="invitee_email"
                      type="email"
                      placeholder="john@example.com"
                      {...register('invitee_email')}
                    />
                    {errors.invitee_email && (
                      <p className="text-sm text-destructive">{errors.invitee_email.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="expires_in_days">Expires In (Days) *</Label>
                    <Input
                      id="expires_in_days"
                      type="number"
                      placeholder="7"
                      {...register('expires_in_days')}
                    />
                    {errors.expires_in_days && (
                      <p className="text-sm text-destructive">{errors.expires_in_days.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="message">Personal Message (Optional)</Label>
                    <textarea
                      id="message"
                      className="flex min-h-[100px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      placeholder="Add a personal message to the invitation..."
                      {...register('message')}
                    />
                  </div>
                  {selectedInvitationType && (
                    <div className="rounded-lg bg-muted p-3 text-sm">
                      <p className="font-medium">Invitation Type: {getInvitationTypeLabel(selectedInvitationType)}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {selectedInvitationType === 'invite_agency' && 'The agency will be able to manage this purchase order and invite factories.'}
                        {selectedInvitationType === 'invite_factory_direct' && 'The factory will be assigned directly to styles in this purchase order.'}
                        {selectedInvitationType === 'invite_factory_via_agency' && 'The factory will be invited by your agency and assigned to styles.'}
                        {selectedInvitationType === 'invite_qc_inspector' && 'The QC inspector will be able to perform quality inspections for this purchase order.'}
                      </p>
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsCreateDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Mail className="mr-2 h-4 w-4" />
                        Send Invitation
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
          </div>
        </div>

        {/* Assign Factory Dialog */}
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
                Select a purchase order, pick styles, and assign them to a factory
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              {/* PO Selection */}
              <div className="space-y-2">
                <Label>Purchase Order *</Label>
                <Select value={assignSelectedPOId} onValueChange={handleAssignPOChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a purchase order..." />
                  </SelectTrigger>
                  <SelectContent>
                    {purchaseOrders.map((po) => (
                      <SelectItem key={po.id} value={po.id.toString()}>
                        {po.po_number}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Styles Table */}
              {assignSelectedPOId && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Styles ({selectedStyleIds.length} of {filteredPOStyles.length} selected)</Label>
                  </div>

                  {/* Style Search */}
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search styles by number or description..."
                      value={styleSearchFilter}
                      onChange={(e) => setStyleSearchFilter(e.target.value)}
                      className="pl-8"
                    />
                  </div>

                  {poStylesLoading ? (
                    <div className="text-sm text-muted-foreground py-4 text-center">Loading styles...</div>
                  ) : filteredPOStyles.length === 0 ? (
                    <div className="text-sm text-muted-foreground py-4 text-center">
                      {poStyles.length === 0 ? 'No styles found in this PO' : 'No styles match your search'}
                    </div>
                  ) : (
                    <div className="border rounded-md max-h-[300px] overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-10">
                              <Checkbox
                                checked={
                                  filteredPOStyles.length > 0 &&
                                  filteredPOStyles.every((s) => selectedStyleIds.includes(s.id))
                                }
                                onCheckedChange={toggleSelectAll}
                              />
                            </TableHead>
                            <TableHead>Style #</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>Qty</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredPOStyles.map((style) => {
                            const isSelected = selectedStyleIds.includes(style.id);
                            const isAssigned = !!style.pivot?.assigned_factory_id;
                            return (
                              <TableRow
                                key={style.id}
                                className={`cursor-pointer hover:bg-muted/50 ${isAssigned ? 'opacity-60' : ''}`}
                                onClick={() => toggleStyleSelection(style.id)}
                              >
                                <TableCell>
                                  <Checkbox
                                    checked={isSelected}
                                    onCheckedChange={() => toggleStyleSelection(style.id)}
                                  />
                                </TableCell>
                                <TableCell className="font-medium">{style.style_number}</TableCell>
                                <TableCell className="text-sm text-muted-foreground truncate max-w-[200px]">
                                  {style.description || '-'}
                                </TableCell>
                                <TableCell className="text-sm">
                                  {style.pivot?.quantity_in_po || style.total_quantity || '-'}
                                </TableCell>
                                <TableCell className="text-sm">
                                  {isAssigned ? (
                                    <Badge variant="secondary">Assigned</Badge>
                                  ) : (
                                    <Badge variant="outline">Unassigned</Badge>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              )}

              {/* Factory Selection */}
              {selectedStyleIds.length > 0 && (
                <>
                  <div className="space-y-2">
                    <Label>Factory *</Label>
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

                  <div className="space-y-2">
                    <Label>Notes (optional)</Label>
                    <textarea
                      className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      value={assignNotes}
                      onChange={(e) => setAssignNotes(e.target.value)}
                      placeholder="Add any special instructions..."
                      rows={3}
                    />
                  </div>
                </>
              )}
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
                onClick={handleAssignFactory}
                disabled={selectedStyleIds.length === 0 || !selectedFactoryId || assignLoading}
              >
                {assignLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Assigning...
                  </>
                ) : (
                  `Assign ${selectedStyleIds.length} Style${selectedStyleIds.length !== 1 ? 's' : ''}`
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Assign Importer Dialog */}
        <Dialog
          open={showAssignImporterDialog}
          onOpenChange={(open) => {
            setShowAssignImporterDialog(open);
            if (!open) {
              setAssignImporterPOId('');
              setSelectedImporterId('');
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Assign Importer to Purchase Order</DialogTitle>
              <DialogDescription>
                Select a purchase order and assign an importer
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Purchase Order *</Label>
                <Select value={assignImporterPOId} onValueChange={setAssignImporterPOId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a PO without importer..." />
                  </SelectTrigger>
                  <SelectContent>
                    {posWithoutImporter.length === 0 ? (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">
                        All POs already have an importer assigned
                      </div>
                    ) : (
                      posWithoutImporter.map((po) => (
                        <SelectItem key={po.id} value={po.id.toString()}>
                          {po.po_number}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Importer *</Label>
                <Select value={selectedImporterId} onValueChange={setSelectedImporterId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select an importer..." />
                  </SelectTrigger>
                  <SelectContent>
                    {importers.map((importer) => (
                      <SelectItem key={importer.id} value={importer.id.toString()}>
                        {importer.name}{importer.company ? ` - ${importer.company}` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowAssignImporterDialog(false);
                  setAssignImporterPOId('');
                  setSelectedImporterId('');
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleAssignImporter}
                disabled={!assignImporterPOId || !selectedImporterId || assignImporterLoading}
              >
                {assignImporterLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Assigning...
                  </>
                ) : (
                  'Assign Importer'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
            <CardDescription>Search and filter invitations</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by email or name..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="accepted">Accepted</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                  <SelectItem value="revoked">Revoked</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <TableSkeleton columns={7} rows={5} hasHeader />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Invitee</TableHead>
                    <TableHead>Purchase Order</TableHead>
                    <TableHead>Invited By</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invitations.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground">
                        No invitations found
                      </TableCell>
                    </TableRow>
                  ) : (
                    invitations.map((invitation) => (
                      <TableRow key={invitation.id}>
                        <TableCell>
                          <Badge variant="outline">
                            {getInvitationTypeLabel(invitation.invitation_type)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{invitation.invited_name || invitation.invitee_name}</p>
                            <p className="text-xs text-muted-foreground">{invitation.invited_email || invitation.invitee_email}</p>
                          </div>
                        </TableCell>
                        <TableCell>{invitation.purchase_order?.po_number || 'N/A'}</TableCell>
                        <TableCell>{typeof invitation.invited_by === 'object' ? invitation.invited_by?.name : invitation.inviter?.name || 'N/A'}</TableCell>
                        <TableCell>
                          <Badge variant={getStatusColor(invitation.status) as any}>
                            {invitation.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatDate(invitation.expires_at)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            {invitation.status === 'pending' && isReceivedInvitation(invitation) && (
                              <>
                                <Button
                                  variant="default"
                                  size="sm"
                                  onClick={() => handleAccept(invitation)}
                                  title="Accept invitation"
                                >
                                  <CheckCircle className="mr-1 h-4 w-4" />
                                  Accept
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleReject(invitation)}
                                  title="Reject invitation"
                                >
                                  <XCircle className="mr-1 h-4 w-4" />
                                  Reject
                                </Button>
                              </>
                            )}
                            {invitation.status === 'pending' && !isReceivedInvitation(invitation) && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => copyInvitationLink(invitation.invitation_token)}
                                  title="Copy invitation link"
                                >
                                  {copiedToken === invitation.invitation_token ? (
                                    <Check className="h-4 w-4 text-green-500" />
                                  ) : (
                                    <Copy className="h-4 w-4" />
                                  )}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleResend(invitation)}
                                  title="Resend invitation"
                                >
                                  <Mail className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleRevoke(invitation)}
                                  title="Revoke invitation"
                                >
                                  <X className="h-4 w-4 text-destructive" />
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
            )}
          </CardContent>
        </Card>

        {/* Factory Assignments Table */}
        {canAssignFactory && (
          <Card>
            <CardHeader>
              <CardTitle>Factory Assignments</CardTitle>
              <CardDescription>Styles assigned to factories</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <TableSkeleton columns={7} rows={3} hasHeader />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Style</TableHead>
                      <TableHead>Purchase Order</TableHead>
                      <TableHead>Factory</TableHead>
                      <TableHead>Assigned By</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {factoryAssignments.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground">
                          No factory assignments found
                        </TableCell>
                      </TableRow>
                    ) : (
                      factoryAssignments.map((assignment) => (
                        <TableRow key={assignment.id}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{assignment.style?.style_number || '-'}</p>
                              {assignment.style?.description && (
                                <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                                  {assignment.style.description}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{assignment.purchase_order?.po_number || '-'}</TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium">{assignment.factory?.name || '-'}</p>
                              {assignment.factory?.company && (
                                <p className="text-xs text-muted-foreground">{assignment.factory.company}</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {typeof assignment.assigned_by === 'object'
                              ? assignment.assigned_by?.name
                              : '-'}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {assignment.assignment_type === 'via_agency' ? 'Via Agency' : 'Direct'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                assignment.status === 'accepted'
                                  ? 'default'
                                  : assignment.status === 'rejected'
                                  ? 'destructive'
                                  : 'secondary'
                              }
                            >
                              {assignment.status}
                            </Badge>
                          </TableCell>
                          <TableCell>{formatDate(assignment.created_at)}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
