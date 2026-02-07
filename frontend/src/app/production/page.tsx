'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, useCallback } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Loader2, Factory as FactoryIcon, CheckCircle, XCircle, Clock, Ship, CalendarClock,
  AlertCircle, Send, ShieldCheck, Package, Search, RotateCcw,
} from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FactoryUser {
  id: number;
  name: string;
  company?: string;
}

interface StyleShippingInfo {
  pivot_id: number;
  purchase_order_id: number;
  po_number: string | null;
  po_ex_factory_date: string | null;
  agency_name: string | null;
  agency_id: number | null;
  importer_name: string | null;
  factory_name: string | null;
  assigned_factory_id: number | null;
  style_id: number;
  style_number: string | null;
  quantity_in_po: number | null;
  ex_factory_date: string | null;
  estimated_ex_factory_date: string | null;
  production_status: string | null;
  shipping_approval_status: string | null;
  shipping_approval_requested_at: string | null;
  shipping_approval_agency_at: string | null;
  shipping_approval_importer_at: string | null;
  shipping_approval_notes: string | null;
  shipping_approval_rejection_reason: string | null;
  suggested_ship_option: SuggestedShipOption | null;
}

interface SuggestedShipOption {
  id: number;
  name: string;
  carrier?: string;
  etd?: string;
  eta?: string;
  vessel_name?: string;
  cutoff_date?: string;
  estimated_transit_days?: number;
  estimated_arrival_date?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PRODUCTION_STATUSES = [
  { value: 'Submitted', label: 'Submitted' },
  { value: 'In Production', label: 'In Production' },
  { value: 'Estimated Ex-Factory', label: 'Estimated Ex-Factory' },
];

const SHIPPING_APPROVAL_WINDOW_DAYS = 21;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

function getProductionStatusBadgeVariant(status: string | null): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'Submitted': return 'secondary';
    case 'In Production': return 'outline';
    case 'Estimated Ex-Factory': return 'default';
    default: return 'secondary';
  }
}

function getShippingApprovalBadgeVariant(status: string | null): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'approved': return 'default';
    case 'agency_approved':
    case 'requested':
    case 'pending': return 'outline';
    case 'rejected': return 'destructive';
    default: return 'secondary';
  }
}

function getShippingApprovalLabel(status: string | null): string {
  switch (status) {
    case 'approved': return 'Approved';
    case 'agency_approved': return 'Agency Approved';
    case 'requested': return 'Requested';
    case 'pending': return 'Pending';
    case 'rejected': return 'Rejected';
    default: return 'Not Requested';
  }
}

