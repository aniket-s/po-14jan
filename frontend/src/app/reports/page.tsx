'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  FileDown,
  Loader2,
  Factory,
  Truck,
  ClipboardCheck,
  AlertTriangle,
  CheckCircle2,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  Package,
} from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { StatCardsSkeleton, TableSkeleton } from '@/components/skeletons';
import { useAuth } from '@/contexts/AuthContext';
import { POReportKPICards } from '@/components/reports/po/POReportKPICards';
import { POReportFilterBar } from '@/components/reports/po/POReportFilterBar';
import { POReportTableView } from '@/components/reports/po/POReportTableView';
import { POReportDetailPanel } from '@/components/reports/po/POReportDetailPanel';
import {
  DEFAULT_PO_REPORT_FILTERS,
  type POReportFilters,
  type POReportGroupBy,
  type POReportItem,
  type POReportLookups,
  type POReportResponse,
} from '@/components/reports/po/types';

// ─── Types ───────────────────────────────────────────────────────────────────

interface FactoryOption {
  id: number;
  name: string;
  company: string | null;
}

interface FactorySummaryItem {
  factory_id: number;
  factory_name: string;
  factory_company: string | null;
  total_styles: number;
  total_quantity: number;
  total_value: number;
  status_breakdown: Record<string, number>;
  po_count: number;
}

interface FactoryWiseItem {
  id: number;
  po_number: string;
  po_date: string | null;
  style_number: string;
  style_description: string;
  factory_id: number;
  factory_name: string;
  factory_company: string | null;
  quantity: number;
  unit_price: number;
  total_value: number;
  ex_factory_date: string | null;
  estimated_ex_factory_date: string | null;
  production_status: string;
  shipping_approval_status: string;
  po_status: string;
}

interface PendingShipmentItem {
  id: number;
  po_number: string;
  po_date: string | null;
  style_number: string;
  style_description: string;
  factory_id: number;
  factory_name: string;
  quantity: number;
  ex_factory_date: string | null;
  estimated_ex_factory_date: string | null;
  days_remaining: number | null;
  is_overdue: boolean;
  production_status: string;
  shipping_approval_status: string;
}

interface PendingSampleItem {
  id: number;
  po_number: string;
  style_number: string;
  factory_id: number | null;
  factory_name: string;
  sample_type: string;
  sample_reference: string | null;
  submission_date: string | null;
  days_pending: number | null;
  typical_days: number | null;
  is_overdue: boolean;
  agency_status: string;
  importer_status: string;
  final_status: string;
  submitted_by: string;
  notes: string | null;
}

interface DelayItem {
  delay_type: 'shipment' | 'ex_factory' | 'sample';
  po_number: string;
  style_number: string;
  factory_name: string;
  reference: string;
  expected_date: string | null;
  actual_date: string | null;
  days_delayed: number;
  status: string;
  severity: 'warning' | 'critical';
  details: string;
}

interface ApprovedSampleItem {
  id: number;
  po_number: string;
  style_number: string;
  factory_id: number | null;
  factory_name: string;
  sample_type: string;
  sample_reference: string | null;
  submission_date: string | null;
  agency_status: string;
  agency_approved_by: string;
  agency_approved_at: string | null;
  importer_status: string;
  importer_approved_by: string;
  importer_approved_at: string | null;
  final_status: string;
  submitted_by: string;
  notes: string | null;
}

interface ReportData<T> {
  summary: Record<string, number>;
  items: T[];
  factories: FactoryOption[];
  factory_summary?: FactorySummaryItem[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const formatDate = (value: string | null | undefined) => {
  if (!value) return '—';
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

const formatDateTime = (value: string | null | undefined) => {
  if (!value) return '—';
  const d = new Date(value);
  if (isNaN(d.getTime())) return value;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    + ', ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
};

const formatCurrency = (value: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);

const formatNumber = (value: number) =>
  new Intl.NumberFormat('en-US').format(value);

function statusBadge(status: string) {
  const map: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    pending: 'outline',
    in_production: 'default',
    completed: 'secondary',
    shipped: 'secondary',
    approved: 'secondary',
    rejected: 'destructive',
    requested: 'outline',
    agency_approved: 'default',
  };
  return (
    <Badge variant={map[status] ?? 'outline'} className="text-xs capitalize whitespace-nowrap">
      {status?.replace(/_/g, ' ') || 'N/A'}
    </Badge>
  );
}

function severityBadge(severity: string) {
  if (severity === 'critical') {
    return <Badge variant="destructive" className="text-xs">Critical</Badge>;
  }
  return <Badge className="bg-amber-500 hover:bg-amber-600 text-xs">Warning</Badge>;
}

function delayTypeBadge(type: string) {
  const config: Record<string, { label: string; className: string }> = {
    shipment: { label: 'Shipment', className: 'bg-blue-500 hover:bg-blue-600' },
    ex_factory: { label: 'Ex-Factory', className: 'bg-purple-500 hover:bg-purple-600' },
    sample: { label: 'Sample', className: 'bg-orange-500 hover:bg-orange-600' },
  };
  const c = config[type] ?? { label: type, className: '' };
  return <Badge className={`text-xs text-white ${c.className}`}>{c.label}</Badge>;
}

// ─── Pagination & Sort Hook ──────────────────────────────────────────────────

const PAGE_SIZE = 15;

type SortDir = 'asc' | 'desc' | null;

function useSortedPaginatedData<T extends object>(
  data: T[],
  searchFields: (keyof T)[],
  searchQuery: string,
) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);
  const [page, setPage] = useState(1);

