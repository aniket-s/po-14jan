'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Skeleton } from '@/components/ui/skeleton';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredPermission?: string;
  requiredPermissions?: string[];
  requireAll?: boolean;
  requiredRole?: string;
  fallbackPath?: string;
}

function LayoutShellSkeleton() {
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar skeleton */}
      <div className="w-64 border-r bg-card flex flex-col">
        <div className="p-6">
          <Skeleton className="h-8 w-32" />
        </div>
        <div className="flex-1 px-3 space-y-1">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full rounded-md" />
          ))}
        </div>
      </div>
      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header skeleton */}
        <div className="h-16 border-b bg-card flex items-center justify-between px-6">
          <Skeleton className="h-5 w-48" />
          <div className="flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-8 w-8 rounded-full" />
          </div>
        </div>
        {/* Page content skeleton */}
        <main className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            <div>
              <Skeleton className="h-9 w-48 mb-2" />
              <Skeleton className="h-4 w-72" />
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-28 rounded-lg" />
              ))}
            </div>
            <Skeleton className="h-64 rounded-lg" />
          </div>
        </main>
      </div>
    </div>
  );
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredPermission,
  requiredPermissions,
  requireAll = false,
  requiredRole,
  fallbackPath = '/login',
}) => {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    // Check authentication
    if (!user) {
      router.push(fallbackPath);
      return;
    }

    // Check role if required
    if (requiredRole) {
      const hasRole = user.roles?.some(role => role.name === requiredRole) || false;
      if (!hasRole) {
        router.push('/unauthorized');
        return;
      }
    }

    // Check single permission
    if (requiredPermission) {
      const hasPermission = user.permissions?.includes(requiredPermission) || false;
      if (!hasPermission) {
        router.push('/unauthorized');
        return;
      }
    }

    // Check multiple permissions
    if (requiredPermissions && requiredPermissions.length > 0) {
      const userPermissions = user.permissions || [];
      const hasPermissions = requireAll
        ? requiredPermissions.every(perm => userPermissions.includes(perm))
        : requiredPermissions.some(perm => userPermissions.includes(perm));

      if (!hasPermissions) {
        router.push('/unauthorized');
        return;
      }
    }
  }, [user, loading, router, requiredPermission, requiredPermissions, requireAll, requiredRole, fallbackPath]);

  // Show skeleton layout shell while auth is loading
  if (loading) {
    return <LayoutShellSkeleton />;
  }

  // Show nothing if not authenticated (will redirect)
  if (!user) {
    return null;
  }

  // Render children if all checks pass
  return <>{children}</>;
};