function isWithinShippingWindow(poExFactoryDate: string | null): boolean {
  if (!poExFactoryDate) return false;
  const exFactory = new Date(poExFactoryDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  exFactory.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((exFactory.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  return diffDays <= SHIPPING_APPROVAL_WINDOW_DAYS;
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function ProductionPage() {
  const { hasRole } = useAuth();

  // --- Data state ---
  const [factories, setFactories] = useState<FactoryUser[]>([]);
  const [styles, setStyles] = useState<StyleShippingInfo[]>([]);
  const [loading, setLoading] = useState(true);

  // --- Filters ---
  const [filterPoNumber, setFilterPoNumber] = useState<string>('');
  const [filterFactory, setFilterFactory] = useState<string>('');
  const [filterStyleNumber, setFilterStyleNumber] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterShippingStatus, setFilterShippingStatus] = useState<string>('');
  const [filterExFactoryFrom, setFilterExFactoryFrom] = useState<string>('');
  const [filterExFactoryTo, setFilterExFactoryTo] = useState<string>('');
  const [filterEstExFactoryFrom, setFilterEstExFactoryFrom] = useState<string>('');
  const [filterEstExFactoryTo, setFilterEstExFactoryTo] = useState<string>('');

  // --- Update production status dialog ---
  const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false);
  const [statusDialogStyle, setStatusDialogStyle] = useState<StyleShippingInfo | null>(null);
  const [newProductionStatus, setNewProductionStatus] = useState<string>('');
  const [newEstimatedExFactory, setNewEstimatedExFactory] = useState<string>('');
  const [suggestedShipOptions, setSuggestedShipOptions] = useState<SuggestedShipOption[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  // --- Reject shipping dialog ---
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [rejectDialogStyle, setRejectDialogStyle] = useState<StyleShippingInfo | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [isRejecting, setIsRejecting] = useState(false);

  // --- Action loading state ---
  const [actionLoadingStyleId, setActionLoadingStyleId] = useState<number | null>(null);

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------

  const fetchFactories = useCallback(async () => {
    try {
      const response = await api.get('/factories');
      const list = response.data.factories || response.data.data || response.data || [];
      setFactories(Array.isArray(list) ? list : []);
    } catch {
      // Factories list is optional for filtering
    }
  }, []);

  const fetchShippingApprovals = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { per_page: '100' };
      if (filterPoNumber) params.po_number = filterPoNumber;
      if (filterFactory && filterFactory !== 'all') params.factory_id = filterFactory;
      if (filterStyleNumber) params.style_number = filterStyleNumber;
      if (filterStatus && filterStatus !== 'all') params.production_status = filterStatus;
      if (filterShippingStatus && filterShippingStatus !== 'all') params.shipping_approval_status = filterShippingStatus;
      if (filterExFactoryFrom) params.ex_factory_from = filterExFactoryFrom;
      if (filterExFactoryTo) params.ex_factory_to = filterExFactoryTo;
      if (filterEstExFactoryFrom) params.est_ex_factory_from = filterEstExFactoryFrom;
      if (filterEstExFactoryTo) params.est_ex_factory_to = filterEstExFactoryTo;

      const response = await api.get('/shipping-approvals', { params });
      const data = response.data.data || response.data || [];
      setStyles(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to fetch shipping approvals:', error);
      setStyles([]);
    } finally {
      setLoading(false);
    }
  }, [filterPoNumber, filterFactory, filterStyleNumber, filterStatus, filterShippingStatus, filterExFactoryFrom, filterExFactoryTo, filterEstExFactoryFrom, filterEstExFactoryTo]);

  const fetchSuggestedShipOptions = useCallback(async (date: string) => {
    if (!date) { setSuggestedShipOptions([]); return; }
    setLoadingSuggestions(true);
    try {
      const response = await api.get('/ship-options/suggest', {
        params: { estimated_ex_factory_date: date },
      });
      const options = response.data.ship_options || response.data.data || response.data || [];
      setSuggestedShipOptions(Array.isArray(options) ? options : []);
    } catch {
      setSuggestedShipOptions([]);
    } finally {
      setLoadingSuggestions(false);
    }
  }, []);

  useEffect(() => {
    fetchFactories();
  }, [fetchFactories]);

  useEffect(() => {
    fetchShippingApprovals();
  }, [fetchShippingApprovals]);

  useEffect(() => {
    if (newEstimatedExFactory && newProductionStatus === 'Estimated Ex-Factory') {
      fetchSuggestedShipOptions(newEstimatedExFactory);
    } else {
      setSuggestedShipOptions([]);
    }
  }, [newEstimatedExFactory, newProductionStatus, fetchSuggestedShipOptions]);

  // ---------------------------------------------------------------------------
  // Filter helpers
  // ---------------------------------------------------------------------------

  const resetFilters = () => {
    setFilterPoNumber('');
    setFilterFactory('');
    setFilterStyleNumber('');
    setFilterStatus('');
    setFilterShippingStatus('');
    setFilterExFactoryFrom('');
    setFilterExFactoryTo('');
    setFilterEstExFactoryFrom('');
    setFilterEstExFactoryTo('');
  };

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  const openStatusDialog = (style: StyleShippingInfo) => {
    setStatusDialogStyle(style);
    setNewProductionStatus(style.production_status || '');
    setNewEstimatedExFactory(style.estimated_ex_factory_date || '');
    setSuggestedShipOptions([]);
    setIsStatusDialogOpen(true);
  };

  const handleUpdateProductionStatus = async () => {
    if (!statusDialogStyle || !newProductionStatus) return;
    setIsUpdatingStatus(true);
    try {
      await api.post(
        `/purchase-orders/${statusDialogStyle.purchase_order_id}/styles/${statusDialogStyle.style_id}/production-status`,
        {
          production_status: newProductionStatus,
          estimated_ex_factory_date: newProductionStatus === 'Estimated Ex-Factory' ? newEstimatedExFactory : null,
        }
      );
      setIsStatusDialogOpen(false);
      setStatusDialogStyle(null);
      fetchShippingApprovals();
    } catch (error) {
      console.error('Failed to update production status:', error);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleRequestShippingApproval = async (style: StyleShippingInfo) => {
    setActionLoadingStyleId(style.style_id);
    try {
      await api.post(`/purchase-orders/${style.purchase_order_id}/styles/${style.style_id}/request-shipping-approval`);
      fetchShippingApprovals();
    } catch (error) {
      console.error('Failed to request shipping approval:', error);
    } finally {
      setActionLoadingStyleId(null);
    }
  };

  const handleAgencyApprove = async (style: StyleShippingInfo) => {
    setActionLoadingStyleId(style.style_id);
    try {
      await api.post(`/purchase-orders/${style.purchase_order_id}/styles/${style.style_id}/agency-approve-shipping`);
      fetchShippingApprovals();
    } catch (error) {
      console.error('Failed to approve shipping (agency):', error);
    } finally {
      setActionLoadingStyleId(null);
    }
  };

  const handleImporterApprove = async (style: StyleShippingInfo) => {
    setActionLoadingStyleId(style.style_id);
    try {
      await api.post(`/purchase-orders/${style.purchase_order_id}/styles/${style.style_id}/importer-approve-shipping`);
      fetchShippingApprovals();
    } catch (error) {
      console.error('Failed to approve shipping (importer):', error);
    } finally {
      setActionLoadingStyleId(null);
    }
  };

  const openRejectDialog = (style: StyleShippingInfo) => {
    setRejectDialogStyle(style);
    setRejectReason('');
    setIsRejectDialogOpen(true);
  };

  const handleRejectShipping = async () => {
    if (!rejectDialogStyle || !rejectReason.trim()) return;
    setIsRejecting(true);
    try {
      await api.post(
        `/purchase-orders/${rejectDialogStyle.purchase_order_id}/styles/${rejectDialogStyle.style_id}/reject-shipping`,
        { reason: rejectReason }
      );
      setIsRejectDialogOpen(false);
      setRejectDialogStyle(null);
      setRejectReason('');
      fetchShippingApprovals();
    } catch (error) {
      console.error('Failed to reject shipping:', error);
    } finally {
      setIsRejecting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Computed values
  // ---------------------------------------------------------------------------

  const submittedCount = styles.filter((s) => s.production_status === 'Submitted').length;
  const inProductionCount = styles.filter((s) => s.production_status === 'In Production').length;
  const exFactoryCount = styles.filter((s) => s.production_status === 'Estimated Ex-Factory').length;

  // ---------------------------------------------------------------------------
  // Permission helpers
  // ---------------------------------------------------------------------------

  const canFactoryUpdateStatus = hasRole('Factory');

  const canFactoryRequestShipping = (style: StyleShippingInfo): boolean => {
    if (!hasRole('Factory')) return false;
    if (style.production_status !== 'Estimated Ex-Factory') return false;
    if (style.shipping_approval_status && style.shipping_approval_status !== 'rejected') return false;
    return true;
  };

  const canAgencyApproveShipping = (style: StyleShippingInfo): boolean => {
    if (!hasRole('Agency')) return false;
    return style.shipping_approval_status === 'requested';
  };

  const canImporterApproveShipping = (style: StyleShippingInfo): boolean => {
    if (!hasRole('Importer')) return false;
    return style.shipping_approval_status === 'agency_approved';
  };

  const canRejectShipping = (style: StyleShippingInfo): boolean => {
    if (hasRole('Agency') && style.shipping_approval_status === 'requested') return true;
    if (hasRole('Importer') && style.shipping_approval_status === 'agency_approved') return true;
    return false;
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <DashboardLayout
      requiredPermissions={['production.view', 'production.view_all', 'production.submit', 'production.update']}
      requireAll={false}
    >
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Production Status</h1>
          <p className="text-muted-foreground">
            Track production status and manage shipping approvals per style
          </p>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <Search className="h-4 w-4" /> Filters
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={resetFilters}>
                <RotateCcw className="mr-1 h-3.5 w-3.5" /> Reset
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {/* PO Number */}
              <div className="space-y-1.5">
                <Label className="text-xs">PO Number</Label>
                <Input
                  placeholder="Search PO..."
                  value={filterPoNumber}
                  onChange={(e) => setFilterPoNumber(e.target.value)}
                />
              </div>

              {/* Factory */}
              <div className="space-y-1.5">
                <Label className="text-xs">Factory</Label>
                <Select value={filterFactory} onValueChange={setFilterFactory}>
                  <SelectTrigger><SelectValue placeholder="All Factories" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Factories</SelectItem>
                    {factories.map((f) => (
                      <SelectItem key={f.id} value={f.id.toString()}>
                        {f.company || f.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Style Number */}
              <div className="space-y-1.5">
                <Label className="text-xs">Style Number</Label>
                <Input
                  placeholder="Search style..."
                  value={filterStyleNumber}
                  onChange={(e) => setFilterStyleNumber(e.target.value)}
                />
              </div>

              {/* Production Status */}
              <div className="space-y-1.5">
                <Label className="text-xs">Production Status</Label>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger><SelectValue placeholder="All Statuses" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Statuses</SelectItem>
                    {PRODUCTION_STATUSES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Shipping Approval Status */}
              <div className="space-y-1.5">
                <Label className="text-xs">Shipping Status</Label>
                <Select value={filterShippingStatus} onValueChange={setFilterShippingStatus}>
                  <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="requested">Requested</SelectItem>
                    <SelectItem value="agency_approved">Agency Approved</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Ex-Factory Date Range */}
              <div className="space-y-1.5">
                <Label className="text-xs">PO Ex-Factory From</Label>
                <Input type="date" value={filterExFactoryFrom} onChange={(e) => setFilterExFactoryFrom(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">PO Ex-Factory To</Label>
                <Input type="date" value={filterExFactoryTo} onChange={(e) => setFilterExFactoryTo(e.target.value)} />
              </div>

              {/* Est. Ex-Factory Date Range */}
              <div className="space-y-1.5">
                <Label className="text-xs">Est. Ex-Factory From</Label>
                <Input type="date" value={filterEstExFactoryFrom} onChange={(e) => setFilterEstExFactoryFrom(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Est. Ex-Factory To</Label>
                <Input type="date" value={filterEstExFactoryTo} onChange={(e) => setFilterEstExFactoryTo(e.target.value)} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Status Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Submitted</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{submittedCount}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">In Production</CardTitle>
              <FactoryIcon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{inProductionCount}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Estimated Ex-Factory</CardTitle>
              <CalendarClock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{exFactoryCount}</div></CardContent>
          </Card>
        </div>

        {/* Styles Table */}
        <Card>
          <CardHeader>
            <CardTitle>Styles &amp; Shipping Status</CardTitle>
            <CardDescription>
              {styles.length} style{styles.length !== 1 ? 's' : ''} found
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex h-96 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>PO Number</TableHead>
                    <TableHead>Style</TableHead>
                    <TableHead>Factory</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead>PO Ex-Factory</TableHead>
                    <TableHead>Est. Ex-Factory</TableHead>
                    <TableHead>Production Status</TableHead>
                    <TableHead>Ship Option</TableHead>
                    <TableHead>Shipping Approval</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {styles.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center text-muted-foreground">
                        No styles found
                      </TableCell>
                    </TableRow>
                  ) : (
                    styles.map((style) => {
                      const withinWindow = isWithinShippingWindow(style.po_ex_factory_date || style.ex_factory_date);
                      const isActionLoading = actionLoadingStyleId === style.style_id;

                      return (
                        <TableRow key={style.pivot_id}>
                          <TableCell className="font-medium text-sm">{style.po_number || '-'}</TableCell>
                          <TableCell className="font-medium">{style.style_number || '-'}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{style.factory_name || '-'}</TableCell>
                          <TableCell className="text-right">
                            {style.quantity_in_po?.toLocaleString() ?? '-'}
                          </TableCell>
                          <TableCell>{formatDate(style.po_ex_factory_date || style.ex_factory_date)}</TableCell>
                          <TableCell>
                            {style.estimated_ex_factory_date ? (
                              <span className="flex items-center gap-1">
                                <CalendarClock className="h-3.5 w-3.5 text-muted-foreground" />
                                {formatDate(style.estimated_ex_factory_date)}
                              </span>
                            ) : '-'}
                          </TableCell>
                          <TableCell>
                            <Badge variant={getProductionStatusBadgeVariant(style.production_status)}>
                              {style.production_status || 'Not Set'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {style.suggested_ship_option ? (
                              <div className="flex items-center gap-1 text-sm">
                                <Ship className="h-3.5 w-3.5 text-muted-foreground" />
                                {style.suggested_ship_option.name}
                                {style.suggested_ship_option.etd && (
                                  <span className="text-xs text-muted-foreground ml-1">
                                    ETD: {formatDate(style.suggested_ship_option.etd)}
                                  </span>
                                )}
                              </div>
                            ) : '-'}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              <Badge variant={getShippingApprovalBadgeVariant(style.shipping_approval_status)}>
                                {getShippingApprovalLabel(style.shipping_approval_status)}
                              </Badge>
                              {style.shipping_approval_status === 'rejected' && style.shipping_approval_rejection_reason && (
                                <p className="text-xs text-destructive">
                                  {style.shipping_approval_rejection_reason}
                                </p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex flex-wrap justify-end gap-1">
                              {canFactoryUpdateStatus && (
                                <Button variant="outline" size="sm" onClick={() => openStatusDialog(style)}>
                                  <Package className="mr-1 h-4 w-4" /> Update
                                </Button>
                              )}
                              {canFactoryRequestShipping(style) && (
                                <Button
                                  variant="outline" size="sm"
                                  onClick={() => handleRequestShippingApproval(style)}
                                  disabled={isActionLoading || !withinWindow}
                                  title={!withinWindow ? `Only within ${SHIPPING_APPROVAL_WINDOW_DAYS} days of PO ex-factory` : undefined}
                                >
                                  {isActionLoading ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Send className="mr-1 h-4 w-4" />}
                                  Request
                                </Button>
                              )}
                              {canAgencyApproveShipping(style) && (
                                <Button
                                  variant="ghost" size="sm" className="text-green-600 hover:text-green-700"
                                  onClick={() => handleAgencyApprove(style)} disabled={isActionLoading}
                                >
                                  <CheckCircle className="mr-1 h-4 w-4" /> Approve
                                </Button>
                              )}
                              {canImporterApproveShipping(style) && (
                                <Button
                                  variant="ghost" size="sm" className="text-green-600 hover:text-green-700"
                                  onClick={() => handleImporterApprove(style)} disabled={isActionLoading}
                                >
                                  <ShieldCheck className="mr-1 h-4 w-4" /> Final Approve
                                </Button>
                              )}
                              {canRejectShipping(style) && (
                                <Button
                                  variant="ghost" size="sm" className="text-red-600 hover:text-red-700"
                                  onClick={() => openRejectDialog(style)} disabled={isActionLoading}
                                >
                                  <XCircle className="mr-1 h-4 w-4" /> Reject
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Dialog: Update Production Status */}
        <Dialog open={isStatusDialogOpen} onOpenChange={setIsStatusDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Update Production Status</DialogTitle>
              <DialogDescription>
                {statusDialogStyle ? `Style: ${statusDialogStyle.style_number}` : ''}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Production Status *</Label>
                <Select value={newProductionStatus} onValueChange={setNewProductionStatus}>
                  <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
                  <SelectContent>
                    {PRODUCTION_STATUSES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {newProductionStatus === 'Estimated Ex-Factory' && (
                <div className="space-y-2">
                  <Label>Estimated Ex-Factory Date *</Label>
                  <Input type="date" value={newEstimatedExFactory} onChange={(e) => setNewEstimatedExFactory(e.target.value)} />
                </div>
              )}

              {newProductionStatus === 'Estimated Ex-Factory' && newEstimatedExFactory && (
                <div className="space-y-2">
                  <Label>Suggested Ship Options</Label>
                  {loadingSuggestions ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" /> Loading...
                    </div>
                  ) : suggestedShipOptions.length > 0 ? (
                    <div className="space-y-2">
                      {suggestedShipOptions.map((option) => (
                        <div key={option.id} className="flex items-center justify-between rounded-md border p-3 text-sm">
                          <div className="flex items-center gap-2">
                            <Ship className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{option.name}</span>
                          </div>
                          <span className="text-muted-foreground text-xs">
                            ETD: {formatDate(option.etd)} | ETA: {formatDate(option.eta)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No ship options available for this date.</p>
                  )}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsStatusDialogOpen(false)}>Cancel</Button>
              <Button
                disabled={isUpdatingStatus || !newProductionStatus || (newProductionStatus === 'Estimated Ex-Factory' && !newEstimatedExFactory)}
                onClick={handleUpdateProductionStatus}
              >
                {isUpdatingStatus ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Updating...</> : 'Update Status'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog: Reject Shipping */}
        <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reject Shipping</DialogTitle>
              <DialogDescription>
                {rejectDialogStyle ? `Style: ${rejectDialogStyle.style_number}` : ''}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Reason (Required)</Label>
                <textarea
                  className="flex min-h-[100px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  placeholder="Provide the reason for rejection..."
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setIsRejectDialogOpen(false); setRejectReason(''); }}>Cancel</Button>
              <Button variant="destructive" disabled={isRejecting || !rejectReason.trim()} onClick={handleRejectShipping}>
                {isRejecting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Rejecting...</> : <><XCircle className="mr-2 h-4 w-4" /> Reject</>}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
