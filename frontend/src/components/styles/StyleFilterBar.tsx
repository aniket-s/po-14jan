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

export interface StyleFilters {
  search: string;
  brand: string;
  retailer: string;
  season: string;
  category: string;
}

interface StyleFilterBarProps {
  filters: StyleFilters;
  onFiltersChange: (filters: StyleFilters) => void;
  brands: Array<{ id: number; name: string }>;
  retailers: Array<{ id: number; name: string }>;
  seasons: Array<{ id: number; name: string }>;
  categories: Array<{ id: number; name: string }>;
}

export function StyleFilterBar({
  filters,
  onFiltersChange,
  brands,
  retailers,
  seasons,
  categories,
}: StyleFilterBarProps) {
  const activeFilterCount = [
    filters.brand !== 'all' ? 1 : 0,
    filters.retailer !== 'all' ? 1 : 0,
    filters.season !== 'all' ? 1 : 0,
    filters.category !== 'all' ? 1 : 0,
    filters.search ? 1 : 0,
  ].reduce((a, b) => a + b, 0);

  const clearFilters = () => {
    onFiltersChange({ search: '', brand: 'all', retailer: 'all', season: 'all', category: 'all' });
  };

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:flex-wrap rounded-lg border bg-card p-3">
      <div className="relative flex-1 min-w-[220px]">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search style number, name, PO..."
          value={filters.search}
          onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
          className="pl-8 h-9"
        />
      </div>

      <Select value={filters.brand} onValueChange={(v) => onFiltersChange({ ...filters, brand: v })}>
        <SelectTrigger className="w-[130px] h-9"><SelectValue placeholder="Brand" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Brands</SelectItem>
          {brands.map((b) => <SelectItem key={b.id} value={b.id.toString()}>{b.name}</SelectItem>)}
        </SelectContent>
      </Select>

      <Select value={filters.retailer} onValueChange={(v) => onFiltersChange({ ...filters, retailer: v })}>
        <SelectTrigger className="w-[130px] h-9"><SelectValue placeholder="Retailer" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Retailers</SelectItem>
          {retailers.map((r) => <SelectItem key={r.id} value={r.id.toString()}>{r.name}</SelectItem>)}
        </SelectContent>
      </Select>

      <Select value={filters.season} onValueChange={(v) => onFiltersChange({ ...filters, season: v })}>
        <SelectTrigger className="w-[130px] h-9"><SelectValue placeholder="Season" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Seasons</SelectItem>
          {seasons.map((s) => <SelectItem key={s.id} value={s.id.toString()}>{s.name}</SelectItem>)}
        </SelectContent>
      </Select>

      <Select value={filters.category} onValueChange={(v) => onFiltersChange({ ...filters, category: v })}>
        <SelectTrigger className="w-[130px] h-9"><SelectValue placeholder="Category" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Categories</SelectItem>
          {categories.map((c) => <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>)}
        </SelectContent>
      </Select>

      {activeFilterCount > 0 && (
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="h-6">
            {activeFilterCount} filter{activeFilterCount > 1 ? 's' : ''}
          </Badge>
          <Button variant="ghost" size="sm" className="h-7 px-2 text-muted-foreground" onClick={clearFilters}>
            <X className="mr-1 h-3 w-3" />Clear
          </Button>
        </div>
      )}
    </div>
  );
}
