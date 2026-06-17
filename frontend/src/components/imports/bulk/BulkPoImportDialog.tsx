'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { FileUp, Loader2, Layers, AlertTriangle, CheckCircle2, X } from 'lucide-react';
import { toast } from 'sonner';

import { analyzeBulkExcel, commitBulkImport } from './api';
import { useBulkImport, type BulkGroup } from './useBulkImport';
import { MappingSummary } from './MappingSummary';
import { RawPreviewGrid } from './RawPreviewGrid';
import { PoGroupReview } from './PoGroupReview';
import { BulkResults } from './BulkResults';
import type { BulkAnalyzeResponse, BulkCommitReport } from './types';

type Step = 'upload' | 'map' | 'review' | 'results';

const apiErrorMessage = (e: unknown, fallback: string): string => {
  const m = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
  return typeof m === 'string' ? m : fallback;
};

const apiErrorFields = (e: unknown): Record<string, string[]> | null => {
  const errs = (e as { response?: { data?: { errors?: unknown } } })?.response?.data?.errors;
  return errs && typeof errs === 'object' ? (errs as Record<string, string[]>) : null;
};

/** Strip Laravel's "The <path> field " prefix and capitalise. */
const cleanServerMsg = (m: string): string => {
  const s = m.replace(/^The [\w.*]+ (field )?/i, '').trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : m;
};

interface ParsedServerError {
  po_number: string;
  style_number?: string;
  fieldLabel: string;
  message: string;
}

/**
 * Turn Laravel's `pos.51.styles.0.style_number` -> friendly, located messages,
 * an inline field map (keyed by `${rowNumber}:${field}` / `po:${po}:${field}`),
 * and the set of PO numbers to auto-expand.
 */
function parseServerErrors(
  errors: Record<string, string[]>,
  groups: BulkGroup[],
  ruleLabel: (field: string) => string,
): { list: ParsedServerError[]; fieldMap: Record<string, string>; poNumbers: string[] } {
  const list: ParsedServerError[] = [];
  const fieldMap: Record<string, string> = {};
  const poSet = new Set<string>();

  for (const [path, msgs] of Object.entries(errors)) {
    const message = cleanServerMsg(Array.isArray(msgs) ? msgs[0] : String(msgs));
    const m = path.match(/^pos\.(\d+)(?:\.styles\.(\d+))?\.(.+)$/);
    if (!m) {
      list.push({ po_number: '—', fieldLabel: path, message });
      continue;
    }
    const group = groups[Number(m[1])];
    const styleIndex = m[2] !== undefined ? Number(m[2]) : undefined;
    const field = m[3].split('.')[0]; // size_breakdown.S -> size_breakdown
    const po_number = group?.po_number ?? `#${m[1]}`;
    poSet.add(po_number);
    const fieldLabel = ruleLabel(field);

    if (styleIndex !== undefined) {
      const row = group?.rows[styleIndex];
      const style_number = group?.styles[styleIndex]?.style_number
        || (row ? `row ${row.row_number}` : `style ${styleIndex + 1}`);
      if (row) fieldMap[`${row.row_number}:${field}`] = message;
      list.push({ po_number, style_number, fieldLabel, message });
    } else {
      fieldMap[`po:${po_number}:${field}`] = message;
      list.push({ po_number, fieldLabel, message });
    }
  }
  return { list, fieldMap, poNumbers: Array.from(poSet) };
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: () => void;
  buyers?: Array<{ id: number; name: string; code?: string | null }>;
}

const STEP_LABELS: Array<{ k: Step; label: string }> = [
  { k: 'upload', label: 'Upload' },
  { k: 'map', label: 'Map & Preview' },
  { k: 'review', label: 'Review & Fix' },
  { k: 'results', label: 'Results' },
];

