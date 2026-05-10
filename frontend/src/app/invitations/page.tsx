'use client';

// Disable static generation for this authenticated page
export const dynamic = 'force-dynamic';

import React, { useEffect, useState, useCallback } from 'react';
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
import { Plus, Search, Copy, Check, Loader2, Mail, X, CheckCircle, XCircle, Factory, UserPlus, Trash2, Clock, ChevronDown, ChevronRight } from 'lucide-react';
import api from '@/lib/api';
import { TableSkeleton } from '@/components/skeletons';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuth } from '@/contexts/AuthContext';
import { formatDate } from '@/lib/dateUtils';

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
  headline?: string | null;
  ex_factory_date?: string | null;
  etd_date?: string | null;
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
  po_id?: number;
  po_number?: string;
  color?: { id: number; name: string; code?: string | null; pantone_code?: string | null } | null;
  color_name?: string | null;
  pivot?: {
    quantity_in_po?: number;
    unit_price_in_po?: number | string | null;
    assigned_factory_id?: number;
    assigned_importer_id?: number;
  };
}

interface FactoryOption {
  id: number;
  name: string;
  company?: string;
}

interface ApprovalEntry {
  sample_type: string;
  display_name: string;
  status: 'not_sent' | 'sent' | 'agency_approved' | 'approved' | 'rejected';
  sent_date: string | null;
  agency_approved_at: string | null;
  importer_approved_at: string | null;
  final_status: string | null;
  rejection_reason: string | null;
}

interface FactoryAssignment {
  id: number;
  purchase_order_id: number;
  style_id: number;
  factory_id: number;
  assignment_type: string;
  status: string;
  notes: string | null;
  assigned_at: string | null;
  created_at: string;
  accepted_at: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  factory_ex_factory_date: string | null;
  factory_po_date: string | null;
  approvals?: ApprovalEntry[];
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
  const [expandedAssignmentIds, setExpandedAssignmentIds] = useState<Set<number>>(new Set());

