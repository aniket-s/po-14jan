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

const prepackSchema = z.object({ code: z.string().min(1).max(50), description: z.string().optional(), ratio: z.string().optional(), is_active: z.boolean() });

export default function PrepackCodesPage() {
  const { loading: authLoading } = useAuth();
  const [prepacks, setPrepacks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { register, handleSubmit, reset, formState: { errors } } = useForm({ resolver: zodResolver(prepackSchema), defaultValues: { code: '', description: '', ratio: '', is_active: true } });

  useEffect(() => { if (!authLoading) fetchData(); }, [authLoading]);

  const fetchData = async () => { try { setLoading(true); const res = await api.get('/master-data/prepack-codes?all=true'); setPrepacks(res.data || []); } catch (error) { toast.error('Failed to load'); } finally { setLoading(false); } };
  const handleCreate = () => { setEditing(null); reset({ code: '', description: '', ratio: '', is_active: true }); setDialogOpen(true); };
  const handleEdit = (item: any) => { setEditing(item); reset(item); setDialogOpen(true); };
  const handleDelete = async (id: number) => { if (!confirm('Are you sure?')) return; try { await api.delete(`/master-data/prepack-codes/${id}`); toast.success('Deleted'); fetchData(); } catch (error: any) { toast.error('Failed'); } };
  const onSubmit = async (data: any) => { try { setIsSubmitting(true); if (editing) { await api.put(`/master-data/prepack-codes/${editing.id}`, data); toast.success('Updated'); } else { await api.post('/master-data/prepack-codes', data); toast.success('Created'); } setDialogOpen(false); fetchData(); reset(); } catch (error: any) { toast.error('Failed'); } finally { setIsSubmitting(false); } };

  const filtered = prepacks.filter(p => p.code.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center"><div><h1 className="text-3xl font-bold">Prepack Codes</h1><p className="text-muted-foreground">Manage prepack configurations</p></div><Button onClick={handleCreate}><Plus className="mr-2 h-4 w-4" />Add Prepack</Button></div>
        <Card><CardHeader><CardTitle>Search</CardTitle></CardHeader><CardContent><div className="relative"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><Input placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-8" /></div></CardContent></Card>
        <Card><CardHeader><CardTitle>Prepacks ({filtered.length})</CardTitle></CardHeader><CardContent>{loading ? <div className="text-center py-8">Loading...</div> : filtered.length === 0 ? <div className="text-center py-8 text-muted-foreground">No prepack codes found</div> : (<Table><TableHeader><TableRow><TableHead>Code</TableHead><TableHead>Ratio</TableHead><TableHead>Description</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader><TableBody>{filtered.map(p => (<TableRow key={p.id}><TableCell className="font-medium">{p.code}</TableCell><TableCell>{p.ratio || '-'}</TableCell><TableCell>{p.description || '-'}</TableCell><TableCell>{p.is_active ? <Badge>Active</Badge> : <Badge variant="secondary">Inactive</Badge>}</TableCell><TableCell className="text-right"><div className="flex justify-end gap-2"><Button variant="ghost" size="icon" onClick={() => handleEdit(p)}><Edit className="h-4 w-4" /></Button><Button variant="ghost" size="icon" onClick={() => handleDelete(p.id)}><Trash2 className="h-4 w-4" /></Button></div></TableCell></TableRow>))}</TableBody></Table>)}</CardContent></Card>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}><DialogContent className="max-w-2xl"><DialogHeader><DialogTitle><Package className="inline h-5 w-5 mr-2" />{editing ? 'Edit' : 'Create'} Prepack</DialogTitle></DialogHeader><form onSubmit={handleSubmit(onSubmit)} className="space-y-4"><div className="grid grid-cols-2 gap-4"><div><label className="text-sm font-medium">Code *</label><Input {...register('code')} />{errors.code && <p className="text-sm text-destructive">{errors.code.message as string}</p>}</div><div><label className="text-sm font-medium">Ratio</label><Input {...register('ratio')} placeholder="e.g., 1-2-2-1" /></div></div><div><label className="text-sm font-medium">Description</label><Textarea {...register('description')} rows={2} /></div><div className="flex items-center space-x-2"><input type="checkbox" className="h-4 w-4" {...register('is_active')} /><label className="text-sm">Active</label></div><DialogFooter><Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={isSubmitting}>Cancel</Button><Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Saving...' : editing ? 'Update' : 'Create'}</Button></DialogFooter></form></DialogContent></Dialog>
      </div>
    </DashboardLayout>
  );
}
