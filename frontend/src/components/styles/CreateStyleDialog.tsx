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
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { FileDropzone } from '@/components/ui/file-dropzone';
// Import inline creation dialogs
import { CreateBrandDialog } from '@/components/master-data/CreateBrandDialog';
import { CreateCategoryDialog } from '@/components/master-data/CreateCategoryDialog';
import { CreateSeasonDialog } from '@/components/master-data/CreateSeasonDialog';
import { CreateRetailerDialog } from '@/components/master-data/CreateRetailerDialog';
import { CreateFabricTypeDialog } from '@/components/master-data/CreateFabricTypeDialog';
import { CreateFabricQualityDialog } from '@/components/master-data/CreateFabricQualityDialog';

const styleSchema = z.object({
  style_number: z.string().min(1, 'Style number is required'),
  description: z.string().optional(),
  fabric_type_id: z.coerce.number().optional(),
  fabric_quality_id: z.coerce.number().optional(),
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
  trims: z.array(z.number()).optional(),
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
  const [uploadedTechPacks, setUploadedTechPacks] = useState<string[]>([]);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isUploadingTechPack, setIsUploadingTechPack] = useState(false);
  const [trims, setTrims] = useState<any[]>([]);
  const [genders, setGenders] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [retailers, setRetailers] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [seasons, setSeasons] = useState<any[]>([]);
  const [colors, setColors] = useState<any[]>([]);
  const [fabricTypes, setFabricTypes] = useState<any[]>([]);
  const [fabricQualities, setFabricQualities] = useState<any[]>([]);
  const [selectedTrims, setSelectedTrims] = useState<number[]>([]);
  const [trimOptions, setTrimOptions] = useState<MultiSelectOption[]>([]);
  const [sizes, setSizes] = useState<any[]>([]);
  const [selectedGender, setSelectedGender] = useState<number | undefined>();

  // Inline dialog states for dynamic creation
  const [showBrandDialog, setShowBrandDialog] = useState(false);
  const [showCategoryDialog, setShowCategoryDialog] = useState(false);
  const [showSeasonDialog, setShowSeasonDialog] = useState(false);
  const [showRetailerDialog, setShowRetailerDialog] = useState(false);
  const [showFabricTypeDialog, setShowFabricTypeDialog] = useState(false);
  const [showFabricQualityDialog, setShowFabricQualityDialog] = useState(false);

  const form = useForm<StyleFormData>({
    resolver: zodResolver(styleSchema),
    defaultValues: {
      style_number: '',
      description: '',
      fabric_type_id: undefined,
      fabric_quality_id: undefined,
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
      trims: [],
    },
  });

  // Fetch all master data when dialog opens
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
          fabricTypesResponse,
          fabricQualitiesResponse,
        ] = await Promise.all([
          api.get('/master-data/trims?all=true'),
          api.get('/master-data/genders?active_only=true&all=true'),
          api.get('/master-data/brands?all=true'),
          api.get('/master-data/retailers?all=true'),
          api.get('/master-data/categories?all=true'),
          api.get('/master-data/seasons?all=true'),
          api.get('/master-data/colors?all=true'),
          api.get('/master-data/fabric-types?all=true'),
          api.get('/master-data/fabric-qualities?all=true'),
        ]);
        const fetchedTrims = trimsResponse.data || [];
        setTrims(fetchedTrims);
        setGenders(gendersResponse.data || []);
        setBrands(brandsResponse.data || []);
        setRetailers(retailersResponse.data || []);
        setCategories(categoriesResponse.data || []);
        setSeasons(seasonsResponse.data || []);
        setColors(colorsResponse.data || []);
        setFabricTypes(fabricTypesResponse.data || []);
        setFabricQualities(fabricQualitiesResponse.data || []);

        // Transform trims to multi-select options
        const options: MultiSelectOption[] = fetchedTrims.map((trim: any) => ({
          value: trim.id,
          label: `${trim.trim_code} - ${Array.isArray(trim.trim_types) ? trim.trim_types.join(', ') : trim.trim_type}`,
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

  // Refresh master data functions
  const refreshBrands = async () => {
    const api = (await import('@/lib/api')).default;
    const response = await api.get('/master-data/brands?all=true');
    setBrands(response.data || []);
  };

  const refreshCategories = async () => {
    const api = (await import('@/lib/api')).default;
    const response = await api.get('/master-data/categories?all=true');
    setCategories(response.data || []);
  };

  const refreshSeasons = async () => {
    const api = (await import('@/lib/api')).default;
    const response = await api.get('/master-data/seasons?all=true');
    setSeasons(response.data || []);
  };

  const refreshRetailers = async () => {
    const api = (await import('@/lib/api')).default;
    const response = await api.get('/master-data/retailers?all=true');
    setRetailers(response.data || []);
  };

  const refreshFabricTypes = async () => {
    const api = (await import('@/lib/api')).default;
    const response = await api.get('/master-data/fabric-types?all=true');
    setFabricTypes(response.data || []);
  };

  const refreshFabricQualities = async () => {
    const api = (await import('@/lib/api')).default;
    const response = await api.get('/master-data/fabric-qualities?all=true');
    setFabricQualities(response.data || []);
  };

  const onSubmit = async (data: StyleFormData) => {
    try {
      setIsSubmitting(true);

      let parsedImages = undefined;
      if (uploadedImages.length > 0) {
        parsedImages = uploadedImages.map(img => img.path);
      }

      let transformedTrims = undefined;
      if (selectedTrims.length > 0) {
        transformedTrims = selectedTrims.map(trimId => ({
          trim_id: trimId,
          quantity: null,
          notes: null,
        }));
      }

      const styleData: CreateStyleData = {
        style_number: data.style_number,
        description: data.description || undefined,
        fabric_type_id: data.fabric_type_id || undefined,
        fabric_quality_id: data.fabric_quality_id || undefined,
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
        msrp: data.msrp || undefined,
        wholesale_price: data.wholesale_price || undefined,
        is_active: true,
        trims: transformedTrims,
      };

      const newStyle = await createStandaloneStyle(styleData);
      toast.success(`Style "${newStyle.style_number}" created successfully`);
      form.reset();
      setSelectedTrims([]);
      setUploadedImages([]);
      setUploadedTechPacks([]);
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      console.error('Failed to create style:', error);
      const errorMessage = error.response?.data?.message || 'Failed to create style';
      toast.error(errorMessage);

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
    setUploadedTechPacks([]);
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

  // Helper component for select with add button
  const SelectWithAddButton = ({
    label,
    options,
    value,
    onChange,
    onAdd,
    placeholder,
    required = false,
  }: {
    label: string;
    options: any[];
    value: any;
    onChange: (value: any) => void;
    onAdd: () => void;
    placeholder: string;
    required?: boolean;
  }) => (
    <div className="space-y-2">
      <Label>{label}{required && ' *'}</Label>
      <div className="flex gap-2">
        <select
          value={value || ''}
          onChange={(e) => onChange(e.target.value ? parseInt(e.target.value) : undefined)}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="">{placeholder}</option>
          {options.map((option: any) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
        </select>
        <Button type="button" variant="outline" size="icon" onClick={onAdd} title={`Add new ${label.toLowerCase()}`}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );

  return (
    <>
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

              {/* Fabric Details - Dynamic with + buttons */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold border-b pb-2">Fabric Details</h3>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="fabric_type_id"
                    render={({ field }) => (
                      <FormItem>
                        <SelectWithAddButton
                          label="Fabric Type"
                          options={fabricTypes}
                          value={field.value}
                          onChange={field.onChange}
                          onAdd={() => setShowFabricTypeDialog(true)}
                          placeholder="Select fabric type..."
                        />
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="fabric_quality_id"
                    render={({ field }) => (
                      <FormItem>
                        <SelectWithAddButton
                          label="Fabric Quality"
                          options={fabricQualities}
                          value={field.value}
                          onChange={field.onChange}
                          onAdd={() => setShowFabricQualityDialog(true)}
                          placeholder="Select fabric quality..."
                        />
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
                              searchTerms: [color.name, color.code || '', color.pantone_code || ''].filter(Boolean),
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

              {/* Master Data - All with + buttons */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold border-b pb-2">Master Data</h3>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="brand_id"
                    render={({ field }) => (
                      <FormItem>
                        <SelectWithAddButton
                          label="Brand"
                          options={brands}
                          value={field.value}
                          onChange={field.onChange}
                          onAdd={() => setShowBrandDialog(true)}
                          placeholder="Select brand..."
                        />
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="retailer_id"
                    render={({ field }) => (
                      <FormItem>
                        <SelectWithAddButton
                          label="Retailer"
                          options={retailers}
                          value={field.value}
                          onChange={field.onChange}
                          onAdd={() => setShowRetailerDialog(true)}
                          placeholder="Select retailer..."
                        />
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="category_id"
                    render={({ field }) => (
                      <FormItem>
                        <SelectWithAddButton
                          label="Category"
                          options={categories}
                          value={field.value}
                          onChange={field.onChange}
                          onAdd={() => setShowCategoryDialog(true)}
                          placeholder="Select category..."
                        />
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="season_id"
                    render={({ field }) => (
                      <FormItem>
                        <SelectWithAddButton
                          label="Styles Created for Season"
                          options={seasons}
                          value={field.value}
                          onChange={field.onChange}
                          onAdd={() => setShowSeasonDialog(true)}
                          placeholder="Select season..."
                        />
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
                        <FormDescription>Select gender to load size options</FormDescription>
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

              {/* Files & Documents */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold border-b pb-2">Files & Documents</h3>

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
      </Dialog>

      {/* Inline creation dialogs */}
      <CreateBrandDialog
        open={showBrandDialog}
        onOpenChange={setShowBrandDialog}
        onSuccess={(newBrand) => {
          refreshBrands();
          if (newBrand?.id) {
            form.setValue('brand_id', newBrand.id);
          }
        }}
      />
      <CreateCategoryDialog
        open={showCategoryDialog}
        onOpenChange={setShowCategoryDialog}
        onSuccess={(newCategory) => {
          refreshCategories();
          if (newCategory?.id) {
            form.setValue('category_id', newCategory.id);
          }
        }}
      />
      <CreateSeasonDialog
        open={showSeasonDialog}
        onOpenChange={setShowSeasonDialog}
        onSuccess={() => {
          refreshSeasons();
        }}
      />
      <CreateRetailerDialog
        open={showRetailerDialog}
        onOpenChange={setShowRetailerDialog}
        onSuccess={() => {
          refreshRetailers();
        }}
      />
      <CreateFabricTypeDialog
        open={showFabricTypeDialog}
        onOpenChange={setShowFabricTypeDialog}
        onSuccess={(newFabricType) => {
          refreshFabricTypes();
          if (newFabricType?.id) {
            form.setValue('fabric_type_id', newFabricType.id);
          }
        }}
      />
      <CreateFabricQualityDialog
        open={showFabricQualityDialog}
        onOpenChange={setShowFabricQualityDialog}
        onSuccess={(newFabricQuality) => {
          refreshFabricQualities();
          if (newFabricQuality?.id) {
            form.setValue('fabric_quality_id', newFabricQuality.id);
          }
        }}
      />
    </>
  );
}
