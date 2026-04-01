'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useSystemSettings } from '@/hooks/useSystemSettings';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  ArrowLeft,
  Plus,
  Edit,
  Trash2,
  Loader2,
  Package,
  Factory,
  ClipboardCheck,
  Truck,
  FileText,
  FileUp,
  ListCheck,
} from 'lucide-react';
import api from '@/lib/api';
import { DetailPageSkeleton } from '@/components/skeletons';
import { PurchaseOrder, Style } from '@/types';
import { StyleSelectorDialog } from '@/components/purchase-orders/StyleSelectorDialog';
import { AssignmentSelector } from '@/components/styles/AssignmentSelector';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatDate, calculateDaysRemaining, formatDaysRemaining } from '@/lib/dateUtils';

export default function PurchaseOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const poId = params.id as string;
  const { user, hasRole, can } = useAuth();
  const { getSetting, loading: settingsLoading } = useSystemSettings();

  const [purchaseOrder, setPurchaseOrder] = useState<PurchaseOrder | null>(null);
  const [styles, setStyles] = useState<Style[]>([]);
  const [loading, setLoading] = useState(true);
  const [isStyleSelectorOpen, setIsStyleSelectorOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Factory assignment dialog state
  const [isAssignFactoryDialogOpen, setIsAssignFactoryDialogOpen] = useState(false);
  const [selectedStyleForAssignment, setSelectedStyleForAssignment] = useState<Style | null>(null);
  const [assignmentTypeForDialog, setAssignmentTypeForDialog] = useState<'direct_to_factory' | 'via_agency' | null>(null);
  const [assignedFactoryIdForDialog, setAssignedFactoryIdForDialog] = useState<number | null>(null);
  const [assignedAgencyIdForDialog, setAssignedAgencyIdForDialog] = useState<number | null>(null);

  useEffect(() => {
    fetchPurchaseOrder();
    fetchStyles();
  }, [poId]);

  const fetchPurchaseOrder = async () => {
    try {
      const response = await api.get<{ purchase_order: PurchaseOrder }>(`/purchase-orders/${poId}`);
      setPurchaseOrder(response.data.purchase_order);
    } catch (error) {
      console.error('Failed to fetch purchase order:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStyles = async () => {
    try {
      const response = await api.get<{ styles: Style[] }>(`/purchase-orders/${poId}/styles`);
      setStyles(response.data.styles || []);
    } catch (error) {
      console.error('Failed to fetch styles:', error);
      setStyles([]); // Set empty array on error to prevent undefined
    }
  };

  const handleDeleteStyle = async (styleId: number) => {
    if (!confirm('Are you sure you want to delete this style?')) {
      return;
    }

    try {
      await api.delete(`/styles/${styleId}`);
      fetchStyles();
      fetchPurchaseOrder(); // Refresh to update totals
    } catch (error) {
      console.error('Failed to delete style:', error);
    }
  };

  const handleOpenAssignFactory = (style: Style) => {
    setSelectedStyleForAssignment(style);
    setAssignmentTypeForDialog(style.pivot?.assignment_type ?? null);
    setAssignedFactoryIdForDialog(style.pivot?.assigned_factory_id ?? null);
    setAssignedAgencyIdForDialog(style.pivot?.assigned_agency_id ?? null);
    setIsAssignFactoryDialogOpen(true);
  };

  const handleAssignFactory = async () => {
    if (!selectedStyleForAssignment) return;

    setIsSubmitting(true);
    try {
      await api.post(`/purchase-orders/${poId}/styles/${selectedStyleForAssignment.id}/assign-factory`, {
        assignment_type: assignmentTypeForDialog,
        assigned_factory_id: assignedFactoryIdForDialog,
        assigned_agency_id: assignedAgencyIdForDialog,
      });
      setIsAssignFactoryDialogOpen(false);
      setSelectedStyleForAssignment(null);
      setAssignmentTypeForDialog(null);
      setAssignedFactoryIdForDialog(null);
      setAssignedAgencyIdForDialog(null);
      fetchStyles();
    } catch (error) {
      console.error('Failed to assign factory:', error);
      alert('Failed to assign factory. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStylesSelected = async (selectedStyles: any[]) => {
    try {
      setIsSubmitting(true);
      await api.post(`/purchase-orders/${poId}/styles/attach`, {
        styles: selectedStyles.map(style => ({
          style_id: style.id,
          quantity_in_po: style.quantity_in_po,
          unit_price_in_po: style.unit_price_in_po,
          shipping_term: style.shipping_term, // Changed from price_term
          size_breakdown: style.size_breakdown,
          status: 'pending'
        }))
      });
      fetchStyles();
      fetchPurchaseOrder(); // Refresh to update totals
    } catch (error) {
      console.error('Failed to attach styles:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatCurrency = (value: number | null | undefined, currency: string) => {
    if (value === null || value === undefined) {
      return '-';
    }
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
      minimumFractionDigits: 2,
    }).format(value);
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      draft: 'secondary',
      confirmed: 'default',
      in_production: 'default',
      completed: 'secondary',
      cancelled: 'destructive',
    };
    return colors[status] || 'secondary';
  };

  // Check if current user can create styles
  const canCreateStyle = () => {
    if (!can('style.create')) {
      return false;
    }

    // Admins and importers can always create styles
    if (hasRole('Super Admin') || hasRole('Importer')) {
      return true;
    }

    // Agencies can only create if the setting allows it
    if (hasRole('Agency')) {
      const agencyUploadEnabled = getSetting('agency_style_upload_enabled', true);
      return agencyUploadEnabled;
    }

    // Other roles with style.create permission
    return true;
  };

  if (loading) {
    return (
      <DashboardLayout requiredPermissions={['po.view', 'po.view_all', 'po.view_own']} requireAll={false}>
        <DetailPageSkeleton />
      </DashboardLayout>
    );
  }

  if (!purchaseOrder) {
    return (
      <DashboardLayout requiredPermissions={['po.view', 'po.view_all', 'po.view_own']} requireAll={false}>
        <div className="flex h-96 flex-col items-center justify-center">
          <p className="text-lg text-muted-foreground">Purchase order not found</p>
          <Button className="mt-4" onClick={() => router.push('/purchase-orders')}>
            Back to Purchase Orders
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout requiredPermissions={['po.view', 'po.view_all', 'po.view_own']} requireAll={false}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.push('/purchase-orders')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{purchaseOrder.po_number}</h1>
              {purchaseOrder.headline && (
                <p className="text-lg font-medium text-foreground mt-1">{purchaseOrder.headline}</p>
              )}
              <p className="text-muted-foreground mt-1">Purchase Order Details</p>
            </div>
          </div>
          <div className="flex gap-2">
            {can('po.edit') && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push(`/purchase-orders/${poId}/edit`)}
              >
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </Button>
            )}
            {can('po.export') && (
              <Button variant="outline" size="sm">
                <FileText className="mr-2 h-4 w-4" />
                Export
              </Button>
            )}
            <Button
              variant="default"
              size="sm"
              className="bg-[#217346] hover:bg-[#1a5c38]"
              onClick={() => router.push(`/purchase-orders/${poId}/spreadsheet`)}
            >
              <FileText className="mr-2 h-4 w-4" />
              Spreadsheet
            </Button>
          </div>
        </div>

        {/* Overview Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Status</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <Badge variant={getStatusColor(purchaseOrder.status) as any} className="text-sm">
                {purchaseOrder.status.replace('_', ' ')}
              </Badge>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Quantity</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {purchaseOrder.total_quantity.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">
                {styles?.length || 0} {(styles?.length || 0) === 1 ? 'style' : 'styles'}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Value</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(purchaseOrder.total_value, purchaseOrder.currency)}
              </div>
              <p className="text-xs text-muted-foreground">{purchaseOrder.currency}</p>
            </CardContent>
          </Card>

        </div>

        {/* Tabs */}
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="styles">Styles</TabsTrigger>
            <TabsTrigger value="assignments">Factory Assignments</TabsTrigger>
            <TabsTrigger value="samples">Samples</TabsTrigger>
            <TabsTrigger value="production">Production</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>Order Information</CardTitle>
                  <CardDescription>Basic purchase order details</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">PO Number</span>
                    <span className="text-sm font-medium">{purchaseOrder.po_number}</span>
                  </div>
                  {purchaseOrder.headline && (
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Headline</span>
                      <span className="text-sm font-medium">{purchaseOrder.headline}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">PO Date</span>
                    <span className="text-sm font-medium">{formatDate(purchaseOrder.po_date)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Currency</span>
                    <span className="text-sm font-medium">{purchaseOrder.currency}</span>
                  </div>
                  {purchaseOrder.payment_terms && (
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Payment Terms</span>
                      <span className="text-sm font-medium">{purchaseOrder.payment_terms}</span>
                    </div>
                  )}
                  {purchaseOrder.shipping_method && (
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Shipping Method</span>
                      <span className="text-sm font-medium">{purchaseOrder.shipping_method}</span>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Parties</CardTitle>
                  <CardDescription>Importer and agency information</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <span className="text-sm text-muted-foreground">Importer</span>
                    <p className="text-sm font-medium">{purchaseOrder.importer?.name || 'N/A'}</p>
                    <p className="text-xs text-muted-foreground">
                      {purchaseOrder.importer?.email}
                    </p>
                  </div>
                  {purchaseOrder.agency && (
                    <div>
                      <span className="text-sm text-muted-foreground">Agency</span>
                      <p className="text-sm font-medium">{purchaseOrder.agency.name}</p>
                      <p className="text-xs text-muted-foreground">{purchaseOrder.agency.email}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Shipping & Dates Section */}
            {(() => {
              // FOB/DDP conditional display: Check if any styles have DDP shipping term
              // FOB = shows only ETD, DDP = shows ETD, ETA, In-warehouse
              const hasDDPStyles = styles.some((style: any) => style.pivot?.shipping_term === 'DDP');

              return (purchaseOrder.revision_date || purchaseOrder.etd_date || purchaseOrder.eta_date ||
                purchaseOrder.ship_to || purchaseOrder.ship_to_address) && (
                <div className="grid gap-4 md:grid-cols-2">
                  <Card>
                    <CardHeader>
                      <CardTitle>Shipping Dates</CardTitle>
                      <CardDescription>
                        Key dates and timeline
                        {(styles?.length || 0) > 0 && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            ({hasDDPStyles ? 'DDP - All dates shown' : 'FOB - ETD only'})
                          </span>
                        )}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {purchaseOrder.revision_date && (
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Revision Date</span>
                          <span className="text-sm font-medium">{formatDate(purchaseOrder.revision_date)}</span>
                        </div>
                      )}
                      {purchaseOrder.etd_date && (
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">ETD Date</span>
                          <span className="text-sm font-medium">{formatDate(purchaseOrder.etd_date)}</span>
                        </div>
                      )}
                      {/* ETA and In-warehouse dates only shown for DDP shipping terms */}
                      {hasDDPStyles && purchaseOrder.eta_date && (
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">ETA Date</span>
                          <span className="text-sm font-medium">{formatDate(purchaseOrder.eta_date)}</span>
                        </div>
                      )}
                      {hasDDPStyles && purchaseOrder.in_warehouse_date && (
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">In-Warehouse Date</span>
                          <span className="text-sm font-medium">{formatDate(purchaseOrder.in_warehouse_date)}</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Shipping Information</CardTitle>
                    <CardDescription>Origin and destination</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {purchaseOrder.ship_to && (
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Ship To</span>
                        <span className="text-sm font-medium">{purchaseOrder.ship_to}</span>
                      </div>
                    )}
                    {purchaseOrder.ship_to_address && (
                      <div>
                        <span className="text-sm text-muted-foreground">Ship To Address</span>
                        <p className="text-sm font-medium mt-1">{purchaseOrder.ship_to_address}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
              );
            })()}

            {/* Sample Schedule */}
            {purchaseOrder.sample_schedule && Object.keys(purchaseOrder.sample_schedule).length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Sample Schedule</CardTitle>
                  <CardDescription>Key milestone dates for sample approvals and production</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Sample Submissions Section */}
                  <div>
                    <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">
                      Sample Submissions
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      {purchaseOrder.sample_schedule.lab_dip_submission && (
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground">Lab Dip Submission</p>
                          <p className="text-sm font-medium">{formatDate(purchaseOrder.sample_schedule.lab_dip_submission)}</p>
                          <p className="text-[10px] text-muted-foreground/70">PO Date + 7 days</p>
                        </div>
                      )}
                      {purchaseOrder.sample_schedule.fit_sample_submission && (
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground">Fit Sample</p>
                          <p className="text-sm font-medium">{formatDate(purchaseOrder.sample_schedule.fit_sample_submission)}</p>
                          <p className="text-[10px] text-muted-foreground/70">PO Date + 7 days</p>
                        </div>
                      )}
                      {purchaseOrder.sample_schedule.trim_approvals && (
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground">Trim Approvals</p>
                          <p className="text-sm font-medium">{formatDate(purchaseOrder.sample_schedule.trim_approvals)}</p>
                          <p className="text-[10px] text-muted-foreground/70">PO Date + 10 days</p>
                        </div>
                      )}
                      {purchaseOrder.sample_schedule.first_proto_submission && (
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground">1st Proto Submission</p>
                          <p className="text-sm font-medium">{formatDate(purchaseOrder.sample_schedule.first_proto_submission)}</p>
                          <p className="text-[10px] text-muted-foreground/70">PO Date + 10 days</p>
                        </div>
                      )}
                      {purchaseOrder.sample_schedule.pp_sample_submission && (
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground">PP Sample</p>
                          <p className="text-sm font-medium">{formatDate(purchaseOrder.sample_schedule.pp_sample_submission)}</p>
                          <p className="text-[10px] text-muted-foreground/70">ETD − 35 days</p>
                        </div>
                      )}
                      {purchaseOrder.sample_schedule.top_approval && (
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground">TOP Approval</p>
                          <p className="text-sm font-medium">{formatDate(purchaseOrder.sample_schedule.top_approval)}</p>
                          <p className="text-[10px] text-muted-foreground/70">Ex-Factory − 10 days</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Production Milestones Section */}
                  {(purchaseOrder.sample_schedule.production_start || purchaseOrder.sample_schedule.bulk_fabric_inhouse) && (
                    <div>
                      <h3 className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">
                        Production Milestones
                      </h3>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {purchaseOrder.sample_schedule.bulk_fabric_inhouse && (
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">Bulk Fabric In-House</p>
                            <p className="text-sm font-medium">{formatDate(purchaseOrder.sample_schedule.bulk_fabric_inhouse)}</p>
                            <p className="text-[10px] text-muted-foreground/70">ETD − 40 days</p>
                          </div>
                        )}
                        {purchaseOrder.sample_schedule.production_start && (
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">Production Start</p>
                            <p className="text-sm font-medium">{formatDate(purchaseOrder.sample_schedule.production_start)}</p>
                            <p className="text-[10px] text-muted-foreground/70">ETD − 30 days</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* REMOVED: Buyer/Trim Details section - buyer/trim details removed per requirements */}

            {/* Packing Guidelines */}
            {purchaseOrder.packing_guidelines && (
              <Card>
                <CardHeader>
                  <CardTitle>Packing Guidelines</CardTitle>
                  <CardDescription>Special packing instructions</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-sm whitespace-pre-wrap">{purchaseOrder.packing_guidelines}</div>
                </CardContent>
              </Card>
            )}

            {purchaseOrder.notes && (
              <Card>
                <CardHeader>
                  <CardTitle>Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{purchaseOrder.notes}</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Styles Tab */}
          <TabsContent value="styles" className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-lg font-semibold">Styles</h3>
                <p className="text-sm text-muted-foreground">
                  Manage styles for this purchase order
                </p>
              </div>
              <div className="flex gap-2">
                {canCreateStyle() ? (
                  <>
                    <Button
                      onClick={() => setIsStyleSelectorOpen(true)}
                      size="sm"
                      variant="default"
                    >
                      <ListCheck className="mr-2 h-4 w-4" />
                      Select Styles
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => router.push(`/purchase-orders/${poId}/import`)}>
                      <FileUp className="mr-2 h-4 w-4" />
                      Import Excel
                    </Button>
                  </>
                ) : (
                  <div className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">
                    ℹ️ Style upload is currently disabled for agencies. Please contact your administrator.
                  </div>
                )}
            </div>
            </div>

            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Style Number</TableHead>
                        <TableHead>Color</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right">Total Qty</TableHead>
                        <TableHead className="text-right">Unit Price</TableHead>
                        <TableHead className="text-right">Total Cost</TableHead>
                        <TableHead>Pack Details</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {!styles || styles.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center text-muted-foreground">
                            No styles added yet
                          </TableCell>
                        </TableRow>
                      ) : (
                        styles.map((style) => (
                          <TableRow key={style.id}>
                            <TableCell className="font-medium">{style.style_number}</TableCell>
                            <TableCell>{style.color?.name || '-'}</TableCell>
                            <TableCell>{style.description || '-'}</TableCell>
                            <TableCell className="text-right">
                              {style.quantity ? style.quantity.toLocaleString() : '-'}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(style.unit_price, purchaseOrder.currency)}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(style.total_price, purchaseOrder.currency)}
                            </TableCell>
                            <TableCell>
                              {style.packing_details && style.packing_details.packs ? (
                                <div className="text-xs space-y-1">
                                  {style.packing_details.packs.map((pack, idx) => (
                                    <div key={idx} className="flex gap-2">
                                      <span className="font-medium">{pack.pack_size}:</span>
                                      <span>{Object.entries(pack.size_breakdown).map(([size, qty]) => `${size}:${qty}`).join(', ')}</span>
                                      <span className="text-muted-foreground">({pack.quantity} pcs)</span>
                                    </div>
                                  ))}
                                </div>
                              ) : style.size_breakdown ? (
                                <div className="text-xs">
                                  {Object.entries(style.size_breakdown).map(([size, qty]) => `${size}:${qty}`).join(', ')}
                                </div>
                              ) : (
                                '-'
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              {can('style.edit') && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDeleteStyle(style.id)}
                                  title="Remove style from PO"
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Factory Assignments Tab */}
          <TabsContent value="assignments">
            <Card>
              <CardHeader>
                <CardTitle>Factory Assignments</CardTitle>
                <CardDescription>View factory assignments for each style</CardDescription>
              </CardHeader>
              <CardContent>
                {!styles || styles.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No styles added yet. Add styles to assign them to factories.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Style Number</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Assignment Type</TableHead>
                        <TableHead>Assigned Factory</TableHead>
                        <TableHead>Assigned Agency</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {styles.map((style) => (
                        <TableRow key={style.id}>
                          <TableCell className="font-medium">{style.style_number}</TableCell>
                          <TableCell>{style.description || '-'}</TableCell>
                          <TableCell>
                            {style.pivot?.assignment_type ? (
                              <Badge variant="outline">
                                {style.pivot.assignment_type === 'direct_to_factory' ? 'Direct to Factory' : 'Via Agency'}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-sm">Not assigned</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {style.assignedFactory?.name ||
                             (style.pivot?.assigned_factory_id ? `Factory #${style.pivot.assigned_factory_id}` : '-')}
                          </TableCell>
                          <TableCell>
                            {style.assignedAgency?.name ||
                             (style.pivot?.assigned_agency_id ? `Agency #${style.pivot.assigned_agency_id}` : '-')}
                          </TableCell>
                          <TableCell>
                            {style.pivot?.status ? (
                              <Badge variant={style.pivot.status === 'completed' ? 'default' : 'secondary'}>
                                {style.pivot.status}
                              </Badge>
                            ) : (
                              <Badge variant="secondary">pending</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {can('po.assign_factory') && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenAssignFactory(style)}
                              >
                                <Factory className="mr-2 h-4 w-4" />
                                {style.pivot?.assignment_type ? 'Edit' : 'Assign'}
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="samples">
            <Card>
              <CardHeader>
                <CardTitle>Samples</CardTitle>
                <CardDescription>Track sample submissions and approvals</CardDescription>
              </CardHeader>
              <CardContent>
                {!styles || styles.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No styles added yet. Add styles to track samples.
                  </p>
                ) : (
                  <>
                    {purchaseOrder.sample_schedule && Object.keys(purchaseOrder.sample_schedule).length > 0 ? (
                      <div className="space-y-4">
                        <div className="text-sm text-muted-foreground">
                          Sample schedule dates are configured for this purchase order. Track sample submissions below:
                        </div>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Sample Type</TableHead>
                              <TableHead>Scheduled Date</TableHead>
                              <TableHead>Formula</TableHead>
                              <TableHead>Status</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {purchaseOrder.sample_schedule.lab_dip_submission && (
                              <TableRow>
                                <TableCell className="font-medium">Lab Dip Submission</TableCell>
                                <TableCell>{formatDate(purchaseOrder.sample_schedule.lab_dip_submission)}</TableCell>
                                <TableCell className="text-xs text-muted-foreground">PO Date + 7 days</TableCell>
                                <TableCell><Badge variant="secondary">Scheduled</Badge></TableCell>
                              </TableRow>
                            )}
                            {purchaseOrder.sample_schedule.fit_sample_submission && (
                              <TableRow>
                                <TableCell className="font-medium">Fit Sample</TableCell>
                                <TableCell>{formatDate(purchaseOrder.sample_schedule.fit_sample_submission)}</TableCell>
                                <TableCell className="text-xs text-muted-foreground">PO Date + 7 days</TableCell>
                                <TableCell><Badge variant="secondary">Scheduled</Badge></TableCell>
                              </TableRow>
                            )}
                            {purchaseOrder.sample_schedule.trim_approvals && (
                              <TableRow>
                                <TableCell className="font-medium">Trim Approvals</TableCell>
                                <TableCell>{formatDate(purchaseOrder.sample_schedule.trim_approvals)}</TableCell>
                                <TableCell className="text-xs text-muted-foreground">PO Date + 10 days</TableCell>
                                <TableCell><Badge variant="secondary">Scheduled</Badge></TableCell>
                              </TableRow>
                            )}
                            {purchaseOrder.sample_schedule.first_proto_submission && (
                              <TableRow>
                                <TableCell className="font-medium">1st Proto Submission</TableCell>
                                <TableCell>{formatDate(purchaseOrder.sample_schedule.first_proto_submission)}</TableCell>
                                <TableCell className="text-xs text-muted-foreground">PO Date + 10 days</TableCell>
                                <TableCell><Badge variant="secondary">Scheduled</Badge></TableCell>
                              </TableRow>
                            )}
                            {purchaseOrder.sample_schedule.bulk_fabric_inhouse && (
                              <TableRow>
                                <TableCell className="font-medium">Bulk Fabric Inhouse</TableCell>
                                <TableCell>{formatDate(purchaseOrder.sample_schedule.bulk_fabric_inhouse)}</TableCell>
                                <TableCell className="text-xs text-muted-foreground">ETD − 40 days</TableCell>
                                <TableCell><Badge variant="secondary">Scheduled</Badge></TableCell>
                              </TableRow>
                            )}
                            {purchaseOrder.sample_schedule.pp_sample_submission && (
                              <TableRow>
                                <TableCell className="font-medium">PP Sample</TableCell>
                                <TableCell>{formatDate(purchaseOrder.sample_schedule.pp_sample_submission)}</TableCell>
                                <TableCell className="text-xs text-muted-foreground">ETD − 35 days</TableCell>
                                <TableCell><Badge variant="secondary">Scheduled</Badge></TableCell>
                              </TableRow>
                            )}
                            {purchaseOrder.sample_schedule.production_start && (
                              <TableRow>
                                <TableCell className="font-medium">Production Start</TableCell>
                                <TableCell>{formatDate(purchaseOrder.sample_schedule.production_start)}</TableCell>
                                <TableCell className="text-xs text-muted-foreground">ETD − 30 days</TableCell>
                                <TableCell><Badge variant="secondary">Scheduled</Badge></TableCell>
                              </TableRow>
                            )}
                            {purchaseOrder.sample_schedule.top_approval && (
                              <TableRow>
                                <TableCell className="font-medium">TOP Approval</TableCell>
                                <TableCell>{formatDate(purchaseOrder.sample_schedule.top_approval)}</TableCell>
                                <TableCell className="text-xs text-muted-foreground">Ex-Factory − 10 days</TableCell>
                                <TableCell><Badge variant="secondary">Scheduled</Badge></TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        No sample schedule configured for this purchase order.
                      </p>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="production">
            <Card>
              <CardHeader>
                <CardTitle>Production Tracking</CardTitle>
                <CardDescription>Monitor production progress</CardDescription>
              </CardHeader>
              <CardContent>
                {!styles || styles.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No styles added yet. Add styles to track production.
                  </p>
                ) : (
                  <div className="space-y-6">
                    {/* Production Milestones */}
                    {purchaseOrder.sample_schedule?.production_start && (
                      <div>
                        <h4 className="text-sm font-semibold mb-3">Production Milestones</h4>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                          {purchaseOrder.sample_schedule.production_start && (
                            <div className="border rounded-lg p-3">
                              <p className="text-xs text-muted-foreground">Production Start</p>
                              <p className="text-sm font-medium">{formatDate(purchaseOrder.sample_schedule.production_start)}</p>
                            </div>
                          )}
                          {purchaseOrder.sample_schedule.bulk_fabric_inhouse && (
                            <div className="border rounded-lg p-3">
                              <p className="text-xs text-muted-foreground">Bulk Fabric In-House</p>
                              <p className="text-sm font-medium">{formatDate(purchaseOrder.sample_schedule.bulk_fabric_inhouse)}</p>
                            </div>
                          )}
                          {purchaseOrder.etd_date && (
                            <div className="border rounded-lg p-3">
                              <p className="text-xs text-muted-foreground">ETD Date</p>
                              <p className="text-sm font-medium">{formatDate(purchaseOrder.etd_date)}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Style Production Status */}
                    <div>
                      <h4 className="text-sm font-semibold mb-3">Style Production Status</h4>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Style Number</TableHead>
                            <TableHead>Quantity</TableHead>
                            <TableHead>Target Production</TableHead>
                            <TableHead>Target Shipment</TableHead>
                            <TableHead>Ex-Factory</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {styles.map((style) => (
                            <TableRow key={style.id}>
                              <TableCell className="font-medium">{style.style_number}</TableCell>
                              <TableCell>{(style.pivot?.quantity_in_po || style.quantity)?.toLocaleString() || '-'}</TableCell>
                              <TableCell>
                                {style.pivot?.target_production_date
                                  ? formatDate(style.pivot.target_production_date)
                                  : '-'}
                              </TableCell>
                              <TableCell>
                                {style.pivot?.target_shipment_date
                                  ? formatDate(style.pivot.target_shipment_date)
                                  : '-'}
                              </TableCell>
                              <TableCell>
                                {style.pivot?.ex_factory_date
                                  ? formatDate(style.pivot.ex_factory_date)
                                  : '-'}
                              </TableCell>
                              <TableCell>
                                {style.pivot?.status ? (
                                  <Badge variant={style.pivot.status === 'completed' ? 'default' : 'secondary'}>
                                    {style.pivot.status}
                                  </Badge>
                                ) : (
                                  <Badge variant="secondary">pending</Badge>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Style Selector Dialog */}
        <StyleSelectorDialog
          open={isStyleSelectorOpen}
          onOpenChange={setIsStyleSelectorOpen}
          onSelect={handleStylesSelected}
          poId={Number(poId)}
        />

        {/* Factory Assignment Dialog */}
        <Dialog open={isAssignFactoryDialogOpen} onOpenChange={setIsAssignFactoryDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {assignmentTypeForDialog ? 'Edit' : 'Assign'} Factory Assignment
              </DialogTitle>
              <DialogDescription>
                {selectedStyleForAssignment && `Style: ${selectedStyleForAssignment.style_number}`}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <AssignmentSelector
                assignmentType={assignmentTypeForDialog}
                assignedFactoryId={assignedFactoryIdForDialog}
                assignedAgencyId={assignedAgencyIdForDialog}
                onAssignmentChange={({ assignmentType, assignedFactoryId, assignedAgencyId }) => {
                  setAssignmentTypeForDialog(assignmentType);
                  setAssignedFactoryIdForDialog(assignedFactoryId);
                  setAssignedAgencyIdForDialog(assignedAgencyId);
                }}
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAssignFactoryDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button onClick={handleAssignFactory} disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Assigning...
                  </>
                ) : (
                  'Assign Factory'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
