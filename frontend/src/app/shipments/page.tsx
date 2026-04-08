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
import { Plus, Search, Loader2, Truck, Copy, Check, ExternalLink, Package, MapPin, Calendar } from 'lucide-react';
import api from '@/lib/api';
import { TableSkeleton } from '@/components/skeletons';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useAuth } from '@/contexts/AuthContext';

interface Shipment {
  id: number;
  style_id: number;
  tracking_number: string;
  tracking_token: string;
  carrier: string;
  shipping_method: string;
  origin: string;
  destination: string;
  shipment_date: string;
  estimated_delivery: string;
  actual_delivery: string | null;
  status: string;
  quantity: number;
  notes: string | null;
  created_at: string;
  style?: {
    style_number: string;
    purchase_orders?: Array<{
      id: number;
      po_number: string;
    }>;
  };
}

interface Style {
  id: number;
  style_number: string;
  quantity: number;
  purchase_orders?: Array<{
    id: number;
    po_number: string;
  }>;
}

const shipmentSchema = z.object({
  style_id: z.coerce.number().min(1, 'Style is required'),
  tracking_number: z.string().min(1, 'Tracking number is required'),
  carrier: z.string().min(1, 'Carrier is required'),
  shipping_method: z.string().min(1, 'Shipping method is required'),
  origin: z.string().min(1, 'Origin is required'),
  destination: z.string().min(1, 'Destination is required'),
  shipment_date: z.string().min(1, 'Shipment date is required'),
  estimated_delivery: z.string().min(1, 'Estimated delivery is required'),
  quantity: z.coerce.number().min(1, 'Quantity must be at least 1'),
  notes: z.string().optional(),
});

type ShipmentFormData = z.infer<typeof shipmentSchema>;

