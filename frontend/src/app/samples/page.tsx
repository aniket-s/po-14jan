'use client';

// Disable static generation for this authenticated page
export const dynamic = 'force-dynamic';

import { useEffect, useState, useRef } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Search, Loader2, CheckCircle, XCircle, Clock, PackageCheck, AlertCircle, Upload, RefreshCw, Trash2, FileText, Image, ExternalLink, Eye } from 'lucide-react';
import api from '@/lib/api';
import { ListPageSkeleton, TableSkeleton } from '@/components/skeletons';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuth } from '@/contexts/AuthContext';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MultiFileUpload, UploadedFile } from '@/components/ui/multi-file-upload';

interface Sample {
  id: number;
  style_id: number;
  sample_type_id: number;
  sample_reference: string | null;
  submission_date: string;
  agency_status: string;
  agency_approved_by: number | null;
  agency_approved_at: string | null;
  agency_rejection_reason: string | null;
  importer_status: string;
  importer_approved_by: number | null;
  importer_approved_at: string | null;
  importer_rejection_reason: string | null;
  final_status: string;
  notes: string | null;
  images: string[] | null;
  attachment_paths: string[] | null;
  created_at: string;
  style?: {
    style_number: string;
    purchase_orders?: Array<{
      id: number;
      po_number: string;
    }>;
  };
  sample_type?: {
    name: string;
    display_name?: string;
    display_order: number;
  };
  submitted_by?: {
    id: number;
    name: string;
    email: string;
  };
}

interface SampleType {
  id: number;
  name: string;
  display_name: string;
  description: string | null;
  display_order: number;
  is_active: boolean;
  prerequisites: string[] | null;
  allows_parallel_submission?: boolean;
  can_submit?: boolean;
}

interface Style {
  id: number;
  style_number: string;
  purchase_orders?: Array<{
    id: number;
    po_number: string;
  }>;
}

const sampleSchema = z.object({
  style_id: z.coerce.number().min(1, 'Style is required'),
  sample_type_id: z.coerce.number().min(1, 'Sample type is required'),
  notes: z.string().optional(),
});

type SampleFormData = z.infer<typeof sampleSchema>;

const approvalSchema = z.object({
  comments: z.string().optional(),
});

type ApprovalFormData = z.infer<typeof approvalSchema>;