export function BulkPoImportDialog({ isOpen, onClose, onImportComplete, buyers = [] }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<BulkAnalyzeResponse | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [report, setReport] = useState<BulkCommitReport | null>(null);
  const [serverErrors, setServerErrors] = useState<Record<string, string[]> | null>(null);

  const [duplicateStrategy, setDuplicateStrategy] = useState<'skip' | 'update'>('skip');
  const [defaultShippingTerm, setDefaultShippingTerm] = useState<'DDP' | 'FOB'>('DDP');
  const [buyerId, setBuyerId] = useState<number | null>(null);

  const bulk = useBulkImport(analysis);

  const serverErrorInfo = useMemo(
    () => (serverErrors
      ? parseServerErrors(serverErrors, bulk.groups, (f) => bulk.rulesByKey[f]?.label ?? f.replace(/_/g, ' '))
      : null),
    [serverErrors, bulk.groups, bulk.rulesByKey],
  );

  const reset = () => {
    setStep('upload');
    setFile(null);
    setAnalysis(null);
    setReport(null);
    setServerErrors(null);
    setDuplicateStrategy('skip');
    setDefaultShippingTerm('DDP');
    setBuyerId(null);
  };
  const handleClose = () => { reset(); onClose(); };

  const handleAnalyze = async () => {
    if (!file) return;
    setAnalyzing(true);
    try {
      const res = await analyzeBulkExcel(file);
      setAnalysis(res);
      setStep('map');
    } catch (e) {
      toast.error(apiErrorMessage(e, 'Could not analyze the file'));
    } finally {
      setAnalyzing(false);
    }
  };

  const handleCommit = async () => {
    if (bulk.payloadPos.length === 0) {
      toast.error('No purchase orders to import. Check the mapping and data.');
      return;
    }
    if (!bulk.canSubmit) {
      toast.error(`Fix ${bulk.validation.total} field error${bulk.validation.total === 1 ? '' : 's'} before importing.`);
      return;
    }
    setCommitting(true);
    setServerErrors(null);
    try {
      const res = await commitBulkImport({
        pos: bulk.payloadPos,
        options: {
          duplicate_strategy: duplicateStrategy,
          default_shipping_term: defaultShippingTerm,
          buyer_id: buyerId,
          filename: file?.name ?? null,
        },
      });
      setReport(res);
      setStep('results');
      onImportComplete();
      const made = res.summary.pos_created + res.summary.pos_updated;
      toast.success(`${made} purchase order${made === 1 ? '' : 's'} imported`);
    } catch (e) {
      const fields = apiErrorFields(e);
      if (fields) {
        // The server rejected specific fields - surface exactly which ones,
        // located by PO + style, inline and in a summary panel.
        setServerErrors(fields);
        const n = Object.keys(fields).length;
        toast.error(`The server rejected ${n} field${n === 1 ? '' : 's'} — see the highlighted errors below.`);
      } else {
        toast.error(apiErrorMessage(e, 'Import failed'));
      }
    } finally {
      setCommitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-[95vw] xl:max-w-7xl max-h-[92vh] flex flex-col overflow-hidden p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-2 shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Layers className="h-5 w-5" />
            Bulk Import — Multiple POs from one Excel
          </DialogTitle>
          <DialogDescription>
            {step === 'upload' && 'Upload a tracking/WIP sheet that contains many POs. We will detect the PO and style columns and let you confirm everything before importing.'}
            {step === 'map' && 'Confirm how each column maps. Required fields must be mapped; unmapped columns are kept as notes. Nothing is imported yet.'}
            {step === 'review' && 'Review the POs we grouped, fix any flagged values, and choose how to handle POs that already exist.'}
            {step === 'results' && 'Import complete.'}
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 shrink-0">
          <Stepper current={step} />
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-3 min-h-[200px]">
          {step === 'upload' && (
            <UploadStep file={file} onFileChange={setFile} />
          )}

          {step === 'map' && analysis && (
            <div className="space-y-3">
              <MappingSummary
                summary={bulk.summary}
                requiredStatus={bulk.requiredStatus}
                requiredOk={bulk.requiredOk}
                totalDataRows={analysis.total_data_rows}
                previewTruncated={analysis.preview_truncated}
              />
              <RawPreviewGrid
                columns={analysis.columns}
                rows={analysis.rows}
                mapping={bulk.mapping}
                fieldCatalog={analysis.field_catalog}
                onChangeTarget={bulk.setColumnTarget}
                rowIssues={bulk.rowIssues}
                fieldColumn={bulk.fieldColumn}
              />
            </div>
          )}

          {step === 'review' && analysis && (
            <div className="space-y-3">
              {serverErrorInfo && (
                <div className="rounded-md border border-red-400 bg-red-50 dark:bg-red-950/40 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-red-800 dark:text-red-300 flex items-center gap-1.5">
                      <AlertTriangle className="h-4 w-4" />
                      The server rejected {serverErrorInfo.list.length} field{serverErrorInfo.list.length === 1 ? '' : 's'} — fix and re-import
                    </span>
                    <button type="button" onClick={() => setServerErrors(null)} className="text-red-700 hover:text-red-900" aria-label="Dismiss">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <ul className="mt-2 space-y-1 text-xs max-h-40 overflow-auto">
                    {serverErrorInfo.list.map((er, i) => (
                      <li key={i} className="text-red-800 dark:text-red-300">
                        <span className="font-medium">PO {er.po_number}</span>
                        {er.style_number && <> · Style <span className="font-mono">{er.style_number}</span></>}
                        {' · '}{er.fieldLabel}: <span className="font-medium">{er.message}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <OptionsBar
                existingCount={bulk.summary.existing_count}
                duplicateStrategy={duplicateStrategy}
                setDuplicateStrategy={setDuplicateStrategy}
                defaultShippingTerm={defaultShippingTerm}
                setDefaultShippingTerm={setDefaultShippingTerm}
                buyers={buyers}
                buyerId={buyerId}
                setBuyerId={setBuyerId}
              />
              {bulk.summary.excluded_rows > 0 && (
                <div className="rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
                  {bulk.summary.excluded_rows} row(s) are missing a PO or style number and will be skipped. Fix them below or in the previous step to include them.
                </div>
              )}
              {bulk.validation.total > 0 ? (
                <div className="rounded-md border border-red-300 bg-red-50 dark:bg-red-950/30 px-3 py-2 text-xs text-red-800 dark:text-red-300 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>
                    <strong>{bulk.validation.total}</strong> field{bulk.validation.total === 1 ? '' : 's'} need fixing across{' '}
                    <strong>{Object.values(bulk.validation.byPo).filter((n) => n > 0).length}</strong> PO(s). The POs with errors are expanded below — every field is editable.
                  </span>
                </div>
              ) : (
                <div className="rounded-md border border-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 px-3 py-2 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 shrink-0" /> All fields valid — ready to import.
                </div>
              )}
              <PoGroupReview
                groups={bulk.groups}
                fieldValue={bulk.fieldValue}
                setFieldValue={(r, f, v) => { bulk.setFieldValue(r, f, v); if (serverErrors) setServerErrors(null); }}
                fieldError={bulk.fieldError}
                poFieldError={bulk.poFieldError}
                sizeTokens={bulk.sizeTokens}
                sizeValue={bulk.sizeValue}
                setSizeValue={(r, t, v) => { bulk.setSizeValue(r, t, v); if (serverErrors) setServerErrors(null); }}
                validationByPo={bulk.validation.byPo}
                serverErrors={serverErrorInfo?.fieldMap}
                forceOpenPos={serverErrorInfo?.poNumbers}
              />
            </div>
          )}

          {step === 'results' && report && (
            <BulkResults
              report={report}
              onOpenPo={(id) => { handleClose(); router.push(`/purchase-orders/${id}`); }}
            />
          )}
        </div>

        <DialogFooter className="shrink-0 border-t px-6 py-3 gap-2 sm:justify-start bg-background">
          {step === 'upload' && (
            <>
              <Button variant="outline" onClick={handleClose}>Cancel</Button>
              <Button onClick={handleAnalyze} disabled={!file || analyzing}>
                {analyzing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Analyze
              </Button>
            </>
          )}
          {step === 'map' && (
            <>
              <Button variant="outline" onClick={() => setStep('upload')}>Back</Button>
              <Button onClick={() => setStep('review')} disabled={!bulk.requiredOk}>
                Next: Review {bulk.summary.po_count > 0 ? `(${bulk.summary.po_count} POs)` : ''}
              </Button>
            </>
          )}
          {step === 'review' && (
            <>
              <Button variant="outline" onClick={() => setStep('map')}>Back</Button>
              {bulk.validation.total > 0 && (
                <span className="text-xs text-red-600 self-center mr-1">Fix {bulk.validation.total} error{bulk.validation.total === 1 ? '' : 's'} to import</span>
              )}
              <Button onClick={handleCommit} disabled={committing || !bulk.canSubmit || bulk.payloadPos.length === 0}>
                {committing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Import {bulk.summary.po_count} PO{bulk.summary.po_count === 1 ? '' : 's'}
              </Button>
            </>
          )}
          {step === 'results' && (
            <>
              <Button variant="outline" onClick={reset}>Import another</Button>
              <Button onClick={handleClose}>Done</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Stepper({ current }: { current: Step }) {
  const idx = STEP_LABELS.findIndex((s) => s.k === current);
  return (
    <div className="flex items-center gap-2">
      {STEP_LABELS.map((s, i) => (
        <div key={s.k} className="flex items-center gap-2">
          <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-medium ${
            i < idx ? 'bg-emerald-600 text-white' : i === idx ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
          }`}>{i + 1}</div>
          <span className={`text-xs ${i === idx ? 'font-medium' : 'text-muted-foreground'}`}>{s.label}</span>
          {i < STEP_LABELS.length - 1 && <div className="w-4 h-px bg-border" />}
        </div>
      ))}
    </div>
  );
}

function UploadStep({ file, onFileChange }: { file: File | null; onFileChange: (f: File | null) => void }) {
  return (
    <div className="space-y-3">
      <label className="block border-2 border-dashed rounded-md p-10 text-center cursor-pointer hover:border-primary transition-colors">
        <input
          type="file"
          className="hidden"
          accept=".xlsx,.xls,.csv"
          onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
        />
        <FileUp className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
        <div className="text-sm font-medium">
          {file ? file.name : 'Drop an Excel/CSV file here or click to browse'}
        </div>
        {file && <div className="text-xs text-muted-foreground mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</div>}
      </label>
      <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground space-y-1">
        <p className="font-medium text-foreground">Good for back-filling old POs.</p>
        <p>The sheet can hold many POs at once — one row per style, with the PO number and style number in their own columns. Status/comment columns you do not map are kept as notes.</p>
      </div>
    </div>
  );
}

function OptionsBar({
  existingCount, duplicateStrategy, setDuplicateStrategy,
  defaultShippingTerm, setDefaultShippingTerm, buyers, buyerId, setBuyerId,
}: {
  existingCount: number;
  duplicateStrategy: 'skip' | 'update';
  setDuplicateStrategy: (v: 'skip' | 'update') => void;
  defaultShippingTerm: 'DDP' | 'FOB';
  setDefaultShippingTerm: (v: 'DDP' | 'FOB') => void;
  buyers: Array<{ id: number; name: string; code?: string | null }>;
  buyerId: number | null;
  setBuyerId: (v: number | null) => void;
}) {
  return (
    <div className="flex flex-wrap items-end gap-4 rounded-md border p-3">
      {existingCount > 0 && (
        <div>
          <div className="text-xs text-muted-foreground mb-1">{existingCount} PO(s) already exist</div>
          <div className="inline-flex rounded-md border overflow-hidden text-xs">
            <button
              type="button"
              className={`px-3 py-1.5 ${duplicateStrategy === 'skip' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'}`}
              onClick={() => setDuplicateStrategy('skip')}
            >
              Skip them
            </button>
            <button
              type="button"
              className={`px-3 py-1.5 border-l ${duplicateStrategy === 'update' ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-muted'}`}
              onClick={() => setDuplicateStrategy('update')}
            >
              Add new styles
            </button>
          </div>
        </div>
      )}
      <div>
        <label className="text-xs text-muted-foreground block mb-1">Shipping term (default)</label>
        <select
          value={defaultShippingTerm}
          onChange={(e) => setDefaultShippingTerm(e.target.value as 'DDP' | 'FOB')}
          className="h-8 rounded-md border bg-background px-2 text-sm"
        >
          <option value="DDP">DDP</option>
          <option value="FOB">FOB</option>
        </select>
      </div>
      {buyers.length > 0 && (
        <div>
          <label className="text-xs text-muted-foreground block mb-1">Buyer (optional, applied to all)</label>
          <select
            value={buyerId ?? ''}
            onChange={(e) => setBuyerId(e.target.value ? Number(e.target.value) : null)}
            className="h-8 rounded-md border bg-background px-2 text-sm min-w-[180px]"
          >
            <option value="">— None —</option>
            {buyers.map((b) => (
              <option key={b.id} value={b.id}>{b.name}{b.code ? ` (${b.code})` : ''}</option>
            ))}
          </select>
        </div>
      )}
      <div className="ml-auto text-xs text-muted-foreground self-center">
        New POs are created as <span className="font-medium text-foreground">drafts</span> — no notifications or schedules are triggered.
      </div>
    </div>
  );
}
