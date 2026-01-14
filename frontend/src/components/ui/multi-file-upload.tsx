'use client';

import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { X, Upload, File, FileText, FileSpreadsheet, Image as ImageIcon, Loader2, Download } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface UploadedFile {
  id: string;
  file: File;
  preview?: string;
  url?: string;
  uploading?: boolean;
  progress?: number;
  error?: string;
  remarks?: string;
}

export interface MultiFileUploadProps {
  files: UploadedFile[];
  onChange: (files: UploadedFile[]) => void;
  accept?: string;
  maxFiles?: number;
  maxSize?: number; // in bytes
  label?: string;
  description?: string;
  disabled?: boolean;
  showRemarks?: boolean;
}

const getFileIcon = (file: File) => {
  const type = file.type.toLowerCase();
  const extension = file.name.split('.').pop()?.toLowerCase();

  if (type.startsWith('image/')) {
    return <ImageIcon className="h-8 w-8 text-blue-500" />;
  } else if (type.includes('pdf') || extension === 'pdf') {
    return <FileText className="h-8 w-8 text-red-500" />;
  } else if (
    type.includes('spreadsheet') ||
    type.includes('excel') ||
    extension === 'xlsx' ||
    extension === 'xls' ||
    extension === 'csv'
  ) {
    return <FileSpreadsheet className="h-8 w-8 text-green-500" />;
  }
  return <File className="h-8 w-8 text-gray-500" />;
};

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
};

export function MultiFileUpload({
  files,
  onChange,
  accept = 'image/*,.pdf,.xlsx,.xls,.csv',
  maxFiles = 10,
  maxSize = 10 * 1024 * 1024, // 10MB default
  label = 'Upload Files',
  description = 'Drag and drop files here, or click to browse',
  disabled = false,
  showRemarks = true,
}: MultiFileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const createFilePreview = (file: File): Promise<string | undefined> => {
    return new Promise((resolve) => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
          resolve(reader.result as string);
        };
        reader.readAsDataURL(file);
      } else {
        resolve(undefined);
      }
    });
  };

  const processFiles = async (fileList: FileList | null) => {
    if (!fileList || disabled) return;

    const newFiles: UploadedFile[] = [];
    const currentFileCount = files.length;

    for (let i = 0; i < fileList.length; i++) {
      if (currentFileCount + newFiles.length >= maxFiles) {
        alert(`Maximum ${maxFiles} files allowed`);
        break;
      }

      const file = fileList[i];

      // Check file size
      if (file.size > maxSize) {
        alert(`File "${file.name}" is too large. Maximum size is ${formatFileSize(maxSize)}`);
        continue;
      }

      const preview = await createFilePreview(file);
      const uploadedFile: UploadedFile = {
        id: `${Date.now()}-${i}`,
        file,
        preview,
        remarks: '',
      };

      newFiles.push(uploadedFile);
    }

    onChange([...files, ...newFiles]);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    processFiles(e.target.files);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setIsDragging(true);
    }
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    processFiles(e.dataTransfer.files);
  }, [disabled, files, maxFiles, maxSize]);

  const removeFile = (id: string) => {
    onChange(files.filter((f) => f.id !== id));
  };

  const updateFileRemarks = (id: string, remarks: string) => {
    onChange(
      files.map((f) => (f.id === id ? { ...f, remarks } : f))
    );
  };

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      <div>
        <Label className="text-base font-semibold">{label}</Label>
        <div
          className={cn(
            'mt-2 border-2 border-dashed rounded-lg p-8 text-center transition-colors',
            isDragging && !disabled
              ? 'border-primary bg-primary/5'
              : 'border-muted-foreground/25',
            disabled && 'opacity-50 cursor-not-allowed',
            !disabled && 'cursor-pointer hover:border-primary/50'
          )}
          onDragEnter={handleDragEnter}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => !disabled && fileInputRef.current?.click()}
        >
          <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-sm font-medium mb-1">{description}</p>
          <p className="text-xs text-muted-foreground">
            Supported: Images, PDF, Excel ({formatFileSize(maxSize)} max per file)
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {files.length} / {maxFiles} files uploaded
          </p>
          <Input
            ref={fileInputRef}
            type="file"
            accept={accept}
            multiple
            onChange={handleFileSelect}
            className="hidden"
            disabled={disabled}
          />
        </div>
      </div>

      {/* File List */}
      {files.length > 0 && (
        <div className="space-y-3">
          <Label className="text-base font-semibold">
            Uploaded Files ({files.length})
          </Label>
          {files.map((uploadedFile) => (
            <Card key={uploadedFile.id} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-start gap-4">
                  {/* File Preview/Icon */}
                  <div className="flex-shrink-0">
                    {uploadedFile.preview ? (
                      <img
                        src={uploadedFile.preview}
                        alt={uploadedFile.file.name}
                        className="h-16 w-16 object-cover rounded border"
                      />
                    ) : (
                      <div className="h-16 w-16 flex items-center justify-center border rounded bg-muted">
                        {getFileIcon(uploadedFile.file)}
                      </div>
                    )}
                  </div>

                  {/* File Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">
                          {uploadedFile.file.name}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {formatFileSize(uploadedFile.file.size)} •{' '}
                          {uploadedFile.file.type || 'Unknown type'}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(uploadedFile.id)}
                        disabled={disabled || uploadedFile.uploading}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Upload Progress */}
                    {uploadedFile.uploading && (
                      <div className="mt-2">
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <div className="flex-1 bg-muted rounded-full h-2">
                            <div
                              className="bg-primary h-2 rounded-full transition-all"
                              style={{ width: `${uploadedFile.progress || 0}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {uploadedFile.progress || 0}%
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Error Message */}
                    {uploadedFile.error && (
                      <p className="text-sm text-destructive mt-2">
                        {uploadedFile.error}
                      </p>
                    )}

                    {/* Remarks */}
                    {showRemarks && !uploadedFile.uploading && (
                      <div className="mt-3">
                        <Textarea
                          placeholder="Add remarks for this file (optional)..."
                          value={uploadedFile.remarks || ''}
                          onChange={(e) =>
                            updateFileRemarks(uploadedFile.id, e.target.value)
                          }
                          rows={2}
                          disabled={disabled}
                          className="text-sm"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
