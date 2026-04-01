'use client';

// Disable static generation for this authenticated page
export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ShoppingCart,
  Package,
  ClipboardCheck,
  Truck,
  TrendingUp,
  TrendingDown,
  Activity,
  Users,
  Factory,
  PackageCheck,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import { DashboardPageSkeleton } from '@/components/skeletons';

interface RecentOrder {
  id: number;
  po_number: string;
  importer: string;
  total_value: string;
  status: string;
  order_date: string | null;
}

interface DashboardStats {
  purchase_orders: {
    total_count: number;
    total_value: number;
    total_quantity: string | number;
    by_status: Record<string, number>;
    recent_orders: RecentOrder[];
  };
  samples: {
    total_count: number;
    approved_count: number;
    rejected_count: number;
    pending_count: number;
    approval_rate: number;
    by_sample_type: any[];
  };
  production: {
    total_quantity_produced: number;
    total_quantity_rejected: number;
    total_quantity_reworked: number;
    acceptance_rate: number;
    by_stage: any[];
  };
  quality_inspections: {
    total_count: number;
    passed_count: number;
    failed_count: number;
    pass_rate: number;
    by_inspection_type: any[];
    defects: {
      total: number;
      critical: number;
      major: number;
      minor: number;
    };
  };
  shipments: {
    total_count: number;
    delivered_count: number;
    in_transit_count: number;
    delayed_count: number;
    on_time_delivery_rate: number;
    by_status: any[];
    by_method: any[];
  };
}

export default function DashboardPage() {
  const { user, can, canAny } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      const response = await api.get('/reports/dashboard');
      setStats(response.data);
    } catch (error) {
      console.error('Failed to fetch dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat('en-US').format(value);
  };

  if (loading) {
    return (
      <DashboardLayout>
        <DashboardPageSkeleton />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back, {user?.name}! Here's an overview of your supply chain.
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {/* Purchase Orders */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Purchase Orders</CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatNumber(stats?.purchase_orders.total_count || 0)}</div>
              <p className="text-xs text-muted-foreground">
                {formatNumber(stats?.purchase_orders.by_status?.confirmed || 0)} confirmed orders
              </p>
              <div className="mt-3 flex items-center gap-1 text-xs">
                <TrendingUp className="h-3 w-3 text-green-500" />
                <span className="text-green-500 font-medium">
                  {formatCurrency(stats?.purchase_orders.total_value || 0)}
                </span>
                <span className="text-muted-foreground">total value</span>
              </div>
            </CardContent>
          </Card>

          {/* Samples */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Samples</CardTitle>
              <PackageCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatNumber(stats?.samples.total_count || 0)}</div>
              <p className="text-xs text-muted-foreground">
                {formatNumber(stats?.samples.approved_count || 0)} approved
              </p>
              <div className="mt-3 flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  {formatNumber(stats?.samples.pending_count || 0)} pending
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Production */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Production</CardTitle>
              <Factory className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats?.production.acceptance_rate?.toFixed(1) || 0}%
              </div>
              <p className="text-xs text-muted-foreground">
                {formatNumber(stats?.production.total_quantity_produced || 0)} units produced
              </p>
              <div className="mt-3">
                <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full bg-primary transition-all"
                    style={{ width: `${stats?.production.acceptance_rate || 0}%` }}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quality Inspections */}
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Quality Checks</CardTitle>
              <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatNumber(stats?.quality_inspections.total_count || 0)}</div>
              <p className="text-xs text-muted-foreground">
                {formatNumber(stats?.quality_inspections.passed_count || 0)} passed
              </p>
              <div className="mt-3 flex items-center gap-2">
                {stats?.quality_inspections.failed_count ? (
                  <Badge variant="destructive" className="text-xs">
                    {formatNumber(stats.quality_inspections.failed_count)} failed
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-xs">
                    All passed
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Secondary Stats */}
        <div className="grid gap-4 md:grid-cols-2">
          {/* Shipments Overview */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Shipments</CardTitle>
                  <CardDescription>Current shipment status</CardDescription>
                </div>
                <Truck className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Total Shipments</span>
                  <span className="text-2xl font-bold">{formatNumber(stats?.shipments.total_count || 0)}</span>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">In Transit</span>
                    <Badge variant="default">{formatNumber(stats?.shipments.in_transit_count || 0)}</Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Delivered</span>
                    <Badge variant="secondary">{formatNumber(stats?.shipments.delivered_count || 0)}</Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Delayed</span>
                    <Badge variant="outline">{formatNumber(stats?.shipments.delayed_count || 0)}</Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Recent Activity</CardTitle>
                  <CardDescription>Latest purchase orders</CardDescription>
                </div>
                <Activity className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {stats?.purchase_orders.recent_orders && stats.purchase_orders.recent_orders.length > 0 ? (
                  stats.purchase_orders.recent_orders.slice(0, 3).map((order) => (
                    <div key={order.id} className="flex items-start gap-3">
                      <div className="mt-0.5 rounded-full bg-primary/10 p-2">
                        <ShoppingCart className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{order.po_number}</p>
                        <p className="text-xs text-muted-foreground">
                          {order.importer} • {formatCurrency(parseFloat(order.total_value))}
                        </p>
                        <div className="mt-1 flex items-center gap-2">
                          <Badge
                            variant={
                              order.status === 'confirmed' ? 'default' :
                              order.status === 'completed' ? 'secondary' :
                              'outline'
                            }
                            className="text-xs"
                          >
                            {order.status}
                          </Badge>
                          {order.order_date && (
                            <p className="text-xs text-muted-foreground">{order.order_date}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="flex h-32 items-center justify-center">
                    <p className="text-sm text-muted-foreground">No recent purchase orders</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common tasks you can perform</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {can('po.create') && (
                <Link href="/purchase-orders" className="flex items-center gap-2 rounded-lg border p-3 text-left transition-colors hover:bg-accent">
                  <ShoppingCart className="h-5 w-5 text-primary" />
                  <span className="text-sm font-medium">Create PO</span>
                </Link>
              )}
              {can('invitation.send') && (
                <Link href="/invitations" className="flex items-center gap-2 rounded-lg border p-3 text-left transition-colors hover:bg-accent">
                  <Users className="h-5 w-5 text-primary" />
                  <span className="text-sm font-medium">Send Invitation</span>
                </Link>
              )}
              {can('quality.create_inspection') && (
                <Link href="/quality-inspections" className="flex items-center gap-2 rounded-lg border p-3 text-left transition-colors hover:bg-accent">
                  <ClipboardCheck className="h-5 w-5 text-primary" />
                  <span className="text-sm font-medium">Schedule QC</span>
                </Link>
              )}
              {canAny(['shipment.view', 'shipment.view_own', 'shipment.track']) && (
                <Link href="/shipments" className="flex items-center gap-2 rounded-lg border p-3 text-left transition-colors hover:bg-accent">
                  <Truck className="h-5 w-5 text-primary" />
                  <span className="text-sm font-medium">Track Shipment</span>
                </Link>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
