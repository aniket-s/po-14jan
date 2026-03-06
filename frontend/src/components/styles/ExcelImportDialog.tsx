'use client';

import { useState, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import {
  analyzeExcelForStandaloneImport,
  executeStandaloneStylesImport,
  downloadStylesTemplate,
  type ExcelAnalysisResult,
  type ExcelImportResult,
} from '@/services/styles';
import {
  Loader2,
  FileUp,
  Download,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Eye,
} from 'lucide-react';

interface ExcelImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

type ImportStep = 'upload' | 'mapping' | 'preview' | 'importing' | 'results';

const requiredFields = [
  { key: 'style_number', label: 'Style Number *' },
  { key: 'quantity', label: 'Quantity *' },
  { key: 'unit_price', label: 'Unit Price *' },
];

const optionalFields = [
  { key: 'description', label: 'Description' },
  { key: 'fabric', label: 'Fabric' },
  { key: 'color', label: 'Color' },
  { key: 'size_breakdown', label: 'Size Breakdown' },
  { key: 'assignment_type', label: 'Assignment Type' },
  { key: 'assigned_factory_id', label: 'Assigned Factory ID' },
  { key: 'assigned_agency_id', label: 'Assigned Agency ID' },
];

const allFields = [...requiredFields, ...optionalFields];

export function ExcelImportDialog({
  open,
  onOpenChange,
  onSuccess,
}: ExcelImportDialogProps) {
  const [step, setStep] = useState<ImportStep>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState('');
  const [analysisResult, setAnalysisResult] = useState<ExcelAnalysisResult | null>(null);
  const [columnMapping, setColumnMapping] = useState<Record<string, number | null>>({});
  const [importResult, setImportResult] = useState<ExcelImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError('');
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      setIsDownloading(true);
      const blob = await downloadStylesTemplate();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'styles_import_template.xlsx';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      toast.success('Template downloaded successfully');
    } catch {
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
      setIsProcessing(true);
      setError('');
      const result = await analyzeExcelForStandaloneImport(file);
      setAnalysisResult(result);
      setColumnMapping(result.suggested_mappings);
      setStep('mapping');
      toast.success(`File analyzed: ${result.row_count} rows found`);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to analyze file. Please check the file format.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMappingChange = (field: string, value: string) => {
    setColumnMapping(prev => ({
      ...prev,
      [field]: value === 'none' ? null : parseInt(value),
    }));
  };

  const validateMapping = (): boolean => {
    const missing = requiredFields.filter(
      f => columnMapping[f.key] === null || columnMapping[f.key] === undefined
    );
    if (missing.length > 0) {
      setError(`Missing required mappings: ${missing.map(f => f.label).join(', ')}`);
      return false;
    }
    return true;
  };

  const handleGoToPreview = () => {
    if (!validateMapping()) return;
    setError('');
    setStep('preview');
  };

  const getPreviewValue = (rowIndex: number, field: string): string => {
    if (!analysisResult || columnMapping[field] === null || columnMapping[field] === undefined) return '-';
    const colIndex = columnMapping[field]!;
    const val = analysisResult.sample_data[rowIndex]?.[colIndex];
    return val != null ? String(val) : '-';
  };

  const handleImport = async () => {
    if (!analysisResult) return;

    try {
      setIsProcessing(true);
      setStep('importing');
      setError('');

      const result = await executeStandaloneStylesImport({
        temp_file_path: analysisResult.temp_file_path,
        column_mapping: columnMapping,
        image_columns: analysisResult.image_columns,
      });

      setImportResult(result);
      setStep('results');

      if (result.errors.length === 0) {
        toast.success(`Successfully imported ${result.imported_count} styles`);
      } else {
        toast.warning(`Imported ${result.imported_count} styles with ${result.errors.length} errors`);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to import styles');
      setStep('preview');
    } finally {
      setIsProcessing(false);
    }
  };

  const resetDialog = () => {
    setStep('upload');
    setFile(null);
    setAnalysisResult(null);
    setColumnMapping({});
    setImportResult(null);
    setError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClose = () => {
    resetDialog();
    onOpenChange(false);
    if (importResult && importResult.imported_count > 0) {
      onSuccess();
    }
  };

  const mappedFields = allFields.filter(f => columnMapping[f.key] !== null && columnMapping[f.key] !== undefined);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Import Styles from Excel
          </DialogTitle>
          <DialogDescription>
            Upload an Excel file to bulk import styles into your library
          </DialogDescription>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Step 1: Upload */}
        {step === 'upload' && (
          <div className="space-y-4">
            <Alert>
              <Download className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between">
                <span className="text-sm">
                  Don&apos;t have a template? Download our Excel template to get started.
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

            <div className="space-y-2">
              <Label htmlFor="excel-file">Select Excel File</Label>
              <div className="flex gap-2">
                <Input
                  id="excel-file"
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileChange}
                  className="flex-1"
                />
                <Button
                  onClick={handleAnalyze}
                  disabled={!file || isProcessing}
                >
                  {isProcessing ? (
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

            <div className="bg-muted p-4 rounded-lg space-y-2">
              <p className="font-semibold">Required Columns:</p>
              <ul className="list-disc list-inside text-sm space-y-1">
                <li>Style Number</li>
                <li>Quantity</li>
                <li>Unit Price</li>
              </ul>
              <p className="font-semibold mt-4">Optional Columns:</p>
              <ul className="list-disc list-inside text-sm space-y-1">
                <li>Description</li>
                <li>Fabric</li>
                <li>Color</li>
                <li>Size Breakdown</li>
                <li>Assignment Type</li>
                <li>Factory / Agency ID</li>
              </ul>
            </div>
          </div>
        )}

        {/* Step 2: Mapping */}
        {step === 'mapping' && analysisResult && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Map Columns</CardTitle>
                <CardDescription>
                  Match Excel columns to style fields. {analysisResult.row_count} rows detected.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4">
                  {allFields.map(field => (
                    <div key={field.key} className="grid grid-cols-2 gap-4 items-center">
                      <Label>{field.label}</Label>
                      <Select
                        value={columnMapping[field.key]?.toString() ?? 'none'}
                        onValueChange={(value) => handleMappingChange(field.key, value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select column..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">- Not mapped -</SelectItem>
                          {analysisResult.headers.map(header => (
                            <SelectItem key={header.index} value={header.index.toString()}>
                              {header.original_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Raw Sample Data */}
            <Card>
              <CardHeader>
                <CardTitle>Sample Data</CardTitle>
                <CardDescription>First few rows from your Excel file</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {analysisResult.headers.map(header => (
                          <TableHead key={header.index}>{header.original_name}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {analysisResult.sample_data.slice(0, 5).map((row, rowIndex) => (
                        <TableRow key={rowIndex}>
                          {row.map((cell, cellIndex) => (
                            <TableCell key={cellIndex}>{cell ?? '-'}</TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Step 3: Preview */}
        {step === 'preview' && analysisResult && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5" />
                  Import Preview
                </CardTitle>
                <CardDescription>
                  Preview how the data will be imported. {analysisResult.row_count} styles will be processed.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {mappedFields.map(field => (
                          <TableHead key={field.key}>{field.label}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {analysisResult.sample_data.slice(0, 5).map((_, rowIndex) => (
                        <TableRow key={rowIndex}>
                          {mappedFields.map(field => (
                            <TableCell key={field.key}>
                              {getPreviewValue(rowIndex, field.key)}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <p className="text-sm text-muted-foreground mt-4">
                  Showing first {Math.min(5, analysisResult.sample_data.length)} rows. Total rows to import: {analysisResult.row_count}
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Step 4: Importing */}
        {step === 'importing' && (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="text-lg font-semibold">Importing styles...</p>
            <p className="text-sm text-muted-foreground">This may take a moment. Please wait.</p>
          </div>
        )}

        {/* Step 5: Results */}
        {step === 'results' && importResult && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {importResult.errors.length === 0 ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-yellow-600" />
                  )}
                  Import Complete
                </CardTitle>
                <CardDescription>
                  {importResult.message}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-green-50 p-4 rounded-lg">
                    <p className="text-sm text-muted-foreground">Imported</p>
                    <p className="text-2xl font-bold text-green-600">{importResult.imported_count}</p>
                  </div>
                  <div className="bg-yellow-50 p-4 rounded-lg">
                    <p className="text-sm text-muted-foreground">Skipped</p>
                    <p className="text-2xl font-bold text-yellow-600">{importResult.skipped_count}</p>
                  </div>
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <p className="text-sm text-muted-foreground">Total</p>
                    <p className="text-2xl font-bold text-blue-600">
                      {importResult.imported_count + importResult.skipped_count}
                    </p>
                  </div>
                </div>

                {importResult.errors.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-2 flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-destructive" />
                      Errors ({importResult.errors.length})
                    </h4>
                    <div className="max-h-48 overflow-y-auto border rounded-lg p-4 space-y-2">
                      {importResult.errors.map((err, index) => (
                        <div key={index} className="text-sm">
                          <span className="font-semibold">Row {err.row}:</span>{' '}
                          {err.error}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        <DialogFooter>
          {step === 'upload' && (
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
          )}

          {step === 'mapping' && (
            <>
              <Button variant="outline" onClick={() => { setStep('upload'); setError(''); }}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button onClick={handleGoToPreview}>
                <ArrowRight className="mr-2 h-4 w-4" />
                Next: Preview
              </Button>
            </>
          )}

          {step === 'preview' && (
            <>
              <Button variant="outline" onClick={() => { setStep('mapping'); setError(''); }}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button onClick={handleImport}>
                <FileUp className="mr-2 h-4 w-4" />
                Import {analysisResult?.row_count} Styles
              </Button>
            </>
          )}

          {step === 'results' && (
            <>
              <Button variant="outline" onClick={resetDialog}>
                Import More
              </Button>
              <Button onClick={handleClose}>
                Done
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
