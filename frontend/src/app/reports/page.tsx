'use client';

import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  FileDown,
  Loader2,
  BarChart3,
  TrendingUp,
  DollarSign,
  Package,
  ClipboardCheck,
  Factory,
  Truck,
  Calendar,
} from 'lucide-react';
import api from '@/lib/api';

interface DashboardStats {
  purchase_orders: {
    total: number;
    active: number;
    completed: number;
    total_value: number;
  };
  samples: {
    total: number;
    approved: number;
    rejected: number;
    pending: number;
  };
  production: {
    active_orders: number;
    completion_percentage: number;
  };
  quality_inspections: {
    total: number;
    passed: number;
    failed: number;
  };
  shipments: {
    total: number;
    in_transit: number;
    delivered: number;
  };
}

export default function ReportsPage() {
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<string | null>(null);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    // Set default date range to last 30 days
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);

    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
  }, []);

  useEffect(() => {
    if (startDate && endDate) {
      fetchDashboardStats();
    }
  }, [startDate, endDate]);

  const fetchDashboardStats = async () => {
    try {
      setLoading(true);
      const response = await api.get('/reports/dashboard', {
        params: {
          start_date: startDate,
          end_date: endDate,
        },
      });
      setDashboardStats(response.data);
    } catch (error) {
      console.error('Failed to fetch dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (reportType: string) => {
    setExporting(reportType);
    try {
      const response = await api.get(`/reports/${reportType}`, {
        params: {
          start_date: startDate,
          end_date: endDate,
          format: 'csv',
        },
        responseType: 'blob',
      });

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${reportType}_${startDate}_${endDate}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error(`Failed to export ${reportType}:`, error);
    } finally {
      setExporting(null);
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

  return (
    <DashboardLayout requiredPermissions={['reports.view']}>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reports & Analytics</h1>
          <p className="text-muted-foreground">Generate comprehensive reports and export data</p>
        </div>

        {/* Date Range Filter */}
        <Card>
          <CardHeader>
            <CardTitle>Report Parameters</CardTitle>
            <CardDescription>Select date range for reports</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="start_date">Start Date</Label>
                <Input
                  id="start_date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end_date">End Date</Label>
                <Input
                  id="end_date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
              <div className="flex items-end">
                <Button onClick={fetchDashboardStats} className="w-full">
                  <BarChart3 className="mr-2 h-4 w-4" />
                  Generate Report
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary Statistics */}
        {loading ? (
          <div className="flex h-96 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : dashboardStats ? (
          <>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Purchase Orders</CardTitle>
                  <Package className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{dashboardStats.purchase_orders.total}</div>
                  <p className="text-xs text-muted-foreground">
                    {formatCurrency(dashboardStats.purchase_orders.total_value)} total value
                  </p>
                  <div className="mt-2 flex gap-2">
                    <Badge variant="default">{dashboardStats.purchase_orders.active} active</Badge>
                    <Badge variant="secondary">{dashboardStats.purchase_orders.completed} completed</Badge>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Samples</CardTitle>
                  <ClipboardCheck className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{dashboardStats.samples.total}</div>
                  <p className="text-xs text-muted-foreground">
                    {dashboardStats.samples.total > 0
                      ? ((dashboardStats.samples.approved / dashboardStats.samples.total) * 100).toFixed(1)
                      : 0}% approval rate
                  </p>
                  <div className="mt-2 flex gap-2">
                    <Badge variant="default">{dashboardStats.samples.approved} approved</Badge>
                    <Badge variant="destructive">{dashboardStats.samples.rejected} rejected</Badge>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Production</CardTitle>
                  <Factory className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {dashboardStats.production.completion_percentage?.toFixed(1) || 0}%
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {dashboardStats.production.active_orders} active orders
                  </p>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${dashboardStats.production.completion_percentage || 0}%` }}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Quality & Shipments</CardTitle>
                  <Truck className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">QC Pass Rate:</span>
                      <span className="font-bold">
                        {dashboardStats.quality_inspections.total > 0
                          ? ((dashboardStats.quality_inspections.passed / dashboardStats.quality_inspections.total) * 100).toFixed(1)
                          : 0}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Delivered:</span>
                      <span className="font-bold">{dashboardStats.shipments.delivered}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">In Transit:</span>
                      <span className="font-bold">{dashboardStats.shipments.in_transit}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Report Tabs */}
            <Tabs defaultValue="overview" className="space-y-4">
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="purchase-orders">Purchase Orders</TabsTrigger>
                <TabsTrigger value="samples">Samples</TabsTrigger>
                <TabsTrigger value="production">Production</TabsTrigger>
                <TabsTrigger value="quality">Quality</TabsTrigger>
                <TabsTrigger value="shipments">Shipments</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Executive Summary</CardTitle>
                    <CardDescription>Key metrics and performance indicators</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <h4 className="text-sm font-semibold flex items-center gap-2">
                          <DollarSign className="h-4 w-4" />
                          Financial Overview
                        </h4>
                        <div className="rounded-lg border p-4 space-y-2">
                          <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">Total Order Value:</span>
                            <span className="text-sm font-bold">
                              {formatCurrency(dashboardStats.purchase_orders.total_value)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">Active Orders:</span>
                            <span className="text-sm font-bold">{dashboardStats.purchase_orders.active}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">Completed Orders:</span>
                            <span className="text-sm font-bold">{dashboardStats.purchase_orders.completed}</span>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <h4 className="text-sm font-semibold flex items-center gap-2">
                          <TrendingUp className="h-4 w-4" />
                          Performance Metrics
                        </h4>
                        <div className="rounded-lg border p-4 space-y-2">
                          <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">Sample Approval Rate:</span>
                            <span className="text-sm font-bold text-green-600">
                              {dashboardStats.samples.total > 0
                                ? ((dashboardStats.samples.approved / dashboardStats.samples.total) * 100).toFixed(1)
                                : 0}%
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">QC Pass Rate:</span>
                            <span className="text-sm font-bold text-green-600">
                              {dashboardStats.quality_inspections.total > 0
                                ? ((dashboardStats.quality_inspections.passed / dashboardStats.quality_inspections.total) * 100).toFixed(1)
                                : 0}%
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">Production Progress:</span>
                            <span className="text-sm font-bold text-blue-600">
                              {dashboardStats.production.completion_percentage?.toFixed(1) || 0}%
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="purchase-orders" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Purchase Orders Report</CardTitle>
                    <CardDescription>
                      Detailed purchase order analysis for the selected period
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="grid gap-4 md:grid-cols-3">
                        <div className="rounded-lg border p-4">
                          <p className="text-sm text-muted-foreground">Total Orders</p>
                          <p className="text-2xl font-bold">{dashboardStats.purchase_orders.total}</p>
                        </div>
                        <div className="rounded-lg border p-4">
                          <p className="text-sm text-muted-foreground">Active Orders</p>
                          <p className="text-2xl font-bold text-blue-600">
                            {dashboardStats.purchase_orders.active}
                          </p>
                        </div>
                        <div className="rounded-lg border p-4">
                          <p className="text-sm text-muted-foreground">Total Value</p>
                          <p className="text-2xl font-bold text-green-600">
                            {formatCurrency(dashboardStats.purchase_orders.total_value)}
                          </p>
                        </div>
                      </div>
                      <Button
                        onClick={() => handleExport('purchase-orders')}
                        disabled={exporting === 'purchase-orders'}
                        className="w-full"
                      >
                        {exporting === 'purchase-orders' ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Exporting...
                          </>
                        ) : (
                          <>
                            <FileDown className="mr-2 h-4 w-4" />
                            Export to CSV
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="samples" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Samples Report</CardTitle>
                    <CardDescription>
                      Sample submission and approval analysis
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="grid gap-4 md:grid-cols-4">
                        <div className="rounded-lg border p-4">
                          <p className="text-sm text-muted-foreground">Total Samples</p>
                          <p className="text-2xl font-bold">{dashboardStats.samples.total}</p>
                        </div>
                        <div className="rounded-lg border p-4">
                          <p className="text-sm text-muted-foreground">Approved</p>
                          <p className="text-2xl font-bold text-green-600">
                            {dashboardStats.samples.approved}
                          </p>
                        </div>
                        <div className="rounded-lg border p-4">
                          <p className="text-sm text-muted-foreground">Rejected</p>
                          <p className="text-2xl font-bold text-red-600">
                            {dashboardStats.samples.rejected}
                          </p>
                        </div>
                        <div className="rounded-lg border p-4">
                          <p className="text-sm text-muted-foreground">Pending</p>
                          <p className="text-2xl font-bold text-yellow-600">
                            {dashboardStats.samples.pending}
                          </p>
                        </div>
                      </div>
                      <Button
                        onClick={() => handleExport('samples')}
                        disabled={exporting === 'samples'}
                        className="w-full"
                      >
                        {exporting === 'samples' ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Exporting...
                          </>
                        ) : (
                          <>
                            <FileDown className="mr-2 h-4 w-4" />
                            Export to CSV
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="production" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Production Report</CardTitle>
                    <CardDescription>
                      Production tracking and progress analysis
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="rounded-lg border p-4">
                          <p className="text-sm text-muted-foreground">Active Orders</p>
                          <p className="text-2xl font-bold">{dashboardStats.production.active_orders}</p>
                        </div>
                        <div className="rounded-lg border p-4">
                          <p className="text-sm text-muted-foreground">Overall Progress</p>
                          <p className="text-2xl font-bold text-blue-600">
                            {dashboardStats.production.completion_percentage?.toFixed(1) || 0}%
                          </p>
                        </div>
                      </div>
                      <Button
                        onClick={() => handleExport('production')}
                        disabled={exporting === 'production'}
                        className="w-full"
                      >
                        {exporting === 'production' ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Exporting...
                          </>
                        ) : (
                          <>
                            <FileDown className="mr-2 h-4 w-4" />
                            Export to CSV
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="quality" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Quality Inspections Report</CardTitle>
                    <CardDescription>
                      Quality control and inspection results
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="grid gap-4 md:grid-cols-3">
                        <div className="rounded-lg border p-4">
                          <p className="text-sm text-muted-foreground">Total Inspections</p>
                          <p className="text-2xl font-bold">{dashboardStats.quality_inspections.total}</p>
                        </div>
                        <div className="rounded-lg border p-4">
                          <p className="text-sm text-muted-foreground">Passed</p>
                          <p className="text-2xl font-bold text-green-600">
                            {dashboardStats.quality_inspections.passed}
                          </p>
                        </div>
                        <div className="rounded-lg border p-4">
                          <p className="text-sm text-muted-foreground">Failed</p>
                          <p className="text-2xl font-bold text-red-600">
                            {dashboardStats.quality_inspections.failed}
                          </p>
                        </div>
                      </div>
                      <Button
                        onClick={() => handleExport('quality-inspections')}
                        disabled={exporting === 'quality-inspections'}
                        className="w-full"
                      >
                        {exporting === 'quality-inspections' ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Exporting...
                          </>
                        ) : (
                          <>
                            <FileDown className="mr-2 h-4 w-4" />
                            Export to CSV
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="shipments" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Shipments Report</CardTitle>
                    <CardDescription>
                      Shipping and delivery analysis
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="grid gap-4 md:grid-cols-3">
                        <div className="rounded-lg border p-4">
                          <p className="text-sm text-muted-foreground">Total Shipments</p>
                          <p className="text-2xl font-bold">{dashboardStats.shipments.total}</p>
                        </div>
                        <div className="rounded-lg border p-4">
                          <p className="text-sm text-muted-foreground">In Transit</p>
                          <p className="text-2xl font-bold text-blue-600">
                            {dashboardStats.shipments.in_transit}
                          </p>
                        </div>
                        <div className="rounded-lg border p-4">
                          <p className="text-sm text-muted-foreground">Delivered</p>
                          <p className="text-2xl font-bold text-green-600">
                            {dashboardStats.shipments.delivered}
                          </p>
                        </div>
                      </div>
                      <Button
                        onClick={() => handleExport('shipments')}
                        disabled={exporting === 'shipments'}
                        className="w-full"
                      >
                        {exporting === 'shipments' ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Exporting...
                          </>
                        ) : (
                          <>
                            <FileDown className="mr-2 h-4 w-4" />
                            Export to CSV
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        ) : (
          <Card>
            <CardContent className="flex h-96 items-center justify-center">
              <div className="text-center">
                <Calendar className="mx-auto h-12 w-12 text-muted-foreground" />
                <p className="mt-4 text-muted-foreground">Select a date range and click Generate Report</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
