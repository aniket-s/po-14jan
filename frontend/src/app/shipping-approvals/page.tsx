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
  Loader2, CheckCircle, XCircle, Clock, Ship, CalendarClock,
  AlertCircle, Send, ShieldCheck, Search, RotateCcw, Anchor,
} from 'lucide-react';
import api from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ShippingApprovalRow {
  pivot_id: number;
  purchase_order_id: number;
  po_number: string;
  po_ex_factory_date: string | null;
  agency_name: string | null;
  agency_id: number | null;
  importer_name: string | null;
  factory_name: string | null;
  assigned_factory_id: number | null;
  style_id: number;
  style_number: string;
  quantity_in_po: number;
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
  etd: string;
  eta: string;
  vessel_name?: string;
  cutoff_date?: string;
}

interface FactoryUser {
  id: number;
  name: string;
  company?: string;
}

interface AgencyOption {
  id: number;
  name: string;
}

interface ShipOptionForSelection {
  id: number;
  name: string;
  etd: string;
  eta: string;
  vessel_name?: string;
  cutoff_date?: string;
  days_between_exfactory_and_cutoff?: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SHIPPING_APPROVAL_WINDOW_DAYS = 21;

const SHIPPING_STATUSES = [
  { value: 'requested', label: 'Requested' },
  { value: 'agency_approved', label: 'Agency Approved' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

const PRODUCTION_STATUSES = [
  { value: 'pending', label: 'Pending' },
  { value: 'Submitted', label: 'Submitted' },
  { value: 'In Production', label: 'In Production' },
  { value: 'Estimated Ex-Factory', label: 'Est. Ex-Factory' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

function getStatusBadgeVariant(status: string | null): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'approved': return 'default';
    case 'agency_approved': case 'requested': return 'outline';
    case 'rejected': return 'destructive';
    default: return 'secondary';
  }
}

function getStatusLabel(status: string | null): string {
  switch (status) {
    case 'approved': return 'Approved';
    case 'agency_approved': return 'Agency Approved';
    case 'requested': return 'Requested';
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

export default function ShippingApprovalsPage() {
  const { hasRole } = useAuth();

  // --- Data ---
  const [rows, setRows] = useState<ShippingApprovalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [factories, setFactories] = useState<FactoryUser[]>([]);
  const [agencies, setAgencies] = useState<AgencyOption[]>([]);
  const [meta, setMeta] = useState<{ total: number; current_page: number; last_page: number }>({ total: 0, current_page: 1, last_page: 1 });

  // --- Filters ---
  const [filterFactory, setFilterFactory] = useState<string>('');
  const [filterAgency, setFilterAgency] = useState<string>('');
  const [filterPoNumber, setFilterPoNumber] = useState<string>('');
  const [filterStyleNumber, setFilterStyleNumber] = useState<string>('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterProductionStatus, setFilterProductionStatus] = useState<string>('');
  const [filterExFactoryFrom, setFilterExFactoryFrom] = useState<string>('');
  const [filterExFactoryTo, setFilterExFactoryTo] = useState<string>('');
  const [filterEstExFactoryFrom, setFilterEstExFactoryFrom] = useState<string>('');
  const [filterEstExFactoryTo, setFilterEstExFactoryTo] = useState<string>('');
  const [filterEtdFrom, setFilterEtdFrom] = useState<string>('');
  const [filterEtdTo, setFilterEtdTo] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);

  // --- Factory: Set estimated ex-factory date dialog ---
  const [isDateDialogOpen, setIsDateDialogOpen] = useState(false);
  const [dateDialogRow, setDateDialogRow] = useState<ShippingApprovalRow | null>(null);
  const [newEstExFactory, setNewEstExFactory] = useState('');
  const [isSettingDate, setIsSettingDate] = useState(false);

  // --- Agency: Select ship option & approve dialog ---
  const [isAgencyDialogOpen, setIsAgencyDialogOpen] = useState(false);
  const [agencyDialogRow, setAgencyDialogRow] = useState<ShippingApprovalRow | null>(null);
  const [availableShipOptions, setAvailableShipOptions] = useState<ShipOptionForSelection[]>([]);
  const [selectedShipOptionId, setSelectedShipOptionId] = useState<string>('');
  const [agencyNotes, setAgencyNotes] = useState('');
  const [loadingShipOptions, setLoadingShipOptions] = useState(false);
  const [isAgencyApproving, setIsAgencyApproving] = useState(false);

  // --- Reject dialog ---
  const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
  const [rejectRow, setRejectRow] = useState<ShippingApprovalRow | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [isRejecting, setIsRejecting] = useState(false);

  // --- Action loading ---
  const [actionLoadingPivotId, setActionLoadingPivotId] = useState<number | null>(null);

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { per_page: '50', page: currentPage.toString() };
      if (filterFactory && filterFactory !== 'all') params.factory_id = filterFactory;
      if (filterAgency && filterAgency !== 'all') params.agency_id = filterAgency;
      if (filterPoNumber) params.po_number = filterPoNumber;
      if (filterStyleNumber) params.style_number = filterStyleNumber;
      if (filterStatus && filterStatus !== 'all') params.shipping_approval_status = filterStatus;
      if (filterProductionStatus && filterProductionStatus !== 'all') params.production_status = filterProductionStatus;
      if (filterExFactoryFrom) params.ex_factory_from = filterExFactoryFrom;
      if (filterExFactoryTo) params.ex_factory_to = filterExFactoryTo;
      if (filterEstExFactoryFrom) params.est_ex_factory_from = filterEstExFactoryFrom;
      if (filterEstExFactoryTo) params.est_ex_factory_to = filterEstExFactoryTo;
      if (filterEtdFrom) params.etd_from = filterEtdFrom;
      if (filterEtdTo) params.etd_to = filterEtdTo;

      const response = await api.get('/shipping-approvals', { params });
      setRows(response.data.data || []);
      setMeta(response.data.meta || { total: 0, current_page: 1, last_page: 1 });
    } catch (error) {
      console.error('Failed to fetch shipping approvals:', error);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [currentPage, filterFactory, filterAgency, filterPoNumber, filterStyleNumber, filterStatus, filterProductionStatus, filterExFactoryFrom, filterExFactoryTo, filterEstExFactoryFrom, filterEstExFactoryTo, filterEtdFrom, filterEtdTo]);

  const fetchFactories = useCallback(async () => {
    try {
      const response = await api.get('/factories');
      const list = response.data.factories || response.data.data || response.data || [];
      setFactories(Array.isArray(list) ? list : []);
    } catch { /* optional */ }
  }, []);

  const fetchAgencies = useCallback(async () => {
    try {
      const response = await api.get('/purchase-orders');
      const poList = response.data.purchase_orders || response.data.data || response.data || [];
      const agencyMap = new Map<number, string>();
      (Array.isArray(poList) ? poList : []).forEach((po: { agency?: { id: number; name: string } }) => {
        if (po.agency) agencyMap.set(po.agency.id, po.agency.name);
      });
      setAgencies(Array.from(agencyMap, ([id, name]) => ({ id, name })));
    } catch { /* optional */ }
  }, []);

  const fetchShipOptionsForDate = useCallback(async (estExFactoryDate: string) => {
    setLoadingShipOptions(true);
    try {
      const response = await api.get('/ship-options/suggest', {
        params: { estimated_ex_factory_date: estExFactoryDate },
      });
      const options = response.data.ship_options || response.data.connectable_options || response.data.data || response.data || [];
      setAvailableShipOptions(Array.isArray(options) ? options : []);
    } catch {
      setAvailableShipOptions([]);
    } finally {
      setLoadingShipOptions(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    fetchFactories();
    fetchAgencies();
  }, [fetchFactories, fetchAgencies]);

  // ---------------------------------------------------------------------------
  // Filter helpers
  // ---------------------------------------------------------------------------

  const resetFilters = () => {
    setFilterFactory(''); setFilterAgency(''); setFilterPoNumber(''); setFilterStyleNumber('');
    setFilterStatus(''); setFilterProductionStatus('');
    setFilterExFactoryFrom(''); setFilterExFactoryTo('');
    setFilterEstExFactoryFrom(''); setFilterEstExFactoryTo('');
    setFilterEtdFrom(''); setFilterEtdTo('');
    setCurrentPage(1);
  };

  // ---------------------------------------------------------------------------
  // Factory: Set estimated ex-factory date
  // ---------------------------------------------------------------------------

  const openDateDialog = (row: ShippingApprovalRow) => {
    setDateDialogRow(row);
    setNewEstExFactory(row.estimated_ex_factory_date || '');
    setIsDateDialogOpen(true);
  };

  const handleSetEstExFactory = async () => {
    if (!dateDialogRow || !newEstExFactory) return;
    setIsSettingDate(true);
    try {
      await api.post(
        `/purchase-orders/${dateDialogRow.purchase_order_id}/styles/${dateDialogRow.style_id}/production-status`,
        { production_status: 'Estimated Ex-Factory', estimated_ex_factory_date: newEstExFactory }
      );
      setIsDateDialogOpen(false);
      setDateDialogRow(null);
      fetchData();
    } catch (error) {
      console.error('Failed to set estimated ex-factory date:', error);
    } finally {
      setIsSettingDate(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Factory: Request shipping approval
  // ---------------------------------------------------------------------------

  const handleRequestApproval = async (row: ShippingApprovalRow) => {
    setActionLoadingPivotId(row.pivot_id);
    try {
      await api.post(`/purchase-orders/${row.purchase_order_id}/styles/${row.style_id}/request-shipping-approval`);
      fetchData();
    } catch (error) {
      console.error('Failed to request shipping approval:', error);
    } finally {
      setActionLoadingPivotId(null);
    }
  };

  // ---------------------------------------------------------------------------
  // Agency: Select ship option and approve
  // ---------------------------------------------------------------------------

  const openAgencyApproveDialog = (row: ShippingApprovalRow) => {
    setAgencyDialogRow(row);
    setSelectedShipOptionId(row.suggested_ship_option?.id?.toString() || '');
    setAgencyNotes('');
    setIsAgencyDialogOpen(true);
    if (row.estimated_ex_factory_date) {
      fetchShipOptionsForDate(row.estimated_ex_factory_date);
    }
  };

  const handleAgencyApprove = async () => {
    if (!agencyDialogRow) return;
    setIsAgencyApproving(true);
    try {
      await api.post(
        `/purchase-orders/${agencyDialogRow.purchase_order_id}/styles/${agencyDialogRow.style_id}/agency-approve-shipping`,
        {
          ship_option_id: selectedShipOptionId ? parseInt(selectedShipOptionId) : undefined,
          notes: agencyNotes || undefined,
        }
      );
      setIsAgencyDialogOpen(false);
      setAgencyDialogRow(null);
      fetchData();
    } catch (error) {
      console.error('Failed to approve shipping (agency):', error);
    } finally {
      setIsAgencyApproving(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Importer: Final approve
  // ---------------------------------------------------------------------------

  const handleImporterApprove = async (row: ShippingApprovalRow) => {
    setActionLoadingPivotId(row.pivot_id);
    try {
      await api.post(`/purchase-orders/${row.purchase_order_id}/styles/${row.style_id}/importer-approve-shipping`);
      fetchData();
    } catch (error) {
      console.error('Failed to approve shipping (importer):', error);
    } finally {
      setActionLoadingPivotId(null);
    }
  };

  // ---------------------------------------------------------------------------
  // Reject
  // ---------------------------------------------------------------------------

  const openRejectDialog = (row: ShippingApprovalRow) => {
    setRejectRow(row);
    setRejectReason('');
    setIsRejectDialogOpen(true);
  };

  const handleReject = async () => {
    if (!rejectRow || !rejectReason.trim()) return;
    setIsRejecting(true);
    try {
      await api.post(
        `/purchase-orders/${rejectRow.purchase_order_id}/styles/${rejectRow.style_id}/reject-shipping`,
        { reason: rejectReason }
      );
      setIsRejectDialogOpen(false);
      setRejectRow(null);
      setRejectReason('');
      fetchData();
    } catch (error) {
      console.error('Failed to reject:', error);
    } finally {
      setIsRejecting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Permission helpers
  // ---------------------------------------------------------------------------

  const isSuperOrAdmin = hasRole('Super Admin') || hasRole('Admin');

  const canSetEstDate = (row: ShippingApprovalRow): boolean => {
    if (!isSuperOrAdmin && !hasRole('Factory')) return false;
    return !row.shipping_approval_status || row.shipping_approval_status === 'rejected';
  };

  const canRequestApproval = (row: ShippingApprovalRow): boolean => {
    if (!isSuperOrAdmin && !hasRole('Factory')) return false;
    if (row.production_status !== 'Estimated Ex-Factory') return false;
    if (!row.estimated_ex_factory_date) return false;
    if (row.shipping_approval_status && row.shipping_approval_status !== 'rejected') return false;
    return true;
  };

  const canAgencyApprove = (row: ShippingApprovalRow): boolean => {
    if (!isSuperOrAdmin && !hasRole('Agency')) return false;
    return row.shipping_approval_status === 'requested';
  };

  const canImporterApprove = (row: ShippingApprovalRow): boolean => {
    if (!isSuperOrAdmin && !hasRole('Importer')) return false;
    return row.shipping_approval_status === 'agency_approved';
  };

  const canReject = (row: ShippingApprovalRow): boolean => {
    if (isSuperOrAdmin && (row.shipping_approval_status === 'requested' || row.shipping_approval_status === 'agency_approved')) return true;
    if (hasRole('Agency') && row.shipping_approval_status === 'requested') return true;
    if (hasRole('Importer') && row.shipping_approval_status === 'agency_approved') return true;
    return false;
  };

  // ---------------------------------------------------------------------------
  // Stats
  // ---------------------------------------------------------------------------

  const statsRequested = rows.filter((r) => r.shipping_approval_status === 'requested').length;
  const statsAgencyApproved = rows.filter((r) => r.shipping_approval_status === 'agency_approved').length;
  const statsApproved = rows.filter((r) => r.shipping_approval_status === 'approved').length;
  const statsRejected = rows.filter((r) => r.shipping_approval_status === 'rejected').length;
  const statsNotRequested = rows.filter((r) => !r.shipping_approval_status || r.shipping_approval_status === 'pending').length;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <DashboardLayout
      requiredPermissions={['production.view', 'production.view_all', 'shipment.view', 'shipment.view_all', 'po.view']}
      requireAll={false}
    >
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Shipping Approvals</h1>
          <p className="text-muted-foreground">
            Manage shipping approval workflow across all purchase orders
          </p>
        </div>

        {/* Workflow Info */}
        <div className="rounded-lg border bg-muted/50 p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 text-muted-foreground" />
            <div className="text-sm">
              <p className="font-medium">Shipping Approval Workflow</p>
              <p className="mt-1 text-muted-foreground">
                <strong>Factory</strong> sets estimated ex-factory date and requests approval &rarr;{' '}
                <strong>Agency</strong> reviews, selects ship option, and approves &rarr;{' '}
                <strong>Importer</strong> gives final approval. Approval can only be requested within{' '}
                {SHIPPING_APPROVAL_WINDOW_DAYS} days of PO ex-factory date.
              </p>
            </div>
          </div>
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
              <div className="space-y-1.5">
                <Label className="text-xs">Factory</Label>
                <Select value={filterFactory} onValueChange={(v) => { setFilterFactory(v); setCurrentPage(1); }}>
                  <SelectTrigger><SelectValue placeholder="All Factories" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Factories</SelectItem>
                    {factories.map((f) => (
                      <SelectItem key={f.id} value={f.id.toString()}>{f.company || f.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Agency</Label>
                <Select value={filterAgency} onValueChange={(v) => { setFilterAgency(v); setCurrentPage(1); }}>
                  <SelectTrigger><SelectValue placeholder="All Agencies" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Agencies</SelectItem>
                    {agencies.map((a) => (
                      <SelectItem key={a.id} value={a.id.toString()}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">PO Number</Label>
                <Input placeholder="Search PO..." value={filterPoNumber} onChange={(e) => { setFilterPoNumber(e.target.value); setCurrentPage(1); }} />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Style Number</Label>
                <Input placeholder="Search style..." value={filterStyleNumber} onChange={(e) => { setFilterStyleNumber(e.target.value); setCurrentPage(1); }} />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Shipping Status</Label>
                <Select value={filterStatus} onValueChange={(v) => { setFilterStatus(v); setCurrentPage(1); }}>
                  <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    {SHIPPING_STATUSES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Production Status</Label>
                <Select value={filterProductionStatus} onValueChange={(v) => { setFilterProductionStatus(v); setCurrentPage(1); }}>
                  <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    {PRODUCTION_STATUSES.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">PO Ex-Factory From</Label>
                <Input type="date" value={filterExFactoryFrom} onChange={(e) => { setFilterExFactoryFrom(e.target.value); setCurrentPage(1); }} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">PO Ex-Factory To</Label>
                <Input type="date" value={filterExFactoryTo} onChange={(e) => { setFilterExFactoryTo(e.target.value); setCurrentPage(1); }} />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Est. Ex-Factory From</Label>
                <Input type="date" value={filterEstExFactoryFrom} onChange={(e) => { setFilterEstExFactoryFrom(e.target.value); setCurrentPage(1); }} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Est. Ex-Factory To</Label>
                <Input type="date" value={filterEstExFactoryTo} onChange={(e) => { setFilterEstExFactoryTo(e.target.value); setCurrentPage(1); }} />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">ETD From</Label>
                <Input type="date" value={filterEtdFrom} onChange={(e) => { setFilterEtdFrom(e.target.value); setCurrentPage(1); }} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">ETD To</Label>
                <Input type="date" value={filterEtdTo} onChange={(e) => { setFilterEtdTo(e.target.value); setCurrentPage(1); }} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium">Not Requested</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{statsNotRequested}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium">Requested</CardTitle>
              <Send className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{statsRequested}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium">Agency Approved</CardTitle>
              <CheckCircle className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{statsAgencyApproved}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium">Approved</CardTitle>
              <ShieldCheck className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{statsApproved}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-xs font-medium">Rejected</CardTitle>
              <XCircle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{statsRejected}</div></CardContent>
          </Card>
        </div>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle>Shipping Approval Status</CardTitle>
            <CardDescription>
              {meta.total} record{meta.total !== 1 ? 's' : ''} found
              {meta.last_page > 1 && ` (Page ${meta.current_page} of ${meta.last_page})`}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex h-96 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>PO #</TableHead>
                      <TableHead>Style</TableHead>
                      <TableHead>Factory</TableHead>
                      <TableHead>Agency</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead>PO Ex-Factory</TableHead>
                      <TableHead>Est. Ex-Factory</TableHead>
                      <TableHead>Ship Option</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center text-muted-foreground">
                          No records found
                        </TableCell>
                      </TableRow>
                    ) : (
                      rows.map((row) => {
                        const withinWindow = isWithinShippingWindow(row.po_ex_factory_date);
                        const isActionLoading = actionLoadingPivotId === row.pivot_id;

                        return (
                          <TableRow key={row.pivot_id}>
                            <TableCell className="font-medium text-sm">{row.po_number}</TableCell>
                            <TableCell className="font-medium">{row.style_number}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{row.factory_name || '-'}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{row.agency_name || '-'}</TableCell>
                            <TableCell className="text-right">{row.quantity_in_po?.toLocaleString() ?? '-'}</TableCell>
                            <TableCell>{formatDate(row.po_ex_factory_date)}</TableCell>
                            <TableCell>
                              {row.estimated_ex_factory_date ? (
                                <span className="flex items-center gap-1 text-sm">
                                  <CalendarClock className="h-3.5 w-3.5 text-muted-foreground" />
                                  {formatDate(row.estimated_ex_factory_date)}
                                </span>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {row.suggested_ship_option ? (
                                <div className="text-sm">
                                  <div className="flex items-center gap-1">
                                    <Ship className="h-3.5 w-3.5 text-muted-foreground" />
                                    <span className="font-medium">{row.suggested_ship_option.name}</span>
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    ETD: {formatDate(row.suggested_ship_option.etd)}
                                    {row.suggested_ship_option.vessel_name && ` | ${row.suggested_ship_option.vessel_name}`}
                                  </div>
                                </div>
                              ) : '-'}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-1">
                                <Badge variant={getStatusBadgeVariant(row.shipping_approval_status)}>
                                  {getStatusLabel(row.shipping_approval_status)}
                                </Badge>
                                {row.shipping_approval_status === 'rejected' && row.shipping_approval_rejection_reason && (
                                  <p className="text-xs text-destructive max-w-[150px] truncate" title={row.shipping_approval_rejection_reason}>
                                    {row.shipping_approval_rejection_reason}
                                  </p>
                                )}
                                {row.shipping_approval_status === 'approved' && (
                                  <span className="text-xs text-green-600 flex items-center gap-0.5">
                                    <ShieldCheck className="h-3 w-3" /> Final
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex flex-wrap justify-end gap-1">
                                {/* Factory: Set est. ex-factory date */}
                                {canSetEstDate(row) && (
                                  <Button variant="outline" size="sm" onClick={() => openDateDialog(row)}>
                                    <CalendarClock className="mr-1 h-3.5 w-3.5" />
                                    {row.estimated_ex_factory_date ? 'Update Date' : 'Set Date'}
                                  </Button>
                                )}

                                {/* Factory: Request approval */}
                                {canRequestApproval(row) && (
                                  <Button
                                    variant="outline" size="sm"
                                    onClick={() => handleRequestApproval(row)}
                                    disabled={isActionLoading || !withinWindow}
                                    title={!withinWindow ? `Only within ${SHIPPING_APPROVAL_WINDOW_DAYS} days of PO ex-factory` : undefined}
                                  >
                                    {isActionLoading ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Send className="mr-1 h-3.5 w-3.5" />}
                                    Request
                                  </Button>
                                )}

                                {/* Agency: Select ship + approve */}
                                {canAgencyApprove(row) && (
                                  <Button
                                    variant="ghost" size="sm" className="text-green-600 hover:text-green-700"
                                    onClick={() => openAgencyApproveDialog(row)}
                                  >
                                    <Anchor className="mr-1 h-3.5 w-3.5" /> Review & Approve
                                  </Button>
                                )}

                                {/* Importer: Final approve */}
                                {canImporterApprove(row) && (
                                  <Button
                                    variant="ghost" size="sm" className="text-green-600 hover:text-green-700"
                                    onClick={() => handleImporterApprove(row)}
                                    disabled={isActionLoading}
                                  >
                                    {isActionLoading ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="mr-1 h-3.5 w-3.5" />}
                                    Final Approve
                                  </Button>
                                )}

                                {/* Agency/Importer: Reject */}
                                {canReject(row) && (
                                  <Button
                                    variant="ghost" size="sm" className="text-red-600 hover:text-red-700"
                                    onClick={() => openRejectDialog(row)}
                                  >
                                    <XCircle className="mr-1 h-3.5 w-3.5" /> Reject
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
              </div>
            )}

            {/* Pagination */}
            {meta.last_page > 1 && (
              <div className="flex items-center justify-between border-t px-4 py-3">
                <p className="text-sm text-muted-foreground">
                  Page {meta.current_page} of {meta.last_page} ({meta.total} total)
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline" size="sm"
                    disabled={currentPage <= 1}
                    onClick={() => setCurrentPage((p) => p - 1)}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline" size="sm"
                    disabled={currentPage >= meta.last_page}
                    onClick={() => setCurrentPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ================================================================= */}
        {/* Dialog: Factory - Set Estimated Ex-Factory Date                    */}
        {/* ================================================================= */}
        <Dialog open={isDateDialogOpen} onOpenChange={setIsDateDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Set Estimated Ex-Factory Date</DialogTitle>
              <DialogDescription>
                {dateDialogRow && `PO: ${dateDialogRow.po_number} | Style: ${dateDialogRow.style_number}`}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Estimated Ex-Factory Date *</Label>
                <Input type="date" value={newEstExFactory} onChange={(e) => setNewEstExFactory(e.target.value)} />
              </div>
              {dateDialogRow?.po_ex_factory_date && (
                <p className="text-sm text-muted-foreground">
                  PO Ex-Factory: {formatDate(dateDialogRow.po_ex_factory_date)}
                </p>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDateDialogOpen(false)}>Cancel</Button>
              <Button disabled={isSettingDate || !newEstExFactory} onClick={handleSetEstExFactory}>
                {isSettingDate ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : 'Save Date'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ================================================================= */}
        {/* Dialog: Agency - Select Ship Option & Approve                     */}
        {/* ================================================================= */}
        <Dialog open={isAgencyDialogOpen} onOpenChange={setIsAgencyDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Review & Approve Shipping</DialogTitle>
              <DialogDescription>
                {agencyDialogRow && (
                  <>
                    PO: {agencyDialogRow.po_number} | Style: {agencyDialogRow.style_number}
                    {agencyDialogRow.estimated_ex_factory_date && (
                      <> | Est. Ex-Factory: {formatDate(agencyDialogRow.estimated_ex_factory_date)}</>
                    )}
                  </>
                )}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              {/* Ship Option Selection */}
              <div className="space-y-2">
                <Label className="font-medium">Select Ship Option</Label>
                {loadingShipOptions ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading available ships...
                  </div>
                ) : availableShipOptions.length > 0 ? (
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {availableShipOptions.map((option) => (
                      <label
                        key={option.id}
                        className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                          selectedShipOptionId === option.id.toString()
                            ? 'border-primary bg-primary/5'
                            : 'hover:bg-muted/50'
                        }`}
                      >
                        <input
                          type="radio"
                          name="ship_option"
                          value={option.id.toString()}
                          checked={selectedShipOptionId === option.id.toString()}
                          onChange={(e) => setSelectedShipOptionId(e.target.value)}
                          className="mt-1"
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Ship className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{option.name}</span>
                          </div>
                          <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
                            {option.vessel_name && <span>Vessel: {option.vessel_name}</span>}
                            <span>ETD: {formatDate(option.etd)}</span>
                            <span>ETA: {formatDate(option.eta)}</span>
                            {option.cutoff_date && (
                              <span className="text-orange-600 font-medium">Cutoff: {formatDate(option.cutoff_date)}</span>
                            )}
                            {option.days_between_exfactory_and_cutoff !== undefined && (
                              <span>{option.days_between_exfactory_and_cutoff} days until cutoff</span>
                            )}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-md border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800">
                    No connectable ship options found for the estimated ex-factory date.
                  </div>
                )}
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label>Notes (Optional)</Label>
                <textarea
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  placeholder="Add notes for the importer..."
                  value={agencyNotes}
                  onChange={(e) => setAgencyNotes(e.target.value)}
                />
              </div>

              {/* Current Ship Option Info */}
              {agencyDialogRow?.suggested_ship_option && (
                <div className="rounded-md bg-muted p-3 text-sm">
                  <p className="font-medium text-xs mb-1">Currently Suggested:</p>
                  <div className="flex items-center gap-2">
                    <Ship className="h-4 w-4 text-muted-foreground" />
                    <span>{agencyDialogRow.suggested_ship_option.name}</span>
                    <span className="text-muted-foreground">
                      ETD: {formatDate(agencyDialogRow.suggested_ship_option.etd)}
                    </span>
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAgencyDialogOpen(false)}>Cancel</Button>
              <Button
                disabled={isAgencyApproving}
                onClick={handleAgencyApprove}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {isAgencyApproving ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Approving...</>
                ) : (
                  <><CheckCircle className="mr-2 h-4 w-4" /> Approve Shipping</>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ================================================================= */}
        {/* Dialog: Reject Shipping                                           */}
        {/* ================================================================= */}
        <Dialog open={isRejectDialogOpen} onOpenChange={setIsRejectDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reject Shipping</DialogTitle>
              <DialogDescription>
                {rejectRow && `PO: ${rejectRow.po_number} | Style: ${rejectRow.style_number}`}
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
              <Button variant="destructive" disabled={isRejecting || !rejectReason.trim()} onClick={handleReject}>
                {isRejecting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Rejecting...</> : <><XCircle className="mr-2 h-4 w-4" /> Reject</>}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