  // Reset page when data or search changes
  useEffect(() => { setPage(1); }, [data.length, searchQuery]);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return data;
    const q = searchQuery.toLowerCase();
    return data.filter((row) =>
      searchFields.some((f) => String(row[f] ?? '').toLowerCase().includes(q))
    );
  }, [data, searchQuery, searchFields]);

  const sorted = useMemo(() => {
    if (!sortKey || !sortDir) return filtered;
    return [...filtered].sort((a, b) => {
      const av = (a as Record<string, unknown>)[sortKey] ?? '';
      const bv = (b as Record<string, unknown>)[sortKey] ?? '';
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortDir === 'asc' ? av - bv : bv - av;
      }
      return sortDir === 'asc'
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av));
    });
  }, [filtered, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const paginated = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const toggleSort = useCallback((key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : d === 'desc' ? null : 'asc'));
      if (sortDir === 'desc') setSortKey(null);
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }, [sortKey, sortDir]);

  return { paginated, sorted, page, setPage, totalPages, toggleSort, sortKey, sortDir, totalFiltered: filtered.length };
}

// ─── SortableHeader ──────────────────────────────────────────────────────────

function SortableHeader({
  label,
  sortKey: key,
  currentSortKey,
  sortDir,
  onToggle,
}: {
  label: string;
  sortKey: string;
  currentSortKey: string | null;
  sortDir: SortDir;
  onToggle: (key: string) => void;
}) {
  const active = currentSortKey === key;
  return (
    <TableHead>
      <button
        className="flex items-center gap-1 text-xs font-medium hover:text-foreground transition-colors"
        onClick={() => onToggle(key)}
      >
        {label}
        {active && sortDir === 'asc' ? (
          <ArrowUp className="h-3 w-3" />
        ) : active && sortDir === 'desc' ? (
          <ArrowDown className="h-3 w-3" />
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-40" />
        )}
      </button>
    </TableHead>
  );
}

// ─── Pagination Controls ─────────────────────────────────────────────────────

