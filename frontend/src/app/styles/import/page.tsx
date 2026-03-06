'use client';

export const dynamic = 'force-dynamic';

import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
  Upload,
  X,
  Check,
  Columns3,
  RotateCcw,
  Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type ImportStep = 'upload' | 'mapping' | 'preview' | 'importing' | 'results';

const STEPS: { key: ImportStep; label: string; description: string }[] = [
  { key: 'upload', label: 'Upload', description: 'Select your file' },
  { key: 'mapping', label: 'Map Columns', description: 'Match fields' },
  { key: 'preview', label: 'Preview', description: 'Verify data' },
  { key: 'importing', label: 'Import', description: 'Processing' },
  { key: 'results', label: 'Results', description: 'Summary' },
];

const requiredFields = [
  { key: 'style_number', label: 'Style Number', required: true },
  { key: 'quantity', label: 'Quantity', required: true },
  { key: 'unit_price', label: 'Unit Price', required: true },
];

const optionalFields = [
  { key: 'description', label: 'Description', required: false },
  { key: 'fabric', label: 'Fabric', required: false },
  { key: 'color', label: 'Color', required: false },
  { key: 'size_breakdown', label: 'Size Breakdown', required: false },
  { key: 'assignment_type', label: 'Assignment Type', required: false },
  { key: 'assigned_factory_id', label: 'Factory ID', required: false },
  { key: 'assigned_agency_id', label: 'Agency ID', required: false },
];

const allFields = [...requiredFields, ...optionalFields];

