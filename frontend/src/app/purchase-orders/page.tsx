'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
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
import { Label } from '@/components/ui/label';
import { Plus, Search, Eye, Edit, Trash2, FileDown, FileUp, FileText, Loader2, List, Sheet } from 'lucide-react';
import api from '@/lib/api';
import { PurchaseOrder, PaginatedResponse } from '@/types';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { PdfImportDialog } from '@/components/purchase-orders/PdfImportDialog';
import { PoListSpreadsheetView } from '@/components/spreadsheet/PoListSpreadsheetView';
import { CreateRetailerDialog } from '@/components/master-data/CreateRetailerDialog';
import { CreateSeasonDialog } from '@/components/master-data/CreateSeasonDialog';
import { CreateWarehouseDialog } from '@/components/master-data/CreateWarehouseDialog';
import { CreateCountryDialog } from '@/components/master-data/CreateCountryDialog';
import { CreateCurrencyDialog } from '@/components/master-data/CreateCurrencyDialog';
import { CreatePaymentTermDialog } from '@/components/master-data/CreatePaymentTermDialog';
import { CreateAgentDialog } from '@/components/master-data/CreateAgentDialog';
import { useAuth } from '@/contexts/AuthContext';

const poSchema = z.object({
  po_number: z.string().min(1, 'PO number is required'),
  headline: z.string().optional(),
  retailer_id: z.string().min(1, 'Retailer is required'),
  po_date: z.string().min(1, 'PO date is required'),
  currency_id: z.string().min(1, 'Currency is required'),
  shipping_method: z.string().optional(),
  notes: z.string().optional(),
  agency_id: z.string().optional(),
  buyer_id: z.string().optional(),
  season_id: z.string().optional(),
  warehouse_id: z.string().optional(),
  country_id: z.string().optional(),
  shipping_term: z.enum(['FOB', 'DDP']).optional(),
  payment_terms_structured: z.object({
    term: z.string(),
    percentage: z.number().min(0, 'Percentage must be at least 0').max(100, 'Percentage cannot exceed 100').optional(),
  }).optional(),
  packing_method: z.string().optional(),
  other_terms: z.string().optional(),
  revision_date: z.string().optional(),
  ex_factory_date: z.string().optional(),
  etd_date: z.string().optional(),
  eta_date: z.string().optional(),
  in_warehouse_date: z.string().optional(),
  ship_to: z.string().optional(),
  ship_to_address: z.string().optional(),
  sample_schedule: z.object({
    lab_dip_submission: z.string().optional(),
    fit_sample_submission: z.string().optional(),
    trim_approvals: z.string().optional(),
    first_proto_submission: z.string().optional(),
    bulk_fabric_inhouse: z.string().optional(),
    pp_sample_submission: z.string().optional(),
    production_start: z.string().optional(),
    top_approval: z.string().optional(),
  }).optional(),
  packing_guidelines: z.string().optional(),
});

type POFormData = z.infer<typeof poSchema>;

