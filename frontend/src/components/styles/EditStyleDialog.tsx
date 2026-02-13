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
import { Loader2, Edit, Plus, X, Upload, FileText, Image as ImageIcon, Info } from 'lucide-react';
import { MultiSelect, type MultiSelectOption } from '@/components/ui/multi-select';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { FileDropzone } from '@/components/ui/file-dropzone';

const styleSchema = z.object({
  style_number: z.string().min(1, 'Style number is required'),
  description: z.string().optional(),
  fabric_type_name: z.string().optional(),
  fabric_weight: z.string().optional(),
  color_id: z.coerce.number().optional(),
  fit: z.string().optional(),
  technical_file_paths: z.array(z.string()).optional(),
  brand_id: z.coerce.number().optional(),
  retailer_id: z.coerce.number().optional(),
  category_id: z.coerce.number().optional(),
  season_id: z.coerce.number().optional(),
  gender_id: z.coerce.number().min(1, 'Gender is required'),
  msrp: z.coerce.number().optional(),
  wholesale_price: z.coerce.number().optional(),
  is_active: z.boolean().optional(),
  trims: z.array(z.number()).optional(),
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
  const [uploadedImages, setUploadedImages] = useState<Array<{ path: string; url: string }>>([]);
  const [uploadedTechPacks, setUploadedTechPacks] = useState<string[]>([]); // Changed to array for multiple files
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isUploadingTechPack, setIsUploadingTechPack] = useState(false);
  const [selectedTrims, setSelectedTrims] = useState<number[]>([]);
  const [trims, setTrims] = useState<any[]>([]);
  const [genders, setGenders] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [retailers, setRetailers] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [seasons, setSeasons] = useState<any[]>([]);
  const [colors, setColors] = useState<any[]>([]);
  const [trimOptions, setTrimOptions] = useState<MultiSelectOption[]>([]);
  const [sizes, setSizes] = useState<any[]>([]); // Sizes based on selected gender
  const [selectedGender, setSelectedGender] = useState<number | undefined>();

  const form = useForm<StyleFormData>({
    resolver: zodResolver(styleSchema),
    defaultValues: {
      style_number: '',
      description: '',
      fabric_type_name: '',
      fabric_weight: '',
      color_id: undefined,
      fit: '',
      technical_file_paths: [],
      brand_id: undefined,
      retailer_id: undefined,
      category_id: undefined,
      season_id: undefined,
      gender_id: undefined,
      msrp: undefined,
      wholesale_price: undefined,
      is_active: true,
      trims: [],
    },
  });

  // Fetch master data when dialog opens
  useEffect(() => {
    const fetchMasterData = async () => {
      try {
        const api = (await import('@/lib/api')).default;
        const [
          trimsResponse,
          gendersResponse,
          brandsResponse,
          retailersResponse,
          categoriesResponse,
          seasonsResponse,
          colorsResponse,
        ] = await Promise.all([
          api.get('/master-data/trims?all=true'),
          api.get('/master-data/genders?active_only=true&all=true'),
          api.get('/master-data/brands?all=true'),
          api.get('/master-data/retailers?all=true'),
          api.get('/master-data/categories?all=true'),
          api.get('/master-data/seasons?all=true'),
          api.get('/master-data/colors?all=true'),
        ]);
        const fetchedTrims = trimsResponse.data || [];
        setTrims(fetchedTrims);
        setGenders(gendersResponse.data || []);
        setBrands(brandsResponse.data || []);
        setRetailers(retailersResponse.data || []);
        setCategories(categoriesResponse.data || []);
        setSeasons(seasonsResponse.data || []);
        setColors(colorsResponse.data || []);

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

  // Populate form when style changes
  useEffect(() => {
    if (style && open) {
      const genderId = style.gender_id || undefined;
      setSelectedGender(genderId);

      form.reset({
        style_number: style.style_number || '',
        description: style.description || '',
        fabric_type_name: style.fabric_type_name || '',
        fabric_weight: style.fabric_weight || '',
        color_id: style.color_id || undefined,
        fit: style.fit || '',
        technical_file_paths: style.technical_file_paths || [],
        brand_id: style.brand_id || undefined,
        retailer_id: style.retailer_id || undefined,
        category_id: style.category_id || undefined,
        season_id: style.season_id || undefined,
        gender_id: genderId,
        msrp: style.msrp || undefined,
        wholesale_price: style.wholesale_price || undefined,
        is_active: style.is_active !== undefined ? style.is_active : true,
        trims: [],
      });

      // Populate uploaded files
      if (style.images && Array.isArray(style.images)) {
        const imageData = style.images.map((img: string) => ({
          path: img,
          url: img.startsWith('http') ? img : `/storage/${img}`,
        }));
        setUploadedImages(imageData);
      } else {
        setUploadedImages([]);
      }
      setUploadedTechPacks(style.technical_file_paths || []);

      // Populate trims if style has associated trims
      if (style.trims && Array.isArray(style.trims)) {
        const trimIds = style.trims.map((t: any) => t.id || t);
        setSelectedTrims(trimIds);
      } else {
        setSelectedTrims([]);
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

      // Prepare data for API
      const styleData: any = {
        style_number: data.style_number,
        description: data.description || undefined,
        fabric_type_name: data.fabric_type_name || undefined,
        fabric_weight: data.fabric_weight || undefined,
        color_id: data.color_id || undefined,
        fit: data.fit || undefined,
        images: parsedImages,
        technical_file_paths: uploadedTechPacks.length > 0 ? uploadedTechPacks : undefined,
        brand_id: data.brand_id || undefined,
        retailer_id: data.retailer_id || undefined,
        category_id: data.category_id || undefined,
        season_id: data.season_id || undefined,
        gender_id: data.gender_id || undefined,
        // Pricing
        msrp: data.msrp || undefined,
        wholesale_price: data.wholesale_price || undefined,
        // Status
        is_active: data.is_active !== undefined ? data.is_active : true,
        // Trims
        trims: transformedTrims,
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

  const handleImageUpload = async (files: FileList) => {
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
    }
  };

  const handleTechPackUpload = async (files: FileList) => {
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
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="fabric_type_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fabric Type Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., 60/40 CVC 200GSM, Premium Cotton Twill"
                          {...field}
                        />
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
                  name="fabric_weight"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fabric Weight</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., 200 GSM, 5.5 oz/yd²" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="color_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Color</FormLabel>
                      <FormControl>
                        <Combobox
                          options={colors.map((color: any) => ({
                            label: `${color.name}${color.code ? ` (${color.code})` : ''}`,
                            value: color.id,
                            description: color.pantone_code || undefined,
                            searchTerms: [
                              color.name,
                              color.code || '',
                              color.pantone_code || ''
                            ].filter(Boolean),
                          }))}
                          value={field.value}
                          onChange={field.onChange}
                          placeholder="Select color..."
                          searchPlaceholder="Search by name, code, or Pantone..."
                          emptyMessage="No colors found"
                          clearable
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Pricing */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold border-b pb-2">Pricing</h3>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="msrp"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>MSRP</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" placeholder="0.00" {...field} />
                      </FormControl>
                      <FormDescription>Manufacturer Suggested Retail Price</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="wholesale_price"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Wholesale Price</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" placeholder="0.00" {...field} />
                      </FormControl>
                      <FormDescription>Price for wholesale customers</FormDescription>
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
                  name="brand_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Brand</FormLabel>
                      <FormControl>
                        <select
                          {...field}
                          value={field.value || ''}
                          onChange={(e) => {
                            const value = e.target.value ? parseInt(e.target.value) : undefined;
                            field.onChange(value);
                          }}
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <option value="">Select brand...</option>
                          {brands.map((brand: any) => (
                            <option key={brand.id} value={brand.id}>
                              {brand.name}
                            </option>
                          ))}
                        </select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="retailer_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Retailer</FormLabel>
                      <FormControl>
                        <select
                          {...field}
                          value={field.value || ''}
                          onChange={(e) => {
                            const value = e.target.value ? parseInt(e.target.value) : undefined;
                            field.onChange(value);
                          }}
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <option value="">Select retailer...</option>
                          {retailers.map((retailer: any) => (
                            <option key={retailer.id} value={retailer.id}>
                              {retailer.name}
                            </option>
                          ))}
                        </select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="category_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <FormControl>
                        <select
                          {...field}
                          value={field.value || ''}
                          onChange={(e) => {
                            const value = e.target.value ? parseInt(e.target.value) : undefined;
                            field.onChange(value);
                          }}
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <option value="">Select category...</option>
                          {categories.map((category: any) => (
                            <option key={category.id} value={category.id}>
                              {category.name}
                            </option>
                          ))}
                        </select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="season_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Season</FormLabel>
                      <FormControl>
                        <select
                          {...field}
                          value={field.value || ''}
                          onChange={(e) => {
                            const value = e.target.value ? parseInt(e.target.value) : undefined;
                            field.onChange(value);
                          }}
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <option value="">Select season...</option>
                          {seasons.map((season: any) => (
                            <option key={season.id} value={season.id}>
                              {season.name}
                            </option>
                          ))}
                        </select>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="gender_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Gender *</FormLabel>
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
                <FormField
                  control={form.control}
                  name="is_active"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Active</FormLabel>
                        <FormDescription>
                          Is this style currently active?
                        </FormDescription>
                      </div>
                      <FormControl>
                        <input
                          type="checkbox"
                          checked={field.value}
                          onChange={field.onChange}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                      </FormControl>
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
                <Label>Select Trims</Label>
                <MultiSelect
                  options={trimOptions}
                  selected={selectedTrims}
                  onChange={(selected) => setSelectedTrims(selected as number[])}
                  placeholder={trimOptions.length === 0 ? 'No trims available' : 'Select trims...'}
                  emptyMessage="No trims found."
                  disabled={trimOptions.length === 0}
                />
                {selectedTrims.length > 0 && (
                  <p className="text-sm text-muted-foreground">
                    <strong>{selectedTrims.length}</strong> trim{selectedTrims.length !== 1 ? 's' : ''} selected
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  To add new trims, visit the Master Data → Trims page
                </p>
              </div>
            </div>

            {/* Audit Information */}
            {style && style.creator && (
              <div className="space-y-4">
                <h3 className="text-sm font-semibold border-b pb-2 flex items-center gap-2">
                  <Info className="h-4 w-4" />
                  Audit Information
                </h3>
                <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">Created By</p>
                    <p className="text-sm font-medium">{style.creator?.name || 'Unknown'}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(style.created_at).toLocaleString()}
                    </p>
                  </div>
                  {style.updated_by && (
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">Last Updated By</p>
                      <p className="text-sm font-medium">{style.updatedBy?.name || 'Unknown'}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(style.updated_at).toLocaleString()}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Files & Documents */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold border-b pb-2">Files & Documents</h3>

              {/* Image Upload */}
              <div className="space-y-2">
                <Label>Style Images</Label>
                <FileDropzone
                  accept="image/*"
                  multiple
                  onUpload={handleImageUpload}
                  isUploading={isUploadingImage}
                  uploadedFiles={uploadedImages}
                  onRemove={removeImage}
                  type="image"
                  maxSizeMB={10}
                  helpText="Upload product images (PNG, JPG, etc.)"
                />
              </div>

              {/* Tech Pack Upload */}
              <div className="space-y-2">
                <Label>Technical Pack / Spec Sheet</Label>
                <FileDropzone
                  accept=".ai,.pdf,.jpg,.jpeg,.png"
                  multiple
                  onUpload={handleTechPackUpload}
                  isUploading={isUploadingTechPack}
                  uploadedFiles={uploadedTechPacks.map((path, idx) => ({
                    url: path,
                    path: path,
                    name: `Tech pack file ${idx + 1}`,
                  }))}
                  onRemove={removeTechPack}
                  type="document"
                  maxSizeMB={20}
                  helpText="Upload technical documents (.ai, .pdf, .jpeg, .png)"
                />
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
