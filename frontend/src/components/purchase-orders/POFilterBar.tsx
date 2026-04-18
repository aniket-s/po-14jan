'use client';

import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Search, X, SlidersHorizontal } from 'lucide-react';

export interface POFilters {
  search: string;
  status: string;
  shippingTerm: string;
  season: string;
  dateRange: string;
  retailer: string;
  importer: string;
  agency: string;
  buyer: string;
  country: string;
  warehouse: string;
  factory: string;
  etdFrom: string;
  etdTo: string;
  exFactoryFrom: string;
  exFactoryTo: string;
  valueMin: string;
  valueMax: string;
  quantityMin: string;
  quantityMax: string;
  revisedOnly: boolean;
  overdueEtd: boolean;
}

export const DEFAULT_PO_FILTERS: POFilters = {
  search: '',
  status: 'all',
  shippingTerm: 'all',
  season: 'all',
  dateRange: 'all',
  retailer: 'all',
  importer: 'all',
  agency: 'all',
  buyer: 'all',
  country: 'all',
  warehouse: 'all',
  factory: 'all',
  etdFrom: '',
  etdTo: '',
  exFactoryFrom: '',
  exFactoryTo: '',
  valueMin: '',
  valueMax: '',
  quantityMin: '',
  quantityMax: '',
  revisedOnly: false,
  overdueEtd: false,
};

type Option = { id: number; name: string };

interface POFilterBarProps {
  filters: POFilters;
  onFiltersChange: (filters: POFilters) => void;
  seasons: Option[];
  retailers?: Option[];
  importers?: Option[];
  agencies?: Option[];
  buyers?: Option[];
  countries?: Option[];
  warehouses?: Option[];
  factories?: Option[];
}

