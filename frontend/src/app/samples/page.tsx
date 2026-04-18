'use client';

// Disable static generation for this authenticated page
export const dynamic = 'force-dynamic';

import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Plus,
  Loader2,
  PackageCheck,
  AlertCircle,
  Upload,
  RefreshCw,
  LayoutGrid,
  TableIcon,
} from 'lucide-react';
import api from '@/lib/api';
import { ListPageSkeleton } from '@/components/skeletons';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuth } from '@/contexts/AuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MultiFileUpload, UploadedFile } from '@/components/ui/multi-file-upload';

// New redesigned components
import { Sample, SampleType, Style, SampleFilters, ViewMode } from '@/components/samples/types';
import { SampleKPICards } from '@/components/samples/SampleKPICards';
import { SampleFilterBar } from '@/components/samples/SampleFilterBar';
import { SampleKanbanBoard } from '@/components/samples/SampleKanbanBoard';
import { SampleTableView } from '@/components/samples/SampleTableView';
import { SampleDetailPanel } from '@/components/samples/SampleDetailPanel';

const sampleSchema = z.object({
  style_id: z.coerce.number().min(1, 'Style is required'),
  sample_type_id: z.coerce.number().min(1, 'Sample type is required'),
  notes: z.string().optional(),
});

type SampleFormData = z.infer<typeof sampleSchema>;

