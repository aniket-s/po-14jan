'use client';

// Disable static generation for this authenticated page
export const dynamic = 'force-dynamic';

import { useEffect, useState, useCallback } from 'react';
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
  Loader2,
  Factory,
  CheckCircle,
  XCircle,
  Clock,
  Ship,
  CalendarClock,
  AlertCircle,
  Send,
  ShieldCheck,
  Package,
} from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PurchaseOrder {
  id: number;
  po_number: string;
  ex_factory_date: string | null;
  buyer_name?: string;
  status?: string;
}

interface StyleShippingInfo {
  style_id: number;
  style_number: string;
  quantity: number;
  po_ex_factory_date: string | null;
  production_status: string | null;
  estimated_ex_factory_date: string | null;
  suggested_ship_option: SuggestedShipOption | null;
  shipping_approval_status: string | null;
  agency_approved: boolean;
  importer_approved: boolean;
  rejection_reason: string | null;
}

interface SuggestedShipOption {
  id: number;
  name: string;
  carrier?: string;
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
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function getProductionStatusBadgeVariant(
  status: string | null
): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'Submitted':
      return 'secondary';
    case 'In Production':
      return 'outline';
    case 'Estimated Ex-Factory':
      return 'default';
    default:
      return 'secondary';
  }
}

function getShippingApprovalBadgeVariant(
  status: string | null
): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'approved':
      return 'default';
    case 'pending_agency':
    case 'pending_importer':
    case 'pending':
      return 'outline';
    case 'rejected':
      return 'destructive';
    default:
      return 'secondary';
  }
}

function getShippingApprovalLabel(status: string | null): string {
  switch (status) {
    case 'approved':
      return 'Approved';
    case 'pending_agency':
      return 'Pending Agency';
    case 'pending_importer':
      return 'Pending Importer';
    case 'pending':
      return 'Pending';
    case 'rejected':
      return 'Rejected';
    default:
      return 'Not Requested';
  }
}

