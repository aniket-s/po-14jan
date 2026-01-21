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
import { Plus, Search, Edit, Trash2, Package, Upload, X, Image as ImageIcon, FileText, File } from 'lucide-react';
import api from '@/lib/api';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { CreateBrandDialog } from '@/components/master-data/CreateBrandDialog';
import { Checkbox } from '@/components/ui/checkbox';

interface TrimData {
  id: number;
  brand_id: number;
  trim_types: string[]; // Changed from trim_type to trim_types (array for multi-select)
  trim_code: string;
  description: string | null;
  image_path: string | null; // Now accepts PDF, AI, and images
  // file_path removed - specification document no longer needed
  is_active: boolean;
  created_at: string;
  updated_at: string;
  brand?: {
    id: number;
    name: string;
  };
}

interface Brand {
  id: number;
  name: string;
}

const TRIM_TYPES = [
  { value: 'main_label', label: 'Main Label' },
  { value: 'size_label', label: 'Size Label' },
  { value: 'tag_1', label: 'Tag 1' },
  { value: 'tag_2', label: 'Tag 2' },
  { value: 'wash_care_label', label: 'Wash Care Label' },
  { value: 'special_label', label: 'Special Label' },
  { value: 'special_tag', label: 'Special Tag' },
  { value: 'price_ticket', label: 'Price Ticket' },
];

const trimSchema = z.object({
  brand_id: z.coerce.number().min(1, 'Brand is required'),
  trim_types: z.array(z.string()).min(1, 'At least one trim type is required'), // Changed to array for multi-select
  trim_code: z.string().min(1, 'Trim code is required').max(100),
  description: z.string().optional(),
  is_active: z.boolean(),
});

type TrimFormData = z.infer<typeof trimSchema>;

