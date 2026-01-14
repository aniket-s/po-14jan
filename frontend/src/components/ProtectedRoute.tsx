'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredPermission?: string;
  requiredPermissions?: string[];
  requireAll?: boolean;
  requiredRole?: string;
  fallbackPath?: string;
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

  // Show loading state
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="h-32 w-32 animate-spin rounded-full border-b-2 border-t-2 border-primary"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Show nothing if not authenticated (will redirect)
  if (!user) {
    return null;
  }

  // Render children if all checks pass
  return <>{children}</>;
};