export function POFilterBar({
  filters,
  onFiltersChange,
  seasons,
  retailers = [],
  importers = [],
  agencies = [],
  buyers = [],
  countries = [],
  warehouses = [],
  factories = [],
}: POFilterBarProps) {
  const [moreOpen, setMoreOpen] = useState(false);

  const advancedActiveCount = useMemo(() => {
    let n = 0;
    if (filters.retailer !== 'all') n++;
    if (filters.importer !== 'all') n++;
    if (filters.agency !== 'all') n++;
    if (filters.buyer !== 'all') n++;
    if (filters.country !== 'all') n++;
    if (filters.warehouse !== 'all') n++;
    if (filters.factory !== 'all') n++;
    if (filters.etdFrom || filters.etdTo) n++;
    if (filters.exFactoryFrom || filters.exFactoryTo) n++;
    if (filters.valueMin || filters.valueMax) n++;
    if (filters.quantityMin || filters.quantityMax) n++;
    if (filters.revisedOnly) n++;
    if (filters.overdueEtd) n++;
    return n;
  }, [filters]);

  const activeFilterCount =
    advancedActiveCount +
    (filters.status !== 'all' ? 1 : 0) +
    (filters.shippingTerm !== 'all' ? 1 : 0) +
    (filters.season !== 'all' ? 1 : 0) +
    (filters.dateRange !== 'all' ? 1 : 0) +
    (filters.search ? 1 : 0);

  const update = (patch: Partial<POFilters>) =>
    onFiltersChange({ ...filters, ...patch });

  const clearFilters = () => onFiltersChange(DEFAULT_PO_FILTERS);

  const renderSelect = (
    label: string,
    value: string,
    onChange: (v: string) => void,
    options: Option[],
    extra?: { value: string; label: string }[],
  ) => (
    <div className="flex flex-col gap-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-9">
          <SelectValue placeholder={`All ${label}`} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All {label}</SelectItem>
          {extra?.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
          {options.map((o) => (
            <SelectItem key={o.id} value={o.id.toString()}>
              {o.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap rounded-lg border bg-card p-3">
      {/* Search */}
      <div className="relative flex-1 min-w-[220px]">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search PO number, headline..."
          value={filters.search}
          onChange={(e) => update({ search: e.target.value })}
          className="pl-8 h-9"
        />
      </div>

      {/* Status */}
      <Select value={filters.status} onValueChange={(v) => update({ status: v })}>
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
        onValueChange={(v) => update({ shippingTerm: v })}
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
      <Select value={filters.season} onValueChange={(v) => update({ season: v })}>
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
        onValueChange={(v) => update({ dateRange: v })}
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

      {/* More filters */}
      <Popover open={moreOpen} onOpenChange={setMoreOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-9">
            <SlidersHorizontal className="mr-1.5 h-3.5 w-3.5" />
            More filters
            {advancedActiveCount > 0 && (
              <Badge variant="secondary" className="ml-2 h-5 px-1.5">
                {advancedActiveCount}
              </Badge>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-[640px] max-h-[70vh] overflow-y-auto p-4">
          <div className="grid grid-cols-2 gap-3">
            {renderSelect('Retailer', filters.retailer, (v) => update({ retailer: v }), retailers)}
            {renderSelect('Importer', filters.importer, (v) => update({ importer: v }), importers)}
            {renderSelect(
              'Agency',
              filters.agency,
              (v) => update({ agency: v }),
              agencies,
              [{ value: 'unassigned', label: 'Unassigned' }],
            )}
            {renderSelect('Buyer', filters.buyer, (v) => update({ buyer: v }), buyers)}
            {renderSelect('Country', filters.country, (v) => update({ country: v }), countries)}
            {renderSelect('Warehouse', filters.warehouse, (v) => update({ warehouse: v }), warehouses)}
            {renderSelect('Factory', filters.factory, (v) => update({ factory: v }), factories)}
          </div>

          <div className="mt-4 border-t pt-4">
            <div className="text-xs font-semibold text-muted-foreground mb-2">
              ETD Date
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <Label className="text-xs text-muted-foreground">From</Label>
                <Input
                  type="date"
                  className="h-9"
                  value={filters.etdFrom}
                  onChange={(e) => update({ etdFrom: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs text-muted-foreground">To</Label>
                <Input
                  type="date"
                  className="h-9"
                  value={filters.etdTo}
                  onChange={(e) => update({ etdTo: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div className="mt-4 border-t pt-4">
            <div className="text-xs font-semibold text-muted-foreground mb-2">
              Ex-Factory Date
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <Label className="text-xs text-muted-foreground">From</Label>
                <Input
                  type="date"
                  className="h-9"
                  value={filters.exFactoryFrom}
                  onChange={(e) => update({ exFactoryFrom: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs text-muted-foreground">To</Label>
                <Input
                  type="date"
                  className="h-9"
                  value={filters.exFactoryTo}
                  onChange={(e) => update({ exFactoryTo: e.target.value })}
                />
              </div>
            </div>
          </div>

          <div className="mt-4 border-t pt-4 grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Total Value Min</Label>
              <Input
                type="number"
                inputMode="decimal"
                className="h-9"
                placeholder="0"
                value={filters.valueMin}
                onChange={(e) => update({ valueMin: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Total Value Max</Label>
              <Input
                type="number"
                inputMode="decimal"
                className="h-9"
                placeholder="No limit"
                value={filters.valueMax}
                onChange={(e) => update({ valueMax: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Quantity Min</Label>
              <Input
                type="number"
                inputMode="numeric"
                className="h-9"
                placeholder="0"
                value={filters.quantityMin}
                onChange={(e) => update({ quantityMin: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-xs text-muted-foreground">Quantity Max</Label>
              <Input
                type="number"
                inputMode="numeric"
                className="h-9"
                placeholder="No limit"
                value={filters.quantityMax}
                onChange={(e) => update({ quantityMax: e.target.value })}
              />
            </div>
          </div>

          <div className="mt-4 border-t pt-4 flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={filters.revisedOnly}
                onCheckedChange={(checked) =>
                  update({ revisedOnly: checked === true })
                }
              />
              Revised only
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={filters.overdueEtd}
                onCheckedChange={(checked) =>
                  update({ overdueEtd: checked === true })
                }
              />
              Overdue ETD
            </label>
          </div>
        </PopoverContent>
      </Popover>

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
