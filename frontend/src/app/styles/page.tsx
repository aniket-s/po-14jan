'use client';

// Disable static generation for this authenticated page
export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Package, Search, ListChecks, Plus, Edit, Trash2, FileUp } from 'lucide-react';
import api from '@/lib/api';
import { BulkSampleProcessModal } from '@/components/styles/BulkSampleProcessModal';
import { CreateStyleDialog } from '@/components/styles/CreateStyleDialog';
import { EditStyleDialog } from '@/components/styles/EditStyleDialog';
import { DeleteStyleConfirmation } from '@/components/styles/DeleteStyleConfirmation';
import { ExcelImportDialog } from '@/components/styles/ExcelImportDialog';

import { Style, PaginatedStyles } from '@/services/styles';

export default function StylesPage() {
  const { user, can, loading: authLoading } = useAuth();
  const router = useRouter();
  const [styles, setStyles] = useState<Style[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    lastPage: 1,
    perPage: 20,
    total: 0,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [brandFilter, setBrandFilter] = useState('');
  const [retailerFilter, setRetailerFilter] = useState('');
  const [brands, setBrands] = useState<any[]>([]);
  const [retailers, setRetailers] = useState<any[]>([]);
  const [selectedStyles, setSelectedStyles] = useState<number[]>([]);
  const [isSampleProcessModalOpen, setIsSampleProcessModalOpen] = useState(false);

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isImportDialogOpen, setIsImportDialogOpen] = useState(false);
  const [selectedStyle, setSelectedStyle] = useState<Style | null>(null);

  useEffect(() => {
    if (authLoading) return;
  }, [authLoading]);

  useEffect(() => {
    const fetchFilterData = async () => {
      try {
        const [brandsResponse, retailersResponse] = await Promise.all([
          api.get('/master-data/brands?all=true'),
          api.get('/master-data/retailers?all=true'),
        ]);
        setBrands(brandsResponse.data || []);
        setRetailers(retailersResponse.data || []);
      } catch (error) {
        console.error('Failed to fetch filter data:', error);
      }
    };
    fetchFilterData();
  }, []);

  const fetchStyles = async () => {
    try {
      setLoading(true);
      const params: any = {
        page: pagination.currentPage,
        per_page: pagination.perPage,
      };

      if (searchQuery) {
        params.search = searchQuery;
      }

      if (brandFilter) {
        params.brand_id = brandFilter;
      }

      if (retailerFilter) {
        params.retailer_id = retailerFilter;
      }

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

  useEffect(() => {
    fetchStyles();
  }, [pagination.currentPage, searchQuery, brandFilter, retailerFilter]);

  const formatCurrency = (amount: number | null | undefined, currency: string = 'USD') => {
    if (amount === null || amount === undefined) {
      return '-';
    }
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedStyles(styles.map(s => s.id));
    } else {
      setSelectedStyles([]);
    }
  };

  const handleSelectStyle = (styleId: number, checked: boolean) => {
    if (checked) {
      setSelectedStyles(prev => [...prev, styleId]);
    } else {
      setSelectedStyles(prev => prev.filter(id => id !== styleId));
    }
  };

  const isAllSelected = styles.length > 0 && selectedStyles.length === styles.length;

  const handleEdit = (style: Style) => {
    setSelectedStyle(style);
    setIsEditDialogOpen(true);
  };

  const handleDelete = (style: Style) => {
    setSelectedStyle(style);
    setIsDeleteDialogOpen(true);
  };

  if (loading && styles.length === 0) {
    return (
      <DashboardLayout requiredPermissions={['style.view', 'style.view_own', 'style.create', 'style.edit']} requireAll={false}>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout requiredPermissions={['style.view', 'style.view_own', 'style.create', 'style.edit']} requireAll={false}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Styles</h1>
            <p className="text-muted-foreground mt-1">
              Manage your style library - create styles independently and add them to purchase orders
            </p>
          </div>
          <div className="flex items-center gap-2">
            {selectedStyles.length > 0 && (
              <>
                <Badge variant="secondary" className="text-sm">
                  {selectedStyles.length} selected
                </Badge>
                <Button
                  onClick={() => setIsSampleProcessModalOpen(true)}
                  disabled={selectedStyles.length === 0}
                >
                  <ListChecks className="mr-2 h-4 w-4" />
                  Change Sample Process
                </Button>
              </>
            )}
            {can('style.create') && (
              <>
                <Button onClick={() => setIsCreateDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Style
                </Button>
                <Button variant="outline" onClick={() => setIsImportDialogOpen(true)}>
                  <FileUp className="mr-2 h-4 w-4" />
                  Import from Excel
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-1">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Styles</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pagination.total}</div>
            </CardContent>
          </Card>
        </div>

        {/* Search & Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Search & Filter Styles</CardTitle>
            <CardDescription>Search by style number or filter by brand/retailer</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by style number, name, or PO number..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="brand-filter">Filter by Brand</Label>
                  <select
                    id="brand-filter"
                    value={brandFilter}
                    onChange={(e) => setBrandFilter(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="">All Brands</option>
                    {brands.map((brand) => (
                      <option key={brand.id} value={brand.id}>
                        {brand.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="retailer-filter">Filter by Retailer</Label>
                  <select
                    id="retailer-filter"
                    value={retailerFilter}
                    onChange={(e) => setRetailerFilter(e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="">All Retailers</option>
                    {retailers.map((retailer) => (
                      <option key={retailer.id} value={retailer.id}>
                        {retailer.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {(brandFilter || retailerFilter) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setBrandFilter('');
                    setRetailerFilter('');
                  }}
                >
                  Clear Filters
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Styles Table */}
        <Card>
          <CardHeader>
            <CardTitle>Styles</CardTitle>
            <CardDescription>
              Showing {styles.length} of {pagination.total} styles
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={isAllSelected}
                        onCheckedChange={handleSelectAll}
                        aria-label="Select all styles"
                      />
                    </TableHead>
                    <TableHead>Style Number</TableHead>
                    <TableHead>Style Name</TableHead>
                    <TableHead>Fabric / Weight</TableHead>
                    <TableHead>Color</TableHead>
                    <TableHead>Retailer</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Used in POs</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {styles.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                        <Package className="h-12 w-12 mx-auto mb-2 opacity-50" />
                        <p>No styles found</p>
                        {can('style.create') && (
                          <Button
                            variant="link"
                            onClick={() => setIsCreateDialogOpen(true)}
                            className="mt-2"
                          >
                            Create your first style
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ) : (
                    styles.map((style) => {
                      return (
                        <TableRow key={style.id}>
                          <TableCell>
                            <Checkbox
                              checked={selectedStyles.includes(style.id)}
                              onCheckedChange={(checked) => handleSelectStyle(style.id, checked as boolean)}
                              aria-label={`Select style ${style.style_number}`}
                            />
                          </TableCell>
                          <TableCell className="font-medium">{style.style_number}</TableCell>
                          <TableCell>
                            <span className="text-sm truncate max-w-xs block">
                              {style.description || '-'}
                            </span>
                          </TableCell>
                          <TableCell>
                            {style.fabric_type_name || style.fabric_weight ? (
                              <div className="space-y-0.5">
                                {style.fabric_type_name && <div className="text-sm">{style.fabric_type_name}</div>}
                                {style.fabric_weight && <div className="text-xs text-muted-foreground">{style.fabric_weight}</div>}
                              </div>
                            ) : (
                              '-'
                            )}
                          </TableCell>
                          <TableCell>
                            {style.color?.name ? (
                              <Badge variant="outline">
                                {style.color.name}
                                {style.color.code && <span className="ml-1 text-xs opacity-70">({style.color.code})</span>}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {style.retailer?.name || '-'}
                          </TableCell>
                          <TableCell>
                            {style.category?.name || '-'}
                          </TableCell>
                          <TableCell>
                            {style.purchase_orders && style.purchase_orders.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {style.purchase_orders.map((po: any) => (
                                  <Button
                                    key={po.id}
                                    variant="link"
                                    size="sm"
                                    onClick={() => router.push(`/purchase-orders/${po.id}`)}
                                    className="h-auto p-0"
                                  >
                                    {po.po_number}
                                  </Button>
                                ))}
                              </div>
                            ) : (
                              <span className="text-muted-foreground text-sm">Not used yet</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEdit(style)}
                                title="Edit style"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(style)}
                                className="text-destructive hover:text-destructive"
                                title="Delete style"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {pagination.lastPage > 1 && (
              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-muted-foreground">
                  Page {pagination.currentPage} of {pagination.lastPage}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setPagination({ ...pagination, currentPage: pagination.currentPage - 1 })
                    }
                    disabled={pagination.currentPage === 1}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setPagination({ ...pagination, currentPage: pagination.currentPage + 1 })
                    }
                    disabled={pagination.currentPage === pagination.lastPage}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-900">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              About Styles Library
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              <strong>Styles are now managed independently!</strong> Create your style library first,
              then add styles to purchase orders as needed. This allows you to:
            </p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li>Create styles in bulk (manual or Excel import)</li>
              <li>Reuse the same style across multiple purchase orders</li>
              <li>Set different quantities and prices per PO</li>
              <li>Update style master data without affecting existing POs</li>
              <li>Track which POs are using each style</li>
            </ul>
            <p className="pt-2">
              <strong>Workflow:</strong>
            </p>
            <ol className="list-decimal list-inside space-y-1 ml-4">
              <li>Create styles using "Create Style" or "Import from Excel"</li>
              <li>When creating a PO, select styles from your library</li>
              <li>Set PO-specific quantities, prices, and assignments</li>
              <li>The same style can be used in multiple POs with different settings</li>
            </ol>
          </CardContent>
        </Card>
      </div>

      {/* Bulk Sample Process Modal */}
      <BulkSampleProcessModal
        open={isSampleProcessModalOpen}
        onOpenChange={setIsSampleProcessModalOpen}
        selectedStyleIds={selectedStyles}
        onSuccess={() => {
          setSelectedStyles([]);
          fetchStyles();
        }}
      />

      <CreateStyleDialog
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        onSuccess={() => {
          fetchStyles();
        }}
      />

      <EditStyleDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        style={selectedStyle}
        onSuccess={() => {
          fetchStyles();
          setSelectedStyle(null);
        }}
      />

      <DeleteStyleConfirmation
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        style={selectedStyle}
        onSuccess={() => {
          fetchStyles();
          setSelectedStyle(null);
        }}
      />

      <ExcelImportDialog
        open={isImportDialogOpen}
        onOpenChange={setIsImportDialogOpen}
        onSuccess={() => {
          fetchStyles();
        }}
      />
    </DashboardLayout>
  );
}
