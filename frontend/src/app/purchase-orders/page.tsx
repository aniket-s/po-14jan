'use client';

import { useCallback, useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, FileDown, FileUp, Loader2, List, Sheet, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';
import api from '@/lib/api';
import { ListPageSkeleton } from '@/components/skeletons';
import { PurchaseOrder, PaginatedResponse } from '@/types';
import { PdfImportDialog } from '@/components/purchase-orders/PdfImportDialog';
import { ImportWizardDialog } from '@/components/imports/ImportWizardDialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronDown } from 'lucide-react';
import { PoListSpreadsheetView } from '@/components/spreadsheet/PoListSpreadsheetView';
import { CreateRetailerDialog } from '@/components/master-data/CreateRetailerDialog';
import { CreateSeasonDialog } from '@/components/master-data/CreateSeasonDialog';
import { CreateWarehouseDialog } from '@/components/master-data/CreateWarehouseDialog';
import { CreateCountryDialog } from '@/components/master-data/CreateCountryDialog';
import { CreateCurrencyDialog } from '@/components/master-data/CreateCurrencyDialog';
import { CreatePaymentTermDialog } from '@/components/master-data/CreatePaymentTermDialog';
import { DeletePOStylesDialog } from '@/components/purchase-orders/DeletePOStylesDialog';
import { CreateAgentDialog } from '@/components/master-data/CreateAgentDialog';
import { useAuth } from '@/contexts/AuthContext';

// New redesigned components
import { POKPICards } from '@/components/purchase-orders/POKPICards';
import { POFilterBar, POFilters, DEFAULT_PO_FILTERS } from '@/components/purchase-orders/POFilterBar';
import { POTableView } from '@/components/purchase-orders/POTableView';
import { POCreateWizard } from '@/components/purchase-orders/POCreateWizard';

export default function PurchaseOrdersPage() {
  const { can, hasRole } = useAuth();
  const router = useRouter();

  // Data
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const perPage = 15;

  // View mode
  const [viewMode, setViewMode] = useState<'list' | 'excel'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('po-view-mode') as 'list' | 'excel') || 'list';
    }
    return 'list';
  });

  // Filters
  const [filters, setFilters] = useState<POFilters>(DEFAULT_PO_FILTERS);
  const [kpiFilter, setKpiFilter] = useState<string>('');

  const handleFiltersChange = useCallback((next: POFilters) => {
    setFilters(next);
    setCurrentPage(1);
  }, []);

  // Dialogs
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isSelectPODialogOpen, setIsSelectPODialogOpen] = useState(false);
  const [isPdfImportDialogOpen, setIsPdfImportDialogOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardInitialStrategy, setWizardInitialStrategy] = useState<string | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteStylesDialogOpen, setDeleteStylesDialogOpen] = useState(false);
  const [deletePOTarget, setDeletePOTarget] = useState<{ id: number; po_number: string } | null>(null);
  const [isDeleteLoading, setIsDeleteLoading] = useState(false);

  // Master data create dialogs
  const [isCreateRetailerDialogOpen, setIsCreateRetailerDialogOpen] = useState(false);
  const [isCreateSeasonDialogOpen, setIsCreateSeasonDialogOpen] = useState(false);
  const [isCreateWarehouseDialogOpen, setIsCreateWarehouseDialogOpen] = useState(false);
  const [isCreateCountryDialogOpen, setIsCreateCountryDialogOpen] = useState(false);
  const [isCreateCurrencyDialogOpen, setIsCreateCurrencyDialogOpen] = useState(false);
  const [isCreatePaymentTermDialogOpen, setIsCreatePaymentTermDialogOpen] = useState(false);
  const [isCreateAgentDialogOpen, setIsCreateAgentDialogOpen] = useState(false);

  // Master data
  const [currencies, setCurrencies] = useState<any[]>([]);
  const [paymentTerms, setPaymentTerms] = useState<any[]>([]);
  const [seasons, setSeasons] = useState<any[]>([]);
  const [retailers, setRetailers] = useState<any[]>([]);
  const [countries, setCountries] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [buyers, setBuyers] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [importers, setImporters] = useState<any[]>([]);
  const [factories, setFactories] = useState<any[]>([]);

  // Fetch data
  useEffect(() => {
    fetchMasterData();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchPurchaseOrders();
    }, filters.search ? 300 : 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    currentPage,
    filters.search,
    filters.status,
    filters.shippingTerm,
    filters.season,
    filters.dateRange,
    filters.retailer,
    filters.importer,
    filters.agency,
    filters.buyer,
    filters.country,
    filters.warehouse,
    filters.factory,
    filters.etdFrom,
    filters.etdTo,
    filters.exFactoryFrom,
    filters.exFactoryTo,
    filters.valueMin,
    filters.valueMax,
    filters.quantityMin,
    filters.quantityMax,
    filters.revisedOnly,
    filters.overdueEtd,
  ]);

  const fetchMasterData = async () => {
    try {
      const [seasonsRes, retailersRes, countriesRes, warehousesRes, currenciesRes, paymentTermsRes, buyersRes, agentsRes, importersRes, factoriesRes] = await Promise.all([
        api.get('/master-data/seasons?all=true'),
        api.get('/master-data/retailers?all=true'),
        api.get('/master-data/countries?all=true'),
        api.get('/master-data/warehouses?all=true'),
        api.get('/master-data/currencies?all=true'),
        api.get('/master-data/payment-terms?all=true'),
        api.get('/master-data/buyers?all=true'),
        api.get('/master-data/agents?all=true'),
        api.get('/importers'),
        api.get('/factories'),
      ]);
      setSeasons(seasonsRes.data || []);
      setRetailers(retailersRes.data || []);
      setCountries(countriesRes.data || []);
      setWarehouses(warehousesRes.data || []);
      setCurrencies(currenciesRes.data || []);
      setPaymentTerms(paymentTermsRes.data || []);
      setBuyers(buyersRes.data || []);
      setAgents(agentsRes.data || []);
      setImporters(importersRes.data || []);
      setFactories(factoriesRes.data || []);
    } catch (error) {
      console.error('Failed to fetch master data:', error);
    }
  };

  const fetchPurchaseOrders = async () => {
    try {
      setLoading(true);
      const params: any = { page: currentPage, per_page: perPage };
      if (filters.search) params.search = filters.search;
      if (filters.status !== 'all') params.status = filters.status;
      if (filters.shippingTerm !== 'all') params.shipping_term = filters.shippingTerm;
      if (filters.season !== 'all') params.season_id = filters.season;
      if (filters.retailer !== 'all') params.retailer_id = filters.retailer;
      if (filters.importer !== 'all') params.importer_id = filters.importer;
      if (filters.agency !== 'all') {
        params.agency_id = filters.agency === 'unassigned' ? 'null' : filters.agency;
      }
      if (filters.buyer !== 'all') params.buyer_id = filters.buyer;
      if (filters.country !== 'all') params.country_id = filters.country;
      if (filters.warehouse !== 'all') params.warehouse_id = filters.warehouse;
      if (filters.factory !== 'all') params.factory_id = filters.factory;

      // PO Date preset → date_from/date_to (backend already supports these)
      if (filters.dateRange !== 'all') {
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        let startDate: Date;
        switch (filters.dateRange) {
          case 'today':
            startDate = startOfDay;
            break;
          case 'week':
            startDate = new Date(startOfDay);
            startDate.setDate(startDate.getDate() - startOfDay.getDay());
            break;
          case 'month':
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            break;
          case 'quarter':
            startDate = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
            break;
          default:
            startDate = new Date(0);
        }
        params.date_from = startDate.toISOString().split('T')[0];
      }

      if (filters.etdFrom) params.etd_date_from = filters.etdFrom;
      if (filters.etdTo) params.etd_date_to = filters.etdTo;
      if (filters.exFactoryFrom) params.ex_factory_date_from = filters.exFactoryFrom;
      if (filters.exFactoryTo) params.ex_factory_date_to = filters.exFactoryTo;
      if (filters.valueMin) params.total_value_min = filters.valueMin;
      if (filters.valueMax) params.total_value_max = filters.valueMax;
      if (filters.quantityMin) params.total_quantity_min = filters.quantityMin;
      if (filters.quantityMax) params.total_quantity_max = filters.quantityMax;
      if (filters.revisedOnly) params.revised = 1;
      if (filters.overdueEtd) params.overdue_etd = 1;

      const response = await api.get<PaginatedResponse<PurchaseOrder>>('/purchase-orders', { params });
      setPurchaseOrders(response.data.data || []);
      setTotalPages(response.data.last_page || 1);
      setTotalCount(response.data.total || response.data.data?.length || 0);
    } catch (error) {
      console.error('Failed to fetch purchase orders:', error);
      setPurchaseOrders([]);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  };

  // Local KPI filter only — all other filters are applied server-side
  const filteredPOs = useMemo(() => {
    let result = purchaseOrders;

    if (kpiFilter === 'upcoming_etd') {
      const now = new Date();
      const thirtyDays = new Date();
      thirtyDays.setDate(thirtyDays.getDate() + 30);
      result = result.filter(po => {
        if (!po.etd_date) return false;
        const etd = new Date(po.etd_date);
        return etd >= now && etd <= thirtyDays;
      });
    }

    return result;
  }, [purchaseOrders, kpiFilter]);

  // Delete
  const handleDelete = (id: number) => {
    const po = purchaseOrders.find((p) => p.id === id);
    setDeletePOTarget({ id, po_number: po?.po_number || `#${id}` });
    setDeleteConfirmOpen(true);
  };

  const confirmDeletePO = async () => {
    if (!deletePOTarget) return;
    setIsDeleteLoading(true);
    try {
      await api.delete(`/purchase-orders/${deletePOTarget.id}`);
      setDeleteConfirmOpen(false);
      setDeletePOTarget(null);
      fetchPurchaseOrders();
    } catch (error: any) {
      const stylesCount = error.response?.data?.styles_count;
      if (stylesCount && stylesCount > 0) {
        setDeleteConfirmOpen(false);
        setDeleteStylesDialogOpen(true);
      } else {
        console.error('Failed to delete purchase order:', error);
      }
    } finally {
      setIsDeleteLoading(false);
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    const rows = filteredPOs.length > 0 ? filteredPOs : purchaseOrders;
    if (rows.length === 0) return;

    const headers = ['PO Number', 'Headline', 'Status', 'PO Date', 'Shipping Term', 'ETD', 'Styles', 'Total Quantity', 'Total Value', 'Currency'];
    const csvRows = rows.map(po => [
      po.po_number,
      po.headline || '',
      po.status || 'draft',
      po.po_date,
      po.shipping_term || '',
      po.etd_date || '',
      po.styles_count || 0,
      po.total_quantity || 0,
      parseFloat(String(po.total_value)) || 0,
      po.currency || 'USD',
    ]);

    const csvContent = [headers, ...csvRows]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `purchase-orders-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const openCreateDialog = (type: 'retailer' | 'season' | 'warehouse' | 'country' | 'currency' | 'paymentTerm' | 'agent') => {
    switch (type) {
      case 'retailer': setIsCreateRetailerDialogOpen(true); break;
      case 'season': setIsCreateSeasonDialogOpen(true); break;
      case 'warehouse': setIsCreateWarehouseDialogOpen(true); break;
      case 'country': setIsCreateCountryDialogOpen(true); break;
      case 'currency': setIsCreateCurrencyDialogOpen(true); break;
      case 'paymentTerm': setIsCreatePaymentTermDialogOpen(true); break;
      case 'agent': setIsCreateAgentDialogOpen(true); break;
    }
  };

  // Pagination helpers
  const startItem = (currentPage - 1) * perPage + 1;
  const endItem = Math.min(currentPage * perPage, totalCount);

  const getPageNumbers = () => {
    const pages: (number | '...')[] = [];
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push('...');
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (currentPage < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  };

  // Excel view — full screen
  if (viewMode === 'excel') {
    return (
      <div className="h-screen w-screen overflow-hidden">
        <PoListSpreadsheetView
          searchTerm={filters.search}
          onBack={() => {
            setViewMode('list');
            localStorage.setItem('po-view-mode', 'list');
          }}
        />
      </div>
    );
  }

  return (
    <DashboardLayout requiredPermissions={['po.view', 'po.view_all', 'po.view_own', 'po.create', 'po.edit', 'po.export']} requireAll={false}>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Purchase Orders</h1>
            <p className="text-sm text-muted-foreground">Manage and track all purchase orders</p>
          </div>
          <div className="flex items-center gap-2">
            {/* View Toggle */}
            <div className="flex items-center rounded-lg border bg-muted p-0.5">
              <Button
                variant="default"
                size="sm"
                className="h-7 px-2.5 text-xs"
              >
                <List className="h-3.5 w-3.5 mr-1" />
                List
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2.5 text-xs"
                onClick={() => {
                  setViewMode('excel');
                  localStorage.setItem('po-view-mode', 'excel');
                }}
              >
                <Sheet className="h-3.5 w-3.5 mr-1" />
                Excel
              </Button>
            </div>

            {can('po.export') && (
              <Button variant="outline" size="sm" className="h-8" onClick={handleExportCSV}>
                <FileDown className="mr-1.5 h-3.5 w-3.5" />
                Export
              </Button>
            )}
            {can('po.import') && (
              <Button variant="outline" size="sm" className="h-8" onClick={() => setIsSelectPODialogOpen(true)}>
                <FileUp className="mr-1.5 h-3.5 w-3.5" />
                Import Styles
              </Button>
            )}
            {can('po.create') && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8">
                    <FileUp className="mr-1.5 h-3.5 w-3.5" />
                    Import
                    <ChevronDown className="ml-1 h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <DropdownMenuLabel>Buyer-specific imports</DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => { setWizardInitialStrategy('sci.pdf.po'); setWizardOpen(true); }}>
                    SCI — PDF PO
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => { setWizardInitialStrategy('sci.excel.buy_sheet'); setWizardOpen(true); }}>
                    SCI — Excel Buy Sheet
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => { setWizardInitialStrategy('massive.excel.ddp.po'); setWizardOpen(true); }}>
                    Massive — DDP Excel PO
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => { setWizardInitialStrategy('massive.excel.fob.po'); setWizardOpen(true); }}>
                    Massive — FOB Excel PO
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => { setWizardInitialStrategy('rebel_minds.pdf.po'); setWizardOpen(true); }}>
                    Rebel Minds — PDF PO
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => { setWizardInitialStrategy(null); setWizardOpen(true); }}>
                    Choose import type…
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setIsPdfImportDialogOpen(true)}>
                    Legacy PDF import
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {can('po.create') && (
              <Button size="sm" className="h-8" onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                New PO
              </Button>
            )}
          </div>
        </div>

        {/* KPI Cards */}
        <POKPICards
          purchaseOrders={purchaseOrders}
          totalFromServer={totalCount}
          activeFilter={kpiFilter}
          onFilterClick={setKpiFilter}
        />

        {/* Filter Bar */}
        <POFilterBar
          filters={filters}
          onFiltersChange={handleFiltersChange}
          seasons={seasons}
          retailers={retailers}
          importers={importers}
          agencies={agents}
          buyers={buyers}
          countries={countries}
          warehouses={warehouses}
          factories={factories}
        />

        {/* Table */}
        {loading && purchaseOrders.length === 0 ? (
          <ListPageSkeleton statCards={0} filterCount={0} columns={10} rows={8} />
        ) : (
          <POTableView
            purchaseOrders={filteredPOs}
            onDelete={handleDelete}
            onBulkDelete={async (ids) => {
              const failures: string[] = [];
              for (const id of ids) {
                try {
                  await api.delete(`/purchase-orders/${id}`);
                } catch (e: any) {
                  const po = purchaseOrders.find(p => p.id === id);
                  failures.push(`${po?.po_number || id}: ${e.response?.data?.message || 'Failed'}`);
                }
              }
              fetchPurchaseOrders();
              if (failures.length > 0) {
                alert(`Some POs could not be deleted:\n${failures.join('\n')}`);
              }
            }}
            onExport={(pos) => {
              const headers = ['PO Number', 'Headline', 'Status', 'PO Date', 'Shipping Term', 'ETD', 'Styles', 'Total Quantity', 'Total Value', 'Currency'];
              const csvRows = pos.map(po => [
                po.po_number, po.headline || '', po.status || 'draft', po.po_date,
                po.shipping_term || '', po.etd_date || '', po.styles_count || 0,
                po.total_quantity || 0, parseFloat(String(po.total_value)) || 0, po.currency || 'USD',
              ]);
              const csv = [headers, ...csvRows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
              const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `purchase-orders-selected-${new Date().toISOString().split('T')[0]}.csv`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            onStatusChange={async (poId, newStatus) => {
              try {
                await api.post(`/purchase-orders/${poId}/status`, { status: newStatus });
                fetchPurchaseOrders();
              } catch (e: any) {
                alert(e.response?.data?.message || 'Failed to update status');
              }
            }}
            onBulkStatusChange={async (poIds, newStatus) => {
              const failures: string[] = [];
              for (const id of poIds) {
                try {
                  await api.post(`/purchase-orders/${id}/status`, { status: newStatus });
                } catch (e: any) {
                  const po = purchaseOrders.find(p => p.id === id);
                  failures.push(`${po?.po_number || id}: ${e.response?.data?.message || 'Failed'}`);
                }
              }
              fetchPurchaseOrders();
              if (failures.length > 0) {
                alert(`Some POs could not be updated:\n${failures.join('\n')}`);
              }
            }}
            canEdit={can('po.edit')}
            canDelete={can('po.delete')}
            canExport={can('po.export')}
          />
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Showing {startItem}-{endItem} of {totalCount} purchase orders
            </p>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              {getPageNumbers().map((page, idx) =>
                page === '...' ? (
                  <span key={`dots-${idx}`} className="px-1 text-muted-foreground text-sm">...</span>
                ) : (
                  <Button
                    key={page}
                    variant={currentPage === page ? 'default' : 'outline'}
                    size="sm"
                    className="h-8 w-8 p-0 text-xs"
                    onClick={() => setCurrentPage(page as number)}
                  >
                    {page}
                  </Button>
                )
              )}
              <Button
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Create PO Wizard */}
        <POCreateWizard
          open={isCreateDialogOpen}
          onOpenChange={setIsCreateDialogOpen}
          masterData={{ currencies, paymentTerms, seasons, retailers, countries, warehouses, buyers, agents, importers }}
          onSuccess={fetchPurchaseOrders}
          onOpenCreateDialog={openCreateDialog}
        />

        {/* Select PO for Import Dialog */}
        <Dialog open={isSelectPODialogOpen} onOpenChange={setIsSelectPODialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Select Purchase Order for Import</DialogTitle>
              <DialogDescription>Choose a PO to import styles into from Excel</DialogDescription>
            </DialogHeader>
            <div className="max-h-[400px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>PO Number</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {purchaseOrders.map((po) => (
                    <TableRow key={po.id}>
                      <TableCell className="font-medium">{po.po_number}</TableCell>
                      <TableCell><Badge variant="outline">{po.status}</Badge></TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          onClick={() => {
                            setIsSelectPODialogOpen(false);
                            router.push(`/purchase-orders/${po.id}/import`);
                          }}
                        >
                          <FileUp className="mr-2 h-4 w-4" />
                          Import
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsSelectPODialogOpen(false)}>Cancel</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* PDF Import Dialog (legacy) */}
        <PdfImportDialog
          isOpen={isPdfImportDialogOpen}
          onClose={() => setIsPdfImportDialogOpen(false)}
          onImportComplete={() => {
            fetchPurchaseOrders();
            setIsPdfImportDialogOpen(false);
          }}
          masterData={{ currencies, paymentTerms, seasons, retailers, countries, warehouses, buyers, agents }}
          onRefreshMasterData={fetchMasterData}
        />

        {/* Unified Import Wizard (strategy-based) */}
        <ImportWizardDialog
          isOpen={wizardOpen}
          onClose={() => setWizardOpen(false)}
          buyers={buyers}
          onRefreshBuyers={fetchMasterData}
          onImportComplete={fetchPurchaseOrders}
          initialStrategyKey={wizardInitialStrategy}
          masterData={{ currencies, paymentTerms, seasons, retailers, countries, warehouses, buyers, agents }}
          onRefreshMasterData={fetchMasterData}
        />

        {/* Master Data Create Dialogs */}
        <CreateRetailerDialog open={isCreateRetailerDialogOpen} onOpenChange={setIsCreateRetailerDialogOpen} onSuccess={fetchMasterData} />
        <CreateSeasonDialog open={isCreateSeasonDialogOpen} onOpenChange={setIsCreateSeasonDialogOpen} onSuccess={fetchMasterData} />
        <CreateWarehouseDialog open={isCreateWarehouseDialogOpen} onOpenChange={setIsCreateWarehouseDialogOpen} onSuccess={fetchMasterData} />
        <CreateCountryDialog open={isCreateCountryDialogOpen} onOpenChange={setIsCreateCountryDialogOpen} onSuccess={fetchMasterData} />
        <CreateCurrencyDialog open={isCreateCurrencyDialogOpen} onOpenChange={setIsCreateCurrencyDialogOpen} onSuccess={fetchMasterData} />
        <CreatePaymentTermDialog open={isCreatePaymentTermDialogOpen} onOpenChange={setIsCreatePaymentTermDialogOpen} onSuccess={fetchMasterData} />
        <CreateAgentDialog open={isCreateAgentDialogOpen} onOpenChange={setIsCreateAgentDialogOpen} onSuccess={fetchMasterData} />

        {/* Delete PO Confirmation */}
        <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                Delete Purchase Order?
              </AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete purchase order <strong>{deletePOTarget?.po_number}</strong>? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleteLoading}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => { e.preventDefault(); confirmDeletePO(); }}
                disabled={isDeleteLoading}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isDeleteLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Deleting...</> : 'Delete'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Delete PO Styles Dialog */}
        <DeletePOStylesDialog
          open={deleteStylesDialogOpen}
          onOpenChange={setDeleteStylesDialogOpen}
          poId={deletePOTarget?.id ?? null}
          poNumber={deletePOTarget?.po_number ?? ''}
          onSuccess={fetchPurchaseOrders}
        />
      </div>
    </DashboardLayout>
  );
}
