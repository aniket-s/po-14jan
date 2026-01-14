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
import { Plus, Search, Edit, Trash2, Factory } from 'lucide-react';
import api from '@/lib/api';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';

const vendorSchema = z.object({
  company_name: z.string().min(1, 'Company name is required').max(255),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
  contact_person: z.string().optional(),
  is_active: z.boolean()
});

export default function VendorsPage() {
  const { loading: authLoading } = useAuth();
  const [vendors, setVendors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(vendorSchema),
    defaultValues: {
      company_name: '',
      email: '',
      phone: '',
      address: '',
      contact_person: '',
      is_active: true
    }
  });

  useEffect(() => {
    if (!authLoading) fetchData();
  }, [authLoading]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await api.get('/master-data/vendors?all=true');
      setVendors(res.data || []);
    } catch (error) {
      toast.error('Failed to load vendors');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditing(null);
    reset({
      company_name: '',
      email: '',
      phone: '',
      address: '',
      contact_person: '',
      is_active: true
    });
    setDialogOpen(true);
  };

  const handleEdit = (item: any) => {
    setEditing(item);
    reset(item);
    setDialogOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure?')) return;
    try {
      await api.delete(`/master-data/vendors/${id}`);
      toast.success('Vendor deleted successfully');
      fetchData();
    } catch (error: any) {
      toast.error('Failed to delete vendor');
    }
  };

  const onSubmit = async (data: any) => {
    try {
      setIsSubmitting(true);
      if (editing) {
        await api.put(`/master-data/vendors/${editing.id}`, data);
        toast.success('Vendor updated successfully');
      } else {
        await api.post('/master-data/vendors', data);
        toast.success('Vendor created successfully');
      }
      setDialogOpen(false);
      fetchData();
      reset();
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to save vendor');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filtered = vendors.filter(v =>
    (v.company_name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
    (v.contact_person?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
    (v.email?.toLowerCase() || '').includes(searchQuery.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Vendors</h1>
            <p className="text-muted-foreground">Manage vendor information</p>
          </div>
          <Button onClick={handleCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Add Vendor
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Search</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by company name, contact person, or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Vendors ({filtered.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Loading...</div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">No vendors found</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company Name</TableHead>
                    <TableHead>Contact Person</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(v => (
                    <TableRow key={v.id}>
                      <TableCell className="font-medium">{v.company_name || '-'}</TableCell>
                      <TableCell>{v.contact_person || '-'}</TableCell>
                      <TableCell>{v.email || '-'}</TableCell>
                      <TableCell>{v.phone || '-'}</TableCell>
                      <TableCell>
                        {v.is_active ? (
                          <Badge>Active</Badge>
                        ) : (
                          <Badge variant="secondary">Inactive</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(v)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(v.id)}>
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
                <Factory className="inline h-5 w-5 mr-2" />
                {editing ? 'Edit' : 'Create'} Vendor
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Company Name *</label>
                  <Input {...register('company_name')} />
                  {errors.company_name && (
                    <p className="text-sm text-destructive">{errors.company_name.message as string}</p>
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium">Contact Person</label>
                  <Input {...register('contact_person')} />
                </div>
                <div>
                  <label className="text-sm font-medium">Email</label>
                  <Input type="email" {...register('email')} />
                  {errors.email && (
                    <p className="text-sm text-destructive">{errors.email.message as string}</p>
                  )}
                </div>
                <div>
                  <label className="text-sm font-medium">Phone</label>
                  <Input {...register('phone')} />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Address</label>
                <Textarea {...register('address')} rows={2} />
              </div>
              <div className="flex items-center space-x-2">
                <input type="checkbox" className="h-4 w-4" {...register('is_active')} />
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
