'use client';

// Disable static generation for this authenticated page
export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
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
import { Plus, Search, Loader2, CheckCircle, XCircle, Clock, PackageCheck, AlertCircle } from 'lucide-react';
import api from '@/lib/api';
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
  submission_date: string;
  factory_status: string;
  factory_approved_by: number | null;
  factory_approval_date: string | null;
  factory_comments: string | null;
  importer_status: string;
  importer_approved_by: number | null;
  importer_approval_date: string | null;
  importer_comments: string | null;
  final_status: string;
  notes: string | null;
  created_at: string;
  style?: {
    style_number: string;
    purchase_order?: {
      po_number: string;
    };
  };
  sample_type?: {
    name: string;
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
  purchase_order_id: number;
  purchase_order?: {
    po_number: string;
  };
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
  const [approvalType, setApprovalType] = useState<'factory' | 'importer'>('factory');
  const [approvalAction, setApprovalAction] = useState<'approve' | 'reject'>('approve');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [imageFiles, setImageFiles] = useState<UploadedFile[]>([]);
  const [documentFiles, setDocumentFiles] = useState<UploadedFile[]>([]);

  const {
    register: registerSample,
    handleSubmit: handleSubmitSample,
    formState: { errors: sampleErrors },
    reset: resetSample,
    setValue: setSampleValue,
  } = useForm<SampleFormData>({
    resolver: zodResolver(sampleSchema),
  });

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
      // Upload all files
      const imageUrls = await uploadFiles(imageFiles, 'image');
      const documentUrls = await uploadFiles(documentFiles, 'document');

      // Submit sample with file URLs
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

  const openApprovalDialog = (sample: Sample, type: 'factory' | 'importer', action: 'approve' | 'reject') => {
    setSelectedSample(sample);
    setApprovalType(type);
    setApprovalAction(action);
    setIsApprovalDialogOpen(true);
  };

  const onSubmitApproval = async (data: ApprovalFormData) => {
    if (!selectedSample) return;

    setIsSubmitting(true);
    try {
      const endpoint = approvalType === 'factory'
        ? `/samples/${selectedSample.id}/factory-${approvalAction}`
        : `/samples/${selectedSample.id}/importer-${approvalAction}`;

      await api.post(endpoint, { comments: data.comments });
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

  const canApproveAsFactory = (sample: Sample) => {
    return hasRole('Factory') && sample.factory_status === 'pending';
  };

  const canApproveAsImporter = (sample: Sample) => {
    return hasRole('Importer') && sample.factory_status === 'approved' && sample.importer_status === 'pending';
  };

  const getSampleTypeInfo = (sampleTypeId: number) => {
    const sampleType = sampleTypes.find(st => st.id === sampleTypeId);
    if (!sampleType) return { canSubmit: true, reason: '' };

    // Check if parallel submission is allowed
    if (sampleType.allows_parallel_submission) {
      return { canSubmit: true, reason: '' };
    }

    // Check if all prerequisites are approved
    if (sampleType.prerequisites && sampleType.prerequisites.length > 0) {
      for (const prereqName of sampleType.prerequisites) {
        const prereqType = sampleTypes.find(st => st.name === prereqName);
        if (!prereqType) continue;

        const prerequisiteApproved = samples.some(
          s => s.sample_type_id === prereqType.id && s.final_status === 'approved'
        );

        if (!prerequisiteApproved) {
          return {
            canSubmit: false,
            reason: `Prerequisite sample "${prereqType.display_name || prereqType.name}" must be approved first`,
          };
        }
      }
    }

    return { canSubmit: true, reason: '' };
  };

  return (
    <DashboardLayout requiredPermissions={['sample.view', 'sample.create', 'sample.approve_final', 'sample.factory_approve']} requireAll={false}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Samples</h1>
            <p className="text-muted-foreground">Manage sample submissions and approvals</p>
          </div>
          {can('sample.create') && (
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
                            {style.style_number} - {style.purchase_order?.po_number}
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
                              {sampleType.name}
                              {sampleType.display_order <= 5 && ' (Can submit in parallel)'}
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
                      Dual Approval Workflow
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Samples require approval from both factory and importer. Factory must approve first, then importer can review.
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
              <div className="flex h-96 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sample Type</TableHead>
                    <TableHead>Style</TableHead>
                    <TableHead>PO Number</TableHead>
                    <TableHead>Submitted By</TableHead>
                    <TableHead>Factory Status</TableHead>
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
                          {sample.sample_type?.name}
                          {sample.sample_type && sample.sample_type.display_order <= 5 && (
                            <Badge variant="outline" className="ml-2 text-xs">
                              Parallel
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>{sample.style?.style_number}</TableCell>
                        <TableCell>{sample.style?.purchase_order?.po_number || 'N/A'}</TableCell>
                        <TableCell>{sample.submitted_by?.name || 'N/A'}</TableCell>
                        <TableCell>
                          <Badge variant={getStatusColor(sample.factory_status) as any}>
                            {sample.factory_status}
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
                            {canApproveAsFactory(sample) && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openApprovalDialog(sample, 'factory', 'approve')}
                                  className="text-green-600 hover:text-green-700"
                                >
                                  <CheckCircle className="mr-1 h-4 w-4" />
                                  Approve
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openApprovalDialog(sample, 'factory', 'reject')}
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
          <DialogContent>
            <form onSubmit={handleSubmitApproval(onSubmitApproval)}>
              <DialogHeader>
                <DialogTitle>
                  {approvalAction === 'approve' ? 'Approve' : 'Reject'} Sample as{' '}
                  {approvalType === 'factory' ? 'Factory' : 'Importer'}
                </DialogTitle>
                <DialogDescription>
                  Provide comments for this {approvalAction === 'approve' ? 'approval' : 'rejection'}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="comments">Comments (Optional)</Label>
                  <textarea
                    id="comments"
                    className="flex min-h-[100px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    placeholder="Add your comments..."
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
      </div>
    </DashboardLayout>
  );
}
