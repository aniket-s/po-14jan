<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Auth;

class ActivityLogService
{
    /**
     * Log an activity
     */
    public function log(
        string $action,
        ?string $resourceType = null,
        ?int $resourceId = null,
        string $description = '',
        ?array $metadata = null
    ): void {
        DB::table('activity_logs')->insert([
            'user_id' => Auth::id(),
            'action' => $action,
            'resource_type' => $resourceType,
            'resource_id' => $resourceId,
            'description' => $description,
            'metadata' => $metadata ? json_encode($metadata) : null,
            'ip_address' => request()->ip(),
            'user_agent' => request()->userAgent(),
            'session_id' => session()->getId(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    /**
     * Log user login
     */
    public function logLogin(int $userId): void
    {
        $this->log(
            'login',
            'User',
            $userId,
            'User logged in',
            [
                'ip' => request()->ip(),
                'user_agent' => request()->userAgent(),
            ]
        );

        // Update user's last login
        DB::table('users')
            ->where('id', $userId)
            ->update([
                'last_login_at' => now(),
                'last_login_ip' => request()->ip(),
            ]);
    }

    /**
     * Log user logout
     */
    public function logLogout(int $userId): void
    {
        $this->log(
            'logout',
            'User',
            $userId,
            'User logged out'
        );
    }

    /**
     * Log resource creation
     */
    public function logCreated(string $resourceType, int $resourceId, array $data = []): void
    {
        $this->log(
            'created',
            $resourceType,
            $resourceId,
            "Created {$resourceType}",
            ['data' => $data]
        );
    }

    /**
     * Recursively compare arrays to find differences
     * Handles nested arrays and objects properly
     */
    private function arrayDiffRecursive(array $new, array $old): array
    {
        $diff = [];

        foreach ($new as $key => $value) {
            if (!array_key_exists($key, $old)) {
                // New key added
                $diff[$key] = ['from' => null, 'to' => $value];
            } elseif (is_array($value) && is_array($old[$key])) {
                // Both values are arrays, compare recursively
                $nestedDiff = $this->arrayDiffRecursive($value, $old[$key]);
                if (!empty($nestedDiff)) {
                    $diff[$key] = $nestedDiff;
                }
            } elseif ($value !== $old[$key]) {
                // Values are different
                $diff[$key] = ['from' => $old[$key], 'to' => $value];
            }
        }

        // Check for removed keys
        foreach ($old as $key => $value) {
            if (!array_key_exists($key, $new)) {
                $diff[$key] = ['from' => $value, 'to' => null];
            }
        }

        return $diff;
    }

    /**
     * Log resource update
     */
    public function logUpdated(string $resourceType, int $resourceId, array $oldData, array $newData): void
    {
        $this->log(
            'updated',
            $resourceType,
            $resourceId,
            "Updated {$resourceType}",
            [
                'old' => $oldData,
                'new' => $newData,
                'changes' => $this->arrayDiffRecursive($newData, $oldData),
            ]
        );
    }

    /**
     * Log resource deletion
     */
    public function logDeleted(string $resourceType, int $resourceId, array $data = []): void
    {
        $this->log(
            'deleted',
            $resourceType,
            $resourceId,
            "Deleted {$resourceType}",
            ['data' => $data]
        );
    }

    /**
     * Get user activity logs
     */
    public function getUserActivity(int $userId, int $limit = 50)
    {
        return DB::table('activity_logs')
            ->where('user_id', $userId)
            ->orderBy('created_at', 'desc')
            ->limit($limit)
            ->get();
    }

    /**
     * Get resource activity logs
     */
    public function getResourceActivity(string $resourceType, int $resourceId, int $limit = 50)
    {
        return DB::table('activity_logs')
            ->where('resource_type', $resourceType)
            ->where('resource_id', $resourceId)
            ->orderBy('created_at', 'desc')
            ->limit($limit)
            ->get();
    }
}