  const toggleAssignmentExpanded = (id: number) => {
    setExpandedAssignmentIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const getApprovalStatusBadge = (status: ApprovalEntry['status']) => {
    switch (status) {
      case 'not_sent':
        return <Badge variant="secondary">Not yet sent</Badge>;
      case 'sent':
        return <Badge variant="outline">Sent</Badge>;
      case 'agency_approved':
        return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Agency approved</Badge>;
      case 'approved':
        return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive">Rejected</Badge>;
      default:
        return <Badge variant="secondary">{String(status)}</Badge>;
    }
  };
  const [faPagination, setFaPagination] = useState({ currentPage: 1, lastPage: 1, perPage: 15, total: 0 });
  const [faSearchQuery, setFaSearchQuery] = useState('');
  const [faStatusFilter, setFaStatusFilter] = useState<string>('all');
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectingAssignment, setRejectingAssignment] = useState<FactoryAssignment | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deletingAssignment, setDeletingAssignment] = useState<FactoryAssignment | null>(null);
  const isFactory = user?.roles?.some((r: any) => (typeof r === 'string' ? r : r.name) === 'Factory');
  const isImporter = user?.roles?.some((r: any) => (typeof r === 'string' ? r : r.name) === 'Importer');
  const canAssignAgency = can('po.assign_agency');

  // My Style Assignments (styles assigned to me as Importer or Agency)
  const [myStyleAssignments, setMyStyleAssignments] = useState<any[]>([]);
  const [msaPagination, setMsaPagination] = useState({ currentPage: 1, lastPage: 1, perPage: 15, total: 0 });

  // Agency assignment state
  const [showAssignAgencyDialog, setShowAssignAgencyDialog] = useState(false);
  const [agcAssignPOIds, setAgcAssignPOIds] = useState<string[]>([]);
  const [agcAssignStyles, setAgcAssignStyles] = useState<POStyle[]>([]);
  const [agcAssignStylesLoading, setAgcAssignStylesLoading] = useState(false);
  const [agcStyleSearch, setAgcStyleSearch] = useState('');
  const [agcPOSearch, setAgcPOSearch] = useState('');
  // Composite keys `${po_id}:${style_id}` — a style can belong to multiple POs
  const [agcSelectedKeys, setAgcSelectedKeys] = useState<string[]>([]);
  const [agencies, setAgencies] = useState<FactoryOption[]>([]);
  const [selectedAgencyId, setSelectedAgencyId] = useState<string>('');
  const [assignAgencyLoading, setAssignAgencyLoading] = useState(false);

  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  // Factory assignment state (multi-PO → styles, mirrors agency assignment flow)
  const [showAssignDialog, setShowAssignDialog] = useState(false);
  const [faAssignPOIds, setFaAssignPOIds] = useState<string[]>([]);
  const [faPOSearch, setFaPOSearch] = useState('');
  const [faAssignStyles, setFaAssignStyles] = useState<POStyle[]>([]);
  const [faStylesLoading, setFaStylesLoading] = useState(false);
  const [faStyleSearch, setFaStyleSearch] = useState('');
  // Composite keys `${po_id}:${style_id}` — a style can belong to multiple POs
  const [faSelectedKeys, setFaSelectedKeys] = useState<string[]>([]);
  // Per-row (composite-key) factory economics entered by the agency.
  // `edited` tracks whether the user manually changed the date so a buffer
  // re-compute won't clobber their value.
  const [faPricing, setFaPricing] = useState<Record<string, { price: string; date: string; dateEdited: boolean }>>({});
  const [faBufferDays, setFaBufferDays] = useState<number>(21);
  const [factories, setFactories] = useState<FactoryOption[]>([]);
  const [selectedFactoryId, setSelectedFactoryId] = useState<string>('');
  const [assignNotes, setAssignNotes] = useState('');
  const [assignLoading, setAssignLoading] = useState(false);
  const canAssignFactory = can('po.assign_factory');

  // Importer assignment state
  const [showAssignImporterDialog, setShowAssignImporterDialog] = useState(false);
  const [impAssignPOId, setImpAssignPOId] = useState<string>('');
  const [impAssignStyles, setImpAssignStyles] = useState<POStyle[]>([]);
  const [impAssignStylesLoading, setImpAssignStylesLoading] = useState(false);
  const [impStyleSearch, setImpStyleSearch] = useState('');
  const [impSelectedStyleIds, setImpSelectedStyleIds] = useState<number[]>([]);
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

  // Fetch agencies for agency assignment dialog (Importer users)
  useEffect(() => {
    if (!canAssignAgency) return;
    api.get('/agencies')
      .then((res) => {
        const data = Array.isArray(res.data) ? res.data : res.data.data || [];
        setAgencies(data);
      })
      .catch(() => setAgencies([]));
  }, [canAssignAgency]);

  // Fetch my style assignments (Importer/Agency see styles assigned to them)
  const fetchMyStyleAssignments = useCallback(async () => {
    if (!isImporter && !isAgency) return;
    try {
      const response = await api.get('/my-style-assignments', {
        params: { page: msaPagination.currentPage, per_page: msaPagination.perPage },
      });
      setMyStyleAssignments(response.data.data || []);
      setMsaPagination({
        currentPage: response.data.current_page || 1,
        lastPage: response.data.last_page || 1,
        perPage: response.data.per_page || 15,
        total: response.data.total || 0,
      });
    } catch {
      setMyStyleAssignments([]);
    }
  }, [isImporter, isAgency, msaPagination.currentPage, msaPagination.perPage]);

  useEffect(() => {
    fetchMyStyleAssignments();
  }, [fetchMyStyleAssignments]);

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

  const fetchFactoryAssignments = useCallback(async () => {
    try {
      const params: any = {
        page: faPagination.currentPage,
        per_page: faPagination.perPage,
      };
      if (faSearchQuery) params.search = faSearchQuery;
      if (faStatusFilter !== 'all') params.status = faStatusFilter;

      const response = await api.get('/factory-assignments', { params });
      setFactoryAssignments(response.data.data || []);
      setFaPagination({
        currentPage: response.data.current_page || 1,
        lastPage: response.data.last_page || 1,
        perPage: response.data.per_page || 15,
        total: response.data.total || 0,
      });
    } catch (error) {
      console.error('Failed to fetch factory assignments:', error);
    }
  }, [faPagination.currentPage, faPagination.perPage, faSearchQuery, faStatusFilter]);

  // Refresh factory assignments when filters change
  useEffect(() => {
    fetchFactoryAssignments();
  }, [fetchFactoryAssignments]);

  // Accept factory assignment (Factory role)
  const handleAcceptAssignment = async (assignment: FactoryAssignment) => {
    try {
      await api.post(`/factory-assignments/${assignment.id}/accept`);
      fetchFactoryAssignments();
    } catch (error: any) {
      console.error('Failed to accept:', error);
      alert(error.response?.data?.message || 'Failed to accept assignment');
    }
  };

  // Reject factory assignment (Factory role)
  const handleRejectAssignment = async () => {
    if (!rejectingAssignment) return;
    try {
      await api.post(`/factory-assignments/${rejectingAssignment.id}/reject`, {
        rejection_reason: rejectionReason || null,
      });
      setShowRejectDialog(false);
      setRejectingAssignment(null);
      setRejectionReason('');
      fetchFactoryAssignments();
    } catch (error: any) {
      console.error('Failed to reject:', error);
      alert(error.response?.data?.message || 'Failed to reject assignment');
    }
  };

  // Delete factory assignment (Importer/Agency)
  const handleDeleteAssignment = async () => {
    if (!deletingAssignment) return;
    try {
      const poId = deletingAssignment.purchase_order_id || deletingAssignment.purchase_order?.id;
      if (poId) {
        await api.delete(`/purchase-orders/${poId}/factory-assignments/${deletingAssignment.id}`);
      }
      setShowDeleteDialog(false);
      setDeletingAssignment(null);
      fetchFactoryAssignments();
    } catch (error: any) {
      console.error('Failed to delete:', error);
      alert(error.response?.data?.message || 'Failed to delete assignment');
    }
  };

  const getAssignmentStatusBadge = (status: string) => {
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

  // --- Factory Assignment functions (multi-PO → styles) ---
  const faKeyFor = (poId: number | string, styleId: number | string) => `${poId}:${styleId}`;

  // Subtract buffer days from a YYYY-MM-DD date string. Returns '' if the
  // input isn't a parseable date — the agency can then enter a value
  // manually for that row.
  const faComputeFactoryDate = (poExFactoryDate: string | null | undefined, bufferDays: number): string => {
    if (!poExFactoryDate) return '';
    const d = new Date(poExFactoryDate);
    if (Number.isNaN(d.getTime())) return '';
    d.setDate(d.getDate() - bufferDays);
    return d.toISOString().split('T')[0];
  };

  // Best-available "PO finish" date for buffer math — prefer the explicit
  // ex-factory date, fall back to the shipping (ETD) date so SCI-style POs
  // that only carry a ship date still produce a workable default.
  const faPOAnchorDate = (po?: PurchaseOrder): string | null =>
    po?.ex_factory_date || po?.etd_date || null;

  // Build the default pricing/date entry for a freshly-checked style row.
  const faDefaultPricingEntry = (style: POStyle): { price: string; date: string; dateEdited: boolean } => {
    const po = purchaseOrders.find((p) => p.id === style.po_id);
    const defaultPrice = style.pivot?.unit_price_in_po != null
      ? String(style.pivot.unit_price_in_po)
      : '';
    const defaultDate = faComputeFactoryDate(faPOAnchorDate(po), faBufferDays);
    return { price: defaultPrice, date: defaultDate, dateEdited: false };
  };

  const fetchFaStylesForPOs = async (poIds: string[]) => {
    if (poIds.length === 0) { setFaAssignStyles([]); return; }
    setFaStylesLoading(true);
    try {
      const results = await Promise.all(
        poIds.map(async (poId) => {
          try {
            const response = await api.get(`/purchase-orders/${poId}/styles`, { params: { per_page: 200 } });
            const list = response.data.styles || response.data.data || [];
            const po = purchaseOrders.find((p) => p.id.toString() === poId);
            const poNumber = po?.po_number || poId;
            return (Array.isArray(list) ? list : []).map((s: any) => ({
              ...s,
              po_id: Number(poId),
              po_number: poNumber,
            })) as POStyle[];
          } catch {
            return [] as POStyle[];
          }
        })
      );
      setFaAssignStyles(results.flat());
    } finally {
      setFaStylesLoading(false);
    }
  };

  const toggleFaPOSelection = (poId: string) => {
    setFaAssignPOIds((prev) => {
      const next = prev.includes(poId) ? prev.filter((id) => id !== poId) : [...prev, poId];
      // Drop style selections + pricing rows tied to a PO the user just unchecked
      setFaSelectedKeys((keys) =>
        keys.filter((k) => next.some((pid) => k.startsWith(`${pid}:`)))
      );
      setFaPricing((prev) => {
        const out: typeof prev = {};
        for (const k of Object.keys(prev)) {
          if (next.some((pid) => k.startsWith(`${pid}:`))) out[k] = prev[k];
        }
        return out;
      });
      fetchFaStylesForPOs(next);
      return next;
    });
  };

  const toggleFaAllPOs = (visiblePOs: PurchaseOrder[]) => {
    const visibleIds = visiblePOs.map((po) => po.id.toString());
    const allSelected = visibleIds.length > 0 && visibleIds.every((id) => faAssignPOIds.includes(id));
    const next = allSelected
      ? faAssignPOIds.filter((id) => !visibleIds.includes(id))
      : Array.from(new Set([...faAssignPOIds, ...visibleIds]));
    setFaAssignPOIds(next);
    setFaSelectedKeys((keys) => keys.filter((k) => next.some((pid) => k.startsWith(`${pid}:`))));
    setFaPricing((prev) => {
      const out: typeof prev = {};
      for (const k of Object.keys(prev)) {
        if (next.some((pid) => k.startsWith(`${pid}:`))) out[k] = prev[k];
      }
      return out;
    });
    fetchFaStylesForPOs(next);
  };

  const filteredFaStyles = faAssignStyles.filter((style) => {
    if (!faStyleSearch) return true;
    const s = faStyleSearch.toLowerCase();
    return (
      style.style_number.toLowerCase().includes(s) ||
      (style.description || '').toLowerCase().includes(s) ||
      (style.po_number || '').toLowerCase().includes(s)
    );
  });

  const toggleFaStyleSelection = (poId: number, styleId: number) => {
    const key = faKeyFor(poId, styleId);
    setFaSelectedKeys((prev) => {
      if (prev.includes(key)) {
        setFaPricing((p) => {
          const { [key]: _removed, ...rest } = p;
          return rest;
        });
        return prev.filter((k) => k !== key);
      }
      const style = faAssignStyles.find((s) => s.po_id === poId && s.id === styleId);
      if (style) {
        setFaPricing((p) => ({ ...p, [key]: faDefaultPricingEntry(style) }));
      }
      return [...prev, key];
    });
  };

  const toggleFaSelectAllStyles = () => {
    const visibleKeys = filteredFaStyles
      .filter((s) => s.po_id != null)
      .map((s) => faKeyFor(s.po_id as number, s.id));
    const allSelected = visibleKeys.length > 0 && visibleKeys.every((k) => faSelectedKeys.includes(k));
    if (allSelected) {
      setFaSelectedKeys((prev) => prev.filter((k) => !visibleKeys.includes(k)));
      setFaPricing((p) => {
        const out = { ...p };
        for (const k of visibleKeys) delete out[k];
        return out;
      });
    } else {
      setFaSelectedKeys((prev) => Array.from(new Set([...prev, ...visibleKeys])));
      setFaPricing((p) => {
        const out = { ...p };
        for (const style of filteredFaStyles) {
          if (style.po_id == null) continue;
          const k = faKeyFor(style.po_id, style.id);
          if (!out[k]) out[k] = faDefaultPricingEntry(style);
        }
        return out;
      });
    }
  };

  const updateFaPrice = (key: string, price: string) => {
    setFaPricing((prev) => ({
      ...prev,
      [key]: { ...(prev[key] ?? { price: '', date: '', dateEdited: false }), price },
    }));
  };

  const updateFaDate = (key: string, date: string) => {
    setFaPricing((prev) => ({
      ...prev,
      [key]: { ...(prev[key] ?? { price: '', date: '', dateEdited: false }), date, dateEdited: true },
    }));
  };

  // When the buffer-days input changes, recompute the default factory
  // ex-factory date for any row whose date the user hasn't manually edited.
  const handleFaBufferChange = (nextBuffer: number) => {
    setFaBufferDays(nextBuffer);
    setFaPricing((prev) => {
      const out = { ...prev };
      for (const key of Object.keys(out)) {
        const entry = out[key];
        if (entry.dateEdited) continue;
        const [poIdStr] = key.split(':');
        const po = purchaseOrders.find((p) => p.id.toString() === poIdStr);
        out[key] = { ...entry, date: faComputeFactoryDate(faPOAnchorDate(po), nextBuffer) };
      }
      return out;
    });
  };

  // Submit factory assignment
  const handleAssignFactory = async () => {
    if (faSelectedKeys.length === 0 || !selectedFactoryId) return;
    // Backend only needs the unique set of style ids; it derives the PO per style.
    const styleIds = Array.from(new Set(
      faSelectedKeys.map((k) => Number(k.split(':')[1]))
    ));
    // Collapse per-row pricing into maps keyed by style_id. If the same style
    // was picked from two POs with different values, last write wins — matches
    // the backend's first-PO-only assignment behaviour.
    const prices: Record<string, number> = {};
    const dates: Record<string, string> = {};
    for (const key of faSelectedKeys) {
      const entry = faPricing[key];
      if (!entry) continue;
      const styleId = key.split(':')[1];
      if (entry.price !== '' && !Number.isNaN(Number(entry.price))) prices[styleId] = Number(entry.price);
      if (entry.date) dates[styleId] = entry.date;
    }

    setAssignLoading(true);
    try {
      await api.post('/factory-assignments/bulk-assign', {
        style_ids: styleIds,
        factory_id: parseInt(selectedFactoryId),
        assignment_type: 'via_agency',
        notes: assignNotes || null,
        factory_unit_prices: Object.keys(prices).length > 0 ? prices : undefined,
        factory_ex_factory_dates: Object.keys(dates).length > 0 ? dates : undefined,
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
    setFaAssignPOIds([]);
    setFaAssignStyles([]);
    setFaPOSearch('');
    setFaStyleSearch('');
    setFaSelectedKeys([]);
    setFaPricing({});
    setFaBufferDays(21);
    setSelectedFactoryId('');
    setAssignNotes('');
  };

  // Fetch styles for importer assignment PO
  const fetchImpAssignStyles = async (poId: string) => {
    if (!poId) { setImpAssignStyles([]); return; }
    setImpAssignStylesLoading(true);
    try {
      const response = await api.get(`/purchase-orders/${poId}/styles`, { params: { per_page: 200 } });
      const styles = response.data.styles || response.data.data || [];
      setImpAssignStyles(Array.isArray(styles) ? styles : []);
    } catch { setImpAssignStyles([]); }
    finally { setImpAssignStylesLoading(false); }
  };

  const handleImpAssignPOChange = (poId: string) => {
    setImpAssignPOId(poId);
    setImpSelectedStyleIds([]);
    setImpStyleSearch('');
    fetchImpAssignStyles(poId);
  };

  const filteredImpStyles = impAssignStyles.filter((style) => {
    if (!impStyleSearch) return true;
    const s = impStyleSearch.toLowerCase();
    return style.style_number.toLowerCase().includes(s) || (style.description || '').toLowerCase().includes(s);
  });

  const toggleImpStyleSelection = (styleId: number) => {
    setImpSelectedStyleIds((prev) =>
      prev.includes(styleId) ? prev.filter((id) => id !== styleId) : [...prev, styleId]
    );
  };

  const toggleImpSelectAll = () => {
    const visibleIds = filteredImpStyles.map((s) => s.id);
    const allSelected = visibleIds.every((id) => impSelectedStyleIds.includes(id));
    if (allSelected) {
      setImpSelectedStyleIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
    } else {
      setImpSelectedStyleIds((prev) => [...new Set([...prev, ...visibleIds])]);
    }
  };

  const resetImpAssignForm = () => {
    setImpAssignPOId('');
    setImpAssignStyles([]);
    setImpStyleSearch('');
    setImpSelectedStyleIds([]);
    setSelectedImporterId('');
  };

  const handleAssignImporter = async () => {
    if (!impAssignPOId || impSelectedStyleIds.length === 0 || !selectedImporterId) return;
    setAssignImporterLoading(true);
    try {
      await api.post(`/purchase-orders/${impAssignPOId}/styles/bulk-assign-importer`, {
        style_ids: impSelectedStyleIds,
        importer_id: parseInt(selectedImporterId),
      });
      setShowAssignImporterDialog(false);
      resetImpAssignForm();
      fetchPurchaseOrders();
      fetchFactoryAssignments();
    } catch (error: any) {
      console.error('Failed to assign importer:', error);
      alert(error.response?.data?.message || 'Failed to assign importer');
    } finally {
      setAssignImporterLoading(false);
    }
  };

  // --- Agency Assignment functions ---
  const keyFor = (poId: number | string, styleId: number | string) => `${poId}:${styleId}`;

  const fetchAgcAssignStylesForPOs = async (poIds: string[]) => {
    if (poIds.length === 0) { setAgcAssignStyles([]); return; }
    setAgcAssignStylesLoading(true);
    try {
      const results = await Promise.all(
        poIds.map(async (poId) => {
          try {
            const response = await api.get(`/purchase-orders/${poId}/styles`, { params: { per_page: 200 } });
            const list = response.data.styles || response.data.data || [];
            const po = purchaseOrders.find((p) => p.id.toString() === poId);
            const poNumber = po?.po_number || poId;
            return (Array.isArray(list) ? list : []).map((s: any) => ({
              ...s,
              po_id: Number(poId),
              po_number: poNumber,
            })) as POStyle[];
          } catch {
            return [] as POStyle[];
          }
        })
      );
      setAgcAssignStyles(results.flat());
    } finally {
      setAgcAssignStylesLoading(false);
    }
  };

  const toggleAgcPOSelection = (poId: string) => {
    setAgcAssignPOIds((prev) => {
      const next = prev.includes(poId) ? prev.filter((id) => id !== poId) : [...prev, poId];
      // Drop selections that belong to an unselected PO
      setAgcSelectedKeys((keys) =>
        keys.filter((k) => next.some((pid) => k.startsWith(`${pid}:`)))
      );
      fetchAgcAssignStylesForPOs(next);
      return next;
    });
  };

  const filteredAgcStyles = agcAssignStyles.filter((style) => {
    if (!agcStyleSearch) return true;
    const s = agcStyleSearch.toLowerCase();
    return (
      style.style_number.toLowerCase().includes(s) ||
      (style.description || '').toLowerCase().includes(s) ||
      (style.po_number || '').toLowerCase().includes(s)
    );
  });

  const toggleAgcStyleSelection = (poId: number, styleId: number) => {
    const key = keyFor(poId, styleId);
    setAgcSelectedKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const toggleAgcSelectAll = () => {
    const visibleKeys = filteredAgcStyles
      .filter((s) => s.po_id != null)
      .map((s) => keyFor(s.po_id as number, s.id));
    const allSelected = visibleKeys.length > 0 && visibleKeys.every((k) => agcSelectedKeys.includes(k));
    if (allSelected) {
      setAgcSelectedKeys((prev) => prev.filter((k) => !visibleKeys.includes(k)));
    } else {
      setAgcSelectedKeys((prev) => Array.from(new Set([...prev, ...visibleKeys])));
    }
  };

  const resetAgcAssignForm = () => {
    setAgcAssignPOIds([]);
    setAgcAssignStyles([]);
    setAgcStyleSearch('');
    setAgcPOSearch('');
    setAgcSelectedKeys([]);
    setSelectedAgencyId('');
  };

  const handleAssignAgency = async () => {
    if (agcAssignPOIds.length === 0 || agcSelectedKeys.length === 0 || !selectedAgencyId) return;
    setAssignAgencyLoading(true);
    try {
      // Group selected style IDs by PO
      const byPO = new Map<string, number[]>();
      for (const key of agcSelectedKeys) {
        const [poId, styleId] = key.split(':');
        if (!byPO.has(poId)) byPO.set(poId, []);
        byPO.get(poId)!.push(Number(styleId));
      }

      const results = await Promise.allSettled(
        Array.from(byPO.entries()).map(([poId, styleIds]) =>
          api.post(`/purchase-orders/${poId}/styles/bulk-assign-agency`, {
            style_ids: styleIds,
            agency_id: parseInt(selectedAgencyId),
          })
        )
      );

      const failures = results.filter((r) => r.status === 'rejected');
      if (failures.length > 0) {
        const first = failures[0] as PromiseRejectedResult;
        const message = first.reason?.response?.data?.message || 'One or more assignments failed';
        alert(`${failures.length} of ${results.length} PO assignment(s) failed: ${message}`);
      }

      setShowAssignAgencyDialog(false);
      resetAgcAssignForm();
      fetchPurchaseOrders();
    } catch (error: any) {
      console.error('Failed to assign agency:', error);
      alert(error.response?.data?.message || 'Failed to assign agency');
    } finally {
      setAssignAgencyLoading(false);
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
            {canAssignAgency && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowAssignAgencyDialog(true)}
              >
                <UserPlus className="mr-2 h-4 w-4" />
                Assign Agency
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
          <DialogContent className="w-[96vw] max-w-[1400px] max-h-[92vh] overflow-y-auto text-base">
            <DialogHeader>
              <DialogTitle className="text-xl">Assign Styles to Factory</DialogTitle>
              <DialogDescription>
                Select one or more purchase orders, pick styles, and assign them to a factory
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              {/* PO Selection */}
              <div className="space-y-3">
                <Label>Purchase Orders * ({faAssignPOIds.length} selected)</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search POs..."
                    value={faPOSearch}
                    onChange={(e) => setFaPOSearch(e.target.value)}
                    className="pl-8"
                  />
                </div>
                <div className="border rounded-md max-h-[220px] overflow-y-auto">
                  {(() => {
                    const visiblePOs = purchaseOrders.filter((po) => {
                      if (!faPOSearch) return true;
                      const s = faPOSearch.toLowerCase();
                      return (
                        po.po_number.toLowerCase().includes(s) ||
                        (po.headline || '').toLowerCase().includes(s)
                      );
                    });
                    if (visiblePOs.length === 0) {
                      return (
                        <div className="text-sm text-muted-foreground py-4 text-center">
                          No POs match your search
                        </div>
                      );
                    }
                    const allVisibleSelected =
                      visiblePOs.length > 0 &&
                      visiblePOs.every((po) => faAssignPOIds.includes(po.id.toString()));
                    return (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-10">
                              <Checkbox
                                checked={allVisibleSelected}
                                onCheckedChange={() => toggleFaAllPOs(visiblePOs)}
                              />
                            </TableHead>
                            <TableHead>PO #</TableHead>
                            <TableHead>Headline</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {visiblePOs.map((po) => {
                            const checked = faAssignPOIds.includes(po.id.toString());
                            return (
                              <TableRow
                                key={po.id}
                                className="cursor-pointer hover:bg-muted/50"
                                onClick={() => toggleFaPOSelection(po.id.toString())}
                              >
                                <TableCell>
                                  <Checkbox
                                    checked={checked}
                                    onCheckedChange={() => toggleFaPOSelection(po.id.toString())}
                                  />
                                </TableCell>
                                <TableCell className="font-medium">{po.po_number}</TableCell>
                                <TableCell className="text-sm text-muted-foreground truncate max-w-[320px]">
                                  {po.headline || '-'}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    );
                  })()}
                </div>
              </div>

              {/* Styles picked from selected POs */}
              {faAssignPOIds.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-end gap-4 flex-wrap">
                    <div className="flex-1 min-w-[200px] space-y-1">
                      <Label>Styles ({faSelectedKeys.length} of {filteredFaStyles.length} selected)</Label>
                      <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search styles..."
                          value={faStyleSearch}
                          onChange={(e) => setFaStyleSearch(e.target.value)}
                          className="pl-8"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label>Delivery Buffer (days)</Label>
                      <Input
                        type="number"
                        min={0}
                        className="w-28"
                        value={faBufferDays}
                        onChange={(e) => {
                          const n = Math.max(0, Number(e.target.value) || 0);
                          handleFaBufferChange(n);
                        }}
                      />
                      <p className="text-[11px] text-muted-foreground">Factory ex-factory = PO ex-factory − buffer</p>
                    </div>
                  </div>

                  {faStylesLoading ? (
                    <div className="text-sm text-muted-foreground py-4 text-center">Loading styles...</div>
                  ) : filteredFaStyles.length === 0 ? (
                    <div className="text-sm text-muted-foreground py-4 text-center">
                      {faAssignStyles.length === 0 ? 'No styles found in selected POs' : 'No styles match your search'}
                    </div>
                  ) : (
                    <div className="border rounded-md max-h-[420px] overflow-auto">
                      <Table className="text-base">
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-10">
                              <Checkbox
                                checked={
                                  filteredFaStyles.length > 0 &&
                                  filteredFaStyles.every((s) =>
                                    s.po_id != null && faSelectedKeys.includes(faKeyFor(s.po_id, s.id))
                                  )
                                }
                                onCheckedChange={toggleFaSelectAllStyles}
                              />
                            </TableHead>
                            <TableHead>PO</TableHead>
                            <TableHead>Style #</TableHead>
                            <TableHead>Color</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead className="text-right">Qty</TableHead>
                            <TableHead className="text-right">Buyer PO Price</TableHead>
                            <TableHead>PO Ex-Factory</TableHead>
                            <TableHead className="w-[120px]">Factory Price</TableHead>
                            <TableHead className="w-[160px]">Factory Ex-Factory</TableHead>
                            <TableHead className="text-right">Margin $</TableHead>
                            <TableHead className="text-right">Margin days</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredFaStyles.map((style) => {
                            const poId = style.po_id as number;
                            const key = faKeyFor(poId, style.id);
                            const isSelected = faSelectedKeys.includes(key);
                            const entry = faPricing[key];
                            const po = purchaseOrders.find((p) => p.id === poId);
                            const poPriceNum = style.pivot?.unit_price_in_po != null
                              ? Number(style.pivot.unit_price_in_po)
                              : NaN;
                            const factoryPriceNum = entry?.price ? Number(entry.price) : NaN;
                            const marginPrice = !Number.isNaN(poPriceNum) && !Number.isNaN(factoryPriceNum)
                              ? poPriceNum - factoryPriceNum
                              : null;
                            const poAnchor = faPOAnchorDate(po);
                            let marginDays: number | null = null;
                            if (poAnchor && entry?.date) {
                              const d1 = new Date(poAnchor).getTime();
                              const d2 = new Date(entry.date).getTime();
                              if (!Number.isNaN(d1) && !Number.isNaN(d2)) {
                                marginDays = Math.round((d1 - d2) / (1000 * 60 * 60 * 24));
                              }
                            }
                            const colorName = style.color_name || style.color?.name || '-';
                            const colorCode = style.color?.code || null;
                            return (
                              <TableRow key={key} className="hover:bg-muted/50">
                                <TableCell onClick={() => toggleFaStyleSelection(poId, style.id)} className="cursor-pointer">
                                  <Checkbox
                                    checked={isSelected}
                                    onCheckedChange={() => toggleFaStyleSelection(poId, style.id)}
                                  />
                                </TableCell>
                                <TableCell onClick={() => toggleFaStyleSelection(poId, style.id)} className="text-muted-foreground cursor-pointer">{style.po_number || '-'}</TableCell>
                                <TableCell onClick={() => toggleFaStyleSelection(poId, style.id)} className="font-medium cursor-pointer">{style.style_number}</TableCell>
                                <TableCell onClick={() => toggleFaStyleSelection(poId, style.id)} className="cursor-pointer">
                                  <div className="flex items-center gap-2">
                                    {colorCode && (
                                      <span
                                        className="inline-block h-4 w-4 rounded-full border border-border shrink-0"
                                        style={{ backgroundColor: colorCode }}
                                        title={colorCode}
                                      />
                                    )}
                                    <span>{colorName}</span>
                                  </div>
                                </TableCell>
                                <TableCell onClick={() => toggleFaStyleSelection(poId, style.id)} className="text-muted-foreground truncate max-w-[220px] cursor-pointer">{style.description || '-'}</TableCell>
                                <TableCell onClick={() => toggleFaStyleSelection(poId, style.id)} className="text-right cursor-pointer">{style.pivot?.quantity_in_po || style.total_quantity || '-'}</TableCell>
                                <TableCell onClick={() => toggleFaStyleSelection(poId, style.id)} className="text-right cursor-pointer">
                                  {Number.isNaN(poPriceNum) ? '-' : poPriceNum.toFixed(2)}
                                </TableCell>
                                <TableCell onClick={() => toggleFaStyleSelection(poId, style.id)} className="text-muted-foreground cursor-pointer">
                                  {poAnchor ? formatDate(poAnchor, '-') : '-'}
                                </TableCell>
                                <TableCell>
                                  <Input
                                    type="number"
                                    inputMode="decimal"
                                    step="0.01"
                                    min={0}
                                    className="h-9"
                                    placeholder="0.00"
                                    value={entry?.price ?? ''}
                                    disabled={!isSelected}
                                    onChange={(e) => updateFaPrice(key, e.target.value)}
                                  />
                                </TableCell>
                                <TableCell>
                                  <Input
                                    type="date"
                                    className="h-9"
                                    value={entry?.date ?? ''}
                                    disabled={!isSelected}
                                    onChange={(e) => updateFaDate(key, e.target.value)}
                                  />
                                </TableCell>
                                <TableCell className="text-right">
                                  {marginPrice == null ? '-' : (
                                    <span className={marginPrice < 0 ? 'text-destructive' : ''}>
                                      {marginPrice.toFixed(2)}
                                    </span>
                                  )}
                                </TableCell>
                                <TableCell className="text-right">
                                  {marginDays == null ? '-' : (
                                    <span className={marginDays < 0 ? 'text-destructive' : ''}>
                                      {marginDays}
                                    </span>
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

              {/* Notes */}
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
                disabled={faSelectedKeys.length === 0 || !selectedFactoryId || assignLoading}
              >
                {assignLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Assigning...
                  </>
                ) : (
                  `Assign ${faSelectedKeys.length} Style${faSelectedKeys.length !== 1 ? 's' : ''}`
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
            if (!open) resetImpAssignForm();
          }}
        >
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Assign Importer to Styles</DialogTitle>
              <DialogDescription>
                Select a purchase order, pick styles, and assign them to an importer
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6">
              {/* PO Selection */}
              <div className="space-y-2">
                <Label>Purchase Order *</Label>
                <Select value={impAssignPOId} onValueChange={handleImpAssignPOChange}>
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
              {impAssignPOId && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Styles ({impSelectedStyleIds.length} of {filteredImpStyles.length} selected)</Label>
                  </div>

                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search styles by number or description..."
                      value={impStyleSearch}
                      onChange={(e) => setImpStyleSearch(e.target.value)}
                      className="pl-8"
                    />
                  </div>

                  {impAssignStylesLoading ? (
                    <div className="text-sm text-muted-foreground py-4 text-center">Loading styles...</div>
                  ) : filteredImpStyles.length === 0 ? (
                    <div className="text-sm text-muted-foreground py-4 text-center">
                      {impAssignStyles.length === 0 ? 'No styles found in this PO' : 'No styles match your search'}
                    </div>
                  ) : (
                    <div className="border rounded-md max-h-[300px] overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-10">
                              <Checkbox
                                checked={filteredImpStyles.length > 0 && filteredImpStyles.every((s) => impSelectedStyleIds.includes(s.id))}
                                onCheckedChange={toggleImpSelectAll}
                              />
                            </TableHead>
                            <TableHead>Style #</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>Qty</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredImpStyles.map((style) => {
                            const isSelected = impSelectedStyleIds.includes(style.id);
                            return (
                              <TableRow
                                key={style.id}
                                className="cursor-pointer hover:bg-muted/50"
                                onClick={() => toggleImpStyleSelection(style.id)}
                              >
                                <TableCell>
                                  <Checkbox
                                    checked={isSelected}
                                    onCheckedChange={() => toggleImpStyleSelection(style.id)}
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
                                  {style.pivot?.assigned_importer_id ? (
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

              {/* Importer Selection */}
              {impSelectedStyleIds.length > 0 && (
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
              )}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowAssignImporterDialog(false);
                  resetImpAssignForm();
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleAssignImporter}
                disabled={impSelectedStyleIds.length === 0 || !selectedImporterId || assignImporterLoading}
              >
                {assignImporterLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Assigning...
                  </>
                ) : (
                  `Assign ${impSelectedStyleIds.length} Style${impSelectedStyleIds.length !== 1 ? 's' : ''}`
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

        {/* Factory Assignments Section */}
        {/* Stat Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Assignments</CardTitle>
              <Factory className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{faPagination.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {factoryAssignments.filter((a) => a.status === 'invited').length}
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
                {factoryAssignments.filter((a) => a.status === 'accepted').length}
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
                {factoryAssignments.filter((a) => a.status === 'rejected').length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Factory Assignments Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Factory Assignments</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label>Search</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by style, PO, or factory..."
                    value={faSearchQuery}
                    onChange={(e) => {
                      setFaSearchQuery(e.target.value);
                      setFaPagination((p) => ({ ...p, currentPage: 1 }));
                    }}
                    className="pl-8"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={faStatusFilter}
                  onValueChange={(v) => {
                    setFaStatusFilter(v);
                    setFaPagination((p) => ({ ...p, currentPage: 1 }));
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
                    setFaSearchQuery('');
                    setFaStatusFilter('all');
                    setFaPagination((p) => ({ ...p, currentPage: 1 }));
                  }}
                >
                  Clear Filters
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Factory Assignments Table */}
        <Card>
          <CardHeader>
            <CardTitle>Style Assignments</CardTitle>
            <CardDescription>
              Showing {factoryAssignments.length} of {faPagination.total} assignments
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Style</TableHead>
                  <TableHead>PO Number</TableHead>
                  {!isFactory && <TableHead>Factory</TableHead>}
                  <TableHead>{isFactory ? 'PO Date' : 'Assigned Date'}</TableHead>
                  <TableHead>Ex-Factory</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {factoryAssignments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isFactory ? 8 : 9} className="text-center py-8 text-muted-foreground">
                      No factory assignments found
                    </TableCell>
                  </TableRow>
                ) : (
                  factoryAssignments.map((assignment) => {
                    const isExpanded = expandedAssignmentIds.has(assignment.id);
                    const approvals = assignment.approvals || [];
                    const factoryPoDate = assignment.factory_po_date || assignment.assigned_at || assignment.created_at;
                    return (
                      <React.Fragment key={assignment.id}>
                        <TableRow>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => toggleAssignmentExpanded(assignment.id)}
                              title={isExpanded ? 'Hide approvals' : 'Show approvals'}
                            >
                              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </Button>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-medium">{assignment.style?.style_number || '-'}</span>
                              {assignment.style?.description && (
                                <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                                  {assignment.style.description}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="font-medium">{assignment.purchase_order?.po_number || '-'}</span>
                          </TableCell>
                          {!isFactory && (
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="font-medium">{assignment.factory?.name || '-'}</span>
                                {assignment.factory?.company && (
                                  <span className="text-xs text-muted-foreground">{assignment.factory.company}</span>
                                )}
                              </div>
                            </TableCell>
                          )}
                          <TableCell>{formatDate(factoryPoDate)}</TableCell>
                          <TableCell>
                            {assignment.factory_ex_factory_date
                              ? formatDate(assignment.factory_ex_factory_date)
                              : <span className="text-xs text-muted-foreground">Not set</span>}
                          </TableCell>
                          <TableCell>
                            {getAssignmentStatusBadge(assignment.status)}
                            {assignment.rejection_reason && (
                              <p className="text-xs text-red-500 mt-1 max-w-[150px] truncate" title={assignment.rejection_reason}>
                                {assignment.rejection_reason}
                              </p>
                            )}
                          </TableCell>
                          <TableCell className="max-w-xs truncate">{assignment.notes || '-'}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              {isFactory && assignment.status === 'invited' && (
                                <>
                                  <Button
                                    variant="default"
                                    size="sm"
                                    className="bg-green-600 hover:bg-green-700"
                                    onClick={() => handleAcceptAssignment(assignment)}
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
                              {canAssignFactory && (
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
                        {isExpanded && (
                          <TableRow>
                            <TableCell colSpan={isFactory ? 8 : 9} className="bg-muted/30 p-4">
                              {approvals.length === 0 ? (
                                <p className="text-xs text-muted-foreground">
                                  No sample approvals tracked for this style yet.
                                </p>
                              ) : (
                                <div className="space-y-2">
                                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                    Sample approvals
                                  </p>
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead className="text-xs">Sample Type</TableHead>
                                        <TableHead className="text-xs">Sent Date</TableHead>
                                        <TableHead className="text-xs">Agency Approved</TableHead>
                                        <TableHead className="text-xs">Importer Approved</TableHead>
                                        <TableHead className="text-xs">Status</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {approvals.map((a) => (
                                        <TableRow key={a.sample_type}>
                                          <TableCell className="text-xs font-medium">{a.display_name}</TableCell>
                                          <TableCell className="text-xs">
                                            {a.sent_date ? formatDate(a.sent_date) : <span className="text-muted-foreground">—</span>}
                                          </TableCell>
                                          <TableCell className="text-xs">
                                            {a.agency_approved_at ? formatDate(a.agency_approved_at) : <span className="text-muted-foreground">—</span>}
                                          </TableCell>
                                          <TableCell className="text-xs">
                                            {a.importer_approved_at ? formatDate(a.importer_approved_at) : <span className="text-muted-foreground">—</span>}
                                          </TableCell>
                                          <TableCell>{getApprovalStatusBadge(a.status)}</TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </TableBody>
            </Table>

            {/* Pagination */}
            {faPagination.lastPage > 1 && (
              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-muted-foreground">
                  Page {faPagination.currentPage} of {faPagination.lastPage}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setFaPagination({ ...faPagination, currentPage: faPagination.currentPage - 1 })}
                    disabled={faPagination.currentPage === 1}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setFaPagination({ ...faPagination, currentPage: faPagination.currentPage + 1 })}
                    disabled={faPagination.currentPage === faPagination.lastPage}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Reject Assignment Dialog */}
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
                  <textarea
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
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
              <Button variant="destructive" onClick={handleRejectAssignment}>
                Reject Assignment
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Assignment Dialog */}
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
              <Button variant="destructive" onClick={handleDeleteAssignment}>
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Assign Agency Dialog */}
        <Dialog
          open={showAssignAgencyDialog}
          onOpenChange={(open) => {
            setShowAssignAgencyDialog(open);
            if (!open) resetAgcAssignForm();
          }}
        >
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Assign Agency to Styles</DialogTitle>
              <DialogDescription>
                Select one or more purchase orders, pick styles, and assign them to an agency
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6">
              <div className="space-y-3">
                <Label>Purchase Orders * ({agcAssignPOIds.length} selected)</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search POs..."
                    value={agcPOSearch}
                    onChange={(e) => setAgcPOSearch(e.target.value)}
                    className="pl-8"
                  />
                </div>
                <div className="border rounded-md max-h-[220px] overflow-y-auto">
                  {(() => {
                    const visiblePOs = purchaseOrders.filter((po) => {
                      if (!agcPOSearch) return true;
                      const s = agcPOSearch.toLowerCase();
                      return (
                        po.po_number.toLowerCase().includes(s) ||
                        (po.headline || '').toLowerCase().includes(s)
                      );
                    });
                    if (visiblePOs.length === 0) {
                      return (
                        <div className="text-sm text-muted-foreground py-4 text-center">
                          No POs match your search
                        </div>
                      );
                    }
                    return (
                      <Table>
                        <TableBody>
                          {visiblePOs.map((po) => {
                            const checked = agcAssignPOIds.includes(po.id.toString());
                            return (
                              <TableRow
                                key={po.id}
                                className="cursor-pointer hover:bg-muted/50"
                                onClick={() => toggleAgcPOSelection(po.id.toString())}
                              >
                                <TableCell className="w-10">
                                  <Checkbox
                                    checked={checked}
                                    onCheckedChange={() => toggleAgcPOSelection(po.id.toString())}
                                  />
                                </TableCell>
                                <TableCell className="font-medium">{po.po_number}</TableCell>
                                <TableCell className="text-sm text-muted-foreground truncate max-w-[320px]">
                                  {po.headline || '-'}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    );
                  })()}
                </div>
              </div>

              {agcAssignPOIds.length > 0 && (
                <div className="space-y-3">
                  <Label>Styles ({agcSelectedKeys.length} of {filteredAgcStyles.length} selected)</Label>
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input placeholder="Search styles..." value={agcStyleSearch} onChange={(e) => setAgcStyleSearch(e.target.value)} className="pl-8" />
                  </div>
                  {agcAssignStylesLoading ? (
                    <div className="text-sm text-muted-foreground py-4 text-center">Loading styles...</div>
                  ) : filteredAgcStyles.length === 0 ? (
                    <div className="text-sm text-muted-foreground py-4 text-center">
                      {agcAssignStyles.length === 0 ? 'No styles found in selected POs' : 'No styles match your search'}
                    </div>
                  ) : (
                    <div className="border rounded-md max-h-[300px] overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-10">
                              <Checkbox
                                checked={
                                  filteredAgcStyles.length > 0 &&
                                  filteredAgcStyles.every((s) =>
                                    s.po_id != null && agcSelectedKeys.includes(keyFor(s.po_id, s.id))
                                  )
                                }
                                onCheckedChange={toggleAgcSelectAll}
                              />
                            </TableHead>
                            <TableHead>PO</TableHead>
                            <TableHead>Style #</TableHead>
                            <TableHead>Description</TableHead>
                            <TableHead>Qty</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredAgcStyles.map((style) => {
                            const poId = style.po_id as number;
                            const key = keyFor(poId, style.id);
                            return (
                              <TableRow
                                key={key}
                                className="cursor-pointer hover:bg-muted/50"
                                onClick={() => toggleAgcStyleSelection(poId, style.id)}
                              >
                                <TableCell>
                                  <Checkbox
                                    checked={agcSelectedKeys.includes(key)}
                                    onCheckedChange={() => toggleAgcStyleSelection(poId, style.id)}
                                  />
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">{style.po_number || '-'}</TableCell>
                                <TableCell className="font-medium">{style.style_number}</TableCell>
                                <TableCell className="text-sm text-muted-foreground truncate max-w-[200px]">{style.description || '-'}</TableCell>
                                <TableCell className="text-sm">{style.pivot?.quantity_in_po || style.total_quantity || '-'}</TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              )}
              {agcSelectedKeys.length > 0 && (
                <div className="space-y-2">
                  <Label>Agency *</Label>
                  <Select value={selectedAgencyId} onValueChange={setSelectedAgencyId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select an agency..." />
                    </SelectTrigger>
                    <SelectContent>
                      {agencies.map((agency) => (
                        <SelectItem key={agency.id} value={agency.id.toString()}>
                          {agency.name}{agency.company ? ` - ${agency.company}` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setShowAssignAgencyDialog(false); resetAgcAssignForm(); }}>Cancel</Button>
              <Button onClick={handleAssignAgency} disabled={agcSelectedKeys.length === 0 || !selectedAgencyId || assignAgencyLoading}>
                {assignAgencyLoading ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Assigning...</>) : `Assign ${agcSelectedKeys.length} Style${agcSelectedKeys.length !== 1 ? 's' : ''}`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* My Style Assignments (for Importer/Agency to see styles assigned to them) */}
        {(isImporter || isAgency) && myStyleAssignments.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Styles Assigned to You</CardTitle>
              <CardDescription>
                Styles that have been assigned to you across purchase orders
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Style</TableHead>
                    <TableHead>PO Number</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Unit Price</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {myStyleAssignments.map((item, idx) => (
                    <TableRow key={idx}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium">{item.style_number || '-'}</span>
                          {item.style_description && (
                            <span className="text-xs text-muted-foreground truncate max-w-[200px]">{item.style_description}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium">{item.po_number || '-'}</TableCell>
                      <TableCell>{item.quantity_in_po || '-'}</TableCell>
                      <TableCell>{item.unit_price_in_po ? `$${item.unit_price_in_po}` : '-'}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{item.status || 'pending'}</Badge>
                      </TableCell>
                      <TableCell>{item.created_at ? formatDate(item.created_at) : '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {msaPagination.lastPage > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <div className="text-sm text-muted-foreground">
                    Page {msaPagination.currentPage} of {msaPagination.lastPage}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setMsaPagination({ ...msaPagination, currentPage: msaPagination.currentPage - 1 })} disabled={msaPagination.currentPage === 1}>Previous</Button>
                    <Button variant="outline" size="sm" onClick={() => setMsaPagination({ ...msaPagination, currentPage: msaPagination.currentPage + 1 })} disabled={msaPagination.currentPage === msaPagination.lastPage}>Next</Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
