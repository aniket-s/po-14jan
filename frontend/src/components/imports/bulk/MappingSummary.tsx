'use client';

import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, AlertTriangle, Database, Package, Store, Layers } from 'lucide-react';

interface Props {
  summary: {
    po_count: number;
    style_count: number;
    existing_count: number;
    error_rows: number;
    warning_rows: number;
    excluded_rows: number;
    metadata_columns: number;
  };
  requiredStatus: Array<{ field: string; label: string; mapped: boolean; letter: string | null }>;
  requiredOk: boolean;
  totalDataRows: number;
  previewTruncated: boolean;
}

function Stat({ icon, label, value, tone = 'default' }: { icon: React.ReactNode; label: string; value: number | string; tone?: 'default' | 'warn' | 'info' }) {
  const toneCls =
    tone === 'warn' ? 'text-amber-700 dark:text-amber-400'
      : tone === 'info' ? 'text-blue-700 dark:text-blue-400'
      : 'text-foreground';
  return (
    <div className="flex items-center gap-2 rounded-md border bg-card px-3 py-2 w-40 shrink-0">
      <span className="text-muted-foreground shrink-0">{icon}</span>
      <div className="leading-tight min-w-0">
        <div className={`text-lg font-semibold ${toneCls}`}>{value}</div>
        <div className="text-[11px] text-muted-foreground truncate">{label}</div>
      </div>
    </div>
  );
}

export function MappingSummary({ summary, requiredStatus, requiredOk, totalDataRows, previewTruncated }: Props) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Stat icon={<Package className="h-4 w-4" />} label="Purchase Orders" value={summary.po_count} />
        <Stat icon={<Layers className="h-4 w-4" />} label="Styles" value={summary.style_count} />
        <Stat icon={<Store className="h-4 w-4" />} label="Already in system" value={summary.existing_count} tone={summary.existing_count ? 'info' : 'default'} />
        <Stat icon={<Database className="h-4 w-4" />} label="Stored as notes" value={summary.metadata_columns} tone="info" />
        <Stat icon={<AlertTriangle className="h-4 w-4" />} label="Rows w/ warnings" value={summary.warning_rows} tone={summary.warning_rows ? 'warn' : 'default'} />
        <Stat icon={<XCircle className="h-4 w-4" />} label="Rows skipped" value={summary.excluded_rows} tone={summary.excluded_rows ? 'warn' : 'default'} />
      </div>

      {/* Required-field checklist */}
      <div className="rounded-md border p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">Required fields</span>
          {requiredOk ? (
            <Badge className="bg-emerald-600"><CheckCircle2 className="h-3 w-3 mr-1" />All mapped</Badge>
          ) : (
            <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Map all to continue</Badge>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {requiredStatus.map((r) => (
            <span
              key={r.field}
              className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs ${
                r.mapped
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                  : 'border-red-300 bg-red-50 text-red-800 dark:bg-red-950/40 dark:text-red-300'
              }`}
            >
              {r.mapped ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
              {r.label}
              {r.mapped && r.letter && <span className="font-mono opacity-70">· col {r.letter}</span>}
            </span>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
        <span className="font-medium">Column legend:</span>
        <LegendDot className="bg-emerald-500" label="Mapped to a field" />
        <LegendDot className="bg-teal-500" label="Size column" />
        <LegendDot className="bg-blue-500" label="Stored as note (kept, unstructured)" />
        <LegendDot className="bg-muted-foreground/40" label="Ignored" />
        <span className="ml-auto">
          {totalDataRows.toLocaleString()} data rows{previewTruncated ? ' (preview truncated)' : ''}
        </span>
      </div>
    </div>
  );
}

function LegendDot({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`h-2.5 w-2.5 rounded-sm ${className}`} />
      {label}
    </span>
  );
}
