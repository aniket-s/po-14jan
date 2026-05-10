'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
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
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { FileUp, Loader2, CheckCircle, XCircle, Download, AlertTriangle, Save, BookmarkPlus, Star, ImageIcon } from 'lucide-react';
import api from '@/lib/api';
import { formatDate } from '@/lib/dateUtils';
import { StyleImageUpload } from '@/components/styles/StyleImageUpload';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface ExcelImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  purchaseOrderId: number;
  onImportComplete: () => void;
}

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
    total_price: number;
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

type ImportStep = 'upload' | 'mapping' | 'preview' | 'importing' | 'results';

interface ApiError {
  response?: {
    data?: {
      message?: string;
    };
  };
}

const isApiError = (error: unknown): error is ApiError => {
  return typeof error === 'object' && error !== null && 'response' in error;
};

export function ExcelImportDialog({ isOpen, onClose, purchaseOrderId, onImportComplete }: ExcelImportDialogProps) {
  const [step, setStep] = useState<ImportStep>('upload');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [tempFilePath, setTempFilePath] = useState<string>('');
  const [columnMapping, setColumnMapping] = useState<Record<string, number | null>>({});
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string>('');
  const [styleImages, setStyleImages] = useState<Record<number, string[]>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Saved mappings state
  const [savedMappings, setSavedMappings] = useState<SavedMapping[]>([]);
  const [showSaveMappingDialog, setShowSaveMappingDialog] = useState(false);
  const [newMappingName, setNewMappingName] = useState('');
  const [saveAsDefault, setSaveAsDefault] = useState(false);

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

  // Fetch saved mappings on component mount
  useEffect(() => {
    if (isOpen) {
      fetchSavedMappings();
    }
  }, [isOpen]);

  const fetchSavedMappings = async () => {
    try {
      const response = await api.get<SavedMapping[]>('/import-mappings', {
        params: { import_type: 'styles' },
      });
      setSavedMappings(response.data);

      // Auto-apply default mapping if exists and no file analyzed yet
      const defaultMapping = response.data.find(m => m.is_default);
      if (defaultMapping && !analysis) {
        // Default mapping will be applied after file analysis
      }
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
      setShowSaveMappingDialog(false);
      setNewMappingName('');
      setSaveAsDefault(false);
      setError('');
    } catch (err: unknown) {
      setError(isApiError(err) ? err.response?.data?.message || 'Failed to save mapping' : 'Failed to save mapping');
    }
  };

  const handleLoadMapping = (mapping: SavedMapping) => {
    setColumnMapping(mapping.column_mapping);
    setError('');
  };

  const handleDeleteMapping = async (mappingId: number) => {
    if (!confirm('Are you sure you want to delete this mapping?')) {
      return;
    }

    try {
      await api.delete(`/import-mappings/${mappingId}`);
      setSavedMappings(savedMappings.filter(m => m.id !== mappingId));
    } catch (err: unknown) {
      setError(isApiError(err) ? err.response?.data?.message || 'Failed to delete mapping' : 'Failed to delete mapping');
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setError('');
    setIsProcessing(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await api.post<{
        analysis: AnalysisResult;
        temp_file_path: string;
      }>('/excel-import/analyze', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setAnalysis(response.data.analysis);
      setTempFilePath(response.data.temp_file_path);

      // Apply default mapping if exists, otherwise use suggested mappings
      const defaultMapping = savedMappings.find(m => m.is_default);
      if (defaultMapping) {
        setColumnMapping(defaultMapping.column_mapping);
      } else {
        setColumnMapping(response.data.analysis.suggested_mappings);
      }

      setStep('mapping');
    } catch (err: unknown) {
      setError(isApiError(err) ? err.response?.data?.message || 'Failed to analyze file. Please check the file format.' : 'Failed to analyze file. Please check the file format.');
      setSelectedFile(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMappingChange = (field: string, headerIndex: number | null) => {
    setColumnMapping(prev => ({
      ...prev,
      [field]: headerIndex,
    }));
  };

  const validateMapping = () => {
    const missingRequired = requiredFields.filter(field =>
      columnMapping[field.key] === null || columnMapping[field.key] === undefined
    );
    if (missingRequired.length > 0) {
      setError(`Missing required field mappings: ${missingRequired.map(f => f.label).join(', ')}`);
      return false;
    }
    return true;
  };

  const handlePreview = () => {
    if (!validateMapping()) return;
    setError('');
    setStep('preview');
  };

  const handleImport = async () => {
    if (!validateMapping()) return;

    setIsProcessing(true);
    setStep('importing');
    setError('');

    try {
      const response = await api.post<{ result: ImportResult }>(
        `/excel-import/${purchaseOrderId}/execute`,
        {
          temp_file_path: tempFilePath,
          column_mapping: columnMapping,
          skip_first_row: true,
          style_images: Object.keys(styleImages).length > 0 ? styleImages : undefined,
        }
      );

      setImportResult(response.data.result);
      setStep('results');

      // Call completion callback after successful import
      if (response.data.result.imported > 0) {
        onImportComplete();
      }
    } catch (err: unknown) {
      setError(isApiError(err) ? err.response?.data?.message || 'Failed to import styles. Please try again.' : 'Failed to import styles. Please try again.');
      setStep('preview');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const response = await api.get('/excel-templates/styles', {
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'style_import_template.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError('Failed to download template');
    }
  };

  const resetDialog = () => {
    setStep('upload');
    setSelectedFile(null);
    setAnalysis(null);
    setTempFilePath('');
    setColumnMapping({});
    setImportResult(null);
    setStyleImages({});
    setError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClose = () => {
    resetDialog();
    onClose();
  };

  const getPreviewValue = (rowIndex: number, field: string) => {
    if (!analysis || columnMapping[field] === null || columnMapping[field] === undefined) return '-';
    const colIndex = columnMapping[field]!;
    return analysis.sample_rows[rowIndex]?.[colIndex] ?? '-';
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import Styles from Excel</DialogTitle>
          <DialogDescription>
            Upload an Excel file containing style information to bulk import styles into this purchase order.
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
            <Card>
              <CardHeader>
                <CardTitle>Upload Excel File</CardTitle>
                <CardDescription>
                  Select an Excel file (.xlsx, .xls, or .csv) containing style data
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  <Input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={handleFileSelect}
                    disabled={isProcessing}
                  />
                  {isProcessing && <Loader2 className="h-5 w-5 animate-spin" />}
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDownloadTemplate}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download Template
                  </Button>
                  <p className="text-sm text-muted-foreground">
                    Download a sample template to see the expected format
                  </p>
                </div>
              </CardContent>
            </Card>

            <div className="bg-muted p-4 rounded-lg space-y-2">
              <p className="font-semibold">Required Columns:</p>
              <ul className="list-disc list-inside text-sm space-y-1">
                <li>Style Number</li>
                <li>Quantity (total or individual sizes)</li>
                <li>Unit Price</li>
              </ul>
              <p className="font-semibold mt-4">Optional Columns:</p>
              <ul className="list-disc list-inside text-sm space-y-1">
                <li>Description</li>
                <li>Fabric</li>
                <li>Color</li>
                <li>Size Breakdown (S, M, L, XL, etc.)</li>
                <li>Assignment Type (direct_to_factory or via_agency)</li>
                <li>Assigned Factory ID (numeric user ID)</li>
                <li>Assigned Agency ID (numeric user ID)</li>
              </ul>
            </div>
          </div>
        )}

        {/* Step 2: Mapping */}
        {step === 'mapping' && analysis && (
          <div className="space-y-4">
            {/* Saved Mappings Section */}
            {savedMappings.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BookmarkPlus className="h-5 w-5" />
                    Saved Mappings
                  </CardTitle>
                  <CardDescription>
                    Load a previously saved column mapping
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-2">
                    {savedMappings.map(mapping => (
                      <div
                        key={mapping.id}
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent cursor-pointer"
                      >
                        <div className="flex items-center gap-2 flex-1" onClick={() => handleLoadMapping(mapping)}>
                          {mapping.is_default && <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />}
                          <div>
                            <p className="font-medium">{mapping.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatDate(mapping.created_at)}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteMapping(mapping.id);
                          }}
                        >
                          <XCircle className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Map Columns</CardTitle>
                  <CardDescription>
                    Match Excel columns to style fields. {analysis.total_rows} rows detected.
                  </CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSaveMappingDialog(true)}
                >
                  <Save className="mr-2 h-4 w-4" />
                  Save Mapping
                </Button>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4">
                  {allFields.map(field => (
                    <div key={field.key} className="grid grid-cols-2 gap-4 items-center">
                      <Label>{field.label}</Label>
                      <Select
                        value={columnMapping[field.key]?.toString() ?? 'none'}
                        onValueChange={(value) => handleMappingChange(field.key, value === 'none' ? null : parseInt(value))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select column..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">- Not mapped -</SelectItem>
                          {analysis.headers.map(header => (
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

            {/* Sample Data Preview */}
            <Card>
              <CardHeader>
                <CardTitle>Sample Data Preview</CardTitle>
                <CardDescription>First few rows from your Excel file</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {analysis.headers.map(header => (
                          <TableHead key={header.index}>{header.original_name}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {analysis.sample_rows.slice(0, 5).map((row, rowIndex) => (
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
        {step === 'preview' && analysis && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Import Preview</CardTitle>
                <CardDescription>
                  Preview how the data will be imported. {analysis.total_rows} styles will be processed.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[80px]">
                          <div className="flex items-center gap-1">
                            <ImageIcon className="h-4 w-4" />
                            Image
                          </div>
                        </TableHead>
                        {allFields.filter(f => columnMapping[f.key] !== null).map(field => (
                          <TableHead key={field.key}>{field.label}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {analysis.sample_rows.slice(0, 5).map((_, rowIndex) => {
                        const excelRow = rowIndex + 2;
                        return (
                          <TableRow key={rowIndex}>
                            <TableCell>
                              <StyleImageUpload
                                images={styleImages[excelRow] || []}
                                onImagesChange={(imgs) =>
                                  setStyleImages(prev => ({ ...prev, [excelRow]: imgs }))
                                }
                                compact
                              />
                            </TableCell>
                            {allFields.filter(f => columnMapping[f.key] !== null).map(field => (
                              <TableCell key={field.key}>
                                {getPreviewValue(rowIndex, field.key)}
                              </TableCell>
                            ))}
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
                <p className="text-sm text-muted-foreground mt-4">
                  Showing first 5 rows. Total rows to import: {analysis.total_rows}
                  {Object.keys(styleImages).length > 0 && (
                    <span className="ml-2 text-green-600">
                      ({Object.values(styleImages).filter(imgs => imgs.length > 0).length} style(s) with images)
                    </span>
                  )}
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
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  Import Complete
                </CardTitle>
                <CardDescription>
                  Successfully imported {importResult.imported} styles
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-green-50 p-4 rounded-lg">
                    <p className="text-sm text-muted-foreground">Imported</p>
                    <p className="text-2xl font-bold text-green-600">{importResult.imported}</p>
                  </div>
                  <div className="bg-yellow-50 p-4 rounded-lg">
                    <p className="text-sm text-muted-foreground">Skipped</p>
                    <p className="text-2xl font-bold text-yellow-600">{importResult.skipped}</p>
                  </div>
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <p className="text-sm text-muted-foreground">Total Processed</p>
                    <p className="text-2xl font-bold text-blue-600">{importResult.total_processed}</p>
                  </div>
                </div>

                {importResult.errors.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-2 flex items-center gap-2">
                      <XCircle className="h-4 w-4 text-destructive" />
                      Errors ({importResult.errors.length})
                    </h4>
                    <div className="max-h-48 overflow-y-auto border rounded-lg p-4 space-y-2">
                      {importResult.errors.map((error, index) => (
                        <div key={index} className="text-sm">
                          <span className="font-semibold">Row {error.row}:</span> {error.error}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {importResult.styles.length > 0 && (
                  <div>
                    <h4 className="font-semibold mb-2">Imported Styles</h4>
                    <div className="max-h-64 overflow-y-auto border rounded-lg">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Style Number</TableHead>
                            <TableHead className="text-right">Quantity</TableHead>
                            <TableHead className="text-right">Total Price</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {importResult.styles.map((style) => (
                            <TableRow key={style.id}>
                              <TableCell>{style.style_number}</TableCell>
                              <TableCell className="text-right">{style.quantity}</TableCell>
                              <TableCell className="text-right">
                                ${style.total_price.toFixed(2)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
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
              <Button variant="outline" onClick={() => setStep('upload')}>
                Back
              </Button>
              <Button onClick={handlePreview}>
                Next: Preview
              </Button>
            </>
          )}

          {step === 'preview' && (
            <>
              <Button variant="outline" onClick={() => setStep('mapping')}>
                Back
              </Button>
              <Button onClick={handleImport}>
                <FileUp className="mr-2 h-4 w-4" />
                Import {analysis?.total_rows} Styles
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

      {/* Save Mapping Dialog */}
      <Dialog open={showSaveMappingDialog} onOpenChange={setShowSaveMappingDialog}>
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
                Set as default mapping (auto-apply for future imports)
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowSaveMappingDialog(false);
                setNewMappingName('');
                setSaveAsDefault(false);
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveMapping}>
              <Save className="mr-2 h-4 w-4" />
              Save Mapping
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
