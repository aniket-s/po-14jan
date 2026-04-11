'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Plus,
  Loader2,
  ChevronRight,
  ChevronLeft,
  Check,
  Package,
  Calendar,
  FileText,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import api from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

const poSchema = z.object({
  po_number: z.string().min(1, 'PO number is required'),
  headline: z.string().optional(),
  retailer_id: z.string().min(1, 'Retailer is required'),
  po_date: z.string().min(1, 'PO date is required'),
  currency_id: z.string().min(1, 'Currency is required'),
  shipping_method: z.string().optional(),
  notes: z.string().optional(),
  importer_id: z.string().optional(),
  agency_id: z.string().optional(),
  buyer_id: z.string().optional(),
  season_id: z.string().optional(),
  warehouse_id: z.string().optional(),
  country_id: z.string().optional(),
  shipping_term: z.enum(['FOB', 'DDP']).optional(),
  payment_terms_structured: z.object({
    term: z.string(),
    percentage: z.number().min(0).max(100).optional(),
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

interface MasterData {
  currencies: any[];
  paymentTerms: any[];
  seasons: any[];
  retailers: any[];
  countries: any[];
  warehouses: any[];
  buyers: any[];
  agents: any[];
  importers: any[];
}

interface POCreateWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  masterData: MasterData;
  onSuccess: () => void;
  onOpenCreateDialog: (type: 'retailer' | 'season' | 'warehouse' | 'country' | 'currency' | 'paymentTerm' | 'agent') => void;
}

const STEPS = [
  { key: 'basic', label: 'Basic Info', icon: Package },
  { key: 'dates', label: 'Dates & Shipping', icon: Calendar },
  { key: 'schedule', label: 'Sample Schedule', icon: Settings },
  { key: 'terms', label: 'Terms & Notes', icon: FileText },
] as const;

export function POCreateWizard({
  open,
  onOpenChange,
  masterData,
  onSuccess,
  onOpenCreateDialog,
}: POCreateWizardProps) {
  const { hasRole } = useAuth();
  const [currentStep, setCurrentStep] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [autoGeneratePO, setAutoGeneratePO] = useState(true);
  const [isGeneratingPO, setIsGeneratingPO] = useState(false);
  const [shippingTerm, setShippingTerm] = useState<'FOB' | 'DDP'>('FOB');
  const [selectedCountryId, setSelectedCountryId] = useState<string>('');
  const [paymentTerm, setPaymentTerm] = useState<string>('');
  const [paymentPercentage, setPaymentPercentage] = useState<string>('');

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
  } = useForm<POFormData>({
    resolver: zodResolver(poSchema),
  });

  useEffect(() => {
    if (open) {
      setCurrentStep(0);
      const today = new Date().toISOString().split('T')[0];
      setValue('po_date', today);
      setPaymentTerm('');
      setPaymentPercentage('');
      setSelectedCountryId('');
      setShippingTerm('FOB');
      if (autoGeneratePO) generatePONumber();
    }
  }, [open]);

  const generatePONumber = async () => {
    setIsGeneratingPO(true);
    try {
      const response = await api.get('/purchase-orders/generate-po-number');
      if (response.data?.po_number) setValue('po_number', response.data.po_number);
    } catch (error) {
      console.error('Failed to generate PO number:', error);
    } finally {
      setIsGeneratingPO(false);
    }
  };

  const generateSampleSchedule = async () => {
    const poDate = watch('po_date');
    const etdDate = watch('etd_date');
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
        const s = response.data.schedule;
        const fmt = (d: string) => d ? d.split('T')[0] : '';
        setValue('sample_schedule', {
          lab_dip_submission: fmt(s.lab_dip?.date || ''),
          fit_sample_submission: fmt(s.fit_samples?.date || ''),
          trim_approvals: fmt(s.trim_approvals?.date || ''),
          first_proto_submission: fmt(s.first_proto_samples?.date || ''),
          bulk_fabric_inhouse: fmt(s.bulk_fabric_inhouse?.date || ''),
          pp_sample_submission: fmt(s.pp_sample?.date || ''),
          production_start: fmt(s.production_start?.date || ''),
          top_approval: fmt(s.top_approval?.date || ''),
        });
      }
    } catch (error) {
      console.error('Failed to generate sample schedule:', error);
    }
  };

  const calculateFOBDates = (etdDate: string) => {
    if (!etdDate) return;
    setValue('etd_date', etdDate);
    const exFactory = new Date(etdDate);
    exFactory.setDate(exFactory.getDate() - 7);
    setValue('ex_factory_date', exFactory.toISOString().split('T')[0]);

    const country = selectedCountryId ? masterData.countries.find((c: any) => c.id.toString() === selectedCountryId) : null;
    const sailingDays = country?.sailing_time_days || 0;
    const eta = new Date(etdDate);
    eta.setDate(eta.getDate() + sailingDays);
    setValue('eta_date', eta.toISOString().split('T')[0]);

    const ihd = new Date(eta);
    ihd.setDate(ihd.getDate() + 5);
    setValue('in_warehouse_date', ihd.toISOString().split('T')[0]);
  };

  const calculateDDPDates = (inWarehouseDate: string) => {
    if (!inWarehouseDate || !selectedCountryId) return;
    const country = masterData.countries.find((c: any) => c.id.toString() === selectedCountryId);
    const transitDays = country?.sailing_time_days || 0;

    const etd = new Date(inWarehouseDate);
    etd.setDate(etd.getDate() - transitDays - 5);
    setValue('etd_date', etd.toISOString().split('T')[0]);

    const eta = new Date(etd);
    eta.setDate(eta.getDate() + transitDays);
    setValue('eta_date', eta.toISOString().split('T')[0]);
  };

  const recalculateDatesForCountry = (countryId: string) => {
    const country = masterData.countries.find((c: any) => c.id.toString() === countryId);
    const sailingDays = country?.sailing_time_days || 0;

    if (shippingTerm === 'FOB') {
      const etdDate = watch('etd_date');
      if (etdDate) {
        const eta = new Date(etdDate);
        eta.setDate(eta.getDate() + sailingDays);
        setValue('eta_date', eta.toISOString().split('T')[0]);
        const ihd = new Date(eta);
        ihd.setDate(ihd.getDate() + 5);
        setValue('in_warehouse_date', ihd.toISOString().split('T')[0]);
      }
    } else {
      const inWarehouseDate = watch('in_warehouse_date');
      if (inWarehouseDate) {
        const etd = new Date(inWarehouseDate);
        etd.setDate(etd.getDate() - sailingDays - 5);
        setValue('etd_date', etd.toISOString().split('T')[0]);
        const eta = new Date(etd);
        eta.setDate(eta.getDate() + sailingDays);
        setValue('eta_date', eta.toISOString().split('T')[0]);
      }
    }
  };

  const onSubmit = async (data: POFormData) => {
    setIsSubmitting(true);
    try {
      await api.post('/purchase-orders', {
        po_number: data.po_number,
        headline: data.headline || null,
        retailer_id: data.retailer_id ? parseInt(data.retailer_id) : null,
        importer_id: data.importer_id ? parseInt(data.importer_id) : null,
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
      });
      onOpenChange(false);
      reset();
      setAutoGeneratePO(true);
      setPaymentTerm('');
      setPaymentPercentage('');
      setSelectedCountryId('');
      setShippingTerm('FOB');
      onSuccess();
    } catch (error) {
      console.error('Failed to create purchase order:', error);
      alert('Failed to create purchase order. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const canGoNext = () => {
    if (currentStep === 0) {
      const poNumber = watch('po_number');
      const retailerId = watch('retailer_id');
      const currencyId = watch('currency_id');
      return !!poNumber && !!retailerId && !!currencyId;
    }
    return true;
  };

  const handleClose = () => {
    onOpenChange(false);
    reset();
    setCurrentStep(0);
    setAutoGeneratePO(true);
    setPaymentTerm('');
    setPaymentPercentage('');
    setSelectedCountryId('');
    setShippingTerm('FOB');
  };

  const SelectWithCreate = ({ label, required, placeholder, items, valueKey = 'id', labelFn, onValueChange, createType, error }: {
    label: string;
    required?: boolean;
    placeholder: string;
    items: any[];
    valueKey?: string;
    labelFn: (item: any) => string;
    onValueChange: (value: string) => void;
    createType?: 'retailer' | 'season' | 'warehouse' | 'country' | 'currency' | 'paymentTerm' | 'agent';
    error?: string;
  }) => (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}{required && ' *'}</Label>
      <div className="flex gap-1.5">
        <Select onValueChange={onValueChange}>
          <SelectTrigger className="flex-1 h-9">
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            {items.map((item) => (
              <SelectItem key={item[valueKey]} value={item[valueKey].toString()}>
                {labelFn(item)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {createType && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 w-9 p-0 shrink-0"
            onClick={() => onOpenCreateDialog(createType)}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Create Purchase Order</DialogTitle>
          <DialogDescription>
            Fill in the details to create a new purchase order
          </DialogDescription>
        </DialogHeader>

        {/* Stepper */}
        <div className="flex items-center gap-1 px-2 py-3 border-b">
          {STEPS.map((step, idx) => {
            const Icon = step.icon;
            const isActive = idx === currentStep;
            const isCompleted = idx < currentStep;
            return (
              <div key={step.key} className="flex items-center flex-1">
                <button
                  type="button"
                  onClick={() => idx <= currentStep && setCurrentStep(idx)}
                  className={cn(
                    'flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-colors w-full',
                    isActive && 'bg-primary text-primary-foreground',
                    isCompleted && 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
                    !isActive && !isCompleted && 'text-muted-foreground',
                  )}
                >
                  {isCompleted ? (
                    <Check className="h-3.5 w-3.5 shrink-0" />
                  ) : (
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                  )}
                  <span className="hidden sm:inline truncate">{step.label}</span>
                </button>
                {idx < STEPS.length - 1 && (
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0 mx-0.5" />
                )}
              </div>
            );
          })}
        </div>

        {/* Step Content */}
        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 overflow-y-auto">
          <div className="p-4 space-y-4">
            {/* Step 1: Basic Info */}
            {currentStep === 0 && (
              <div className="space-y-4">
                {/* PO Number */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">PO Number *</Label>
                    <div className="flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        id="auto_gen_po"
                        checked={autoGeneratePO}
                        onChange={(e) => {
                          setAutoGeneratePO(e.target.checked);
                          if (e.target.checked) generatePONumber();
                        }}
                        className="rounded h-3 w-3"
                      />
                      <Label htmlFor="auto_gen_po" className="text-[10px] cursor-pointer">Auto-generate</Label>
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    <Input
                      placeholder="PO-2025-001"
                      {...register('po_number')}
                      disabled={autoGeneratePO}
                      className="h-9"
                    />
                    {autoGeneratePO && (
                      <Button type="button" variant="outline" size="sm" className="h-9" onClick={generatePONumber} disabled={isGeneratingPO}>
                        {isGeneratingPO ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'New'}
                      </Button>
                    )}
                  </div>
                  {errors.po_number && <p className="text-xs text-destructive">{errors.po_number.message}</p>}
                </div>

                {/* Headline */}
                <div className="space-y-1.5">
                  <Label className="text-xs">PO Headline</Label>
                  <Input placeholder="e.g., Spring 2025 Collection" {...register('headline')} className="h-9" />
                </div>

                {/* 2-col grid */}
                <div className="grid grid-cols-2 gap-4">
                  <SelectWithCreate
                    label="Retailer"
                    required
                    placeholder="Select retailer"
                    items={masterData.retailers}
                    labelFn={(r) => r.name}
                    onValueChange={(v) => setValue('retailer_id', v)}
                    createType="retailer"
                    error={errors.retailer_id?.message}
                  />
                  <SelectWithCreate
                    label="Currency"
                    required
                    placeholder="Select currency"
                    items={masterData.currencies}
                    labelFn={(c) => `${c.code} - ${c.name}${c.symbol ? ` (${c.symbol})` : ''}`}
                    onValueChange={(v) => setValue('currency_id', v)}
                    createType="currency"
                    error={errors.currency_id?.message}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {hasRole('Agency') ? (
                    <SelectWithCreate
                      label="Importer"
                      placeholder="Select importer"
                      items={masterData.importers}
                      labelFn={(i) => `${i.name}${i.company ? ` (${i.company})` : ''}`}
                      onValueChange={(v) => setValue('importer_id', v)}
                    />
                  ) : (
                    <SelectWithCreate
                      label="Agent"
                      placeholder="Select agent"
                      items={masterData.agents}
                      labelFn={(a) => `${a.name}${a.company ? ` (${a.company})` : ''}`}
                      onValueChange={(v) => setValue('agency_id', v)}
                      createType="agent"
                    />
                  )}
                  <SelectWithCreate
                    label="Buyer"
                    placeholder="Select buyer"
                    items={masterData.buyers}
                    labelFn={(b) => `${b.name}${b.code ? ` (${b.code})` : ''}`}
                    onValueChange={(v) => setValue('buyer_id', v)}
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <SelectWithCreate
                    label="Season"
                    placeholder="Select season"
                    items={masterData.seasons}
                    labelFn={(s) => s.name}
                    onValueChange={(v) => setValue('season_id', v)}
                    createType="season"
                  />
                  <SelectWithCreate
                    label="Warehouse"
                    placeholder="Select warehouse"
                    items={masterData.warehouses}
                    labelFn={(w) => w.name}
                    onValueChange={(v) => setValue('warehouse_id', v)}
                    createType="warehouse"
                  />
                  <SelectWithCreate
                    label="Country of Origin"
                    placeholder="Select country"
                    items={masterData.countries}
                    labelFn={(c) => `${c.name} (${c.sailing_time_days}d)`}
                    onValueChange={(v) => {
                      setValue('country_id', v);
                      setSelectedCountryId(v);
                      recalculateDatesForCountry(v);
                    }}
                    createType="country"
                  />
                </div>
              </div>
            )}

            {/* Step 2: Dates & Shipping */}
            {currentStep === 1 && (
              <div className="space-y-4">
                {/* Shipping Term */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Shipping Term *</Label>
                  <div className="flex gap-2">
                    {(['FOB', 'DDP'] as const).map((term) => (
                      <button
                        key={term}
                        type="button"
                        onClick={() => {
                          setShippingTerm(term);
                          setValue('shipping_term', term);
                        }}
                        className={cn(
                          'flex-1 rounded-lg border-2 p-3 text-left transition-all',
                          shippingTerm === term
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-muted-foreground/30',
                        )}
                      >
                        <p className="text-sm font-semibold">{term}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {term === 'FOB' ? 'Free On Board - Enter ETD' : 'Delivered Duty Paid - Enter In-Warehouse Date'}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* PO Date */}
                <div className="space-y-1.5">
                  <Label className="text-xs">PO Date *</Label>
                  <Input type="date" {...register('po_date')} className="h-9 w-[200px]" />
                  {errors.po_date && <p className="text-xs text-destructive">{errors.po_date.message}</p>}
                </div>

                {/* FOB Dates */}
                {shippingTerm === 'FOB' && (
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">ETD Date (Ship Date) *</Label>
                      <Input
                        type="date"
                        {...register('etd_date')}
                        className="h-9 w-[200px]"
                        onChange={(e) => calculateFOBDates(e.target.value)}
                      />
                      <p className="text-[10px] text-muted-foreground">Enter ETD to auto-calculate other dates</p>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Ex-Factory (ETD - 7)</Label>
                        <Input type="date" {...register('ex_factory_date')} disabled className="h-9 bg-muted" />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">ETA (ETD + Sailing)</Label>
                        <Input type="date" {...register('eta_date')} disabled className="h-9 bg-muted" />
                        {selectedCountryId && (
                          <p className="text-[10px] text-muted-foreground">
                            +{masterData.countries.find((c: any) => c.id.toString() === selectedCountryId)?.sailing_time_days || 0} sailing days
                          </p>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">In-Warehouse (ETA + 5)</Label>
                        <Input type="date" {...register('in_warehouse_date')} disabled className="h-9 bg-muted" />
                      </div>
                    </div>
                  </div>
                )}

                {/* DDP Dates */}
                {shippingTerm === 'DDP' && (
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">In-Warehouse Date *</Label>
                      <Input
                        type="date"
                        {...register('in_warehouse_date')}
                        className="h-9 w-[200px]"
                        onChange={(e) => calculateDDPDates(e.target.value)}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">ETD (Auto)</Label>
                        <Input type="date" {...register('etd_date')} disabled className="h-9 bg-muted" />
                        <p className="text-[10px] text-muted-foreground">= IHD - Transit - 5 days</p>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">ETA (Auto)</Label>
                        <Input type="date" {...register('eta_date')} disabled className="h-9 bg-muted" />
                      </div>
                    </div>
                  </div>
                )}

                {/* Payment Terms */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Payment Terms</Label>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex gap-1.5">
                      <Select
                        value={paymentTerm}
                        onValueChange={(value) => {
                          setPaymentTerm(value);
                          const pt = masterData.paymentTerms.find((p: any) => p.code === value);
                          setValue('payment_terms_structured', {
                            term: value,
                            percentage: pt?.requires_percentage && paymentPercentage ? parseFloat(paymentPercentage) : undefined,
                          });
                        }}
                      >
                        <SelectTrigger className="flex-1 h-9">
                          <SelectValue placeholder="Select term" />
                        </SelectTrigger>
                        <SelectContent>
                          {masterData.paymentTerms.map((pt: any) => (
                            <SelectItem key={pt.id} value={pt.code}>
                              {pt.name}{pt.days ? ` (${pt.days}d)` : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button type="button" variant="outline" size="sm" className="h-9 w-9 p-0 shrink-0" onClick={() => onOpenCreateDialog('paymentTerm')}>
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    {masterData.paymentTerms.find((pt: any) => pt.code === paymentTerm)?.requires_percentage && (
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        placeholder="Percentage (0-100)"
                        value={paymentPercentage}
                        className="h-9"
                        onChange={(e) => {
                          setPaymentPercentage(e.target.value);
                          if (paymentTerm) {
                            setValue('payment_terms_structured', {
                              term: paymentTerm,
                              percentage: e.target.value ? parseFloat(e.target.value) : undefined,
                            });
                          }
                        }}
                      />
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Step 3: Sample Schedule */}
            {currentStep === 2 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">Sample Schedule (8 Milestones)</p>
                    <p className="text-[10px] text-muted-foreground">Auto-generated from PO Date and ETD Date</p>
                  </div>
                  <Button type="button" variant="outline" size="sm" className="h-8" onClick={generateSampleSchedule}>
                    Auto-Generate
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { key: 'lab_dip_submission', label: 'Lab Dip Submission' },
                    { key: 'fit_sample_submission', label: 'Fit Sample Submission' },
                    { key: 'trim_approvals', label: 'Trim Approvals' },
                    { key: 'first_proto_submission', label: '1st Proto Submission' },
                    { key: 'bulk_fabric_inhouse', label: 'Bulk Fabric Inhouse' },
                    { key: 'pp_sample_submission', label: 'PP Sample Submission' },
                    { key: 'production_start', label: 'Production Start' },
                    { key: 'top_approval', label: 'TOP Approval' },
                  ].map((field) => (
                    <div key={field.key} className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">{field.label}</Label>
                      <Input
                        type="date"
                        {...register(`sample_schedule.${field.key}` as any)}
                        disabled
                        className="h-9 bg-muted"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Step 4: Terms & Notes */}
            {currentStep === 3 && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Packing Method</Label>
                  <textarea
                    className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    placeholder="e.g., Each piece folded and poly-bagged..."
                    {...register('packing_method')}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Packing Guidelines</Label>
                  <textarea
                    className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    placeholder="Packing guidelines and instructions..."
                    {...register('packing_guidelines')}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Other Terms & Conditions</Label>
                  <textarea
                    className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    placeholder="e.g., Partial shipping is not allowed..."
                    {...register('other_terms')}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">General Notes</Label>
                  <textarea
                    className="flex min-h-[60px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    placeholder="Additional notes..."
                    {...register('notes')}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <DialogFooter className="border-t p-4 gap-2">
            {currentStep > 0 && (
              <Button type="button" variant="ghost" onClick={() => setCurrentStep(s => s - 1)} className="mr-auto">
                <ChevronLeft className="mr-1 h-4 w-4" />
                Back
              </Button>
            )}
            <Button type="button" variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            {currentStep < STEPS.length - 1 ? (
              <Button
                type="button"
                onClick={() => setCurrentStep(s => s + 1)}
                disabled={!canGoNext()}
              >
                Next
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            ) : (
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating...</>
                ) : (
                  'Create PO'
                )}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
