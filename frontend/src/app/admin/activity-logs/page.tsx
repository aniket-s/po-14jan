'use client';

import { useEffect, useState, Suspense } from 'react';

// Disable static generation for this authenticated page
export const dynamic = 'force-dynamic';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, useSearchParams } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Activity, Search, Calendar, User, FileText, Download } from 'lucide-react';
import api from '@/lib/api';
import { ListPageSkeleton } from '@/components/skeletons';

interface ActivityLog {
  id: number;
  log_name: string;
  description: string;
  subject_type: string | null;
  subject_id: number | null;
  causer_type: string | null;
  causer_id: number | null;
  properties: any;
  causer?: {
    id: number;
    name: string;
    email: string;
  };
  subject?: {
    id: number;
    type: string;
  };
  created_at: string;
}

interface PaginatedLogs {
  data: ActivityLog[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

function ActivityLogsPageContent() {
  const { user, can, loading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const userIdParam = searchParams?.get('user_id');

  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({
    currentPage: 1,
    lastPage: 1,
    perPage: 25,
    total: 0,
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [logNameFilter, setLogNameFilter] = useState<string>('all');
  const [userIdFilter, setUserIdFilter] = useState<string>(userIdParam || 'all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [logNames, setLogNames] = useState<string[]>([]);

  // Check permissions
  useEffect(() => {
    if (authLoading) return;
    if (!can('admin.activity_logs.view')) {
      router.push('/dashboard');
    }
  }, [can, router, authLoading]);

  // Fetch activity logs
  const fetchLogs = async () => {
    try {
      setLoading(true);
      const params: any = {
        page: pagination.currentPage,
        per_page: pagination.perPage,
      };

      if (searchQuery) {
        params.search = searchQuery;
      }
      if (logNameFilter !== 'all') {
        params.log_name = logNameFilter;
      }
      if (userIdFilter !== 'all') {
        params.causer_id = userIdFilter;
      }
      if (startDate) {
        params.start_date = startDate;
      }
      if (endDate) {
        params.end_date = endDate;
      }

      const response = await api.get<any>('/admin/activity-logs', { params });
      // Laravel pagination returns data at root level: {data: [...], current_page, ...}
      const logsData = response.data.data || [];

      setLogs(Array.isArray(logsData) ? logsData : []);
      setPagination({
        currentPage: response.data.current_page || 1,
        lastPage: response.data.last_page || 1,
        perPage: response.data.per_page || 25,
        total: response.data.total || 0,
      });

      // Extract unique log names for filter
      if (Array.isArray(logsData) && logsData.length > 0) {
        const uniqueLogNames = Array.from(
          new Set(logsData.map((log: ActivityLog) => log.log_name))
        );
        setLogNames(prev => {
          const combined = Array.from(new Set([...prev, ...uniqueLogNames]));
          return combined.sort();
        });
      }
    } catch (error) {
      console.error('Failed to fetch activity logs:', error);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (authLoading) return;
    fetchLogs();
  }, [pagination.currentPage, searchQuery, logNameFilter, userIdFilter, startDate, endDate]);

  // Handle export
  const handleExport = async () => {
    try {
      const params: any = {};

      if (searchQuery) params.search = searchQuery;
      if (logNameFilter !== 'all') params.log_name = logNameFilter;
      if (userIdFilter !== 'all') params.causer_id = userIdFilter;
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;
      params.format = 'csv';

      const response = await api.get('/admin/activity-logs/export', {
        params,
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `activity_logs_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Failed to export activity logs:', error);
    }
  };

  // Clear filters
  const clearFilters = () => {
    setSearchQuery('');
    setLogNameFilter('all');
    setUserIdFilter('all');
    setStartDate('');
    setEndDate('');
    setPagination({ ...pagination, currentPage: 1 });
  };

  // Get log name badge variant
  const getLogNameVariant = (logName: string): 'default' | 'secondary' | 'outline' => {
    if (logName.includes('created')) return 'default';
    if (logName.includes('updated')) return 'secondary';
    if (logName.includes('deleted')) return 'outline';
    return 'secondary';
  };

  // Format date
  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Get subject type display name
  const getSubjectTypeDisplay = (subjectType: string | null): string => {
    if (!subjectType) return '-';
    const parts = subjectType.split('\\');
    return parts[parts.length - 1];
  };

  // Format properties for display
  const formatProperties = (properties: any): string => {
    if (!properties || Object.keys(properties).length === 0) return '-';
    try {
      return JSON.stringify(properties, null, 2);
    } catch {
      return '-';
    }
  };

  if (loading && logs.length === 0) {
    return (
      <DashboardLayout requiredPermissions={['admin.activity_logs.view']} requireAll={false}>
        <ListPageSkeleton statCards={4} filterCount={4} columns={6} rows={5} />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout requiredPermissions={['admin.activity_logs.view']} requireAll={false}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Activity Logs</h1>
            <p className="text-muted-foreground mt-1">
              System-wide activity tracking and audit trail
            </p>
          </div>
          <Button onClick={handleExport} variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Logs</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pagination.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Filtered Results</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{logs.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Current Page</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {pagination.currentPage} / {pagination.lastPage}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Log Types</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{logNames.length}</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2">
                <Label>Search</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search description..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Log Type</Label>
                <Select value={logNameFilter} onValueChange={setLogNameFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    {logNames.map((name) => (
                      <SelectItem key={name} value={name}>
                        {name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Start Date</Label>
                <div className="relative">
                  <Calendar className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>End Date</Label>
                <div className="relative">
                  <Calendar className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <Button variant="outline" onClick={clearFilters}>
                Clear Filters
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Activity Logs Table */}
        <Card>
          <CardHeader>
            <CardTitle>Activity Logs</CardTitle>
            <CardDescription>
              Showing {logs.length} of {pagination.total} logs
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No activity logs found
                      </TableCell>
                    </TableRow>
                  ) : (
                    logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="text-sm">
                          {formatDateTime(log.created_at)}
                        </TableCell>
                        <TableCell>
                          {log.causer ? (
                            <div className="flex flex-col">
                              <span className="font-medium text-sm">{log.causer.name}</span>
                              <span className="text-xs text-muted-foreground">
                                {log.causer.email}
                              </span>
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">System</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={getLogNameVariant(log.log_name)}>
                            {log.log_name}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-xs">
                          <span className="text-sm">{log.description}</span>
                        </TableCell>
                        <TableCell>
                          {log.subject_type && log.subject_id ? (
                            <div className="flex flex-col">
                              <span className="text-sm font-medium">
                                {getSubjectTypeDisplay(log.subject_type)}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                ID: {log.subject_id}
                              </span>
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {log.properties && Object.keys(log.properties).length > 0 ? (
                            <details className="cursor-pointer">
                              <summary className="text-sm text-primary hover:underline">
                                View
                              </summary>
                              <pre className="text-xs bg-muted p-2 rounded mt-2 overflow-x-auto max-w-xs">
                                {formatProperties(log.properties)}
                              </pre>
                            </details>
                          ) : (
                            <span className="text-sm text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Pagination */}
            {pagination.lastPage > 1 && (
              <div className="flex items-center justify-between mt-4">
                <div className="text-sm text-muted-foreground">
                  Page {pagination.currentPage} of {pagination.lastPage}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setPagination({ ...pagination, currentPage: pagination.currentPage - 1 })
                    }
                    disabled={pagination.currentPage === 1}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setPagination({ ...pagination, currentPage: pagination.currentPage + 1 })
                    }
                    disabled={pagination.currentPage === pagination.lastPage}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card className="border-blue-200 bg-blue-50 dark:bg-blue-950 dark:border-blue-900">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              About Activity Logs
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>
              Activity logs provide a complete audit trail of all actions performed in the system.
              Each log entry records who performed the action, what was changed, and when.
            </p>
            <p>
              <strong>Common Log Types:</strong>
            </p>
            <ul className="list-disc list-inside space-y-1 ml-4">
              <li><strong>created:</strong> New record was created</li>
              <li><strong>updated:</strong> Existing record was modified</li>
              <li><strong>deleted:</strong> Record was removed from the system</li>
              <li><strong>login:</strong> User authenticated successfully</li>
              <li><strong>logout:</strong> User signed out</li>
              <li><strong>approved:</strong> Approval action taken</li>
              <li><strong>rejected:</strong> Rejection action taken</li>
            </ul>
            <p className="pt-2">
              <strong>Retention Policy:</strong> Activity logs are retained for compliance and
              auditing purposes. Use the export feature to download logs for external analysis.
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

export default function ActivityLogsPage() {
  return (
    <Suspense fallback={
      <DashboardLayout requiredPermissions={['admin.activity_logs.view']} requireAll={false}>
        <ListPageSkeleton statCards={4} filterCount={4} columns={6} rows={5} />
      </DashboardLayout>
    }>
      <ActivityLogsPageContent />
    </Suspense>
  );
}
