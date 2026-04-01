'use client';

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
import { Plus, Search, Loader2, ClipboardCheck, CheckCircle, XCircle, AlertCircle, Calculator } from 'lucide-react';
import api from '@/lib/api';
import { TableSkeleton } from '@/components/skeletons';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

interface QualityInspection {
  id: number;
  style_id: number;
  inspector_id: number;
  inspection_date: string;
  lot_size: number;
  sample_size: number;
  inspection_level: string;
  aql_level: number;
  accept_number: number;
  reject_number: number;
  critical_defects: number;
  major_defects: number;
  minor_defects: number;
  total_defects: number;
  result: string;
  remarks: string | null;
  created_at: string;
  style?: {
    style_number: string;
    purchase_order?: {
      po_number: string;
    };
  };
  inspector?: {
    name: string;
  };
}

interface Style {
  id: number;
  style_number: string;
  quantity: number;
  purchase_order_id: number;
  purchase_order?: {
    po_number: string;
  };
}

interface AQLCalculation {
  sample_size: number;
  accept_number: number;
  reject_number: number;
}

const inspectionSchema = z.object({
  style_id: z.coerce.number().min(1, 'Style is required'),
  inspection_date: z.string().min(1, 'Date is required'),
  lot_size: z.coerce.number().min(1, 'Lot size must be at least 1'),
  inspection_level: z.string().min(1, 'Inspection level is required'),
  aql_level: z.coerce.number().min(0, 'AQL level is required'),
  critical_defects: z.coerce.number().min(0, 'Must be 0 or greater'),
  major_defects: z.coerce.number().min(0, 'Must be 0 or greater'),
  minor_defects: z.coerce.number().min(0, 'Must be 0 or greater'),
  remarks: z.string().optional(),
});

type InspectionFormData = z.infer<typeof inspectionSchema>;

