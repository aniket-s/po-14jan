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
import { Search, X } from 'lucide-react';

export interface POFilters {
  search: string;
  status: string;
  shippingTerm: string;
  season: string;
  dateRange: string;
}

interface POFilterBarProps {
  filters: POFilters;
  onFiltersChange: (filters: POFilters) => void;
  seasons: Array<{ id: number; name: string }>;
}

export function POFilterBar({
  filters,
  onFiltersChange,
  seasons,
}: POFilterBarProps) {
  const activeFilterCount = [
    filters.status !== 'all' ? 1 : 0,
    filters.shippingTerm !== 'all' ? 1 : 0,
    filters.season !== 'all' ? 1 : 0,
    filters.dateRange !== 'all' ? 1 : 0,
    filters.search ? 1 : 0,
  ].reduce((a, b) => a + b, 0);

  const clearFilters = () => {
    onFiltersChange({
      search: '',
      status: 'all',
      shippingTerm: 'all',
      season: 'all',
      dateRange: 'all',
    });
  };

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap rounded-lg border bg-card p-3">
      {/* Search */}
      <div className="relative flex-1 min-w-[220px]">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search PO number, headline..."
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
        <SelectTrigger className="w-[130px] h-9">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Status</SelectItem>
          <SelectItem value="draft">Draft</SelectItem>
          <SelectItem value="active">Active</SelectItem>
          <SelectItem value="completed">Completed</SelectItem>
          <SelectItem value="cancelled">Cancelled</SelectItem>
        </SelectContent>
      </Select>

      {/* Shipping Term */}
      <Select
        value={filters.shippingTerm}
        onValueChange={(value) => onFiltersChange({ ...filters, shippingTerm: value })}
      >
        <SelectTrigger className="w-[120px] h-9">
          <SelectValue placeholder="Ship Term" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Terms</SelectItem>
          <SelectItem value="FOB">FOB</SelectItem>
          <SelectItem value="DDP">DDP</SelectItem>
        </SelectContent>
      </Select>

      {/* Season */}
      <Select
        value={filters.season}
        onValueChange={(value) => onFiltersChange({ ...filters, season: value })}
      >
        <SelectTrigger className="w-[140px] h-9">
          <SelectValue placeholder="Season" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Seasons</SelectItem>
          {seasons.map((s) => (
            <SelectItem key={s.id} value={s.id.toString()}>
              {s.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Date Range */}
      <Select
        value={filters.dateRange}
        onValueChange={(value) => onFiltersChange({ ...filters, dateRange: value })}
      >
        <SelectTrigger className="w-[130px] h-9">
          <SelectValue placeholder="Date" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Time</SelectItem>
          <SelectItem value="today">Today</SelectItem>
          <SelectItem value="week">This Week</SelectItem>
          <SelectItem value="month">This Month</SelectItem>
          <SelectItem value="quarter">This Quarter</SelectItem>
        </SelectContent>
      </Select>

      {/* Active count + clear */}
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
