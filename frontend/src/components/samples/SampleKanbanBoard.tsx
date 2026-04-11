'use client';

import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  CheckCircle,
  XCircle,
  Clock,
  User,
  Image as ImageIcon,
  FileText,
  AlertTriangle,
} from 'lucide-react';
import { Sample } from './types';
import { cn } from '@/lib/utils';

interface SampleKanbanBoardProps {
  samples: Sample[];
  selectedSampleId: number | null;
  onSelectSample: (sample: Sample) => void;
  role: 'factory' | 'agency' | 'importer' | 'other';
}

interface KanbanColumn {
  key: string;
  title: string;
  description: string;
  color: string;
  borderColor: string;
  bgColor: string;
  icon: React.ReactNode;
  filter: (s: Sample) => boolean;
}

export function SampleKanbanBoard({
  samples,
  selectedSampleId,
  onSelectSample,
  role,
}: SampleKanbanBoardProps) {
  const columns: KanbanColumn[] = [
    {
      key: 'submitted',
      title: 'Submitted',
      description: 'Awaiting agency review',
      color: 'text-blue-700 dark:text-blue-400',
      borderColor: 'border-blue-300 dark:border-blue-700',
      bgColor: 'bg-blue-50/50 dark:bg-blue-950/30',
      icon: <Clock className="h-4 w-4 text-blue-500" />,
      filter: (s) => s.agency_status === 'pending',
    },
    {
      key: 'agency_review',
      title: 'Agency Approved',
      description: 'Passed to importer',
      color: 'text-amber-700 dark:text-amber-400',
      borderColor: 'border-amber-300 dark:border-amber-700',
      bgColor: 'bg-amber-50/50 dark:bg-amber-950/30',
      icon: <CheckCircle className="h-4 w-4 text-amber-500" />,
      filter: (s) => s.agency_status === 'approved' && s.importer_status === 'pending',
    },
    {
      key: 'completed',
      title: 'Approved',
      description: 'Fully approved',
      color: 'text-green-700 dark:text-green-400',
      borderColor: 'border-green-300 dark:border-green-700',
      bgColor: 'bg-green-50/50 dark:bg-green-950/30',
      icon: <CheckCircle className="h-4 w-4 text-green-500" />,
      filter: (s) => s.final_status === 'approved',
    },
    {
      key: 'rejected',
      title: 'Rejected',
      description: 'Needs attention',
      color: 'text-red-700 dark:text-red-400',
      borderColor: 'border-red-300 dark:border-red-700',
      bgColor: 'bg-red-50/50 dark:bg-red-950/30',
      icon: <XCircle className="h-4 w-4 text-red-500" />,
      filter: (s) => s.final_status === 'rejected',
    },
  ];

  const getAgingLabel = (sample: Sample) => {
    const submittedDate = new Date(sample.submission_date || sample.created_at);
    const daysDiff = Math.floor((Date.now() - submittedDate.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDiff >= 5 && sample.final_status === 'pending') return { label: `${daysDiff}d`, color: 'text-red-600 bg-red-100 dark:bg-red-900' };
    if (daysDiff >= 2 && sample.final_status === 'pending') return { label: `${daysDiff}d`, color: 'text-amber-600 bg-amber-100 dark:bg-amber-900' };
    return null;
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 min-h-[400px]">
      {columns.map((column) => {
        const columnSamples = samples.filter(column.filter);
        return (
          <div
            key={column.key}
            className={cn(
              'rounded-lg border-2 flex flex-col',
              column.borderColor,
              column.bgColor,
            )}
          >
            {/* Column Header */}
            <div className="p-3 border-b border-border/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {column.icon}
                  <h3 className={cn('text-sm font-semibold', column.color)}>
                    {column.title}
                  </h3>
                </div>
                <Badge variant="secondary" className="h-5 text-[10px]">
                  {columnSamples.length}
                </Badge>
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {column.description}
              </p>
            </div>

            {/* Column Body */}
            <ScrollArea className="flex-1 p-2">
              <div className="space-y-2">
                {columnSamples.length === 0 ? (
                  <div className="text-center py-8 text-xs text-muted-foreground">
                    No samples
                  </div>
                ) : (
                  columnSamples.map((sample) => {
                    const aging = getAgingLabel(sample);
                    const isSelected = selectedSampleId === sample.id;
                    return (
                      <button
                        key={sample.id}
                        onClick={() => onSelectSample(sample)}
                        className={cn(
                          'w-full text-left rounded-md border bg-card p-3 space-y-2 transition-all hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary',
                          isSelected && 'ring-2 ring-primary shadow-md',
                        )}
                      >
                        {/* Card Header */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-xs font-semibold truncate">
                              {sample.sample_type?.display_name || sample.sample_type?.name}
                            </p>
                            <p className="text-[10px] text-muted-foreground truncate">
                              {sample.style?.style_number}
                            </p>
                          </div>
                          {aging && (
                            <Badge variant="outline" className={cn('shrink-0 text-[9px] px-1.5 py-0', aging.color)}>
                              <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
                              {aging.label}
                            </Badge>
                          )}
                        </div>

                        {/* Card Meta */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                            <User className="h-2.5 w-2.5" />
                            <span className="truncate max-w-[80px]">{sample.submitted_by?.name || 'N/A'}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {sample.images && sample.images.length > 0 && (
                              <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                                <ImageIcon className="h-2.5 w-2.5" />
                                {sample.images.length}
                              </span>
                            )}
                            {sample.attachment_paths && sample.attachment_paths.length > 0 && (
                              <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                                <FileText className="h-2.5 w-2.5" />
                                {sample.attachment_paths.length}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* PO Number */}
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-muted-foreground">
                            {sample.style?.purchase_orders?.[0]?.po_number || ''}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {(sample.submission_date || sample.created_at)
                              ? new Date(sample.submission_date || sample.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                              : '-'}
                          </span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </div>
        );
      })}
    </div>
  );
}
