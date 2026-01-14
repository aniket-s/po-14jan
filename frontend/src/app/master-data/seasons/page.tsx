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
import { Plus, Search, Edit, Trash2, Calendar } from 'lucide-react';
import api from '@/lib/api';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';

interface SeasonData {
  id: number;
  name: string;
  code: string;
  year: number | null;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

const seasonSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  code: z.string().min(1, 'Code is required').max(50),
  year: z.coerce.number().optional(),
  description: z.string().optional(),
  is_active: z.boolean(),
});

type SeasonFormData = z.infer<typeof seasonSchema>;

export default function SeasonsPage() {
  const { user, loading: authLoading } = useAuth();
  const [seasons, setSeasons] = useState<SeasonData[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSeason, setEditingSeason] = useState<SeasonData | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SeasonFormData>({
    resolver: zodResolver(seasonSchema),
    defaultValues: {
      name: '',
      code: '',
      year: undefined,
      description: '',
      is_active: true,
    },
  });

  useEffect(() => {
    if (!authLoading) {
      fetchSeasons();
    }
  }, [authLoading]);

  const fetchSeasons = async () => {
    try {
      setLoading(true);
      const response = await api.get('/master-data/seasons?all=true');
      setSeasons(response.data || []);
    } catch (error) {
      console.error('Failed to fetch seasons:', error);
      toast.error('Failed to load seasons');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingSeason(null);
    reset({
      name: '',
      code: '',
      year: new Date().getFullYear(),
      description: '',
      is_active: true,
    });
    setDialogOpen(true);
  };

  const handleEdit = (season: SeasonData) => {
    setEditingSeason(season);
    reset({
      name: season.name,
      code: season.code,
      year: season.year || undefined,
      description: season.description || '',
      is_active: season.is_active,
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this season?')) return;

    try {
      await api.delete(`/master-data/seasons/${id}`);
      toast.success('Season deleted successfully');
      fetchSeasons();
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Failed to delete season';
      toast.error(errorMessage);
    }
  };

  const onSubmit = async (data: SeasonFormData) => {
    try {
      setIsSubmitting(true);

      if (editingSeason) {
        await api.put(`/master-data/seasons/${editingSeason.id}`, data);
        toast.success('Season updated successfully');
      } else {
        await api.post('/master-data/seasons', data);
        toast.success('Season created successfully');
      }

      setDialogOpen(false);
      fetchSeasons();
      reset();
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Failed to save season';
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredSeasons = seasons.filter(season =>
    season.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    season.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Seasons</h1>
            <p className="text-muted-foreground">Manage seasonal collections</p>
          </div>
          <Button onClick={handleCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Add Season
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Search Seasons</CardTitle>
            <CardDescription>Search by name or code</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search seasons..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Season List ({filteredSeasons.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Loading...</div>
            ) : filteredSeasons.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No seasons found. Click "Add Season" to create one.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Year</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSeasons.map((season) => (
                    <TableRow key={season.id}>
                      <TableCell className="font-medium">{season.name}</TableCell>
                      <TableCell>{season.code}</TableCell>
                      <TableCell>{season.year || '-'}</TableCell>
                      <TableCell className="max-w-md truncate">
                        {season.description || '-'}
                      </TableCell>
                      <TableCell>
                        {season.is_active ? (
                          <Badge variant="default">Active</Badge>
                        ) : (
                          <Badge variant="secondary">Inactive</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(season)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(season.id)}>
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

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                {editingSeason ? 'Edit Season' : 'Create New Season'}
              </DialogTitle>
              <DialogDescription>
                {editingSeason ? 'Update the season information below.' : 'Fill in the details to create a new season.'}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="name" className="text-sm font-medium">Name *</label>
                  <Input id="name" placeholder="e.g., Spring/Summer" {...register('name')} />
                  {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
                </div>

                <div className="space-y-2">
                  <label htmlFor="code" className="text-sm font-medium">Code *</label>
                  <Input id="code" placeholder="e.g., SS" {...register('code')} />
                  {errors.code && <p className="text-sm text-destructive">{errors.code.message}</p>}
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="year" className="text-sm font-medium">Year</label>
                <Input id="year" type="number" placeholder="e.g., 2025" {...register('year')} />
              </div>

              <div className="space-y-2">
                <label htmlFor="description" className="text-sm font-medium">Description</label>
                <Textarea id="description" placeholder="Optional description..." rows={3} {...register('description')} />
              </div>

              <div className="space-y-2">
                <label htmlFor="is_active" className="text-sm font-medium">Status</label>
                <div className="flex items-center space-x-2">
                  <input id="is_active" type="checkbox" className="h-4 w-4" {...register('is_active')} />
                  <label htmlFor="is_active" className="text-sm">Active</label>
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={isSubmitting}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Saving...' : editingSeason ? 'Update' : 'Create'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
