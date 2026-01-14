'use client';

import { useState } from 'react';
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import {
  analyzeExcelForStandaloneImport,
  executeStandaloneStylesImport,
  downloadStylesTemplate,
  type ExcelAnalysisResult,
  type ExcelImportResult,
} from '@/services/styles';
import { Loader2, FileUp, Download, CheckCircle2, AlertCircle, FileSpreadsheet } from 'lucide-react';

interface ExcelImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function ExcelImportDialog({
  open,
  onOpenChange,
  onSuccess,
}: ExcelImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<ExcelAnalysisResult | null>(null);
  const [importResult, setImportResult] = useState<ExcelImportResult | null>(null);
  const [filePath, setFilePath] = useState<string>('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setAnalysisResult(null);
      setImportResult(null);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      setIsDownloading(true);
      const blob = await downloadStylesTemplate();

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'styles_import_template.xlsx';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success('Template downloaded successfully');
    } catch (error: any) {
      console.error('Failed to download template:', error);
      toast.error('Failed to download template');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleAnalyze = async () => {
    if (!file) {
      toast.error('Please select a file first');
      return;
    }

    try {
      setIsAnalyzing(true);
      const result = await analyzeExcelForStandaloneImport(file);
      setAnalysisResult(result);

      // Store file path from backend response
      setFilePath(result.temp_file_path);

      toast.success(`File analyzed: ${result.row_count} rows found`);
    } catch (error: any) {
      console.error('Failed to analyze file:', error);
      toast.error(error.response?.data?.message || 'Failed to analyze file');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleImport = async () => {
    if (!analysisResult || !filePath) {
      toast.error('Please analyze the file first');
      return;
    }

    try {
      setIsImporting(true);

      const result = await executeStandaloneStylesImport({
        temp_file_path: filePath,
        column_mapping: analysisResult.suggested_mappings,
      });

      setImportResult(result);

      if (result.errors.length === 0) {
        toast.success(`Successfully imported ${result.imported_count} styles`);
        setTimeout(() => {
          onOpenChange(false);
          onSuccess();
        }, 2000);
      } else {
        toast.warning(
          `Imported ${result.imported_count} styles with ${result.errors.length} errors`
        );
      }
    } catch (error: any) {
      console.error('Failed to import styles:', error);
      toast.error(error.response?.data?.message || 'Failed to import styles');
    } finally {
      setIsImporting(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setAnalysisResult(null);
    setImportResult(null);
    setFilePath('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Import Styles from Excel
          </DialogTitle>
          <DialogDescription>
            Upload an Excel file to bulk import styles into your library
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Download Template */}
          <Alert>
            <Download className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <span className="text-sm">
                Don't have a template? Download our Excel template to get started.
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={handleDownloadTemplate}
                disabled={isDownloading}
              >
                {isDownloading ? (
                  <>
                    <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                    Downloading...
                  </>
                ) : (
                  <>
                    <Download className="mr-2 h-3 w-3" />
                    Download Template
                  </>
                )}
              </Button>
            </AlertDescription>
          </Alert>

          {/* File Upload */}
          <div className="space-y-2">
            <Label htmlFor="excel-file">Select Excel File</Label>
            <div className="flex gap-2">
              <Input
                id="excel-file"
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                className="flex-1"
              />
              <Button
                onClick={handleAnalyze}
                disabled={!file || isAnalyzing}
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <FileUp className="mr-2 h-4 w-4" />
                    Analyze
                  </>
                )}
              </Button>
            </div>
            {file && (
              <p className="text-sm text-muted-foreground">
                Selected: {file.name} ({(file.size / 1024).toFixed(2)} KB)
              </p>
            )}
          </div>

          {/* Analysis Result */}
          {analysisResult && (
            <Alert>
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription>
                <p className="font-semibold mb-2">File Analysis Complete</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Total Rows:</span>{' '}
                    <strong>{analysisResult.row_count}</strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Columns Detected:</span>{' '}
                    <strong>{analysisResult.headers.length}</strong>
                  </div>
                </div>
                <div className="mt-2 text-xs">
                  <span className="text-muted-foreground">Columns:</span>{' '}
                  {analysisResult.headers.slice(0, 5).join(', ')}
                  {analysisResult.headers.length > 5 && '...'}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Import Result */}
          {importResult && (
            <Alert variant={importResult.errors.length > 0 ? 'destructive' : 'default'}>
              {importResult.errors.length === 0 ? (
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
              <AlertDescription>
                <p className="font-semibold mb-2">Import Complete</p>
                <div className="space-y-1 text-sm">
                  <p>
                    <span className="text-green-600 font-semibold">
                      ✓ {importResult.imported_count} styles imported successfully
                    </span>
                  </p>
                  {importResult.skipped_count > 0 && (
                    <p className="text-amber-600">
                      ⚠ {importResult.skipped_count} rows skipped
                    </p>
                  )}
                  {importResult.errors.length > 0 && (
                    <div className="mt-2 max-h-32 overflow-y-auto">
                      <p className="font-semibold text-destructive">Errors:</p>
                      {importResult.errors.slice(0, 5).map((error) => (
                        <p key={error.row} className="text-xs">
                          Row {error.row}: {error.errors.join(', ')}
                        </p>
                      ))}
                      {importResult.errors.length > 5 && (
                        <p className="text-xs text-muted-foreground">
                          ... and {importResult.errors.length - 5} more errors
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            {importResult?.imported_count ? 'Close' : 'Cancel'}
          </Button>
          <Button
            onClick={handleImport}
            disabled={!analysisResult || isImporting || !!importResult}
          >
            {isImporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <FileUp className="mr-2 h-4 w-4" />
                Import Styles
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
