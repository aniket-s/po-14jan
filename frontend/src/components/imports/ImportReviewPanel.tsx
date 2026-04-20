'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, CheckCircle, Loader2, Trash2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { AnalyzeResponse, BuySheetSummary, ImportStrategy } from './types';

interface Props {
  strategy: ImportStrategy;
  buyerId: number;
  buySheet: BuySheetSummary | null;
  analysis: AnalyzeResponse;
  submitting: boolean;
  onCancel: () => void;
  onSubmit: (header: Record<string, any>, styles: Array<Record<string, any>>) => Promise<void>;
}

const unwrap = (h: any): any => (h && typeof h === 'object' && 'value' in h ? h.value : h);

export function ImportReviewPanel({
  strategy,
  buyerId,
  buySheet,
  analysis,
  submitting,
  onCancel,
  onSubmit,
}: Props) {
  const isBuySheet = analysis.kind === 'buy_sheet';
  const today = new Date().toISOString().slice(0, 10);

  const [header, setHeader] = useState<Record<string, any>>(() => {
    const h = analysis.po_header ?? {};
    return isBuySheet
      ? {
          buy_sheet_number: unwrap(h.buy_sheet_number) ?? '',
          name: unwrap(h.buy_sheet_name) ?? unwrap(h.retailer_name) ?? '',
          date_submitted: unwrap(h.po_date) ?? today,
          tickets_required: unwrap(h.tickets_required) ?? null,
          buyer_approvals_required: unwrap(h.buyer_approvals_required) ?? null,
          retailer_id: unwrap(h.retailer_id) ?? null,
          season_id: unwrap(h.season_id) ?? null,
        }
      : {
          po_number: unwrap(h.po_number) ?? '',
          po_date: unwrap(h.po_date) ?? today,
          headline: '',
          retailer_id: unwrap(h.retailer_id) ?? null,
          season_id: unwrap(h.season_id) ?? null,
          currency_id: unwrap(h.currency_id) ?? null,
          payment_term_id: unwrap(h.payment_term_id) ?? null,
          country_id: unwrap(h.country_id) ?? null,
          warehouse_id: unwrap(h.warehouse_id) ?? null,
          shipping_term: unwrap(h.shipping_term) ?? 'FOB',
          ship_to: unwrap(h.ship_to) ?? '',
          ship_to_address: unwrap(h.ship_to_address) ?? '',
          country_of_origin: unwrap(h.country_of_origin) ?? '',
          etd_date: unwrap(h.etd_date) ?? '',
          ex_factory_date: unwrap(h.ex_factory_date) ?? '',
          eta_date: unwrap(h.eta_date) ?? '',
          in_warehouse_date: unwrap(h.in_warehouse_date) ?? '',
          fob_date: unwrap(h.fob_date) ?? '',
          packing_method: unwrap(h.packing_method) ?? '',
          additional_notes: unwrap(h.additional_notes) ?? '',
        };
  });

  const [styles, setStyles] = useState<Array<Record<string, any>>>(() =>
    (analysis.styles ?? []).map((s) => ({
      style_number: unwrap(s.style_number) ?? '',
      description: unwrap(s.description) ?? '',
      color_name: unwrap(s.color_name) ?? '',
      fabric: unwrap(s.fabric) ?? '',
      fit: unwrap(s.fit) ?? '',
      label: unwrap(s.label) ?? '',
      quantity: unwrap(s.quantity) ?? 0,
      unit_price: unwrap(s.unit_price) ?? 0,
      size_breakdown: unwrap(s.size_breakdown) ?? null,
      packing: unwrap(s.packing) ?? '',
      ihd: unwrap(s.ihd) ?? '',
      images: s.images ?? [],
    }))
  );

  const totals = useMemo(() => {
    let q = 0, v = 0;
    for (const s of styles) {
      const qty = Number(s.quantity) || 0;
      const up = Number(s.unit_price) || 0;
      q += qty;
      v += qty * up;
    }
    return { q, v };
  }, [styles]);

  const updateHeader = (k: string, v: any) => setHeader((p) => ({ ...p, [k]: v }));
  const updateStyle = (i: number, k: string, v: any) =>
    setStyles((p) => p.map((s, idx) => (idx === i ? { ...s, [k]: v } : s)));
  const removeStyle = (i: number) => setStyles((p) => p.filter((_, idx) => idx !== i));

  const handleSubmit = async () => {
    const payload = { ...header, buyer_id: buyerId };
    if (!isBuySheet && buySheet) {
      payload.buy_sheet_id = buySheet.id;
    }
    await onSubmit(payload, styles);
  };

  const blockers = isBuySheet
    ? [
        !header.buy_sheet_number && 'Buy sheet number is required',
        styles.length === 0 && 'At least one style is required',
      ].filter(Boolean)
    : [
        !header.po_number && 'PO number is required',
        !header.po_date && 'PO date is required',
        styles.length === 0 && 'At least one style is required',
      ].filter(Boolean);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="default" className="bg-emerald-600">
          <CheckCircle className="h-3 w-3 mr-1" /> Parsed
        </Badge>
        <Badge variant="outline">Strategy: {strategy.label}</Badge>
        <Badge variant="outline">Date rule: {strategy.date_policy}</Badge>
        {buySheet && <Badge variant="secondary">Linked to buy sheet #{buySheet.buy_sheet_number}</Badge>}
      </div>

      {analysis.warnings?.length > 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <ul className="list-disc pl-5 text-sm space-y-1">
              {analysis.warnings.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Header fields */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {isBuySheet ? (
          <>
            <Field label="Buy Sheet #" required>
              <Input
                value={header.buy_sheet_number ?? ''}
                onChange={(e) => updateHeader('buy_sheet_number', e.target.value)}
              />
            </Field>
            <Field label="Name">
              <Input
                value={header.name ?? ''}
                onChange={(e) => updateHeader('name', e.target.value)}
              />
            </Field>
            <Field label="Date Submitted">
              <Input
                type="date"
                value={header.date_submitted ?? ''}
                onChange={(e) => updateHeader('date_submitted', e.target.value)}
              />
            </Field>
          </>
        ) : (
          <>
            <Field label="PO Number" required>
              <Input
                value={header.po_number ?? ''}
                onChange={(e) => updateHeader('po_number', e.target.value)}
              />
            </Field>
            <Field label="PO Date" required>
              <Input
                type="date"
                value={header.po_date ?? ''}
                onChange={(e) => updateHeader('po_date', e.target.value)}
              />
            </Field>
            <Field label="Shipping Term">
              <Input
                value={header.shipping_term ?? ''}
                onChange={(e) => updateHeader('shipping_term', e.target.value)}
              />
            </Field>
            <Field label="ETD">
              <Input type="date" value={header.etd_date ?? ''} onChange={(e) => updateHeader('etd_date', e.target.value)} />
            </Field>
            <Field label="Ex-Factory">
              <Input type="date" value={header.ex_factory_date ?? ''} onChange={(e) => updateHeader('ex_factory_date', e.target.value)} />
            </Field>
            <Field label="ETA">
              <Input type="date" value={header.eta_date ?? ''} onChange={(e) => updateHeader('eta_date', e.target.value)} />
            </Field>
            <Field label="In-Warehouse">
              <Input type="date" value={header.in_warehouse_date ?? ''} onChange={(e) => updateHeader('in_warehouse_date', e.target.value)} />
            </Field>
            <Field label="FOB Date">
              <Input type="date" value={header.fob_date ?? ''} onChange={(e) => updateHeader('fob_date', e.target.value)} />
            </Field>
          </>
        )}
      </div>

      {/* Styles */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <Label className="text-sm font-medium">Styles ({styles.length})</Label>
          <div className="text-xs text-muted-foreground">
            Total: {totals.q.toLocaleString()} units · {totals.v.toLocaleString(undefined, { style: 'currency', currency: 'USD' })}
          </div>
        </div>
        <div className="border rounded-md max-h-[320px] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[120px]">Style #</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="w-[90px]">Color</TableHead>
                <TableHead className="w-[80px]">Qty</TableHead>
                <TableHead className="w-[90px]">Unit Price</TableHead>
                <TableHead className="w-[40px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {styles.map((s, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Input value={s.style_number ?? ''} onChange={(e) => updateStyle(i, 'style_number', e.target.value)} className="h-8" />
                  </TableCell>
                  <TableCell>
                    <Input value={s.description ?? ''} onChange={(e) => updateStyle(i, 'description', e.target.value)} className="h-8" />
                  </TableCell>
                  <TableCell>
                    <Input value={s.color_name ?? ''} onChange={(e) => updateStyle(i, 'color_name', e.target.value)} className="h-8" />
                  </TableCell>
                  <TableCell>
                    <Input type="number" value={s.quantity ?? 0} onChange={(e) => updateStyle(i, 'quantity', Number(e.target.value))} className="h-8" />
                  </TableCell>
                  <TableCell>
                    <Input type="number" step="0.01" value={s.unit_price ?? 0} onChange={(e) => updateStyle(i, 'unit_price', Number(e.target.value))} className="h-8" />
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => removeStyle(i)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {blockers.length > 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <ul className="list-disc pl-5 text-sm space-y-1">
              {blockers.map((b) => <li key={b as string}>{b}</li>)}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <div className="flex justify-end gap-2 pt-2 border-t">
        <Button variant="outline" onClick={onCancel} disabled={submitting}>Back</Button>
        <Button onClick={handleSubmit} disabled={submitting || blockers.length > 0}>
          {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {isBuySheet ? 'Create Buy Sheet' : 'Create Purchase Order'}
        </Button>
      </div>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-xs text-muted-foreground">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </Label>
      {children}
    </div>
  );
}