function isWithinShippingWindow(poExFactoryDate: string | null): boolean {
  if (!poExFactoryDate) return false;
  const exFactory = new Date(poExFactoryDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  exFactory.setHours(0, 0, 0, 0);
  const diffMs = exFactory.getTime() - today.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  return diffDays <= SHIPPING_APPROVAL_WINDOW_DAYS;
}

// ---------------------------------------------------------------------------
// Page Component
// ---------------------------------------------------------------------------

export default function ProductionPage() {
  const { hasRole } = useAuth();

  // --- Data state ---
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [selectedPoId, setSelectedPoId] = useState<string>('');
  const [styles, setStyles] = useState<StyleShippingInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingPOs, setLoadingPOs] = useState(true);

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

  const fetchPurchaseOrders = useCallback(async () => {
    setLoadingPOs(true);
    try {
      const response = await api.get('/purchase-orders');
      const poList =
        response.data.purchase_orders || response.data.data || response.data || [];
      setPurchaseOrders(Array.isArray(poList) ? poList : []);
    } catch (error) {
      console.error('Failed to fetch purchase orders:', error);
    } finally {
      setLoadingPOs(false);
    }
  }, []);

  const fetchShippingApprovals = useCallback(async (poId: string) => {
    if (!poId) {
      setStyles([]);
      return;
    }
    setLoading(true);
    try {
      const response = await api.get(`/purchase-orders/${poId}/shipping-approvals`);
      const data =
        response.data.styles || response.data.data || response.data || [];
      setStyles(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to fetch shipping approvals:', error);
      setStyles([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSuggestedShipOptions = useCallback(async (date: string) => {
    if (!date) {
      setSuggestedShipOptions([]);
      return;
    }
    setLoadingSuggestions(true);
    try {
      const response = await api.get('/ship-options/suggest', {
        params: { estimated_ex_factory_date: date },
      });
      const options =
        response.data.ship_options || response.data.data || response.data || [];
      setSuggestedShipOptions(Array.isArray(options) ? options : []);
    } catch (error) {
      console.error('Failed to fetch suggested ship options:', error);
      setSuggestedShipOptions([]);
    } finally {
      setLoadingSuggestions(false);
    }
  }, []);

  useEffect(() => {
    fetchPurchaseOrders();
  }, [fetchPurchaseOrders]);

  useEffect(() => {
    if (selectedPoId) {
      fetchShippingApprovals(selectedPoId);
    } else {
      setStyles([]);
    }
  }, [selectedPoId, fetchShippingApprovals]);

  // Fetch ship option suggestions when estimated ex-factory date changes in the dialog
  useEffect(() => {
    if (newEstimatedExFactory && newProductionStatus === 'Estimated Ex-Factory') {
      fetchSuggestedShipOptions(newEstimatedExFactory);
    } else {
      setSuggestedShipOptions([]);
    }
  }, [newEstimatedExFactory, newProductionStatus, fetchSuggestedShipOptions]);

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
    if (!statusDialogStyle || !selectedPoId || !newProductionStatus) return;

    setIsUpdatingStatus(true);
    try {
      await api.post(
        `/purchase-orders/${selectedPoId}/styles/${statusDialogStyle.style_id}/production-status`,
        {
          production_status: newProductionStatus,
          estimated_ex_factory_date:
            newProductionStatus === 'Estimated Ex-Factory' ? newEstimatedExFactory : null,
        }
      );
      setIsStatusDialogOpen(false);
      setStatusDialogStyle(null);
      setNewProductionStatus('');
      setNewEstimatedExFactory('');
      setSuggestedShipOptions([]);
      fetchShippingApprovals(selectedPoId);
    } catch (error) {
      console.error('Failed to update production status:', error);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleRequestShippingApproval = async (style: StyleShippingInfo) => {
    if (!selectedPoId) return;
    setActionLoadingStyleId(style.style_id);
    try {
      await api.post(
        `/purchase-orders/${selectedPoId}/styles/${style.style_id}/request-shipping-approval`
      );
      fetchShippingApprovals(selectedPoId);
    } catch (error) {
      console.error('Failed to request shipping approval:', error);
    } finally {
      setActionLoadingStyleId(null);
    }
  };

  const handleAgencyApprove = async (style: StyleShippingInfo) => {
    if (!selectedPoId) return;
    setActionLoadingStyleId(style.style_id);
    try {
      await api.post(
        `/purchase-orders/${selectedPoId}/styles/${style.style_id}/agency-approve-shipping`
      );
      fetchShippingApprovals(selectedPoId);
    } catch (error) {
      console.error('Failed to approve shipping (agency):', error);
    } finally {
      setActionLoadingStyleId(null);
    }
  };

  const handleImporterApprove = async (style: StyleShippingInfo) => {
    if (!selectedPoId) return;
    setActionLoadingStyleId(style.style_id);
    try {
      await api.post(
        `/purchase-orders/${selectedPoId}/styles/${style.style_id}/importer-approve-shipping`
      );
      fetchShippingApprovals(selectedPoId);
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
    if (!rejectDialogStyle || !selectedPoId || !rejectReason.trim()) return;

    setIsRejecting(true);
    try {
      await api.post(
        `/purchase-orders/${selectedPoId}/styles/${rejectDialogStyle.style_id}/reject-shipping`,
        { reason: rejectReason }
      );
      setIsRejectDialogOpen(false);
      setRejectDialogStyle(null);
      setRejectReason('');
      fetchShippingApprovals(selectedPoId);
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
  const exFactoryCount = styles.filter(
    (s) => s.production_status === 'Estimated Ex-Factory'
  ).length;

  // ---------------------------------------------------------------------------
  // Permission helpers per style
  // ---------------------------------------------------------------------------

  const canFactoryUpdateStatus = hasRole('Factory');

  const canFactoryRequestShipping = (style: StyleShippingInfo): boolean => {
    if (!hasRole('Factory')) return false;
    if (style.production_status !== 'Estimated Ex-Factory') return false;
    if (
      style.shipping_approval_status &&
      style.shipping_approval_status !== 'rejected'
    )
      return false;
    return true;
  };

  const canAgencyApproveShipping = (style: StyleShippingInfo): boolean => {
    if (!hasRole('Agency')) return false;
    if (
      style.shipping_approval_status !== 'pending_agency' &&
      style.shipping_approval_status !== 'pending'
    )
      return false;
    if (style.agency_approved) return false;
    return true;
  };

  const canAgencyRejectShipping = (style: StyleShippingInfo): boolean => {
    return canAgencyApproveShipping(style);
  };

  const canImporterApproveShipping = (style: StyleShippingInfo): boolean => {
    if (!hasRole('Importer')) return false;
    if (style.shipping_approval_status !== 'pending_importer') return false;
    if (!style.agency_approved) return false;
    if (style.importer_approved) return false;
    return true;
  };

  const canImporterRejectShipping = (style: StyleShippingInfo): boolean => {
    return canImporterApproveShipping(style);
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <DashboardLayout
      requiredPermissions={[
        'production.view',
        'production.view_all',
        'production.submit',
        'production.update',
      ]}
      requireAll={false}
    >
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Production Status</h1>
            <p className="text-muted-foreground">
              Track production status and manage shipping approvals per style
            </p>
          </div>
        </div>

        {/* PO Selector */}
        <Card>
          <CardHeader>
            <CardTitle>Select Purchase Order</CardTitle>
            <CardDescription>Choose a PO to view production and shipping status</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingPOs ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading purchase orders...
              </div>
            ) : (
              <Select value={selectedPoId} onValueChange={setSelectedPoId}>
                <SelectTrigger className="w-full md:w-[400px]">
                  <SelectValue placeholder="Select a purchase order" />
                </SelectTrigger>
                <SelectContent>
                  {purchaseOrders.map((po) => (
                    <SelectItem key={po.id} value={po.id.toString()}>
                      {po.po_number}
                      {po.buyer_name ? ` - ${po.buyer_name}` : ''}
                      {po.ex_factory_date ? ` (Ex-Factory: ${formatDate(po.ex_factory_date)})` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </CardContent>
        </Card>

        {/* Status Cards */}
        {selectedPoId && (
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Submitted</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{submittedCount}</div>
                <p className="text-xs text-muted-foreground">Styles submitted</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">In Production</CardTitle>
                <Factory className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{inProductionCount}</div>
                <p className="text-xs text-muted-foreground">Styles in production</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Estimated Ex-Factory</CardTitle>
                <CalendarClock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{exFactoryCount}</div>
                <p className="text-xs text-muted-foreground">Styles with ex-factory date set</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Business Rule Info */}
        {selectedPoId && (
          <div className="rounded-lg border bg-muted/50 p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 text-muted-foreground" />
              <div className="text-sm">
                <p className="font-medium">Shipping Approval Workflow</p>
                <p className="mt-1 text-muted-foreground">
                  Shipping approval can only be requested within {SHIPPING_APPROVAL_WINDOW_DAYS} days
                  of the PO ex-factory date. Once requested, the Agency reviews first, followed by
                  final Importer approval. Either party may reject with a reason.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Styles Table */}
        {selectedPoId && (
          <Card>
            <CardHeader>
              <CardTitle>Styles &amp; Shipping Status</CardTitle>
              <CardDescription>
                Production status and shipping approval details for each style
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
                      <TableHead>Style</TableHead>
                      <TableHead className="text-right">Quantity</TableHead>
                      <TableHead>PO Ex-Factory</TableHead>
                      <TableHead>Est. Ex-Factory</TableHead>
                      <TableHead>Production Status</TableHead>
                      <TableHead>Suggested Ship Option</TableHead>
                      <TableHead>Shipping Approval</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {styles.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground">
                          No styles found for this purchase order
                        </TableCell>
                      </TableRow>
                    ) : (
                      styles.map((style) => {
                        const withinWindow = isWithinShippingWindow(style.po_ex_factory_date);
                        const isActionLoading = actionLoadingStyleId === style.style_id;

                        return (
                          <TableRow key={style.style_id}>
                            {/* Style Number */}
                            <TableCell className="font-medium">{style.style_number}</TableCell>

                            {/* Quantity */}
                            <TableCell className="text-right">
                              {style.quantity?.toLocaleString() ?? '-'}
                            </TableCell>

                            {/* PO Ex-Factory Date */}
                            <TableCell>{formatDate(style.po_ex_factory_date)}</TableCell>

                            {/* Estimated Ex-Factory Date */}
                            <TableCell>
                              {style.estimated_ex_factory_date ? (
                                <span className="flex items-center gap-1">
                                  <CalendarClock className="h-3.5 w-3.5 text-muted-foreground" />
                                  {formatDate(style.estimated_ex_factory_date)}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>

                            {/* Production Status */}
                            <TableCell>
                              <Badge
                                variant={getProductionStatusBadgeVariant(style.production_status)}
                              >
                                {style.production_status || 'Not Set'}
                              </Badge>
                            </TableCell>

                            {/* Suggested Ship Option */}
                            <TableCell>
                              {style.suggested_ship_option ? (
                                <div className="flex items-center gap-1">
                                  <Ship className="h-3.5 w-3.5 text-muted-foreground" />
                                  <span className="text-sm">
                                    {style.suggested_ship_option.name}
                                    {style.suggested_ship_option.estimated_transit_days
                                      ? ` (${style.suggested_ship_option.estimated_transit_days}d)`
                                      : ''}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>

                            {/* Shipping Approval Status */}
                            <TableCell>
                              <div className="flex flex-col gap-1">
                                <Badge
                                  variant={getShippingApprovalBadgeVariant(
                                    style.shipping_approval_status
                                  )}
                                >
                                  {getShippingApprovalLabel(style.shipping_approval_status)}
                                </Badge>
                                {style.shipping_approval_status === 'approved' && (
                                  <div className="flex items-center gap-1 text-xs text-green-600">
                                    <ShieldCheck className="h-3 w-3" />
                                    Fully Approved
                                  </div>
                                )}
                                {style.shipping_approval_status === 'rejected' &&
                                  style.rejection_reason && (
                                    <p className="text-xs text-destructive">
                                      Reason: {style.rejection_reason}
                                    </p>
                                  )}
                              </div>
                            </TableCell>

                            {/* Actions */}
                            <TableCell className="text-right">
                              <div className="flex flex-wrap justify-end gap-1">
                                {/* Factory: Update Production Status */}
                                {canFactoryUpdateStatus && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => openStatusDialog(style)}
                                  >
                                    <Package className="mr-1 h-4 w-4" />
                                    Update Status
                                  </Button>
                                )}

                                {/* Factory: Request Shipping Approval */}
                                {canFactoryRequestShipping(style) && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleRequestShippingApproval(style)}
                                    disabled={isActionLoading || !withinWindow}
                                    title={
                                      !withinWindow
                                        ? `Shipping approval can only be requested within ${SHIPPING_APPROVAL_WINDOW_DAYS} days of PO ex-factory date`
                                        : undefined
                                    }
                                  >
                                    {isActionLoading ? (
                                      <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                                    ) : (
                                      <Send className="mr-1 h-4 w-4" />
                                    )}
                                    Request Shipping
                                  </Button>
                                )}

                                {/* Agency: Approve Shipping */}
                                {canAgencyApproveShipping(style) && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-green-600 hover:text-green-700"
                                    onClick={() => handleAgencyApprove(style)}
                                    disabled={isActionLoading}
                                  >
                                    {isActionLoading ? (
                                      <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                                    ) : (
                                      <CheckCircle className="mr-1 h-4 w-4" />
                                    )}
                                    Agency Approve
                                  </Button>
                                )}

                                {/* Agency: Reject Shipping */}
                                {canAgencyRejectShipping(style) && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-red-600 hover:text-red-700"
                                    onClick={() => openRejectDialog(style)}
                                    disabled={isActionLoading}
                                  >
                                    <XCircle className="mr-1 h-4 w-4" />
                                    Reject
                                  </Button>
                                )}

                                {/* Importer: Final Approve */}
                                {canImporterApproveShipping(style) && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-green-600 hover:text-green-700"
                                    onClick={() => handleImporterApprove(style)}
                                    disabled={isActionLoading}
                                  >
                                    {isActionLoading ? (
                                      <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                                    ) : (
                                      <ShieldCheck className="mr-1 h-4 w-4" />
                                    )}
                                    Final Approve
                                  </Button>
                                )}

                                {/* Importer: Reject Shipping */}
                                {canImporterRejectShipping(style) && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-red-600 hover:text-red-700"
                                    onClick={() => openRejectDialog(style)}
                                    disabled={isActionLoading}
                                  >
                                    <XCircle className="mr-1 h-4 w-4" />
                                    Reject
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
        )}

        {/* ----------------------------------------------------------------- */}
        {/* Dialog: Update Production Status                                   */}
        {/* ----------------------------------------------------------------- */}
        <Dialog open={isStatusDialogOpen} onOpenChange={setIsStatusDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Update Production Status</DialogTitle>
              <DialogDescription>
                {statusDialogStyle
                  ? `Style: ${statusDialogStyle.style_number}`
                  : 'Update the production status and estimated ex-factory date'}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              {/* Production Status Select */}
              <div className="space-y-2">
                <Label htmlFor="production_status">Production Status *</Label>
                <Select value={newProductionStatus} onValueChange={setNewProductionStatus}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {PRODUCTION_STATUSES.map((status) => (
                      <SelectItem key={status.value} value={status.value}>
                        {status.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Estimated Ex-Factory Date (shown when status is "Estimated Ex-Factory") */}
              {newProductionStatus === 'Estimated Ex-Factory' && (
                <div className="space-y-2">
                  <Label htmlFor="estimated_ex_factory_date">Estimated Ex-Factory Date *</Label>
                  <Input
                    id="estimated_ex_factory_date"
                    type="date"
                    value={newEstimatedExFactory}
                    onChange={(e) => setNewEstimatedExFactory(e.target.value)}
                  />
                </div>
              )}

              {/* Auto-Suggested Ship Options */}
              {newProductionStatus === 'Estimated Ex-Factory' && newEstimatedExFactory && (
                <div className="space-y-2">
                  <Label>Suggested Ship Options</Label>
                  {loadingSuggestions ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading suggestions...
                    </div>
                  ) : suggestedShipOptions.length > 0 ? (
                    <div className="space-y-2">
                      {suggestedShipOptions.map((option) => (
                        <div
                          key={option.id}
                          className="flex items-center justify-between rounded-md border p-3 text-sm"
                        >
                          <div className="flex items-center gap-2">
                            <Ship className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{option.name}</span>
                            {option.carrier && (
                              <span className="text-muted-foreground">({option.carrier})</span>
                            )}
                          </div>
                          <div className="text-right text-muted-foreground">
                            {option.estimated_transit_days && (
                              <span>{option.estimated_transit_days} days transit</span>
                            )}
                            {option.estimated_arrival_date && (
                              <span className="ml-2">
                                ETA: {formatDate(option.estimated_arrival_date)}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No ship options available for this date.
                    </p>
                  )}
                </div>
              )}

              {/* Info box */}
              <div className="rounded-lg bg-muted p-3 text-sm">
                <p className="font-medium flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Production Workflow
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Set the status to &quot;Estimated Ex-Factory&quot; with a date to see auto-suggested
                  shipping options. You can then request shipping approval once ready.
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsStatusDialogOpen(false);
                  setStatusDialogStyle(null);
                  setNewProductionStatus('');
                  setNewEstimatedExFactory('');
                  setSuggestedShipOptions([]);
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={
                  isUpdatingStatus ||
                  !newProductionStatus ||
                  (newProductionStatus === 'Estimated Ex-Factory' && !newEstimatedExFactory)
                }
                onClick={handleUpdateProductionStatus}
              >
                {isUpdatingStatus ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Updating...
                  </>
                ) : (
                  <>
                    <Factory className="mr-2 h-4 w-4" />
                    Update Status
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ----------------------------------------------------------------- */}
        {/* Dialog: Reject Shipping                                            */}
        {/* ----------------------------------------------------------------- */}
        <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reject Shipping</DialogTitle>
              <DialogDescription>
                {rejectDialogStyle
                  ? `Rejecting shipping for style: ${rejectDialogStyle.style_number}`
                  : 'Provide a reason for rejecting the shipping approval request.'}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="reject_reason">Reason (Required)</Label>
                <textarea
                  id="reject_reason"
                  className="flex min-h-[100px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  placeholder="Provide the reason for rejection..."
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsRejectDialogOpen(false);
                  setRejectDialogStyle(null);
                  setRejectReason('');
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={isRejecting || !rejectReason.trim()}
                onClick={handleRejectShipping}
              >
                {isRejecting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Rejecting...
                  </>
                ) : (
                  <>
                    <XCircle className="mr-2 h-4 w-4" />
                    Reject Shipping
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
