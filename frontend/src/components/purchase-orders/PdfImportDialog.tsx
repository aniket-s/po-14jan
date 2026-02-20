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
} from 'lucide-react';
import { analyzePdfForPOImport, createPOFromPdf } from '@/services/styles';
import type {
  PdfAnalysisResult,
  PdfParsedStyle,
  PdfCreatePORequest,
  PdfCreatePOResult,
} from '@/types';

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
  };
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

  const resetState = useCallback(() => {
    setStep('upload');
    setIsUploading(false);
    setIsCreating(false);
    setError(null);
    setAnalysisResult(null);
    setCreateResult(null);
    setHeaderForm({});
    setStylesForm([]);
  }, []);

  const handleClose = () => {
    resetState();
    onClose();
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
        header.other_terms = ph.other_terms?.value || '';
        header.additional_notes = ph.additional_notes?.value || '';
        header.revision_number = ph.revision_number?.value || 1;
        // Informational fields (not submitted, just shown)
        header._vendor_name = ph.vendor_name?.value || '';
        header._buyer_name = ph.buyer_name?.value || '';
        header._department = ph.department?.value || '';
        header._division = ph.division?.value || '';
      }
      setHeaderForm(header);

      // Initialize editable styles form from parsed data
      const styles = (result.parsed_data?.styles || []).map((s: PdfParsedStyle, idx: number) => ({
        _id: idx,
        style_number: s.style_number?.value || '',
        description: s.description?.value || '',
        color_name: s.color_name?.value || '',
        size_breakdown: s.size_breakdown?.value || {},
        quantity: s.quantity?.value || 0,
        unit_price: s.unit_price?.value || 0,
        total_amount: s.total_amount?.value || 0,
      }));
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

  // Step 4: Create PO
  const handleCreatePO = async () => {
    setIsCreating(true);
    setError(null);

    try {
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
          shipping_term: headerForm.shipping_term || 'FOB',
          ship_to: headerForm.ship_to || undefined,
          ship_to_address: headerForm.ship_to_address || undefined,
          country_of_origin: headerForm.country_of_origin || undefined,
          etd_date: headerForm.etd_date || undefined,
          ex_factory_date: headerForm.ex_factory_date || undefined,
          eta_date: headerForm.eta_date || undefined,
          in_warehouse_date: headerForm.in_warehouse_date || undefined,
          packing_method: headerForm.packing_method || undefined,
          other_terms: headerForm.other_terms || undefined,
          additional_notes: headerForm.additional_notes || undefined,
          revision_number: headerForm.revision_number ? Number(headerForm.revision_number) : undefined,
        },
        styles: stylesForm.map(s => ({
          style_number: s.style_number,
          description: s.description || undefined,
          color_name: s.color_name || undefined,
          size_breakdown: s.size_breakdown && Object.keys(s.size_breakdown).length > 0 ? s.size_breakdown : null,
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

  return (
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
                <Select value={headerForm.shipping_term || ''} onValueChange={(v) => updateHeader('shipping_term', v)}>
                  <SelectTrigger><SelectValue placeholder="Select shipping term" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FOB">FOB</SelectItem>
                    <SelectItem value="DDP">DDP</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Retailer */}
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Label>Retailer</Label>
                  <StatusBadge status={getFieldStatus('retailer_id')} />
                </div>
                <Select value={String(headerForm.retailer_id || '')} onValueChange={(v) => updateHeader('retailer_id', v)}>
                  <SelectTrigger><SelectValue placeholder="Select retailer" /></SelectTrigger>
                  <SelectContent>
                    {masterData.retailers.map((r: any) => (
                      <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Season */}
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Label>Season</Label>
                  <StatusBadge status={getFieldStatus('season_id')} />
                </div>
                <Select value={String(headerForm.season_id || '')} onValueChange={(v) => updateHeader('season_id', v)}>
                  <SelectTrigger><SelectValue placeholder="Select season" /></SelectTrigger>
                  <SelectContent>
                    {masterData.seasons.map((s: any) => (
                      <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Currency */}
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Label>Currency</Label>
                  <StatusBadge status={getFieldStatus('currency_id')} />
                </div>
                <Select value={String(headerForm.currency_id || '')} onValueChange={(v) => updateHeader('currency_id', v)}>
                  <SelectTrigger><SelectValue placeholder="Select currency" /></SelectTrigger>
                  <SelectContent>
                    {masterData.currencies.map((c: any) => (
                      <SelectItem key={c.id} value={String(c.id)}>{c.code} ({c.symbol})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Payment Term */}
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Label>Payment Term</Label>
                  <StatusBadge status={getFieldStatus('payment_term_id')} />
                </div>
                <Select value={String(headerForm.payment_term_id || '')} onValueChange={(v) => updateHeader('payment_term_id', v)}>
                  <SelectTrigger><SelectValue placeholder="Select payment term" /></SelectTrigger>
                  <SelectContent>
                    {masterData.paymentTerms.map((pt: any) => (
                      <SelectItem key={pt.id} value={String(pt.id)}>{pt.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Country */}
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Label>Country</Label>
                  <StatusBadge status={getFieldStatus('country_id')} />
                </div>
                <Select value={String(headerForm.country_id || '')} onValueChange={(v) => updateHeader('country_id', v)}>
                  <SelectTrigger><SelectValue placeholder="Select country" /></SelectTrigger>
                  <SelectContent>
                    {masterData.countries.map((c: any) => (
                      <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Warehouse */}
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Label>Warehouse</Label>
                  <StatusBadge status={getFieldStatus('warehouse_id')} />
                </div>
                <Select value={String(headerForm.warehouse_id || '')} onValueChange={(v) => updateHeader('warehouse_id', v)}>
                  <SelectTrigger><SelectValue placeholder="Select warehouse" /></SelectTrigger>
                  <SelectContent>
                    {masterData.warehouses.map((w: any) => (
                      <SelectItem key={w.id} value={String(w.id)}>{w.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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

              {/* Ship To Address */}
              <div className="space-y-1 col-span-2">
                <div className="flex items-center gap-2">
                  <Label>Ship To Address</Label>
                  <StatusBadge status={getFieldStatus('ship_to_address')} />
                </div>
                <Input
                  value={headerForm.ship_to_address || ''}
                  onChange={(e) => updateHeader('ship_to_address', e.target.value)}
                  placeholder="Full shipping address"
                />
              </div>

              {/* Dates */}
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Label>ETD Date</Label>
                  <StatusBadge status={getFieldStatus('etd_date')} />
                </div>
                <Input
                  type="date"
                  value={headerForm.etd_date || ''}
                  onChange={(e) => updateHeader('etd_date', e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Label>Ex-Factory Date</Label>
                  <StatusBadge status={getFieldStatus('ex_factory_date')} />
                </div>
                <Input
                  type="date"
                  value={headerForm.ex_factory_date || ''}
                  onChange={(e) => updateHeader('ex_factory_date', e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Label>ETA Date</Label>
                  <StatusBadge status={getFieldStatus('eta_date')} />
                </div>
                <Input
                  type="date"
                  value={headerForm.eta_date || ''}
                  onChange={(e) => updateHeader('eta_date', e.target.value)}
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Label>In-Warehouse Date</Label>
                  <StatusBadge status={getFieldStatus('in_warehouse_date')} />
                </div>
                <Input
                  type="date"
                  value={headerForm.in_warehouse_date || ''}
                  onChange={(e) => updateHeader('in_warehouse_date', e.target.value)}
                />
              </div>

              {/* Country of Origin */}
              <div className="space-y-1">
                <Label>Country of Origin</Label>
                <Input
                  value={headerForm.country_of_origin || ''}
                  onChange={(e) => updateHeader('country_of_origin', e.target.value)}
                  placeholder="e.g. China, India, Bangladesh"
                />
              </div>

              {/* Packing Method */}
              <div className="space-y-1">
                <Label>Packing Method</Label>
                <Input
                  value={headerForm.packing_method || ''}
                  onChange={(e) => updateHeader('packing_method', e.target.value)}
                  placeholder="e.g. Carton, Polybag"
                />
              </div>

              {/* Notes */}
              <div className="space-y-1 col-span-2">
                <Label>Additional Notes</Label>
                <Textarea
                  value={headerForm.additional_notes || ''}
                  onChange={(e) => updateHeader('additional_notes', e.target.value)}
                  placeholder="Any special instructions or notes"
                  rows={3}
                />
              </div>
            </div>

            {/* Informational: Vendor / Buyer extracted (not stored in PO, just shown) */}
            {(headerForm._vendor_name || headerForm._buyer_name) && (
              <Card className="bg-muted/30">
                <CardHeader className="py-2 px-4">
                  <CardTitle className="text-sm">Extracted Reference Info (not stored in PO)</CardTitle>
                </CardHeader>
                <CardContent className="py-2 px-4 grid grid-cols-2 gap-2 text-sm">
                  {headerForm._vendor_name && <div><span className="text-muted-foreground">Vendor:</span> {headerForm._vendor_name}</div>}
                  {headerForm._buyer_name && <div><span className="text-muted-foreground">Buyer:</span> {headerForm._buyer_name}</div>}
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

            <div className="max-h-[400px] overflow-auto border rounded">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[40px]">#</TableHead>
                    <TableHead className="min-w-[120px]">Style Number</TableHead>
                    <TableHead className="min-w-[150px]">Description</TableHead>
                    <TableHead className="min-w-[100px]">Color</TableHead>
                    <TableHead className="min-w-[150px]">Size Breakdown</TableHead>
                    <TableHead className="w-[90px] text-right">Qty</TableHead>
                    <TableHead className="w-[100px] text-right">Unit Price</TableHead>
                    <TableHead className="w-[100px] text-right">Total</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stylesForm.map((style, index) => (
                    <TableRow key={index}>
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
                      <TableCell>
                        <div className="text-xs text-muted-foreground">
                          {style.size_breakdown && typeof style.size_breakdown === 'object' && Object.keys(style.size_breakdown).length > 0
                            ? Object.entries(style.size_breakdown).map(([size, qty]) => `${size}:${qty}`).join(', ')
                            : <span className="italic">None</span>
                          }
                        </div>
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
                          className="h-8 text-sm text-right"
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
                  ))}
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
                </div>
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
              <Button onClick={() => setStep('review-styles')} disabled={!headerForm.po_number || !headerForm.po_date}>
                Next: Review Styles <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            )}

            {step === 'review-styles' && (
              <Button onClick={() => setStep('confirm')} disabled={stylesForm.length === 0}>
                Next: Confirm <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            )}

            {step === 'confirm' && (
              <Button onClick={handleCreatePO} disabled={isCreating}>
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
  );
}
