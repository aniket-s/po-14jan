'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { FileUp, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

import { ImportTypePicker } from './ImportTypePicker';
import { BuyerPickerStep } from './BuyerPickerStep';
import { BuySheetLinkStep } from './BuySheetLinkStep';
import { ImportReviewPanel } from './ImportReviewPanel';
import { PdfImportDialog } from '@/components/purchase-orders/PdfImportDialog';
import { analyzeImport, commitImport, fetchImportStrategies } from './api';
import type { AnalyzeResponse, BuySheetSummary, ImportStrategy } from './types';
import type { PdfAnalysisResult } from '@/types';

type Step = 'type' | 'buyer' | 'buy-sheet' | 'upload' | 'review';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  buyers: Array<{ id: number; name: string; code?: string | null }>;
  onRefreshBuyers: () => void;
  onImportComplete: () => void;
  initialStrategyKey?: string | null;
  /**
   * The full master-data bundle forwarded to PdfImportDialog when this wizard
   * hands off a PO-kind import to the legacy review UI. When omitted, PO-kind
   * imports fall back to the compact ImportReviewPanel.
   */
  masterData?: {
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

export function ImportWizardDialog({
  isOpen, onClose, buyers, onRefreshBuyers, onImportComplete, initialStrategyKey,
  masterData, onRefreshMasterData,
}: Props) {
  const router = useRouter();

  const [strategies, setStrategies] = useState<ImportStrategy[]>([]);
  const [loadingStrategies, setLoadingStrategies] = useState(false);
  const [step, setStep] = useState<Step>('type');
  const [strategy, setStrategy] = useState<ImportStrategy | null>(null);
  const [buyerId, setBuyerId] = useState<number | null>(null);
  const [useBuySheet, setUseBuySheet] = useState<'yes' | 'no' | null>(null);
  const [buySheet, setBuySheet] = useState<BuySheetSummary | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [analysis, setAnalysis] = useState<AnalyzeResponse | null>(null);
  const [commitErrors, setCommitErrors] = useState<Record<string, string[]> | undefined>();
  // When PO-kind analyze succeeds and we have masterData, we hand off review to
  // the full-featured PdfImportDialog. This flag drives the swap.
  const [poReviewOpen, setPoReviewOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setLoadingStrategies(true);
    fetchImportStrategies()
      .then((s) => {
        setStrategies(s);
        if (initialStrategyKey) {
          const match = s.find((x) => x.key === initialStrategyKey);
          if (match) {
            setStrategy(match);
            setStep('buyer');
          }
        }
      })
      .catch(() => toast.error('Failed to load import types'))
      .finally(() => setLoadingStrategies(false));
  }, [isOpen, initialStrategyKey]);

  const reset = () => {
    setStep('type');
    setStrategy(null);
    setBuyerId(null);
    setUseBuySheet(null);
    setBuySheet(null);
    setFile(null);
    setAnalysis(null);
    setCommitErrors(undefined);
    setPoReviewOpen(false);
  };
  const handleClose = () => { reset(); onClose(); };

  const handleAnalyze = async () => {
    if (!strategy || !buyerId || !file) return;
    setAnalyzing(true);
    try {
      const res = await analyzeImport({
        strategyKey: strategy.key,
        buyerId,
        buySheetId: buySheet?.id ?? null,
        file,
      });
      setAnalysis(res);
      // PO kind with masterData provided -> delegate the rich review to the
      // legacy PdfImportDialog (full fields: master data, dates cascade, sample
      // schedule, additional info, per-style editing with warnings).
      // Buy-sheet kind stays on the compact ImportReviewPanel.
      if (res.kind === 'po' && masterData) {
        setPoReviewOpen(true);
      } else {
        setStep('review');
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Analysis failed');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleCommit = async (header: Record<string, any>, styles: Array<Record<string, any>>) => {
    if (!strategy || !analysis) return;
    setCommitting(true);
    setCommitErrors(undefined);
    try {
      const res = await commitImport({
        kind: analysis.kind,
        strategy_key: strategy.key,
        header,
        styles,
        temp_file_path: analysis.temp_file_path,
        original_filename: file?.name,
      });
      toast.success(res.kind === 'buy_sheet' ? 'Buy sheet created' : 'Purchase order created');
      onImportComplete();
      handleClose();
      if (res.kind === 'po' && res.purchase_order?.id) {
        router.push(`/purchase-orders/${res.purchase_order.id}`);
      } else if (res.kind === 'buy_sheet' && res.buy_sheet?.id) {
        router.push(`/buy-sheets/${res.buy_sheet.id}`);
      }
    } catch (e: any) {
      const errs = e?.response?.data?.errors;
      const topMessage = e?.response?.data?.message ?? 'Commit failed';
      // Show a toast for the headline AND keep the field errors so the review
      // panel can render them inline. Toast alone is easily missed; the inline
      // alert makes the failure obvious even if the toaster is off-screen.
      toast.error(topMessage);
      if (errs && typeof errs === 'object') {
        setCommitErrors(errs);
      }
    } finally {
      setCommitting(false);
    }
  };

  // Step routing helpers
  const canNext = (): boolean => {
    if (step === 'type') return !!strategy;
    if (step === 'buyer') return !!buyerId;
    if (step === 'buy-sheet') return useBuySheet === 'no' || (useBuySheet === 'yes' && !!buySheet);
    if (step === 'upload') return !!file;
    return false;
  };
  const next = () => {
    if (step === 'type') setStep('buyer');
    else if (step === 'buyer') {
      if (strategy?.supports_buy_sheet && strategy.document_kind !== 'buy_sheet') setStep('buy-sheet');
      else setStep('upload');
    } else if (step === 'buy-sheet') setStep('upload');
    else if (step === 'upload') handleAnalyze();
  };
  const back = () => {
    if (step === 'review') setStep('upload');
    else if (step === 'upload') setStep(strategy?.supports_buy_sheet && strategy.document_kind !== 'buy_sheet' ? 'buy-sheet' : 'buyer');
    else if (step === 'buy-sheet') setStep('buyer');
    else if (step === 'buyer') setStep('type');
  };

  return (
    <>
    <Dialog open={isOpen && !poReviewOpen} onOpenChange={(o) => !o && !poReviewOpen && handleClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileUp className="h-5 w-5" />
            Import {analysis?.kind === 'buy_sheet' ? 'Buy Sheet' : 'Purchase Order'}
          </DialogTitle>
          <DialogDescription>
            {step === 'type' && 'Select the source document type.'}
            {step === 'buyer' && 'Pick the buyer / importer this document belongs to.'}
            {step === 'buy-sheet' && 'Optionally link this PO to an existing buy sheet.'}
            {step === 'upload' && 'Upload the file. We will parse it and show you a review screen.'}
            {step === 'review' && 'Review the parsed data and edit anything that looks wrong before saving.'}
          </DialogDescription>
        </DialogHeader>

        <div className="py-2">
          <StepIndicator currentStep={step} skipBuySheet={strategy?.document_kind === 'buy_sheet' || !strategy?.supports_buy_sheet} />
        </div>

        <div className="py-2 min-h-[280px]">
          {step === 'type' && (
            <ImportTypePicker
              strategies={strategies}
              loading={loadingStrategies}
              selectedKey={strategy?.key ?? null}
              onSelect={setStrategy}
            />
          )}
          {step === 'buyer' && (
            <BuyerPickerStep
              buyers={buyers}
              value={buyerId}
              onChange={setBuyerId}
              lockedToCode={strategy?.buyer_code ?? null}
              onRefresh={onRefreshBuyers}
            />
          )}
          {step === 'buy-sheet' && (
            <BuySheetLinkStep
              buyerId={buyerId}
              value={useBuySheet}
              selectedSheet={buySheet}
              onChange={(v, s) => { setUseBuySheet(v); setBuySheet(s); }}
            />
          )}
          {step === 'upload' && (
            <UploadStep
              format={strategy!.format}
              file={file}
              onFileChange={setFile}
            />
          )}
          {step === 'review' && analysis && (
            <ImportReviewPanel
              strategy={strategy!}
              buyerId={buyerId!}
              buySheet={buySheet}
              analysis={analysis}
              submitting={committing}
              onCancel={() => setStep('upload')}
              onSubmit={handleCommit}
              serverErrors={commitErrors}
            />
          )}
        </div>

        {step !== 'review' && (
          <DialogFooter>
            <Button variant="outline" onClick={step === 'type' ? handleClose : back} disabled={analyzing}>
              {step === 'type' ? 'Cancel' : 'Back'}
            </Button>
            <Button onClick={next} disabled={!canNext() || analyzing}>
              {analyzing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {step === 'upload' ? 'Analyze' : 'Next'}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>

    {/* Full-featured review for PO-kind imports: reuses the legacy dialog so
        users get master-data dropdowns, date cascade, sample schedule, packing
        info, per-style editing and zero-price/duplicate warnings. The wizard
        stays mounted but hidden (poReviewOpen gates its Dialog open prop) so
        if the user cancels review they return to the wizard. */}
    {masterData && strategy && analysis && analysis.kind === 'po' && (
      <PdfImportDialog
        isOpen={poReviewOpen}
        onClose={() => {
          setPoReviewOpen(false);
          // Return to upload step so they can re-analyze or change their mind.
          setStep('upload');
        }}
        onImportComplete={() => {
          onImportComplete();
          setPoReviewOpen(false);
          handleClose();
        }}
        masterData={masterData}
        onRefreshMasterData={onRefreshMasterData}
        initialAnalysis={toLegacyAnalysisShape(analysis)}
        initialStep="review-header"
        lockedBuyerId={buyerId}
        buySheetHint={buySheet ? {
          id: buySheet.id,
          buy_sheet_number: buySheet.buy_sheet_number,
          name: buySheet.name ?? null,
        } : null}
        datePolicy={strategy.date_policy}
        strategyKey={strategy.key}
        commitTarget="unified"
        originalFilename={file?.name ?? null}
      />
    )}
    </>
  );
}

/**
 * Translate the unified /imports/analyze response into the legacy
 * PdfAnalysisResult shape that PdfImportDialog's seedFromAnalysis consumes.
 *
 * Legacy:   { parsed_data: { po_header, styles, totals }, temp_file_path, warnings, errors, analysis_method, raw_text }
 * Unified:  { po_header, styles, totals, warnings, errors, raw_text, ai_usage, strategy_key, temp_file_path, kind, strategy:{...} }
 *
 * Without this adapter, result.parsed_data is undefined and every header
 * field is read as "Missing" even though Claude extracted them correctly.
 */
function toLegacyAnalysisShape(a: AnalyzeResponse): PdfAnalysisResult {
  return {
    success: a.success,
    parsed_data: {
      po_header: a.po_header,
      styles: a.styles as any,
      totals: a.totals,
    },
    temp_file_path: a.temp_file_path,
    warnings: a.warnings ?? [],
    errors: a.errors ?? [],
    raw_text: a.raw_text ?? '',
    // ai_usage being populated means the Claude path succeeded; the legacy
    // flag drives the "Analyzed with Claude AI" badge.
    analysis_method: a.ai_usage ? 'claude_ai' : 'regex',
  } as PdfAnalysisResult;
}

function StepIndicator({ currentStep, skipBuySheet }: { currentStep: Step; skipBuySheet: boolean }) {
  const steps: Array<{ k: Step; label: string }> = [
    { k: 'type', label: 'Type' },
    { k: 'buyer', label: 'Buyer' },
    ...(!skipBuySheet ? [{ k: 'buy-sheet' as Step, label: 'Buy Sheet' }] : []),
    { k: 'upload', label: 'Upload' },
    { k: 'review', label: 'Review' },
  ];
  const currentIdx = steps.findIndex((s) => s.k === currentStep);
  return (
    <div className="flex items-center gap-2">
      {steps.map((s, i) => (
        <div key={s.k} className="flex items-center gap-2">
          <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-medium ${
            i < currentIdx ? 'bg-emerald-600 text-white'
              : i === currentIdx ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground'
          }`}>
            {i + 1}
          </div>
          <span className={`text-xs ${i === currentIdx ? 'font-medium' : 'text-muted-foreground'}`}>{s.label}</span>
          {i < steps.length - 1 && <div className="w-4 h-px bg-border" />}
        </div>
      ))}
    </div>
  );
}

function UploadStep({ format, file, onFileChange }: { format: 'pdf' | 'excel'; file: File | null; onFileChange: (f: File | null) => void }) {
  const accept = format === 'pdf' ? 'application/pdf' : '.xlsx,.xls,.csv';
  return (
    <div className="space-y-3">
      <label className="block border-2 border-dashed rounded-md p-8 text-center cursor-pointer hover:border-primary transition-colors">
        <input
          type="file"
          className="hidden"
          accept={accept}
          onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
        />
        <FileUp className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
        <div className="text-sm font-medium">
          {file ? file.name : `Drop a ${format.toUpperCase()} file here or click to browse`}
        </div>
        {file && (
          <div className="text-xs text-muted-foreground mt-1">
            {(file.size / 1024 / 1024).toFixed(2)} MB
          </div>
        )}
      </label>
    </div>
  );
}
