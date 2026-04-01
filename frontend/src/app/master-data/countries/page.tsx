'use client';
export const dynamic = 'force-dynamic';
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Search, Edit, Trash2, Globe } from 'lucide-react';
import api from '@/lib/api';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';

const countrySchema = z.object({ name: z.string().min(1).max(100), code: z.string().min(1).max(10), shipping_days: z.coerce.number().min(0).optional(), is_active: z.boolean() });

export default function CountriesPage() {
  const { can, loading: authLoading } = useAuth();
  const [countries, setCountries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { register, handleSubmit, reset, formState: { errors } } = useForm({ resolver: zodResolver(countrySchema), defaultValues: { name: '', code: '', shipping_days: 0, is_active: true } });

  useEffect(() => { if (!authLoading) fetchData(); }, [authLoading]);

  const fetchData = async () => { try { setLoading(true); const res = await api.get('/master-data/countries?all=true'); setCountries(res.data || []); } catch (error) { toast.error('Failed to load'); } finally { setLoading(false); } };
  const handleCreate = () => { setEditing(null); reset({ name: '', code: '', shipping_days: 0, is_active: true }); setDialogOpen(true); };
  const handleEdit = (item: any) => { setEditing(item); reset(item); setDialogOpen(true); };
  const handleDelete = async (id: number) => { if (!confirm('Are you sure?')) return; try { await api.delete(`/master-data/countries/${id}`); toast.success('Deleted'); fetchData(); } catch (error: any) { toast.error('Failed'); } };
  const onSubmit = async (data: any) => { try { setIsSubmitting(true); if (editing) { await api.put(`/master-data/countries/${editing.id}`, data); toast.success('Updated'); } else { await api.post('/master-data/countries', data); toast.success('Created'); } setDialogOpen(false); fetchData(); reset(); } catch (error: any) { toast.error('Failed'); } finally { setIsSubmitting(false); } };

  const filtered = countries.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()) || c.code.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <DashboardLayout requiredPermissions={['po.create', 'po.edit', 'style.create', 'style.edit', 'admin.configuration.view']} requireAll={false}>
      <div className="space-y-6">
        <div className="flex justify-between items-center"><div><h1 className="text-3xl font-bold">Countries</h1><p className="text-muted-foreground">Manage countries</p></div>{can('admin.configuration.edit') && (<Button onClick={handleCreate}><Plus className="mr-2 h-4 w-4" />Add Country</Button>)}</div>
        <Card><CardHeader><CardTitle>Search</CardTitle></CardHeader><CardContent><div className="relative"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><Input placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-8" /></div></CardContent></Card>
        <Card><CardHeader><CardTitle>Countries ({filtered.length})</CardTitle></CardHeader><CardContent>{loading ? <div className="text-center py-8">Loading...</div> : filtered.length === 0 ? <div className="text-center py-8 text-muted-foreground">No countries found</div> : (<Table><TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Code</TableHead><TableHead>Shipping Days</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader><TableBody>{filtered.map(c => (<TableRow key={c.id}><TableCell className="font-medium">{c.name}</TableCell><TableCell>{c.code}</TableCell><TableCell>{c.shipping_days || '-'}</TableCell><TableCell>{c.is_active ? <Badge>Active</Badge> : <Badge variant="secondary">Inactive</Badge>}</TableCell><TableCell className="text-right"><div className="flex justify-end gap-2">{can('admin.configuration.edit') && (<><Button variant="ghost" size="icon" onClick={() => handleEdit(c)}><Edit className="h-4 w-4" /></Button><Button variant="ghost" size="icon" onClick={() => handleDelete(c.id)}><Trash2 className="h-4 w-4" /></Button></>)}</div></TableCell></TableRow>))}</TableBody></Table>)}</CardContent></Card>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}><DialogContent className="max-w-2xl"><DialogHeader><DialogTitle><Globe className="inline h-5 w-5 mr-2" />{editing ? 'Edit' : 'Create'} Country</DialogTitle></DialogHeader><form onSubmit={handleSubmit(onSubmit)} className="space-y-4"><div className="grid grid-cols-2 gap-4"><div><label className="text-sm font-medium">Name *</label><Input {...register('name')} />{errors.name && <p className="text-sm text-destructive">{errors.name.message as string}</p>}</div><div><label className="text-sm font-medium">Code *</label><Input {...register('code')} />{errors.code && <p className="text-sm text-destructive">{errors.code.message as string}</p>}</div><div><label className="text-sm font-medium">Shipping Days</label><Input type="number" {...register('shipping_days')} /></div></div><div className="flex items-center space-x-2"><input type="checkbox" className="h-4 w-4" {...register('is_active')} /><label className="text-sm">Active</label></div><DialogFooter><Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={isSubmitting}>Cancel</Button><Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Saving...' : editing ? 'Update' : 'Create'}</Button></DialogFooter></form></DialogContent></Dialog>
      </div>
    </DashboardLayout>
  );
}
