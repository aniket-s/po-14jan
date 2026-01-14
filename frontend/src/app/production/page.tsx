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
import { Plus, Search, Loader2, Factory, TrendingUp, Calendar, Target } from 'lucide-react';
import api from '@/lib/api';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuth } from '@/contexts/AuthContext';

interface ProductionTracking {
  id: number;
  style_id: number;
  production_stage_id: number;
  tracking_date: string;
  quantity_produced: number;
  cumulative_quantity: number;
  completion_percentage: number;
  notes: string | null;
  created_at: string;
  style?: {
    style_number: string;
    quantity: number;
    purchase_order?: {
      po_number: string;
    };
  };
  production_stage?: {
    name: string;
    display_order: number;
    weight_percentage: number;
  };
}

interface ProductionStage {
  id: number;
  name: string;
  description: string | null;
  display_order: number;
  weight_percentage: number;
  is_active: boolean;
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

const trackingSchema = z.object({
  style_id: z.coerce.number().min(1, 'Style is required'),
  production_stage_id: z.coerce.number().min(1, 'Production stage is required'),
  tracking_date: z.string().min(1, 'Date is required'),
  quantity_produced: z.coerce.number().min(1, 'Quantity must be at least 1'),
  notes: z.string().optional(),
});

type TrackingFormData = z.infer<typeof trackingSchema>;

export default function ProductionPage() {
  const { can } = useAuth();
  const [trackingRecords, setTrackingRecords] = useState<ProductionTracking[]>([]);
  const [productionStages, setProductionStages] = useState<ProductionStage[]>([]);
  const [styles, setStyles] = useState<Style[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [stageFilter, setStageFilter] = useState('all');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedStyle, setSelectedStyle] = useState<number | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
  } = useForm<TrackingFormData>({
    resolver: zodResolver(trackingSchema),
    defaultValues: {
      tracking_date: new Date().toISOString().split('T')[0],
    },
  });

  const watchedStyleId = watch('style_id');

  useEffect(() => {
    fetchTrackingRecords();
    fetchProductionStages();
    fetchStyles();
  }, [searchTerm, stageFilter]);

  useEffect(() => {
    if (watchedStyleId) {
      setSelectedStyle(watchedStyleId);
    }
  }, [watchedStyleId]);