export default function QualityInspectionsPage() {
  const [inspections, setInspections] = useState<QualityInspection[]>([]);
  const [styles, setStyles] = useState<Style[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [resultFilter, setResultFilter] = useState('all');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isAqlDialogOpen, setIsAqlDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [aqlCalculation, setAqlCalculation] = useState<AQLCalculation | null>(null);
  const [calculatorLotSize, setCalculatorLotSize] = useState<number>(1000);
  const [calculatorLevel, setCalculatorLevel] = useState<string>('II');
  const [calculatorAql, setCalculatorAql] = useState<number>(2.5);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
  } = useForm<InspectionFormData>({
    resolver: zodResolver(inspectionSchema),
    defaultValues: {
      inspection_date: new Date().toISOString().split('T')[0],
      inspection_level: 'II',
      aql_level: 2.5,
      critical_defects: 0,
      major_defects: 0,
      minor_defects: 0,
    },
  });

  const watchLotSize = watch('lot_size');
  const watchLevel = watch('inspection_level');
  const watchAql = watch('aql_level');
  const watchCritical = watch('critical_defects');
  const watchMajor = watch('major_defects');
  const watchMinor = watch('minor_defects');

  useEffect(() => {
    fetchInspections();
    fetchStyles();
  }, [searchTerm, resultFilter]);

  useEffect(() => {
    if (watchLotSize && watchLevel && watchAql) {
      calculateAQL(watchLotSize, watchLevel, watchAql);
    }
  }, [watchLotSize, watchLevel, watchAql]);

  const fetchInspections = async () => {
    try {
      setLoading(true);
      const params: any = {};

      if (searchTerm) {
        params.search = searchTerm;
      }

      if (resultFilter !== 'all') {
        params.result = resultFilter;
      }

      const response = await api.get('/quality-inspections', { params });
      setInspections(response.data.quality_inspections || response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch inspections:', error);
    } finally {
      setLoading(false);
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

  const calculateAQL = async (lotSize: number, level: string, aql: number) => {
    try {
      const response = await api.post<AQLCalculation>('/quality-inspections/calculate-aql', {
        lot_size: lotSize,
        inspection_level: level,
        aql_level: aql,
      });
      setAqlCalculation(response.data);
    } catch (error) {
      console.error('Failed to calculate AQL:', error);
    }
  };

  const handleCalculatorCalculate = async () => {
    await calculateAQL(calculatorLotSize, calculatorLevel, calculatorAql);
  };

  const onSubmit = async (data: InspectionFormData) => {
    setIsSubmitting(true);
    try {
      await api.post('/quality-inspections', data);
      setIsCreateDialogOpen(false);
      reset({
        inspection_date: new Date().toISOString().split('T')[0],
        inspection_level: 'II',
        aql_level: 2.5,
        critical_defects: 0,
        major_defects: 0,
        minor_defects: 0,
      });
      fetchInspections();
    } catch (error) {
      console.error('Failed to create inspection:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getResultColor = (result: string) => {
    const colors: Record<string, string> = {
      pass: 'default',
      fail: 'destructive',
      pending: 'secondary',
    };
    return colors[result] || 'secondary';
  };

  const getResultIcon = (result: string) => {
    switch (result) {
      case 'pass':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'fail':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getTotalDefects = () => {
    return (watchCritical || 0) + (watchMajor || 0) + (watchMinor || 0);
  };

  const predictResult = () => {
    if (!aqlCalculation) return 'pending';
    const totalDefects = getTotalDefects();
    return totalDefects <= aqlCalculation.accept_number ? 'pass' : 'fail';
  };

  const aqlLevels = [0.010, 0.015, 0.025, 0.040, 0.065, 0.10, 0.15, 0.25, 0.40, 0.65, 1.0, 1.5, 2.5, 4.0, 6.5, 10.0];

  return (
    <DashboardLayout requiredPermissions={['quality.view_inspection', 'quality.view_all_inspections', 'quality.create_inspection']} requireAll={false}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Quality Inspections</h1>
            <p className="text-muted-foreground">AQL-based quality control inspections (ISO 2859-1)</p>
          </div>
          <div className="flex gap-2">
            <Dialog open={isAqlDialogOpen} onOpenChange={setIsAqlDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Calculator className="mr-2 h-4 w-4" />
                  AQL Calculator
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>AQL Calculator</DialogTitle>
                  <DialogDescription>
                    Calculate sample size and accept/reject numbers based on ISO 2859-1
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="calc_lot_size">Lot Size</Label>
                    <Input
                      id="calc_lot_size"
                      type="number"
                      value={calculatorLotSize}
                      onChange={(e) => setCalculatorLotSize(parseInt(e.target.value) || 0)}
                      placeholder="1000"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="calc_level">Inspection Level</Label>
                    <Select value={calculatorLevel} onValueChange={setCalculatorLevel}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="I">Level I (Reduced)</SelectItem>
                        <SelectItem value="II">Level II (Normal)</SelectItem>
                        <SelectItem value="III">Level III (Tightened)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="calc_aql">AQL Level</Label>
                    <Select value={calculatorAql.toString()} onValueChange={(v) => setCalculatorAql(parseFloat(v))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {aqlLevels.map((level) => (
                          <SelectItem key={level} value={level.toString()}>
                            {level}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={handleCalculatorCalculate} className="w-full">
                    Calculate
                  </Button>
                  {aqlCalculation && (
                    <div className="rounded-lg border p-4 space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm font-medium">Sample Size:</span>
                        <span className="text-sm">{aqlCalculation.sample_size}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm font-medium">Accept Number (Ac):</span>
                        <span className="text-sm text-green-600">{aqlCalculation.accept_number}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-sm font-medium">Reject Number (Re):</span>
                        <span className="text-sm text-red-600">{aqlCalculation.reject_number}</span>
                      </div>
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  New Inspection
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl">
                <form onSubmit={handleSubmit(onSubmit)}>
                  <DialogHeader>
                    <DialogTitle>Create Quality Inspection</DialogTitle>
                    <DialogDescription>
                      Record a quality inspection with AQL methodology
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="style_id">Style *</Label>
                        <Select onValueChange={(value) => setValue('style_id', parseInt(value))}>
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
                        {errors.style_id && (
                          <p className="text-sm text-destructive">{errors.style_id.message}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="inspection_date">Inspection Date *</Label>
                        <Input
                          id="inspection_date"
                          type="date"
                          {...register('inspection_date')}
                        />
                        {errors.inspection_date && (
                          <p className="text-sm text-destructive">{errors.inspection_date.message}</p>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="lot_size">Lot Size *</Label>
                        <Input
                          id="lot_size"
                          type="number"
                          placeholder="1000"
                          {...register('lot_size')}
                        />
                        {errors.lot_size && (
                          <p className="text-sm text-destructive">{errors.lot_size.message}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="inspection_level">Inspection Level *</Label>
                        <Select
                          defaultValue="II"
                          onValueChange={(value) => setValue('inspection_level', value)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="I">Level I</SelectItem>
                            <SelectItem value="II">Level II</SelectItem>
                            <SelectItem value="III">Level III</SelectItem>
                          </SelectContent>
                        </Select>
                        {errors.inspection_level && (
                          <p className="text-sm text-destructive">{errors.inspection_level.message}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="aql_level">AQL Level *</Label>
                        <Select
                          defaultValue="2.5"
                          onValueChange={(value) => setValue('aql_level', parseFloat(value))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {aqlLevels.map((level) => (
                              <SelectItem key={level} value={level.toString()}>
                                {level}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {errors.aql_level && (
                          <p className="text-sm text-destructive">{errors.aql_level.message}</p>
                        )}
                      </div>
                    </div>
                    {aqlCalculation && (
                      <div className="rounded-lg border bg-muted p-4">
                        <p className="text-sm font-medium mb-2">AQL Calculation Results:</p>
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Sample Size:</span>
                            <p className="font-bold">{aqlCalculation.sample_size}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Accept (Ac):</span>
                            <p className="font-bold text-green-600">{aqlCalculation.accept_number}</p>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Reject (Re):</span>
                            <p className="font-bold text-red-600">{aqlCalculation.reject_number}</p>
                          </div>
                        </div>
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label className="text-base font-semibold">Defects Count</Label>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="critical_defects">Critical Defects</Label>
                          <Input
                            id="critical_defects"
                            type="number"
                            placeholder="0"
                            {...register('critical_defects')}
                          />
                          {errors.critical_defects && (
                            <p className="text-sm text-destructive">{errors.critical_defects.message}</p>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="major_defects">Major Defects</Label>
                          <Input
                            id="major_defects"
                            type="number"
                            placeholder="0"
                            {...register('major_defects')}
                          />
                          {errors.major_defects && (
                            <p className="text-sm text-destructive">{errors.major_defects.message}</p>
                          )}
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="minor_defects">Minor Defects</Label>
                          <Input
                            id="minor_defects"
                            type="number"
                            placeholder="0"
                            {...register('minor_defects')}
                          />
                          {errors.minor_defects && (
                            <p className="text-sm text-destructive">{errors.minor_defects.message}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-between rounded-lg border p-3 bg-muted">
                        <span className="text-sm font-medium">Total Defects:</span>
                        <span className="text-lg font-bold">{getTotalDefects()}</span>
                      </div>
                      {aqlCalculation && (
                        <div className="flex items-center justify-between rounded-lg border p-3" style={{
                          backgroundColor: predictResult() === 'pass' ? 'rgb(220 252 231)' : 'rgb(254 226 226)',
                          borderColor: predictResult() === 'pass' ? 'rgb(22 163 74)' : 'rgb(220 38 38)'
                        }}>
                          <span className="text-sm font-medium">Predicted Result:</span>
                          <Badge variant={predictResult() === 'pass' ? 'default' : 'destructive'}>
                            {predictResult().toUpperCase()}
                          </Badge>
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="remarks">Remarks</Label>
                      <textarea
                        id="remarks"
                        className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        placeholder="Additional notes about the inspection..."
                        {...register('remarks')}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsCreateDialogOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" disabled={isSubmitting}>
                      {isSubmitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        <>
                          <ClipboardCheck className="mr-2 h-4 w-4" />
                          Create Inspection
                        </>
                      )}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Inspections</CardTitle>
              <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{inspections.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Passed</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {inspections.filter(i => i.result === 'pass').length}
              </div>
              <p className="text-xs text-muted-foreground">
                {inspections.length > 0
                  ? ((inspections.filter(i => i.result === 'pass').length / inspections.length) * 100).toFixed(1)
                  : 0}% pass rate
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Failed</CardTitle>
              <XCircle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {inspections.filter(i => i.result === 'fail').length}
              </div>
              <p className="text-xs text-muted-foreground">
                {inspections.length > 0
                  ? ((inspections.filter(i => i.result === 'fail').length / inspections.length) * 100).toFixed(1)
                  : 0}% fail rate
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Defects</CardTitle>
              <AlertCircle className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {inspections.reduce((sum, i) => sum + i.total_defects, 0)}
              </div>
              <p className="text-xs text-muted-foreground">Across all inspections</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
            <CardDescription>Search and filter quality inspections</CardDescription>
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
              <Select value={resultFilter} onValueChange={setResultFilter}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Filter by result" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Results</SelectItem>
                  <SelectItem value="pass">Passed</SelectItem>
                  <SelectItem value="fail">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <TableSkeleton columns={12} rows={5} hasHeader={false} />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Style</TableHead>
                    <TableHead>PO Number</TableHead>
                    <TableHead>Inspector</TableHead>
                    <TableHead className="text-right">Lot Size</TableHead>
                    <TableHead className="text-right">Sample</TableHead>
                    <TableHead>AQL</TableHead>
                    <TableHead className="text-center">Critical</TableHead>
                    <TableHead className="text-center">Major</TableHead>
                    <TableHead className="text-center">Minor</TableHead>
                    <TableHead className="text-center">Total</TableHead>
                    <TableHead>Result</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inspections.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={12} className="text-center text-muted-foreground">
                        No quality inspections found
                      </TableCell>
                    </TableRow>
                  ) : (
                    inspections.map((inspection) => (
                      <TableRow key={inspection.id}>
                        <TableCell>{formatDate(inspection.inspection_date)}</TableCell>
                        <TableCell className="font-medium">{inspection.style?.style_number}</TableCell>
                        <TableCell>{inspection.style?.purchase_order?.po_number || 'N/A'}</TableCell>
                        <TableCell>{inspection.inspector?.name || 'N/A'}</TableCell>
                        <TableCell className="text-right">{inspection.lot_size.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{inspection.sample_size}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{inspection.aql_level}</Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant={inspection.critical_defects > 0 ? 'destructive' : 'secondary'}>
                            {inspection.critical_defects}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant={inspection.major_defects > 0 ? 'destructive' : 'secondary'}>
                            {inspection.major_defects}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant={inspection.minor_defects > 0 ? 'destructive' : 'secondary'}>
                            {inspection.minor_defects}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="font-bold">{inspection.total_defects}</span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getResultIcon(inspection.result)}
                            <Badge variant={getResultColor(inspection.result) as any}>
                              {inspection.result.toUpperCase()}
                            </Badge>
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
      </div>
    </DashboardLayout>
  );
}
