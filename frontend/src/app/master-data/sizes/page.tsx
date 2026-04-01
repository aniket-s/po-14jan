'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Plus, Search, Edit, Trash2, Package } from 'lucide-react';
import api from '@/lib/api';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';

interface SizeData {
  id: number;
  gender_id: number;
  size_code: string;
  size_name: string;
  description: string | null;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
  gender?: {
    id: number;
    name: string;
  };
}

interface Gender {
  id: number;
  name: string;
  code: string;
}

const sizeSchema = z.object({
  gender_id: z.coerce.number().min(1, 'Gender is required'),
  size_code: z.string().min(1, 'Size code is required').max(20),
  size_name: z.string().min(1, 'Size name is required').max(50),
  description: z.string().optional(),
  is_active: z.boolean(),
  display_order: z.coerce.number().min(0, 'Display order must be 0 or greater'),
});

type SizeFormData = z.infer<typeof sizeSchema>;

function SizesContent() {
  const searchParams = useSearchParams();
  const { user, can, loading: authLoading } = useAuth();
  const [sizes, setSizes] = useState<SizeData[]>([]);
  const [genders, setGenders] = useState<Gender[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterGenderId, setFilterGenderId] = useState<string>(searchParams.get('gender') || '');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSize, setEditingSize] = useState<SizeData | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedGenderId, setSelectedGenderId] = useState<string>('');

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<SizeFormData>({
    resolver: zodResolver(sizeSchema),
    defaultValues: {
      gender_id: 0,
      size_code: '',
      size_name: '',
      description: '',
      is_active: true,
      display_order: 0,
    },
  });

  useEffect(() => {
    if (!authLoading) {
      fetchSizes();
      fetchGenders();
    }
  }, [authLoading]);

  const fetchSizes = async () => {
    try {
      setLoading(true);
      const response = await api.get('/master-data/sizes?all=true');
      setSizes(response.data || []);
    } catch (error) {
      console.error('Failed to fetch sizes:', error);
      toast.error('Failed to load sizes');
    } finally {
      setLoading(false);
    }
  };

  const fetchGenders = async () => {
    try {
      const response = await api.get('/master-data/genders?active_only=true&all=true');
      setGenders(response.data || []);
    } catch (error) {
      console.error('Failed to fetch genders:', error);
    }
  };

  const handleCreate = () => {
    setEditingSize(null);
    reset({
      gender_id: 0,
      size_code: '',
      size_name: '',
      description: '',
      is_active: true,
      display_order: 0,
    });
    setSelectedGenderId('');
    setDialogOpen(true);
  };

  const handleEdit = (size: SizeData) => {
    setEditingSize(size);
    reset({
      gender_id: size.gender_id,
      size_code: size.size_code,
      size_name: size.size_name,
      description: size.description || '',
      is_active: size.is_active,
      display_order: size.display_order,
    });
    setSelectedGenderId(size.gender_id.toString());
    setDialogOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this size?')) return;

    try {
      await api.delete(`/master-data/sizes/${id}`);
      toast.success('Size deleted successfully');
      fetchSizes();
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Failed to delete size';
      toast.error(errorMessage);
    }
  };

  const onSubmit = async (data: SizeFormData) => {
    try {
      setIsSubmitting(true);

      if (editingSize) {
        await api.put(`/master-data/sizes/${editingSize.id}`, data);
        toast.success('Size updated successfully');
      } else {
        await api.post('/master-data/sizes', data);
        toast.success('Size created successfully');
      }

      setDialogOpen(false);
      fetchSizes();
      reset();
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Failed to save size';
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredSizes = sizes.filter(size => {
    const matchesSearch =
      size.size_code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      size.size_name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesGender = !filterGenderId || filterGenderId === 'all' || size.gender_id.toString() === filterGenderId;
    return matchesSearch && matchesGender;
  });

  return (
    <DashboardLayout requiredPermissions={['po.create', 'po.edit', 'style.create', 'style.edit', 'admin.configuration.view']} requireAll={false}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Sizes</h1>
            <p className="text-muted-foreground">
              Manage size options for different gender categories
            </p>
          </div>
          {can('admin.configuration.edit') && (
            <Button onClick={handleCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Add Size
            </Button>
          )}
        </div>

        {/* Search & Filter */}
        <Card>
          <CardHeader>
            <CardTitle>Search & Filter</CardTitle>
            <CardDescription>Search by code or name, filter by gender</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search sizes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
              <Select value={filterGenderId} onValueChange={setFilterGenderId}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Filter by gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Genders</SelectItem>
                  {genders.map((gender) => (
                    <SelectItem key={gender.id} value={gender.id.toString()}>
                      {gender.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle>Size List ({filteredSizes.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Loading...</div>
            ) : filteredSizes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No sizes found. Click "Add Size" to create one.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Gender</TableHead>
                    <TableHead>Size Code</TableHead>
                    <TableHead>Size Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Display Order</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSizes.map((size) => (
                    <TableRow key={size.id}>
                      <TableCell>
                        <Badge variant="outline">{size.gender?.name || 'N/A'}</Badge>
                      </TableCell>
                      <TableCell className="font-medium">{size.size_code}</TableCell>
                      <TableCell>{size.size_name}</TableCell>
                      <TableCell className="max-w-md truncate">
                        {size.description || '-'}
                      </TableCell>
                      <TableCell>{size.display_order}</TableCell>
                      <TableCell>
                        {size.is_active ? (
                          <Badge variant="default">Active</Badge>
                        ) : (
                          <Badge variant="secondary">Inactive</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {can('admin.configuration.edit') && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEdit(size)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleDelete(size.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Create/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                {editingSize ? 'Edit Size' : 'Create New Size'}
              </DialogTitle>
              <DialogDescription>
                {editingSize
                  ? 'Update the size information below.'
                  : 'Fill in the details to create a new size.'}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="gender_id" className="text-sm font-medium">
                  Gender *
                </label>
                <Select
                  value={selectedGenderId}
                  onValueChange={(value) => {
                    setSelectedGenderId(value);
                    setValue('gender_id', parseInt(value));
                  }}
                >
                  <SelectTrigger id="gender_id">
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent>
                    {genders.map((gender) => (
                      <SelectItem key={gender.id} value={gender.id.toString()}>
                        {gender.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.gender_id && (
                  <p className="text-sm text-destructive">{errors.gender_id.message}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="size_code" className="text-sm font-medium">
                    Size Code *
                  </label>
                  <Input
                    id="size_code"
                    placeholder="e.g., XS, S, M, L, XL"
                    {...register('size_code')}
                  />
                  {errors.size_code && (
                    <p className="text-sm text-destructive">{errors.size_code.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <label htmlFor="size_name" className="text-sm font-medium">
                    Size Name *
                  </label>
                  <Input
                    id="size_name"
                    placeholder="e.g., Extra Small, Small"
                    {...register('size_name')}
                  />
                  {errors.size_name && (
                    <p className="text-sm text-destructive">{errors.size_name.message}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="description" className="text-sm font-medium">
                  Description
                </label>
                <Textarea
                  id="description"
                  placeholder="Optional description..."
                  rows={3}
                  {...register('description')}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="display_order" className="text-sm font-medium">
                    Display Order *
                  </label>
                  <Input
                    id="display_order"
                    type="number"
                    min="0"
                    {...register('display_order')}
                  />
                  {errors.display_order && (
                    <p className="text-sm text-destructive">{errors.display_order.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <label htmlFor="is_active" className="text-sm font-medium">
                    Status
                  </label>
                  <div className="flex items-center space-x-2 pt-2">
                    <input
                      id="is_active"
                      type="checkbox"
                      className="h-4 w-4"
                      {...register('is_active')}
                    />
                    <label htmlFor="is_active" className="text-sm">
                      Active
                    </label>
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Saving...' : editingSize ? 'Update' : 'Create'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

export default function SizesPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
      <SizesContent />
    </Suspense>
  );
}