export default function StylesImportPage() {
  const router = useRouter();
  const [step, setStep] = useState<ImportStep>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState('');
  const [analysisResult, setAnalysisResult] = useState<ExcelAnalysisResult | null>(null);
  const [columnMapping, setColumnMapping] = useState<Record<string, number | null>>({});
  const [importResult, setImportResult] = useState<ExcelImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentStepIndex = STEPS.findIndex(s => s.key === step);

  // Drag and drop handlers
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

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
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      setFile(droppedFile);
      setError('');
    }
  }, []);

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

  const resetImport = () => {
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

  const mappedFields = allFields.filter(f => columnMapping[f.key] !== null && columnMapping[f.key] !== undefined);
  const mappedCount = mappedFields.length;
  const requiredMappedCount = requiredFields.filter(f => columnMapping[f.key] !== null && columnMapping[f.key] !== undefined).length;

  return (
    <DashboardLayout requiredPermissions={['style.create']} requireAll={false}>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => router.push('/styles')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Styles
            </Button>
            <Separator orientation="vertical" className="h-6" />
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <FileSpreadsheet className="h-6 w-6" />
                Import Styles from Excel
              </h1>
              <p className="text-sm text-muted-foreground">
                Upload an Excel file to bulk import styles into your library
              </p>
            </div>
          </div>
          {step !== 'upload' && step !== 'importing' && (
            <Button variant="outline" size="sm" onClick={resetImport}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Start Over
            </Button>
          )}
        </div>

        {/* Step Indicator */}
        <div className="relative">
          <div className="flex items-center justify-between">
            {STEPS.map((s, index) => {
              const isActive = index === currentStepIndex;
              const isCompleted = index < currentStepIndex;
              const isUpcoming = index > currentStepIndex;
              return (
                <div key={s.key} className="flex flex-1 items-center">
                  <div className="flex flex-col items-center flex-1">
                    <div className={cn(
                      "flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all",
                      isCompleted && "bg-primary border-primary text-primary-foreground",
                      isActive && "border-primary bg-primary/10 text-primary",
                      isUpcoming && "border-muted-foreground/30 text-muted-foreground/50"
                    )}>
                      {isCompleted ? (
                        <Check className="h-5 w-5" />
                      ) : (
                        <span className="text-sm font-semibold">{index + 1}</span>
                      )}
                    </div>
                    <div className="mt-2 text-center">
                      <p className={cn(
                        "text-sm font-medium",
                        isActive && "text-primary",
                        isUpcoming && "text-muted-foreground/50"
                      )}>{s.label}</p>
                      <p className={cn(
                        "text-xs",
                        isActive ? "text-muted-foreground" : "text-muted-foreground/50"
                      )}>{s.description}</p>
                    </div>
                  </div>
                  {index < STEPS.length - 1 && (
                    <div className={cn(
                      "h-0.5 flex-1 -mt-6",
                      isCompleted ? "bg-primary" : "bg-muted-foreground/20"
                    )} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Step 1: Upload */}
        {step === 'upload' && (
          <div className="grid grid-cols-3 gap-6">
            {/* Main Upload Area */}
            <div className="col-span-2 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Upload File</CardTitle>
                  <CardDescription>
                    Drag and drop your Excel file or click to browse
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Drop Zone */}
                  <div
                    onDragEnter={handleDragEnter}
                    onDragLeave={handleDragLeave}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    onClick={() => fileInputRef.current?.click()}
                    className={cn(
                      "relative border-2 border-dashed rounded-xl p-12 transition-all cursor-pointer text-center",
                      isDragging
                        ? "border-primary bg-primary/5 scale-[1.01]"
                        : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50",
                      file && "border-green-500/50 bg-green-50/50 dark:bg-green-950/20"
                    )}
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".xlsx,.xls"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    {file ? (
                      <div className="space-y-3">
                        <div className="mx-auto w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                          <FileSpreadsheet className="h-8 w-8 text-green-600" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold">{file.name}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {(file.size / 1024).toFixed(1)} KB
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-muted-foreground"
                          onClick={(e) => {
                            e.stopPropagation();
                            setFile(null);
                            if (fileInputRef.current) fileInputRef.current.value = '';
                          }}
                        >
                          <X className="mr-1 h-3 w-3" />
                          Remove
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                          <Upload className="h-8 w-8 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">
                            Drop your Excel file here, or <span className="text-primary underline">browse</span>
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Supports .xlsx and .xls files
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Analyze Button */}
                  <div className="flex justify-end">
                    <Button
                      size="lg"
                      onClick={handleAnalyze}
                      disabled={!file || isProcessing}
                    >
                      {isProcessing ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Analyzing File...
                        </>
                      ) : (
                        <>
                          Analyze & Continue
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Sidebar Info */}
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Download className="h-4 w-4" />
                    Template
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-3">
                    Download the Excel template with the correct column structure.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={handleDownloadTemplate}
                    disabled={isDownloading}
                  >
                    {isDownloading ? (
                      <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                    ) : (
                      <Download className="mr-2 h-3 w-3" />
                    )}
                    Download Template
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Info className="h-4 w-4" />
                    Required Columns
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1.5">
                    {requiredFields.map(f => (
                      <div key={f.key} className="flex items-center gap-2">
                        <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Required</Badge>
                        <span className="text-sm">{f.label}</span>
                      </div>
                    ))}
                  </div>
                  <Separator />
                  <div className="space-y-1.5">
                    {optionalFields.map(f => (
                      <div key={f.key} className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Optional</Badge>
                        <span className="text-sm text-muted-foreground">{f.label}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Step 2: Mapping */}
        {step === 'mapping' && analysisResult && (
          <div className="grid grid-cols-3 gap-6">
            <div className="col-span-2 space-y-4">
              {/* Column Mapping */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Columns3 className="h-5 w-5" />
                        Column Mapping
                      </CardTitle>
                      <CardDescription>
                        Match your Excel columns to the corresponding style fields
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={requiredMappedCount === requiredFields.length ? "default" : "destructive"}>
                        {requiredMappedCount}/{requiredFields.length} required
                      </Badge>
                      <Badge variant="secondary">
                        {mappedCount}/{allFields.length} total
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1">
                    {/* Header Row */}
                    <div className="grid grid-cols-[200px_1fr_120px] gap-3 px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      <span>Style Field</span>
                      <span>Excel Column</span>
                      <span>Status</span>
                    </div>
                    <Separator />

                    {/* Required Fields */}
                    {requiredFields.map(field => {
                      const isMapped = columnMapping[field.key] !== null && columnMapping[field.key] !== undefined;
                      const mappedHeader = isMapped
                        ? analysisResult.headers.find(h => h.index === columnMapping[field.key])
                        : null;
                      return (
                        <div key={field.key} className={cn(
                          "grid grid-cols-[200px_1fr_120px] gap-3 items-center px-3 py-2.5 rounded-lg transition-colors",
                          !isMapped && "bg-red-50/50 dark:bg-red-950/10"
                        )}>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{field.label}</span>
                            <Badge variant="destructive" className="text-[10px] px-1 py-0 h-4">Required</Badge>
                          </div>
                          <Select
                            value={columnMapping[field.key]?.toString() ?? 'none'}
                            onValueChange={(value) => handleMappingChange(field.key, value)}
                          >
                            <SelectTrigger className={cn(!isMapped && "border-red-300 dark:border-red-800")}>
                              <SelectValue placeholder="Select column..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">-- Not mapped --</SelectItem>
                              {analysisResult.headers.map(header => (
                                <SelectItem key={header.index} value={header.index.toString()}>
                                  {header.original_name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <div>
                            {isMapped ? (
                              <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-0">
                                <Check className="mr-1 h-3 w-3" /> Mapped
                              </Badge>
                            ) : (
                              <Badge variant="destructive" className="border-0">
                                <AlertCircle className="mr-1 h-3 w-3" /> Missing
                              </Badge>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    <Separator className="my-2" />

                    {/* Optional Fields */}
                    {optionalFields.map(field => {
                      const isMapped = columnMapping[field.key] !== null && columnMapping[field.key] !== undefined;
                      return (
                        <div key={field.key} className="grid grid-cols-[200px_1fr_120px] gap-3 items-center px-3 py-2.5 rounded-lg">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">{field.label}</span>
                          </div>
                          <Select
                            value={columnMapping[field.key]?.toString() ?? 'none'}
                            onValueChange={(value) => handleMappingChange(field.key, value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select column..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">-- Not mapped --</SelectItem>
                              {analysisResult.headers.map(header => (
                                <SelectItem key={header.index} value={header.index.toString()}>
                                  {header.original_name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <div>
                            {isMapped ? (
                              <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-0">
                                <Check className="mr-1 h-3 w-3" /> Mapped
                              </Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground/50">Skipped</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Raw Sample Data */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Raw Excel Data Preview</CardTitle>
                  <CardDescription>First rows from your file for reference</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="w-12 text-center font-mono text-xs">#</TableHead>
                          {analysisResult.headers.map(header => (
                            <TableHead key={header.index} className="text-xs whitespace-nowrap">
                              {header.original_name}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {analysisResult.sample_data.slice(0, 5).map((row, rowIndex) => (
                          <TableRow key={rowIndex}>
                            <TableCell className="text-center font-mono text-xs text-muted-foreground">
                              {rowIndex + 1}
                            </TableCell>
                            {row.map((cell, cellIndex) => (
                              <TableCell key={cellIndex} className="text-sm whitespace-nowrap">
                                {cell ?? <span className="text-muted-foreground/40">empty</span>}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Sidebar */}
            <div className="space-y-4">
              <Card className="sticky top-6">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">File Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">File</span>
                      <span className="font-medium truncate ml-2 max-w-[160px]">{file?.name}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Rows</span>
                      <span className="font-medium">{analysisResult.row_count}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Columns</span>
                      <span className="font-medium">{analysisResult.headers.length}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Mapped</span>
                      <span className="font-medium">{mappedCount} / {allFields.length}</span>
                    </div>
                  </div>
                  <Separator />
                  <div className="space-y-2">
                    <Button className="w-full" onClick={handleGoToPreview}>
                      Preview Import
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                    <Button variant="outline" className="w-full" onClick={() => { setStep('upload'); setError(''); }}>
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Back
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Step 3: Preview */}
        {step === 'preview' && analysisResult && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Eye className="h-5 w-5" />
                      Import Preview
                    </CardTitle>
                    <CardDescription>
                      Review the mapped data before importing. {analysisResult.row_count} styles will be processed.
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="text-sm">
                      {analysisResult.row_count} rows
                    </Badge>
                    <Badge variant="outline" className="text-sm">
                      {mappedFields.length} fields
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="w-12 text-center font-mono text-xs">#</TableHead>
                        {mappedFields.map(field => (
                          <TableHead key={field.key} className="whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs">{field.label}</span>
                              {field.required && (
                                <span className="text-red-500 text-[10px]">*</span>
                              )}
                            </div>
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {analysisResult.sample_data.slice(0, 10).map((_, rowIndex) => (
                        <TableRow key={rowIndex}>
                          <TableCell className="text-center font-mono text-xs text-muted-foreground">
                            {rowIndex + 1}
                          </TableCell>
                          {mappedFields.map(field => (
                            <TableCell key={field.key} className="text-sm whitespace-nowrap">
                              {getPreviewValue(rowIndex, field.key)}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                {analysisResult.sample_data.length > 10 && (
                  <p className="text-sm text-muted-foreground mt-3 text-center">
                    Showing first 10 of {analysisResult.row_count} rows
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Action Bar */}
            <div className="flex items-center justify-between bg-card border rounded-lg p-4">
              <Button variant="outline" onClick={() => { setStep('mapping'); setError(''); }}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Mapping
              </Button>
              <div className="flex items-center gap-3">
                <p className="text-sm text-muted-foreground">
                  Ready to import <strong>{analysisResult.row_count}</strong> styles
                </p>
                <Button size="lg" onClick={handleImport}>
                  <FileUp className="mr-2 h-4 w-4" />
                  Import {analysisResult.row_count} Styles
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Importing */}
        {step === 'importing' && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-20 space-y-6">
              <div className="relative">
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                  <Loader2 className="h-10 w-10 animate-spin text-primary" />
                </div>
              </div>
              <div className="text-center space-y-2">
                <p className="text-xl font-semibold">Importing Styles...</p>
                <p className="text-sm text-muted-foreground max-w-md">
                  Processing {analysisResult?.row_count} rows. This may take a moment depending on the file size.
                </p>
              </div>
              <div className="w-64 h-2 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full animate-pulse" style={{ width: '60%' }} />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 5: Results */}
        {step === 'results' && importResult && (
          <div className="space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
              <Card className="border-green-200 dark:border-green-900">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                      <CheckCircle2 className="h-6 w-6 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Successfully Imported</p>
                      <p className="text-3xl font-bold text-green-600">{importResult.imported_count}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-yellow-200 dark:border-yellow-900">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
                      <AlertTriangle className="h-6 w-6 text-yellow-600" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Skipped</p>
                      <p className="text-3xl font-bold text-yellow-600">{importResult.skipped_count}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-blue-200 dark:border-blue-900">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                      <FileSpreadsheet className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Total Processed</p>
                      <p className="text-3xl font-bold text-blue-600">
                        {importResult.imported_count + importResult.skipped_count}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Success/Error Details */}
            {importResult.errors.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-destructive">
                    <AlertCircle className="h-5 w-5" />
                    Import Errors ({importResult.errors.length})
                  </CardTitle>
                  <CardDescription>
                    The following rows had issues and were not imported
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="max-h-64 overflow-y-auto rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="w-20">Row</TableHead>
                          <TableHead>Error Details</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {importResult.errors.map((err, index) => (
                          <TableRow key={index}>
                            <TableCell className="font-mono text-sm font-medium">
                              Row {err.row}
                            </TableCell>
                            <TableCell className="text-sm text-destructive">
                              {err.error}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}

            {importResult.errors.length === 0 && (
              <Card className="border-green-200 bg-green-50/50 dark:bg-green-950/10 dark:border-green-900">
                <CardContent className="flex items-center gap-4 pt-6">
                  <CheckCircle2 className="h-8 w-8 text-green-600" />
                  <div>
                    <p className="font-semibold text-green-800 dark:text-green-300">All styles imported successfully!</p>
                    <p className="text-sm text-green-600 dark:text-green-400">
                      {importResult.message}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Action Bar */}
            <div className="flex items-center justify-between bg-card border rounded-lg p-4">
              <Button variant="outline" onClick={resetImport}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Import More Styles
              </Button>
              <Button onClick={() => router.push('/styles')}>
                Go to Styles Library
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