function PaginationControls({
  page,
  totalPages,
  totalFiltered,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  totalFiltered: number;
  onPageChange: (p: number) => void;
}) {
  if (totalPages <= 1) return null;
  const from = (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, totalFiltered);
  return (
    <div className="flex items-center justify-between pt-4">
      <p className="text-sm text-muted-foreground">
        Showing {from}-{to} of {formatNumber(totalFiltered)}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium">
          Page {page} of {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function ReportsPage() {
  const { hasRole } = useAuth();

  // Global filters
  const [activeTab, setActiveTab] = useState('purchase-orders');
  const [factoryId, setFactoryId] = useState<string>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [search, setSearch] = useState('');

  // Data states
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [factories, setFactories] = useState<FactoryOption[]>([]);

  const [factoryWiseData, setFactoryWiseData] = useState<ReportData<FactoryWiseItem> | null>(null);
  const [pendingShipmentsData, setPendingShipmentsData] = useState<ReportData<PendingShipmentItem> | null>(null);
  const [pendingSamplesData, setPendingSamplesData] = useState<ReportData<PendingSampleItem> | null>(null);
  const [delayData, setDelayData] = useState<ReportData<DelayItem> | null>(null);
  const [approvedSamplesData, setApprovedSamplesData] = useState<ReportData<ApprovedSampleItem> | null>(null);

  // ── PO Reports tab state ──────────────────────────────────────────────────
  const [poReportData, setPoReportData] = useState<POReportResponse | null>(null);
  const [poReportFilters, setPoReportFilters] = useState<POReportFilters>(DEFAULT_PO_REPORT_FILTERS);
  const [poReportGroupBy, setPoReportGroupBy] = useState<POReportGroupBy>('none');
  const [poReportKpiFilter, setPoReportKpiFilter] = useState<string>('');
  const [poReportSelectedIds, setPoReportSelectedIds] = useState<Set<number>>(new Set());
  const [poReportDetailItem, setPoReportDetailItem] = useState<POReportItem | null>(null);
  const [poReportSortBy, setPoReportSortBy] = useState<string>('po_date');
  const [poReportSortDir, setPoReportSortDir] = useState<'asc' | 'desc'>('desc');
  const [poReportPage, setPoReportPage] = useState(1);
  const [poReportLookups, setPoReportLookups] = useState<POReportLookups>({
    retailers: [], buyers: [], agencies: [], seasons: [], factories: [], countries: [],
  });
  const PO_REPORT_PER_PAGE = 25;

  // Set default date range
  useEffect(() => {
    const end = new Date();
    const start = new Date();
    start.setMonth(start.getMonth() - 6);
    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
  }, []);

  // Fetch data when tab or filters change
  useEffect(() => {
    if (!startDate || !endDate) return;
    fetchActiveTab();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, factoryId, startDate, endDate]);

  // Refetch PO report when its own filters / sort / page / KPI quick-filter change.
  useEffect(() => {
    if (activeTab !== 'purchase-orders') return;
    if (!startDate || !endDate) return;
    fetchPoReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, poReportFilters, poReportSortBy, poReportSortDir, poReportPage, poReportKpiFilter, startDate, endDate]);

  // Load lookups for the PO filter bar lazily once the tab is opened.
  useEffect(() => {
    if (activeTab !== 'purchase-orders') return;
    if (poReportLookups.retailers.length > 0) return;
    fetchPoReportLookups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const buildParams = useCallback(() => {
    const params: Record<string, string> = {};
    if (startDate) params.start_date = startDate;
    if (endDate) params.end_date = endDate;
    if (factoryId && factoryId !== 'all') params.factory_id = factoryId;
    return params;
  }, [startDate, endDate, factoryId]);

  const buildPoReportParams = useCallback((): Record<string, string> => {
    const p: Record<string, string> = {};
    if (startDate) p.start_date = startDate;
    if (endDate) p.end_date = endDate;
    if (poReportFilters.search) p.search = poReportFilters.search;
    if (poReportFilters.status !== 'all') p.status = poReportFilters.status;
    if (poReportFilters.retailer_id !== 'all') p.retailer_id = poReportFilters.retailer_id;
    if (poReportFilters.buyer_id !== 'all') p.buyer_id = poReportFilters.buyer_id;
    if (poReportFilters.agency_id !== 'all') p.agency_id = poReportFilters.agency_id;
    if (poReportFilters.season_id !== 'all') p.season_id = poReportFilters.season_id;
    if (poReportFilters.factory_id !== 'all') p.factory_id = poReportFilters.factory_id;
    if (poReportFilters.country_id !== 'all') p.country_id = poReportFilters.country_id;
    if (poReportFilters.shipping_term !== 'all') p.shipping_term = poReportFilters.shipping_term;
    if (poReportFilters.etd_overdue) p.etd_overdue = '1';
    if (poReportKpiFilter === 'etd_overdue') p.etd_overdue = '1';
    if (poReportKpiFilter === 'active') p.status = 'active';
    p.sort_by = poReportSortBy;
    p.sort_dir = poReportSortDir;
    p.page = String(poReportPage);
    p.per_page = String(PO_REPORT_PER_PAGE);
    return p;
  }, [startDate, endDate, poReportFilters, poReportKpiFilter, poReportSortBy, poReportSortDir, poReportPage]);

  const fetchPoReport = async () => {
    setLoading(true);
    try {
      const res = await api.get<POReportResponse>('/reports/purchase-orders', { params: buildPoReportParams() });
      setPoReportData(res.data);
    } catch (e) {
      console.error('Failed to fetch PO report:', e);
      toast.error('Failed to load purchase orders report.');
    } finally {
      setLoading(false);
    }
  };

  const fetchPoReportLookups = async () => {
    try {
      // /agencies, /factories return User[] with a `name`. Master-data endpoints
      // either return an array directly or a {data: []} envelope - normalize.
      const unwrap = (d: any): any[] => (Array.isArray(d) ? d : d?.data ?? []);
      const [retailers, buyers, agencies, seasons, factoriesRes, countries] = await Promise.all([
        api.get('/master-data/retailers?all=true').then((r) => unwrap(r.data)),
        api.get('/master-data/buyers?all=true').then((r) => unwrap(r.data)),
        api.get('/agencies').then((r) => unwrap(r.data)).catch(() => []),
        api.get('/master-data/seasons?all=true').then((r) => unwrap(r.data)),
        api.get('/factories').then((r) => unwrap(r.data)).catch(() => []),
        api.get('/master-data/countries?all=true').then((r) => unwrap(r.data)),
      ]);
      setPoReportLookups({
        retailers: retailers.map((r: any) => ({ id: r.id, name: r.name })),
        buyers: buyers.map((b: any) => ({ id: b.id, name: b.name, code: b.code })),
        agencies: agencies.map((a: any) => ({ id: a.id, name: a.name })),
        seasons: seasons.map((s: any) => ({ id: s.id, name: s.name })),
        factories: factoriesRes.map((f: any) => ({ id: f.id, name: f.name ?? f.company ?? `Factory #${f.id}` })),
        countries: countries.map((c: any) => ({ id: c.id, name: c.name })),
      });
    } catch (e) {
      console.error('Failed to load PO report lookups:', e);
    }
  };

  const fetchActiveTab = async () => {
    if (activeTab === 'purchase-orders') {
      // Driven by its own effect below.
      return;
    }
    setLoading(true);
    try {
      const params = buildParams();
      let response;

      switch (activeTab) {
        case 'factory-wise':
          response = await api.get('/reports/factory-wise', { params });
          setFactoryWiseData(response.data);
          if (response.data.factories) setFactories(response.data.factories);
          break;
        case 'pending-shipments':
          response = await api.get('/reports/pending-shipments', { params });
          setPendingShipmentsData(response.data);
          if (response.data.factories) setFactories(response.data.factories);
          break;
        case 'pending-samples':
          response = await api.get('/reports/pending-samples', { params });
          setPendingSamplesData(response.data);
          if (response.data.factories) setFactories(response.data.factories);
          break;
        case 'approved-samples':
          response = await api.get('/reports/approved-samples', { params });
          setApprovedSamplesData(response.data);
          if (response.data.factories) setFactories(response.data.factories);
          break;
        case 'delays':
          response = await api.get('/reports/delays', { params });
          setDelayData(response.data);
          if (response.data.factories) setFactories(response.data.factories);
          break;
      }
    } catch (error) {
      console.error(`Failed to fetch ${activeTab} report:`, error);
      toast.error('Failed to load report data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const togglePoReportSort = (key: string) => {
    if (poReportSortBy === key) {
      setPoReportSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setPoReportSortBy(key);
      setPoReportSortDir('desc');
    }
    setPoReportPage(1);
  };

  const togglePoReportSelect = (id: number) => {
    setPoReportSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const togglePoReportSelectAll = () => {
    setPoReportSelectedIds((prev) => {
      const items = poReportData?.orders ?? [];
      if (prev.size === items.length && items.length > 0) return new Set();
      return new Set(items.map((o) => o.id));
    });
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const isPoReport = activeTab === 'purchase-orders';
      const params = isPoReport
        ? { ...buildPoReportParams(), format: 'csv' }
        : { ...buildParams(), format: 'csv' };
      const endpointMap: Record<string, string> = {
        'purchase-orders': '/reports/purchase-orders',
        'factory-wise': '/reports/factory-wise',
        'pending-shipments': '/reports/pending-shipments',
        'pending-samples': '/reports/pending-samples',
        'approved-samples': '/reports/approved-samples',
        delays: '/reports/delays',
      };
      const response = await api.get(endpointMap[activeTab], {
        params,
        responseType: 'blob',
        headers: { Accept: 'text/csv' },
      });

      // Check if the response is actually CSV (not a JSON error)
      const blob = new Blob([response.data], { type: 'text/csv' });
      if (blob.size === 0) {
        toast.error('Export returned empty data. Try adjusting your filters.');
        return;
      }

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${activeTab}_report_${startDate}_${endDate}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('CSV exported successfully.');
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Export failed. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  // ─── KPI Cards ─────────────────────────────────────────────────────────────

  const renderKPICards = () => {
    const cards = [
      {
        title: 'Total Factories',
        value: factoryWiseData?.summary?.total_factories ?? factories.length,
        icon: <Factory className="h-5 w-5 text-muted-foreground" />,
        subtitle: `${formatNumber(factoryWiseData?.summary?.total_styles ?? 0)} styles assigned`,
      },
      {
        title: 'Pending Shipments',
        value: pendingShipmentsData?.summary?.total_pending ?? '—',
        icon: <Truck className="h-5 w-5 text-muted-foreground" />,
        subtitle: `${pendingShipmentsData?.summary?.overdue ?? 0} overdue`,
        alert: (pendingShipmentsData?.summary?.overdue ?? 0) > 0,
      },
      {
        title: 'Pending Samples',
        value: pendingSamplesData?.summary?.total_pending ?? '—',
        icon: <ClipboardCheck className="h-5 w-5 text-muted-foreground" />,
        subtitle: `${pendingSamplesData?.summary?.overdue ?? 0} overdue`,
        alert: (pendingSamplesData?.summary?.overdue ?? 0) > 0,
      },
      {
        title: 'Approved Samples',
        value: approvedSamplesData?.summary?.total_approved ?? '—',
        icon: <CheckCircle2 className="h-5 w-5 text-green-600" />,
        subtitle: `${approvedSamplesData?.summary?.by_importer ?? 0} by importer`,
      },
      {
        title: 'Active Delays',
        value: delayData?.summary?.total_delays ?? '—',
        icon: <AlertTriangle className="h-5 w-5 text-muted-foreground" />,
        subtitle: `${delayData?.summary?.critical_count ?? 0} critical`,
        alert: (delayData?.summary?.critical_count ?? 0) > 0,
      },
    ];

    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {cards.map((card) => (
          <Card key={card.title} className={card.alert ? 'border-red-200 dark:border-red-900' : ''}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
              {card.icon}
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{typeof card.value === 'number' ? formatNumber(card.value) : card.value}</div>
              <p className={`text-xs ${card.alert ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>
                {card.subtitle}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  // ─── Factory Wise Tab ──────────────────────────────────────────────────────

  function FactoryWiseTab() {
    const items = factoryWiseData?.items ?? [];
    const summary = factoryWiseData?.factory_summary ?? [];
    const {
      paginated, page, setPage, totalPages, toggleSort, sortKey, sortDir, totalFiltered,
    } = useSortedPaginatedData(
      items,
      ['po_number', 'style_number', 'factory_name'] as (keyof FactoryWiseItem)[],
      search,
    );

    return (
      <div className="space-y-4">
        {/* Factory Summary Cards */}
        {summary.length > 0 && !search && (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {summary.slice(0, 6).map((fs) => (
              <Card key={fs.factory_id} className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setFactoryId(String(fs.factory_id))}>
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="font-semibold text-sm">{fs.factory_name}</p>
                      {fs.factory_company && (
                        <p className="text-xs text-muted-foreground">{fs.factory_company}</p>
                      )}
                    </div>
                    <Badge variant="outline" className="text-xs">{fs.po_count} POs</Badge>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <p className="text-muted-foreground">Styles</p>
                      <p className="font-semibold">{fs.total_styles}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Quantity</p>
                      <p className="font-semibold">{formatNumber(fs.total_quantity)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Value</p>
                      <p className="font-semibold">{formatCurrency(fs.total_value)}</p>
                    </div>
                  </div>
                  {Object.keys(fs.status_breakdown).length > 0 && (
                    <div className="flex gap-1 mt-2 flex-wrap">
                      {Object.entries(fs.status_breakdown).map(([st, count]) => (
                        <Badge key={st} variant="secondary" className="text-[10px]">
                          {st.replace(/_/g, ' ')}: {count}
                        </Badge>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Data Table */}
        <Card>
          <CardContent className="pt-4">
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableHeader label="PO #" sortKey="po_number" currentSortKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
                    <SortableHeader label="Style #" sortKey="style_number" currentSortKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
                    <SortableHeader label="Factory" sortKey="factory_name" currentSortKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
                    <SortableHeader label="Qty" sortKey="quantity" currentSortKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
                    <SortableHeader label="Value" sortKey="total_value" currentSortKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
                    <SortableHeader label="Ex-Factory" sortKey="ex_factory_date" currentSortKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
                    <TableHead className="text-xs">Production</TableHead>
                    <TableHead className="text-xs">Shipping</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginated.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                        No data found
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginated.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell className="font-medium text-sm">{row.po_number}</TableCell>
                        <TableCell className="text-sm">{row.style_number}</TableCell>
                        <TableCell className="text-sm">{row.factory_name}</TableCell>
                        <TableCell className="text-sm">{formatNumber(row.quantity)}</TableCell>
                        <TableCell className="text-sm">{formatCurrency(row.total_value)}</TableCell>
                        <TableCell className="text-sm">{formatDate(row.ex_factory_date)}</TableCell>
                        <TableCell>{statusBadge(row.production_status)}</TableCell>
                        <TableCell>{statusBadge(row.shipping_approval_status)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            <PaginationControls page={page} totalPages={totalPages} totalFiltered={totalFiltered} onPageChange={setPage} />
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── Pending Shipments Tab ─────────────────────────────────────────────────

  function PendingShipmentsTab() {
    const items = pendingShipmentsData?.items ?? [];
    const {
      paginated, page, setPage, totalPages, toggleSort, sortKey, sortDir, totalFiltered,
    } = useSortedPaginatedData(
      items,
      ['po_number', 'style_number', 'factory_name'] as (keyof PendingShipmentItem)[],
      search,
    );

    return (
      <Card>
        <CardContent className="pt-4">
          {/* Summary bar */}
          <div className="flex gap-4 mb-4 flex-wrap">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Total Pending:</span>
              <span className="font-bold">{pendingShipmentsData?.summary?.total_pending ?? 0}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Overdue:</span>
              <span className="font-bold text-red-600">{pendingShipmentsData?.summary?.overdue ?? 0}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">On Track:</span>
              <span className="font-bold text-green-600">{pendingShipmentsData?.summary?.on_track ?? 0}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Total Qty:</span>
              <span className="font-bold">{formatNumber(pendingShipmentsData?.summary?.total_quantity ?? 0)}</span>
            </div>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHeader label="PO #" sortKey="po_number" currentSortKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
                  <SortableHeader label="Style #" sortKey="style_number" currentSortKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
                  <SortableHeader label="Factory" sortKey="factory_name" currentSortKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
                  <SortableHeader label="Qty" sortKey="quantity" currentSortKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
                  <SortableHeader label="Ex-Factory" sortKey="ex_factory_date" currentSortKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
                  <SortableHeader label="Days Left" sortKey="days_remaining" currentSortKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
                  <TableHead className="text-xs">Production</TableHead>
                  <TableHead className="text-xs">Ship Approval</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      No pending shipments found
                    </TableCell>
                  </TableRow>
                ) : (
                  paginated.map((row) => (
                    <TableRow key={row.id} className={row.is_overdue ? 'bg-red-50 dark:bg-red-950/20' : ''}>
                      <TableCell className="font-medium text-sm">{row.po_number}</TableCell>
                      <TableCell className="text-sm">{row.style_number}</TableCell>
                      <TableCell className="text-sm">{row.factory_name}</TableCell>
                      <TableCell className="text-sm">{formatNumber(row.quantity)}</TableCell>
                      <TableCell className="text-sm">{formatDate(row.ex_factory_date)}</TableCell>
                      <TableCell>
                        {row.days_remaining !== null ? (
                          <span className={`text-sm font-semibold ${
                            row.is_overdue
                              ? 'text-red-600'
                              : row.days_remaining <= 7
                                ? 'text-amber-600'
                                : 'text-green-600'
                          }`}>
                            {row.is_overdue ? `${Math.abs(row.days_remaining)}d overdue` : `${row.days_remaining}d`}
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-sm">—</span>
                        )}
                      </TableCell>
                      <TableCell>{statusBadge(row.production_status)}</TableCell>
                      <TableCell>{statusBadge(row.shipping_approval_status)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <PaginationControls page={page} totalPages={totalPages} totalFiltered={totalFiltered} onPageChange={setPage} />
        </CardContent>
      </Card>
    );
  }

  // ─── Pending Samples Tab ───────────────────────────────────────────────────

  function PendingSamplesTab() {
    const items = pendingSamplesData?.items ?? [];
    const {
      paginated, page, setPage, totalPages, toggleSort, sortKey, sortDir, totalFiltered,
    } = useSortedPaginatedData(
      items,
      ['po_number', 'style_number', 'factory_name', 'sample_type'] as (keyof PendingSampleItem)[],
      search,
    );

    return (
      <Card>
        <CardContent className="pt-4">
          {/* Summary bar */}
          <div className="flex gap-4 mb-4 flex-wrap">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Total Pending:</span>
              <span className="font-bold">{pendingSamplesData?.summary?.total_pending ?? 0}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Agency Pending:</span>
              <span className="font-bold text-amber-600">{pendingSamplesData?.summary?.pending_agency ?? 0}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Importer Pending:</span>
              <span className="font-bold text-blue-600">{pendingSamplesData?.summary?.pending_importer ?? 0}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Overdue:</span>
              <span className="font-bold text-red-600">{pendingSamplesData?.summary?.overdue ?? 0}</span>
            </div>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHeader label="PO #" sortKey="po_number" currentSortKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
                  <SortableHeader label="Style #" sortKey="style_number" currentSortKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
                  <SortableHeader label="Factory" sortKey="factory_name" currentSortKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
                  <SortableHeader label="Sample Type" sortKey="sample_type" currentSortKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
                  <SortableHeader label="Submitted" sortKey="submission_date" currentSortKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
                  <SortableHeader label="Days Pending" sortKey="days_pending" currentSortKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
                  <TableHead className="text-xs">Agency</TableHead>
                  <TableHead className="text-xs">Importer</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      No pending samples found
                    </TableCell>
                  </TableRow>
                ) : (
                  paginated.map((row) => (
                    <TableRow key={row.id} className={row.is_overdue ? 'bg-red-50 dark:bg-red-950/20' : ''}>
                      <TableCell className="font-medium text-sm">{row.po_number}</TableCell>
                      <TableCell className="text-sm">{row.style_number}</TableCell>
                      <TableCell className="text-sm">{row.factory_name}</TableCell>
                      <TableCell className="text-sm">{row.sample_type}</TableCell>
                      <TableCell className="text-sm">{formatDate(row.submission_date)}</TableCell>
                      <TableCell>
                        {row.days_pending !== null ? (
                          <span className={`text-sm font-semibold ${
                            row.is_overdue
                              ? 'text-red-600'
                              : row.days_pending > (row.typical_days ?? 999) * 0.7
                                ? 'text-amber-600'
                                : 'text-green-600'
                          }`}>
                            {row.days_pending}d
                            {row.typical_days ? ` / ${row.typical_days}d` : ''}
                          </span>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell>{statusBadge(row.agency_status)}</TableCell>
                      <TableCell>{statusBadge(row.importer_status)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <PaginationControls page={page} totalPages={totalPages} totalFiltered={totalFiltered} onPageChange={setPage} />
        </CardContent>
      </Card>
    );
  }

  // ─── Delay Reports Tab ─────────────────────────────────────────────────────

  function DelayReportsTab() {
    const items = delayData?.items ?? [];
    const {
      paginated, page, setPage, totalPages, toggleSort, sortKey, sortDir, totalFiltered,
    } = useSortedPaginatedData(
      items,
      ['po_number', 'style_number', 'factory_name', 'reference'] as (keyof DelayItem)[],
      search,
    );

    return (
      <Card>
        <CardContent className="pt-4">
          {/* Summary bar */}
          <div className="flex gap-4 mb-4 flex-wrap">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Total Delays:</span>
              <span className="font-bold">{delayData?.summary?.total_delays ?? 0}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Truck className="h-3.5 w-3.5 text-blue-500" />
              <span className="text-muted-foreground">Shipment:</span>
              <span className="font-bold">{delayData?.summary?.shipment_delays ?? 0}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Factory className="h-3.5 w-3.5 text-purple-500" />
              <span className="text-muted-foreground">Ex-Factory:</span>
              <span className="font-bold">{delayData?.summary?.ex_factory_delays ?? 0}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <ClipboardCheck className="h-3.5 w-3.5 text-orange-500" />
              <span className="text-muted-foreground">Sample:</span>
              <span className="font-bold">{delayData?.summary?.sample_delays ?? 0}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
              <span className="text-muted-foreground">Critical:</span>
              <span className="font-bold text-red-600">{delayData?.summary?.critical_count ?? 0}</span>
            </div>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Type</TableHead>
                  <SortableHeader label="PO #" sortKey="po_number" currentSortKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
                  <SortableHeader label="Style #" sortKey="style_number" currentSortKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
                  <SortableHeader label="Factory" sortKey="factory_name" currentSortKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
                  <SortableHeader label="Expected Date" sortKey="expected_date" currentSortKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
                  <SortableHeader label="Days Delayed" sortKey="days_delayed" currentSortKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
                  <TableHead className="text-xs">Severity</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      No delays found
                    </TableCell>
                  </TableRow>
                ) : (
                  paginated.map((row, idx) => (
                    <TableRow key={`${row.delay_type}-${row.po_number}-${row.style_number}-${idx}`}
                      className={row.severity === 'critical' ? 'bg-red-50 dark:bg-red-950/20' : ''}>
                      <TableCell>{delayTypeBadge(row.delay_type)}</TableCell>
                      <TableCell className="font-medium text-sm">{row.po_number}</TableCell>
                      <TableCell className="text-sm">{row.style_number}</TableCell>
                      <TableCell className="text-sm">{row.factory_name}</TableCell>
                      <TableCell className="text-sm">{formatDate(row.expected_date)}</TableCell>
                      <TableCell>
                        <span className={`text-sm font-bold ${
                          row.days_delayed > 14 ? 'text-red-600' : row.days_delayed > 7 ? 'text-amber-600' : 'text-yellow-600'
                        }`}>
                          {row.days_delayed}d
                        </span>
                      </TableCell>
                      <TableCell>{severityBadge(row.severity)}</TableCell>
                      <TableCell>{statusBadge(row.status)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <PaginationControls page={page} totalPages={totalPages} totalFiltered={totalFiltered} onPageChange={setPage} />
        </CardContent>
      </Card>
    );
  }

  // ─── Approved Samples Tab ───────────────────────────────────────────────────

  function ApprovedSamplesTab() {
    const items = approvedSamplesData?.items ?? [];
    const {
      paginated, page, setPage, totalPages, toggleSort, sortKey, sortDir, totalFiltered,
    } = useSortedPaginatedData(
      items,
      ['po_number', 'style_number', 'factory_name', 'sample_type'] as (keyof ApprovedSampleItem)[],
      search,
    );

    return (
      <Card>
        <CardContent className="pt-4">
          {/* Summary bar */}
          <div className="flex gap-4 mb-4 flex-wrap">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Total Approved:</span>
              <span className="font-bold text-green-600">{approvedSamplesData?.summary?.total_approved ?? 0}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Agency Approved:</span>
              <span className="font-bold">{approvedSamplesData?.summary?.by_agency ?? 0}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Importer Approved:</span>
              <span className="font-bold">{approvedSamplesData?.summary?.by_importer ?? 0}</span>
            </div>
          </div>

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableHeader label="PO #" sortKey="po_number" currentSortKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
                  <SortableHeader label="Style #" sortKey="style_number" currentSortKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
                  <SortableHeader label="Factory" sortKey="factory_name" currentSortKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
                  <SortableHeader label="Sample Type" sortKey="sample_type" currentSortKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
                  <SortableHeader label="Submitted" sortKey="submission_date" currentSortKey={sortKey} sortDir={sortDir} onToggle={toggleSort} />
                  <TableHead className="text-xs">Agency</TableHead>
                  <TableHead className="text-xs">Importer</TableHead>
                  <TableHead className="text-xs">Submitted By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      No approved samples found
                    </TableCell>
                  </TableRow>
                ) : (
                  paginated.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium text-sm">{row.po_number}</TableCell>
                      <TableCell className="text-sm">{row.style_number}</TableCell>
                      <TableCell className="text-sm">{row.factory_name}</TableCell>
                      <TableCell className="text-sm">{row.sample_type}</TableCell>
                      <TableCell className="text-sm">{formatDate(row.submission_date)}</TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          {statusBadge(row.agency_status)}
                          {row.agency_approved_at && (
                            <span className="text-[10px] text-muted-foreground mt-0.5">{formatDateTime(row.agency_approved_at)}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          {statusBadge(row.importer_status)}
                          {row.importer_approved_at && (
                            <span className="text-[10px] text-muted-foreground mt-0.5">{formatDateTime(row.importer_approved_at)}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{row.submitted_by}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          <PaginationControls page={page} totalPages={totalPages} totalFiltered={totalFiltered} onPageChange={setPage} />
        </CardContent>
      </Card>
    );
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <DashboardLayout requiredPermissions={['reports.view']}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
            <p className="text-muted-foreground">
              Factory-wise analytics, shipment tracking, sample approvals & delay monitoring
            </p>
          </div>
          <Button onClick={handleExport} disabled={exporting || loading} variant="outline">
            {exporting ? (
              <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Exporting...</>
            ) : (
              <><FileDown className="mr-2 h-4 w-4" /> Export CSV</>
            )}
          </Button>
        </div>

        {/* Global Filters */}
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="grid gap-4 md:grid-cols-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Factory</Label>
                <Select value={factoryId} onValueChange={(v) => setFactoryId(v)}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="All Factories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Factories</SelectItem>
                    {factories.map((f) => (
                      <SelectItem key={f.id} value={String(f.id)}>
                        {f.name}{f.company ? ` (${f.company})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Start Date</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">End Date</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="h-9"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Search</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="PO#, Style#, Factory..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-8 h-9"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* KPI Cards - hidden on the PO Reports tab which has its own KPI strip */}
        {activeTab !== 'purchase-orders' && (
          loading && !factoryWiseData && !pendingShipmentsData && !pendingSamplesData && !approvedSamplesData && !delayData ? (
            <StatCardsSkeleton count={5} />
          ) : (
            renderKPICards()
          )
        )}

        {/* Report Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v)} className="space-y-4">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="purchase-orders" className="text-xs sm:text-sm">
              <Package className="mr-1.5 h-4 w-4 hidden sm:inline" />
              Purchase Orders
            </TabsTrigger>
            <TabsTrigger value="factory-wise" className="text-xs sm:text-sm">
              <Factory className="mr-1.5 h-4 w-4 hidden sm:inline" />
              Factory Wise
            </TabsTrigger>
            <TabsTrigger value="pending-shipments" className="text-xs sm:text-sm">
              <Truck className="mr-1.5 h-4 w-4 hidden sm:inline" />
              Pending Shipments
            </TabsTrigger>
            <TabsTrigger value="pending-samples" className="text-xs sm:text-sm">
              <ClipboardCheck className="mr-1.5 h-4 w-4 hidden sm:inline" />
              Pending Samples
            </TabsTrigger>
            <TabsTrigger value="approved-samples" className="text-xs sm:text-sm">
              <CheckCircle2 className="mr-1.5 h-4 w-4 hidden sm:inline" />
              Approved Samples
            </TabsTrigger>
            <TabsTrigger value="delays" className="text-xs sm:text-sm">
              <AlertTriangle className="mr-1.5 h-4 w-4 hidden sm:inline" />
              Delay Reports
            </TabsTrigger>
          </TabsList>

          <TabsContent value="purchase-orders" className="space-y-4">
            <POReportKPICards
              summary={poReportData?.summary ?? null}
              activeFilter={poReportKpiFilter}
              onFilterClick={(k) => {
                setPoReportKpiFilter(k);
                setPoReportPage(1);
              }}
            />
            <POReportFilterBar
              filters={poReportFilters}
              onFiltersChange={(next) => {
                setPoReportFilters(next);
                setPoReportPage(1);
              }}
              lookups={poReportLookups}
              groupBy={poReportGroupBy}
              onGroupByChange={setPoReportGroupBy}
            />
            {/* Bulk-action bar for selected POs */}
            {poReportSelectedIds.size > 0 && (
              <div className="flex items-center gap-3 rounded-lg border bg-muted/50 p-3 animate-in slide-in-from-top-2">
                <span className="text-sm font-medium">
                  {poReportSelectedIds.size} PO{poReportSelectedIds.size > 1 ? 's' : ''} selected
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7"
                  onClick={() => {
                    const selected = (poReportData?.orders ?? []).filter((o) => poReportSelectedIds.has(o.id));
                    const csv = [
                      ['PO Number', 'Status', 'PO Date', 'ETD', 'Retailer', 'Buyer', 'Agency', 'Quantity', 'Value', 'Currency'].join(','),
                      ...selected.map((o) =>
                        [
                          o.po_number,
                          o.status,
                          o.po_date ?? '',
                          o.etd_date ?? '',
                          o.retailer_name ?? '',
                          o.buyer_name ?? '',
                          o.agency_name ?? '',
                          o.total_quantity,
                          o.total_value,
                          o.currency_code ?? '',
                        ]
                          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
                          .join(','),
                      ),
                    ].join('\n');
                    const blob = new Blob([csv], { type: 'text/csv' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `purchase_orders_selected_${selected.length}.csv`;
                    a.click();
                    URL.revokeObjectURL(url);
                    toast.success(`Exported ${selected.length} POs.`);
                  }}
                >
                  <FileDown className="mr-1 h-3.5 w-3.5" />
                  Export Selected
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 ml-auto"
                  onClick={() => setPoReportSelectedIds(new Set())}
                >
                  Clear
                </Button>
              </div>
            )}

            {loading && !poReportData ? (
              <TableSkeleton columns={10} rows={8} />
            ) : (
              <POReportTableView
                items={poReportData?.orders ?? []}
                groupBy={poReportGroupBy}
                selectedIds={poReportSelectedIds}
                onToggleSelect={togglePoReportSelect}
                onToggleSelectAll={togglePoReportSelectAll}
                onOpenDetail={setPoReportDetailItem}
                selectedDetailId={poReportDetailItem?.id ?? null}
                sortBy={poReportSortBy}
                sortDir={poReportSortDir}
                onSort={togglePoReportSort}
              />
            )}

            {/* Pagination for the PO report */}
            {poReportData?.pagination && poReportData.pagination.last_page > 1 && (
              <div className="flex items-center justify-between pt-2">
                <p className="text-sm text-muted-foreground">
                  Showing page {poReportData.pagination.current_page} of {poReportData.pagination.last_page}
                  {' · '}
                  {poReportData.pagination.total.toLocaleString()} POs total
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={poReportPage <= 1}
                    onClick={() => setPoReportPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm font-medium">
                    {poReportPage} / {poReportData.pagination.last_page}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={poReportPage >= poReportData.pagination.last_page}
                    onClick={() => setPoReportPage((p) => p + 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          {loading ? (
            <TableSkeleton columns={8} rows={8} />
          ) : (
            <>
              <TabsContent value="factory-wise">
                <FactoryWiseTab />
              </TabsContent>
              <TabsContent value="pending-shipments">
                <PendingShipmentsTab />
              </TabsContent>
              <TabsContent value="pending-samples">
                <PendingSamplesTab />
              </TabsContent>
              <TabsContent value="approved-samples">
                <ApprovedSamplesTab />
              </TabsContent>
              <TabsContent value="delays">
                <DelayReportsTab />
              </TabsContent>
            </>
          )}
        </Tabs>
      </div>

      {/* Slide-in detail panel for the selected PO */}
      {poReportDetailItem && (
        <POReportDetailPanel item={poReportDetailItem} onClose={() => setPoReportDetailItem(null)} />
      )}
    </DashboardLayout>
  );
}
