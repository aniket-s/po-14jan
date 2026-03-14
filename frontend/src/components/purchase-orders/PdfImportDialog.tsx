'use client';

import { useState, useCallback } from 'react';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  FileUp,
  Loader2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Trash2,
  ArrowLeft,
  ArrowRight,
  Eye,
  Plus,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { analyzePdfForPOImport, createPOFromPdf } from '@/services/styles';
import api from '@/lib/api';
import type {
  PdfAnalysisResult,
  PdfParsedStyle,
  PdfCreatePORequest,
  PdfCreatePOResult,
} from '@/types';
import { CreateRetailerDialog } from '@/components/master-data/CreateRetailerDialog';
import { CreateSeasonDialog } from '@/components/master-data/CreateSeasonDialog';
import { CreateWarehouseDialog } from '@/components/master-data/CreateWarehouseDialog';
import { CreateCountryDialog } from '@/components/master-data/CreateCountryDialog';
import { CreateCurrencyDialog } from '@/components/master-data/CreateCurrencyDialog';
import { CreatePaymentTermDialog } from '@/components/master-data/CreatePaymentTermDialog';
import { CreateBuyerDialog } from '@/components/master-data/CreateBuyerDialog';
import { CreateAgentDialog } from '@/components/master-data/CreateAgentDialog';

interface PdfImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: () => void;
  masterData: {
    currencies: any[];
    paymentTerms: any[];
    seasons: any[];
    retailers: any[];
    countries: any[];
    warehouses: any[];
    buyers: any[];
    agents: any[];
  };
  onRefreshMasterData?: () => void;
}

type Step = 'upload' | 'review-header' | 'review-styles' | 'confirm' | 'result';

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'matched':
      return <Badge variant="default" className="bg-green-600 text-xs"><CheckCircle className="h-3 w-3 mr-1" />Matched</Badge>;
    case 'parsed':
      return <Badge variant="secondary" className="text-xs"><CheckCircle className="h-3 w-3 mr-1" />Parsed</Badge>;
    case 'unrecognized':
      return <Badge variant="outline" className="border-yellow-500 text-yellow-600 text-xs"><AlertTriangle className="h-3 w-3 mr-1" />Needs Review</Badge>;
    case 'missing':
      return <Badge variant="outline" className="border-red-400 text-red-500 text-xs"><XCircle className="h-3 w-3 mr-1" />Missing</Badge>;
    default:
      return null;
  }
}