export default function TrimsPage() {
  const { user, loading: authLoading } = useAuth();
  const [trims, setTrims] = useState<TrimData[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTrim, setEditingTrim] = useState<TrimData | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  // uploadedFile removed - specification document no longer needed
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [selectedBrandId, setSelectedBrandId] = useState<string>('');
  const [selectedTrimTypes, setSelectedTrimTypes] = useState<string[]>([]); // Changed to array for multi-select
  const [showBrandDialog, setShowBrandDialog] = useState(false); // NEW: For inline brand creation

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<TrimFormData>({
    resolver: zodResolver(trimSchema),
    defaultValues: {
      brand_id: 0,
      trim_types: [], // Changed to array for multi-select
      trim_code: '',
      description: '',
      is_active: true,
    },
  });

  useEffect(() => {
    if (!authLoading) {
      fetchTrims();
      fetchBrands();
    }
  }, [authLoading]);

  const fetchTrims = async () => {
    try {
      setLoading(true);
      const response = await api.get('/master-data/trims?all=true');
      setTrims(response.data || []);
    } catch (error) {
      console.error('Failed to fetch trims:', error);
      toast.error('Failed to load trims');
    } finally {
      setLoading(false);
    }
  };

  const fetchBrands = async () => {
    try {
      const response = await api.get('/master-data/brands?all=true');
      setBrands(response.data || []);
    } catch (error) {
      console.error('Failed to fetch brands:', error);
    }
  };

  const handleCreate = () => {
    setEditingTrim(null);
    setUploadedImage(null);
    setSelectedBrandId('');
    setSelectedTrimTypes([]); // Changed to array
    reset({
      brand_id: 0,
      trim_types: [], // Changed to array
      trim_code: '',
      description: '',
      is_active: true,
    });
    setDialogOpen(true);
  };

  const handleEdit = (trim: TrimData) => {
    setEditingTrim(trim);
    setUploadedImage(trim.image_path);
    setSelectedBrandId(trim.brand_id.toString());
    setSelectedTrimTypes(trim.trim_types || []); // Changed to array
    reset({
      brand_id: trim.brand_id,
      trim_types: trim.trim_types || [], // Changed to array
      trim_code: trim.trim_code,
      description: trim.description || '',
      is_active: trim.is_active,
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this trim?')) {
      return;
    }

    try {
      await api.delete(`/master-data/trims/${id}`);
      toast.success('Trim deleted successfully');
      fetchTrims();
    } catch (error: any) {
      console.error('Failed to delete trim:', error);
      toast.error(error.response?.data?.message || 'Failed to delete trim');
    }
  };

  // Updated to accept PDF, AI, and images
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append('image', file);

      const response = await api.post('/master-data/trims/upload-image', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setUploadedImage(response.data.path || response.data.url || URL.createObjectURL(file));
      toast.success('File uploaded successfully');
    } catch (error) {
      console.error('Failed to upload file:', error);
      toast.error('Failed to upload file');
    } finally {
      setIsUploadingImage(false);
      e.target.value = '';
    }
  };

  // handleFileUpload removed - specification document no longer needed

  // Toggle trim type in multi-select
  const toggleTrimType = (type: string) => {
    const newTypes = selectedTrimTypes.includes(type)
      ? selectedTrimTypes.filter((t) => t !== type)
      : [...selectedTrimTypes, type];
    setSelectedTrimTypes(newTypes);
    setValue('trim_types', newTypes);
  };

  const onSubmit = async (data: TrimFormData) => {
    try {
      setIsSubmitting(true);

      const submitData = {
        ...data,
        image_path: uploadedImage || undefined,
        // file_path removed - specification document no longer needed
      };

      if (editingTrim) {
        await api.put(`/master-data/trims/${editingTrim.id}`, submitData);
        toast.success('Trim updated successfully');
      } else {
        await api.post('/master-data/trims', submitData);
        toast.success('Trim created successfully');
      }

      setDialogOpen(false);
      fetchTrims();
      reset();
      setUploadedImage(null);
      setSelectedTrimTypes([]);
    } catch (error: any) {
      console.error('Failed to save trim:', error);
      toast.error(error.response?.data?.message || 'Failed to save trim');
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredTrims = trims.filter((trim) => {
    const searchLower = searchQuery.toLowerCase();
    const typesMatch = Array.isArray(trim.trim_types)
      ? trim.trim_types.some((t) => t.toLowerCase().includes(searchLower))
      : false;
    return (
      trim.trim_code.toLowerCase().includes(searchLower) ||
      typesMatch ||
      (trim.description && trim.description.toLowerCase().includes(searchLower)) ||
      (trim.brand?.name && trim.brand.name.toLowerCase().includes(searchLower))
    );
  });

  if (authLoading || loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Package className="h-8 w-8" />
              Trims & Accessories
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage trims, labels, and packaging materials
            </p>
          </div>
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Add Trim
          </Button>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search trims..."
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
                  <TableHead>Type</TableHead>
                  <TableHead>Brand</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Image</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTrims.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      No trims found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTrims.map((trim) => (
                    <TableRow key={trim.id}>
                      <TableCell className="font-medium">{trim.trim_code}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {Array.isArray(trim.trim_types) && trim.trim_types.length > 0
                            ? trim.trim_types.map((type) => {
                                const trimType = TRIM_TYPES.find((t) => t.value === type);
                                return (
                                  <Badge key={type} variant="outline" className="text-xs">
                                    {trimType?.label || type}
                                  </Badge>
                                );
                              })
                            : '-'}
                        </div>
                      </TableCell>
                      <TableCell>{trim.brand?.name || '-'}</TableCell>
                      <TableCell className="max-w-xs truncate">
                        {trim.description || '-'}
                      </TableCell>
                      <TableCell>
                        {trim.image_path ? (
                          <ImageIcon className="h-4 w-4 text-green-500" />
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={trim.is_active ? 'default' : 'secondary'}>
                          {trim.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(trim)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(trim.id)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
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
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingTrim ? 'Edit Trim' : 'Create Trim'}
            </DialogTitle>
            <DialogDescription>
              {editingTrim
                ? 'Update trim information'
                : 'Add a new trim or accessory'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="brand_id">Brand *</Label>
              <div className="flex gap-2">
                <Select
                  value={selectedBrandId}
                  onValueChange={(value) => {
                    setSelectedBrandId(value);
                    setValue('brand_id', parseInt(value));
                  }}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Select brand" />
                  </SelectTrigger>
                  <SelectContent>
                    {brands.map((brand) => (
                      <SelectItem key={brand.id} value={brand.id.toString()}>
                        {brand.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setShowBrandDialog(true)}
                  title="Add new brand"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {errors.brand_id && (
                <p className="text-sm text-destructive">{errors.brand_id.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Trim Types * (Select multiple)</Label>
              <div className="border rounded-md p-3 grid grid-cols-2 gap-2">
                {TRIM_TYPES.map((type) => (
                  <div key={type.value} className="flex items-center space-x-2">
                    <Checkbox
                      id={`trim-type-${type.value}`}
                      checked={selectedTrimTypes.includes(type.value)}
                      onCheckedChange={() => toggleTrimType(type.value)}
                    />
                    <label
                      htmlFor={`trim-type-${type.value}`}
                      className="text-sm cursor-pointer"
                    >
                      {type.label}
                    </label>
                  </div>
                ))}
              </div>
              {errors.trim_types && (
                <p className="text-sm text-destructive">{errors.trim_types.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="trim_code">Trim Code *</Label>
              <Input
                id="trim_code"
                placeholder="TR-001"
                {...register('trim_code')}
              />
              {errors.trim_code && (
                <p className="text-sm text-destructive">{errors.trim_code.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                placeholder="Detailed description..."
                rows={2}
                {...register('description')}
              />
            </div>

            {/* Image/File Upload - accepts images, PDF, AI */}
            <div className="space-y-2">
              <Label>Trim Image/File (Image, PDF, AI)</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="file"
                  accept="image/*,.pdf,.ai,application/pdf,application/postscript"
                  onChange={handleImageUpload}
                  disabled={isUploadingImage}
                  className="flex-1"
                />
                {isUploadingImage && <span className="text-sm text-muted-foreground">Uploading...</span>}
              </div>
              {uploadedImage && (
                <div className="flex items-center justify-between p-2 border rounded bg-muted">
                  <div className="flex items-center gap-2">
                    {uploadedImage.toLowerCase().endsWith('.pdf') ? (
                      <FileText className="h-4 w-4" />
                    ) : uploadedImage.toLowerCase().endsWith('.ai') ? (
                      <File className="h-4 w-4" />
                    ) : (
                      <ImageIcon className="h-4 w-4" />
                    )}
                    <span className="text-sm truncate max-w-xs">File uploaded</span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setUploadedImage(null)}
                    className="text-destructive hover:text-destructive"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
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
                {isSubmitting ? 'Saving...' : editingTrim ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Brand Creation Dialog */}
      <CreateBrandDialog
        open={showBrandDialog}
        onOpenChange={setShowBrandDialog}
        onSuccess={(newBrand) => {
          fetchBrands();
          if (newBrand?.id) {
            setSelectedBrandId(newBrand.id.toString());
            setValue('brand_id', newBrand.id);
          }
        }}
      />
    </DashboardLayout>
  );
}
