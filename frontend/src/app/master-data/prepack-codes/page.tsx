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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Search, Edit, Trash2, Package } from 'lucide-react';
import api from '@/lib/api';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';

const prepackSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  code: z.string().min(1, 'Code is required').max(50),
  size_range: z.string().min(1, 'Size range is required'),
  ratio: z.string().min(1, 'Ratio is required'),
  description: z.string().optional(),
  is_active: z.boolean()
});

export default function PrepackCodesPage() {
  const { loading: authLoading } = useAuth();
  const [prepacks, setPrepacks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(prepackSchema),
    defaultValues: { name: '', code: '', size_range: '', ratio: '', description: '', is_active: true }
  });

  // Log validation errors
  useEffect(() => {
    if (Object.keys(errors).length > 0) {
      console.log('Form validation errors:', errors);
    }
  }, [errors]);

  useEffect(() => { if (!authLoading) fetchData(); }, [authLoading]);

  const fetchData = async () => { try { setLoading(true); const res = await api.get('/master-data/prepack-codes?all=true'); setPrepacks(res.data || []); } catch (error) { toast.error('Failed to load'); } finally { setLoading(false); } };

  const handleCreate = () => {
    setEditing(null);
    reset({ name: '', code: '', size_range: '', ratio: '', description: '', is_active: true });
    setDialogOpen(true);
  };

  const handleEdit = (item: any) => {
    setEditing(item);
    // Convert sizes object back to ratio string for editing
    const ratioStr = item.sizes ? Object.values(item.sizes).join('-') : '';
    const sizeRangeStr = item.sizes ? Object.keys(item.sizes).join('-') : item.size_range || '';
    reset({ ...item, ratio: ratioStr, size_range: sizeRangeStr });
    setDialogOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure?')) return;
    try {
      await api.delete(`/master-data/prepack-codes/${id}`);
      toast.success('Deleted');
      fetchData();
    } catch (error: any) {
      toast.error('Failed');
    }
  };

  const onSubmit = async (data: any) => {
    try {
      setIsSubmitting(true);
      console.log('Form submitted with data:', data);

      // Parse size_range (e.g., "S-M-L-XL" or "XS-S-M-L-XL-2XL")
      const sizeArray = data.size_range.split('-').map((s: string) => s.trim()).filter(Boolean);

      // Parse ratio (e.g., "1-2-2-1")
      const ratioArray = data.ratio.split('-').map((r: string) => parseInt(r.trim())).filter((n: number) => !isNaN(n));

      if (sizeArray.length !== ratioArray.length) {
        toast.error('Size range and ratio must have the same number of elements');
        setIsSubmitting(false);
        return;
      }

      // Create sizes object {S: 2, M: 2, L: 1, XL: 1}
      const sizes: Record<string, number> = {};
      sizeArray.forEach((size: string, index: number) => {
        sizes[size] = ratioArray[index];
      });

      // Calculate total pieces per pack
      const total_pieces_per_pack = ratioArray.reduce((sum: number, val: number) => sum + val, 0);

      // Prepare payload for backend
      const payload = {
        name: data.name,
        code: data.code,
        size_range: data.size_range,
        ratio: data.ratio, // Backend requires this field
        sizes: sizes,
        total_pieces_per_pack: total_pieces_per_pack,
        description: data.description || '',
        is_active: data.is_active
      };

      if (editing) {
        await api.put(`/master-data/prepack-codes/${editing.id}`, payload);
        toast.success('Updated');
      } else {
        await api.post('/master-data/prepack-codes', payload);
        toast.success('Created');
      }

      setDialogOpen(false);
      fetchData();
      reset();
    } catch (error: any) {
      console.error('Form submission error:', error);
      const errorMsg = error.response?.data?.message || error.message || 'Failed';
      toast.error(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filtered = prepacks.filter(p => p.code.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center"><div><h1 className="text-3xl font-bold">Prepack Codes</h1><p className="text-muted-foreground">Manage prepack configurations</p></div><Button onClick={handleCreate}><Plus className="mr-2 h-4 w-4" />Add Prepack</Button></div>
        <Card><CardHeader><CardTitle>Search</CardTitle></CardHeader><CardContent><div className="relative"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><Input placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-8" /></div></CardContent></Card>
        <Card>
          <CardHeader>
            <CardTitle>Prepacks ({filtered.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Loading...</div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No prepack codes found</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Size Range</TableHead>
                    <TableHead>Total Pieces</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(p => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">{p.code}</TableCell>
                      <TableCell>{p.name || '-'}</TableCell>
                      <TableCell>{p.size_range || '-'}</TableCell>
                      <TableCell>{p.total_pieces_per_pack || '-'}</TableCell>
                      <TableCell>{p.description || '-'}</TableCell>
                      <TableCell>
                        {p.is_active ? <Badge>Active</Badge> : <Badge variant="secondary">Inactive</Badge>}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(p)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(p.id)}>
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
              <DialogTitle>
                <Package className="inline h-5 w-5 mr-2" />
                {editing ? 'Edit' : 'Create'} Prepack
              </DialogTitle>
              <DialogDescription>
                Define a prepack configuration with size range and ratio
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Name *</label>
                  <Input {...register('name')} placeholder="e.g., Standard Pack" />
                  {errors.name && <p className="text-sm text-destructive">{errors.name.message as string}</p>}
                </div>
                <div>
                  <label className="text-sm font-medium">Code *</label>
                  <Input {...register('code')} placeholder="e.g., PP-001" />
                  {errors.code && <p className="text-sm text-destructive">{errors.code.message as string}</p>}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Size Range *</label>
                  <Input {...register('size_range')} placeholder="e.g., S-M-L-XL or XS-S-M-L-XL-2XL" />
                  {errors.size_range && <p className="text-sm text-destructive">{errors.size_range.message as string}</p>}
                  <p className="text-xs text-muted-foreground mt-1">
                    Enter sizes separated by dashes
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium">Ratio *</label>
                  <Input {...register('ratio')} placeholder="e.g., 1-2-2-1" />
                  {errors.ratio && <p className="text-sm text-destructive">{errors.ratio.message as string}</p>}
                  <p className="text-xs text-muted-foreground mt-1">
                    Enter quantities separated by dashes (must match size count)
                  </p>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Description</label>
                <Textarea {...register('description')} rows={2} placeholder="Optional description" />
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  className="h-4 w-4"
                  {...register('is_active')}
                  defaultChecked={true}
                />
                <label className="text-sm">Active</label>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={isSubmitting}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Saving...' : editing ? 'Update' : 'Create'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
