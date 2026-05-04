'use client';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Search, X, Filter, AlertTriangle } from 'lucide-react';
import type { POReportFilters, POReportLookups, POReportGroupBy } from './types';
import { DEFAULT_PO_REPORT_FILTERS } from './types';

interface Props {
  filters: POReportFilters;
  onFiltersChange: (next: POReportFilters) => void;
  lookups: POReportLookups;
  groupBy: POReportGroupBy;
  onGroupByChange: (g: POReportGroupBy) => void;
}

const GROUP_OPTIONS: Array<{ value: POReportGroupBy; label: string }> = [
  { value: 'none', label: 'No grouping' },
  { value: 'retailer', label: 'By Retailer' },
  { value: 'buyer', label: 'By Buyer' },
  { value: 'agency', label: 'By Agency' },
  { value: 'season', label: 'By Season' },
  { value: 'status', label: 'By Status' },
  { value: 'month', label: 'By PO Month' },
];

export function POReportFilterBar({
  filters,
  onFiltersChange,
  lookups,
  groupBy,
  onGroupByChange,
}: Props) {
  const update = <K extends keyof POReportFilters>(key: K, value: POReportFilters[K]) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const activeCount = [
    filters.search ? 1 : 0,
    filters.status !== 'all' ? 1 : 0,
    filters.retailer_id !== 'all' ? 1 : 0,
    filters.buyer_id !== 'all' ? 1 : 0,
    filters.agency_id !== 'all' ? 1 : 0,
    filters.season_id !== 'all' ? 1 : 0,
    filters.factory_id !== 'all' ? 1 : 0,
    filters.country_id !== 'all' ? 1 : 0,
    filters.shipping_term !== 'all' ? 1 : 0,
    filters.etd_overdue ? 1 : 0,
    filters.start_date ? 1 : 0,
    filters.end_date ? 1 : 0,
  ].reduce((a, b) => a + b, 0);

  const clearAll = () => onFiltersChange({ ...DEFAULT_PO_REPORT_FILTERS });

  return (
    <div className="rounded-lg border bg-card p-3 space-y-3">
      {/* Top row: search, group-by, overdue, clear */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search PO #, headline, buy sheet..."
            value={filters.search}
            onChange={(e) => update('search', e.target.value)}
            className="pl-8 h-9"
          />
        </div>

        <Select value={groupBy} onValueChange={(v) => onGroupByChange(v as POReportGroupBy)}>
          <SelectTrigger className="h-9 w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {GROUP_OPTIONS.map((g) => (
              <SelectItem key={g.value} value={g.value}>
                {g.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          variant={filters.etd_overdue ? 'default' : 'outline'}
          size="sm"
          className={`h-9 ${
            filters.etd_overdue
              ? ''
              : 'text-amber-700 border-amber-300 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800 dark:hover:bg-amber-900'
          }`}
          onClick={() => update('etd_overdue', !filters.etd_overdue)}
        >
          <AlertTriangle className="mr-1.5 h-3.5 w-3.5" />
          Overdue ETD
        </Button>

        {activeCount > 0 && (
          <div className="flex items-center gap-2 ml-auto">
            <Badge variant="secondary" className="h-6">
              {activeCount} filter{activeCount > 1 ? 's' : ''}
            </Badge>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-muted-foreground" onClick={clearAll}>
              <X className="mr-1 h-3 w-3" />
              Clear
            </Button>
          </div>
        )}
      </div>

      {/* Master-data filter row */}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        <FilterSelect
          label="Status"
          value={filters.status}
          onChange={(v) => update('status', v)}
          options={[
            { value: 'all', label: 'All Statuses' },
            { value: 'draft', label: 'Draft' },
            { value: 'active', label: 'Active' },
            { value: 'in_progress', label: 'In Progress' },
            { value: 'completed', label: 'Completed' },
            { value: 'cancelled', label: 'Cancelled' },
          ]}
        />
        <FilterSelect
          label="Retailer"
          value={filters.retailer_id}
          onChange={(v) => update('retailer_id', v)}
          options={[{ value: 'all', label: 'All Retailers' }, ...lookups.retailers.map((r) => ({ value: String(r.id), label: r.name }))]}
        />
        <FilterSelect
          label="Buyer"
          value={filters.buyer_id}
          onChange={(v) => update('buyer_id', v)}
          options={[
            { value: 'all', label: 'All Buyers' },
            ...lookups.buyers.map((b) => ({ value: String(b.id), label: b.code ? `${b.name} (${b.code})` : b.name })),
          ]}
        />
        <FilterSelect
          label="Agency"
          value={filters.agency_id}
          onChange={(v) => update('agency_id', v)}
          options={[{ value: 'all', label: 'All Agencies' }, ...lookups.agencies.map((a) => ({ value: String(a.id), label: a.name }))]}
        />
        <FilterSelect
          label="Season"
          value={filters.season_id}
          onChange={(v) => update('season_id', v)}
          options={[{ value: 'all', label: 'All Seasons' }, ...lookups.seasons.map((s) => ({ value: String(s.id), label: s.name }))]}
        />
        <FilterSelect
          label="Factory"
          value={filters.factory_id}
          onChange={(v) => update('factory_id', v)}
          options={[{ value: 'all', label: 'All Factories' }, ...lookups.factories.map((f) => ({ value: String(f.id), label: f.name }))]}
        />
        <FilterSelect
          label="Country"
          value={filters.country_id}
          onChange={(v) => update('country_id', v)}
          options={[{ value: 'all', label: 'All Countries' }, ...lookups.countries.map((c) => ({ value: String(c.id), label: c.name }))]}
        />
        <FilterSelect
          label="Shipping Term"
          value={filters.shipping_term}
          onChange={(v) => update('shipping_term', v)}
          options={[
            { value: 'all', label: 'All Terms' },
            { value: 'FOB', label: 'FOB' },
            { value: 'DDP', label: 'DDP' },
          ]}
        />
        <DateField label="PO from" value={filters.start_date} onChange={(v) => update('start_date', v)} />
        <DateField label="PO to" value={filters.end_date} onChange={(v) => update('end_date', v)} />
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px] font-medium text-muted-foreground">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-8">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px] font-medium text-muted-foreground">{label}</Label>
      <Input type="date" value={value} onChange={(e) => onChange(e.target.value)} className="h-8" />
    </div>
  );
}