export default function SamplesPage() {
  const { user, hasRole, can } = useAuth();
  const [samples, setSamples] = useState<Sample[]>([]);
  const [sampleTypes, setSampleTypes] = useState<SampleType[]>([]);
  const [styles, setStyles] = useState<Style[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isSubmitDialogOpen, setIsSubmitDialogOpen] = useState(false);
  const [isApprovalDialogOpen, setIsApprovalDialogOpen] = useState(false);
  const [selectedSample, setSelectedSample] = useState<Sample | null>(null);
  const [approvalType, setApprovalType] = useState<'agency' | 'importer'>('agency');
  const [approvalAction, setApprovalAction] = useState<'approve' | 'reject'>('approve');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imageFiles, setImageFiles] = useState<UploadedFile[]>([]);
  const [documentFiles, setDocumentFiles] = useState<UploadedFile[]>([]);
  const [isResubmitDialogOpen, setIsResubmitDialogOpen] = useState(false);
  const [resubmitSample, setResubmitSample] = useState<Sample | null>(null);
  const [resubmitNotes, setResubmitNotes] = useState('');
  const [resubmitImageFiles, setResubmitImageFiles] = useState<UploadedFile[]>([]);
  const [resubmitDocumentFiles, setResubmitDocumentFiles] = useState<UploadedFile[]>([]);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);
  const [viewSampleData, setViewSampleData] = useState<any>(null);
  const [viewTimeline, setViewTimeline] = useState<any[]>([]);
  const [viewLoading, setViewLoading] = useState(false);
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

  const {
    register: registerApproval,
    handleSubmit: handleSubmitApproval,
    formState: { errors: approvalErrors },
    reset: resetApproval,
  } = useForm<ApprovalFormData>({
    resolver: zodResolver(approvalSchema),
  });

  useEffect(() => {
    fetchSamples();
    fetchSampleTypes();
    fetchStyles();
  }, [searchTerm, statusFilter]);

  const fetchSamples = async () => {
    try {
      setLoading(true);
      const params: any = {};

      if (searchTerm) {
        params.search = searchTerm;
      }

      if (statusFilter !== 'all') {
        params.final_status = statusFilter;
      }

      const response = await api.get('/samples', { params });
      setSamples(response.data.samples || response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch samples:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSampleTypes = async () => {
    try {
      const response = await api.get('/admin/sample-types');
      setSampleTypes(response.data.sample_types || response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch sample types:', error);
    }
  };

  const fetchStyles = async () => {
    try {
      const response = await api.get('/styles', {
        params: { per_page: 100 },
      });
      setStyles(response.data.styles || response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch styles:', error);
    }
  };

  const uploadFiles = async (files: UploadedFile[], type: 'image' | 'document'): Promise<string[]> => {
    const uploadedUrls: string[] = [];

    for (const uploadedFile of files) {
      try {
        const fileIndex = type === 'image' ? imageFiles.findIndex(f => f.id === uploadedFile.id) : documentFiles.findIndex(f => f.id === uploadedFile.id);

        if (fileIndex !== -1) {
          const updatedFiles = type === 'image' ? [...imageFiles] : [...documentFiles];
          updatedFiles[fileIndex] = { ...updatedFiles[fileIndex], uploading: true, progress: 0 };
          type === 'image' ? setImageFiles(updatedFiles) : setDocumentFiles(updatedFiles);
        }

        const formData = new FormData();
        formData.append('file', uploadedFile.file);
        formData.append('type', type);
        formData.append('folder', 'samples');

        const response = await api.post('/upload/file', formData, {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
          onUploadProgress: (progressEvent) => {
            if (progressEvent.total) {
              const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
              const updatedFiles = type === 'image' ? [...imageFiles] : [...documentFiles];
              const idx = updatedFiles.findIndex(f => f.id === uploadedFile.id);
              if (idx !== -1) {
                updatedFiles[idx] = { ...updatedFiles[idx], progress };
                type === 'image' ? setImageFiles(updatedFiles) : setDocumentFiles(updatedFiles);
              }
            }
          },
        });

        uploadedUrls.push(response.data.file.url);

        const updatedFiles = type === 'image' ? [...imageFiles] : [...documentFiles];
        const idx = updatedFiles.findIndex(f => f.id === uploadedFile.id);
        if (idx !== -1) {
          updatedFiles[idx] = { ...updatedFiles[idx], uploading: false, url: response.data.file.url };
          type === 'image' ? setImageFiles(updatedFiles) : setDocumentFiles(updatedFiles);
        }
      } catch (err: any) {
        console.error('File upload failed:', err);
        const updatedFiles = type === 'image' ? [...imageFiles] : [...documentFiles];
        const idx = updatedFiles.findIndex(f => f.id === uploadedFile.id);
        if (idx !== -1) {
          updatedFiles[idx] = { ...updatedFiles[idx], uploading: false, error: 'Upload failed' };
          type === 'image' ? setImageFiles(updatedFiles) : setDocumentFiles(updatedFiles);
        }
      }
    }

    return uploadedUrls;
  };

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

  const openApprovalDialog = (sample: Sample, type: 'agency' | 'importer', action: 'approve' | 'reject') => {
    setSelectedSample(sample);
    setApprovalType(type);
    setApprovalAction(action);
    setIsApprovalDialogOpen(true);
  };

  const onSubmitApproval = async (data: ApprovalFormData) => {
    if (!selectedSample) return;

    setIsSubmitting(true);
    try {
      const endpoint = approvalType === 'agency'
        ? `/samples/${selectedSample.id}/agency-${approvalAction}`
        : `/samples/${selectedSample.id}/importer-${approvalAction}`;

      await api.post(endpoint, {
        reason: data.comments,
        comments: data.comments,
      });
      setIsApprovalDialogOpen(false);
      resetApproval();
      setSelectedSample(null);
      fetchSamples();
    } catch (error) {
      console.error('Failed to process approval:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

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
      setExcelResult({
        processed: 0,
        errors: [error.response?.data?.message || 'Upload failed'],
      });
    } finally {
      setIsUploadingExcel(false);
      if (excelInputRef.current) {
        excelInputRef.current.value = '';
      }
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'secondary',
      approved: 'default',
      rejected: 'destructive',
    };
    return colors[status] || 'secondary';
  };

  const getFinalStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'rejected':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const canApproveAsAgency = (sample: Sample) => {
    return hasRole('Agency') && sample.agency_status === 'pending';
  };

  const canApproveAsImporter = (sample: Sample) => {
    return hasRole('Importer') && sample.agency_status === 'approved' && sample.importer_status === 'pending';
  };

  // Factory can resubmit rejected samples
  const canResubmit = (sample: Sample) => {
    return (hasRole('Factory') || sample.submitted_by?.id === user?.id) && sample.final_status === 'rejected';
  };

  // Factory can delete own pending samples (not yet reviewed)
  const canDelete = (sample: Sample) => {
    return (hasRole('Factory') || sample.submitted_by?.id === user?.id) && sample.agency_status === 'pending';
  };

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
      const imageUrls = resubmitImageFiles
        .filter(f => f.url)
        .map(f => f.url as string);
      const docUrls = resubmitDocumentFiles
        .filter(f => f.url)
        .map(f => f.url as string);

      await api.post(`/samples/${resubmitSample.id}/resubmit`, {
        notes: resubmitNotes || null,
        ...(imageUrls.length > 0 ? { images: imageUrls } : {}),
        ...(docUrls.length > 0 ? { attachment_paths: docUrls } : {}),
      });
      setIsResubmitDialogOpen(false);
      setResubmitSample(null);
      fetchSamples();
    } catch (error: any) {
      console.error('Failed to resubmit:', error);
      alert(error.response?.data?.message || 'Failed to resubmit sample');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openViewDialog = async (sample: Sample) => {
    setIsViewDialogOpen(true);
    setViewLoading(true);
    setViewSampleData(null);
    setViewTimeline([]);
    try {
      const response = await api.get(`/samples/${sample.id}/timeline`);
      setViewSampleData(response.data.sample);
      setViewTimeline(response.data.timeline || []);
    } catch (error) {
      console.error('Failed to fetch sample details:', error);
    } finally {
      setViewLoading(false);
    }
  };

  const getTimelineIcon = (action: string) => {
    switch (action) {
      case 'created': return <Plus className="h-4 w-4 text-blue-500" />;
      case 'sample_agency_approved': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'sample_agency_rejected': return <XCircle className="h-4 w-4 text-red-500" />;
      case 'sample_importer_approved': return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'sample_importer_rejected': return <XCircle className="h-4 w-4 text-red-600" />;
      case 'sample_resubmitted': return <RefreshCw className="h-4 w-4 text-blue-500" />;
      default: return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getTimelineColor = (action: string) => {
    if (action.includes('approved')) return 'border-green-500';
    if (action.includes('rejected')) return 'border-red-500';
    if (action.includes('resubmitted')) return 'border-blue-500';
    if (action === 'created') return 'border-blue-500';
    return 'border-gray-300';
  };

  const handleDeleteSample = async (sample: Sample) => {
    if (!confirm('Delete this sample? This action cannot be undone.')) return;
    try {
      await api.delete(`/samples/${sample.id}`);
      fetchSamples();
    } catch (error: any) {
      console.error('Failed to delete:', error);
      alert(error.response?.data?.message || 'Failed to delete sample');
    }
  };

  const getSampleTypeInfo = (sampleTypeId: number) => {
    const sampleType = sampleTypes.find(st => st.id === sampleTypeId);
    if (!sampleType) return { canSubmit: true, reason: '' };

    // Check if this sample type already exists for the selected style
    // with a non-rejected status (pending or approved)
    if (watchedStyleId) {
      const existingSample = samples.find(
        s => s.sample_type_id === sampleTypeId &&
             s.style_id === watchedStyleId &&
             s.final_status !== 'rejected'
      );
      if (existingSample) {
        const statusLabel = existingSample.final_status === 'approved' ? 'Approved' : 'Pending';
        return {
          canSubmit: false,
          reason: `Already ${statusLabel}`,
        };
      }
    }

    if (sampleType.allows_parallel_submission) {
      return { canSubmit: true, reason: '' };
    }

    if (sampleType.prerequisites && sampleType.prerequisites.length > 0) {
      for (const prereqName of sampleType.prerequisites) {
        const prereqType = sampleTypes.find(st => st.name === prereqName);
        if (!prereqType) continue;

        const prerequisiteApproved = samples.some(
          s => s.sample_type_id === prereqType.id &&
               (!watchedStyleId || s.style_id === watchedStyleId) &&
               s.final_status === 'approved'
        );

        if (!prerequisiteApproved) {
          return {
            canSubmit: false,
            reason: `Prerequisite "${prereqType.display_name || prereqType.name}" must be approved first`,
          };
        }
      }
    }

    return { canSubmit: true, reason: '' };
  };

  return (
    <DashboardLayout requiredPermissions={['sample.view', 'sample.view_own', 'sample.submit', 'sample.create', 'sample.approve_final', 'sample.approve_agency']} requireAll={false}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Samples</h1>
            <p className="text-muted-foreground">Manage sample submissions and approvals</p>
          </div>
          <div className="flex gap-2">
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
                >
                  {isUploadingExcel ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="mr-2 h-4 w-4" />
                  )}
                  Bulk Approve (Excel)
                </Button>
              </>
            )}
            {(can('sample.create') || can('sample.submit')) && (
              <Dialog open={isSubmitDialogOpen} onOpenChange={setIsSubmitDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="mr-2 h-4 w-4" />
                    Submit Sample
                  </Button>
                </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <form onSubmit={handleSubmitSample(onSubmitSample)}>
                  <DialogHeader>
                    <DialogTitle>Submit Sample</DialogTitle>
                    <DialogDescription>
                      Submit a new sample for approval
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
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
                        <p className="text-sm text-destructive">{sampleErrors.style_id.message}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="sample_type_id">Sample Type *</Label>
                      <Select onValueChange={(value) => {
                        const typeId = parseInt(value);
                        setSampleValue('sample_type_id', typeId);
                        const info = getSampleTypeInfo(typeId);
                        if (!info.canSubmit) {
                          alert(info.reason);
                        }
                      }}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select sample type" />
                        </SelectTrigger>
                        <SelectContent>
                          {sampleTypes.filter(st => st.is_active).map((sampleType) => {
                            const info = getSampleTypeInfo(sampleType.id);
                            return (
                              <SelectItem
                                key={sampleType.id}
                                value={sampleType.id.toString()}
                                disabled={!info.canSubmit}
                              >
                                {sampleType.display_name || sampleType.name}
                                {sampleType.allows_parallel_submission && ' (Can submit in parallel)'}
                                {!info.canSubmit && ` - ${info.reason}`}
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                      {sampleErrors.sample_type_id && (
                        <p className="text-sm text-destructive">{sampleErrors.sample_type_id.message}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="notes">Notes</Label>
                      <textarea
                        id="notes"
                        className="flex min-h-[100px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        placeholder="Sample details, specifications, etc..."
                        {...registerSample('notes')}
                      />
                    </div>

                    {/* File Uploads with Tabs */}
                    <Tabs defaultValue="images" className="w-full">
                      <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="images">
                          Images ({imageFiles.length})
                        </TabsTrigger>
                        <TabsTrigger value="documents">
                          Documents ({documentFiles.length})
                        </TabsTrigger>
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
                        Factory submits samples. Agency reviews and approves/rejects first, then importer gives final approval.
                      </p>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsSubmitDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={isSubmitting}>
                      {isSubmitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        <>
                          <PackageCheck className="mr-2 h-4 w-4" />
                          Submit Sample
                        </>
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
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Excel Upload Result</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-4 text-sm">
                <span>Processed: <strong>{excelResult.processed}</strong></span>
                <span className="text-green-600">Approved: <strong>{excelResult.approved}</strong></span>
                <span className="text-red-600">Rejected: <strong>{excelResult.rejected}</strong></span>
              </div>
              {excelResult.errors?.length > 0 && (
                <div className="mt-2 text-xs text-destructive">
                  {excelResult.errors.map((err: string, i: number) => (
                    <p key={i}>{err}</p>
                  ))}
                </div>
              )}
              <Button variant="ghost" size="sm" className="mt-2" onClick={() => setExcelResult(null)}>
                Dismiss
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Info Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Samples</CardTitle>
              <PackageCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{samples.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Approved</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {samples.filter(s => s.final_status === 'approved').length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
              <Clock className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {samples.filter(s => s.final_status === 'pending').length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Rejected</CardTitle>
              <XCircle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {samples.filter(s => s.final_status === 'rejected').length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
            <CardDescription>Search and filter samples</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by style, PO number..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <TableSkeleton columns={9} rows={5} hasHeader={false} />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sample Type</TableHead>
                    <TableHead>Style</TableHead>
                    <TableHead>PO Number</TableHead>
                    <TableHead>Submitted By</TableHead>
                    <TableHead>Agency Status</TableHead>
                    <TableHead>Importer Status</TableHead>
                    <TableHead>Final Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {samples.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-muted-foreground">
                        No samples found
                      </TableCell>
                    </TableRow>
                  ) : (
                    samples.map((sample) => (
                      <TableRow key={sample.id}>
                        <TableCell className="font-medium">
                          {sample.sample_type?.display_name || sample.sample_type?.name}
                          {sample.sample_type && sample.sample_type.display_order <= 5 && (
                            <Badge variant="outline" className="ml-2 text-xs">
                              Parallel
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>{sample.style?.style_number}</TableCell>
                        <TableCell>{sample.style?.purchase_orders?.[0]?.po_number || 'N/A'}</TableCell>
                        <TableCell>{sample.submitted_by?.name || 'N/A'}</TableCell>
                        <TableCell>
                          <Badge variant={getStatusColor(sample.agency_status) as any}>
                            {sample.agency_status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={getStatusColor(sample.importer_status) as any}>
                            {sample.importer_status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getFinalStatusIcon(sample.final_status)}
                            <Badge variant={getStatusColor(sample.final_status) as any}>
                              {sample.final_status}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>{formatDate(sample.submission_date)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openViewDialog(sample)}
                              className="text-muted-foreground hover:text-foreground"
                            >
                              <Eye className="mr-1 h-4 w-4" />
                              View
                            </Button>
                            {canApproveAsAgency(sample) && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openApprovalDialog(sample, 'agency', 'approve')}
                                  className="text-green-600 hover:text-green-700"
                                >
                                  <CheckCircle className="mr-1 h-4 w-4" />
                                  Approve
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openApprovalDialog(sample, 'agency', 'reject')}
                                  className="text-red-600 hover:text-red-700"
                                >
                                  <XCircle className="mr-1 h-4 w-4" />
                                  Reject
                                </Button>
                              </>
                            )}
                            {canApproveAsImporter(sample) && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openApprovalDialog(sample, 'importer', 'approve')}
                                  className="text-green-600 hover:text-green-700"
                                >
                                  <CheckCircle className="mr-1 h-4 w-4" />
                                  Approve
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openApprovalDialog(sample, 'importer', 'reject')}
                                  className="text-red-600 hover:text-red-700"
                                >
                                  <XCircle className="mr-1 h-4 w-4" />
                                  Reject
                                </Button>
                              </>
                            )}
                            {canResubmit(sample) && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openResubmitDialog(sample)}
                                className="text-blue-600 hover:text-blue-700"
                              >
                                <RefreshCw className="mr-1 h-4 w-4" />
                                Resubmit
                              </Button>
                            )}
                            {canDelete(sample) && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteSample(sample)}
                                className="text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="mr-1 h-4 w-4" />
                                Delete
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Approval Dialog */}
        <Dialog open={isApprovalDialogOpen} onOpenChange={setIsApprovalDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <form onSubmit={handleSubmitApproval(onSubmitApproval)}>
              <DialogHeader>
                <DialogTitle>
                  {approvalAction === 'approve' ? 'Approve' : 'Reject'} Sample as{' '}
                  {approvalType === 'agency' ? 'Agency' : 'Importer'}
                </DialogTitle>
                <DialogDescription>
                  Review sample details and {approvalAction === 'approve' ? 'approve' : 'reject'}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                {/* Sample Details */}
                {selectedSample && (
                  <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                    <h4 className="text-sm font-semibold">Sample Details</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div><span className="text-muted-foreground">Type:</span> {selectedSample.sample_type?.display_name || selectedSample.sample_type?.name}</div>
                      <div><span className="text-muted-foreground">Style:</span> {selectedSample.style?.style_number}</div>
                      <div><span className="text-muted-foreground">Submitted by:</span> {selectedSample.submitted_by?.name || 'N/A'}</div>
                      <div><span className="text-muted-foreground">Date:</span> {selectedSample.submission_date ? new Date(selectedSample.submission_date).toLocaleDateString() : 'N/A'}</div>
                    </div>

                    {/* Notes from Factory */}
                    {selectedSample.notes && (
                      <div className="space-y-1">
                        <p className="text-sm font-medium">Notes from Factory:</p>
                        <p className="text-sm bg-background rounded p-2 border">{selectedSample.notes}</p>
                      </div>
                    )}

                    {/* Uploaded Images */}
                    {selectedSample.images && selectedSample.images.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-sm font-medium flex items-center gap-1"><Image className="h-4 w-4" /> Images ({selectedSample.images.length})</p>
                        <div className="flex flex-wrap gap-2">
                          {selectedSample.images.map((url, idx) => (
                            <a key={idx} href={url} target="_blank" rel="noopener noreferrer" className="block">
                              <img src={url} alt={`Sample image ${idx + 1}`} className="h-20 w-20 object-cover rounded border hover:opacity-80 transition" />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Uploaded Documents */}
                    {selectedSample.attachment_paths && selectedSample.attachment_paths.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-sm font-medium flex items-center gap-1"><FileText className="h-4 w-4" /> Documents ({selectedSample.attachment_paths.length})</p>
                        <div className="space-y-1">
                          {selectedSample.attachment_paths.map((url, idx) => (
                            <a key={idx} href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sm text-blue-600 hover:underline">
                              <ExternalLink className="h-3 w-3" />
                              Document {idx + 1}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="comments">
                    {approvalAction === 'reject' ? 'Reason for Rejection (Required)' : 'Comments (Optional)'}
                  </Label>
                  <textarea
                    id="comments"
                    className="flex min-h-[100px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    placeholder={approvalAction === 'reject' ? 'Provide reason for rejection...' : 'Add your comments...'}
                    {...registerApproval('comments')}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsApprovalDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  variant={approvalAction === 'approve' ? 'default' : 'destructive'}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      {approvalAction === 'approve' ? (
                        <CheckCircle className="mr-2 h-4 w-4" />
                      ) : (
                        <XCircle className="mr-2 h-4 w-4" />
                      )}
                      {approvalAction === 'approve' ? 'Approve' : 'Reject'}
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
        {/* View Sample Detail Dialog */}
        <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Sample Details</DialogTitle>
              <DialogDescription>
                Full sample information and approval timeline
              </DialogDescription>
            </DialogHeader>

            {viewLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : viewSampleData ? (
              <div className="space-y-6">
                {/* Sample Info */}
                <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                  <h4 className="text-sm font-semibold">Sample Information</h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div><span className="text-muted-foreground">Type:</span> {viewSampleData.sample_type?.display_name || viewSampleData.sample_type?.name}</div>
                    <div><span className="text-muted-foreground">Style:</span> {viewSampleData.style?.style_number}</div>
                    <div><span className="text-muted-foreground">PO Number:</span> {viewSampleData.po_number || 'N/A'}</div>
                    <div><span className="text-muted-foreground">Reference:</span> {viewSampleData.sample_reference || 'N/A'}</div>
                    <div><span className="text-muted-foreground">Submitted by:</span> {viewSampleData.submitted_by?.name || 'N/A'}</div>
                    <div><span className="text-muted-foreground">Submission Date:</span> {viewSampleData.submission_date || 'N/A'}</div>
                    {viewSampleData.quantity && (
                      <div><span className="text-muted-foreground">Quantity:</span> {viewSampleData.quantity}</div>
                    )}
                    <div>
                      <span className="text-muted-foreground">Status:</span>{' '}
                      <Badge variant={viewSampleData.final_status === 'approved' ? 'default' : viewSampleData.final_status === 'rejected' ? 'destructive' : 'secondary'}>
                        {viewSampleData.final_status}
                      </Badge>
                    </div>
                  </div>
                </div>

                {/* Current Files & Notes */}
                <div className="rounded-lg border p-4 space-y-3">
                  <h4 className="text-sm font-semibold">Files & Notes</h4>

                  {viewSampleData.notes && (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground font-medium">Notes:</p>
                      <p className="text-sm bg-muted rounded p-2">{viewSampleData.notes}</p>
                    </div>
                  )}

                  {viewSampleData.images && viewSampleData.images.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground font-medium flex items-center gap-1"><Image className="h-3 w-3" /> Images ({viewSampleData.images.length})</p>
                      <div className="flex flex-wrap gap-2">
                        {viewSampleData.images.map((url: string, idx: number) => (
                          <a key={idx} href={url} target="_blank" rel="noopener noreferrer">
                            <img src={url} alt={`Sample image ${idx + 1}`} className="h-20 w-20 object-cover rounded border hover:opacity-80 transition" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {viewSampleData.attachment_paths && viewSampleData.attachment_paths.length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground font-medium flex items-center gap-1"><FileText className="h-3 w-3" /> Documents ({viewSampleData.attachment_paths.length})</p>
                      <div className="space-y-1">
                        {viewSampleData.attachment_paths.map((url: string, idx: number) => (
                          <a key={idx} href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sm text-blue-600 hover:underline">
                            <ExternalLink className="h-3 w-3" /> Document {idx + 1}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}

                  {!viewSampleData.notes && (!viewSampleData.images || viewSampleData.images.length === 0) && (!viewSampleData.attachment_paths || viewSampleData.attachment_paths.length === 0) && (
                    <p className="text-sm text-muted-foreground">No files or notes attached</p>
                  )}
                </div>

                {/* Approval Status */}
                <div className="rounded-lg border p-4 space-y-3">
                  <h4 className="text-sm font-semibold">Approval Status</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground font-medium">Agency Review</p>
                      <Badge variant={viewSampleData.agency_status === 'approved' ? 'default' : viewSampleData.agency_status === 'rejected' ? 'destructive' : 'secondary'}>
                        {viewSampleData.agency_status || 'pending'}
                      </Badge>
                      {viewSampleData.agency_approved_by && (
                        <p className="text-xs text-muted-foreground">by {viewSampleData.agency_approved_by.name}</p>
                      )}
                      {viewSampleData.agency_rejection_reason && (
                        <p className="text-xs text-red-600 mt-1">Reason: {viewSampleData.agency_rejection_reason}</p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground font-medium">Importer Review</p>
                      <Badge variant={viewSampleData.importer_status === 'approved' ? 'default' : viewSampleData.importer_status === 'rejected' ? 'destructive' : 'secondary'}>
                        {viewSampleData.importer_status || 'pending'}
                      </Badge>
                      {viewSampleData.importer_approved_by && (
                        <p className="text-xs text-muted-foreground">by {viewSampleData.importer_approved_by.name}</p>
                      )}
                      {viewSampleData.importer_rejection_reason && (
                        <p className="text-xs text-red-600 mt-1">Reason: {viewSampleData.importer_rejection_reason}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Timeline */}
                {viewTimeline.length > 0 && (
                  <div className="rounded-lg border p-4 space-y-3">
                    <h4 className="text-sm font-semibold">Timeline</h4>
                    <div className="relative space-y-0">
                      {viewTimeline.map((event, idx) => (
                        <div key={event.id || idx} className="flex gap-3 pb-4 last:pb-0">
                          {/* Vertical line + icon */}
                          <div className="flex flex-col items-center">
                            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 bg-background ${getTimelineColor(event.action)}`}>
                              {getTimelineIcon(event.action)}
                            </div>
                            {idx < viewTimeline.length - 1 && (
                              <div className="w-px flex-1 bg-border min-h-[16px]" />
                            )}
                          </div>
                          {/* Content */}
                          <div className="flex-1 pt-1">
                            <p className="text-sm font-medium">{event.description || event.action}</p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                              {event.user_name && <span>by {event.user_name}</span>}
                              {event.created_at && (
                                <span>
                                  {new Date(event.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                </span>
                              )}
                            </div>
                            {/* Show metadata details */}
                            {event.metadata?.rejection_reason && (
                              <p className="text-xs text-red-600 mt-1">Reason: {event.metadata.rejection_reason}</p>
                            )}
                            {event.metadata?.reason && (
                              <p className="text-xs text-red-600 mt-1">Reason: {event.metadata.reason}</p>
                            )}
                            {event.metadata?.comments && (
                              <p className="text-xs text-muted-foreground mt-1">Comments: {event.metadata.comments}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">Failed to load sample details</p>
            )}
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
                {/* Sample Info */}
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-muted-foreground">Type:</span> {resubmitSample.sample_type?.display_name || resubmitSample.sample_type?.name}</div>
                  <div><span className="text-muted-foreground">Style:</span> {resubmitSample.style?.style_number}</div>
                </div>

                {/* Rejection Reason */}
                {(resubmitSample.agency_rejection_reason || resubmitSample.importer_rejection_reason) && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3 space-y-1">
                    <p className="text-sm font-semibold text-red-800">Rejection Reason:</p>
                    <p className="text-sm text-red-700">
                      {resubmitSample.importer_rejection_reason || resubmitSample.agency_rejection_reason}
                    </p>
                    <p className="text-xs text-red-500">
                      Rejected by {resubmitSample.importer_rejection_reason ? 'Importer' : 'Agency'}
                    </p>
                  </div>
                )}

                {/* Existing Images */}
                {resubmitSample.images && resubmitSample.images.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Previous Images</p>
                    <div className="flex flex-wrap gap-2">
                      {resubmitSample.images.map((url, idx) => (
                        <a key={idx} href={url} target="_blank" rel="noopener noreferrer" className="block">
                          <img src={url} alt={`Previous image ${idx + 1}`} className="h-16 w-16 object-cover rounded border opacity-60" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Existing Documents */}
                {resubmitSample.attachment_paths && resubmitSample.attachment_paths.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-sm font-medium">Previous Documents</p>
                    {resubmitSample.attachment_paths.map((url, idx) => (
                      <a key={idx} href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sm text-blue-600 hover:underline">
                        <ExternalLink className="h-3 w-3" />
                        Document {idx + 1}
                      </a>
                    ))}
                  </div>
                )}

                {/* New Images Upload */}
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

                {/* New Documents Upload */}
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

                {/* Notes */}
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
              <Button variant="outline" onClick={() => setIsResubmitDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleResubmit} disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Resubmitting...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Resubmit Sample
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
