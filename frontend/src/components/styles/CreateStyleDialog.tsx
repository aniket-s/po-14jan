'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { toast } from 'sonner';
import { createStandaloneStyle, type CreateStyleData } from '@/services/styles';
import { Loader2, Package, Plus, X, Upload, FileText, Image as ImageIcon } from 'lucide-react';
import { MultiSelect, type MultiSelectOption } from '@/components/ui/multi-select';
import { PrepackSelector } from './PrepackSelector';

const styleSchema = z.object({
  style_number: z.string().min(1, 'Style number is required'),
  description: z.string().optional(),
  fabric_type_name: z.string().optional(), // Combined fabric type and name
  color: z.string().optional(),
  color_code: z.string().optional(), // Pantone number
  size: z.string().optional(),
  fit: z.string().optional(),
  images: z.string().optional(), // Comma-separated URLs
  technical_file_paths: z.array(z.string()).optional(), // Changed to array for multiple files
  // Master data
  brand_id: z.coerce.number().optional(),
  gender_id: z.coerce.number().min(1, 'Gender is required'), // REQUIRED: Gender for size management
  // REMOVED from styles (PO-level fields):
  // - season_id
  // - agent_id
  // - vendor_id
  // REMOVED buyer/trim detail fields:
  // - price_ticket_spec
  // - labels_hangtags
  // - price_ticket_info
  // Trims (array of trim IDs)
  trims: z.array(z.number()).optional(),
  // Note: quantity, unit_price, size_breakdown removed - added at PO level
});

type StyleFormData = z.infer<typeof styleSchema>;

