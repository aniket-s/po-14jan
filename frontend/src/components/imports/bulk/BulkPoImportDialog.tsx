'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { FileUp, Loader2, Layers } from 'lucide-react';
import { toast } from 'sonner';

import { analyzeBulkExcel, commitBulkImport } from './api';
import { useBulkImport } from './useBulkImport';
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

  const [duplicateStrategy, setDuplicateStrategy] = useState<'skip' | 'update'>('skip');
  const [defaultShippingTerm, setDefaultShippingTerm] = useState<'DDP' | 'FOB'>('DDP');
  const [buyerId, setBuyerId] = useState<number | null>(null);

  const bulk = useBulkImport(analysis);

  const reset = () => {
    setStep('upload');
    setFile(null);
    setAnalysis(null);
    setReport(null);
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
    setCommitting(true);
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
      toast.error(apiErrorMessage(e, 'Import failed'));
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
              <PoGroupReview
                groups={bulk.groups}
                fieldValue={bulk.fieldValue}
                setFieldValue={bulk.setFieldValue}
                rowIssues={bulk.rowIssues}
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
              <Button onClick={handleCommit} disabled={committing || bulk.payloadPos.length === 0}>
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
