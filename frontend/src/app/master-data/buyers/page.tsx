'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { Plus, Search, Edit, Trash2, Users } from 'lucide-react';
import api from '@/lib/api';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';

interface BuyerData {
  id: number;
  name: string;
  code: string;
  description: string | null;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

const buyerSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  code: z.string().min(1, 'Code is required').max(50),
  description: z.string().optional(),
  is_active: z.boolean(),
  display_order: z.coerce.number().optional(),
});

type BuyerFormData = z.infer<typeof buyerSchema>;

export default function BuyersPage() {
  const { user, can, loading: authLoading } = useAuth();
  const [buyers, setBuyers] = useState<BuyerData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBuyer, setEditingBuyer] = useState<BuyerData | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<BuyerFormData>({
    resolver: zodResolver(buyerSchema),
    defaultValues: {
      name: '',
      code: '',
      description: '',
      is_active: true,
      display_order: 0,
    },
  });

  useEffect(() => {
    if (!authLoading) {
      fetchBuyers();
    }
  }, [authLoading]);

  const fetchBuyers = async () => {
    try {
      setLoading(true);
      const response = await api.get('/master-data/buyers?all=true');
      setBuyers(response.data || []);
    } catch (error) {
      console.error('Failed to fetch buyers:', error);
      toast.error('Failed to load buyers');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingBuyer(null);
    reset({
      name: '',
      code: '',
      description: '',
      is_active: true,
      display_order: 0,
    });
    setDialogOpen(true);
  };

  const handleEdit = (buyer: BuyerData) => {
    setEditingBuyer(buyer);
    reset({
      name: buyer.name,
      code: buyer.code,
      description: buyer.description || '',
      is_active: buyer.is_active,
      display_order: buyer.display_order,
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this buyer?')) return;

    try {
      await api.delete(`/master-data/buyers/${id}`);
      toast.success('Buyer deleted successfully');
      fetchBuyers();
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Failed to delete buyer';
      toast.error(errorMessage);
    }
  };

  const onSubmit = async (data: BuyerFormData) => {
    try {
      setIsSubmitting(true);

      if (editingBuyer) {
        await api.put(`/master-data/buyers/${editingBuyer.id}`, data);
        toast.success('Buyer updated successfully');
      } else {
        await api.post('/master-data/buyers', data);
        toast.success('Buyer created successfully');
      }

      setDialogOpen(false);
      fetchBuyers();
      reset();
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Failed to save buyer';
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredBuyers = buyers.filter(buyer =>
    buyer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    buyer.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <DashboardLayout requiredPermissions={['po.create', 'po.edit', 'style.create', 'style.edit', 'admin.configuration.view']} requireAll={false}>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Buyers</h1>
            <p className="text-muted-foreground">Manage buyer organizations (Rebel Minds, R3bel Denim, etc.)</p>
          </div>
          {can('admin.configuration.edit') && (
            <Button onClick={handleCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Add Buyer
            </Button>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Search Buyers</CardTitle>
            <CardDescription>Search by name or code</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search buyers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Buyer List ({filteredBuyers.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Loading...</div>
            ) : filteredBuyers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No buyers found. Click "Add Buyer" to create one.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Order</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredBuyers.map((buyer) => (
                    <TableRow key={buyer.id}>
                      <TableCell className="font-medium">{buyer.name}</TableCell>
                      <TableCell>{buyer.code}</TableCell>
                      <TableCell className="max-w-xs truncate">
                        {buyer.description || '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={buyer.is_active ? 'default' : 'secondary'}>
                          {buyer.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>{buyer.display_order}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          {can('admin.configuration.edit') && (
                            <>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEdit(buyer)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDelete(buyer.id)}
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
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingBuyer ? 'Edit Buyer' : 'Add Buyer'}</DialogTitle>
            <DialogDescription>
              {editingBuyer ? 'Update buyer information' : 'Create a new buyer organization'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-medium">
                Buyer Name *
              </label>
              <Input
                id="name"
                placeholder="e.g., Rebel Minds, R3bel Denim"
                {...register('name')}
              />
              {errors.name && (
                <p className="text-sm text-red-600">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <label htmlFor="code" className="text-sm font-medium">
                Buyer Code *
              </label>
              <Input
                id="code"
                placeholder="e.g., RBL, R3D"
                {...register('code')}
              />
              {errors.code && (
                <p className="text-sm text-red-600">{errors.code.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <label htmlFor="description" className="text-sm font-medium">
                Description (Optional)
              </label>
              <Textarea
                id="description"
                placeholder="Additional details about this buyer..."
                {...register('description')}
                rows={2}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label htmlFor="display_order" className="text-sm font-medium">
                  Display Order
                </label>
                <Input
                  id="display_order"
                  type="number"
                  {...register('display_order')}
                />
              </div>

              <div className="flex items-center space-x-2 pt-8">
                <input
                  type="checkbox"
                  id="is_active"
                  {...register('is_active')}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <label htmlFor="is_active" className="text-sm font-medium">
                  Active
                </label>
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
                {isSubmitting ? 'Saving...' : editingBuyer ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