export function PdfImportDialog({
  isOpen,
  onClose,
  onImportComplete,
  masterData,
  onRefreshMasterData,
}: PdfImportDialogProps) {
  const [step, setStep] = useState<Step>('upload');
  const [isUploading, setIsUploading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<PdfAnalysisResult | null>(null);
  const [createResult, setCreateResult] = useState<PdfCreatePOResult | null>(null);

  // Editable form state for PO header
  const [headerForm, setHeaderForm] = useState<Record<string, any>>({});
  // Editable form state for styles
  const [stylesForm, setStylesForm] = useState<Array<Record<string, any>>>([]);

  // Create dialog states
  const [isCreateRetailerOpen, setIsCreateRetailerOpen] = useState(false);
  const [isCreateSeasonOpen, setIsCreateSeasonOpen] = useState(false);
  const [isCreateCurrencyOpen, setIsCreateCurrencyOpen] = useState(false);
  const [isCreatePaymentTermOpen, setIsCreatePaymentTermOpen] = useState(false);
  const [isCreateCountryOpen, setIsCreateCountryOpen] = useState(false);
  const [isCreateWarehouseOpen, setIsCreateWarehouseOpen] = useState(false);
  const [isCreateBuyerOpen, setIsCreateBuyerOpen] = useState(false);
  const [isCreateAgentOpen, setIsCreateAgentOpen] = useState(false);

  // Raw text viewer toggle
  const [showRawText, setShowRawText] = useState(false);

  // Payment terms structured state
  const [paymentTermCode, setPaymentTermCode] = useState<string>('');
  const [paymentPercentage, setPaymentPercentage] = useState<string>('');

  // Sample schedule state
  const [sampleSchedule, setSampleSchedule] = useState<Record<string, string>>({});

  const resetState = useCallback(() => {
    setStep('upload');
    setIsUploading(false);
    setIsCreating(false);
    setError(null);
    setAnalysisResult(null);
    setCreateResult(null);
    setHeaderForm({});
    setStylesForm([]);
    setPaymentTermCode('');
    setPaymentPercentage('');
    setSampleSchedule({});
    setShowRawText(false);
  }, []);

  const handleClose = () => {
    resetState();
    onClose();
  };

  // Helper: get sailing days for selected country
  const getSelectedCountrySailingDays = (): number => {
    if (!headerForm.country_id) return 0;
    const country = masterData.countries.find(
      (c: any) => String(c.id) === String(headerForm.country_id)
    );
    return country?.sailing_time_days || 0;
  };

  // FOB date calculation: ETD -> auto-calculate Ex-Factory, ETA, IHD
  const handleEtdChange = (etdDate: string) => {
    updateHeader('etd_date', etdDate);
    if (!etdDate) return;

    const shippingTerm = headerForm.shipping_term || 'FOB';
    if (shippingTerm === 'FOB') {
      // Ex-Factory = ETD - 7 days
      const exFactory = new Date(etdDate);
      exFactory.setDate(exFactory.getDate() - 7);
      updateHeader('ex_factory_date', exFactory.toISOString().split('T')[0]);

      // ETA = ETD + sailing time
      const sailingDays = getSelectedCountrySailingDays();
      const eta = new Date(etdDate);
      eta.setDate(eta.getDate() + sailingDays);
      updateHeader('eta_date', eta.toISOString().split('T')[0]);

      // IHD = ETA + 5 days
      const ihd = new Date(eta);
      ihd.setDate(ihd.getDate() + 5);
      updateHeader('in_warehouse_date', ihd.toISOString().split('T')[0]);
    }
  };

  // DDP date calculation: In-Warehouse -> auto-calculate ETD, ETA
  const handleInWarehouseChange = (inWarehouseDate: string) => {
    updateHeader('in_warehouse_date', inWarehouseDate);
    if (!inWarehouseDate) return;

    const shippingTerm = headerForm.shipping_term || 'FOB';
    if (shippingTerm === 'DDP') {
      const sailingDays = getSelectedCountrySailingDays();
      // ETD = In-Warehouse - sailing - 5 days
      const etd = new Date(inWarehouseDate);
      etd.setDate(etd.getDate() - sailingDays - 5);
      updateHeader('etd_date', etd.toISOString().split('T')[0]);

      // ETA = ETD + sailing
      const eta = new Date(etd);
      eta.setDate(eta.getDate() + sailingDays);
      updateHeader('eta_date', eta.toISOString().split('T')[0]);

      // Ex-Factory = ETD - 7 days
      const exFactory = new Date(etd);
      exFactory.setDate(exFactory.getDate() - 7);
      updateHeader('ex_factory_date', exFactory.toISOString().split('T')[0]);
    }
  };

  // Recalculate dates when country changes (updates sailing time)
  const handleCountryChange = (countryId: string) => {
    updateHeader('country_id', countryId);
    const country = masterData.countries.find(
      (c: any) => String(c.id) === countryId
    );
    const sailingDays = country?.sailing_time_days || 0;

    const shippingTerm = headerForm.shipping_term || 'FOB';
    if (shippingTerm === 'FOB' && headerForm.etd_date) {
      const eta = new Date(headerForm.etd_date);
      eta.setDate(eta.getDate() + sailingDays);
      setHeaderForm(prev => ({
        ...prev,
        country_id: countryId,
        eta_date: eta.toISOString().split('T')[0],
        in_warehouse_date: new Date(eta.getTime() + 5 * 86400000).toISOString().split('T')[0],
      }));
    } else if (shippingTerm === 'DDP' && headerForm.in_warehouse_date) {
      const etd = new Date(headerForm.in_warehouse_date);
      etd.setDate(etd.getDate() - sailingDays - 5);
      const eta = new Date(etd);
      eta.setDate(eta.getDate() + sailingDays);
      setHeaderForm(prev => ({
        ...prev,
        country_id: countryId,
        etd_date: etd.toISOString().split('T')[0],
        eta_date: eta.toISOString().split('T')[0],
      }));
    } else {
      // Just update country_id
    }
  };

  // Auto-generate sample schedule from PO date + ETD
  const handleGenerateSampleSchedule = async () => {
    const poDate = headerForm.po_date;
    const etdDate = headerForm.etd_date;
    if (!poDate || !etdDate) {
      setError('Please set PO Date and ETD Date before generating the sample schedule');
      return;
    }
    try {
      const response = await api.post('/purchase-orders/sample-schedule', {
        po_date: poDate,
        etd_date: etdDate,
      });
      if (response.data?.schedule) {
        const schedule = response.data.schedule;
        const formatDate = (dateString: string) => dateString ? dateString.split('T')[0] : '';
        const newSchedule: Record<string, string> = {
          lab_dip_submission: formatDate(schedule.lab_dip?.date || ''),
          fit_sample_submission: formatDate(schedule.fit_samples?.date || ''),
          trim_approvals: formatDate(schedule.trim_approvals?.date || ''),
          first_proto_submission: formatDate(schedule.first_proto_samples?.date || ''),
          bulk_fabric_inhouse: formatDate(schedule.bulk_fabric_inhouse?.date || ''),
          pp_sample_submission: formatDate(schedule.pp_sample?.date || ''),
          production_start: formatDate(schedule.production_start?.date || ''),
          top_approval: formatDate(schedule.top_approval?.date || ''),
        };
        setSampleSchedule(newSchedule);
      }
    } catch {
      setError('Failed to generate sample schedule');
    }
  };

  // Step 1: Upload and analyze PDF
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      setError('Please select a PDF file');
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      setError('File size must be less than 20MB');
      return;
    }

    setIsUploading(true);
    setError(null);

    try {
      const result = await analyzePdfForPOImport(file);
      setAnalysisResult(result);

      // Initialize editable header form from parsed data
      const header: Record<string, any> = {};
      if (result.parsed_data?.po_header) {
        const ph = result.parsed_data.po_header;
        header.po_number = ph.po_number?.value || '';
        header.po_date = ph.po_date?.value || new Date().toISOString().split('T')[0];
        header.headline = '';
        header.retailer_id = ph.retailer_id?.value || '';
        header.season_id = ph.season_id?.value || '';
        header.currency_id = ph.currency_id?.value || '';
        header.payment_term_id = ph.payment_term_id?.value || '';
        header.country_id = ph.country_id?.value || '';
        header.warehouse_id = ph.warehouse_id?.value || '';
        header.shipping_term = ph.shipping_term?.value || 'FOB';
        header.ship_to = ph.ship_to?.value || '';
        header.ship_to_address = ph.ship_to_address?.value || '';
        header.country_of_origin = ph.country_of_origin?.value || '';
        header.etd_date = ph.etd_date?.value || '';
        header.ex_factory_date = ph.ex_factory_date?.value || '';
        header.eta_date = ph.eta_date?.value || '';
        header.in_warehouse_date = ph.in_warehouse_date?.value || '';
        header.packing_method = ph.packing_method?.value || '';
        header.packing_guidelines = ph.packing_guidelines?.value || '';
        header.other_terms = ph.other_terms?.value || '';
        header.additional_notes = ph.additional_notes?.value || '';
        header.revision_number = ph.revision_number?.value || 1;
        header.buyer_id = ph.buyer_id?.value || '';
        header.agency_id = ph.agency_id?.value || '';
        // Informational fields (not submitted, just shown)
        header._vendor_name = ph.vendor_name?.value || '';
        header._buyer_name = ph.buyer_name?.value || '';
        header._agent_name = ph.agent_name?.value || '';
        header._customer_name = ph.customer_name?.value || '';
        header._department = ph.department?.value || '';
        header._division = ph.division?.value || '';
        header._packing_type = (ph.packing_method as any)?.packing_type || null;
      }
      // For DDP: auto-calculate ETD, ETA, Ex-Factory from In-Warehouse Date and country sailing time
      if (header.shipping_term === 'DDP' && header.in_warehouse_date && header.country_id) {
        const country = masterData.countries.find(
          (c: any) => String(c.id) === String(header.country_id)
        );
        const sailingDays = country?.sailing_time_days || 0;
        if (sailingDays > 0) {
          const ihd = new Date(header.in_warehouse_date);
          // ETD = IHD - sailing - 5 days
          const etd = new Date(ihd);
          etd.setDate(etd.getDate() - sailingDays - 5);
          header.etd_date = etd.toISOString().split('T')[0];
          // ETA = IHD - 5 days (or ETD + sailing)
          const eta = new Date(etd);
          eta.setDate(eta.getDate() + sailingDays);
          header.eta_date = eta.toISOString().split('T')[0];
          // Ex-Factory = ETD - 7 days
          const exFactory = new Date(etd);
          exFactory.setDate(exFactory.getDate() - 7);
          header.ex_factory_date = exFactory.toISOString().split('T')[0];
        }
      }

      setHeaderForm(header);

      // Initialize editable styles form from parsed data
      const styles = (result.parsed_data?.styles || []).map((s: PdfParsedStyle, idx: number) => {
        const prepack = (s as any).prepack || null;
        const hasPrepack = prepack !== null;
        return {
          _id: idx,
          style_number: s.style_number?.value || '',
          description: s.description?.value || '',
          color_name: s.color_name?.value || '',
          size_breakdown: s.size_breakdown?.value || {},
          size_breakdown_source: (s.size_breakdown as any)?.source || 'pdf',
          packing_method: hasPrepack ? 'prepack' : 'solid' as 'solid' | 'prepack',
          ratio: hasPrepack ? prepack.ratio : {} as Record<string, number>,
          packs_count: hasPrepack ? prepack.packs : 0,
          prepack_code: hasPrepack ? prepack.prepack_code : null,
          total_per_pack: hasPrepack ? prepack.total_per_pack : 0,
          quantity: s.quantity?.value || 0,
          unit_price: s.unit_price?.value || 0,
          total_amount: s.total_amount?.value || 0,
        };
      });
      setStylesForm(styles);

      setStep('review-header');
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to analyze PDF');
    } finally {
      setIsUploading(false);
    }
  };

  // Update header form field
  const updateHeader = (field: string, value: any) => {
    setHeaderForm(prev => ({ ...prev, [field]: value }));
  };

  // Update style form field
  const updateStyle = (index: number, field: string, value: any) => {
    setStylesForm(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      // Recalculate total_amount when quantity or unit_price changes
      if (field === 'quantity' || field === 'unit_price') {
        const qty = field === 'quantity' ? Number(value) : Number(updated[index].quantity);
        const price = field === 'unit_price' ? Number(value) : Number(updated[index].unit_price);
        updated[index].total_amount = Math.round(qty * price * 100) / 100;
      }
      // Recalculate prepack breakdown when quantity changes and packing_method is prepack
      if (field === 'quantity' && updated[index].packing_method === 'prepack') {
        const ratio = updated[index].ratio || {};
        const ratioKeys = Object.keys(ratio);
        if (ratioKeys.length > 0) {
          const unitsPerPack = Object.values(ratio).reduce((sum: number, r: any) => sum + Number(r), 0);
          const qty = Number(value);
          if (unitsPerPack > 0 && qty > 0) {
            const packs = qty / unitsPerPack;
            updated[index].packs_count = packs;
            if (Number.isInteger(packs)) {
              const breakdown: Record<string, number> = {};
              ratioKeys.forEach(size => { breakdown[size] = Number(ratio[size]) * packs; });
              updated[index].size_breakdown = breakdown;
            }
          }
        }
      }
      // Recalculate breakdown when ratio changes
      if (field === 'ratio' && updated[index].packing_method === 'prepack') {
        const ratio = value as Record<string, number>;
        const qty = Number(updated[index].quantity);
        const unitsPerPack = Object.values(ratio).reduce((sum: number, r: any) => sum + Number(r), 0);
        if (unitsPerPack > 0 && qty > 0) {
          const packs = qty / unitsPerPack;
          updated[index].packs_count = packs;
          updated[index].total_per_pack = unitsPerPack;
          if (Number.isInteger(packs)) {
            const breakdown: Record<string, number> = {};
            Object.keys(ratio).forEach(size => { breakdown[size] = Number(ratio[size]) * packs; });
            updated[index].size_breakdown = breakdown;
          }
        }
      }
      return updated;
    });
  };

  // Remove a style row
  const removeStyle = (index: number) => {
    setStylesForm(prev => prev.filter((_, i) => i !== index));
  };

  // Calculate totals from styles form
  const calculatedTotals = {
    quantity: stylesForm.reduce((sum, s) => sum + Number(s.quantity || 0), 0),
    value: stylesForm.reduce((sum, s) => sum + Number(s.total_amount || 0), 0),
  };

  // Check if any styles have price = 0
  const zeroPriceCount = stylesForm.filter(s => Number(s.unit_price) === 0).length;

  // Detect duplicate style+color combinations (same style in different colors is valid)
  const duplicateStyleNumbers = (() => {
    const counts: Record<string, number> = {};
    stylesForm.forEach(s => {
      const sn = (s.style_number || '').trim().toUpperCase();
      const color = (s.color_name || '').trim().toUpperCase();
      const key = color ? `${sn}|${color}` : sn;
      if (sn) counts[key] = (counts[key] || 0) + 1;
    });
    return Object.entries(counts).filter(([, c]) => c > 1).map(([key]) => key.replace('|', ' / '));
  })();

  // Validate size breakdown sums match quantity
  const sizeBreakdownMismatches = stylesForm
    .map((s, idx) => {
      if (s.size_breakdown && typeof s.size_breakdown === 'object' && Object.keys(s.size_breakdown).length > 0) {
        const sizeSum = Object.values(s.size_breakdown as Record<string, number>).reduce((a: number, b: number) => a + Number(b), 0);
        const qty = Number(s.quantity || 0);
        if (sizeSum > 0 && qty > 0 && sizeSum !== qty) {
          return { index: idx, style_number: s.style_number, sizeSum, qty };
        }
      }
      return null;
    })
    .filter(Boolean) as Array<{ index: number; style_number: string; sizeSum: number; qty: number }>;

  // Header validation for required fields
  const headerValidationErrors: string[] = [];
  if (!headerForm.po_number?.trim()) headerValidationErrors.push('PO Number is required');
  if (!headerForm.po_date) headerValidationErrors.push('PO Date is required');

  // Style-level validation
  const stylesValidationErrors: string[] = [];
  stylesForm.forEach((s, idx) => {
    if (!s.style_number?.trim()) stylesValidationErrors.push(`Row ${idx + 1}: Style number is required`);
    if (Number(s.quantity || 0) <= 0) stylesValidationErrors.push(`Row ${idx + 1} (${s.style_number || '?'}): Quantity must be greater than 0`);
  });
  if (duplicateStyleNumbers.length > 0) {
    stylesValidationErrors.push(`Duplicate style/color combinations: ${duplicateStyleNumbers.join(', ')}`);
  }
  if (sizeBreakdownMismatches.length > 0) {
    sizeBreakdownMismatches.forEach(m => {
      stylesValidationErrors.push(`Row ${m.index + 1} (${m.style_number}): size breakdown total (${m.sizeSum}) does not match quantity (${m.qty})`);
    });
  }

  // Step 4: Create PO
  const handleCreatePO = async () => {
    setIsCreating(true);
    setError(null);

    try {
      // Build payment_terms_structured if a payment term code is selected
      let paymentTermsStructured: { term: string; percentage?: number } | undefined;
      if (paymentTermCode) {
        paymentTermsStructured = { term: paymentTermCode };
        if (paymentPercentage) {
          paymentTermsStructured.percentage = parseFloat(paymentPercentage);
        }
      }

      // Build sample_schedule if any dates are set
      const hasScheduleDates = Object.values(sampleSchedule).some(v => v);
      const sampleScheduleData = hasScheduleDates ? sampleSchedule : undefined;

      const request: PdfCreatePORequest = {
        po_header: {
          po_number: headerForm.po_number,
          po_date: headerForm.po_date,
          headline: headerForm.headline || undefined,
          retailer_id: headerForm.retailer_id ? Number(headerForm.retailer_id) : null,
          season_id: headerForm.season_id ? Number(headerForm.season_id) : null,
          currency_id: headerForm.currency_id ? Number(headerForm.currency_id) : null,
          payment_term_id: headerForm.payment_term_id ? Number(headerForm.payment_term_id) : null,
          country_id: headerForm.country_id ? Number(headerForm.country_id) : null,
          warehouse_id: headerForm.warehouse_id ? Number(headerForm.warehouse_id) : null,
          buyer_id: headerForm.buyer_id ? Number(headerForm.buyer_id) : null,
          agency_id: headerForm.agency_id ? Number(headerForm.agency_id) : null,
          shipping_term: headerForm.shipping_term || 'FOB',
          ship_to: headerForm.ship_to || undefined,
          ship_to_address: headerForm.ship_to_address || undefined,
          country_of_origin: headerForm.country_of_origin || undefined,
          etd_date: headerForm.etd_date || undefined,
          ex_factory_date: headerForm.ex_factory_date || undefined,
          eta_date: headerForm.eta_date || undefined,
          in_warehouse_date: headerForm.in_warehouse_date || undefined,
          packing_method: headerForm.packing_method || undefined,
          packing_guidelines: headerForm.packing_guidelines || undefined,
          other_terms: headerForm.other_terms || undefined,
          additional_notes: headerForm.additional_notes || undefined,
          revision_number: headerForm.revision_number ? Number(headerForm.revision_number) : undefined,
          payment_terms_structured: paymentTermsStructured,
          sample_schedule: sampleScheduleData,
        },
        styles: stylesForm.map(s => ({
          style_number: s.style_number,
          description: s.description || undefined,
          color_name: s.color_name || undefined,
          size_breakdown: s.size_breakdown && Object.keys(s.size_breakdown).length > 0 ? s.size_breakdown : null,
          ratio: s.packing_method === 'prepack' && s.ratio && Object.keys(s.ratio).length > 0 ? s.ratio : undefined,
          packing_method: s.packing_method || 'solid',
          quantity: Number(s.quantity),
          unit_price: Number(s.unit_price),
        })),
        temp_file_path: analysisResult?.temp_file_path,
      };

      const result = await createPOFromPdf(request);
      setCreateResult(result);
      setStep('result');
    } catch (err: any) {
      const errors = err.response?.data?.errors;
      if (errors) {
        const messages = Object.values(errors).flat().join(', ');
        setError(messages);
      } else {
        setError(err.response?.data?.message || err.message || 'Failed to create purchase order');
      }
    } finally {
      setIsCreating(false);
    }
  };

  const getFieldStatus = (fieldName: string): string => {
    return analysisResult?.parsed_data?.po_header?.[fieldName]?.status || 'missing';
  };

  const handleMasterDataCreated = () => {
    if (onRefreshMasterData) {
      onRefreshMasterData();
    }
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {step === 'upload' && 'Import Purchase Order from PDF'}
              {step === 'review-header' && 'Review PO Header Details'}
              {step === 'review-styles' && 'Review Line Items / Styles'}
              {step === 'confirm' && 'Confirm & Create Purchase Order'}
              {step === 'result' && 'Import Result'}
            </DialogTitle>
            <DialogDescription>
              {step === 'upload' && 'Upload a PDF purchase order to automatically extract and create a PO'}
              {step === 'review-header' && 'Review and correct the extracted PO header information'}
              {step === 'review-styles' && 'Review and edit the extracted line items before creating'}
              {step === 'confirm' && 'Review the final summary and create the purchase order'}
              {step === 'result' && 'Purchase order creation result'}
            </DialogDescription>
          </DialogHeader>

          {/* AI Analysis Method Indicator */}
          {analysisResult?.analysis_method && step !== 'upload' && step !== 'result' && (
            <div className="flex items-center gap-2">
              {analysisResult.analysis_method === 'claude_ai' ? (
                <Badge variant="default" className="bg-indigo-600 text-white text-xs px-2 py-1">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Analyzed with Claude AI
                </Badge>
              ) : (
                <Badge variant="secondary" className="text-xs px-2 py-1">
                  Analyzed with text parser
                </Badge>
              )}
            </div>
          )}

          {/* Warnings */}
          {analysisResult?.warnings && analysisResult.warnings.length > 0 && step !== 'upload' && step !== 'result' && (
            <Alert variant="default" className="border-yellow-300 bg-yellow-50">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <AlertDescription>
                <ul className="list-disc list-inside text-sm text-yellow-800 space-y-1">
                  {analysisResult.warnings.map((w, i) => <li key={i}>{w}</li>)}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {/* Raw Extracted Text (collapsible — for debugging parsing issues) */}
          {analysisResult?.raw_text && step !== 'upload' && step !== 'result' && (
            <div className="border rounded-md">
              <button
                type="button"
                className="flex items-center gap-2 w-full px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                onClick={() => setShowRawText(prev => !prev)}
              >
                {showRawText ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                View Raw Extracted Text from PDF
              </button>
              {showRawText && (
                <pre className="px-3 pb-3 text-xs text-muted-foreground whitespace-pre-wrap break-words max-h-[300px] overflow-y-auto border-t bg-muted/20 font-mono">
                  {analysisResult.raw_text}
                </pre>
              )}
            </div>
          )}

          {/* Error */}
          {error && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Step 1: Upload */}
          {step === 'upload' && (
            <div className="space-y-4 py-4">
              <div
                className="border-2 border-dashed rounded-lg p-12 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-colors"
                onClick={() => document.getElementById('pdf-file-input')?.click()}
              >
                {isUploading ? (
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">Analyzing PDF... This may take a moment.</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3">
                    <FileUp className="h-10 w-10 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">Click to select a PDF purchase order file</p>
                      <p className="text-xs text-muted-foreground mt-1">PDF files only, up to 20MB</p>
                    </div>
                  </div>
                )}
                <input
                  id="pdf-file-input"
                  type="file"
                  accept=".pdf,application/pdf"
                  onChange={handleFileUpload}
                  className="hidden"
                  disabled={isUploading}
                />
              </div>
            </div>
          )}

          {/* Step 2: Review PO Header */}
          {step === 'review-header' && (
            <div className="space-y-4 py-2">
              {/* Basic Info */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold">Basic Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  {/* PO Number */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Label>PO Number <span className="text-red-500">*</span></Label>
                      <StatusBadge status={getFieldStatus('po_number')} />
                    </div>
                    <Input
                      value={headerForm.po_number || ''}
                      onChange={(e) => updateHeader('po_number', e.target.value)}
                      placeholder="e.g. PO-2024-001"
                    />
                  </div>

                  {/* PO Date */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Label>PO Date <span className="text-red-500">*</span></Label>
                      <StatusBadge status={getFieldStatus('po_date')} />
                    </div>
                    <Input
                      type="date"
                      value={headerForm.po_date || ''}
                      onChange={(e) => updateHeader('po_date', e.target.value)}
                    />
                  </div>

                  {/* Headline */}
                  <div className="space-y-1">
                    <Label>Headline</Label>
                    <Input
                      value={headerForm.headline || ''}
                      onChange={(e) => updateHeader('headline', e.target.value)}
                      placeholder="Brief description for this PO"
                    />
                  </div>

                  {/* Shipping Term */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Label>Shipping Term</Label>
                      <StatusBadge status={getFieldStatus('shipping_term')} />
                    </div>
                    <Select
                      value={headerForm.shipping_term || ''}
                      onValueChange={(v) => updateHeader('shipping_term', v)}
                    >
                      <SelectTrigger><SelectValue placeholder="Select shipping term" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="FOB">FOB (Free On Board)</SelectItem>
                        <SelectItem value="DDP">DDP (Delivered Duty Paid)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* Master Data with + buttons */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold">Master Data</h3>
                <div className="grid grid-cols-2 gap-4">
                  {/* Retailer */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Label>Retailer</Label>
                      <StatusBadge status={getFieldStatus('retailer_id')} />
                    </div>
                    <div className="flex gap-2">
                      <Select value={String(headerForm.retailer_id || '')} onValueChange={(v) => updateHeader('retailer_id', v)}>
                        <SelectTrigger className="flex-1"><SelectValue placeholder="Select retailer" /></SelectTrigger>
                        <SelectContent>
                          {masterData.retailers.map((r: any) => (
                            <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button type="button" variant="outline" size="icon" onClick={() => setIsCreateRetailerOpen(true)} title="Create new retailer">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Buyer */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Label>Buyer</Label>
                      <StatusBadge status={getFieldStatus('buyer_id')} />
                    </div>
                    <div className="flex gap-2">
                      <Select value={String(headerForm.buyer_id || '')} onValueChange={(v) => updateHeader('buyer_id', v)}>
                        <SelectTrigger className="flex-1"><SelectValue placeholder="Select buyer" /></SelectTrigger>
                        <SelectContent>
                          {masterData.buyers.map((b: any) => (
                            <SelectItem key={b.id} value={String(b.id)}>{b.name}{b.code ? ` (${b.code})` : ''}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button type="button" variant="outline" size="icon" onClick={() => setIsCreateBuyerOpen(true)} title="Create new buyer">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    {headerForm._buyer_name && getFieldStatus('buyer_id') === 'unrecognized' && (
                      <p className="text-xs text-yellow-600">Buyer &quot;{headerForm._buyer_name}&quot; not found in system. Click + to create.</p>
                    )}
                  </div>

                  {/* Agent */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Label>Agent</Label>
                      <StatusBadge status={getFieldStatus('agency_id')} />
                    </div>
                    <div className="flex gap-2">
                      <Select value={String(headerForm.agency_id || '')} onValueChange={(v) => updateHeader('agency_id', v)}>
                        <SelectTrigger className="flex-1"><SelectValue placeholder="Select agent" /></SelectTrigger>
                        <SelectContent>
                          {(masterData.agents || []).map((a: any) => (
                            <SelectItem key={a.id} value={String(a.id)}>{a.name}{a.company ? ` (${a.company})` : ''}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button type="button" variant="outline" size="icon" onClick={() => setIsCreateAgentOpen(true)} title="Create new agent">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    {headerForm._agent_name && getFieldStatus('agency_id') === 'unrecognized' && (
                      <p className="text-xs text-yellow-600">Agent &quot;{headerForm._agent_name}&quot; not found in system. Click + to create.</p>
                    )}
                  </div>

                  {/* Season */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Label>Season</Label>
                      <StatusBadge status={getFieldStatus('season_id')} />
                    </div>
                    <div className="flex gap-2">
                      <Select value={String(headerForm.season_id || '')} onValueChange={(v) => updateHeader('season_id', v)}>
                        <SelectTrigger className="flex-1"><SelectValue placeholder="Select season" /></SelectTrigger>
                        <SelectContent>
                          {masterData.seasons.map((s: any) => (
                            <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button type="button" variant="outline" size="icon" onClick={() => setIsCreateSeasonOpen(true)} title="Create new season">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Currency */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Label>Currency</Label>
                      <StatusBadge status={getFieldStatus('currency_id')} />
                    </div>
                    <div className="flex gap-2">
                      <Select value={String(headerForm.currency_id || '')} onValueChange={(v) => updateHeader('currency_id', v)}>
                        <SelectTrigger className="flex-1"><SelectValue placeholder="Select currency" /></SelectTrigger>
                        <SelectContent>
                          {masterData.currencies.map((c: any) => (
                            <SelectItem key={c.id} value={String(c.id)}>{c.code} - {c.name} {c.symbol && `(${c.symbol})`}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button type="button" variant="outline" size="icon" onClick={() => setIsCreateCurrencyOpen(true)} title="Create new currency">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Country of Origin */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Label>Country of Origin</Label>
                      <StatusBadge status={getFieldStatus('country_id')} />
                    </div>
                    <div className="flex gap-2">
                      <Select value={String(headerForm.country_id || '')} onValueChange={handleCountryChange}>
                        <SelectTrigger className="flex-1"><SelectValue placeholder="Select country" /></SelectTrigger>
                        <SelectContent>
                          {masterData.countries.map((c: any) => (
                            <SelectItem key={c.id} value={String(c.id)}>{c.name} ({c.sailing_time_days} days)</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button type="button" variant="outline" size="icon" onClick={() => setIsCreateCountryOpen(true)} title="Create new country">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Warehouse */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Label>Warehouse</Label>
                      <StatusBadge status={getFieldStatus('warehouse_id')} />
                    </div>
                    <div className="flex gap-2">
                      <Select value={String(headerForm.warehouse_id || '')} onValueChange={(v) => updateHeader('warehouse_id', v)}>
                        <SelectTrigger className="flex-1"><SelectValue placeholder="Select warehouse" /></SelectTrigger>
                        <SelectContent>
                          {masterData.warehouses.map((w: any) => (
                            <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button type="button" variant="outline" size="icon" onClick={() => setIsCreateWarehouseOpen(true)} title="Create new warehouse">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Ship To */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Label>Ship To</Label>
                      <StatusBadge status={getFieldStatus('ship_to')} />
                    </div>
                    <Input
                      value={headerForm.ship_to || ''}
                      onChange={(e) => updateHeader('ship_to', e.target.value)}
                      placeholder="Ship to location"
                    />
                  </div>
                </div>
              </div>

              {/* Payment Terms (Structured: term + percentage) */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold">Payment Terms</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label>Payment Term</Label>
                    <div className="flex gap-2">
                      <Select
                        value={paymentTermCode}
                        onValueChange={(value) => {
                          setPaymentTermCode(value);
                          // Also set payment_term_id from the matching term
                          const pt = masterData.paymentTerms.find((p: any) => p.code === value);
                          if (pt) {
                            updateHeader('payment_term_id', String(pt.id));
                          }
                        }}
                      >
                        <SelectTrigger className="flex-1"><SelectValue placeholder="Select term" /></SelectTrigger>
                        <SelectContent>
                          {masterData.paymentTerms.map((pt: any) => (
                            <SelectItem key={pt.id} value={pt.code}>
                              {pt.name}{pt.days ? ` (${pt.days} days)` : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button type="button" variant="outline" size="icon" onClick={() => setIsCreatePaymentTermOpen(true)} title="Create new payment term">
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  {/* Show percentage field if the selected payment term requires it */}
                  {masterData.paymentTerms.find((pt: any) => pt.code === paymentTermCode)?.requires_percentage && (
                    <div className="space-y-1">
                      <Label>Percentage (%)</Label>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        placeholder="e.g. 30"
                        value={paymentPercentage}
                        onChange={(e) => setPaymentPercentage(e.target.value)}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Dates with FOB/DDP logic */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold">Important Dates</h3>

                {(headerForm.shipping_term || 'FOB') === 'FOB' && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Label>ETD Date (Ship Date) *</Label>
                          <StatusBadge status={getFieldStatus('etd_date')} />
                        </div>
                        <Input
                          type="date"
                          value={headerForm.etd_date || ''}
                          onChange={(e) => handleEtdChange(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">Enter ETD to auto-calculate other dates</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-1">
                        <Label>Ex-Factory (ETD - 7 days)</Label>
                        <Input type="date" value={headerForm.ex_factory_date || ''} disabled className="bg-muted" />
                      </div>
                      <div className="space-y-1">
                        <Label>ETA (ETD + Sailing)</Label>
                        <Input type="date" value={headerForm.eta_date || ''} disabled className="bg-muted" />
                        {headerForm.country_id && (
                          <p className="text-xs text-muted-foreground">+{getSelectedCountrySailingDays()} sailing days</p>
                        )}
                      </div>
                      <div className="space-y-1">
                        <Label>IHD (ETA + 5 days)</Label>
                        <Input type="date" value={headerForm.in_warehouse_date || ''} disabled className="bg-muted" />
                      </div>
                    </div>
                  </div>
                )}

                {headerForm.shipping_term === 'DDP' && (
                  <div className="grid grid-cols-4 gap-4">
                    <div className="space-y-1">
                      <Label>In-Warehouse Date *</Label>
                      <Input
                        type="date"
                        value={headerForm.in_warehouse_date || ''}
                        onChange={(e) => handleInWarehouseChange(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>ETD (Auto)</Label>
                      <Input type="date" value={headerForm.etd_date || ''} disabled className="bg-muted" />
                      <p className="text-xs text-muted-foreground">= IHD - Sailing - 5d</p>
                    </div>
                    <div className="space-y-1">
                      <Label>ETA (Auto)</Label>
                      <Input type="date" value={headerForm.eta_date || ''} disabled className="bg-muted" />
                    </div>
                    <div className="space-y-1">
                      <Label>Ex-Factory (Auto)</Label>
                      <Input type="date" value={headerForm.ex_factory_date || ''} disabled className="bg-muted" />
                    </div>
                  </div>
                )}
              </div>

              {/* Sample Schedule */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Sample Schedule (8 Milestones)</h3>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleGenerateSampleSchedule}
                    disabled={!headerForm.po_date || !headerForm.etd_date}
                  >
                    Auto-Generate Schedule
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Based on PO Date and ETD Date</p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label>Lab Dip Submission</Label>
                    <Input type="date" value={sampleSchedule.lab_dip_submission || ''} disabled className="bg-muted" />
                  </div>
                  <div className="space-y-1">
                    <Label>Fit Sample Submission</Label>
                    <Input type="date" value={sampleSchedule.fit_sample_submission || ''} disabled className="bg-muted" />
                  </div>
                  <div className="space-y-1">
                    <Label>Trim Approvals</Label>
                    <Input type="date" value={sampleSchedule.trim_approvals || ''} disabled className="bg-muted" />
                  </div>
                  <div className="space-y-1">
                    <Label>1st Proto Submission</Label>
                    <Input type="date" value={sampleSchedule.first_proto_submission || ''} disabled className="bg-muted" />
                  </div>
                  <div className="space-y-1">
                    <Label>Bulk Fabric Inhouse</Label>
                    <Input type="date" value={sampleSchedule.bulk_fabric_inhouse || ''} disabled className="bg-muted" />
                  </div>
                  <div className="space-y-1">
                    <Label>PP Sample Submission</Label>
                    <Input type="date" value={sampleSchedule.pp_sample_submission || ''} disabled className="bg-muted" />
                  </div>
                  <div className="space-y-1">
                    <Label>Production Start</Label>
                    <Input type="date" value={sampleSchedule.production_start || ''} disabled className="bg-muted" />
                  </div>
                  <div className="space-y-1">
                    <Label>TOP Approval</Label>
                    <Input type="date" value={sampleSchedule.top_approval || ''} disabled className="bg-muted" />
                  </div>
                </div>
              </div>

              {/* Additional Info */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold">Additional Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  {/* Packing Method with type badge */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Label>Packing Method</Label>
                      <StatusBadge status={getFieldStatus('packing_method')} />
                      {headerForm._packing_type && (
                        <Badge variant="secondary" className="text-xs">
                          {headerForm._packing_type === 'prepack' ? 'Prepack' : headerForm._packing_type === 'solid' ? 'Solid Pack' : 'Other'}
                        </Badge>
                      )}
                    </div>
                    <Input
                      value={headerForm.packing_method || ''}
                      onChange={(e) => updateHeader('packing_method', e.target.value)}
                      placeholder="e.g. 8PREPACK INTO 1 POLYBAG"
                    />
                  </div>

                  {/* Country of Origin text */}
                  <div className="space-y-1">
                    <Label>Country of Origin (text)</Label>
                    <Input
                      value={headerForm.country_of_origin || ''}
                      onChange={(e) => updateHeader('country_of_origin', e.target.value)}
                      placeholder="e.g. China, India, Bangladesh"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label>Packing Guidelines</Label>
                  <Textarea
                    value={headerForm.packing_guidelines || ''}
                    onChange={(e) => updateHeader('packing_guidelines', e.target.value)}
                    placeholder="Packing guidelines and instructions..."
                    rows={2}
                  />
                </div>

                <div className="space-y-1">
                  <Label>Other Terms & Conditions</Label>
                  <Textarea
                    value={headerForm.other_terms || ''}
                    onChange={(e) => updateHeader('other_terms', e.target.value)}
                    placeholder="e.g. Partial shipping is not allowed..."
                    rows={2}
                  />
                </div>

                <div className="space-y-1">
                  <Label>Additional Notes</Label>
                  <Textarea
                    value={headerForm.additional_notes || ''}
                    onChange={(e) => updateHeader('additional_notes', e.target.value)}
                    placeholder="Any special instructions or notes"
                    rows={2}
                  />
                </div>
              </div>

              {/* Informational: Extracted entities from PDF */}
              {(headerForm._vendor_name || headerForm._buyer_name || headerForm._agent_name || headerForm._customer_name) && (
                <Card className="bg-muted/30">
                  <CardHeader className="py-2 px-4">
                    <CardTitle className="text-sm">Extracted Reference Info from PDF</CardTitle>
                  </CardHeader>
                  <CardContent className="py-2 px-4 grid grid-cols-2 gap-2 text-sm">
                    {headerForm._buyer_name && <div><span className="text-muted-foreground">Buyer (PO Issuer):</span> {headerForm._buyer_name}</div>}
                    {headerForm._customer_name && <div><span className="text-muted-foreground">Retailer (CUST):</span> {headerForm._customer_name}</div>}
                    {headerForm._agent_name && <div><span className="text-muted-foreground">Agent (Vendor):</span> {headerForm._agent_name}</div>}
                    {headerForm._vendor_name && !headerForm._agent_name && <div><span className="text-muted-foreground">Vendor:</span> {headerForm._vendor_name}</div>}
                    {headerForm._department && <div><span className="text-muted-foreground">Department:</span> {headerForm._department}</div>}
                    {headerForm._division && <div><span className="text-muted-foreground">Division:</span> {headerForm._division}</div>}
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* Step 3: Review Styles */}
          {step === 'review-styles' && (
            <div className="space-y-4 py-2">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {stylesForm.length} style(s) extracted. Edit any values below.
                </p>
                <div className="text-sm font-medium">
                  Total: {calculatedTotals.quantity} pcs | ${calculatedTotals.value.toFixed(2)}
                </div>
              </div>

              {/* Price = 0 warning */}
              {zeroPriceCount > 0 && (
                <Alert variant="default" className="border-orange-300 bg-orange-50">
                  <AlertTriangle className="h-4 w-4 text-orange-600" />
                  <AlertDescription className="text-orange-800">
                    <strong>{zeroPriceCount} style(s) have price $0.00.</strong> Please ask the importer or agency to fill in the price manually. Rows are highlighted below.
                  </AlertDescription>
                </Alert>
              )}

              {/* Duplicate style numbers warning */}
              {duplicateStyleNumbers.length > 0 && (
                <Alert variant="default" className="border-red-300 bg-red-50">
                  <XCircle className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-red-800">
                    <strong>Duplicate style/color combinations detected:</strong> {duplicateStyleNumbers.join(', ')}. Each style + color combination should be unique within a PO.
                  </AlertDescription>
                </Alert>
              )}

              {/* Size breakdown mismatch errors */}
              {sizeBreakdownMismatches.length > 0 && (
                <Alert variant="default" className="border-red-300 bg-red-50">
                  <XCircle className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-red-800">
                    <strong>Size breakdown mismatch:</strong> Edit the size quantities or total quantity to resolve.
                    <ul className="list-disc list-inside mt-1">
                      {sizeBreakdownMismatches.map((m, i) => (
                        <li key={i}>Row {m.index + 1} ({m.style_number}): sizes total {m.sizeSum} but quantity is {m.qty}</li>
                      ))}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              {/* Styles validation errors */}
              {stylesValidationErrors.length > 0 && (
                <Alert variant="destructive">
                  <XCircle className="h-4 w-4" />
                  <AlertDescription>
                    <ul className="list-disc list-inside text-sm">
                      {stylesValidationErrors.map((e, i) => <li key={i}>{e}</li>)}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}

              <div className="max-h-[400px] overflow-auto border rounded">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[40px]">#</TableHead>
                      <TableHead className="min-w-[120px]">Style Number</TableHead>
                      <TableHead className="min-w-[150px]">Description</TableHead>
                      <TableHead className="min-w-[100px]">Color</TableHead>
                      <TableHead className="min-w-[80px]">Packing</TableHead>
                      <TableHead className="min-w-[200px]">Size Breakdown / Ratio</TableHead>
                      <TableHead className="w-[90px] text-right">Qty</TableHead>
                      <TableHead className="w-[100px] text-right">Unit Price</TableHead>
                      <TableHead className="w-[100px] text-right">Total</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stylesForm.map((style, index) => {
                      const isZeroPrice = Number(style.unit_price) === 0;
                      return (
                        <TableRow key={index} className={isZeroPrice ? 'bg-orange-50' : ''}>
                          <TableCell className="text-muted-foreground text-xs">{index + 1}</TableCell>
                          <TableCell>
                            <Input
                              value={style.style_number}
                              onChange={(e) => updateStyle(index, 'style_number', e.target.value)}
                              className="h-8 text-sm"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={style.description}
                              onChange={(e) => updateStyle(index, 'description', e.target.value)}
                              className="h-8 text-sm"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              value={style.color_name}
                              onChange={(e) => updateStyle(index, 'color_name', e.target.value)}
                              className="h-8 text-sm"
                            />
                          </TableCell>
                          {/* Packing Method */}
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              <Button
                                type="button"
                                variant={style.packing_method === 'solid' ? 'default' : 'outline'}
                                size="sm"
                                className="h-6 text-[10px] w-full"
                                onClick={() => updateStyle(index, 'packing_method', 'solid')}
                              >
                                Solid
                              </Button>
                              <Button
                                type="button"
                                variant={style.packing_method === 'prepack' ? 'default' : 'outline'}
                                size="sm"
                                className="h-6 text-[10px] w-full"
                                onClick={() => updateStyle(index, 'packing_method', 'prepack')}
                              >
                                Prepack
                              </Button>
                            </div>
                          </TableCell>
                          {/* Size Breakdown / Ratio */}
                          <TableCell>
                            {style.packing_method === 'prepack' ? (
                              <div className="space-y-1">
                                {style.prepack_code && (
                                  <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-medium text-blue-700">
                                    {style.prepack_code}
                                  </span>
                                )}
                                {/* Ratio inputs */}
                                <div className="flex flex-wrap gap-1">
                                  {Object.entries(style.ratio || {}).map(([size, r]) => (
                                    <div key={size} className="flex items-center gap-0.5 text-xs">
                                      <span className="text-muted-foreground font-medium">{size}:</span>
                                      <Input
                                        type="number"
                                        min={0}
                                        value={r as number}
                                        onChange={(e) => {
                                          const newRatio = { ...style.ratio };
                                          const val = Number(e.target.value) || 0;
                                          if (val === 0) { delete newRatio[size]; } else { newRatio[size] = val; }
                                          updateStyle(index, 'ratio', newRatio);
                                        }}
                                        className="h-6 w-12 text-xs px-1"
                                      />
                                    </div>
                                  ))}
                                </div>
                                {/* Packs & breakdown info */}
                                {(() => {
                                  const ratio = style.ratio || {};
                                  const unitsPerPack = Object.values(ratio).reduce((s: number, r: any) => s + Number(r), 0);
                                  const qty = Number(style.quantity);
                                  if (unitsPerPack === 0 || qty === 0) return null;
                                  const packs = qty / unitsPerPack;
                                  const isValid = Number.isInteger(packs);
                                  return (
                                    <div className={`text-[10px] mt-1 p-1 rounded ${isValid ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                                      <span className="font-medium">{isValid ? `${packs} packs` : `${packs.toFixed(2)} packs (uneven)`}</span>
                                      <span className="text-muted-foreground ml-1">× {unitsPerPack}/pack</span>
                                      {isValid && style.size_breakdown && Object.keys(style.size_breakdown).length > 0 && (
                                        <div className="mt-0.5">
                                          {Object.entries(style.size_breakdown).map(([sz, q]) => `${sz}:${q}`).join(' ')}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })()}
                              </div>
                            ) : (
                              // Solid pack: direct size quantity inputs
                              style.size_breakdown && typeof style.size_breakdown === 'object' && Object.keys(style.size_breakdown).length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {Object.entries(style.size_breakdown).map(([size, qty]) => (
                                    <div key={size} className="flex items-center gap-0.5 text-xs">
                                      <span className="text-muted-foreground">{size}:</span>
                                      <Input
                                        type="number"
                                        min={0}
                                        value={qty as number}
                                        onChange={(e) => {
                                          const newBreakdown = { ...style.size_breakdown, [size]: Number(e.target.value) || 0 };
                                          updateStyle(index, 'size_breakdown', newBreakdown);
                                          const newTotal = Object.values(newBreakdown).reduce((a: number, b) => a + Number(b), 0);
                                          updateStyle(index, 'quantity', newTotal);
                                        }}
                                        className="h-6 w-14 text-xs px-1"
                                      />
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-xs text-muted-foreground italic">None</span>
                              )
                            )}
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min={1}
                              value={style.quantity}
                              onChange={(e) => updateStyle(index, 'quantity', e.target.value)}
                              className="h-8 text-sm text-right"
                            />
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min={0}
                              step="0.01"
                              value={style.unit_price}
                              onChange={(e) => updateStyle(index, 'unit_price', e.target.value)}
                              className={`h-8 text-sm text-right ${isZeroPrice ? 'border-orange-400 bg-orange-100' : ''}`}
                            />
                          </TableCell>
                          <TableCell className="text-right text-sm font-medium">
                            ${Number(style.total_amount || 0).toFixed(2)}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeStyle(index)}
                              className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {stylesForm.length === 0 && (
                <Alert variant="destructive">
                  <XCircle className="h-4 w-4" />
                  <AlertDescription>No styles to import. Please go back and check the PDF or add styles manually.</AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {/* Step 4: Confirmation */}
          {step === 'confirm' && (
            <div className="space-y-4 py-2">
              <Card>
                <CardHeader className="py-3 px-4">
                  <CardTitle className="text-sm">Purchase Order Summary</CardTitle>
                </CardHeader>
                <CardContent className="py-2 px-4 space-y-3">
                  <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
                    <div><span className="text-muted-foreground">PO Number:</span> <strong>{headerForm.po_number}</strong></div>
                    <div><span className="text-muted-foreground">PO Date:</span> {headerForm.po_date}</div>
                    <div><span className="text-muted-foreground">Shipping Term:</span> {headerForm.shipping_term || 'FOB'}</div>
                    <div><span className="text-muted-foreground">Retailer:</span> {masterData.retailers.find((r: any) => String(r.id) === String(headerForm.retailer_id))?.name || 'Not selected'}</div>
                    <div><span className="text-muted-foreground">Season:</span> {masterData.seasons.find((s: any) => String(s.id) === String(headerForm.season_id))?.name || 'Not selected'}</div>
                    <div><span className="text-muted-foreground">Currency:</span> {masterData.currencies.find((c: any) => String(c.id) === String(headerForm.currency_id))?.code || 'Not selected'}</div>
                    {paymentTermCode && (
                      <div><span className="text-muted-foreground">Payment:</span> {paymentTermCode}{paymentPercentage ? ` (${paymentPercentage}%)` : ''}</div>
                    )}
                    {headerForm.packing_method && (
                      <div><span className="text-muted-foreground">Packing:</span> {headerForm.packing_method}</div>
                    )}
                  </div>
                  {headerForm.etd_date && (
                    <>
                      <hr />
                      <div className="grid grid-cols-4 gap-2 text-sm">
                        <div><span className="text-muted-foreground">ETD:</span> {headerForm.etd_date}</div>
                        <div><span className="text-muted-foreground">Ex-Factory:</span> {headerForm.ex_factory_date || '-'}</div>
                        <div><span className="text-muted-foreground">ETA:</span> {headerForm.eta_date || '-'}</div>
                        <div><span className="text-muted-foreground">IHD:</span> {headerForm.in_warehouse_date || '-'}</div>
                      </div>
                    </>
                  )}
                  <hr />
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div className="text-center">
                      <div className="text-2xl font-bold">{stylesForm.length}</div>
                      <div className="text-muted-foreground">Styles</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold">{calculatedTotals.quantity.toLocaleString()}</div>
                      <div className="text-muted-foreground">Total Quantity</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold">${calculatedTotals.value.toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                      <div className="text-muted-foreground">Total Value</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {zeroPriceCount > 0 && (
                <Alert variant="default" className="border-orange-300 bg-orange-50">
                  <AlertTriangle className="h-4 w-4 text-orange-600" />
                  <AlertDescription className="text-orange-800">
                    {zeroPriceCount} style(s) still have $0.00 price. The PO will be created but prices should be filled in by the importer or agency.
                  </AlertDescription>
                </Alert>
              )}

              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  This will create a new Purchase Order in <strong>draft</strong> status with {stylesForm.length} style(s).
                  You can edit the PO further after creation.
                </AlertDescription>
              </Alert>
            </div>
          )}

          {/* Step 5: Result */}
          {step === 'result' && createResult && (
            <div className="space-y-4 py-4">
              {createResult.success ? (
                <>
                  <div className="flex flex-col items-center gap-3 py-4">
                    <CheckCircle className="h-12 w-12 text-green-600" />
                    <h3 className="text-lg font-semibold">Purchase Order Created!</h3>
                    <p className="text-sm text-muted-foreground text-center">
                      PO <strong>{createResult.purchase_order.po_number}</strong> has been created with {createResult.styles_created} style(s).
                    </p>
                  </div>

                  <div className="grid grid-cols-3 gap-4 text-sm text-center">
                    <Card className="p-3">
                      <div className="text-xl font-bold">{createResult.styles_created}</div>
                      <div className="text-muted-foreground">Styles Created</div>
                    </Card>
                    <Card className="p-3">
                      <div className="text-xl font-bold">{createResult.purchase_order.total_quantity?.toLocaleString()}</div>
                      <div className="text-muted-foreground">Total Qty</div>
                    </Card>
                    <Card className="p-3">
                      <div className="text-xl font-bold">${Number(createResult.purchase_order.total_value || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                      <div className="text-muted-foreground">Total Value</div>
                    </Card>
                  </div>

                  {createResult.styles_errors && createResult.styles_errors.length > 0 && (
                    <Alert variant="destructive">
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        <p className="font-medium mb-1">{createResult.styles_errors.length} style(s) failed to import:</p>
                        <ul className="list-disc list-inside text-sm">
                          {createResult.styles_errors.map((e, i) => (
                            <li key={i}>Row {e.row} ({e.style_number}): {e.error}</li>
                          ))}
                        </ul>
                      </AlertDescription>
                    </Alert>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center gap-3 py-4">
                  <XCircle className="h-12 w-12 text-red-600" />
                  <h3 className="text-lg font-semibold">Import Failed</h3>
                  <p className="text-sm text-muted-foreground">{createResult.message}</p>
                </div>
              )}
            </div>
          )}

          {/* Footer with navigation */}
          <DialogFooter className="flex justify-between">
            <div>
              {step === 'review-header' && (
                <Button variant="outline" onClick={() => setStep('upload')}>
                  <ArrowLeft className="h-4 w-4 mr-1" /> Back
                </Button>
              )}
              {step === 'review-styles' && (
                <Button variant="outline" onClick={() => setStep('review-header')}>
                  <ArrowLeft className="h-4 w-4 mr-1" /> Back
                </Button>
              )}
              {step === 'confirm' && (
                <Button variant="outline" onClick={() => setStep('review-styles')}>
                  <ArrowLeft className="h-4 w-4 mr-1" /> Back
                </Button>
              )}
            </div>

            <div className="flex gap-2">
              {step !== 'result' && (
                <Button variant="outline" onClick={handleClose}>Cancel</Button>
              )}

              {step === 'review-header' && (
                <Button
                  onClick={() => {
                    if (headerValidationErrors.length > 0) {
                      setError(headerValidationErrors.join('. '));
                      return;
                    }
                    setError(null);
                    setStep('review-styles');
                  }}
                  disabled={!headerForm.po_number || !headerForm.po_date}
                >
                  Next: Review Styles <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              )}

              {step === 'review-styles' && (
                <Button
                  onClick={() => {
                    if (stylesValidationErrors.length > 0) {
                      setError('Please fix validation errors before proceeding');
                      return;
                    }
                    setError(null);
                    setStep('confirm');
                  }}
                  disabled={stylesForm.length === 0 || stylesValidationErrors.length > 0}
                >
                  Next: Confirm <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              )}

              {step === 'confirm' && (
                <Button
                  onClick={handleCreatePO}
                  disabled={isCreating || headerValidationErrors.length > 0 || stylesValidationErrors.length > 0}
                >
                  {isCreating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Create Purchase Order
                </Button>
              )}

              {step === 'result' && (
                <div className="flex gap-2">
                  {createResult?.success && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        window.open(`/purchase-orders/${createResult.purchase_order.id}`, '_blank');
                      }}
                    >
                      <Eye className="h-4 w-4 mr-1" /> View PO
                    </Button>
                  )}
                  <Button onClick={() => {
                    if (createResult?.success) {
                      onImportComplete();
                    }
                    handleClose();
                  }}>
                    {createResult?.success ? 'Done' : 'Close'}
                  </Button>
                </div>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Master Data Dialogs */}
      <CreateRetailerDialog
        open={isCreateRetailerOpen}
        onOpenChange={setIsCreateRetailerOpen}
        onSuccess={handleMasterDataCreated}
      />
      <CreateSeasonDialog
        open={isCreateSeasonOpen}
        onOpenChange={setIsCreateSeasonOpen}
        onSuccess={handleMasterDataCreated}
      />
      <CreateCurrencyDialog
        open={isCreateCurrencyOpen}
        onOpenChange={setIsCreateCurrencyOpen}
        onSuccess={handleMasterDataCreated}
      />
      <CreatePaymentTermDialog
        open={isCreatePaymentTermOpen}
        onOpenChange={setIsCreatePaymentTermOpen}
        onSuccess={handleMasterDataCreated}
      />
      <CreateCountryDialog
        open={isCreateCountryOpen}
        onOpenChange={setIsCreateCountryOpen}
        onSuccess={handleMasterDataCreated}
      />
      <CreateWarehouseDialog
        open={isCreateWarehouseOpen}
        onOpenChange={setIsCreateWarehouseOpen}
        onSuccess={handleMasterDataCreated}
      />
      <CreateBuyerDialog
        open={isCreateBuyerOpen}
        onOpenChange={setIsCreateBuyerOpen}
        onSuccess={handleMasterDataCreated}
        defaultName={headerForm._buyer_name || ''}
      />
      <CreateAgentDialog
        open={isCreateAgentOpen}
        onOpenChange={setIsCreateAgentOpen}
        onSuccess={handleMasterDataCreated}
        defaultName={headerForm._agent_name || ''}
      />
    </>
  );
}
