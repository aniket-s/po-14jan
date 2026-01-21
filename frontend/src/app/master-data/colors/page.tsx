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
import { Plus, Search, Edit, Trash2, Palette } from 'lucide-react';
import api from '@/lib/api';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';

interface ColorData {
  id: number;
  name: string;
  code: string;
  pantone_code: string | null;
  fabric_types: string[] | null;
  description: string | null;
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

const colorSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  code: z.string().min(1, 'Code is required').max(50),
  pantone_code: z.string().optional(),
  fabric_types: z.string().optional(), // Comma-separated string
  description: z.string().optional(),
  is_active: z.boolean(),
  display_order: z.coerce.number().optional(),
});

type ColorFormData = z.infer<typeof colorSchema>;

export default function ColorsPage() {
  const { user, loading: authLoading } = useAuth();
  const [colors, setColors] = useState<ColorData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingColor, setEditingColor] = useState<ColorData | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ColorFormData>({
    resolver: zodResolver(colorSchema),
    defaultValues: {
      name: '',
      code: '',
      pantone_code: '',
      fabric_types: '',
      description: '',
      is_active: true,
      display_order: 0,
    },
  });

  useEffect(() => {
    if (!authLoading) {
      fetchColors();
    }
  }, [authLoading]);

  const fetchColors = async () => {
    try {
      setLoading(true);
      const response = await api.get('/master-data/colors?all=true');
      setColors(response.data || []);
    } catch (error) {
      console.error('Failed to fetch colors:', error);
      toast.error('Failed to load colors');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingColor(null);
    reset({
      name: '',
      code: '',
      pantone_code: '',
      fabric_types: '',
      description: '',
      is_active: true,
      display_order: 0,
    });
    setDialogOpen(true);
  };

  const handleEdit = (color: ColorData) => {
    setEditingColor(color);
    reset({
      name: color.name,
      code: color.code,
      pantone_code: color.pantone_code || '',
      fabric_types: color.fabric_types ? color.fabric_types.join(', ') : '',
      description: color.description || '',
      is_active: color.is_active,
      display_order: color.display_order,
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this color?')) return;

    try {
      await api.delete(`/master-data/colors/${id}`);
      toast.success('Color deleted successfully');
      fetchColors();
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Failed to delete color';
      toast.error(errorMessage);
    }
  };

  const onSubmit = async (data: ColorFormData) => {
    try {
      setIsSubmitting(true);

      // Parse fabric types from comma-separated string to array
      const fabricTypesArray = data.fabric_types
        ? data.fabric_types.split(',').map(t => t.trim()).filter(t => t)
        : [];

      const payload = {
        ...data,
        fabric_types: fabricTypesArray.length > 0 ? fabricTypesArray : null,
      };

      if (editingColor) {
        await api.put(`/master-data/colors/${editingColor.id}`, payload);
        toast.success('Color updated successfully');
      } else {
        await api.post('/master-data/colors', payload);
        toast.success('Color created successfully');
      }

      setDialogOpen(false);
      fetchColors();
      reset();
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Failed to save color';
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredColors = colors.filter(color =>
    color.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    color.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (color.pantone_code && color.pantone_code.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Colors</h1>
            <p className="text-muted-foreground">Manage color information and fabric type associations</p>
          </div>
          <Button onClick={handleCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Add Color
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Search Colors</CardTitle>
            <CardDescription>Search by name, code, or Pantone code</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search colors..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Color List ({filteredColors.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Loading...</div>
            ) : filteredColors.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No colors found. Click "Add Color" to create one.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Pantone</TableHead>
                    <TableHead>Fabric Types</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Order</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredColors.map((color) => (
                    <TableRow key={color.id}>
                      <TableCell className="font-medium">{color.name}</TableCell>
                      <TableCell>{color.code}</TableCell>
                      <TableCell>{color.pantone_code || '-'}</TableCell>
                      <TableCell>
                        {color.fabric_types && color.fabric_types.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {color.fabric_types.map((type, idx) => (
                              <Badge key={idx} variant="outline" className="text-xs">
                                {type}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">All</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={color.is_active ? 'default' : 'secondary'}>
                          {color.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell>{color.display_order}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(color)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(color.id)}
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
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingColor ? 'Edit Color' : 'Add Color'}</DialogTitle>
            <DialogDescription>
              {editingColor ? 'Update color information' : 'Create a new color for your styles'}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-medium">
                Color Name *
              </label>
              <Input
                id="name"
                placeholder="e.g., Black, Navy Blue, Charcoal"
                {...register('name')}
              />
              {errors.name && (
                <p className="text-sm text-red-600">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <label htmlFor="code" className="text-sm font-medium">
                Color Code *
              </label>
              <Input
                id="code"
                placeholder="e.g., BLK, NAVY, CHAR"
                {...register('code')}
              />
              {errors.code && (
                <p className="text-sm text-red-600">{errors.code.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <label htmlFor="pantone_code" className="text-sm font-medium">
                Pantone Code (Optional)
              </label>
              <Input
                id="pantone_code"
                placeholder="e.g., PMS 19-4052, Pantone 2965C"
                {...register('pantone_code')}
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="fabric_types" className="text-sm font-medium">
                Fabric Types (Optional)
              </label>
              <Input
                id="fabric_types"
                placeholder="e.g., CVC, Cotton, Polyester (comma-separated)"
                {...register('fabric_types')}
              />
              <p className="text-xs text-muted-foreground">
                Leave empty for all fabric types, or enter comma-separated values
              </p>
            </div>

            <div className="space-y-2">
              <label htmlFor="description" className="text-sm font-medium">
                Description (Optional)
              </label>
              <Textarea
                id="description"
                placeholder="Additional details about this color..."
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
                {isSubmitting ? 'Saving...' : editingColor ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
