'use client';

import { CheckCircle2, RefreshCw, SkipForward, XCircle } from 'lucide-react';
import type { BulkCommitReport } from './types';

interface Props {
  report: BulkCommitReport;
  onOpenPo?: (id: number) => void;
}

function StatCard({ value, label, className }: { value: number; label: string; className: string }) {
  return (
    <div className={`rounded-lg p-3 ${className}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

export function BulkResults({ report, onOpenPo }: Props) {
  const s = report.summary;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <StatCard value={s.pos_created} label="POs created" className="bg-emerald-50 dark:bg-emerald-950/40" />
        <StatCard value={s.pos_updated} label="POs updated" className="bg-blue-50 dark:bg-blue-950/40" />
        <StatCard value={s.pos_skipped} label="POs skipped" className="bg-amber-50 dark:bg-amber-950/40" />
        <StatCard value={s.pos_failed} label="POs failed" className="bg-red-50 dark:bg-red-950/40" />
        <StatCard value={s.styles_created} label="Styles created" className="bg-muted" />
      </div>

      {report.created.length > 0 && (
        <Section icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />} title={`Created (${report.created.length})`}>
          {report.created.map((p) => (
            <ResultRow key={p.id} label={`PO ${p.po_number}`} sub={`${p.styles} styles`} onClick={onOpenPo ? () => onOpenPo(p.id) : undefined} />
          ))}
        </Section>
      )}

      {report.updated.length > 0 && (
        <Section icon={<RefreshCw className="h-4 w-4 text-blue-600" />} title={`Updated (${report.updated.length})`}>
          {report.updated.map((p) => (
            <ResultRow key={p.id} label={`PO ${p.po_number}`} sub={`+${p.styles} new styles`} onClick={onOpenPo ? () => onOpenPo(p.id) : undefined} />
          ))}
        </Section>
      )}

      {report.skipped.length > 0 && (
        <Section icon={<SkipForward className="h-4 w-4 text-amber-600" />} title={`Skipped (${report.skipped.length})`}>
          {report.skipped.map((p, i) => (
            <ResultRow key={`${p.po_number}-${i}`} label={`PO ${p.po_number}`} sub={p.reason === 'already_exists' ? 'Already in system' : p.reason} />
          ))}
        </Section>
      )}

      {report.errors.length > 0 && (
        <Section icon={<XCircle className="h-4 w-4 text-red-600" />} title={`Failed (${report.errors.length})`}>
          {report.errors.map((p, i) => (
            <ResultRow key={i} label={p.po_number ? `PO ${p.po_number}` : 'Unknown PO'} sub={p.message} tone="error" />
          ))}
        </Section>
      )}
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 text-sm font-medium mb-1">{icon}{title}</div>
      <div className="rounded-md border divide-y max-h-40 overflow-auto">{children}</div>
    </div>
  );
}

function ResultRow({ label, sub, onClick, tone }: { label: string; sub: string; onClick?: () => void; tone?: 'error' }) {
  return (
    <div
      className={`flex items-center justify-between px-3 py-1.5 text-sm ${onClick ? 'cursor-pointer hover:bg-muted/40' : ''}`}
      onClick={onClick}
    >
      <span className="font-medium">{label}</span>
      <span className={`text-xs ${tone === 'error' ? 'text-red-600' : 'text-muted-foreground'} truncate max-w-[60%]`} title={sub}>{sub}</span>
    </div>
  );
}
