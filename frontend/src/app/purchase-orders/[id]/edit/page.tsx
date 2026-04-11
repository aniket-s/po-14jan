'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Loader2, Save } from 'lucide-react';
import api from '@/lib/api';
import { FormSkeleton } from '@/components/skeletons';
import { PurchaseOrder } from '@/types';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { CreateRetailerDialog } from '@/components/master-data/CreateRetailerDialog';
import { CreateSeasonDialog } from '@/components/master-data/CreateSeasonDialog';
import { CreateWarehouseDialog } from '@/components/master-data/CreateWarehouseDialog';
import { CreateCountryDialog } from '@/components/master-data/CreateCountryDialog';
import { Plus } from 'lucide-react';

const poSchema = z.object({
  po_number: z.string().min(1, 'PO number is required'),
  headline: z.string().optional(),
  retailer_id: z.string().min(1, 'Retailer is required'),
  po_date: z.string().min(1, 'PO date is required'),
  status: z.string().min(1, 'Status is required'),
  currency: z.string().min(1, 'Currency is required'),
  shipping_method: z.string().optional(),
  notes: z.string().optional(),
  // REMOVED: brand_id - Brand is already in Style
  season_id: z.string().optional(),
  warehouse_id: z.string().optional(),
  country_id: z.string().optional(),
  shipping_term: z.enum(['FOB', 'DDP']).optional(), // Changed from price_term
  payment_terms_structured: z.object({
    term: z.string(),
    percentage: z.number().min(0).max(100).optional(),
  }).optional(),
  packing_method: z.string().optional(),
  other_terms: z.string().optional(),
  revision_date: z.string().optional(),
  etd_date: z.string().min(1, 'ETD date is required'),
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

export default function EditPurchaseOrderPage() {
  const params = useParams();
  const router = useRouter();
  const poId = params.id as string;

  const [purchaseOrder, setPurchaseOrder] = useState<PurchaseOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCalculatingDates, setIsCalculatingDates] = useState(false);
  const [isCreateRetailerDialogOpen, setIsCreateRetailerDialogOpen] = useState(false);
  const [isCreateSeasonDialogOpen, setIsCreateSeasonDialogOpen] = useState(false);
  const [isCreateWarehouseDialogOpen, setIsCreateWarehouseDialogOpen] = useState(false);
  const [isCreateCountryDialogOpen, setIsCreateCountryDialogOpen] = useState(false);

  // Master data state
  // REMOVED: brands state - Brand is already in Style
  const [seasons, setSeasons] = useState<any[]>([]);
  const [retailers, setRetailers] = useState<any[]>([]);
  const [countries, setCountries] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);

  // Payment terms state
  const [paymentTerm, setPaymentTerm] = useState<string>('');
  const [paymentPercentage, setPaymentPercentage] = useState<string>('');

  // Shipping term state (FOB/DDP) - changed from priceTerm
  const [shippingTerm, setShippingTerm] = useState<'FOB' | 'DDP'>('FOB');

  // Selected values state for controlled components
  const [selectedRetailerId, setSelectedRetailerId] = useState<string>('');
  // REMOVED: selectedBrandId - Brand is already in Style
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>('');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('');
  const [selectedCountryId, setSelectedCountryId] = useState<string>('');
  const [selectedStatus, setSelectedStatus] = useState<string>('draft');
  const [selectedCurrency, setSelectedCurrency] = useState<string>('USD');

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    getValues,
  } = useForm<POFormData>({
    resolver: zodResolver(poSchema),
  });

  useEffect(() => {
    fetchMasterData();
    fetchPurchaseOrder();
  }, [poId]);

  const fetchMasterData = async () => {
    try {
      // REMOVED: brands fetch - Brand is already in Style
      const [seasonsRes, retailersRes, countriesRes, warehousesRes] = await Promise.all([
        api.get('/master-data/seasons?all=true'),
        api.get('/master-data/retailers?all=true'),
        api.get('/master-data/countries?all=true'),
        api.get('/master-data/warehouses?all=true'),
      ]);

      setSeasons(seasonsRes.data || []);
      setRetailers(retailersRes.data || []);
      setCountries(countriesRes.data || []);
      setWarehouses(warehousesRes.data || []);
    } catch (error) {
      console.error('Failed to fetch master data:', error);
      alert('Failed to load form options (seasons, retailers, etc.). Some dropdowns may be empty. Please refresh the page.');
    }
  };

  const fetchPurchaseOrder = async () => {
    try {
      setLoading(true);
      const response = await api.get<{ purchase_order: PurchaseOrder }>(`/purchase-orders/${poId}`);
      const po = response.data.purchase_order;
      setPurchaseOrder(po);

      // Pre-populate form fields
      setValue('po_number', po.po_number);
      setValue('headline', po.headline || '');

      // Set controlled state values for Selects
      if (po.retailer_id) {
        const retailerId = po.retailer_id.toString();
        setSelectedRetailerId(retailerId);
        setValue('retailer_id', retailerId);
      }

      setValue('po_date', po.po_date ? po.po_date.split('T')[0] : '');

      setSelectedStatus(po.status);
      setValue('status', po.status);

      setSelectedCurrency(po.currency);
      setValue('currency', po.currency);

      setValue('shipping_method', po.shipping_method || '');
      setValue('notes', po.notes || '');

      // Master data IDs with controlled state
      // REMOVED: brand_id setting - Brand is already in Style
      if (po.season_id) {
        const seasonId = po.season_id.toString();
        setSelectedSeasonId(seasonId);
        setValue('season_id', seasonId);
      }
      if (po.warehouse_id) {
        const warehouseId = po.warehouse_id.toString();
        setSelectedWarehouseId(warehouseId);
        setValue('warehouse_id', warehouseId);
      }
      if (po.country_id) {
        const countryId = po.country_id.toString();
        setSelectedCountryId(countryId);
        setValue('country_id', countryId);
      }

      // Price term and additional fields
      if (po.shipping_term) {
        setShippingTerm(po.shipping_term as 'FOB' | 'DDP');
        setValue('shipping_term', po.shipping_term as 'FOB' | 'DDP');
      }
      if (po.packing_method) setValue('packing_method', po.packing_method);
      if (po.other_terms) setValue('other_terms', po.other_terms);

      // Payment terms structured
      if (po.payment_terms_structured) {
        const paymentData = po.payment_terms_structured as any;
        if (paymentData.term) {
          setPaymentTerm(paymentData.term);
          setValue('payment_terms_structured', {
            term: paymentData.term,
            percentage: paymentData.percentage,
          });
          if (paymentData.percentage) {
            setPaymentPercentage(paymentData.percentage.toString());
          }
        }
      }

      // Enhanced PO fields
      if (po.revision_date) setValue('revision_date', po.revision_date.split('T')[0]);
      if (po.etd_date) setValue('etd_date', po.etd_date.split('T')[0]);
      if (po.eta_date) setValue('eta_date', po.eta_date.split('T')[0]);
      if (po.in_warehouse_date) setValue('in_warehouse_date', po.in_warehouse_date.split('T')[0]);
      if (po.ship_to) setValue('ship_to', po.ship_to);
      if (po.ship_to_address) setValue('ship_to_address', po.ship_to_address);

      // Sample schedule
      if (po.sample_schedule) {
        const schedule = po.sample_schedule;
        setValue('sample_schedule', {
          lab_dip_submission: schedule.lab_dip_submission ? schedule.lab_dip_submission.split('T')[0] : '',
          fit_sample_submission: schedule.fit_sample_submission ? schedule.fit_sample_submission.split('T')[0] : '',
          trim_approvals: schedule.trim_approvals ? schedule.trim_approvals.split('T')[0] : '',
          first_proto_submission: schedule.first_proto_submission ? schedule.first_proto_submission.split('T')[0] : '',
          bulk_fabric_inhouse: schedule.bulk_fabric_inhouse ? schedule.bulk_fabric_inhouse.split('T')[0] : '',
          pp_sample_submission: schedule.pp_sample_submission ? schedule.pp_sample_submission.split('T')[0] : '',
          production_start: schedule.production_start ? schedule.production_start.split('T')[0] : '',
          top_approval: schedule.top_approval ? schedule.top_approval.split('T')[0] : '',
        });
      }

      // REMOVED: Buyer details - moved to Style creation

      // Packing guidelines
      if (po.packing_guidelines) setValue('packing_guidelines', po.packing_guidelines);

      // Note: Master data IDs and other fields will be set when master data is loaded
      // This will be handled in a separate useEffect
    } catch (error) {
      console.error('Failed to fetch purchase order:', error);
      alert('Failed to load purchase order. Redirecting...');
      router.push('/purchase-orders');
    } finally {
      setLoading(false);
    }
  };

  // Auto-calculate dates based on ETD and country
  const calculateDates = async (etdDate: string, countryId: string) => {
    if (!etdDate || !countryId) return;

    setIsCalculatingDates(true);
    try {
      const response = await api.post('/purchase-orders/calculate-dates', {
        etd_date: etdDate,
        country_id: parseInt(countryId),
      });

      if (response.data?.eta_date) {
        setValue('eta_date', response.data.eta_date.split('T')[0]);
      }
      if (response.data?.in_warehouse_date) {
        setValue('in_warehouse_date', response.data.in_warehouse_date.split('T')[0]);
      }
    } catch (error) {
      console.error('Failed to calculate dates:', error);
    } finally {
      setIsCalculatingDates(false);
    }
  };

  // Auto-generate sample schedule
  const generateSampleSchedule = async (poDate: string, etdDate: string) => {
    if (!poDate || !etdDate) {
      alert('Please enter PO Date and ETD Date first');
      return;
    }

    try {
      const exFactoryDate = purchaseOrder?.ex_factory_date;
      const response = await api.post('/purchase-orders/sample-schedule', {
        po_date: poDate,
        etd_date: etdDate,
        ex_factory_date: exFactoryDate || undefined,
      });

      if (response.data?.schedule) {
        const schedule = response.data.schedule;
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
      // REMOVED: Build buyer details - moved to Style creation

      const requestData = {
        po_number: data.po_number,
        headline: data.headline || null,
        retailer_id: data.retailer_id ? parseInt(data.retailer_id) : null,
        po_date: data.po_date,
        status: data.status,
        currency: data.currency,
        shipping_method: data.shipping_method,
        notes: data.notes,
        // REMOVED: brand_id - Brand is already in Style
        season_id: data.season_id ? parseInt(data.season_id) : null,
        warehouse_id: data.warehouse_id ? parseInt(data.warehouse_id) : null,
        country_id: data.country_id ? parseInt(data.country_id) : null,
        shipping_term: shippingTerm || null, // Changed from price_term/priceTerm
        payment_terms_structured: data.payment_terms_structured || null,
        packing_method: data.packing_method || null,
        other_terms: data.other_terms || null,
        revision_date: data.revision_date,
        etd_date: data.etd_date,
        eta_date: data.eta_date,
        in_warehouse_date: data.in_warehouse_date,
        ship_to: data.ship_to,
        ship_to_address: data.ship_to_address,
        sample_schedule: data.sample_schedule || undefined,
        // REMOVED: buyer_details - moved to Style creation
        packing_guidelines: data.packing_guidelines,
      };

      await api.put(`/purchase-orders/${poId}`, requestData);
      router.push(`/purchase-orders/${poId}`);
    } catch (error: any) {
      console.error('Failed to update purchase order:', error);
      const errorMessage = error.response?.data?.message || 'Failed to update purchase order. Please try again.';
      alert(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout requiredPermissions={['po.edit']} requireAll={false}>
        <FormSkeleton fields={10} />
      </DashboardLayout>
    );
  }

  if (!purchaseOrder) {
    return (
      <DashboardLayout requiredPermissions={['po.edit']} requireAll={false}>
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
    <DashboardLayout requiredPermissions={['po.edit']} requireAll={false}>
      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => router.push(`/purchase-orders/${poId}`)}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-3xl font-bold tracking-tight">Edit Purchase Order</h1>
                <p className="text-muted-foreground">{purchaseOrder.po_number}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push(`/purchase-orders/${poId}`)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Form Content */}
          <Card>
            <CardContent className="pt-6">
              <div className="grid gap-6">
                {/* Basic Information */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold">Basic Information</h3>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="po_number">PO Number *</Label>
                      <Input
                        id="po_number"
                        placeholder="PO-2025-001"
                        {...register('po_number')}
                      />
                      {errors.po_number && (
                        <p className="text-sm text-destructive">{errors.po_number.message}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="headline">PO Headline</Label>
                      <Input
                        id="headline"
                        placeholder="e.g., Spring 2025 Collection"
                        {...register('headline')}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="retailer_id">Retailer *</Label>
                      <div className="flex gap-2">
                        <Select
                          value={selectedRetailerId}
                          onValueChange={(value) => {
                            setSelectedRetailerId(value);
                            setValue('retailer_id', value);
                          }}
                        >
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
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="status">Status *</Label>
                      <Select
                        value={selectedStatus}
                        onValueChange={(value) => {
                          setSelectedStatus(value);
                          setValue('status', value);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="draft">Draft</SelectItem>
                          <SelectItem value="confirmed">Confirmed</SelectItem>
                          <SelectItem value="in_production">In Production</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                        </SelectContent>
                      </Select>
                      {errors.status && (
                        <p className="text-sm text-destructive">{errors.status.message}</p>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="currency">Currency *</Label>
                      <Select
                        value={selectedCurrency}
                        onValueChange={(value) => {
                          setSelectedCurrency(value);
                          setValue('currency', value);
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select currency" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="USD">USD</SelectItem>
                          <SelectItem value="EUR">EUR</SelectItem>
                          <SelectItem value="GBP">GBP</SelectItem>
                          <SelectItem value="BDT">BDT</SelectItem>
                          <SelectItem value="CNY">CNY</SelectItem>
                        </SelectContent>
                      </Select>
                      {errors.currency && (
                        <p className="text-sm text-destructive">{errors.currency.message}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Master Data */}
                <div className="space-y-4">
                  <h3 className="text-sm font-semibold">Master Data</h3>
                  {/* REMOVED: Brand field - Brand is already in Style */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="season_id">Season</Label>
                      <div className="flex gap-2">
                        <Select
                          value={selectedSeasonId}
                          onValueChange={(value) => {
                            setSelectedSeasonId(value);
                            setValue('season_id', value);
                          }}
                        >
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
                        <Select
                          value={selectedWarehouseId}
                          onValueChange={(value) => {
                            setSelectedWarehouseId(value);
                            setValue('warehouse_id', value);
                          }}
                        >
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
                      <Label htmlFor="country_id">Country of Origin</Label>
                      <div className="flex gap-2">
                        <Select
                          value={selectedCountryId}
                          onValueChange={(value) => {
                            setSelectedCountryId(value);
                            setValue('country_id', value);
                            const etdDate = getValues('etd_date');
                            if (etdDate) {
                              calculateDates(etdDate, value);
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
                  {/* Payment Terms */}
                  <div className="space-y-2">
                    <Label>Payment Terms</Label>
                    <div className="grid grid-cols-2 gap-4">
                      <Select
                        value={paymentTerm}
                        onValueChange={(value) => {
                          setPaymentTerm(value);
                          const percentage = paymentPercentage ? parseFloat(paymentPercentage) : undefined;
                          setValue('payment_terms_structured', {
                            term: value,
                            percentage
                          });
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select term" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="NET30">NET 30</SelectItem>
                          <SelectItem value="NET60">NET 60</SelectItem>
                          <SelectItem value="NET90">NET 90</SelectItem>
                          <SelectItem value="DP_SIGHT">DP SIGHT</SelectItem>
                          <SelectItem value="LC">LC (Letter of Credit)</SelectItem>
                          <SelectItem value="ADVANCE">ADVANCE</SelectItem>
                        </SelectContent>
                      </Select>
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
                    </div>
                  </div>
                  {/* Shipping Term */}
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
                  <div className={`grid gap-4 ${shippingTerm === 'DDP' ? 'grid-cols-4' : 'grid-cols-2'}`}>
                    <div className="space-y-2">
                      <Label htmlFor="etd_date">ETD Date *</Label>
                      <Input
                        id="etd_date"
                        type="date"
                        {...register('etd_date')}
                        onChange={(e) => {
                          if (selectedCountryId && shippingTerm === 'DDP') {
                            calculateDates(e.target.value, selectedCountryId);
                          }
                        }}
                      />
                      {errors.etd_date && (
                        <p className="text-sm text-destructive">{errors.etd_date.message}</p>
                      )}
                    </div>
                    {shippingTerm === 'DDP' && (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="eta_date">ETA Date (Auto)</Label>
                          <Input
                            id="eta_date"
                            type="date"
                            {...register('eta_date')}
                            disabled
                            className="bg-muted"
                          />
                          {isCalculatingDates && <p className="text-xs text-muted-foreground">Calculating...</p>}
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="in_warehouse_date">In-Warehouse (Auto)</Label>
                          <Input
                            id="in_warehouse_date"
                            type="date"
                            {...register('in_warehouse_date')}
                            disabled
                            className="bg-muted"
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Sample Schedule */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">Sample Schedule (8 Milestones)</h3>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const poDate = getValues('po_date');
                        const etdDate = getValues('etd_date');
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
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label htmlFor="lab_dip_submission">Lab Dip Submission (Auto)</Label>
                      <Input
                        id="lab_dip_submission"
                        type="date"
                        {...register('sample_schedule.lab_dip_submission')}
                        disabled
                        className="bg-muted"
                      />
                      <p className="text-[11px] text-muted-foreground">PO Date + 7 days</p>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="fit_sample_submission">Fit Sample Submission (Auto)</Label>
                      <Input
                        id="fit_sample_submission"
                        type="date"
                        {...register('sample_schedule.fit_sample_submission')}
                        disabled
                        className="bg-muted"
                      />
                      <p className="text-[11px] text-muted-foreground">PO Date + 7 days</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label htmlFor="trim_approvals">Trim Approvals (Auto)</Label>
                      <Input
                        id="trim_approvals"
                        type="date"
                        {...register('sample_schedule.trim_approvals')}
                        disabled
                        className="bg-muted"
                      />
                      <p className="text-[11px] text-muted-foreground">PO Date + 10 days</p>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="first_proto_submission">1st Proto Submission (Auto)</Label>
                      <Input
                        id="first_proto_submission"
                        type="date"
                        {...register('sample_schedule.first_proto_submission')}
                        disabled
                        className="bg-muted"
                      />
                      <p className="text-[11px] text-muted-foreground">PO Date + 10 days</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label htmlFor="bulk_fabric_inhouse">Bulk Fabric Inhouse (Auto)</Label>
                      <Input
                        id="bulk_fabric_inhouse"
                        type="date"
                        {...register('sample_schedule.bulk_fabric_inhouse')}
                        disabled
                        className="bg-muted"
                      />
                      <p className="text-[11px] text-muted-foreground">ETD − 40 days</p>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="pp_sample_submission">PP Sample Submission (Auto)</Label>
                      <Input
                        id="pp_sample_submission"
                        type="date"
                        {...register('sample_schedule.pp_sample_submission')}
                        disabled
                        className="bg-muted"
                      />
                      <p className="text-[11px] text-muted-foreground">ETD − 35 days</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label htmlFor="production_start">Production Start (Auto)</Label>
                      <Input
                        id="production_start"
                        type="date"
                        {...register('sample_schedule.production_start')}
                        disabled
                        className="bg-muted"
                      />
                      <p className="text-[11px] text-muted-foreground">ETD − 30 days</p>
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="top_approval">TOP Approval (Auto)</Label>
                      <Input
                        id="top_approval"
                        type="date"
                        {...register('sample_schedule.top_approval')}
                        disabled
                        className="bg-muted"
                      />
                      <p className="text-[11px] text-muted-foreground">Ex-Factory − 10 days</p>
                    </div>
                  </div>
                </div>

                {/* REMOVED: Buyer/Trim Details section - moved to Style creation */}

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
            </CardContent>
          </Card>
        </div>
      </form>

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
    </DashboardLayout>
  );
}
