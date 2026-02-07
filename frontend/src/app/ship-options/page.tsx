'use client';

import { useEffect, useState, useCallback } from 'react';
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
import {
  Ship,
  Plus,
  Search,
  Loader2,
  Calendar,
  Anchor,
  AlertTriangle,
  Edit,
  Trash2,
  Info,
  CheckCircle,
  XCircle,
  MapPin,
} from 'lucide-react';
import api from '@/lib/api';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuth } from '@/contexts/AuthContext';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ShipOption {
  id: number;
  name: string;
  etd: string;
  eta: string;
  vessel_name: string;
  port_of_loading: string;
  port_of_discharge: string;
  notes: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

interface SuggestedShipOption extends ShipOption {
  days_between_exfactory_and_cutoff: number;
}

// ---------------------------------------------------------------------------
// Zod schema for create / edit form
// ---------------------------------------------------------------------------

const shipOptionSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  etd: z.string().min(1, 'ETD is required'),
  eta: z.string().min(1, 'ETA is required'),
  vessel_name: z.string().min(1, 'Vessel name is required'),
  port_of_loading: z.string().min(1, 'Port of loading is required'),
  port_of_discharge: z.string().min(1, 'Port of discharge is required'),
  notes: z.string().optional(),
});

type ShipOptionFormData = z.infer<typeof shipOptionSchema>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MONTHS = [
  { value: '1', label: 'January' },
  { value: '2', label: 'February' },
  { value: '3', label: 'March' },
  { value: '4', label: 'April' },
  { value: '5', label: 'May' },
  { value: '6', label: 'June' },
  { value: '7', label: 'July' },
  { value: '8', label: 'August' },
  { value: '9', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
];

function generateYearOptions(): string[] {
  const currentYear = new Date().getFullYear();
  const years: string[] = [];
  for (let y = currentYear - 1; y <= currentYear + 2; y++) {
    years.push(y.toString());
  }
  return years;
}

/** Calculate cutoff date as ETD minus 7 days */
function getCutoffDate(etdString: string): Date {
  const etd = new Date(etdString);
  const cutoff = new Date(etd);
  cutoff.setDate(cutoff.getDate() - 7);
  return cutoff;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatDateShort(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function isCutoffSoon(etdString: string): boolean {
  const cutoff = getCutoffDate(etdString);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.ceil((cutoff.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  return diffDays >= 0 && diffDays <= 3;
}

function isCutoffPassed(etdString: string): boolean {
  const cutoff = getCutoffDate(etdString);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return cutoff.getTime() < today.getTime();
}

function getStatusBadgeVariant(status: string): string {
  const map: Record<string, string> = {
    active: 'default',
    completed: 'secondary',
    cancelled: 'destructive',
  };
  return map[status] || 'secondary';
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function ShipOptionsPage() {
  const { can } = useAuth();

  // Data
  const [shipOptions, setShipOptions] = useState<ShipOption[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const now = new Date();
  const [filterMonth, setFilterMonth] = useState<string>((now.getMonth() + 1).toString());
  const [filterYear, setFilterYear] = useState<string>(now.getFullYear().toString());
  const [searchTerm, setSearchTerm] = useState('');

  // Create / Edit dialog
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingOption, setEditingOption] = useState<ShipOption | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete confirmation
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deletingOption, setDeletingOption] = useState<ShipOption | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Ship suggestion tool
  const [suggestDate, setSuggestDate] = useState('');
  const [suggestedOptions, setSuggestedOptions] = useState<SuggestedShipOption[]>([]);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);

  const yearOptions = generateYearOptions();

  // -------------------------------------------------------------------------
  // Create form
  // -------------------------------------------------------------------------

  const createForm = useForm<ShipOptionFormData>({
    resolver: zodResolver(shipOptionSchema),
    defaultValues: {
      name: '',
      etd: '',
      eta: '',
      vessel_name: '',
      port_of_loading: '',
      port_of_discharge: '',
      notes: '',
    },
  });

  // -------------------------------------------------------------------------
  // Edit form
  // -------------------------------------------------------------------------

  const editForm = useForm<ShipOptionFormData>({
    resolver: zodResolver(shipOptionSchema),
  });

  // -------------------------------------------------------------------------
  // Fetch ship options
  // -------------------------------------------------------------------------

  const fetchShipOptions = useCallback(async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = {
        month: filterMonth,
        year: filterYear,
      };

      const response = await api.get('/ship-options', { params });
      setShipOptions(response.data.ship_options || response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch ship options:', error);
    } finally {
      setLoading(false);
    }
  }, [filterMonth, filterYear]);

  useEffect(() => {
    fetchShipOptions();
  }, [fetchShipOptions]);

  // -------------------------------------------------------------------------
  // Filtered list (client-side search on top of API month/year filter)
  // -------------------------------------------------------------------------

  const filteredOptions = shipOptions.filter((opt) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      opt.name.toLowerCase().includes(term) ||
      opt.vessel_name.toLowerCase().includes(term) ||
      opt.port_of_loading.toLowerCase().includes(term) ||
      opt.port_of_discharge.toLowerCase().includes(term)
    );
  });

  // -------------------------------------------------------------------------
  // Stats
  // -------------------------------------------------------------------------

  const totalOptions = shipOptions.length;
  const activeOptions = shipOptions.filter((o) => o.status === 'active').length;
  const thisMonthOptions = shipOptions.filter((o) => {
    const etd = new Date(o.etd);
    return etd.getMonth() + 1 === parseInt(filterMonth) && etd.getFullYear() === parseInt(filterYear);
  }).length;

  // -------------------------------------------------------------------------
  // Create handler
  // -------------------------------------------------------------------------

  const onCreateSubmit = async (data: ShipOptionFormData) => {
    setIsSubmitting(true);
    try {
      await api.post('/ship-options', data);
      setIsCreateDialogOpen(false);
      createForm.reset({
        name: '',
        etd: '',
        eta: '',
        vessel_name: '',
        port_of_loading: '',
        port_of_discharge: '',
        notes: '',
      });
      fetchShipOptions();
    } catch (error) {
      console.error('Failed to create ship option:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // -------------------------------------------------------------------------
  // Edit handler
  // -------------------------------------------------------------------------

  const openEditDialog = (option: ShipOption) => {
    setEditingOption(option);
    editForm.reset({
      name: option.name,
      etd: option.etd.split('T')[0],
      eta: option.eta.split('T')[0],
      vessel_name: option.vessel_name,
      port_of_loading: option.port_of_loading,
      port_of_discharge: option.port_of_discharge,
      notes: option.notes || '',
    });
    setIsEditDialogOpen(true);
  };

  const onEditSubmit = async (data: ShipOptionFormData) => {
    if (!editingOption) return;
    setIsSubmitting(true);
    try {
      await api.put(`/ship-options/${editingOption.id}`, data);
      setIsEditDialogOpen(false);
      setEditingOption(null);
      fetchShipOptions();
    } catch (error) {
      console.error('Failed to update ship option:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // -------------------------------------------------------------------------
  // Delete handler
  // -------------------------------------------------------------------------

  const openDeleteDialog = (option: ShipOption) => {
    setDeletingOption(option);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!deletingOption) return;
    setIsDeleting(true);
    try {
      await api.delete(`/ship-options/${deletingOption.id}`);
      setIsDeleteDialogOpen(false);
      setDeletingOption(null);
      fetchShipOptions();
    } catch (error) {
      console.error('Failed to delete ship option:', error);
    } finally {
      setIsDeleting(false);
    }
  };

  // -------------------------------------------------------------------------
  // Ship suggestion tool
  // -------------------------------------------------------------------------

  const handleSuggestShip = async () => {
    if (!suggestDate) return;
    setIsSuggesting(true);
    setSuggestError(null);
    setSuggestedOptions([]);
    try {
      const response = await api.get('/ship-options/suggest', {
        params: { estimated_ex_factory_date: suggestDate },
      });
      const results: SuggestedShipOption[] =
        response.data.ship_options || response.data.suggestions || response.data.data || [];
      setSuggestedOptions(results);
      if (results.length === 0) {
        setSuggestError('No matching ship options found for the given ex-factory date.');
      }
    } catch (error) {
      console.error('Failed to suggest ship options:', error);
      setSuggestError('Failed to fetch suggestions. Please try again.');
    } finally {
      setIsSuggesting(false);
    }
  };

  // -------------------------------------------------------------------------
  // Shared form fields renderer
  // -------------------------------------------------------------------------

  const renderFormFields = (
    form: ReturnType<typeof useForm<ShipOptionFormData>>,
  ) => {
    const {
      register,
      formState: { errors },
      watch,
    } = form;

    const watchedEtd = watch('etd');

    return (
      <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
        {/* Name */}
        <div className="space-y-2">
          <Label htmlFor="name">Name *</Label>
          <Input
            id="name"
            placeholder="e.g. March Sailing #1"
            {...register('name')}
          />
          {errors.name && (
            <p className="text-sm text-destructive">{errors.name.message}</p>
          )}
        </div>

        {/* ETD / ETA */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="etd">ETD (Estimated Time of Departure) *</Label>
            <Input id="etd" type="date" {...register('etd')} />
            {errors.etd && (
              <p className="text-sm text-destructive">{errors.etd.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="eta">ETA (Estimated Time of Arrival) *</Label>
            <Input id="eta" type="date" {...register('eta')} />
            {errors.eta && (
              <p className="text-sm text-destructive">{errors.eta.message}</p>
            )}
          </div>
        </div>

        {/* Auto-calculated cutoff preview */}
        {watchedEtd && (
          <div className="rounded-lg border border-orange-200 bg-orange-50 p-3">
            <div className="flex items-center gap-2 text-sm font-medium text-orange-800">
              <AlertTriangle className="h-4 w-4" />
              Cutoff Date (ETD - 7 days)
            </div>
            <p className="mt-1 text-lg font-bold text-orange-900">
              {formatDate(getCutoffDate(watchedEtd).toISOString())}
            </p>
            <p className="mt-0.5 text-xs text-orange-700">
              All cargo must leave factory by this date.
            </p>
          </div>
        )}

        {/* Vessel Name */}
        <div className="space-y-2">
          <Label htmlFor="vessel_name">Vessel Name *</Label>
          <Input
            id="vessel_name"
            placeholder="e.g. MSC Gulsun"
            {...register('vessel_name')}
          />
          {errors.vessel_name && (
            <p className="text-sm text-destructive">{errors.vessel_name.message}</p>
          )}
        </div>

        {/* Ports */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="port_of_loading">Port of Loading *</Label>
            <Input
              id="port_of_loading"
              placeholder="e.g. Chittagong, BD"
              {...register('port_of_loading')}
            />
            {errors.port_of_loading && (
              <p className="text-sm text-destructive">{errors.port_of_loading.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="port_of_discharge">Port of Discharge *</Label>
            <Input
              id="port_of_discharge"
              placeholder="e.g. Los Angeles, US"
              {...register('port_of_discharge')}
            />
            {errors.port_of_discharge && (
              <p className="text-sm text-destructive">{errors.port_of_discharge.message}</p>
            )}
          </div>
        </div>

        {/* Notes */}
        <div className="space-y-2">
          <Label htmlFor="notes">Notes</Label>
          <textarea
            id="notes"
            className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            placeholder="Additional details about this sailing..."
            {...register('notes')}
          />
        </div>
      </div>
    );
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* ----------------------------------------------------------------- */}
        {/* Header                                                            */}
        {/* ----------------------------------------------------------------- */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Ship Options</h1>
            <p className="text-muted-foreground">
              Manage monthly sailing schedules and vessel assignments
            </p>
          </div>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="mr-2 h-4 w-4" />
                New Ship Option
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl">
              <form onSubmit={createForm.handleSubmit(onCreateSubmit)}>
                <DialogHeader>
                  <DialogTitle>Create Ship Option</DialogTitle>
                  <DialogDescription>
                    Add a new sailing schedule with vessel and port information
                  </DialogDescription>
                </DialogHeader>
                {renderFormFields(createForm)}
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
                        <Ship className="mr-2 h-4 w-4" />
                        Create Ship Option
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* ----------------------------------------------------------------- */}
        {/* Stats Cards                                                       */}
        {/* ----------------------------------------------------------------- */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Ship Options</CardTitle>
              <Ship className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalOptions}</div>
              <p className="text-xs text-muted-foreground">
                For {MONTHS.find((m) => m.value === filterMonth)?.label} {filterYear}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active</CardTitle>
              <Anchor className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{activeOptions}</div>
              <p className="text-xs text-muted-foreground">Currently bookable sailings</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">This Month</CardTitle>
              <Calendar className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{thisMonthOptions}</div>
              <p className="text-xs text-muted-foreground">Departures in selected month</p>
            </CardContent>
          </Card>
        </div>

        {/* ----------------------------------------------------------------- */}
        {/* Cutoff Rule Info Note                                             */}
        {/* ----------------------------------------------------------------- */}
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="flex items-start gap-3 pt-4">
            <Info className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600" />
            <div>
              <p className="text-sm font-medium text-blue-900">
                7-Day Cutoff Rule
              </p>
              <p className="mt-1 text-sm text-blue-800">
                The cutoff date is automatically calculated as <strong>7 days before the ETD</strong>.
                All cargo must be delivered to the port of loading before the cutoff date to be
                included on the sailing. Orders not ready by the cutoff date will need to be
                rescheduled to the next available ship option.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* ----------------------------------------------------------------- */}
        {/* Month / Year Filter + Search                                      */}
        {/* ----------------------------------------------------------------- */}
        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
            <CardDescription>Filter ship options by month, year, or search</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by name, vessel, port..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>
              <Select value={filterMonth} onValueChange={setFilterMonth}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Month" />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterYear} onValueChange={setFilterYear}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="Year" />
                </SelectTrigger>
                <SelectContent>
                  {yearOptions.map((y) => (
                    <SelectItem key={y} value={y}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* ----------------------------------------------------------------- */}
        {/* Ship Options Table                                                */}
        {/* ----------------------------------------------------------------- */}
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
                    <TableHead>Name</TableHead>
                    <TableHead>ETD</TableHead>
                    <TableHead>ETA</TableHead>
                    <TableHead>
                      <div className="flex items-center gap-1">
                        <AlertTriangle className="h-3.5 w-3.5 text-orange-500" />
                        Cutoff Date
                      </div>
                    </TableHead>
                    <TableHead>Vessel Name</TableHead>
                    <TableHead>Port of Loading</TableHead>
                    <TableHead>Port of Discharge</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredOptions.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={9}
                        className="text-center text-muted-foreground"
                      >
                        No ship options found for the selected period
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredOptions.map((option) => {
                      const cutoff = getCutoffDate(option.etd);
                      const cutoffStr = cutoff.toISOString();
                      const cutoffPassed = isCutoffPassed(option.etd);
                      const cutoffSoon = isCutoffSoon(option.etd);

                      return (
                        <TableRow key={option.id}>
                          <TableCell className="font-medium">{option.name}</TableCell>
                          <TableCell>{formatDate(option.etd)}</TableCell>
                          <TableCell>{formatDate(option.eta)}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span
                                className={
                                  cutoffPassed
                                    ? 'font-semibold text-red-600'
                                    : cutoffSoon
                                      ? 'font-semibold text-orange-600'
                                      : 'font-semibold'
                                }
                              >
                                {formatDate(cutoffStr)}
                              </span>
                              {cutoffPassed && (
                                <Badge variant="destructive" className="text-xs">
                                  Passed
                                </Badge>
                              )}
                              {!cutoffPassed && cutoffSoon && (
                                <Badge
                                  variant="outline"
                                  className="border-orange-300 bg-orange-50 text-orange-700 text-xs"
                                >
                                  Soon
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <Ship className="h-3.5 w-3.5 text-muted-foreground" />
                              {option.vessel_name}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                              {option.port_of_loading}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5">
                              <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                              {option.port_of_discharge}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={
                                getStatusBadgeVariant(option.status) as
                                  | 'default'
                                  | 'secondary'
                                  | 'destructive'
                                  | 'outline'
                              }
                            >
                              {option.status.charAt(0).toUpperCase() +
                                option.status.slice(1)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openEditDialog(option)}
                                title="Edit ship option"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openDeleteDialog(option)}
                                title="Delete ship option"
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* ----------------------------------------------------------------- */}
        {/* Suggest Ship Tool                                                 */}
        {/* ----------------------------------------------------------------- */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Suggest Ship
            </CardTitle>
            <CardDescription>
              Enter an estimated ex-factory date to find matching ship options whose cutoff
              date falls after your goods are ready
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-end gap-4">
              <div className="space-y-2">
                <Label htmlFor="suggest_date">Estimated Ex-Factory Date</Label>
                <Input
                  id="suggest_date"
                  type="date"
                  value={suggestDate}
                  onChange={(e) => setSuggestDate(e.target.value)}
                  className="w-[220px]"
                />
              </div>
              <Button
                onClick={handleSuggestShip}
                disabled={!suggestDate || isSuggesting}
              >
                {isSuggesting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Searching...
                  </>
                ) : (
                  <>
                    <Ship className="mr-2 h-4 w-4" />
                    Find Ships
                  </>
                )}
              </Button>
            </div>

            {/* Suggestion results */}
            {suggestError && (
              <div className="mt-4 rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800">
                {suggestError}
              </div>
            )}

            {suggestedOptions.length > 0 && (
              <div className="mt-4 space-y-3">
                <p className="text-sm font-medium text-muted-foreground">
                  {suggestedOptions.length} matching ship option
                  {suggestedOptions.length !== 1 ? 's' : ''} found for ex-factory date{' '}
                  <strong>{formatDate(suggestDate)}</strong>
                </p>
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                  {suggestedOptions.map((opt) => {
                    const cutoff = getCutoffDate(opt.etd);
                    return (
                      <Card key={opt.id} className="border-green-200 bg-green-50">
                        <CardContent className="pt-4">
                          <div className="flex items-center justify-between">
                            <h4 className="font-semibold text-green-900">{opt.name}</h4>
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          </div>
                          <div className="mt-2 space-y-1 text-sm text-green-800">
                            <div className="flex justify-between">
                              <span>Vessel:</span>
                              <span className="font-medium">{opt.vessel_name}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>ETD:</span>
                              <span className="font-medium">{formatDate(opt.etd)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>ETA:</span>
                              <span className="font-medium">{formatDate(opt.eta)}</span>
                            </div>
                            <div className="flex justify-between border-t border-green-200 pt-1">
                              <span className="font-medium">Cutoff:</span>
                              <span className="font-bold text-orange-700">
                                {formatDate(cutoff.toISOString())}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span>Route:</span>
                              <span className="font-medium">
                                {opt.port_of_loading} → {opt.port_of_discharge}
                              </span>
                            </div>
                            {opt.days_between_exfactory_and_cutoff !== undefined && (
                              <div className="flex justify-between border-t border-green-200 pt-1">
                                <span>Days until cutoff:</span>
                                <Badge variant="outline" className="border-green-300 text-green-800">
                                  {opt.days_between_exfactory_and_cutoff} days
                                </Badge>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ----------------------------------------------------------------- */}
        {/* Edit Dialog                                                       */}
        {/* ----------------------------------------------------------------- */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-3xl">
            <form onSubmit={editForm.handleSubmit(onEditSubmit)}>
              <DialogHeader>
                <DialogTitle>Edit Ship Option</DialogTitle>
                <DialogDescription>
                  Update sailing schedule details for{' '}
                  <strong>{editingOption?.name}</strong>
                </DialogDescription>
              </DialogHeader>
              {renderFormFields(editForm)}
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsEditDialogOpen(false);
                    setEditingOption(null);
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Edit className="mr-2 h-4 w-4" />
                      Save Changes
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* ----------------------------------------------------------------- */}
        {/* Delete Confirmation Dialog                                        */}
        {/* ----------------------------------------------------------------- */}
        <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Ship Option</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete{' '}
                <strong>{deletingOption?.name}</strong>? This action cannot be
                undone.
              </DialogDescription>
            </DialogHeader>
            {deletingOption && (
              <div className="rounded-lg border bg-muted p-3 text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Vessel:</span>
                  <span className="font-medium">{deletingOption.vessel_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">ETD:</span>
                  <span className="font-medium">{formatDate(deletingOption.etd)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Route:</span>
                  <span className="font-medium">
                    {deletingOption.port_of_loading} → {deletingOption.port_of_discharge}
                  </span>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsDeleteDialogOpen(false);
                  setDeletingOption(null);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={confirmDelete}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
