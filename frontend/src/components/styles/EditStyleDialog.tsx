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
import { updateStandaloneStyle, type Style } from '@/services/styles';
import { Loader2, Edit, Plus, X, Upload, FileText, Image as ImageIcon } from 'lucide-react';
import { MultiSelect, type MultiSelectOption } from '@/components/ui/multi-select';
import { PrepackSelector } from './PrepackSelector';

const styleSchema = z.object({
  style_number: z.string().min(1, 'Style number is required'),
  description: z.string().optional(),
  fabric_type_name: z.string().optional(), // Combined fabric type and name
  color: z.string().optional(),
  color_code: z.string().optional(), // Pantone number
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

interface EditStyleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  style: Style | null;
  onSuccess: () => void;
}

export function EditStyleDialog({
  open,
  onOpenChange,
  style,
  onSuccess,
}: EditStyleDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [uploadedTechPacks, setUploadedTechPacks] = useState<string[]>([]); // Changed to array for multiple files
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isUploadingTechPack, setIsUploadingTechPack] = useState(false);
  const [selectedTrims, setSelectedTrims] = useState<number[]>([]);
  const [trims, setTrims] = useState<any[]>([]);
  const [genders, setGenders] = useState<any[]>([]);
  const [trimOptions, setTrimOptions] = useState<MultiSelectOption[]>([]);
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
      fabric_type_name: '',
      color: '',
      color_code: '',
      fit: '',
      images: '',
      technical_file_paths: [],
      gender_id: undefined,
      trims: [],
    },
  });

  // Fetch master data when dialog opens
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

  // Populate form when style changes
  useEffect(() => {
    if (style && open) {
      form.reset({
        style_number: style.style_number || '',
        description: style.description || '',
        fabric_type_name: style.fabric_type_name || '',
        color: style.color || '',
        color_code: style.color_code || '',
        fit: style.fit || '',
        images: style.images ? style.images.join(', ') : '',
        technical_file_paths: (style as any).technical_file_paths || [],
        gender_id: (style as any).gender_id || undefined,
        trims: [],
      });

      // Populate uploaded files
      setUploadedImages(style.images || []);
      setUploadedTechPacks((style as any).technical_file_paths || []);

      // Populate trims if style has associated trims
      if ((style as any).trims && Array.isArray((style as any).trims)) {
        const trimIds = (style as any).trims.map((t: any) => t.id || t);
        setSelectedTrims(trimIds);
      } else {
        setSelectedTrims([]);
      }

      // Populate prepacks if style has associated prepacks
      if ((style as any).prepacks && Array.isArray((style as any).prepacks)) {
        setSelectedPrepacks((style as any).prepacks);
      } else {
        setSelectedPrepacks([]);
      }
    }
  }, [style, open, form]);

  const onSubmit = async (data: StyleFormData) => {
    if (!style) {
      toast.error('No style selected');
      return;
    }

    try {
      setIsSubmitting(true);

      // Use uploaded images
      let parsedImages = undefined;
      if (uploadedImages.length > 0) {
        parsedImages = uploadedImages;
      }

      // Prepare data for API (removed: quantity, unit_price, size_breakdown - added at PO level)
      const styleData: any = {
        style_number: data.style_number,
        description: data.description || undefined,
        fabric_type_name: data.fabric_type_name || undefined,
        color: data.color || undefined,
        color_code: data.color_code || undefined,
        fit: data.fit || undefined,
        images: parsedImages,
        technical_file_paths: uploadedTechPacks.length > 0 ? uploadedTechPacks : undefined,
        brand_id: data.brand_id || undefined,
        gender_id: data.gender_id || undefined,
        // REMOVED from styles (PO-level fields): season_id, agent_id, vendor_id
        // REMOVED buyer details fields
        trims: selectedTrims.length > 0 ? selectedTrims : undefined,
        prepacks: selectedPrepacks.length > 0 ? selectedPrepacks : undefined,
      };

      const updatedStyle = await updateStandaloneStyle(style.id, styleData);
      toast.success(`Style "${updatedStyle.style_number}" updated successfully`);
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      console.error('Failed to update style:', error);
      const errorMessage = error.response?.data?.message || 'Failed to update style';
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
    setUploadedImages([]);
    setUploadedTechPacks([]);
    setSelectedTrims([]);
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

      // Extract paths from uploaded images
      const imagePaths = response.data.images.map((img: any) => img.path);
      setUploadedImages([...uploadedImages, ...imagePaths]);

      toast.success(`${files.length} image(s) uploaded`);
    } catch (error) {
      console.error('Failed to upload images:', error);
      toast.error('Failed to upload images');
    } finally {
      setIsUploadingImage(false);
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
      e.target.value = '';
    }
  };

  const removeImage = (index: number) => {
    setUploadedImages(uploadedImages.filter((_, i) => i !== index));
  };

  const removeTechPack = (index: number) => {
    setUploadedTechPacks(uploadedTechPacks.filter((_, i) => i !== index));
  };

  if (!style) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit className="h-5 w-5" />
            Edit Style: {style.style_number}
          </DialogTitle>
          <DialogDescription>
            Update the style master data. Changes will affect the base information, not PO-specific data.
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
              <FormField
                control={form.control}
                name="fabric_type_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fabric Type Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., 100% Cotton Jersey, Polyester Blend" {...field} />
                    </FormControl>
                    <FormDescription>Combined fabric type and name</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
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
                        <Input placeholder="e.g., PMS 2965C, 19-4052 TPX" {...field} />
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
                          onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
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
                        Select gender for size management
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Trims */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold border-b pb-2">Trims & Accessories</h3>
              <div className="space-y-2">
                <Label>Select Trims</Label>
                <MultiSelect
                  options={trimOptions}
                  selected={selectedTrims}
                  onChange={(selected) => setSelectedTrims(selected as number[])}
                  placeholder={trimOptions.length === 0 ? 'No trims available' : 'Select trims...'}
                  emptyMessage="No trims found. Please add trims in the master data section."
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
                          src={img}
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
                    Updating...
                  </>
                ) : (
                  'Update Style'
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