interface CreateStyleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function CreateStyleDialog({
  open,
  onOpenChange,
  onSuccess,
}: CreateStyleDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadedImages, setUploadedImages] = useState<Array<{ path: string; url: string }>>([]);
  const [uploadedTechPacks, setUploadedTechPacks] = useState<string[]>([]); // Changed to array for multiple files
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isUploadingTechPack, setIsUploadingTechPack] = useState(false);
  const [trims, setTrims] = useState<any[]>([]);
  const [genders, setGenders] = useState<any[]>([]); // NEW: Genders list
  const [selectedTrims, setSelectedTrims] = useState<number[]>([]);
  const [trimOptions, setTrimOptions] = useState<MultiSelectOption[]>([]);
  const [sizes, setSizes] = useState<any[]>([]); // Sizes based on selected gender
  const [selectedGender, setSelectedGender] = useState<number | undefined>();
  const [isCreateTrimDialogOpen, setIsCreateTrimDialogOpen] = useState(false);
  const [isCreatingTrim, setIsCreatingTrim] = useState(false);
  const [selectedPrepacks, setSelectedPrepacks] = useState<Array<{
    prepack_code_id: number;
    quantity: number;
    notes?: string;
  }>>([]);

  const form = useForm<StyleFormData>({
    resolver: zodResolver(styleSchema),
    defaultValues: {
      style_number: '',
      description: '',
      fabric_type_name: '', // Combined fabric type and name
      color: '',
      color_code: '', // Pantone number
      size: '',
      fit: '',
      images: '',
      technical_file_paths: [], // Changed to array
      gender_id: undefined, // NEW: Gender selection
      trims: [],
    },
  });

  // Fetch trims and genders when dialog opens
  useEffect(() => {
    const fetchMasterData = async () => {
      try {
        const api = (await import('@/lib/api')).default;
        const [trimsResponse, gendersResponse] = await Promise.all([
          api.get('/master-data/trims?all=true'),
          api.get('/master-data/genders?active_only=true&all=true'),
        ]);
        const fetchedTrims = trimsResponse.data || [];
        setTrims(fetchedTrims);
        setGenders(gendersResponse.data || []);

        // Transform trims to multi-select options
        const options: MultiSelectOption[] = fetchedTrims.map((trim: any) => ({
          value: trim.id,
          label: `${trim.trim_code} - ${trim.trim_type}`,
          description: trim.description || undefined,
        }));
        setTrimOptions(options);
      } catch (error) {
        console.error('Failed to fetch master data:', error);
      }
    };
    if (open) {
      fetchMasterData();
    }
  }, [open]);

  // Fetch sizes when gender changes
  useEffect(() => {
    const fetchSizes = async () => {
      if (!selectedGender) {
        setSizes([]);
        return;
      }

      try {
        const api = (await import('@/lib/api')).default;
        const response = await api.get(`/master-data/sizes?gender_id=${selectedGender}&active_only=true&all=true`);
        setSizes(response.data || []);
      } catch (error) {
        console.error('Failed to fetch sizes:', error);
        setSizes([]);
      }
    };

    fetchSizes();
  }, [selectedGender]);

  const onSubmit = async (data: StyleFormData) => {
    try {
      setIsSubmitting(true);

      // Use uploaded images - extract paths for API submission
      let parsedImages = undefined;
      if (uploadedImages.length > 0) {
        parsedImages = uploadedImages.map(img => img.path);
      }

      // Transform trims to correct format: array of objects with trim_id
      let transformedTrims = undefined;
      if (selectedTrims.length > 0) {
        transformedTrims = selectedTrims.map(trimId => ({
          trim_id: trimId,
          quantity: null,
          notes: null,
        }));
      }

      // Prepare data for API (removed: quantity, unit_price, size_breakdown - added at PO level)
      const styleData: CreateStyleData = {
        style_number: data.style_number,
        description: data.description || undefined,
        fabric_type_name: data.fabric_type_name || undefined, // Combined fabric type and name
        color: data.color || undefined,
        color_code: data.color_code || undefined, // Pantone number
        fit: data.fit || undefined,
        images: parsedImages,
        technical_file_paths: uploadedTechPacks.length > 0 ? uploadedTechPacks : undefined, // Changed to array
        brand_id: data.brand_id || undefined,
        gender_id: data.gender_id || undefined, // NEW: Gender for size management
        // REMOVED from styles (PO-level fields): season_id, agent_id, vendor_id
        // REMOVED buyer details fields:
        // - price_ticket_spec
        // - labels_hangtags
        // - price_ticket_info
        trims: transformedTrims,
        prepacks: selectedPrepacks.length > 0 ? selectedPrepacks : undefined,
      };

      const newStyle = await createStandaloneStyle(styleData);
      toast.success(`Style "${newStyle.style_number}" created successfully`);
      form.reset();
      setSelectedTrims([]);
      setSelectedPrepacks([]);
      setUploadedImages([]);
      setUploadedTechPacks([]); // Changed to array
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      console.error('Failed to create style:', error);
      const errorMessage = error.response?.data?.message || 'Failed to create style';
      toast.error(errorMessage);

      // Handle validation errors
      if (error.response?.data?.errors) {
        Object.entries(error.response.data.errors).forEach(([field, messages]) => {
          form.setError(field as any, {
            type: 'manual',
            message: (messages as string[])[0],
          });
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    form.reset();
    setSelectedTrims([]);
    setUploadedImages([]);
    setUploadedTechPacks([]); // Changed to array
    onOpenChange(false);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploadingImage(true);
    try {
      const formData = new FormData();
      for (let i = 0; i < files.length; i++) {
        formData.append('images[]', files[i]);
      }

      const api = (await import('@/lib/api')).default;
      const response = await api.post('/upload/style-images', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      // Extract both path (for API) and url (for preview) from uploaded images
      const imageData = response.data.images.map((img: any) => ({
        path: img.path,
        url: img.url,
      }));
      setUploadedImages([...uploadedImages, ...imageData]);

      toast.success(`${files.length} image(s) uploaded`);
    } catch (error) {
      console.error('Failed to upload images:', error);
      toast.error('Failed to upload images');
    } finally {
      setIsUploadingImage(false);
      // Reset input
      e.target.value = '';
    }
  };

  const handleTechPackUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploadingTechPack(true);
    try {
      const formData = new FormData();
      for (let i = 0; i < files.length; i++) {
        formData.append('files[]', files[i]);
      }

      const api = (await import('@/lib/api')).default;
      const response = await api.post('/upload/technical-files', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      // Extract paths from uploaded files
      const filePaths = response.data.files.map((file: any) => file.path);
      setUploadedTechPacks([...uploadedTechPacks, ...filePaths]);

      toast.success(`${files.length} tech pack file(s) uploaded`);
    } catch (error) {
      console.error('Failed to upload tech pack:', error);
      toast.error('Failed to upload tech pack');
    } finally {
      setIsUploadingTechPack(false);
      // Reset input
      e.target.value = '';
    }
  };

  const removeImage = (index: number) => {
    setUploadedImages(uploadedImages.filter((_, i) => i !== index));
  };

  const removeTechPack = (index: number) => {
    setUploadedTechPacks(uploadedTechPacks.filter((_, i) => i !== index));
  };

  const handleCreateTrim = async (trimData: any) => {
    setIsCreatingTrim(true);
    try {
      const api = (await import('@/lib/api')).default;
      const response = await api.post('/master-data/trims', trimData);
      const newTrim = response.data;

      // Refresh trims list
      const trimsResponse = await api.get('/master-data/trims?all=true');
      const fetchedTrims = trimsResponse.data || [];
      setTrims(fetchedTrims);

      // Update trim options
      const options: MultiSelectOption[] = fetchedTrims.map((trim: any) => ({
        value: trim.id,
        label: `${trim.trim_code} - ${trim.trim_type}`,
        description: trim.description || undefined,
      }));
      setTrimOptions(options);

      // Auto-select the newly created trim
      setSelectedTrims([...selectedTrims, newTrim.id]);

      toast.success('Trim created successfully');
      setIsCreateTrimDialogOpen(false);
    } catch (error: any) {
      console.error('Failed to create trim:', error);
      toast.error(error.response?.data?.message || 'Failed to create trim');
    } finally {
      setIsCreatingTrim(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Create New Style
          </DialogTitle>
          <DialogDescription>
            Create a standalone style that can be added to multiple purchase orders
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold border-b pb-2">Basic Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="style_number"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Style Number *</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., STY-2024-001" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="fit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fit</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Regular, Slim, Oversized" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Detailed description of the style..."
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Fabric & Color Details */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold border-b pb-2">Fabric & Color Details</h3>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="fabric_type_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fabric Type Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Premium Cotton Twill, 100% Polyester" {...field} />
                      </FormControl>
                      <FormDescription>
                        Combined fabric type and name
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="color"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Color</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Navy Blue, Red" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="color_code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Color Code (Pantone)</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., PMS 2965C, Pantone 19-4052" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Master Data */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold border-b pb-2">Master Data</h3>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="gender_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Gender</FormLabel>
                      <FormControl>
                        <select
                          {...field}
                          value={field.value || ''}
                          onChange={(e) => {
                            const value = e.target.value ? parseInt(e.target.value) : undefined;
                            field.onChange(value);
                            setSelectedGender(value);
                          }}
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <option value="">Select gender...</option>
                          {genders.map((gender: any) => (
                            <option key={gender.id} value={gender.id}>
                              {gender.name}
                            </option>
                          ))}
                        </select>
                      </FormControl>
                      <FormDescription>
                        Select gender to load size options
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {selectedGender && (
                  <div className="space-y-2">
                    <Label>Available Sizes</Label>
                    {sizes.length > 0 ? (
                      <>
                        <div className="flex flex-wrap gap-2 p-3 border rounded-md bg-muted/50">
                          {sizes.map((size: any) => (
                            <span key={size.id} className="px-2 py-1 text-xs bg-primary/10 text-primary rounded">
                              {size.size_code}
                            </span>
                          ))}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {sizes.length} size{sizes.length !== 1 ? 's' : ''} available for this gender
                        </p>
                      </>
                    ) : (
                      <div className="p-4 border rounded-md bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
                        <div className="flex items-start gap-3">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                              No sizes available for this gender
                            </p>
                            <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                              Please add sizes for {genders.find((g: any) => g.id === selectedGender)?.name} before creating a style.
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              window.open(`/master-data/sizes?gender=${selectedGender}`, '_blank');
                            }}
                            className="shrink-0"
                          >
                            Add Sizes
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Trims */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold border-b pb-2">Trims & Accessories</h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Select Trims</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsCreateTrimDialogOpen(true)}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Create Trim
                  </Button>
                </div>
                <MultiSelect
                  options={trimOptions}
                  selected={selectedTrims}
                  onChange={(selected) => setSelectedTrims(selected as number[])}
                  placeholder={trimOptions.length === 0 ? 'No trims available' : 'Select trims...'}
                  emptyMessage="No trims found. Click 'Create Trim' to add one."
                  disabled={trimOptions.length === 0}
                />
                {selectedTrims.length > 0 && (
                  <p className="text-sm text-muted-foreground">
                    <strong>{selectedTrims.length}</strong> trim{selectedTrims.length !== 1 ? 's' : ''} selected
                  </p>
                )}
              </div>
            </div>

            {/* Prepacks */}
            <div className="space-y-4">
              <PrepackSelector
                prepacks={selectedPrepacks}
                onChange={setSelectedPrepacks}
              />
            </div>

            {/* Files & Documents */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold border-b pb-2">Files & Documents</h3>

              {/* Image Upload */}
              <div className="space-y-2">
                <Label>Style Images</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageUpload}
                    disabled={isUploadingImage}
                    className="flex-1"
                  />
                  {isUploadingImage && <Loader2 className="h-4 w-4 animate-spin" />}
                </div>

                {uploadedImages.length > 0 && (
                  <div className="grid grid-cols-4 gap-2 mt-2">
                    {uploadedImages.map((img, index) => (
                      <div key={index} className="relative group">
                        <img
                          src={img.url}
                          alt={`Style ${index + 1}`}
                          className="w-full h-24 object-cover rounded border"
                        />
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => removeImage(index)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Upload product images (PNG, JPG, etc.)
                </p>
              </div>

              {/* Tech Pack Upload */}
              <div className="space-y-2">
                <Label>Technical Pack / Spec Sheet</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="file"
                    accept=".ai,.pdf,.jpg,.jpeg,.png"
                    multiple
                    onChange={handleTechPackUpload}
                    disabled={isUploadingTechPack}
                    className="flex-1"
                  />
                  {isUploadingTechPack && <Loader2 className="h-4 w-4 animate-spin" />}
                </div>

                {uploadedTechPacks.length > 0 && (
                  <div className="space-y-2">
                    {uploadedTechPacks.map((file, index) => (
                      <div key={index} className="flex items-center justify-between p-2 border rounded bg-muted">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          <span className="text-sm">Tech pack file {index + 1}</span>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeTechPack(index)}
                          className="text-destructive hover:text-destructive"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Upload technical documents (.ai, .pdf, .jpeg, .png) - Multiple files supported
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCancel} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Style'
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>

      {/* Inline Trim Creation Dialog */}
      <Dialog open={isCreateTrimDialogOpen} onOpenChange={setIsCreateTrimDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Trim</DialogTitle>
            <DialogDescription>Add a new trim/accessory to the system</DialogDescription>
          </DialogHeader>
          <InlineTrimForm onSubmit={handleCreateTrim} isSubmitting={isCreatingTrim} onCancel={() => setIsCreateTrimDialogOpen(false)} />
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}

// Inline Trim Creation Form Component
function InlineTrimForm({ onSubmit, isSubmitting, onCancel }: { onSubmit: (data: any) => void; isSubmitting: boolean; onCancel: () => void }) {
  const [formData, setFormData] = useState({
    brand_id: '',
    trim_type: '',
    trim_code: '',
    description: '',
    is_active: true,
    image_path: '',
    file_path: '',
  });
  const [brands, setBrands] = useState<any[]>([]);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isUploadingFile, setIsUploadingFile] = useState(false);

  useEffect(() => {
    const fetchBrands = async () => {
      try {
        const api = (await import('@/lib/api')).default;
        const response = await api.get('/master-data/brands?all=true');
        setBrands(response.data || []);
      } catch (error) {
        console.error('Failed to fetch brands:', error);
      }
    };
    fetchBrands();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.brand_id || !formData.trim_type || !formData.trim_code) {
      toast.error('Please fill in all required fields');
      return;
    }
    onSubmit({
      ...formData,
      brand_id: parseInt(formData.brand_id),
    });
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingImage(true);
    try {
      const formDataUpload = new FormData();
      formDataUpload.append('images[]', file);

      const api = (await import('@/lib/api')).default;
      const response = await api.post('/upload/style-images', formDataUpload, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const imagePath = response.data.images[0].path;
      setFormData({ ...formData, image_path: imagePath });
      toast.success('Image uploaded');
    } catch (error) {
      console.error('Failed to upload image:', error);
      toast.error('Failed to upload image');
    } finally {
      setIsUploadingImage(false);
      e.target.value = '';
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingFile(true);
    try {
      const formDataUpload = new FormData();
      formDataUpload.append('files[]', file);

      const api = (await import('@/lib/api')).default;
      const response = await api.post('/upload/technical-files', formDataUpload, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const filePath = response.data.files[0].path;
      setFormData({ ...formData, file_path: filePath });
      toast.success('File uploaded');
    } catch (error) {
      console.error('Failed to upload file:', error);
      toast.error('Failed to upload file');
    } finally {
      setIsUploadingFile(false);
      e.target.value = '';
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="trim_brand">Brand *</Label>
        <select
          id="trim_brand"
          value={formData.brand_id}
          onChange={(e) => setFormData({ ...formData, brand_id: e.target.value })}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          required
        >
          <option value="">Select brand...</option>
          {brands.map((brand) => (
            <option key={brand.id} value={brand.id}>{brand.name}</option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="trim_type">Trim Type *</Label>
        <select
          id="trim_type"
          value={formData.trim_type}
          onChange={(e) => setFormData({ ...formData, trim_type: e.target.value })}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          required
        >
          <option value="">Select type...</option>
          <option value="main_label">Main Label</option>
          <option value="size_label">Size Label</option>
          <option value="tag_1">Tag 1</option>
          <option value="tag_2">Tag 2</option>
          <option value="wash_care_label">Wash Care Label</option>
          <option value="special_label">Special Label</option>
          <option value="special_tag">Special Tag</option>
          <option value="price_ticket">Price Ticket</option>
        </select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="trim_code">Trim Code *</Label>
        <Input
          id="trim_code"
          value={formData.trim_code}
          onChange={(e) => setFormData({ ...formData, trim_code: e.target.value })}
          placeholder="e.g., LABEL-001"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="trim_description">Description</Label>
        <Textarea
          id="trim_description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          rows={2}
          placeholder="Optional description..."
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="trim_image">Trim Image (Optional)</Label>
        <Input
          id="trim_image"
          type="file"
          accept="image/jpeg,image/jpg,image/png"
          onChange={handleImageUpload}
          disabled={isUploadingImage || isSubmitting}
        />
        {isUploadingImage && <p className="text-sm text-muted-foreground">Uploading...</p>}
        {formData.image_path && (
          <p className="text-sm text-green-600">✓ Image uploaded</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="trim_file">Trim Document (Optional)</Label>
        <Input
          id="trim_file"
          type="file"
          accept=".pdf,.doc,.docx,.ai"
          onChange={handleFileUpload}
          disabled={isUploadingFile || isSubmitting}
        />
        {isUploadingFile && <p className="text-sm text-muted-foreground">Uploading...</p>}
        {formData.file_path && (
          <p className="text-sm text-green-600">✓ File uploaded</p>
        )}
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Creating...' : 'Create Trim'}
        </Button>
      </DialogFooter>
    </form>
  );
}
