'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Package, Calendar, MapPin, Ship, CheckCircle, Clock, AlertCircle, Truck } from 'lucide-react';
import api from '@/lib/api';

interface Shipment {
  id: number;
  shipment_number: string;
  tracking_token: string;
  shipment_date: string;
  expected_delivery_date: string | null;
  actual_delivery_date: string | null;
  origin: string;
  destination: string;
  carrier: string | null;
  tracking_number: string | null;
  status: string;
  notes: string | null;
  purchase_order: {
    id: number;
    po_number: string;
    buyer_name: string | null;
    buyer_company: string | null;
  };
  styles: Array<{
    id: number;
    style_number: string;
    style_name: string;
    quantity: number;
  }>;
  status_updates: Array<{
    id: number;
    status: string;
    notes: string | null;
    created_at: string;
    updated_by?: {
      name: string;
    };
  }>;
  created_at: string;
  updated_at: string;
}

export default function PublicShipmentTrackingPage() {
  const params = useParams();
  const token = params?.token as string;
  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;

    const fetchShipmentByToken = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await api.get<{ data: Shipment }>(`/shipments/track/${token}`);
        setShipment(response.data.data);
      } catch (err: any) {
        console.error('Failed to fetch shipment:', err);
        if (err.response?.status === 404) {
          setError('Shipment not found. Please check your tracking link.');
        } else {
          setError('Failed to load shipment details. Please try again later.');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchShipmentByToken();
  }, [token]);

  // Get status badge variant
  const getStatusVariant = (status: string): 'default' | 'secondary' | 'outline' => {
    switch (status.toLowerCase()) {
      case 'delivered':
        return 'default';
      case 'in_transit':
      case 'shipped':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  // Get status icon
  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'delivered':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'in_transit':
      case 'shipped':
        return <Truck className="h-5 w-5 text-blue-600" />;
      case 'preparing':
        return <Package className="h-5 w-5 text-orange-600" />;
      case 'delayed':
        return <AlertCircle className="h-5 w-5 text-red-600" />;
      default:
        return <Clock className="h-5 w-5 text-gray-600" />;
    }
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  // Format datetime
  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading shipment details...</p>
        </div>
      </div>
    );
  }

  if (error || !shipment) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-6 w-6" />
              Tracking Error
            </CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Please verify your tracking link or contact the sender for assistance.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <Ship className="h-8 w-8 text-primary" />
            <h1 className="text-3xl md:text-4xl font-bold">Shipment Tracking</h1>
          </div>
          <p className="text-muted-foreground">
            Real-time tracking for shipment {shipment.shipment_number}
          </p>
        </div>

        {/* Main Shipment Card */}
        <Card className="border-2">
          <CardHeader className="bg-muted/50">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <CardTitle className="text-2xl">{shipment.shipment_number}</CardTitle>
                <CardDescription className="text-base mt-1">
                  PO: {shipment.purchase_order.po_number}
                </CardDescription>
              </div>
              <div className="flex items-center gap-3">
                {getStatusIcon(shipment.status)}
                <Badge variant={getStatusVariant(shipment.status)} className="text-base px-4 py-1">
                  {shipment.status.replace('_', ' ').toUpperCase()}
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid gap-6 md:grid-cols-2">
              {/* Shipment Details */}
              <div className="space-y-4">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Shipment Details
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Shipment Date:</span>
                    <span className="font-medium">{formatDate(shipment.shipment_date)}</span>
                  </div>
                  {shipment.expected_delivery_date && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Expected Delivery:</span>
                      <span className="font-medium">{formatDate(shipment.expected_delivery_date)}</span>
                    </div>
                  )}
                  {shipment.actual_delivery_date && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Actual Delivery:</span>
                      <span className="font-medium text-green-600">{formatDate(shipment.actual_delivery_date)}</span>
                    </div>
                  )}
                  {shipment.carrier && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Carrier:</span>
                      <span className="font-medium">{shipment.carrier}</span>
                    </div>
                  )}
                  {shipment.tracking_number && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Tracking Number:</span>
                      <span className="font-medium font-mono text-xs">{shipment.tracking_number}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Route Details */}
              <div className="space-y-4">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Route Details
                </h3>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-3 h-3 rounded-full bg-blue-600 mt-1"></div>
                    <div>
                      <p className="text-xs text-muted-foreground">Origin</p>
                      <p className="font-medium">{shipment.origin}</p>
                    </div>
                  </div>
                  <div className="ml-1.5 h-8 w-0.5 bg-gradient-to-b from-blue-600 to-green-600"></div>
                  <div className="flex items-start gap-3">
                    <div className="w-3 h-3 rounded-full bg-green-600 mt-1"></div>
                    <div>
                      <p className="text-xs text-muted-foreground">Destination</p>
                      <p className="font-medium">{shipment.destination}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {shipment.notes && (
              <>
                <Separator className="my-6" />
                <div>
                  <h3 className="font-semibold text-sm mb-2">Notes</h3>
                  <p className="text-sm text-muted-foreground">{shipment.notes}</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Purchase Order Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Purchase Order Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 mb-4">
              <div>
                <p className="text-sm text-muted-foreground">PO Number</p>
                <p className="font-medium">{shipment.purchase_order.po_number}</p>
              </div>
              {shipment.purchase_order.buyer_name && (
                <div>
                  <p className="text-sm text-muted-foreground">Buyer</p>
                  <p className="font-medium">{shipment.purchase_order.buyer_name}</p>
                </div>
              )}
              {shipment.purchase_order.buyer_company && (
                <div>
                  <p className="text-sm text-muted-foreground">Company</p>
                  <p className="font-medium">{shipment.purchase_order.buyer_company}</p>
                </div>
              )}
            </div>

            {shipment.styles.length > 0 && (
              <>
                <Separator className="my-4" />
                <div>
                  <h3 className="font-semibold text-sm mb-3">Items in Shipment</h3>
                  <div className="space-y-2">
                    {shipment.styles.map((style) => (
                      <div
                        key={style.id}
                        className="flex items-center justify-between p-3 border rounded-lg bg-muted/50"
                      >
                        <div>
                          <p className="font-medium">{style.style_name}</p>
                          <p className="text-xs text-muted-foreground">Style: {style.style_number}</p>
                        </div>
                        <Badge variant="secondary">{style.quantity} units</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Status Timeline */}
        {shipment.status_updates && shipment.status_updates.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Tracking History
              </CardTitle>
              <CardDescription>
                Complete timeline of shipment status updates
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {shipment.status_updates
                  .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                  .map((update, index) => (
                    <div key={update.id} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className={`w-3 h-3 rounded-full ${index === 0 ? 'bg-primary' : 'bg-muted-foreground'}`}></div>
                        {index < shipment.status_updates.length - 1 && (
                          <div className="w-0.5 h-full bg-muted-foreground/30 mt-2"></div>
                        )}
                      </div>
                      <div className="flex-1 pb-4">
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <Badge variant={getStatusVariant(update.status)}>
                            {update.status.replace('_', ' ').toUpperCase()}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {formatDateTime(update.created_at)}
                          </span>
                        </div>
                        {update.notes && (
                          <p className="text-sm text-muted-foreground mt-2">{update.notes}</p>
                        )}
                        {update.updated_by && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Updated by: {update.updated_by.name}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <div className="text-center text-sm text-muted-foreground pt-4">
          <p>
            For any questions or concerns about this shipment, please contact the sender.
          </p>
          <p className="mt-1">
            Last updated: {formatDateTime(shipment.updated_at)}
          </p>
        </div>
      </div>
    </div>
  );
}
