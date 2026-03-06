'use client';

export const dynamic = 'force-dynamic';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import api from '@/lib/api';
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
  Save,
  BookmarkPlus,
  Star,
  XCircle,
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

interface AnalysisResult {
  headers: Array<{
    index: number;
    original_name: string;
    suggested_field: string | null;
  }>;
  sample_rows: (string | number | null)[][];
  total_rows: number;
  suggested_mappings: Record<string, number | null>;
}

interface ImportError {
  row: number;
  error: string;
  data?: Record<string, unknown>;
  style_number?: string;
}

interface ImportResult {
  imported: number;
  skipped: number;
  total_processed: number;
  errors: ImportError[];
  styles: Array<{
    id: number;
    style_number: string;
    quantity: number;
    unit_price: number;
  }>;
}

interface SavedMapping {
  id: number;
  name: string;
  import_type: string;
  column_mapping: Record<string, number | null>;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

interface PurchaseOrder {
  id: number;
  po_number: string;
  buyer_name?: string;
  status?: string;
}

interface ApiError {
  response?: { data?: { message?: string } };
}

const isApiError = (error: unknown): error is ApiError => {
  return typeof error === 'object' && error !== null && 'response' in error;
};

export default function POImportPage() {
  const params = useParams();
  const router = useRouter();
  const poId = params.id as string;

  const [po, setPo] = useState<PurchaseOrder | null>(null);
  const [step, setStep] = useState<ImportStep>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [tempFilePath, setTempFilePath] = useState('');
  const [columnMapping, setColumnMapping] = useState<Record<string, number | null>>({});
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Saved mappings
  const [savedMappings, setSavedMappings] = useState<SavedMapping[]>([]);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [newMappingName, setNewMappingName] = useState('');
  const [saveAsDefault, setSaveAsDefault] = useState(false);

  const currentStepIndex = STEPS.findIndex(s => s.key === step);

  // Fetch PO info
  useEffect(() => {
    const fetchPO = async () => {
      try {
        const response = await api.get<{ purchase_order: PurchaseOrder }>(`/purchase-orders/${poId}`);
        setPo(response.data.purchase_order);
      } catch {
        toast.error('Failed to load purchase order');
      }
    };
    fetchPO();
    fetchSavedMappings();
  }, [poId]);

  const fetchSavedMappings = async () => {
    try {
      const response = await api.get<SavedMapping[]>('/import-mappings', {
        params: { import_type: 'styles' },
      });
      setSavedMappings(response.data);
    } catch (err) {
      console.error('Failed to fetch saved mappings:', err);
    }
  };

  const handleSaveMapping = async () => {
    if (!newMappingName.trim()) {
      setError('Please enter a name for this mapping');
      return;
    }
    try {
      const response = await api.post<{ mapping: SavedMapping }>('/import-mappings', {
        name: newMappingName,
        import_type: 'styles',
        column_mapping: columnMapping,
        is_default: saveAsDefault,
      });
      setSavedMappings([...savedMappings, response.data.mapping]);
      setShowSaveDialog(false);
      setNewMappingName('');
      setSaveAsDefault(false);
      setError('');
      toast.success('Mapping saved');
    } catch (err: unknown) {
      setError(isApiError(err) ? err.response?.data?.message || 'Failed to save mapping' : 'Failed to save mapping');
    }
  };

  const handleLoadMapping = (mapping: SavedMapping) => {
    setColumnMapping(mapping.column_mapping);
    setError('');
    toast.success(`Loaded mapping: ${mapping.name}`);
  };

  const handleDeleteMapping = async (mappingId: number) => {
    if (!confirm('Delete this saved mapping?')) return;
    try {
      await api.delete(`/import-mappings/${mappingId}`);
      setSavedMappings(savedMappings.filter(m => m.id !== mappingId));
      toast.success('Mapping deleted');
    } catch (err: unknown) {
      setError(isApiError(err) ? err.response?.data?.message || 'Failed to delete' : 'Failed to delete');
    }
  };

  // Drag and drop
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
    if (e.target.files?.[0]) {
      setFile(e.target.files[0]);
      setError('');
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const response = await api.get('/excel-templates/styles', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'style_import_template.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      toast.success('Template downloaded');
    } catch {
      toast.error('Failed to download template');
    }
  };

  const handleAnalyze = async () => {
    if (!file) return;
    try {
      setIsProcessing(true);
      setError('');
      const formData = new FormData();
      formData.append('file', file);
      const response = await api.post<{ analysis: AnalysisResult; temp_file_path: string }>(
        `/purchase-orders/${poId}/import/analyze`, formData, { headers: { 'Content-Type': 'multipart/form-data' } }
      );
      setAnalysis(response.data.analysis);
      setTempFilePath(response.data.temp_file_path);

      const defaultMapping = savedMappings.find(m => m.is_default);
      if (defaultMapping) {
        setColumnMapping(defaultMapping.column_mapping);
      } else {
        setColumnMapping(response.data.analysis.suggested_mappings);
      }
      setStep('mapping');
      toast.success(`File analyzed: ${response.data.analysis.total_rows} rows found`);
    } catch (err: unknown) {
      setError(isApiError(err) ? err.response?.data?.message || 'Failed to analyze file' : 'Failed to analyze file');
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
    if (!analysis || columnMapping[field] === null || columnMapping[field] === undefined) return '-';
    const colIndex = columnMapping[field]!;
    const val = analysis.sample_rows[rowIndex]?.[colIndex];
    return val != null ? String(val) : '-';
  };

  const handleImport = async () => {
    if (!validateMapping()) return;
    try {
      setIsProcessing(true);
      setStep('importing');
      setError('');
      const response = await api.post<{ result: ImportResult }>(
        `/purchase-orders/${poId}/import/execute`,
        { temp_file_path: tempFilePath, column_mapping: columnMapping, skip_first_row: true }
      );
      setImportResult(response.data.result);
      setStep('results');
      if (response.data.result.imported > 0) {
        toast.success(`Imported ${response.data.result.imported} styles`);
      }
    } catch (err: unknown) {
      setError(isApiError(err) ? err.response?.data?.message || 'Failed to import' : 'Failed to import');
      setStep('preview');
    } finally {
      setIsProcessing(false);
    }
  };

  const resetImport = () => {
    setStep('upload');
    setFile(null);
    setAnalysis(null);
    setTempFilePath('');
    setColumnMapping({});
    setImportResult(null);
    setError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
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
            <Button variant="ghost" size="sm" onClick={() => router.push(`/purchase-orders/${poId}`)}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to PO
            </Button>
            <Separator orientation="vertical" className="h-6" />
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <FileSpreadsheet className="h-6 w-6" />
                Import Styles from Excel
              </h1>
              <p className="text-sm text-muted-foreground">
                {po ? (
                  <>Importing into PO <span className="font-medium text-foreground">{po.po_number}</span></>
                ) : (
                  'Loading purchase order...'
                )}
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
            <div className="col-span-2 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Upload File</CardTitle>
                  <CardDescription>
                    Drag and drop your Excel file or click to browse
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
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
                      accept=".xlsx,.xls,.csv"
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
                            Supports .xlsx, .xls, and .csv files
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

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
                  >
                    <Download className="mr-2 h-3 w-3" />
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
        {step === 'mapping' && analysis && (
          <div className="grid grid-cols-3 gap-6">
            <div className="col-span-2 space-y-4">
              {/* Saved Mappings */}
              {savedMappings.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <BookmarkPlus className="h-4 w-4" />
                      Saved Mappings
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {savedMappings.map(mapping => (
                        <div
                          key={mapping.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 border rounded-lg hover:bg-accent cursor-pointer transition-colors group"
                        >
                          <div className="flex items-center gap-1.5" onClick={() => handleLoadMapping(mapping)}>
                            {mapping.is_default && <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />}
                            <span className="text-sm font-medium">{mapping.name}</span>
                          </div>
                          <button
                            className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={(e) => { e.stopPropagation(); handleDeleteMapping(mapping.id); }}
                          >
                            <XCircle className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

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
                      <Button variant="outline" size="sm" onClick={() => setShowSaveDialog(true)}>
                        <Save className="mr-2 h-3 w-3" />
                        Save Mapping
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1">
                    <div className="grid grid-cols-[200px_1fr_120px] gap-3 px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      <span>Style Field</span>
                      <span>Excel Column</span>
                      <span>Status</span>
                    </div>
                    <Separator />

                    {requiredFields.map(field => {
                      const isMapped = columnMapping[field.key] !== null && columnMapping[field.key] !== undefined;
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
                              {analysis.headers.map(header => (
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
                              {analysis.headers.map(header => (
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
                          {analysis.headers.map(header => (
                            <TableHead key={header.index} className="text-xs whitespace-nowrap">
                              {header.original_name}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {analysis.sample_rows.slice(0, 5).map((row, rowIndex) => (
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
                      <span className="text-muted-foreground">PO</span>
                      <span className="font-medium">{po?.po_number || '...'}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">File</span>
                      <span className="font-medium truncate ml-2 max-w-[160px]">{file?.name}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Rows</span>
                      <span className="font-medium">{analysis.total_rows}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Columns</span>
                      <span className="font-medium">{analysis.headers.length}</span>
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
        {step === 'preview' && analysis && (
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
                      Review the mapped data before importing into <strong>{po?.po_number}</strong>. {analysis.total_rows} styles will be processed.
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="text-sm">
                      {analysis.total_rows} rows
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
                      {analysis.sample_rows.slice(0, 10).map((_, rowIndex) => (
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
                {analysis.sample_rows.length > 10 && (
                  <p className="text-sm text-muted-foreground mt-3 text-center">
                    Showing first 10 of {analysis.total_rows} rows
                  </p>
                )}
              </CardContent>
            </Card>

            <div className="flex items-center justify-between bg-card border rounded-lg p-4">
              <Button variant="outline" onClick={() => { setStep('mapping'); setError(''); }}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Mapping
              </Button>
              <div className="flex items-center gap-3">
                <p className="text-sm text-muted-foreground">
                  Ready to import <strong>{analysis.total_rows}</strong> styles into <strong>{po?.po_number}</strong>
                </p>
                <Button size="lg" onClick={handleImport}>
                  <FileUp className="mr-2 h-4 w-4" />
                  Import {analysis.total_rows} Styles
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
                  Processing {analysis?.total_rows} rows into {po?.po_number}. This may take a moment.
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
            <div className="grid grid-cols-3 gap-4">
              <Card className="border-green-200 dark:border-green-900">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                      <CheckCircle2 className="h-6 w-6 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Successfully Imported</p>
                      <p className="text-3xl font-bold text-green-600">{importResult.imported}</p>
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
                      <p className="text-3xl font-bold text-yellow-600">{importResult.skipped}</p>
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
                      <p className="text-3xl font-bold text-blue-600">{importResult.total_processed}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Imported Styles Table */}
            {importResult.styles.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Imported Styles</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="max-h-64 overflow-y-auto rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead>Style Number</TableHead>
                          <TableHead className="text-right">Quantity</TableHead>
                          <TableHead className="text-right">Unit Price</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {importResult.styles.map((style) => (
                          <TableRow key={style.id}>
                            <TableCell className="font-medium">{style.style_number}</TableCell>
                            <TableCell className="text-right">{style.quantity}</TableCell>
                            <TableCell className="text-right">${(style.unit_price ?? 0).toFixed(2)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Errors */}
            {importResult.errors.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-destructive">
                    <AlertCircle className="h-5 w-5" />
                    Import Errors ({importResult.errors.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="max-h-64 overflow-y-auto rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="w-20">Row</TableHead>
                          <TableHead>Error</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {importResult.errors.map((err, index) => (
                          <TableRow key={index}>
                            <TableCell className="font-mono text-sm">Row {err.row}</TableCell>
                            <TableCell className="text-sm text-destructive">{err.error}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}

            {importResult.errors.length === 0 && importResult.imported > 0 && (
              <Card className="border-green-200 bg-green-50/50 dark:bg-green-950/10 dark:border-green-900">
                <CardContent className="flex items-center gap-4 pt-6">
                  <CheckCircle2 className="h-8 w-8 text-green-600" />
                  <div>
                    <p className="font-semibold text-green-800 dark:text-green-300">All styles imported successfully!</p>
                    <p className="text-sm text-green-600 dark:text-green-400">
                      {importResult.imported} styles have been added to {po?.po_number}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="flex items-center justify-between bg-card border rounded-lg p-4">
              <Button variant="outline" onClick={resetImport}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Import More Styles
              </Button>
              <Button onClick={() => router.push(`/purchase-orders/${poId}`)}>
                Back to Purchase Order
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Save Mapping Dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save Column Mapping</DialogTitle>
            <DialogDescription>
              Save this column mapping to reuse it for future imports
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="mapping-name">Mapping Name *</Label>
              <Input
                id="mapping-name"
                placeholder="e.g., Standard Style Import"
                value={newMappingName}
                onChange={(e) => setNewMappingName(e.target.value)}
              />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="save-as-default"
                checked={saveAsDefault}
                onCheckedChange={(checked) => setSaveAsDefault(checked as boolean)}
              />
              <Label htmlFor="save-as-default" className="cursor-pointer">
                Set as default mapping
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowSaveDialog(false); setNewMappingName(''); setSaveAsDefault(false); }}>
              Cancel
            </Button>
            <Button onClick={handleSaveMapping}>
              <Save className="mr-2 h-4 w-4" />
              Save Mapping
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