export default function PurchaseOrdersPage() {
  const { can } = useAuth();
  const router = useRouter();
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSelectPODialogOpen, setIsSelectPODialogOpen] = useState(false);
  const [isPdfImportDialogOpen, setIsPdfImportDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'excel'>('list');
  const [viewModeReady, setViewModeReady] = useState(false);
  const [isCreateRetailerDialogOpen, setIsCreateRetailerDialogOpen] = useState(false);
  const [isCreateSeasonDialogOpen, setIsCreateSeasonDialogOpen] = useState(false);
  const [isCreateWarehouseDialogOpen, setIsCreateWarehouseDialogOpen] = useState(false);
  const [isCreateCountryDialogOpen, setIsCreateCountryDialogOpen] = useState(false);
  const [isCreateCurrencyDialogOpen, setIsCreateCurrencyDialogOpen] = useState(false);
  const [isCreatePaymentTermDialogOpen, setIsCreatePaymentTermDialogOpen] = useState(false);
  const [isCreateAgentDialogOpen, setIsCreateAgentDialogOpen] = useState(false);

  const [currencies, setCurrencies] = useState<any[]>([]);
  const [paymentTerms, setPaymentTerms] = useState<any[]>([]);
  const [seasons, setSeasons] = useState<any[]>([]);
  const [retailers, setRetailers] = useState<any[]>([]);
  const [countries, setCountries] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [buyers, setBuyers] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);

  const [autoGeneratePO, setAutoGeneratePO] = useState(true);
  const [isGeneratingPO, setIsGeneratingPO] = useState(false);

  // Payment terms state
  const [paymentTerm, setPaymentTerm] = useState<string>('');
  const [paymentPercentage, setPaymentPercentage] = useState<string>('');

  // Shipping term state (FOB/DDP)
  const [shippingTerm, setShippingTerm] = useState<'FOB' | 'DDP'>('FOB');
  // Selected country ID for DDP date calculations
  const [selectedCountryId, setSelectedCountryId] = useState<string>('');

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
  } = useForm<POFormData>({
    resolver: zodResolver(poSchema),
  });

  // Restore view mode from localStorage after hydration
  useEffect(() => {
    const saved = localStorage.getItem('po-view-mode') as 'list' | 'excel' | null;
    if (saved === 'list' || saved === 'excel') {
      setViewMode(saved);
    }
    setViewModeReady(true);
  }, []);

  useEffect(() => {
    fetchPurchaseOrders();
  }, [currentPage, searchTerm]);

  // Fetch master data on mount
  useEffect(() => {
    fetchMasterData();
  }, []);

  // Set default PO date to today when create dialog opens
  useEffect(() => {
    if (isCreateDialogOpen) {
      const today = new Date().toISOString().split('T')[0];
      setValue('po_date', today);
      // Reset payment terms state
      setPaymentTerm('');
      setPaymentPercentage('');
      // Auto-generate PO number if auto-generate is enabled
      if (autoGeneratePO) {
        generatePONumber();
      }
    }
  }, [isCreateDialogOpen, setValue]);

  const fetchMasterData = async () => {
    try {
      const [seasonsRes, retailersRes, countriesRes, warehousesRes, currenciesRes, paymentTermsRes, buyersRes, agentsRes] = await Promise.all([
        api.get('/master-data/seasons?all=true'),
        api.get('/master-data/retailers?all=true'),
        api.get('/master-data/countries?all=true'),
        api.get('/master-data/warehouses?all=true'),
        api.get('/master-data/currencies?all=true'),
        api.get('/master-data/payment-terms?all=true'),
        api.get('/master-data/buyers?all=true'),
        api.get('/master-data/agents?all=true'),
      ]);

      setSeasons(seasonsRes.data || []);
      setRetailers(retailersRes.data || []);
      setCountries(countriesRes.data || []);
      setWarehouses(warehousesRes.data || []);
      setCurrencies(currenciesRes.data || []);
      setPaymentTerms(paymentTermsRes.data || []);
      setBuyers(buyersRes.data || []);
      setAgents(agentsRes.data || []);
    } catch (error) {
      console.error('Failed to fetch master data:', error);
    }
  };

  const fetchPurchaseOrders = async () => {
    try {
      setLoading(true);
      const params: {
        page: number;
        per_page: number;
        search?: string;
      } = {
        page: currentPage,
        per_page: 10,
      };

      if (searchTerm) {
        params.search = searchTerm;
      }

      const response = await api.get<PaginatedResponse<PurchaseOrder>>('/purchase-orders', {
        params,
      });

      setPurchaseOrders(response.data.data || []);
      setTotalPages(response.data.last_page || 1);
    } catch (error) {
      console.error('Failed to fetch purchase orders:', error);
      setPurchaseOrders([]);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  };

  // Auto-generate PO number
  const generatePONumber = async () => {
    if (!autoGeneratePO) return;

    setIsGeneratingPO(true);
    try {
      const response = await api.get('/purchase-orders/generate-po-number');
      if (response.data?.po_number) {
        setValue('po_number', response.data.po_number);
      }
    } catch (error) {
      console.error('Failed to generate PO number:', error);
    } finally {
      setIsGeneratingPO(false);
    }
  };

  // Auto-generate sample schedule
  const generateSampleSchedule = async (poDate: string, etdDate: string) => {
    if (!poDate || !etdDate) {
      alert('Please enter PO Date and ETD Date first');
      return;
    }

    try {
      const response = await api.post('/purchase-orders/sample-schedule', {
        po_date: poDate,
        etd_date: etdDate,
      });

      if (response.data?.schedule) {
        const schedule = response.data.schedule;
        // Helper to extract date in YYYY-MM-DD format
        const formatDate = (dateString: string) => dateString ? dateString.split('T')[0] : '';

        setValue('sample_schedule', {
          lab_dip_submission: formatDate(schedule.lab_dip?.date || ''),
          fit_sample_submission: formatDate(schedule.fit_samples?.date || ''),
          trim_approvals: formatDate(schedule.trim_approvals?.date || ''),
          first_proto_submission: formatDate(schedule.first_proto_samples?.date || ''),
          bulk_fabric_inhouse: formatDate(schedule.bulk_fabric_inhouse?.date || ''),
          pp_sample_submission: formatDate(schedule.pp_sample?.date || ''),
          production_start: formatDate(schedule.production_start?.date || ''),
          top_approval: formatDate(schedule.top_approval?.date || ''),
        });
      }
    } catch (error) {
      console.error('Failed to generate sample schedule:', error);
      alert('Failed to generate sample schedule');
    }
  };

  const onSubmit = async (data: POFormData) => {
    setIsSubmitting(true);
    try {
      const requestData = {
        po_number: data.po_number,
        headline: data.headline || null,
        retailer_id: data.retailer_id ? parseInt(data.retailer_id) : null,
        agency_id: data.agency_id ? parseInt(data.agency_id) : null,
        buyer_id: data.buyer_id ? parseInt(data.buyer_id) : null,
        po_date: data.po_date,
        currency_id: data.currency_id ? parseInt(data.currency_id) : null,
        shipping_method: data.shipping_method,
        notes: data.notes,
        season_id: data.season_id ? parseInt(data.season_id) : null,
        warehouse_id: data.warehouse_id ? parseInt(data.warehouse_id) : null,
        country_id: data.country_id ? parseInt(data.country_id) : null,
        shipping_term: shippingTerm || null,
        payment_terms_structured: data.payment_terms_structured || null,
        packing_method: data.packing_method || null,
        other_terms: data.other_terms || null,
        revision_date: data.revision_date,
        ex_factory_date: data.ex_factory_date,
        etd_date: data.etd_date,
        eta_date: data.eta_date,
        in_warehouse_date: data.in_warehouse_date,
        ship_to: data.ship_to,
        ship_to_address: data.ship_to_address,
        sample_schedule: data.sample_schedule || undefined,
        packing_guidelines: data.packing_guidelines,
      };

      await api.post('/purchase-orders', requestData);
      setIsCreateDialogOpen(false);
      reset();
      setAutoGeneratePO(true);
      setPaymentTerm('');
      setPaymentPercentage('');
      setSelectedCountryId('');
      setShippingTerm('FOB');
      fetchPurchaseOrders();
    } catch (error) {
      console.error('Failed to create purchase order:', error);
      alert('Failed to create purchase order. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this purchase order?')) {
      return;
    }

    try {
      await api.delete(`/purchase-orders/${id}`);
      fetchPurchaseOrders();
    } catch (error) {
      console.error('Failed to delete purchase order:', error);
    }
  };

  const formatCurrency = (value: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // Show loading spinner until viewMode is resolved from localStorage
  if (!viewModeReady) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-32 w-32 animate-spin rounded-full border-b-2 border-t-2 border-primary" />
      </div>
    );
  }

  // Full-screen Excel view — rendered outside DashboardLayout
  if (viewMode === 'excel') {
    return (
      <div className="h-screen w-screen overflow-hidden">
        <PoListSpreadsheetView
          searchTerm={searchTerm}
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
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Purchase Orders</h1>
            <p className="text-muted-foreground">Manage and track all purchase orders</p>
          </div>
          <div className="flex gap-2">
            {/* View mode toggle */}
            <div className="flex rounded-md border">
              <Button
                variant="default"
                size="sm"
                className="rounded-r-none h-8"
              >
                <List className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="rounded-l-none h-8"
                onClick={() => {
                  setViewMode('excel');
                  localStorage.setItem('po-view-mode', 'excel');
                }}
              >
                <Sheet className="h-4 w-4" />
              </Button>
            </div>
            {can('po.export') && (
              <Button variant="outline" size="sm">
                <FileDown className="mr-2 h-4 w-4" />
                Export
              </Button>
            )}
            {can('po.import') && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsSelectPODialogOpen(true)}
              >
                <FileUp className="mr-2 h-4 w-4" />
                Import Styles
              </Button>
            )}
            {can('po.create') && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsPdfImportDialogOpen(true)}
              >
                <FileText className="mr-2 h-4 w-4" />
                Import PDF
              </Button>
            )}
            {can('po.create') && (
              <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="mr-2 h-4 w-4" />
                    New PO
                  </Button>
                </DialogTrigger>
              <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <form onSubmit={handleSubmit(onSubmit)}>
                  <DialogHeader>
                    <DialogTitle>Create Purchase Order</DialogTitle>
                    <DialogDescription>
                      Create a new purchase order.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-6 py-4">
                    {/* Basic Information */}
                    <div className="space-y-4">
                      <h3 className="text-sm font-semibold">Basic Information</h3>
                      <div className="space-y-4">
                        {/* PO Number with Auto-Generation */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label htmlFor="po_number">PO Number *</Label>
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                id="auto_gen_po"
                                checked={autoGeneratePO}
                                onChange={(e) => {
                                  setAutoGeneratePO(e.target.checked);
                                  if (e.target.checked) {
                                    generatePONumber();
                                  }
                                }}
                                className="rounded"
                              />
                              <Label htmlFor="auto_gen_po" className="text-xs cursor-pointer">
                                Auto-generate
                              </Label>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Input
                              id="po_number"
                              placeholder="PO-2025-001"
                              {...register('po_number')}
                              disabled={autoGeneratePO}
                            />
                            {autoGeneratePO && (
                              <Button
                                type="button"
                                variant="outline"
                                onClick={generatePONumber}
                                disabled={isGeneratingPO}
                              >
                                {isGeneratingPO ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Generate'}
                              </Button>
                            )}
                          </div>
                          {errors.po_number && (
                            <p className="text-sm text-destructive">{errors.po_number.message}</p>
                          )}
                        </div>

                        {/* Headline */}
                        <div className="space-y-2">
                          <Label htmlFor="headline">PO Headline</Label>
                          <Input
                            id="headline"
                            placeholder="e.g., Spring 2025 Collection"
                            {...register('headline')}
                          />
                          {errors.headline && (
                            <p className="text-sm text-destructive">{errors.headline.message}</p>
                          )}
                        </div>

                        {/* Retailer Dropdown with Create Button */}
                        <div className="space-y-2">
                          <Label htmlFor="retailer_id">Retailer *</Label>
                          <div className="flex gap-2">
                            <Select onValueChange={(value) => setValue('retailer_id', value)}>
                              <SelectTrigger className="flex-1">
                                <SelectValue placeholder="Select retailer" />
                              </SelectTrigger>
                              <SelectContent>
                                {retailers.map((retailer) => (
                                  <SelectItem key={retailer.id} value={retailer.id.toString()}>
                                    {retailer.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => setIsCreateRetailerDialogOpen(true)}
                              title="Create new retailer"
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                          {errors.retailer_id && (
                            <p className="text-sm text-destructive">{errors.retailer_id.message}</p>
                          )}
                        </div>

                        {/* Agent Dropdown with Create Button */}
                        <div className="space-y-2">
                          <Label htmlFor="agency_id">Agent</Label>
                          <div className="flex gap-2">
                            <Select onValueChange={(value) => setValue('agency_id', value)}>
                              <SelectTrigger className="flex-1">
                                <SelectValue placeholder="Select agent" />
                              </SelectTrigger>
                              <SelectContent>
                                {agents.map((agent) => (
                                  <SelectItem key={agent.id} value={agent.id.toString()}>
                                    {agent.name}{agent.company ? ` (${agent.company})` : ''}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => setIsCreateAgentDialogOpen(true)}
                              title="Create new agent"
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>

                        {/* Buyer Dropdown with Create Button */}
                        <div className="space-y-2">
                          <Label htmlFor="buyer_id">Buyer</Label>
                          <div className="flex gap-2">
                            <Select onValueChange={(value) => setValue('buyer_id', value)}>
                              <SelectTrigger className="flex-1">
                                <SelectValue placeholder="Select buyer" />
                              </SelectTrigger>
                              <SelectContent>
                                {buyers.map((buyer) => (
                                  <SelectItem key={buyer.id} value={buyer.id.toString()}>
                                    {buyer.name}{buyer.code ? ` (${buyer.code})` : ''}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => {}}
                              title="Create new buyer"
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="currency_id">Currency *</Label>
                        <div className="flex gap-2">
                          <Select onValueChange={(value) => setValue('currency_id', value)}>
                            <SelectTrigger className="flex-1">
                              <SelectValue placeholder="Select currency" />
                            </SelectTrigger>
                            <SelectContent>
                              {currencies.map((currency) => (
                                <SelectItem key={currency.id} value={currency.id.toString()}>
                                  {currency.code} - {currency.name} {currency.symbol && `(${currency.symbol})`}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setIsCreateCurrencyDialogOpen(true)}
                            title="Create new currency"
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                        {errors.currency_id && (
                          <p className="text-sm text-destructive">{errors.currency_id.message}</p>
                        )}
                      </div>
                    </div>

                    {/* Master Data */}
                    <div className="space-y-4">
                      <h3 className="text-sm font-semibold">Master Data</h3>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="season_id">Production Season</Label>
                          <div className="flex gap-2">
                            <Select onValueChange={(value) => setValue('season_id', value)}>
                              <SelectTrigger className="flex-1">
                                <SelectValue placeholder="Select season" />
                              </SelectTrigger>
                              <SelectContent>
                                {seasons.map((season) => (
                                  <SelectItem key={season.id} value={season.id.toString()}>
                                    {season.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => setIsCreateSeasonDialogOpen(true)}
                              title="Create new season"
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="warehouse_id">Ship To Warehouse</Label>
                          <div className="flex gap-2">
                            <Select onValueChange={(value) => setValue('warehouse_id', value)}>
                              <SelectTrigger className="flex-1">
                                <SelectValue placeholder="Select warehouse" />
                              </SelectTrigger>
                              <SelectContent>
                                {warehouses.map((warehouse) => (
                                  <SelectItem key={warehouse.id} value={warehouse.id.toString()}>
                                    {warehouse.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => setIsCreateWarehouseDialogOpen(true)}
                              title="Create new warehouse"
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="country_id">Country of Origin *</Label>
                          <div className="flex gap-2">
                            <Select
                              value={selectedCountryId}
                              onValueChange={(value) => {
                                setValue('country_id', value);
                                setSelectedCountryId(value);
                                const country = countries.find(c => c.id.toString() === value);
                                const sailingDays = country?.sailing_time_days || 0;

                                // Re-calculate FOB dates if ETD is set
                                if (shippingTerm === 'FOB') {
                                  const etdInput = document.getElementById('etd_date') as HTMLInputElement;
                                  if (etdInput?.value) {
                                    const etdDate = etdInput.value;
                                    // ETA = ETD + sailing time
                                    const eta = new Date(etdDate);
                                    eta.setDate(eta.getDate() + sailingDays);
                                    setValue('eta_date', eta.toISOString().split('T')[0]);
                                    // IHD = ETA + 5 days
                                    const ihd = new Date(eta);
                                    ihd.setDate(ihd.getDate() + 5);
                                    setValue('in_warehouse_date', ihd.toISOString().split('T')[0]);
                                  }
                                }

                                // Re-calculate DDP dates if in-warehouse date is set
                                if (shippingTerm === 'DDP') {
                                  const inWarehouseInput = document.getElementById('in_warehouse_date') as HTMLInputElement;
                                  if (inWarehouseInput?.value) {
                                    const transitDays = sailingDays;
                                    const inWarehouseDate = inWarehouseInput.value;
                                    const etd = new Date(inWarehouseDate);
                                    etd.setDate(etd.getDate() - transitDays - 5);
                                    setValue('etd_date', etd.toISOString().split('T')[0]);
                                    const eta = new Date(etd);
                                    eta.setDate(eta.getDate() + transitDays);
                                    setValue('eta_date', eta.toISOString().split('T')[0]);
                                  }
                                }
                              }}
                            >
                              <SelectTrigger className="flex-1">
                                <SelectValue placeholder="Select country" />
                              </SelectTrigger>
                              <SelectContent>
                                {countries.map((country) => (
                                  <SelectItem key={country.id} value={country.id.toString()}>
                                    {country.name} ({country.sailing_time_days} days)
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => setIsCreateCountryDialogOpen(true)}
                              title="Create new country"
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                      {/* Payment Terms (Dynamic with + button) */}
                      <div className="space-y-2">
                        <Label>Payment Terms</Label>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="flex gap-2">
                            <Select
                              value={paymentTerm}
                              onValueChange={(value) => {
                                setPaymentTerm(value);
                                const selectedPT = paymentTerms.find(pt => pt.code === value);
                                const percentage = paymentPercentage ? parseFloat(paymentPercentage) : undefined;
                                setValue('payment_terms_structured', {
                                  term: value,
                                  percentage: selectedPT?.requires_percentage ? percentage : undefined
                                });
                              }}
                            >
                              <SelectTrigger className="flex-1">
                                <SelectValue placeholder="Select term" />
                              </SelectTrigger>
                              <SelectContent>
                                {paymentTerms.map((pt) => (
                                  <SelectItem key={pt.id} value={pt.code}>
                                    {pt.name}{pt.days ? ` (${pt.days} days)` : ''}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => setIsCreatePaymentTermDialogOpen(true)}
                              title="Create new payment term"
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                          {/* Percentage field - only show when selected payment term requires percentage */}
                          {paymentTerms.find(pt => pt.code === paymentTerm)?.requires_percentage && (
                            <div className="space-y-1">
                              <Input
                                type="number"
                                min="0"
                                max="100"
                                step="0.01"
                                placeholder="Percentage (0-100)"
                                value={paymentPercentage}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  setPaymentPercentage(value);
                                  const percentage = value ? parseFloat(value) : undefined;
                                  if (paymentTerm) {
                                    setValue('payment_terms_structured', {
                                      term: paymentTerm,
                                      percentage
                                    });
                                  }
                                }}
                              />
                              {errors.payment_terms_structured?.percentage && (
                                <p className="text-xs text-red-500">{errors.payment_terms_structured.percentage.message}</p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      {/* Shipping Term (FOB/DDP) */}
                      <div className="space-y-2">
                        <Label>Shipping Term *</Label>
                        <Select
                          value={shippingTerm}
                          onValueChange={(value: 'FOB' | 'DDP') => {
                            setShippingTerm(value);
                            setValue('shipping_term', value);
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select shipping term" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="FOB">FOB (Free On Board) - Show only ETD</SelectItem>
                            <SelectItem value="DDP">DDP (Delivered Duty Paid) - Show ETD, ETA, In-warehouse</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Dates */}
                    <div className="space-y-4">
                      <h3 className="text-sm font-semibold">Important Dates</h3>
                      <div className="space-y-2">
                        <Label htmlFor="po_date">PO Date *</Label>
                        <Input
                          id="po_date"
                          type="date"
                          {...register('po_date')}
                        />
                        {errors.po_date && (
                          <p className="text-sm text-destructive">{errors.po_date.message}</p>
                        )}
                      </div>

                      {/* FOB: User inputs ETD, auto-calculate Ex-Factory (ETD-7), ETA (ETD+sailing), IHD (ETA+5) */}
                      {shippingTerm === 'FOB' && (
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="etd_date">ETD Date (Ship Date) *</Label>
                              <Input
                                id="etd_date"
                                type="date"
                                {...register('etd_date')}
                                onChange={(e) => {
                                  const etdDate = e.target.value;
                                  setValue('etd_date', etdDate);
                                  if (etdDate) {
                                    // Ex-Factory = ETD - 7 days
                                    const exFactory = new Date(etdDate);
                                    exFactory.setDate(exFactory.getDate() - 7);
                                    setValue('ex_factory_date', exFactory.toISOString().split('T')[0]);

                                    // ETA = ETD + sailing time (from country, or 0 if no country selected)
                                    const country = selectedCountryId ? countries.find(c => c.id.toString() === selectedCountryId) : null;
                                    const sailingDays = country?.sailing_time_days || 0;
                                    const eta = new Date(etdDate);
                                    eta.setDate(eta.getDate() + sailingDays);
                                    setValue('eta_date', eta.toISOString().split('T')[0]);

                                    // IHD (In-House Date) = ETA + 5 days
                                    const ihd = new Date(eta);
                                    ihd.setDate(ihd.getDate() + 5);
                                    setValue('in_warehouse_date', ihd.toISOString().split('T')[0]);
                                  }
                                }}
                              />
                              <p className="text-xs text-muted-foreground">
                                Enter ETD to auto-calculate other dates
                              </p>
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="ex_factory_date">Ex-Factory (Auto: ETD - 7 days)</Label>
                              <Input
                                id="ex_factory_date"
                                type="date"
                                {...register('ex_factory_date')}
                                disabled
                                className="bg-muted"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="eta_date">ETA (Auto: ETD + Sailing)</Label>
                              <Input
                                id="eta_date"
                                type="date"
                                {...register('eta_date')}
                                disabled
                                className="bg-muted"
                              />
                              {selectedCountryId && (
                                <p className="text-xs text-muted-foreground">
                                  +{countries.find(c => c.id.toString() === selectedCountryId)?.sailing_time_days || 0} sailing days
                                </p>
                              )}
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="in_warehouse_date">IHD (Auto: ETA + 5 days)</Label>
                              <Input
                                id="in_warehouse_date"
                                type="date"
                                {...register('in_warehouse_date')}
                                disabled
                                className="bg-muted"
                              />
                              <p className="text-xs text-muted-foreground">
                                In-House Date
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* DDP: Show In-Warehouse Date, auto-calculate ETD = in-warehouse - transit - 5 days */}
                      {shippingTerm === 'DDP' && (
                        <div className="grid grid-cols-4 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="in_warehouse_date">In-Warehouse Date *</Label>
                            <Input
                              id="in_warehouse_date"
                              type="date"
                              {...register('in_warehouse_date')}
                              onChange={(e) => {
                                const inWarehouseDate = e.target.value;
                                if (inWarehouseDate && selectedCountryId) {
                                  const country = countries.find(c => c.id.toString() === selectedCountryId);
                                  const transitDays = country?.sailing_time_days || 0;
                                  // ETD = In-Warehouse - Transit Time - 5 days
                                  const etd = new Date(inWarehouseDate);
                                  etd.setDate(etd.getDate() - transitDays - 5);
                                  setValue('etd_date', etd.toISOString().split('T')[0]);
                                  // ETA = ETD + Transit Time
                                  const eta = new Date(etd);
                                  eta.setDate(eta.getDate() + transitDays);
                                  setValue('eta_date', eta.toISOString().split('T')[0]);
                                }
                              }}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="etd_date">ETD Date (Auto)</Label>
                            <Input
                              id="etd_date"
                              type="date"
                              {...register('etd_date')}
                              disabled
                              className="bg-muted"
                            />
                            <p className="text-xs text-muted-foreground">= In-Warehouse - Transit - 5 days</p>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="eta_date">ETA Date (Auto)</Label>
                            <Input
                              id="eta_date"
                              type="date"
                              {...register('eta_date')}
                              disabled
                              className="bg-muted"
                            />
                                          </div>
                        </div>
                      )}
                    </div>

                    {/* Sample Schedule - 8 Milestones */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold">Sample Schedule (8 Milestones)</h3>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const poDate = (document.getElementById('po_date') as HTMLInputElement)?.value;
                            const etdDate = (document.getElementById('etd_date') as HTMLInputElement)?.value;
                            if (poDate && etdDate) {
                              generateSampleSchedule(poDate, etdDate);
                            } else {
                              alert('Please enter PO Date and ETD Date first');
                            }
                          }}
                        >
                          Auto-Generate Schedule
                        </Button>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Based on PO Date and ETD Date
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="lab_dip_submission">Lab Dip Submission (Auto)</Label>
                          <Input
                            id="lab_dip_submission"
                            type="date"
                            {...register('sample_schedule.lab_dip_submission')}
                            disabled
                            className="bg-muted"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="fit_sample_submission">Fit Sample Submission (Auto)</Label>
                          <Input
                            id="fit_sample_submission"
                            type="date"
                            {...register('sample_schedule.fit_sample_submission')}
                            disabled
                            className="bg-muted"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="trim_approvals">Trim Approvals (Auto)</Label>
                          <Input
                            id="trim_approvals"
                            type="date"
                            {...register('sample_schedule.trim_approvals')}
                            disabled
                            className="bg-muted"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="first_proto_submission">1st Proto Submission (Auto)</Label>
                          <Input
                            id="first_proto_submission"
                            type="date"
                            {...register('sample_schedule.first_proto_submission')}
                            disabled
                            className="bg-muted"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="bulk_fabric_inhouse">Bulk Fabric Inhouse (Auto)</Label>
                          <Input
                            id="bulk_fabric_inhouse"
                            type="date"
                            {...register('sample_schedule.bulk_fabric_inhouse')}
                            disabled
                            className="bg-muted"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="pp_sample_submission">PP Sample Submission (Auto)</Label>
                          <Input
                            id="pp_sample_submission"
                            type="date"
                            {...register('sample_schedule.pp_sample_submission')}
                            disabled
                            className="bg-muted"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="production_start">Production Start (Auto)</Label>
                          <Input
                            id="production_start"
                            type="date"
                            {...register('sample_schedule.production_start')}
                            disabled
                            className="bg-muted"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="top_approval">TOP Approval (Auto)</Label>
                          <Input
                            id="top_approval"
                            type="date"
                            {...register('sample_schedule.top_approval')}
                            disabled
                            className="bg-muted"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Additional Information */}
                    <div className="space-y-4">
                      <h3 className="text-sm font-semibold">Additional Information</h3>
                      <div className="space-y-2">
                        <Label htmlFor="packing_method">Packing Method</Label>
                        <textarea
                          id="packing_method"
                          className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                          placeholder="e.g., Each piece folded and poly-bagged individually, 12 pieces per carton..."
                          {...register('packing_method')}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="packing_guidelines">Packing Guidelines</Label>
                        <textarea
                          id="packing_guidelines"
                          className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                          placeholder="Packing guidelines and instructions..."
                          {...register('packing_guidelines')}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="other_terms">Other Terms & Conditions</Label>
                        <textarea
                          id="other_terms"
                          className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                          placeholder="e.g., Partial shipping is not allowed..."
                          {...register('other_terms')}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="notes">General Notes</Label>
                        <textarea
                          id="notes"
                          className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                          placeholder="Additional notes..."
                          {...register('notes')}
                        />
                      </div>
                    </div>
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
                          Creating...
                        </>
                      ) : (
                        'Create PO'
                      )}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
            )}
          </div>
        </div>

        {/* Search bar (shared between views) */}
        <div className="relative max-w-md">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by PO number..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8"
          />
        </div>

        {/* Table */}
        <Card>
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
                        <TableHead>Date</TableHead>
                        <TableHead className="text-right">Quantity</TableHead>
                        <TableHead className="text-right">Value</TableHead>
                        <TableHead>Styles</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {purchaseOrders.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground">
                            No purchase orders found
                          </TableCell>
                        </TableRow>
                      ) : (
                        purchaseOrders.map((po) => (
                          <TableRow key={po.id}>
                            <TableCell className="font-medium">
                              <div className="flex flex-col">
                                <span>{po.po_number}</span>
                                {po.headline && (
                                  <span className="text-sm text-muted-foreground font-normal">
                                    {po.headline}
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>{formatDate(po.po_date)}</TableCell>
                            <TableCell className="text-right">
                              {po.total_quantity.toLocaleString()}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(po.total_value, po.currency)}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{po.styles_count || 0} styles</Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Link href={`/purchase-orders/${po.id}`}>
                                  <Button variant="ghost" size="icon">
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                </Link>
                                {can('po.edit') && (
                                  <Link href={`/purchase-orders/${po.id}`}>
                                    <Button variant="ghost" size="icon">
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                  </Link>
                                )}
                                {can('po.delete') && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleDelete(po.id)}
                                  >
                                    <Trash2 className="h-4 w-4 text-destructive" />
                                  </Button>
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

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                </Button>
              </div>
            )}

        {/* Select PO for Import Dialog */}
        <Dialog open={isSelectPODialogOpen} onOpenChange={setIsSelectPODialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Select Purchase Order for Import</DialogTitle>
              <DialogDescription>
                Choose a purchase order to import styles into from Excel
              </DialogDescription>
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
                      <TableCell>
                        <Badge variant="outline">{po.status}</Badge>
                      </TableCell>
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
              <Button
                variant="outline"
                onClick={() => setIsSelectPODialogOpen(false)}
              >
                Cancel
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* PDF Import Dialog */}
        <PdfImportDialog
          isOpen={isPdfImportDialogOpen}
          onClose={() => setIsPdfImportDialogOpen(false)}
          onImportComplete={() => {
            fetchPurchaseOrders();
            setIsPdfImportDialogOpen(false);
          }}
          masterData={{
            currencies,
            paymentTerms,
            seasons,
            retailers,
            countries,
            warehouses,
            buyers,
            agents,
          }}
          onRefreshMasterData={fetchMasterData}
        />

        {/* Create Dialogs */}
        <CreateRetailerDialog
          open={isCreateRetailerDialogOpen}
          onOpenChange={setIsCreateRetailerDialogOpen}
          onSuccess={fetchMasterData}
        />
        <CreateSeasonDialog
          open={isCreateSeasonDialogOpen}
          onOpenChange={setIsCreateSeasonDialogOpen}
          onSuccess={fetchMasterData}
        />
        <CreateWarehouseDialog
          open={isCreateWarehouseDialogOpen}
          onOpenChange={setIsCreateWarehouseDialogOpen}
          onSuccess={fetchMasterData}
        />
        <CreateCountryDialog
          open={isCreateCountryDialogOpen}
          onOpenChange={setIsCreateCountryDialogOpen}
          onSuccess={fetchMasterData}
        />
        <CreateCurrencyDialog
          open={isCreateCurrencyDialogOpen}
          onOpenChange={setIsCreateCurrencyDialogOpen}
          onSuccess={fetchMasterData}
        />
        <CreatePaymentTermDialog
          open={isCreatePaymentTermDialogOpen}
          onOpenChange={setIsCreatePaymentTermDialogOpen}
          onSuccess={fetchMasterData}
        />
        <CreateAgentDialog
          open={isCreateAgentDialogOpen}
          onOpenChange={setIsCreateAgentDialogOpen}
          onSuccess={fetchMasterData}
        />
      </div>
    </DashboardLayout>
  );
}
