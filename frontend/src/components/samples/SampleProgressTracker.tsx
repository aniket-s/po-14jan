'use client';

import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, Clock, Circle } from 'lucide-react';
import { Sample, SampleType } from './types';
import { cn } from '@/lib/utils';

interface SampleProgressTrackerProps {
  samples: Sample[];
  sampleTypes: SampleType[];
  compact?: boolean;
}

export function SampleProgressTracker({
  samples,
  sampleTypes,
  compact = false,
}: SampleProgressTrackerProps) {
  const activeSampleTypes = sampleTypes
    .filter(st => st.is_active)
    .sort((a, b) => a.display_order - b.display_order);

  const getSampleForType = (typeId: number) => {
    return samples.find(s => s.sample_type_id === typeId);
  };

  const getStepStatus = (typeId: number): 'approved' | 'rejected' | 'pending' | 'not_started' => {
    const sample = getSampleForType(typeId);
    if (!sample) return 'not_started';
    return sample.final_status as 'approved' | 'rejected' | 'pending';
  };

  const completedCount = activeSampleTypes.filter(
    st => getStepStatus(st.id) === 'approved'
  ).length;

  const progressPercent = activeSampleTypes.length > 0
    ? Math.round((completedCount / activeSampleTypes.length) * 100)
    : 0;

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex gap-0.5">
          {activeSampleTypes.map((st) => {
            const status = getStepStatus(st.id);
            return (
              <div
                key={st.id}
                className={cn(
                  'h-2 w-4 rounded-sm transition-colors',
                  status === 'approved' && 'bg-green-500',
                  status === 'rejected' && 'bg-red-500',
                  status === 'pending' && 'bg-amber-400',
                  status === 'not_started' && 'bg-muted',
                )}
                title={`${st.display_name || st.name}: ${status === 'not_started' ? 'Not Started' : status}`}
              />
            );
          })}
        </div>
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {completedCount}/{activeSampleTypes.length}
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Progress bar */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-green-500 rounded-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">
          {completedCount}/{activeSampleTypes.length} complete
        </span>
      </div>

      {/* Steps */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {activeSampleTypes.map((st, index) => {
          const status = getStepStatus(st.id);
          const sample = getSampleForType(st.id);
          return (
            <div key={st.id} className="flex items-center">
              <div
                className={cn(
                  'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium border transition-colors whitespace-nowrap',
                  status === 'approved' && 'bg-green-50 border-green-200 text-green-700 dark:bg-green-950 dark:border-green-800 dark:text-green-400',
                  status === 'rejected' && 'bg-red-50 border-red-200 text-red-700 dark:bg-red-950 dark:border-red-800 dark:text-red-400',
                  status === 'pending' && 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-950 dark:border-amber-800 dark:text-amber-400',
                  status === 'not_started' && 'bg-muted border-border text-muted-foreground',
                )}
                title={sample ? `${status} - ${sample.submission_date}` : 'Not submitted'}
              >
                {status === 'approved' && <CheckCircle className="h-3 w-3" />}
                {status === 'rejected' && <XCircle className="h-3 w-3" />}
                {status === 'pending' && <Clock className="h-3 w-3" />}
                {status === 'not_started' && <Circle className="h-3 w-3" />}
                {st.display_name || st.name}
              </div>
              {index < activeSampleTypes.length - 1 && (
                <div className={cn(
                  'w-4 h-px mx-0.5 shrink-0',
                  status === 'approved' ? 'bg-green-300' : 'bg-border',
                )} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
