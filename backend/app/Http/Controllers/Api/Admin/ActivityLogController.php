<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ActivityLogController extends Controller
{
    /**
     * Get activity logs with filters and pagination
     */
    public function index(Request $request)
    {
        $query = DB::table('activity_logs')
            ->leftJoin('users', 'activity_logs.user_id', '=', 'users.id')
            ->select(
                'activity_logs.*',
                'users.name as user_name',
                'users.email as user_email'
            );

        // User filter
        if ($request->has('user_id')) {
            $query->where('activity_logs.user_id', $request->user_id);
        }

        // Action filter
        if ($request->has('action')) {
            $query->where('activity_logs.action', $request->action);
        }

        // Resource type filter
        if ($request->has('resource_type')) {
            $query->where('activity_logs.resource_type', $request->resource_type);
        }

        // Resource ID filter
        if ($request->has('resource_id')) {
            $query->where('activity_logs.resource_id', $request->resource_id);
        }

        // Date range filter
        if ($request->has('date_from')) {
            $query->where('activity_logs.created_at', '>=', $request->date_from);
        }

        if ($request->has('date_to')) {
            $query->where('activity_logs.created_at', '<=', $request->date_to);
        }

        // Search filter
        if ($request->has('search')) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('activity_logs.description', 'like', "%{$search}%")
                  ->orWhere('activity_logs.action', 'like', "%{$search}%")
                  ->orWhere('users.name', 'like', "%{$search}%")
                  ->orWhere('users.email', 'like', "%{$search}%");
            });
        }

        // IP address filter
        if ($request->has('ip_address')) {
            $query->where('activity_logs.ip_address', $request->ip_address);
        }

        // Sorting
        $sortBy = $request->get('sort_by', 'created_at');
        $sortOrder = $request->get('sort_order', 'desc');

        // Handle sorting with table prefix
        $sortColumn = $sortBy === 'user_name' ? 'users.name' : 'activity_logs.' . $sortBy;
        $query->orderBy($sortColumn, $sortOrder);

        // Pagination
        $perPage = $request->get('per_page', 50);
        $page = $request->get('page', 1);

        $total = $query->count();
        $logs = $query->skip(($page - 1) * $perPage)
            ->take($perPage)
            ->get();

        return response()->json([
            'logs' => $logs->map(function ($log) {
                return [
                    'id' => $log->id,
                    'user_id' => $log->user_id,
                    'user_name' => $log->user_name,
                    'user_email' => $log->user_email,
                    'action' => $log->action,
                    'resource_type' => $log->resource_type,
                    'resource_id' => $log->resource_id,
                    'description' => $log->description,
                    'metadata' => $log->metadata ? json_decode($log->metadata, true) : null,
                    'ip_address' => $log->ip_address,
                    'user_agent' => $log->user_agent,
                    'session_id' => $log->session_id,
                    'created_at' => $log->created_at,
                ];
            }),
            'pagination' => [
                'current_page' => (int) $page,
                'last_page' => (int) ceil($total / $perPage),
                'per_page' => (int) $perPage,
                'total' => (int) $total,
            ],
        ]);
    }

    /**
     * Get single activity log
     */
    public function show($id)
    {
        $log = DB::table('activity_logs')
            ->leftJoin('users', 'activity_logs.user_id', '=', 'users.id')
            ->select(
                'activity_logs.*',
                'users.name as user_name',
                'users.email as user_email'
            )
            ->where('activity_logs.id', $id)
            ->first();

        if (!$log) {
            return response()->json([
                'message' => 'Activity log not found',
            ], 404);
        }

        return response()->json([
            'log' => [
                'id' => $log->id,
                'user_id' => $log->user_id,
                'user_name' => $log->user_name,
                'user_email' => $log->user_email,
                'action' => $log->action,
                'resource_type' => $log->resource_type,
                'resource_id' => $log->resource_id,
                'description' => $log->description,
                'metadata' => $log->metadata ? json_decode($log->metadata, true) : null,
                'ip_address' => $log->ip_address,
                'user_agent' => $log->user_agent,
                'session_id' => $log->session_id,
                'created_at' => $log->created_at,
                'updated_at' => $log->updated_at,
            ],
        ]);
    }

    /**
     * Get activity statistics
     */
    public function statistics(Request $request)
    {
        $dateFrom = $request->get('date_from', now()->subDays(30));
        $dateTo = $request->get('date_to', now());

        // Total activities
        $totalActivities = DB::table('activity_logs')
            ->whereBetween('created_at', [$dateFrom, $dateTo])
            ->count();

        // Activities by action
        $byAction = DB::table('activity_logs')
            ->select('action', DB::raw('count(*) as count'))
            ->whereBetween('created_at', [$dateFrom, $dateTo])
            ->groupBy('action')
            ->orderBy('count', 'desc')
            ->get();

        // Activities by resource type
        $byResourceType = DB::table('activity_logs')
            ->select('resource_type', DB::raw('count(*) as count'))
            ->whereBetween('created_at', [$dateFrom, $dateTo])
            ->whereNotNull('resource_type')
            ->groupBy('resource_type')
            ->orderBy('count', 'desc')
            ->get();

        // Most active users
        $mostActiveUsers = DB::table('activity_logs')
            ->join('users', 'activity_logs.user_id', '=', 'users.id')
            ->select('users.id', 'users.name', 'users.email', DB::raw('count(*) as activities_count'))
            ->whereBetween('activity_logs.created_at', [$dateFrom, $dateTo])
            ->groupBy('users.id', 'users.name', 'users.email')
            ->orderBy('activities_count', 'desc')
            ->limit(10)
            ->get();

        // Activities timeline (daily)
        $timeline = DB::table('activity_logs')
            ->select(
                DB::raw('DATE(created_at) as date'),
                DB::raw('count(*) as count')
            )
            ->whereBetween('created_at', [$dateFrom, $dateTo])
            ->groupBy('date')
            ->orderBy('date', 'asc')
            ->get();

        // Recent critical actions
        $criticalActions = DB::table('activity_logs')
            ->leftJoin('users', 'activity_logs.user_id', '=', 'users.id')
            ->select(
                'activity_logs.*',
                'users.name as user_name',
                'users.email as user_email'
            )
            ->whereIn('activity_logs.action', ['deleted', 'permissions_synced', 'setting_updated', 'bulk_action'])
            ->whereBetween('activity_logs.created_at', [$dateFrom, $dateTo])
            ->orderBy('activity_logs.created_at', 'desc')
            ->limit(20)
            ->get();

        return response()->json([
            'statistics' => [
                'total_activities' => $totalActivities,
                'date_range' => [
                    'from' => $dateFrom,
                    'to' => $dateTo,
                ],
                'by_action' => $byAction,
                'by_resource_type' => $byResourceType,
                'most_active_users' => $mostActiveUsers,
                'timeline' => $timeline,
                'recent_critical_actions' => $criticalActions->map(function ($log) {
                    return [
                        'id' => $log->id,
                        'user_name' => $log->user_name,
                        'user_email' => $log->user_email,
                        'action' => $log->action,
                        'resource_type' => $log->resource_type,
                        'description' => $log->description,
                        'created_at' => $log->created_at,
                    ];
                }),
            ],
        ]);
    }

    /**
     * Get available actions
     */
    public function actions()
    {
        $actions = DB::table('activity_logs')
            ->select('action')
            ->distinct()
            ->orderBy('action')
            ->pluck('action');

        return response()->json([
            'actions' => $actions,
        ]);
    }

    /**
     * Get available resource types
     */
    public function resourceTypes()
    {
        $resourceTypes = DB::table('activity_logs')
            ->select('resource_type')
            ->whereNotNull('resource_type')
            ->distinct()
            ->orderBy('resource_type')
            ->pluck('resource_type');

        return response()->json([
            'resource_types' => $resourceTypes,
        ]);
    }

    /**
     * Export activity logs (returns data for export)
     */
    public function export(Request $request)
    {
        $format = $request->input('format', 'json');

        $query = DB::table('activity_logs')
            ->leftJoin('users', 'activity_logs.user_id', '=', 'users.id')
            ->select(
                'activity_logs.id',
                'users.name as user_name',
                'users.email as user_email',
                'activity_logs.action',
                'activity_logs.resource_type',
                'activity_logs.resource_id',
                'activity_logs.description',
                'activity_logs.ip_address',
                'activity_logs.created_at'
            );

        // Apply same filters as index method
        if ($request->has('user_id')) {
            $query->where('activity_logs.user_id', $request->user_id);
        }

        if ($request->has('action')) {
            $query->where('activity_logs.action', $request->action);
        }

        if ($request->has('resource_type')) {
            $query->where('activity_logs.resource_type', $request->resource_type);
        }

        if ($request->has('date_from')) {
            $query->where('activity_logs.created_at', '>=', $request->date_from);
        }

        if ($request->has('date_to')) {
            $query->where('activity_logs.created_at', '<=', $request->date_to);
        }

        $logs = $query->orderBy('activity_logs.created_at', 'desc')
            ->limit(10000) // Limit export to 10k records
            ->get();

        if ($format === 'csv') {
            return $this->exportToCsv($logs);
        }

        return response()->json([
            'data' => $logs,
            'total' => $logs->count(),
        ]);
    }

    /**
     * Get user activity timeline
     */
    public function userTimeline(Request $request, $userId)
    {
        $dateFrom = $request->get('date_from', now()->subDays(30));
        $dateTo = $request->get('date_to', now());

        // User's activities
        $activities = DB::table('activity_logs')
            ->where('user_id', $userId)
            ->whereBetween('created_at', [$dateFrom, $dateTo])
            ->orderBy('created_at', 'desc')
            ->limit(100)
            ->get();

        // Activity count by action
        $byAction = DB::table('activity_logs')
            ->select('action', DB::raw('count(*) as count'))
            ->where('user_id', $userId)
            ->whereBetween('created_at', [$dateFrom, $dateTo])
            ->groupBy('action')
            ->orderBy('count', 'desc')
            ->get();

        // Daily activity timeline
        $timeline = DB::table('activity_logs')
            ->select(
                DB::raw('DATE(created_at) as date'),
                DB::raw('count(*) as count')
            )
            ->where('user_id', $userId)
            ->whereBetween('created_at', [$dateFrom, $dateTo])
            ->groupBy('date')
            ->orderBy('date', 'asc')
            ->get();

        // User info
        $user = DB::table('users')
            ->select('id', 'name', 'email')
            ->where('id', $userId)
            ->first();

        return response()->json([
            'user' => $user,
            'date_range' => [
                'from' => $dateFrom,
                'to' => $dateTo,
            ],
            'activities' => $activities,
            'by_action' => $byAction,
            'timeline' => $timeline,
            'total_activities' => $activities->count(),
        ]);
    }

    /**
     * Get resource activity history
     */
    public function resourceHistory(Request $request, $resourceType, $resourceId)
    {
        $logs = DB::table('activity_logs')
            ->leftJoin('users', 'activity_logs.user_id', '=', 'users.id')
            ->select(
                'activity_logs.*',
                'users.name as user_name',
                'users.email as user_email'
            )
            ->where('activity_logs.resource_type', $resourceType)
            ->where('activity_logs.resource_id', $resourceId)
            ->orderBy('activity_logs.created_at', 'desc')
            ->get();

        return response()->json([
            'resource_type' => $resourceType,
            'resource_id' => $resourceId,
            'total_activities' => $logs->count(),
            'logs' => $logs->map(function ($log) {
                return [
                    'id' => $log->id,
                    'user_name' => $log->user_name,
                    'user_email' => $log->user_email,
                    'action' => $log->action,
                    'description' => $log->description,
                    'metadata' => $log->metadata ? json_decode($log->metadata, true) : null,
                    'ip_address' => $log->ip_address,
                    'created_at' => $log->created_at,
                ];
            }),
        ]);
    }

    /**
     * Get activity heatmap data
     */
    public function heatmap(Request $request)
    {
        $dateFrom = $request->get('date_from', now()->subDays(90));
        $dateTo = $request->get('date_to', now());

        // Activities by hour of day
        $byHour = DB::table('activity_logs')
            ->select(
                DB::raw('HOUR(created_at) as hour'),
                DB::raw('count(*) as count')
            )
            ->whereBetween('created_at', [$dateFrom, $dateTo])
            ->groupBy('hour')
            ->orderBy('hour')
            ->get();

        // Activities by day of week
        $byDayOfWeek = DB::table('activity_logs')
            ->select(
                DB::raw('DAYOFWEEK(created_at) as day_of_week'),
                DB::raw('count(*) as count')
            )
            ->whereBetween('created_at', [$dateFrom, $dateTo])
            ->groupBy('day_of_week')
            ->orderBy('day_of_week')
            ->get();

        // Activities by date and hour (for detailed heatmap)
        $detailedHeatmap = DB::table('activity_logs')
            ->select(
                DB::raw('DATE(created_at) as date'),
                DB::raw('HOUR(created_at) as hour'),
                DB::raw('count(*) as count')
            )
            ->whereBetween('created_at', [$dateFrom, $dateTo])
            ->groupBy('date', 'hour')
            ->orderBy('date')
            ->orderBy('hour')
            ->get();

        return response()->json([
            'date_range' => [
                'from' => $dateFrom,
                'to' => $dateTo,
            ],
            'by_hour' => $byHour,
            'by_day_of_week' => $byDayOfWeek,
            'detailed_heatmap' => $detailedHeatmap,
        ]);
    }

    /**
     * Get security audit logs (failed logins, permission changes, etc.)
     */
    public function securityAudit(Request $request)
    {
        $dateFrom = $request->get('date_from', now()->subDays(30));
        $dateTo = $request->get('date_to', now());

        // Failed login attempts
        $failedLogins = DB::table('activity_logs')
            ->leftJoin('users', 'activity_logs.user_id', '=', 'users.id')
            ->select(
                'activity_logs.*',
                'users.name as user_name',
                'users.email as user_email'
            )
            ->where('activity_logs.action', 'login_failed')
            ->whereBetween('activity_logs.created_at', [$dateFrom, $dateTo])
            ->orderBy('activity_logs.created_at', 'desc')
            ->limit(50)
            ->get();

        // Permission changes
        $permissionChanges = DB::table('activity_logs')
            ->leftJoin('users', 'activity_logs.user_id', '=', 'users.id')
            ->select(
                'activity_logs.*',
                'users.name as user_name',
                'users.email as user_email'
            )
            ->whereIn('activity_logs.action', ['permissions_synced', 'role_assigned', 'role_removed'])
            ->whereBetween('activity_logs.created_at', [$dateFrom, $dateTo])
            ->orderBy('activity_logs.created_at', 'desc')
            ->limit(50)
            ->get();

        // User deletions
        $userDeletions = DB::table('activity_logs')
            ->leftJoin('users', 'activity_logs.user_id', '=', 'users.id')
            ->select(
                'activity_logs.*',
                'users.name as user_name',
                'users.email as user_email'
            )
            ->where('activity_logs.action', 'deleted')
            ->where('activity_logs.resource_type', 'User')
            ->whereBetween('activity_logs.created_at', [$dateFrom, $dateTo])
            ->orderBy('activity_logs.created_at', 'desc')
            ->get();

        // Bulk actions
        $bulkActions = DB::table('activity_logs')
            ->leftJoin('users', 'activity_logs.user_id', '=', 'users.id')
            ->select(
                'activity_logs.*',
                'users.name as user_name',
                'users.email as user_email'
            )
            ->where('activity_logs.action', 'bulk_action')
            ->whereBetween('activity_logs.created_at', [$dateFrom, $dateTo])
            ->orderBy('activity_logs.created_at', 'desc')
            ->limit(50)
            ->get();

        // Suspicious IP addresses (multiple failed logins)
        $suspiciousIPs = DB::table('activity_logs')
            ->select('ip_address', DB::raw('count(*) as failed_attempts'))
            ->where('action', 'login_failed')
            ->whereBetween('created_at', [$dateFrom, $dateTo])
            ->whereNotNull('ip_address')
            ->groupBy('ip_address')
            ->having('failed_attempts', '>', 5)
            ->orderBy('failed_attempts', 'desc')
            ->get();

        return response()->json([
            'date_range' => [
                'from' => $dateFrom,
                'to' => $dateTo,
            ],
            'failed_logins' => $failedLogins->map(function ($log) {
                return [
                    'id' => $log->id,
                    'user_name' => $log->user_name,
                    'user_email' => $log->user_email,
                    'ip_address' => $log->ip_address,
                    'user_agent' => $log->user_agent,
                    'created_at' => $log->created_at,
                ];
            }),
            'permission_changes' => $permissionChanges->map(function ($log) {
                return [
                    'id' => $log->id,
                    'user_name' => $log->user_name,
                    'action' => $log->action,
                    'description' => $log->description,
                    'metadata' => $log->metadata ? json_decode($log->metadata, true) : null,
                    'created_at' => $log->created_at,
                ];
            }),
            'user_deletions' => $userDeletions->map(function ($log) {
                return [
                    'id' => $log->id,
                    'deleted_by' => $log->user_name,
                    'description' => $log->description,
                    'created_at' => $log->created_at,
                ];
            }),
            'bulk_actions' => $bulkActions->map(function ($log) {
                return [
                    'id' => $log->id,
                    'user_name' => $log->user_name,
                    'description' => $log->description,
                    'metadata' => $log->metadata ? json_decode($log->metadata, true) : null,
                    'created_at' => $log->created_at,
                ];
            }),
            'suspicious_ips' => $suspiciousIPs,
            'summary' => [
                'total_failed_logins' => $failedLogins->count(),
                'total_permission_changes' => $permissionChanges->count(),
                'total_user_deletions' => $userDeletions->count(),
                'total_bulk_actions' => $bulkActions->count(),
                'suspicious_ip_count' => $suspiciousIPs->count(),
            ],
        ]);
    }

    /**
     * Export logs to CSV
     */
    private function exportToCsv($data)
    {
        $filename = 'activity_logs_' . now()->format('Y-m-d_His') . '.csv';

        $headers = [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => "attachment; filename=\"{$filename}\"",
            'Cache-Control' => 'no-cache, no-store, must-revalidate',
            'Pragma' => 'no-cache',
            'Expires' => '0',
        ];

        $callback = function () use ($data) {
            $file = fopen('php://output', 'w');

            // Write CSV headers
            fputcsv($file, [
                'ID',
                'User Name',
                'User Email',
                'Action',
                'Resource Type',
                'Resource ID',
                'Description',
                'IP Address',
                'Created At',
            ]);

            // Write rows
            foreach ($data as $row) {
                fputcsv($file, [
                    $row->id,
                    $row->user_name,
                    $row->user_email,
                    $row->action,
                    $row->resource_type,
                    $row->resource_id,
                    $row->description,
                    $row->ip_address,
                    $row->created_at,
                ]);
            }

            fclose($file);
        };

        return response()->stream($callback, 200, $headers);
    }
}