  const fetchTrackingRecords = async () => {
    try {
      setLoading(true);
      const params: any = {};

      if (searchTerm) {
        params.search = searchTerm;
      }

      if (stageFilter !== 'all') {
        params.production_stage_id = stageFilter;
      }

      const response = await api.get('/production-tracking', { params });
      setTrackingRecords(response.data.production_tracking || response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch production tracking:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchProductionStages = async () => {
    try {
      const response = await api.get('/admin/production-stages');
      setProductionStages(response.data.production_stages || response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch production stages:', error);
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

  const onSubmit = async (data: TrackingFormData) => {
    setIsSubmitting(true);
    try {
      await api.post('/production-tracking', data);
      setIsAddDialogOpen(false);
      reset({
        tracking_date: new Date().toISOString().split('T')[0],
      });
      fetchTrackingRecords();
    } catch (error) {
      console.error('Failed to add production tracking:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStyleProgress = (styleId: number): { completed: number; percentage: number } => {
    const styleRecords = trackingRecords.filter(tr => tr.style_id === styleId);
    const style = styles.find(s => s.id === styleId);

    if (!style || styleRecords.length === 0) {
      return { completed: 0, percentage: 0 };
    }

    // Calculate weighted progress based on stage completion
    let totalWeightedProgress = 0;

    productionStages.forEach(stage => {
      const stageRecords = styleRecords.filter(tr => tr.production_stage_id === stage.id);
      if (stageRecords.length > 0) {
        const latestRecord = stageRecords.reduce((latest, current) =>
          new Date(current.tracking_date) > new Date(latest.tracking_date) ? current : latest
        );
        const stageCompletion = Math.min((latestRecord.cumulative_quantity / style.quantity) * 100, 100);
        totalWeightedProgress += (stageCompletion * stage.weight_percentage) / 100;
      }
    });

    const completed = Math.round((totalWeightedProgress * style.quantity) / 100);
    return {
      completed,
      percentage: Math.min(totalWeightedProgress, 100),
    };
  };

  const getStageProgress = (styleId: number, stageId: number): string => {
    const style = styles.find(s => s.id === styleId);
    if (!style) return '0%';

    const stageRecords = trackingRecords.filter(
      tr => tr.style_id === styleId && tr.production_stage_id === stageId
    );

    if (stageRecords.length === 0) return '0%';

    const latestRecord = stageRecords.reduce((latest, current) =>
      new Date(current.tracking_date) > new Date(latest.tracking_date) ? current : latest
    );

    const percentage = Math.min((latestRecord.cumulative_quantity / style.quantity) * 100, 100);
    return `${percentage.toFixed(1)}%`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getTotalProduction = () => {
    return trackingRecords.reduce((sum, record) => sum + record.quantity_produced, 0);
  };

  const getAverageCompletion = () => {
    if (styles.length === 0) return 0;
    const totalPercentage = styles.reduce((sum, style) => {
      const progress = getStyleProgress(style.id);
      return sum + progress.percentage;
    }, 0);
    return (totalPercentage / styles.length).toFixed(1);
  };

  return (
    <DashboardLayout requiredPermissions={['production.view', 'production.view_all', 'production.submit']} requireAll={false}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Production Tracking</h1>
            <p className="text-muted-foreground">Monitor daily production progress by stage</p>
          </div>
          {can('production.update') && (
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Update
                </Button>
              </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <form onSubmit={handleSubmit(onSubmit)}>
                <DialogHeader>
                  <DialogTitle>Add Production Update</DialogTitle>
                  <DialogDescription>
                    Record daily production progress for a style and stage
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="style_id">Style *</Label>
                    <Select onValueChange={(value) => setValue('style_id', parseInt(value))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select style" />
                      </SelectTrigger>
                      <SelectContent>
                        {styles.map((style) => (
                          <SelectItem key={style.id} value={style.id.toString()}>
                            {style.style_number} - {style.purchase_order?.po_number} ({style.quantity} pcs)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors.style_id && (
                      <p className="text-sm text-destructive">{errors.style_id.message}</p>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="production_stage_id">Production Stage *</Label>
                      <Select onValueChange={(value) => setValue('production_stage_id', parseInt(value))}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select stage" />
                        </SelectTrigger>
                        <SelectContent>
                          {productionStages.filter(ps => ps.is_active).map((stage) => (
                            <SelectItem key={stage.id} value={stage.id.toString()}>
                              {stage.name} ({stage.weight_percentage}%)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {errors.production_stage_id && (
                        <p className="text-sm text-destructive">{errors.production_stage_id.message}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="tracking_date">Date *</Label>
                      <Input
                        id="tracking_date"
                        type="date"
                        {...register('tracking_date')}
                      />
                      {errors.tracking_date && (
                        <p className="text-sm text-destructive">{errors.tracking_date.message}</p>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="quantity_produced">Quantity Produced *</Label>
                    <Input
                      id="quantity_produced"
                      type="number"
                      placeholder="100"
                      {...register('quantity_produced')}
                    />
                    {errors.quantity_produced && (
                      <p className="text-sm text-destructive">{errors.quantity_produced.message}</p>
                    )}
                    {selectedStyle && (
                      <p className="text-xs text-muted-foreground">
                        Total order quantity: {styles.find(s => s.id === selectedStyle)?.quantity?.toLocaleString() || '-'} pcs
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="notes">Notes</Label>
                    <textarea
                      id="notes"
                      className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      placeholder="Production notes, issues, etc..."
                      {...register('notes')}
                    />
                  </div>
                  <div className="rounded-lg bg-muted p-3 text-sm">
                    <p className="font-medium">About Production Tracking</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Cumulative quantities are calculated automatically. Each stage has a weight percentage that contributes to overall completion.
                    </p>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsAddDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Adding...
                      </>
                    ) : (
                      <>
                        <Factory className="mr-2 h-4 w-4" />
                        Add Update
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
          )}
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Styles</CardTitle>
              <Factory className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{styles.length}</div>
              <p className="text-xs text-muted-foreground">In production</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Produced</CardTitle>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{getTotalProduction().toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">Pieces</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Completion</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{getAverageCompletion()}%</div>
              <p className="text-xs text-muted-foreground">Across all styles</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Updates Today</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {trackingRecords.filter(tr =>
                  new Date(tr.tracking_date).toDateString() === new Date().toDateString()
                ).length}
              </div>
              <p className="text-xs text-muted-foreground">Production entries</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
            <CardDescription>Search and filter production records</CardDescription>
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
              <Select value={stageFilter} onValueChange={setStageFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Filter by stage" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Stages</SelectItem>
                  {productionStages.map((stage) => (
                    <SelectItem key={stage.id} value={stage.id.toString()}>
                      {stage.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Progress Overview */}
        <Card>
          <CardHeader>
            <CardTitle>Production Progress by Style</CardTitle>
            <CardDescription>Overall progress for each style across all stages</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {styles.map((style) => {
                const progress = getStyleProgress(style.id);
                return (
                  <div key={style.id} className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <div>
                        <span className="font-medium">{style.style_number}</span>
                        <span className="ml-2 text-muted-foreground">
                          {style.purchase_order?.po_number}
                        </span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-muted-foreground">
                          {progress.completed.toLocaleString()} / {style.quantity?.toLocaleString() || '-'} pcs
                        </span>
                        <Badge variant={progress.percentage >= 100 ? 'default' : 'secondary'}>
                          {progress.percentage.toFixed(1)}%
                        </Badge>
                      </div>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                      <div
                        className="h-full bg-primary transition-all"
                        style={{ width: `${Math.min(progress.percentage, 100)}%` }}
                      />
                    </div>
                    <div className="flex gap-2 text-xs text-muted-foreground">
                      {productionStages.map((stage) => (
                        <div key={stage.id} className="flex items-center gap-1">
                          <span>{stage.name}:</span>
                          <span className="font-medium">{getStageProgress(style.id, stage.id)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Updates</CardTitle>
            <CardDescription>Daily production tracking entries</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex h-96 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Style</TableHead>
                    <TableHead>PO Number</TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead className="text-right">Cumulative</TableHead>
                    <TableHead className="text-right">Completion</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {trackingRecords.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground">
                        No production tracking records found
                      </TableCell>
                    </TableRow>
                  ) : (
                    trackingRecords.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell>{formatDate(record.tracking_date)}</TableCell>
                        <TableCell className="font-medium">{record.style?.style_number}</TableCell>
                        <TableCell>{record.style?.purchase_order?.po_number || 'N/A'}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{record.production_stage?.name}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {record.quantity_produced.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          {record.cumulative_quantity.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant={record.completion_percentage >= 100 ? 'default' : 'secondary'}>
                            {record.completion_percentage.toFixed(1)}%
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {record.notes || '-'}
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