export default function SamplesPage() {
  const { user, hasRole, can } = useAuth();

  // Data
  const [samples, setSamples] = useState<Sample[]>([]);
  const [sampleTypes, setSampleTypes] = useState<SampleType[]>([]);
  const [styles, setStyles] = useState<Style[]>([]);
  const [loading, setLoading] = useState(true);

  // View state
  const [viewMode, setViewMode] = useState<ViewMode>('table');
  const [selectedSample, setSelectedSample] = useState<Sample | null>(null);
  const [kpiFilter, setKpiFilter] = useState<string>('');

  // Filters
  const [filters, setFilters] = useState<SampleFilters>({
    search: '',
    status: 'all',
    sampleType: 'all',
    dateRange: 'all',
  });

  // Dialogs
  const [isSubmitDialogOpen, setIsSubmitDialogOpen] = useState(false);
  const [isApprovalDialogOpen, setIsApprovalDialogOpen] = useState(false);
  const [approvalSample, setApprovalSample] = useState<Sample | null>(null);
  const [approvalType, setApprovalType] = useState<'agency' | 'importer' | 'importer_on_behalf'>('agency');
  const [approvalAction, setApprovalAction] = useState<'approve' | 'reject'>('approve');
  const [approvalComments, setApprovalComments] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // File uploads
  const [imageFiles, setImageFiles] = useState<UploadedFile[]>([]);
  const [documentFiles, setDocumentFiles] = useState<UploadedFile[]>([]);

  // Resubmit
  const [isResubmitDialogOpen, setIsResubmitDialogOpen] = useState(false);
  const [resubmitSample, setResubmitSample] = useState<Sample | null>(null);
  const [resubmitNotes, setResubmitNotes] = useState('');
  const [resubmitImageFiles, setResubmitImageFiles] = useState<UploadedFile[]>([]);
  const [resubmitDocumentFiles, setResubmitDocumentFiles] = useState<UploadedFile[]>([]);

  // Excel upload
  const [isUploadingExcel, setIsUploadingExcel] = useState(false);
  const [excelResult, setExcelResult] = useState<any>(null);
  const excelInputRef = useRef<HTMLInputElement>(null);

  const {
    register: registerSample,
    handleSubmit: handleSubmitSample,
    formState: { errors: sampleErrors },
    reset: resetSample,
    setValue: setSampleValue,
    watch: watchSample,
  } = useForm<SampleFormData>({
    resolver: zodResolver(sampleSchema),
  });

  const watchedStyleId = watchSample('style_id');

  // Determine user role
  const userRole: 'factory' | 'agency' | 'importer' | 'other' = useMemo(() => {
    if (hasRole('Factory')) return 'factory';
    if (hasRole('Agency')) return 'agency';
    if (hasRole('Importer')) return 'importer';
    return 'other';
  }, [hasRole]);

  // Set default view based on role
  useEffect(() => {
    if (userRole === 'agency' || userRole === 'importer') {
      setViewMode('board');
    } else {
      setViewMode('table');
    }
  }, [userRole]);

  // Fetch data
  useEffect(() => {
    fetchSamples();
    fetchSampleTypes();
    fetchStyles();
  }, []);

  const fetchSamples = async () => {
    try {
      setLoading(true);
      const params: any = {};
      if (filters.search) params.search = filters.search;
      if (filters.status !== 'all') params.final_status = filters.status;

      const response = await api.get('/samples', { params });
      const data = response.data;
      setSamples(Array.isArray(data) ? data : (data.samples || data.data || []));
    } catch (error) {
      console.error('Failed to fetch samples:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSampleTypes = async () => {
    try {
      const response = await api.get('/admin/sample-types');
      const data = response.data;
      setSampleTypes(Array.isArray(data) ? data : (data.sample_types || data.data || []));
    } catch (error) {
      console.error('Failed to fetch sample types:', error);
    }
  };

  const fetchStyles = async () => {
    try {
      const response = await api.get('/styles', { params: { per_page: 100 } });
      const stylesData = response.data;
      setStyles(Array.isArray(stylesData) ? stylesData : (stylesData.styles || stylesData.data || []));
    } catch (error) {
      console.error('Failed to fetch styles:', error);
    }
  };

  // Re-fetch when search/status filters change (with debounce for search)
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchSamples();
    }, filters.search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [filters.search, filters.status]);

  // Base filtered samples (sampleType + dateRange but NOT kpiFilter) - used by KPI cards
  const baseFilteredSamples = useMemo(() => {
    let result = samples;

    // Sample type filter
    if (filters.sampleType !== 'all') {
      result = result.filter(s => s.sample_type_id === parseInt(filters.sampleType));
    }

    // Date range filter
    if (filters.dateRange !== 'all') {
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      let startDate: Date;

      switch (filters.dateRange) {
        case 'today':
          startDate = startOfDay;
          break;
        case 'week':
          startDate = new Date(startOfDay);
          startDate.setDate(startDate.getDate() - startOfDay.getDay());
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        case 'quarter':
          startDate = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
          break;
        default:
          startDate = new Date(0);
      }

      result = result.filter(s => {
        const sampleDate = new Date(s.submission_date || s.created_at);
        return sampleDate >= startDate;
      });
    }

    return result;
  }, [samples, filters.sampleType, filters.dateRange]);

  // Full filtered samples (base + KPI filter) - used by board/table
  const filteredSamples = useMemo(() => {
    let result = baseFilteredSamples;

    if (kpiFilter) {
      switch (kpiFilter) {
        case 'needs_agency_review':
          result = result.filter(s => s.agency_status === 'pending');
          break;
        case 'agency_approved':
          result = result.filter(s => s.agency_status === 'approved');
          break;
        case 'agency_rejected':
          result = result.filter(s => s.agency_status === 'rejected');
          break;
        case 'passed_to_importer':
        case 'needs_importer_review':
          result = result.filter(s => s.agency_status === 'approved' && s.importer_status === 'pending');
          break;
        case 'pending':
          result = result.filter(s => s.final_status === 'pending');
          break;
        case 'approved':
          result = result.filter(s => s.final_status === 'approved');
          break;
        case 'rejected':
          result = result.filter(s => s.final_status === 'rejected');
          break;
      }
    }

    return result;
  }, [baseFilteredSamples, kpiFilter]);

  // Permission checks
  const canApproveAsAgency = useCallback((sample: Sample) => {
    return hasRole('Agency') && sample.agency_status === 'pending';
  }, [hasRole]);

  const canApproveAsImporter = useCallback((sample: Sample) => {
    return hasRole('Importer') && sample.agency_status === 'approved' && sample.importer_status === 'pending';
  }, [hasRole]);

  const canApproveOnBehalfOfImporter = useCallback((sample: Sample) => {
    return hasRole('Agency') && sample.agency_status === 'approved' && sample.importer_status === 'pending';
  }, [hasRole]);

  const canResubmitSample = useCallback((sample: Sample) => {
    return (hasRole('Factory') || sample.submitted_by?.id === user?.id) && sample.final_status === 'rejected';
  }, [hasRole, user]);

  const canDeleteSample = useCallback((sample: Sample) => {
    return (hasRole('Factory') || sample.submitted_by?.id === user?.id) && sample.agency_status === 'pending';
  }, [hasRole, user]);

  // File upload handler
  const uploadFiles = async (files: UploadedFile[], type: 'image' | 'document'): Promise<string[]> => {
    const uploadedUrls: string[] = [];
    for (const uploadedFile of files) {
      try {
        const formData = new FormData();
        formData.append('file', uploadedFile.file);
        formData.append('type', type);
        formData.append('folder', 'samples');

        const response = await api.post('/upload/file', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        uploadedUrls.push(response.data.file.url);
      } catch (err) {
        console.error('File upload failed:', err);
      }
    }
    return uploadedUrls;
  };

  // Submit sample
  const onSubmitSample = async (data: SampleFormData) => {
    setIsSubmitting(true);
    try {
      const imageUrls = await uploadFiles(imageFiles, 'image');
      const documentUrls = await uploadFiles(documentFiles, 'document');

      await api.post('/samples', {
        ...data,
        images: imageUrls,
        attachment_paths: documentUrls,
      });

      setIsSubmitDialogOpen(false);
      resetSample();
      setImageFiles([]);
      setDocumentFiles([]);
      fetchSamples();
    } catch (error) {
      console.error('Failed to submit sample:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Approval handler
  const openApprovalDialog = (sample: Sample, type: 'agency' | 'importer' | 'importer_on_behalf', action: 'approve' | 'reject') => {
    setApprovalSample(sample);
    setApprovalType(type);
    setApprovalAction(action);
    setApprovalComments('');
    setIsApprovalDialogOpen(true);
  };

  const submitApproval = async () => {
    if (!approvalSample) return;
    setIsSubmitting(true);
    try {
      let endpoint: string;
      if (approvalType === 'agency') {
        endpoint = `/samples/${approvalSample.id}/agency-${approvalAction}`;
      } else if (approvalType === 'importer_on_behalf') {
        // Delegation is approve-only by design; no reject-on-behalf endpoint.
        endpoint = `/samples/${approvalSample.id}/importer-approve-on-behalf`;
      } else {
        endpoint = `/samples/${approvalSample.id}/importer-${approvalAction}`;
      }

      await api.post(endpoint, {
        reason: approvalComments,
        comments: approvalComments,
      });
      setIsApprovalDialogOpen(false);
      setApprovalSample(null);
      setApprovalComments('');
      setSelectedSample(null);
      fetchSamples();
    } catch (error) {
      console.error('Failed to process approval:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Bulk approval
  const handleBulkApprove = async (sampleIds: number[], type: 'agency' | 'importer') => {
    setIsSubmitting(true);
    try {
      for (const id of sampleIds) {
        const endpoint = type === 'agency'
          ? `/samples/${id}/agency-approve`
          : `/samples/${id}/importer-approve`;
        await api.post(endpoint, { comments: 'Bulk approved' });
      }
      setSelectedSample(null);
      fetchSamples();
    } catch (error) {
      console.error('Bulk approval failed:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBulkReject = async (sampleIds: number[], type: 'agency' | 'importer') => {
    const reason = window.prompt('Enter rejection reason for all selected samples:');
    if (!reason) return;
    setIsSubmitting(true);
    try {
      for (const id of sampleIds) {
        const endpoint = type === 'agency'
          ? `/samples/${id}/agency-reject`
          : `/samples/${id}/importer-reject`;
        await api.post(endpoint, { reason, comments: reason });
      }
      setSelectedSample(null);
      fetchSamples();
    } catch (error) {
      console.error('Bulk rejection failed:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Excel upload
  const handleExcelUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setIsUploadingExcel(true);
    setExcelResult(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await api.post('/samples/bulk-approve-excel', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setExcelResult(response.data.result);
      fetchSamples();
    } catch (error: any) {
      console.error('Failed to process Excel:', error);
      setExcelResult({ processed: 0, errors: [error.response?.data?.message || 'Upload failed'] });
    } finally {
      setIsUploadingExcel(false);
      if (excelInputRef.current) excelInputRef.current.value = '';
    }
  };

  // Resubmit handler
  const openResubmitDialog = (sample: Sample) => {
    setResubmitSample(sample);
    setResubmitNotes(sample.notes || '');
    setResubmitImageFiles([]);
    setResubmitDocumentFiles([]);
    setIsResubmitDialogOpen(true);
  };

  const handleResubmit = async () => {
    if (!resubmitSample) return;
    setIsSubmitting(true);
    try {
      const imageUrls: string[] = [];
      for (const f of resubmitImageFiles) {
        if (f.url) {
          imageUrls.push(f.url as string);
        } else if (f.file) {
          const formData = new FormData();
          formData.append('file', f.file);
          formData.append('type', 'image');
          formData.append('folder', 'samples');
          const response = await api.post('/upload/file', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
          if (response.data?.file?.url) imageUrls.push(response.data.file.url);
        }
      }

      const docUrls: string[] = [];
      for (const f of resubmitDocumentFiles) {
        if (f.url) {
          docUrls.push(f.url as string);
        } else if (f.file) {
          const formData = new FormData();
          formData.append('file', f.file);
          formData.append('type', 'document');
          formData.append('folder', 'samples');
          const response = await api.post('/upload/file', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
          if (response.data?.file?.url) docUrls.push(response.data.file.url);
        }
      }

      await api.post(`/samples/${resubmitSample.id}/resubmit`, {
        notes: resubmitNotes || null,
        ...(imageUrls.length > 0 ? { images: imageUrls } : {}),
        ...(docUrls.length > 0 ? { attachment_paths: docUrls } : {}),
      });
      setIsResubmitDialogOpen(false);
      setResubmitSample(null);
      setSelectedSample(null);
      fetchSamples();
    } catch (error: any) {
      console.error('Failed to resubmit:', error);
      alert(error.response?.data?.message || 'Failed to resubmit sample');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete handler
  const handleDeleteSample = async (sample: Sample) => {
    if (!confirm('Delete this sample? This action cannot be undone.')) return;
    try {
      await api.delete(`/samples/${sample.id}`);
      if (selectedSample?.id === sample.id) setSelectedSample(null);
      fetchSamples();
    } catch (error: any) {
      console.error('Failed to delete:', error);
      alert(error.response?.data?.message || 'Failed to delete sample');
    }
  };

  // Sample type prerequisite check
  const getSampleTypeInfo = (sampleTypeId: number) => {
    const sampleType = sampleTypes.find(st => st.id === sampleTypeId);
    if (!sampleType) return { canSubmit: true, reason: '' };

    if (watchedStyleId) {
      const existingSample = samples.find(
        s => s.sample_type_id === sampleTypeId && s.style_id === watchedStyleId && s.final_status !== 'rejected'
      );
      if (existingSample) {
        const statusLabel = existingSample.final_status === 'approved' ? 'Approved' : 'Pending';
        return { canSubmit: false, reason: `Already ${statusLabel}` };
      }
    }

    if (sampleType.allows_parallel_submission) return { canSubmit: true, reason: '' };

    if (sampleType.prerequisites && sampleType.prerequisites.length > 0) {
      for (const prereqName of sampleType.prerequisites) {
        const prereqType = sampleTypes.find(st => st.name === prereqName);
        if (!prereqType) continue;
        const prerequisiteApproved = samples.some(
          s => s.sample_type_id === prereqType.id && (!watchedStyleId || s.style_id === watchedStyleId) && s.final_status === 'approved'
        );
        if (!prerequisiteApproved) {
          return { canSubmit: false, reason: `Prerequisite "${prereqType.display_name || prereqType.name}" must be approved first` };
        }
      }
    }

    return { canSubmit: true, reason: '' };
  };

  // Quick filter for "My Pending Reviews"
  const handleQuickFilter = () => {
    if (userRole === 'agency') {
      setKpiFilter(kpiFilter === 'needs_agency_review' ? '' : 'needs_agency_review');
    } else if (userRole === 'importer') {
      setKpiFilter(kpiFilter === 'needs_importer_review' ? '' : 'needs_importer_review');
    }
  };

  if (loading && samples.length === 0) {
    return (
      <DashboardLayout requiredPermissions={['sample.view', 'sample.view_own', 'sample.submit', 'sample.create', 'sample.approve_final', 'sample.approve_agency']} requireAll={false}>
        <ListPageSkeleton statCards={4} filterCount={1} columns={9} rows={5} />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout requiredPermissions={['sample.view', 'sample.view_own', 'sample.submit', 'sample.create', 'sample.approve_final', 'sample.approve_agency']} requireAll={false}>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Samples</h1>
            <p className="text-sm text-muted-foreground">
              {userRole === 'factory' && 'Submit and track your sample submissions'}
              {userRole === 'agency' && 'Review and approve factory sample submissions'}
              {userRole === 'importer' && 'Final review and approval of samples'}
              {userRole === 'other' && 'Manage sample submissions and approvals'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* View Toggle */}
            <div className="flex items-center rounded-lg border bg-muted p-0.5">
              <Button
                variant={viewMode === 'board' ? 'default' : 'ghost'}
                size="sm"
                className="h-7 px-2.5 text-xs"
                onClick={() => setViewMode('board')}
              >
                <LayoutGrid className="h-3.5 w-3.5 mr-1" />
                Board
              </Button>
              <Button
                variant={viewMode === 'table' ? 'default' : 'ghost'}
                size="sm"
                className="h-7 px-2.5 text-xs"
                onClick={() => setViewMode('table')}
              >
                <TableIcon className="h-3.5 w-3.5 mr-1" />
                Table
              </Button>
            </div>

            {/* Agency Excel Upload */}
            {hasRole('Agency') && (
              <>
                <input
                  ref={excelInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleExcelUpload}
                  className="hidden"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => excelInputRef.current?.click()}
                  disabled={isUploadingExcel}
                  className="h-8"
                >
                  {isUploadingExcel ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Upload className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  Bulk Approve
                </Button>
              </>
            )}

            {/* Submit Sample */}
            {(can('sample.create') || can('sample.submit')) && (
              <Dialog open={isSubmitDialogOpen} onOpenChange={setIsSubmitDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="h-8">
                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                    Submit Sample
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                  <form onSubmit={handleSubmitSample(onSubmitSample)}>
                    <DialogHeader>
                      <DialogTitle>Submit New Sample</DialogTitle>
                      <DialogDescription>
                        Upload sample files and details for the approval workflow
                      </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="style_id">Style *</Label>
                          <Select onValueChange={(value) => setSampleValue('style_id', parseInt(value))}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select style" />
                            </SelectTrigger>
                            <SelectContent>
                              {styles.map((style) => (
                                <SelectItem key={style.id} value={style.id.toString()}>
                                  {style.style_number} - {style.purchase_orders?.[0]?.po_number}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {sampleErrors.style_id && (
                            <p className="text-xs text-destructive">{sampleErrors.style_id.message}</p>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="sample_type_id">Sample Type *</Label>
                          <Select onValueChange={(value) => {
                            const typeId = parseInt(value);
                            setSampleValue('sample_type_id', typeId);
                            const info = getSampleTypeInfo(typeId);
                            if (!info.canSubmit) alert(info.reason);
                          }}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select sample type" />
                            </SelectTrigger>
                            <SelectContent>
                              {sampleTypes.filter(st => st.is_active).map((st) => {
                                const info = getSampleTypeInfo(st.id);
                                return (
                                  <SelectItem key={st.id} value={st.id.toString()} disabled={!info.canSubmit}>
                                    {st.display_name || st.name}
                                    {!info.canSubmit && ` - ${info.reason}`}
                                  </SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>
                          {sampleErrors.sample_type_id && (
                            <p className="text-xs text-destructive">{sampleErrors.sample_type_id.message}</p>
                          )}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="notes">Notes</Label>
                        <textarea
                          id="notes"
                          className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                          placeholder="Sample details, specifications..."
                          {...registerSample('notes')}
                        />
                      </div>

                      {/* File Uploads */}
                      <Tabs defaultValue="images" className="w-full">
                        <TabsList className="grid w-full grid-cols-2">
                          <TabsTrigger value="images">Images ({imageFiles.length})</TabsTrigger>
                          <TabsTrigger value="documents">Documents ({documentFiles.length})</TabsTrigger>
                        </TabsList>
                        <TabsContent value="images" className="space-y-4">
                          <MultiFileUpload
                            files={imageFiles}
                            onChange={setImageFiles}
                            accept="image/*"
                            maxFiles={10}
                            label="Sample Images"
                            description="Upload photos of the sample"
                            disabled={isSubmitting}
                            showRemarks={true}
                          />
                        </TabsContent>
                        <TabsContent value="documents" className="space-y-4">
                          <MultiFileUpload
                            files={documentFiles}
                            onChange={setDocumentFiles}
                            accept=".pdf,.xlsx,.xls,.csv,.doc,.docx"
                            maxFiles={5}
                            label="Sample Documents"
                            description="Upload PDFs, Excel files, or other documents"
                            disabled={isSubmitting}
                            showRemarks={true}
                          />
                        </TabsContent>
                      </Tabs>

                      <div className="rounded-lg bg-muted p-3 text-sm">
                        <p className="font-medium flex items-center gap-2">
                          <AlertCircle className="h-4 w-4" />
                          Approval Workflow
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Factory submits → Agency reviews → Importer gives final approval.
                        </p>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setIsSubmitDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? (
                          <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Submitting...</>
                        ) : (
                          <><PackageCheck className="mr-2 h-4 w-4" />Submit Sample</>
                        )}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>

        {/* Excel Upload Result */}
        {excelResult && (
          <div className="rounded-lg border bg-card p-3">
            <div className="flex items-center justify-between">
              <div className="flex gap-4 text-sm">
                <span>Processed: <strong>{excelResult.processed}</strong></span>
                <span className="text-green-600">Approved: <strong>{excelResult.approved}</strong></span>
                <span className="text-red-600">Rejected: <strong>{excelResult.rejected}</strong></span>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setExcelResult(null)}>Dismiss</Button>
            </div>
            {excelResult.errors?.length > 0 && (
              <div className="mt-2 text-xs text-destructive">
                {excelResult.errors.map((err: string, i: number) => <p key={i}>{err}</p>)}
              </div>
            )}
          </div>
        )}

        {/* KPI Cards */}
        <SampleKPICards
          samples={baseFilteredSamples}
          role={userRole}
          activeFilter={kpiFilter}
          onFilterClick={setKpiFilter}
        />

        {/* Filter Bar */}
        <SampleFilterBar
          filters={filters}
          onFiltersChange={setFilters}
          sampleTypes={sampleTypes}
          hasQuickFilter={userRole === 'agency' || userRole === 'importer'}
          quickFilterLabel={userRole === 'agency' ? 'My Pending Reviews' : 'My Pending Reviews'}
          onQuickFilter={handleQuickFilter}
        />

        {/* Main Content: Split-pane with detail panel */}
        <div className="flex gap-4 min-h-[500px]">
          {/* Left: Board or Table */}
          <div className={`flex-1 min-w-0 ${selectedSample ? 'hidden lg:block' : ''}`}>
            {viewMode === 'board' ? (
              <SampleKanbanBoard
                samples={filteredSamples}
                selectedSampleId={selectedSample?.id || null}
                onSelectSample={setSelectedSample}
                role={userRole}
              />
            ) : (
              <SampleTableView
                samples={filteredSamples}
                sampleTypes={sampleTypes}
                selectedSampleId={selectedSample?.id || null}
                onSelectSample={setSelectedSample}
                onApprove={(sample, type) => openApprovalDialog(sample, type, 'approve')}
                onReject={(sample, type) => openApprovalDialog(sample, type, 'reject')}
                onResubmit={openResubmitDialog}
                onDelete={handleDeleteSample}
                onBulkApprove={handleBulkApprove}
                onBulkReject={handleBulkReject}
                canApproveAsAgency={canApproveAsAgency}
                canApproveAsImporter={canApproveAsImporter}
                canResubmitSample={canResubmitSample}
                canDeleteSample={canDeleteSample}
                role={userRole}
              />
            )}
          </div>

          {/* Right: Detail Panel */}
          {selectedSample && (
            <div className="w-full lg:w-[380px] shrink-0">
              <SampleDetailPanel
                sample={selectedSample}
                onClose={() => setSelectedSample(null)}
                onApprove={(sample, type) => openApprovalDialog(sample, type, 'approve')}
                onReject={(sample, type) => openApprovalDialog(sample, type, 'reject')}
                onResubmit={openResubmitDialog}
                onDelete={handleDeleteSample}
                canApproveAgency={canApproveAsAgency(selectedSample)}
                canApproveImporter={canApproveAsImporter(selectedSample)}
                canApproveOnBehalfOfImporter={canApproveOnBehalfOfImporter(selectedSample)}
                canResubmit={canResubmitSample(selectedSample)}
                canDelete={canDeleteSample(selectedSample)}
              />
            </div>
          )}
        </div>

        {/* Approval Dialog */}
        <Dialog open={isApprovalDialogOpen} onOpenChange={setIsApprovalDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {approvalAction === 'approve' ? 'Approve' : 'Reject'} Sample
              </DialogTitle>
              <DialogDescription>
                {approvalAction === 'approve'
                  ? approvalType === 'agency'
                    ? 'Approve this sample as Agency'
                    : approvalType === 'importer_on_behalf'
                      ? 'Approve this sample on behalf of the Importer'
                      : 'Approve this sample as Importer'
                  : `Reject this sample as ${approvalType === 'agency' ? 'Agency' : 'Importer'}`
                }
              </DialogDescription>
            </DialogHeader>

            {approvalSample && (
              <div className="space-y-4">
                <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div><span className="text-muted-foreground">Type:</span> {approvalSample.sample_type?.display_name || approvalSample.sample_type?.name}</div>
                    <div><span className="text-muted-foreground">Style:</span> {approvalSample.style?.style_number}</div>
                    <div><span className="text-muted-foreground">By:</span> {approvalSample.submitted_by?.name || 'N/A'}</div>
                    <div><span className="text-muted-foreground">Date:</span> {approvalSample.submission_date ? new Date(approvalSample.submission_date).toLocaleDateString() : 'N/A'}</div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>
                    {approvalAction === 'reject' ? 'Reason for Rejection *' : 'Comments (Optional)'}
                  </Label>
                  <textarea
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    placeholder={approvalAction === 'reject' ? 'Provide reason for rejection...' : 'Add your comments...'}
                    value={approvalComments}
                    onChange={(e) => setApprovalComments(e.target.value)}
                  />
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsApprovalDialogOpen(false)}>Cancel</Button>
              <Button
                onClick={submitApproval}
                disabled={isSubmitting}
                variant={approvalAction === 'approve' ? 'default' : 'destructive'}
              >
                {isSubmitting ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processing...</>
                ) : (
                  approvalAction === 'approve' ? 'Approve' : 'Reject'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Resubmit Dialog */}
        <Dialog open={isResubmitDialogOpen} onOpenChange={(open) => {
          setIsResubmitDialogOpen(open);
          if (!open) setResubmitSample(null);
        }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Resubmit Sample</DialogTitle>
              <DialogDescription>
                Review the rejection reason and upload updated files
              </DialogDescription>
            </DialogHeader>

            {resubmitSample && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-muted-foreground">Type:</span> {resubmitSample.sample_type?.display_name || resubmitSample.sample_type?.name}</div>
                  <div><span className="text-muted-foreground">Style:</span> {resubmitSample.style?.style_number}</div>
                </div>

                {(resubmitSample.agency_rejection_reason || resubmitSample.importer_rejection_reason) && (
                  <div className="rounded-lg border border-red-200 bg-red-50 dark:bg-red-950 dark:border-red-800 p-3 space-y-1">
                    <p className="text-sm font-semibold text-red-800 dark:text-red-300">Rejection Reason:</p>
                    <p className="text-sm text-red-700 dark:text-red-400">
                      {resubmitSample.importer_rejection_reason || resubmitSample.agency_rejection_reason}
                    </p>
                    <p className="text-xs text-red-500 dark:text-red-500">
                      Rejected by {resubmitSample.importer_rejection_reason ? 'Importer' : 'Agency'}
                    </p>
                  </div>
                )}

                {/* Previous files reference */}
                {resubmitSample.images && resubmitSample.images.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Previous Images</p>
                    <div className="flex flex-wrap gap-2">
                      {resubmitSample.images.map((url, idx) => (
                        <a key={idx} href={url} target="_blank" rel="noopener noreferrer">
                          <img src={url} alt={`Previous ${idx + 1}`} className="h-14 w-14 object-cover rounded border opacity-60" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Upload New Images (optional)</Label>
                  <MultiFileUpload
                    files={resubmitImageFiles}
                    onChange={setResubmitImageFiles}
                    accept="image/*"
                    maxFiles={10}
                    label="Drop images here"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Upload New Documents (optional)</Label>
                  <MultiFileUpload
                    files={resubmitDocumentFiles}
                    onChange={setResubmitDocumentFiles}
                    accept=".pdf,.doc,.docx,.xls,.xlsx"
                    maxFiles={5}
                    label="Drop documents here"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Notes</Label>
                  <textarea
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    value={resubmitNotes}
                    onChange={(e) => setResubmitNotes(e.target.value)}
                    placeholder="Add notes for the resubmission..."
                  />
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsResubmitDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleResubmit} disabled={isSubmitting}>
                {isSubmitting ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Resubmitting...</>
                ) : (
                  <><RefreshCw className="mr-2 h-4 w-4" />Resubmit Sample</>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
