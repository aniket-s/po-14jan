'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  CheckCircle,
  XCircle,
  Clock,
  ChevronDown,
  ChevronRight,
  Eye,
  RefreshCw,
  Trash2,
  Image as ImageIcon,
  FileText,
} from 'lucide-react';
import { Sample, SampleType } from './types';
import { SampleProgressTracker } from './SampleProgressTracker';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/dateUtils';

interface SampleTableViewProps {
  samples: Sample[];
  sampleTypes: SampleType[];
  selectedSampleId: number | null;
  onSelectSample: (sample: Sample) => void;
  onApprove?: (sample: Sample, type: 'agency' | 'importer') => void;
  onReject?: (sample: Sample, type: 'agency' | 'importer') => void;
  onResubmit?: (sample: Sample) => void;
  onDelete?: (sample: Sample) => void;
  onBulkApprove?: (sampleIds: number[], type: 'agency' | 'importer') => void;
  onBulkReject?: (sampleIds: number[], type: 'agency' | 'importer') => void;
  canApproveAsAgency: (sample: Sample) => boolean;
  canApproveAsImporter: (sample: Sample) => boolean;
  canResubmitSample: (sample: Sample) => boolean;
  canDeleteSample: (sample: Sample) => boolean;
  role: 'factory' | 'agency' | 'importer' | 'other';
}

interface GroupedSamples {
  key: string;
  styleNumber: string;
  poNumber: string;
  samples: Sample[];
}

