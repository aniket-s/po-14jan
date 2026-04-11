'use client';

// Disable static generation for this authenticated page
export const dynamic = 'force-dynamic';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Package, ListChecks, Plus, FileUp, LayoutGrid, TableIcon, ChevronLeft, ChevronRight,
} from 'lucide-react';
import api from '@/lib/api';
import { ListPageSkeleton } from '@/components/skeletons';
import { BulkSampleProcessModal } from '@/components/styles/BulkSampleProcessModal';
import { CreateStyleDialog } from '@/components/styles/CreateStyleDialog';
import { EditStyleDialog } from '@/components/styles/EditStyleDialog';
import { DeleteStyleConfirmation } from '@/components/styles/DeleteStyleConfirmation';
import { Style, PaginatedStyles } from '@/services/styles';

import { StyleKPICards } from '@/components/styles/StyleKPICards';
import { StyleFilterBar, StyleFilters } from '@/components/styles/StyleFilterBar';
import { StyleCardGrid } from '@/components/styles/StyleCardGrid';
import { StyleTableView } from '@/components/styles/StyleTableView';
import { StyleDetailPanel } from '@/components/styles/StyleDetailPanel';

export default function StylesPage() {
  const { user, can, loading: authLoading } = useAuth();
  const router = useRouter();

  // Data
  const [styles, setStyles] = useState<Style[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ currentPage: 1, lastPage: 1, perPage: 20, total: 0 });

  // Filters
  const [filters, setFilters] = useState<StyleFilters>({
    search: '', brand: 'all', retailer: 'all', season: 'all', category: 'all',
  });
  const [kpiFilter, setKpiFilter] = useState<string>('');

  // Master data for filters
  const [brands, setBrands] = useState<any[]>([]);
  const [retailers, setRetailers] = useState<any[]>([]);
  const [seasons, setSeasons] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);

  // View & selection
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [selectedStyle, setSelectedStyle] = useState<Style | null>(null);
  const [detailStyle, setDetailStyle] = useState<Style | null>(null);

  // Dialogs
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isSampleProcessModalOpen, setIsSampleProcessModalOpen] = useState(false);

  // Fetch filter data
  useEffect(() => {
    const fetchFilterData = async () => {
      try {
        const [brandsRes, retailersRes, seasonsRes, categoriesRes] = await Promise.all([
          api.get('/master-data/brands?all=true'),
          api.get('/master-data/retailers?all=true'),
          api.get('/master-data/seasons?all=true'),
          api.get('/master-data/categories?all=true'),
        ]);
        setBrands(brandsRes.data || []);
        setRetailers(retailersRes.data || []);
        setSeasons(seasonsRes.data || []);
        setCategories(categoriesRes.data || []);
      } catch (error) {
        console.error('Failed to fetch filter data:', error);
      }
    };
    fetchFilterData();
  }, []);

  // Fetch styles with debounce for search
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchStyles();
    }, filters.search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [pagination.currentPage, filters.search, filters.brand, filters.retailer]);

  const fetchStyles = async () => {
    try {
      setLoading(true);
      const params: any = { page: pagination.currentPage, per_page: pagination.perPage };
      if (filters.search) params.search = filters.search;
      if (filters.brand !== 'all') params.brand_id = filters.brand;
      if (filters.retailer !== 'all') params.retailer_id = filters.retailer;

      const response = await api.get<PaginatedStyles>('/styles', { params });
      setStyles(response.data.data);
      setPagination({
        currentPage: response.data.current_page,
        lastPage: response.data.last_page,
        perPage: response.data.per_page,
        total: response.data.total,
      });
    } catch (error) {
      console.error('Failed to fetch styles:', error);
    } finally {
      setLoading(false);
    }
  };

  // Local filters (season, category, KPI)
  const filteredStyles = useMemo(() => {
    let result = styles;

    if (filters.season !== 'all') {
      result = result.filter(s => s.season_id?.toString() === filters.season);
    }
    if (filters.category !== 'all') {
      result = result.filter(s => s.category_id?.toString() === filters.category);
    }

    // KPI filters
    if (kpiFilter === 'active') {
      result = result.filter(s => s.is_active !== false);
    } else if (kpiFilter === 'used_in_pos') {
      result = result.filter(s => s.purchase_orders && s.purchase_orders.length > 0);
    } else if (kpiFilter === 'not_in_pos') {
      result = result.filter(s => !s.purchase_orders || s.purchase_orders.length === 0);
    }

    return result;
  }, [styles, filters.season, filters.category, kpiFilter]);

  // Selection
  const toggleSelect = useCallback((id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === filteredStyles.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredStyles.map(s => s.id)));
    }
  }, [selectedIds.size, filteredStyles]);

  // Clear selection when data changes
  useEffect(() => { setSelectedIds(new Set()); }, [styles]);

  // Actions
  const handleEdit = (style: Style) => { setSelectedStyle(style); setIsEditDialogOpen(true); };
  const handleDelete = (style: Style) => { setSelectedStyle(style); setIsDeleteDialogOpen(true); };

  // Pagination
  const startItem = (pagination.currentPage - 1) * pagination.perPage + 1;
  const endItem = Math.min(pagination.currentPage * pagination.perPage, pagination.total);
  const getPageNumbers = () => {
    const pages: (number | '...')[] = [];
    const tp = pagination.lastPage;
    const cp = pagination.currentPage;
    if (tp <= 5) { for (let i = 1; i <= tp; i++) pages.push(i); }
    else {
      pages.push(1);
      if (cp > 3) pages.push('...');
      for (let i = Math.max(2, cp - 1); i <= Math.min(tp - 1, cp + 1); i++) pages.push(i);
      if (cp < tp - 2) pages.push('...');
      pages.push(tp);
    }
    return pages;
  };

  if (loading && styles.length === 0) {
    return (
      <DashboardLayout requiredPermissions={['style.view', 'style.view_own', 'style.create', 'style.edit']} requireAll={false}>
        <ListPageSkeleton statCards={4} filterCount={4} columns={10} />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout requiredPermissions={['style.view', 'style.view_own', 'style.create', 'style.edit']} requireAll={false}>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Styles</h1>
            <p className="text-sm text-muted-foreground">
              Manage your style library - create styles and add them to purchase orders
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* View Toggle */}
            <div className="flex items-center rounded-lg border bg-muted p-0.5">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                size="sm"
                className="h-7 px-2.5 text-xs"
                onClick={() => setViewMode('grid')}
              >
                <LayoutGrid className="h-3.5 w-3.5 mr-1" />
                Grid
              </Button>
              <Button
                variant={viewMode === 'table' ? 'default' : 'ghost'}
                size="sm"
                className="h-7 px-2.5 text-xs"
                onClick={() => setViewMode('table')}
              >
                <TableIcon className="h-3.5 w-3.5 mr-1" />
                Table
              </Button>
            </div>

            {/* Bulk actions */}
            {selectedIds.size > 0 && can('style.edit') && (
              <>
                <Badge variant="secondary" className="text-xs">{selectedIds.size} selected</Badge>
                <Button size="sm" className="h-8" onClick={() => setIsSampleProcessModalOpen(true)}>
                  <ListChecks className="mr-1.5 h-3.5 w-3.5" />
                  Sample Process
                </Button>
              </>
            )}

            {can('style.create') && (
              <>
                <Button size="sm" className="h-8" onClick={() => setIsCreateDialogOpen(true)}>
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Create Style
                </Button>
                <Button variant="outline" size="sm" className="h-8" onClick={() => router.push('/styles/import')}>
                  <FileUp className="mr-1.5 h-3.5 w-3.5" />
                  Import Excel
                </Button>
              </>
            )}
          </div>
        </div>

        {/* KPI Cards */}
        <StyleKPICards
          styles={styles}
          total={pagination.total}
          activeFilter={kpiFilter}
          onFilterClick={setKpiFilter}
        />

        {/* Filter Bar */}
        <StyleFilterBar
          filters={filters}
          onFiltersChange={setFilters}
          brands={brands}
          retailers={retailers}
          seasons={seasons}
          categories={categories}
        />

        {/* Main Content */}
        <div className="flex gap-4 min-h-[400px]">
          {/* Left: Grid or Table */}
          <div className={`flex-1 min-w-0 ${detailStyle ? 'hidden lg:block' : ''}`}>
            {viewMode === 'grid' ? (
              <StyleCardGrid
                styles={filteredStyles}
                selectedIds={selectedIds}
                onToggleSelect={toggleSelect}
                selectedStyleId={detailStyle?.id || null}
                onSelectStyle={setDetailStyle}
                onEdit={handleEdit}
                onDelete={handleDelete}
                canEdit={can('style.edit')}
                canDelete={can('style.delete')}
              />
            ) : (
              <StyleTableView
                styles={filteredStyles}
                selectedIds={selectedIds}
                onToggleSelect={toggleSelect}
                onToggleSelectAll={toggleSelectAll}
                selectedStyleId={detailStyle?.id || null}
                onSelectStyle={setDetailStyle}
                onEdit={handleEdit}
                onDelete={handleDelete}
                canEdit={can('style.edit')}
                canDelete={can('style.delete')}
              />
            )}
          </div>

          {/* Right: Detail Panel */}
          {detailStyle && (
            <div className="w-full lg:w-[380px] shrink-0">
              <StyleDetailPanel
                style={detailStyle}
                onClose={() => setDetailStyle(null)}
                onEdit={handleEdit}
                onDelete={handleDelete}
                canEdit={can('style.edit')}
                canDelete={can('style.delete')}
              />
            </div>
          )}
        </div>

        {/* Pagination */}
        {pagination.lastPage > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Showing {startItem}-{endItem} of {pagination.total} styles
            </p>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" className="h-8 w-8 p-0"
                onClick={() => setPagination(p => ({ ...p, currentPage: Math.max(1, p.currentPage - 1) }))}
                disabled={pagination.currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              {getPageNumbers().map((page, idx) =>
                page === '...' ? (
                  <span key={`dots-${idx}`} className="px-1 text-muted-foreground text-sm">...</span>
                ) : (
                  <Button key={page} variant={pagination.currentPage === page ? 'default' : 'outline'}
                    size="sm" className="h-8 w-8 p-0 text-xs"
                    onClick={() => setPagination(p => ({ ...p, currentPage: page as number }))}
                  >
                    {page}
                  </Button>
                )
              )}
              <Button variant="outline" size="sm" className="h-8 w-8 p-0"
                onClick={() => setPagination(p => ({ ...p, currentPage: Math.min(p.lastPage, p.currentPage + 1) }))}
                disabled={pagination.currentPage === pagination.lastPage}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Dialogs (unchanged) */}
      <BulkSampleProcessModal
        open={isSampleProcessModalOpen}
        onOpenChange={setIsSampleProcessModalOpen}
        selectedStyleIds={Array.from(selectedIds)}
        onSuccess={() => { setSelectedIds(new Set()); fetchStyles(); }}
      />
      <CreateStyleDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onSuccess={fetchStyles}
      />
      <EditStyleDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        style={selectedStyle}
        onSuccess={() => { fetchStyles(); setSelectedStyle(null); setDetailStyle(null); }}
      />
      <DeleteStyleConfirmation
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        style={selectedStyle}
        onSuccess={() => { fetchStyles(); setSelectedStyle(null); setDetailStyle(null); }}
      />
    </DashboardLayout>
  );
}
