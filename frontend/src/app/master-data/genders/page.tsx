'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
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
import { Plus, Search, Edit, Trash2, Users, List } from 'lucide-react';
import api from '@/lib/api';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';

interface GenderData {
  id: number;
  name: string;
  code: string;
  description: string | null;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

const genderSchema = z.object({
  name: z.string().min(1, 'Name is required').max(50),
  code: z.string().min(1, 'Code is required').max(20),
  description: z.string().optional(),
  is_active: z.boolean(),
  display_order: z.coerce.number().min(0, 'Display order must be 0 or greater'),
});

type GenderFormData = z.infer<typeof genderSchema>;

export default function GendersPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [genders, setGenders] = useState<GenderData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingGender, setEditingGender] = useState<GenderData | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<GenderFormData>({
    resolver: zodResolver(genderSchema),
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
      fetchGenders();
    }
  }, [authLoading]);

  const fetchGenders = async () => {
    try {
      setLoading(true);
      const response = await api.get('/master-data/genders?all=true');
      setGenders(response.data || []);
    } catch (error) {
      console.error('Failed to fetch genders:', error);
      toast.error('Failed to load genders');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingGender(null);
    reset({
      name: '',
      code: '',
      description: '',
      is_active: true,
      display_order: 0,
    });
    setDialogOpen(true);
  };

  const handleEdit = (gender: GenderData) => {
    setEditingGender(gender);
    reset({
      name: gender.name,
      code: gender.code,
      description: gender.description || '',
      is_active: gender.is_active,
      display_order: gender.display_order,
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this gender? This will also delete associated sizes.')) return;

    try {
      await api.delete(`/master-data/genders/${id}`);
      toast.success('Gender deleted successfully');
      fetchGenders();
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Failed to delete gender';
      toast.error(errorMessage);
    }
  };

  const onSubmit = async (data: GenderFormData) => {
    try {
      setIsSubmitting(true);

      if (editingGender) {
        await api.put(`/master-data/genders/${editingGender.id}`, data);
        toast.success('Gender updated successfully');
      } else {
        await api.post('/master-data/genders', data);
        toast.success('Gender created successfully');
      }

      setDialogOpen(false);
      fetchGenders();
      reset();
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Failed to save gender';
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredGenders = genders.filter(gender =>
    gender.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    gender.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Genders</h1>
            <p className="text-muted-foreground">
              Manage gender categories for size management
            </p>
          </div>
          <Button onClick={handleCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Add Gender
          </Button>
        </div>

        {/* Search */}
        <Card>
          <CardHeader>
            <CardTitle>Search Genders</CardTitle>
            <CardDescription>Search by name or code</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search genders..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle>Gender List ({filteredGenders.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Loading...</div>
            ) : filteredGenders.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No genders found. Click "Add Gender" to create one.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Display Order</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredGenders.map((gender) => (
                    <TableRow key={gender.id}>
                      <TableCell className="font-medium">{gender.name}</TableCell>
                      <TableCell>{gender.code}</TableCell>
                      <TableCell className="max-w-md truncate">
                        {gender.description || '-'}
                      </TableCell>
                      <TableCell>{gender.display_order}</TableCell>
                      <TableCell>
                        {gender.is_active ? (
                          <Badge variant="default">Active</Badge>
                        ) : (
                          <Badge variant="secondary">Inactive</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => router.push(`/master-data/sizes?gender=${gender.id}`)}
                            title={`Manage sizes for ${gender.name}`}
                          >
                            <List className="h-4 w-4 mr-1" />
                            Sizes
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(gender)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(gender.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
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
                <Users className="h-5 w-5" />
                {editingGender ? 'Edit Gender' : 'Create New Gender'}
              </DialogTitle>
              <DialogDescription>
                {editingGender
                  ? 'Update the gender information below.'
                  : 'Fill in the details to create a new gender.'}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="name" className="text-sm font-medium">
                    Name *
                  </label>
                  <Input
                    id="name"
                    placeholder="e.g., Men, Women, Boys, Girls"
                    {...register('name')}
                  />
                  {errors.name && (
                    <p className="text-sm text-destructive">{errors.name.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <label htmlFor="code" className="text-sm font-medium">
                    Code *
                  </label>
                  <Input
                    id="code"
                    placeholder="e.g., MEN, WOMEN"
                    {...register('code')}
                  />
                  {errors.code && (
                    <p className="text-sm text-destructive">{errors.code.message}</p>
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
                  {isSubmitting ? 'Saving...' : editingGender ? 'Update' : 'Create'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
