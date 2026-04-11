'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  X,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  Trash2,
  Loader2,
  Plus,
  User,
  Calendar,
  Hash,
  FileText,
} from 'lucide-react';
import { Sample, TimelineEvent } from './types';
import { SampleImageGallery } from './SampleImageGallery';
import api from '@/lib/api';

interface SampleDetailPanelProps {
  sample: Sample;
  onClose: () => void;
  onApprove?: (sample: Sample, type: 'agency' | 'importer') => void;
  onReject?: (sample: Sample, type: 'agency' | 'importer') => void;
  onResubmit?: (sample: Sample) => void;
  onDelete?: (sample: Sample) => void;
  canApproveAgency?: boolean;
  canApproveImporter?: boolean;
  canResubmit?: boolean;
  canDelete?: boolean;
}

export function SampleDetailPanel({
  sample,
  onClose,
  onApprove,
  onReject,
  onResubmit,
  onDelete,
  canApproveAgency,
  canApproveImporter,
  canResubmit,
  canDelete,
}: SampleDetailPanelProps) {
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [fullSample, setFullSample] = useState<any>(null);

  useEffect(() => {
    fetchDetails();
  }, [sample.id]);

  const fetchDetails = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/samples/${sample.id}/timeline`);
      setFullSample(response.data.sample);
      setTimeline(response.data.timeline || []);
    } catch (error) {
      console.error('Failed to fetch sample details:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline'; className: string }> = {
      approved: { variant: 'default', className: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900 dark:text-green-300' },
      rejected: { variant: 'destructive', className: '' },
      pending: { variant: 'secondary', className: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900 dark:text-amber-300' },
    };
    const config = variants[status] || variants.pending;
    return (
      <Badge variant={config.variant} className={config.className}>
        {status === 'approved' && <CheckCircle className="h-3 w-3 mr-1" />}
        {status === 'rejected' && <XCircle className="h-3 w-3 mr-1" />}
        {status === 'pending' && <Clock className="h-3 w-3 mr-1" />}
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const getTimelineIcon = (action: string) => {
    if (action === 'created') return <Plus className="h-3.5 w-3.5 text-blue-500" />;
    if (action.includes('approved')) return <CheckCircle className="h-3.5 w-3.5 text-green-500" />;
    if (action.includes('rejected')) return <XCircle className="h-3.5 w-3.5 text-red-500" />;
    if (action.includes('resubmitted')) return <RefreshCw className="h-3.5 w-3.5 text-blue-500" />;
    return <Clock className="h-3.5 w-3.5 text-gray-400" />;
  };

  const getTimelineBorderColor = (action: string) => {
    if (action.includes('approved')) return 'border-green-500';
    if (action.includes('rejected')) return 'border-red-500';
    if (action.includes('resubmitted') || action === 'created') return 'border-blue-500';
    return 'border-gray-300';
  };

  const displaySample = fullSample || sample;

  return (
    <div className="flex flex-col h-full border-l bg-card">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="space-y-1 min-w-0">
          <h3 className="font-semibold text-sm truncate">
            {displaySample.sample_type?.display_name || displaySample.sample_type?.name}
          </h3>
          <p className="text-xs text-muted-foreground">
            {displaySample.style?.style_number} - {displaySample.sample_reference || 'No Ref'}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} className="h-7 w-7 p-0 shrink-0">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center flex-1">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-5">
            {/* Approval Pipeline */}
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Approval Pipeline
              </h4>
              <div className="flex items-center gap-2">
                <div className="flex-1 text-center">
                  <div className={`rounded-lg border p-2.5 ${
                    displaySample.agency_status === 'approved'
                      ? 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800'
                      : displaySample.agency_status === 'rejected'
                        ? 'bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800'
                        : 'bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-800'
                  }`}>
                    <p className="text-[10px] font-medium text-muted-foreground uppercase mb-1">Agency</p>
                    {getStatusBadge(displaySample.agency_status)}
                  </div>
                </div>
                <div className="text-muted-foreground text-lg shrink-0">→</div>
                <div className="flex-1 text-center">
                  <div className={`rounded-lg border p-2.5 ${
                    displaySample.agency_status !== 'approved'
                      ? 'bg-muted border-border opacity-50'
                      : displaySample.importer_status === 'approved'
                        ? 'bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800'
                        : displaySample.importer_status === 'rejected'
                          ? 'bg-red-50 border-red-200 dark:bg-red-950 dark:border-red-800'
                          : 'bg-amber-50 border-amber-200 dark:bg-amber-950 dark:border-amber-800'
                  }`}>
                    <p className="text-[10px] font-medium text-muted-foreground uppercase mb-1">Importer</p>
                    {displaySample.agency_status !== 'approved' && displaySample.importer_status === 'pending'
                      ? <Badge variant="outline" className="text-muted-foreground">Waiting</Badge>
                      : getStatusBadge(displaySample.importer_status)
                    }
                  </div>
                </div>
              </div>

              {/* Rejection reasons */}
              {displaySample.agency_rejection_reason && (
                <div className="mt-2 rounded-md bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 p-2">
                  <p className="text-xs font-medium text-red-800 dark:text-red-300">Agency rejection:</p>
                  <p className="text-xs text-red-700 dark:text-red-400 mt-0.5">{displaySample.agency_rejection_reason}</p>
                </div>
              )}
              {displaySample.importer_rejection_reason && (
                <div className="mt-2 rounded-md bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 p-2">
                  <p className="text-xs font-medium text-red-800 dark:text-red-300">Importer rejection:</p>
                  <p className="text-xs text-red-700 dark:text-red-400 mt-0.5">{displaySample.importer_rejection_reason}</p>
                </div>
              )}
            </div>

            <Separator />

            {/* Details Grid */}
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Details
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-start gap-2">
                  <User className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[10px] text-muted-foreground">Submitted by</p>
                    <p className="text-xs font-medium">{displaySample.submitted_by?.name || 'N/A'}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[10px] text-muted-foreground">Date</p>
                    <p className="text-xs font-medium">
                      {displaySample.submission_date
                        ? new Date(displaySample.submission_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                        : 'N/A'}
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Hash className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[10px] text-muted-foreground">PO Number</p>
                    <p className="text-xs font-medium">{displaySample.style?.purchase_orders?.[0]?.po_number || 'N/A'}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <FileText className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[10px] text-muted-foreground">Reference</p>
                    <p className="text-xs font-medium">{displaySample.sample_reference || 'N/A'}</p>
                  </div>
                </div>
                {displaySample.quantity && (
                  <div className="flex items-start gap-2">
                    <Hash className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                    <div>
                      <p className="text-[10px] text-muted-foreground">Quantity</p>
                      <p className="text-xs font-medium">{displaySample.quantity}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Notes */}
            {displaySample.notes && (
              <>
                <Separator />
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Notes
                  </h4>
                  <p className="text-sm bg-muted/50 rounded-md p-2.5 leading-relaxed">
                    {displaySample.notes}
                  </p>
                </div>
              </>
            )}

            {/* Files */}
            {((displaySample.images && displaySample.images.length > 0) ||
              (displaySample.attachment_paths && displaySample.attachment_paths.length > 0)) && (
              <>
                <Separator />
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Attachments
                  </h4>
                  <SampleImageGallery
                    images={displaySample.images || []}
                    documents={displaySample.attachment_paths || []}
                    title=""
                  />
                </div>
              </>
            )}

            {/* Timeline */}
            {timeline.length > 0 && (
              <>
                <Separator />
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                    Activity Timeline
                  </h4>
                  <div className="space-y-0">
                    {timeline.map((event, idx) => (
                      <div key={event.id || idx} className="flex gap-2.5 pb-3 last:pb-0">
                        <div className="flex flex-col items-center">
                          <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 bg-background ${getTimelineBorderColor(event.action)}`}>
                            {getTimelineIcon(event.action)}
                          </div>
                          {idx < timeline.length - 1 && (
                            <div className="w-px flex-1 bg-border min-h-[12px]" />
                          )}
                        </div>
                        <div className="flex-1 pt-0.5 min-w-0">
                          <p className="text-xs font-medium">{event.description || event.action}</p>
                          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mt-0.5">
                            {event.user_name && <span>{event.user_name}</span>}
                            {event.user_name && event.created_at && <span>-</span>}
                            {event.created_at && (
                              <span>
                                {new Date(event.created_at).toLocaleDateString('en-US', {
                                  month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
                                })}
                              </span>
                            )}
                          </div>
                          {(event.metadata?.rejection_reason || event.metadata?.reason) && (
                            <p className="text-[10px] text-red-600 dark:text-red-400 mt-0.5">
                              {event.metadata.rejection_reason || event.metadata.reason}
                            </p>
                          )}
                          {event.metadata?.comments && (
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              {event.metadata.comments}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </ScrollArea>
      )}

      {/* Action Bar */}
      {(canApproveAgency || canApproveImporter || canResubmit || canDelete) && (
        <div className="border-t p-3 space-y-2">
          {canApproveAgency && (
            <div className="flex gap-2">
              <Button
                size="sm"
                className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                onClick={() => onApprove?.(sample, 'agency')}
              >
                <CheckCircle className="mr-1.5 h-3.5 w-3.5" />
                Approve as Agency
              </Button>
              <Button
                size="sm"
                variant="destructive"
                className="flex-1"
                onClick={() => onReject?.(sample, 'agency')}
              >
                <XCircle className="mr-1.5 h-3.5 w-3.5" />
                Reject
              </Button>
            </div>
          )}
          {canApproveImporter && (
            <div className="flex gap-2">
              <Button
                size="sm"
                className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                onClick={() => onApprove?.(sample, 'importer')}
              >
                <CheckCircle className="mr-1.5 h-3.5 w-3.5" />
                Approve as Importer
              </Button>
              <Button
                size="sm"
                variant="destructive"
                className="flex-1"
                onClick={() => onReject?.(sample, 'importer')}
              >
                <XCircle className="mr-1.5 h-3.5 w-3.5" />
                Reject
              </Button>
            </div>
          )}
          {canResubmit && (
            <Button
              size="sm"
              variant="outline"
              className="w-full"
              onClick={() => onResubmit?.(sample)}
            >
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              Resubmit Sample
            </Button>
          )}
          {canDelete && (
            <Button
              size="sm"
              variant="ghost"
              className="w-full text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
              onClick={() => onDelete?.(sample)}
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              Delete Sample
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
