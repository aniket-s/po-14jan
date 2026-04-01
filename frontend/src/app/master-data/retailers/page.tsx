'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Plus, Search, Edit, Trash2, Store } from 'lucide-react';
import api from '@/lib/api';
import { MasterDataPageSkeleton } from '@/components/skeletons';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';

interface RetailerData {
  id: number;
  name: string;
  code: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  zip_code: string | null;
  contact_info: any | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const retailerSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  code: z.string().optional().or(z.literal('')),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  phone: z.string().optional(),
  contact_info: z.string().optional(),
  is_active: z.boolean(),
});

type RetailerFormData = z.infer<typeof retailerSchema>;

export default function RetailersPage() {
  const { user, can, loading: authLoading } = useAuth();
  const [retailers, setRetailers] = useState<RetailerData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingRetailer, setEditingRetailer] = useState<RetailerData | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<RetailerFormData>({
    resolver: zodResolver(retailerSchema),
    defaultValues: {
      name: '',
      code: '',
      email: '',
      phone: '',
      contact_info: '',
      is_active: true,
    },
  });

  useEffect(() => {
    if (!authLoading) {
      fetchRetailers();
    }
  }, [authLoading]);

  const fetchRetailers = async () => {
    try {
      setLoading(true);
      const response = await api.get('/master-data/retailers?all=true');
      setRetailers(response.data || []);
    } catch (error) {
      console.error('Failed to fetch retailers:', error);
      toast.error('Failed to load retailers');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingRetailer(null);
    reset({
      name: '',
      code: '',
      email: '',
      phone: '',
      contact_info: '',
      is_active: true,
    });
    setDialogOpen(true);
  };

  const handleEdit = (retailer: RetailerData) => {
    setEditingRetailer(retailer);
    reset({
      name: retailer.name,
      code: retailer.code,
      email: retailer.email || '',
      phone: retailer.phone || '',
      contact_info: typeof retailer.contact_info === 'string'
        ? retailer.contact_info
        : JSON.stringify(retailer.contact_info || ''),
      is_active: retailer.is_active,
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this retailer?')) {
      return;
    }

    try {
      await api.delete(`/master-data/retailers/${id}`);
      toast.success('Retailer deleted successfully');
      fetchRetailers();
    } catch (error: any) {
      console.error('Failed to delete retailer:', error);
      toast.error(error.response?.data?.message || 'Failed to delete retailer');
    }
  };

  const onSubmit = async (data: RetailerFormData) => {
    try {
      setIsSubmitting(true);

      if (editingRetailer) {
        await api.put(`/master-data/retailers/${editingRetailer.id}`, data);
        toast.success('Retailer updated successfully');
      } else {
        await api.post('/master-data/retailers', data);
        toast.success('Retailer created successfully');
      }

      setDialogOpen(false);
      fetchRetailers();
      reset();
    } catch (error: any) {
      console.error('Failed to save retailer:', error);
      toast.error(error.response?.data?.message || 'Failed to save retailer');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredRetailers = retailers.filter((retailer) =>
    retailer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    retailer.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (retailer.email && retailer.email.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (authLoading || loading) {
    return (
      <DashboardLayout requiredPermissions={['po.create', 'po.edit', 'style.create', 'style.edit', 'admin.configuration.view']} requireAll={false}>
        <MasterDataPageSkeleton columns={6} />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout requiredPermissions={['po.create', 'po.edit', 'style.create', 'style.edit', 'admin.configuration.view']} requireAll={false}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Store className="h-8 w-8" />
              Retailers
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage retailer partners and buyers
            </p>
          </div>
          {can('admin.configuration.edit') && (
            <Button onClick={handleCreate}>
              <Plus className="h-4 w-4 mr-2" />
              Add Retailer
            </Button>
          )}
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search retailers..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRetailers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      No retailers found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRetailers.map((retailer) => (
                    <TableRow key={retailer.id}>
                      <TableCell className="font-medium">{retailer.code}</TableCell>
                      <TableCell>{retailer.name}</TableCell>
                      <TableCell>{retailer.email || '-'}</TableCell>
                      <TableCell>{retailer.phone || '-'}</TableCell>
                      <TableCell>
                        <Badge variant={retailer.is_active ? 'default' : 'secondary'}>
                          {retailer.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {can('admin.configuration.edit') && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEdit(retailer)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(retailer.id)}
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingRetailer ? 'Edit Retailer' : 'Create Retailer'}
            </DialogTitle>
            <DialogDescription>
              {editingRetailer
                ? 'Update retailer information'
                : 'Add a new retailer partner'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="code">Retailer Code *</Label>
                <Input
                  id="code"
                  placeholder="RET-001"
                  {...register('code')}
                />
                {errors.code && (
                  <p className="text-sm text-destructive">{errors.code.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Retailer Name *</Label>
                <Input
                  id="name"
                  placeholder="ABC Retail Co."
                  {...register('name')}
                />
                {errors.name && (
                  <p className="text-sm text-destructive">{errors.name.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="contact@retailer.com"
                  {...register('email')}
                />
                {errors.email && (
                  <p className="text-sm text-destructive">{errors.email.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  placeholder="+1 234 567 8900"
                  {...register('phone')}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="contact_info">Contact Information</Label>
              <Textarea
                id="contact_info"
                placeholder="Additional contact details, addresses, notes..."
                rows={3}
                {...register('contact_info')}
              />
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="is_active"
                {...register('is_active')}
                className="h-4 w-4"
              />
              <Label htmlFor="is_active" className="cursor-pointer">
                Active
              </Label>
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
                {isSubmitting ? 'Saving...' : editingRetailer ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