export function SampleTableView({
  samples,
  sampleTypes,
  selectedSampleId,
  onSelectSample,
  onApprove,
  onReject,
  onResubmit,
  onDelete,
  onBulkApprove,
  onBulkReject,
  canApproveAsAgency,
  canApproveAsImporter,
  canResubmitSample,
  canDeleteSample,
  role,
}: SampleTableViewProps) {
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Clear selection when data changes (e.g., after bulk approve/reject)
  useEffect(() => {
    setSelectedIds(new Set());
  }, [samples]);

  // Group samples by style
  const grouped: GroupedSamples[] = [];
  const groupMap = new Map<string, GroupedSamples>();

  samples.forEach((sample) => {
    const key = `${sample.style_id}`;
    if (!groupMap.has(key)) {
      const group: GroupedSamples = {
        key,
        styleNumber: sample.style?.style_number || 'Unknown',
        poNumber: sample.style?.purchase_orders?.[0]?.po_number || 'N/A',
        samples: [],
      };
      groupMap.set(key, group);
      grouped.push(group);
    }
    groupMap.get(key)!.samples.push(sample);
  });

  const toggleGroup = (key: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === samples.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(samples.map(s => s.id)));
    }
  };

  const getStatusBadge = (status: string, dimmed?: boolean) => {
    return (
      <Badge
        variant={status === 'approved' ? 'default' : status === 'rejected' ? 'destructive' : 'secondary'}
        className={cn(
          'text-[10px]',
          status === 'approved' && 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900 dark:text-green-300',
          status === 'pending' && 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900 dark:text-amber-300',
          dimmed && 'opacity-50',
        )}
      >
        {status === 'approved' && <CheckCircle className="h-2.5 w-2.5 mr-0.5" />}
        {status === 'rejected' && <XCircle className="h-2.5 w-2.5 mr-0.5" />}
        {status === 'pending' && <Clock className="h-2.5 w-2.5 mr-0.5" />}
        {status}
      </Badge>
    );
  };

  const getFinalStatusBadge = (sample: Sample) => {
    const status = sample.final_status;
    return (
      <div className="flex items-center gap-1.5">
        {status === 'approved' && <CheckCircle className="h-3.5 w-3.5 text-green-500" />}
        {status === 'rejected' && <XCircle className="h-3.5 w-3.5 text-red-500" />}
        {status === 'pending' && <Clock className="h-3.5 w-3.5 text-amber-500" />}
        <span className={cn(
          'text-xs font-medium capitalize',
          status === 'approved' && 'text-green-700 dark:text-green-400',
          status === 'rejected' && 'text-red-700 dark:text-red-400',
          status === 'pending' && 'text-amber-700 dark:text-amber-400',
        )}>
          {status}
        </span>
      </div>
    );
  };

  const bulkApprovalType = role === 'agency' ? 'agency' : role === 'importer' ? 'importer' : null;
  const selectedSamples = samples.filter(s => selectedIds.has(s.id));
  const canBulkApprove = bulkApprovalType && selectedSamples.length > 0 && selectedSamples.every(s =>
    bulkApprovalType === 'agency' ? canApproveAsAgency(s) : canApproveAsImporter(s)
  );

  return (
    <div className="space-y-3">
      {/* Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 rounded-lg border bg-muted/50 p-3 animate-in slide-in-from-top-2">
          <span className="text-sm font-medium">
            {selectedIds.size} sample{selectedIds.size > 1 ? 's' : ''} selected
          </span>
          {canBulkApprove && (
            <>
              <Button
                size="sm"
                className="bg-green-600 hover:bg-green-700 text-white h-7"
                onClick={() => onBulkApprove?.(Array.from(selectedIds), bulkApprovalType!)}
              >
                <CheckCircle className="mr-1 h-3 w-3" />
                Approve All
              </Button>
              <Button
                size="sm"
                variant="destructive"
                className="h-7"
                onClick={() => onBulkReject?.(Array.from(selectedIds), bulkApprovalType!)}
              >
                <XCircle className="mr-1 h-3 w-3" />
                Reject All
              </Button>
            </>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="h-7 ml-auto"
            onClick={() => setSelectedIds(new Set())}
          >
            Clear
          </Button>
        </div>
      )}

      {/* Table */}
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-10">
                <Checkbox
                  checked={selectedIds.size === samples.length && samples.length > 0}
                  onCheckedChange={toggleSelectAll}
                />
              </TableHead>
              <TableHead className="w-8" />
              <TableHead className="text-xs">Sample Type</TableHead>
              <TableHead className="text-xs">Style / PO</TableHead>
              <TableHead className="text-xs">Submitted By</TableHead>
              <TableHead className="text-xs">Agency</TableHead>
              <TableHead className="text-xs">Importer</TableHead>
              <TableHead className="text-xs">Status</TableHead>
              <TableHead className="text-xs">Date</TableHead>
              <TableHead className="text-xs text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {grouped.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="text-center py-12 text-muted-foreground">
                  No samples found
                </TableCell>
              </TableRow>
            ) : (
              grouped.map((group) => {
                const isExpanded = !collapsedGroups.has(group.key);
                return (
                  <GroupRows
                    key={group.key}
                    group={group}
                    isExpanded={isExpanded}
                    onToggle={() => toggleGroup(group.key)}
                    selectedIds={selectedIds}
                    onToggleSelect={toggleSelect}
                    selectedSampleId={selectedSampleId}
                    onSelectSample={onSelectSample}
                    sampleTypes={sampleTypes}
                    getStatusBadge={getStatusBadge}
                    getFinalStatusBadge={getFinalStatusBadge}
                    onApprove={onApprove}
                    onReject={onReject}
                    onResubmit={onResubmit}
                    onDelete={onDelete}
                    canApproveAsAgency={canApproveAsAgency}
                    canApproveAsImporter={canApproveAsImporter}
                    canResubmitSample={canResubmitSample}
                    canDeleteSample={canDeleteSample}
                  />
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// Extracted group rows for readability
function GroupRows({
  group,
  isExpanded,
  onToggle,
  selectedIds,
  onToggleSelect,
  selectedSampleId,
  onSelectSample,
  sampleTypes,
  getStatusBadge,
  getFinalStatusBadge,
  onApprove,
  onReject,
  onResubmit,
  onDelete,
  canApproveAsAgency,
  canApproveAsImporter,
  canResubmitSample,
  canDeleteSample,
}: {
  group: GroupedSamples;
  isExpanded: boolean;
  onToggle: () => void;
  selectedIds: Set<number>;
  onToggleSelect: (id: number) => void;
  selectedSampleId: number | null;
  onSelectSample: (sample: Sample) => void;
  sampleTypes: SampleType[];
  getStatusBadge: (status: string, dimmed?: boolean) => React.ReactNode;
  getFinalStatusBadge: (sample: Sample) => React.ReactNode;
  onApprove?: (sample: Sample, type: 'agency' | 'importer') => void;
  onReject?: (sample: Sample, type: 'agency' | 'importer') => void;
  onResubmit?: (sample: Sample) => void;
  onDelete?: (sample: Sample) => void;
  canApproveAsAgency: (sample: Sample) => boolean;
  canApproveAsImporter: (sample: Sample) => boolean;
  canResubmitSample: (sample: Sample) => boolean;
  canDeleteSample: (sample: Sample) => boolean;
}) {
  return (
    <>
      {/* Group Header */}
      <TableRow
        className="bg-muted/30 hover:bg-muted/50 cursor-pointer"
        onClick={onToggle}
      >
        <TableCell colSpan={2}>
          <div className="flex items-center gap-1">
            {isExpanded
              ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
              : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            }
          </div>
        </TableCell>
        <TableCell colSpan={3}>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold">{group.styleNumber}</span>
            <span className="text-[10px] text-muted-foreground">PO: {group.poNumber}</span>
            <Badge variant="outline" className="text-[10px]">{group.samples.length} samples</Badge>
          </div>
        </TableCell>
        <TableCell colSpan={5}>
          <SampleProgressTracker
            samples={group.samples}
            sampleTypes={sampleTypes}
            compact
          />
        </TableCell>
      </TableRow>

      {/* Group Samples */}
      {isExpanded && group.samples.map((sample) => {
        const isSelected = selectedSampleId === sample.id;
        return (
          <TableRow
            key={sample.id}
            className={cn(
              'cursor-pointer transition-colors',
              isSelected && 'bg-primary/5 hover:bg-primary/10',
            )}
            onClick={() => onSelectSample(sample)}
          >
            <TableCell onClick={(e) => e.stopPropagation()}>
              <Checkbox
                checked={selectedIds.has(sample.id)}
                onCheckedChange={() => onToggleSelect(sample.id)}
              />
            </TableCell>
            <TableCell>
              <div className={cn(
                'w-1 h-8 rounded-full',
                sample.final_status === 'approved' && 'bg-green-500',
                sample.final_status === 'rejected' && 'bg-red-500',
                sample.final_status === 'pending' && 'bg-amber-400',
              )} />
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium">
                  {sample.sample_type?.display_name || sample.sample_type?.name}
                </span>
                {sample.images && sample.images.length > 0 && (
                  <ImageIcon className="h-3 w-3 text-muted-foreground" />
                )}
                {sample.attachment_paths && sample.attachment_paths.length > 0 && (
                  <FileText className="h-3 w-3 text-muted-foreground" />
                )}
              </div>
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-2">
                {sample.style?.images && sample.style.images.length > 0 && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={sample.style.images[0]}
                    alt={sample.style.style_number}
                    className="h-8 w-8 rounded object-cover border bg-muted"
                  />
                )}
                <div>
                  <p className="text-xs">{sample.style?.style_number}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {sample.style?.purchase_orders?.[0]?.po_number}
                  </p>
                </div>
              </div>
            </TableCell>
            <TableCell>
              <span className="text-xs">{sample.submitted_by?.name || 'N/A'}</span>
            </TableCell>
            <TableCell>
              {getStatusBadge(sample.agency_status)}
            </TableCell>
            <TableCell>
              {sample.agency_status !== 'approved' && sample.importer_status === 'pending'
                ? <Badge variant="outline" className="text-[10px] text-muted-foreground">Awaiting</Badge>
                : getStatusBadge(sample.importer_status)
              }
            </TableCell>
            <TableCell>
              {getFinalStatusBadge(sample)}
            </TableCell>
            <TableCell>
              <span className="text-xs text-muted-foreground">
                {formatDate(sample.submission_date || sample.created_at, '-')}
              </span>
            </TableCell>
            <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
              <div className="flex justify-end gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => onSelectSample(sample)}
                  title="View details"
                >
                  <Eye className="h-3.5 w-3.5" />
                </Button>
                {canApproveAsAgency(sample) && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-950"
                      onClick={() => onApprove?.(sample, 'agency')}
                      title="Approve as Agency"
                    >
                      <CheckCircle className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                      onClick={() => onReject?.(sample, 'agency')}
                      title="Reject as Agency"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                    </Button>
                  </>
                )}
                {canApproveAsImporter(sample) && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-950"
                      onClick={() => onApprove?.(sample, 'importer')}
                      title="Approve as Importer"
                    >
                      <CheckCircle className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                      onClick={() => onReject?.(sample, 'importer')}
                      title="Reject as Importer"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                    </Button>
                  </>
                )}
                {canResubmitSample(sample) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950"
                    onClick={() => onResubmit?.(sample)}
                    title="Resubmit"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                  </Button>
                )}
                {canDeleteSample(sample) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                    onClick={() => onDelete?.(sample)}
                    title="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </TableCell>
          </TableRow>
        );
      })}
    </>
  );
}
