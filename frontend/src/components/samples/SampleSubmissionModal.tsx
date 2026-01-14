'use client';

import { useState, useEffect } from 'react';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MultiFileUpload, UploadedFile } from '@/components/ui/multi-file-upload';
import { Loader2, CheckCircle } from 'lucide-react';
import api from '@/lib/api';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface SampleType {
  id: number;
  name: string;
  display_name: string;
  description: string | null;
  is_active: boolean;
}

interface SampleSubmissionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  styleId: number;
  purchaseOrderId: number;
  onSuccess: () => void;
}

export function SampleSubmissionModal({
  open,
  onOpenChange,
  styleId,
  purchaseOrderId,
  onSuccess,
}: SampleSubmissionModalProps) {
  const [sampleTypes, setSampleTypes] = useState<SampleType[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>('');

  // Form fields
  const [sampleTypeId, setSampleTypeId] = useState<string>('');
  const [sampleReference, setSampleReference] = useState('');
  const [submissionDate, setSubmissionDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');

  // File uploads
  const [imageFiles, setImageFiles] = useState<UploadedFile[]>([]);
  const [documentFiles, setDocumentFiles] = useState<UploadedFile[]>([]);

  useEffect(() => {
    if (open) {
      fetchSampleTypes();
    }
  }, [open]);

  const fetchSampleTypes = async () => {
    try {
      setLoading(true);
      const response = await api.get<{ data: SampleType[] }>('/admin/sample-types');
      const types = response.data.data || response.data;
      setSampleTypes(types.filter((t: SampleType) => t.is_active));
    } catch (error) {
      console.error('Failed to fetch sample types:', error);
      setError('Failed to load sample types');
    } finally {
      setLoading(false);
    }
  };

  const uploadFiles = async (files: UploadedFile[], type: 'image' | 'document'): Promise<string[]> => {
    const uploadedUrls: string[] = [];

    for (const uploadedFile of files) {
      try {
        // Update file status to uploading
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

        // Mark as complete
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

  const handleSubmit = async () => {
    // Validation
    if (!sampleTypeId) {
      setError('Please select a sample type');
      return;
    }
    if (!sampleReference) {
      setError('Please enter a sample reference');
      return;
    }
    if (!submissionDate) {
      setError('Please select a submission date');
      return;
    }

    try {
      setSubmitting(true);
      setError('');

      // Upload all files
      const imageUrls = await uploadFiles(imageFiles, 'image');
      const documentUrls = await uploadFiles(documentFiles, 'document');

      // Submit sample
      await api.post(`/purchase-orders/${purchaseOrderId}/styles/${styleId}/samples`, {
        sample_type_id: parseInt(sampleTypeId),
        sample_reference: sampleReference,
        submission_date: submissionDate,
        quantity: quantity ? parseInt(quantity) : null,
        notes,
        images: imageUrls,
        attachment_paths: documentUrls,
      });

      // Reset form
      resetForm();
      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to submit sample');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setSampleTypeId('');
    setSampleReference('');
    setSubmissionDate(new Date().toISOString().split('T')[0]);
    setQuantity('');
    setNotes('');
    setImageFiles([]);
    setDocumentFiles([]);
    setError('');
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Submit Sample</DialogTitle>
          <DialogDescription>
            Upload sample files and provide details for approval process
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-6">
          {/* Basic Information */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sample-type">Sample Type *</Label>
              <Select
                value={sampleTypeId}
                onValueChange={setSampleTypeId}
                disabled={loading || submitting}
              >
                <SelectTrigger id="sample-type">
                  <SelectValue placeholder="Select sample type..." />
                </SelectTrigger>
                <SelectContent>
                  {sampleTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id.toString()}>
                      <div className="flex flex-col">
                        <span className="font-medium">{type.display_name}</span>
                        {type.description && (
                          <span className="text-xs text-muted-foreground">
                            {type.description}
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sample-reference">Sample Reference *</Label>
              <Input
                id="sample-reference"
                value={sampleReference}
                onChange={(e) => setSampleReference(e.target.value)}
                placeholder="e.g., PP-001-A"
                disabled={submitting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="submission-date">Submission Date *</Label>
              <Input
                id="submission-date"
                type="date"
                value={submissionDate}
                onChange={(e) => setSubmissionDate(e.target.value)}
                disabled={submitting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="quantity">Quantity (Optional)</Label>
              <Input
                id="quantity"
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="Sample quantity"
                min="1"
                disabled={submitting}
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">General Notes (Optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any general notes about this sample submission..."
              rows={3}
              disabled={submitting}
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
                disabled={submitting}
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
                disabled={submitting}
                showRemarks={true}
              />
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {submitting ? 'Submitting...' : 'Submit Sample'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