export default function ShipmentsPage() {
  const { can } = useAuth();
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [styles, setStyles] = useState<Style[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
  } = useForm<ShipmentFormData>({
    resolver: zodResolver(shipmentSchema),
    defaultValues: {
      shipment_date: new Date().toISOString().split('T')[0],
      estimated_delivery: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    },
  });

  useEffect(() => {
    fetchShipments();
    fetchStyles();
  }, [searchTerm, statusFilter]);

  const fetchShipments = async () => {
    try {
      setLoading(true);
      const params: any = {};

      if (searchTerm) {
        params.search = searchTerm;
      }

      if (statusFilter !== 'all') {
        params.status = statusFilter;
      }

      const response = await api.get('/shipments', { params });
      setShipments(response.data.shipments || response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch shipments:', error);
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

  const onSubmit = async (data: ShipmentFormData) => {
    setIsSubmitting(true);
    try {
      await api.post('/shipments', data);
      setIsCreateDialogOpen(false);
      reset({
        shipment_date: new Date().toISOString().split('T')[0],
        estimated_delivery: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      });
      fetchShipments();
    } catch (error) {
      console.error('Failed to create shipment:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateStatus = async (id: number, newStatus: string) => {
    try {
      await api.patch(`/shipments/${id}/status`, { status: newStatus });
      fetchShipments();
    } catch (error) {
      console.error('Failed to update shipment status:', error);
    }
  };

  const copyTrackingLink = (token: string) => {
    const link = `${window.location.origin}/track/${token}`;
    navigator.clipboard.writeText(link);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'secondary',
      in_transit: 'default',
      out_for_delivery: 'default',
      delivered: 'default',
      delayed: 'destructive',
      cancelled: 'destructive',
    };
    return colors[status] || 'secondary';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getDaysRemaining = (estimatedDelivery: string) => {
    const today = new Date();
    const delivery = new Date(estimatedDelivery);
    const diffTime = delivery.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const carriers = ['DHL', 'FedEx', 'UPS', 'USPS', 'Maersk', 'MSC', 'CMA CGM', 'Other'];
  const shippingMethods = ['Air Freight', 'Sea Freight', 'Express', 'Ground', 'Rail'];

  return (
    <DashboardLayout requiredPermissions={['shipment.view', 'shipment.view_own', 'shipment.view_all', 'shipment.create', 'shipment.update', 'shipment.track']} requireAll={false}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Shipments</h1>
            <p className="text-muted-foreground">Track and manage shipments with public tracking</p>
          </div>
          {can('shipment.create') && (
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  New Shipment
                </Button>
              </DialogTrigger>
            <DialogContent className="max-w-3xl">
              <form onSubmit={handleSubmit(onSubmit)}>
                <DialogHeader>
                  <DialogTitle>Create Shipment</DialogTitle>
                  <DialogDescription>
                    Create a new shipment with tracking information
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
                  <div className="space-y-2">
                    <Label htmlFor="style_id">Style *</Label>
                    <Select onValueChange={(value) => setValue('style_id', parseInt(value))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select style" />
                      </SelectTrigger>
                      <SelectContent>
                        {styles.map((style) => (
                          <SelectItem key={style.id} value={style.id.toString()}>
                            {style.style_number} - {style.purchase_orders?.[0]?.po_number} ({style.quantity} pcs)
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
                      <Label htmlFor="tracking_number">Tracking Number *</Label>
                      <Input
                        id="tracking_number"
                        placeholder="TRK123456789"
                        {...register('tracking_number')}
                      />
                      {errors.tracking_number && (
                        <p className="text-sm text-destructive">{errors.tracking_number.message}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="carrier">Carrier *</Label>
                      <Select onValueChange={(value) => setValue('carrier', value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select carrier" />
                        </SelectTrigger>
                        <SelectContent>
                          {carriers.map((carrier) => (
                            <SelectItem key={carrier} value={carrier}>
                              {carrier}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {errors.carrier && (
                        <p className="text-sm text-destructive">{errors.carrier.message}</p>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="shipping_method">Shipping Method *</Label>
                      <Select onValueChange={(value) => setValue('shipping_method', value)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select method" />
                        </SelectTrigger>
                        <SelectContent>
                          {shippingMethods.map((method) => (
                            <SelectItem key={method} value={method}>
                              {method}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {errors.shipping_method && (
                        <p className="text-sm text-destructive">{errors.shipping_method.message}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="quantity">Quantity *</Label>
                      <Input
                        id="quantity"
                        type="number"
                        placeholder="1000"
                        {...register('quantity')}
                      />
                      {errors.quantity && (
                        <p className="text-sm text-destructive">{errors.quantity.message}</p>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="origin">Origin *</Label>
                      <Input
                        id="origin"
                        placeholder="Dhaka, Bangladesh"
                        {...register('origin')}
                      />
                      {errors.origin && (
                        <p className="text-sm text-destructive">{errors.origin.message}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="destination">Destination *</Label>
                      <Input
                        id="destination"
                        placeholder="New York, USA"
                        {...register('destination')}
                      />
                      {errors.destination && (
                        <p className="text-sm text-destructive">{errors.destination.message}</p>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="shipment_date">Shipment Date *</Label>
                      <Input
                        id="shipment_date"
                        type="date"
                        {...register('shipment_date')}
                      />
                      {errors.shipment_date && (
                        <p className="text-sm text-destructive">{errors.shipment_date.message}</p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="estimated_delivery">Estimated Delivery *</Label>
                      <Input
                        id="estimated_delivery"
                        type="date"
                        {...register('estimated_delivery')}
                      />
                      {errors.estimated_delivery && (
                        <p className="text-sm text-destructive">{errors.estimated_delivery.message}</p>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="notes">Notes</Label>
                    <textarea
                      id="notes"
                      className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      placeholder="Additional shipment details..."
                      {...register('notes')}
                    />
                  </div>
                  <div className="rounded-lg bg-muted p-3 text-sm">
                    <p className="font-medium">Public Tracking</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      A unique tracking link will be generated automatically for public tracking without authentication.
                    </p>
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
                        <Truck className="mr-2 h-4 w-4" />
                        Create Shipment
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
              <CardTitle className="text-sm font-medium">Total Shipments</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{shipments.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">In Transit</CardTitle>
              <Truck className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {shipments.filter(s => s.status === 'in_transit').length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Delivered</CardTitle>
              <MapPin className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {shipments.filter(s => s.status === 'delivered').length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Pending</CardTitle>
              <Calendar className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">
                {shipments.filter(s => s.status === 'pending').length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
            <CardDescription>Search and filter shipments</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by tracking number, style..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="in_transit">In Transit</SelectItem>
                  <SelectItem value="out_for_delivery">Out for Delivery</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                  <SelectItem value="delayed">Delayed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            {loading ? (
              <TableSkeleton columns={10} rows={5} hasHeader={false} />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tracking #</TableHead>
                    <TableHead>Style</TableHead>
                    <TableHead>PO Number</TableHead>
                    <TableHead>Carrier</TableHead>
                    <TableHead>Route</TableHead>
                    <TableHead>Shipment Date</TableHead>
                    <TableHead>Est. Delivery</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shipments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center text-muted-foreground">
                        No shipments found
                      </TableCell>
                    </TableRow>
                  ) : (
                    shipments.map((shipment) => {
                      const daysRemaining = getDaysRemaining(shipment.estimated_delivery);
                      return (
                        <TableRow key={shipment.id}>
                          <TableCell className="font-medium">{shipment.tracking_number}</TableCell>
                          <TableCell>{shipment.style?.style_number}</TableCell>
                          <TableCell>{shipment.style?.purchase_orders?.[0]?.po_number || 'N/A'}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{shipment.carrier}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="text-xs">
                              <div className="font-medium">{shipment.origin}</div>
                              <div className="text-muted-foreground">→ {shipment.destination}</div>
                            </div>
                          </TableCell>
                          <TableCell>{formatDate(shipment.shipment_date)}</TableCell>
                          <TableCell>
                            <div className="text-xs">
                              <div>{formatDate(shipment.estimated_delivery)}</div>
                              {shipment.status !== 'delivered' && daysRemaining >= 0 && (
                                <div className="text-muted-foreground">
                                  {daysRemaining === 0 ? 'Today' : `${daysRemaining} days`}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {can('shipment.update') ? (
                              <Select
                                value={shipment.status}
                                onValueChange={(value) => handleUpdateStatus(shipment.id, value)}
                              >
                                <SelectTrigger className="w-[150px]">
                                  <Badge variant={getStatusColor(shipment.status) as any}>
                                    {shipment.status.replace('_', ' ')}
                                  </Badge>
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="pending">Pending</SelectItem>
                                  <SelectItem value="in_transit">In Transit</SelectItem>
                                  <SelectItem value="out_for_delivery">Out for Delivery</SelectItem>
                                  <SelectItem value="delivered">Delivered</SelectItem>
                                  <SelectItem value="delayed">Delayed</SelectItem>
                                </SelectContent>
                              </Select>
                            ) : (
                              <Badge variant={getStatusColor(shipment.status) as any}>
                                {shipment.status.replace('_', ' ')}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">{shipment.quantity?.toLocaleString() || '-'}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => copyTrackingLink(shipment.tracking_token)}
                                title="Copy public tracking link"
                              >
                                {copiedToken === shipment.tracking_token ? (
                                  <Check className="h-4 w-4 text-green-500" />
                                ) : (
                                  <Copy className="h-4 w-4" />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => window.open(`/track/${shipment.tracking_token}`, '_blank')}
                                title="View public tracking page"
                              >
                                <ExternalLink className="h-4 w-4" />
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
      </div>
    </DashboardLayout>
  );
}
