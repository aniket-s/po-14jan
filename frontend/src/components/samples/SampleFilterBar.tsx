'use client';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, X, Filter } from 'lucide-react';
import { SampleType, SampleFilters } from './types';

interface SampleFilterBarProps {
  filters: SampleFilters;
  onFiltersChange: (filters: SampleFilters) => void;
  sampleTypes: SampleType[];
  hasQuickFilter?: boolean;
  quickFilterLabel?: string;
  onQuickFilter?: () => void;
}

export function SampleFilterBar({
  filters,
  onFiltersChange,
  sampleTypes,
  hasQuickFilter,
  quickFilterLabel,
  onQuickFilter,
}: SampleFilterBarProps) {
  const activeFilterCount = [
    filters.status !== 'all' ? 1 : 0,
    filters.sampleType !== 'all' ? 1 : 0,
    filters.dateRange !== 'all' ? 1 : 0,
    filters.search ? 1 : 0,
  ].reduce((a, b) => a + b, 0);

  const clearFilters = () => {
    onFiltersChange({
      search: '',
      status: 'all',
      sampleType: 'all',
      dateRange: 'all',
    });
  };

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap rounded-lg border bg-card p-3">
      {/* Search */}
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by style, PO, reference..."
          value={filters.search}
          onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
          className="pl-8 h-9"
        />
      </div>

      {/* Status */}
      <Select
        value={filters.status}
        onValueChange={(value) => onFiltersChange({ ...filters, status: value })}
      >
        <SelectTrigger className="w-[140px] h-9">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Status</SelectItem>
          <SelectItem value="pending">Pending</SelectItem>
          <SelectItem value="approved">Approved</SelectItem>
          <SelectItem value="rejected">Rejected</SelectItem>
        </SelectContent>
      </Select>

      {/* Sample Type */}
      <Select
        value={filters.sampleType}
        onValueChange={(value) => onFiltersChange({ ...filters, sampleType: value })}
      >
        <SelectTrigger className="w-[160px] h-9">
          <SelectValue placeholder="Sample Type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Types</SelectItem>
          {sampleTypes.filter(st => st.is_active).map((st) => (
            <SelectItem key={st.id} value={st.id.toString()}>
              {st.display_name || st.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Date Range */}
      <Select
        value={filters.dateRange}
        onValueChange={(value) => onFiltersChange({ ...filters, dateRange: value })}
      >
        <SelectTrigger className="w-[140px] h-9">
          <SelectValue placeholder="Date Range" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Time</SelectItem>
          <SelectItem value="today">Today</SelectItem>
          <SelectItem value="week">This Week</SelectItem>
          <SelectItem value="month">This Month</SelectItem>
          <SelectItem value="quarter">This Quarter</SelectItem>
        </SelectContent>
      </Select>

      {/* Quick filter button */}
      {hasQuickFilter && onQuickFilter && (
        <Button
          variant="outline"
          size="sm"
          className="h-9 text-amber-700 border-amber-300 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800 dark:hover:bg-amber-900"
          onClick={onQuickFilter}
        >
          <Filter className="mr-1.5 h-3.5 w-3.5" />
          {quickFilterLabel || 'My Pending'}
        </Button>
      )}

      {/* Active filter count + clear */}
      {activeFilterCount > 0 && (
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="h-6">
            {activeFilterCount} filter{activeFilterCount > 1 ? 's' : ''}
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-muted-foreground"
            onClick={clearFilters}
          >
            <X className="mr-1 h-3 w-3" />
            Clear
          </Button>
        </div>
      )}
    </div>
  );
}
