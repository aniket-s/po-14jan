'use client';

import { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { ProtectedRoute } from '@/components/ProtectedRoute';

interface DashboardLayoutProps {
  children: ReactNode;
  requiredPermission?: string;
  requiredPermissions?: string[];
  requireAll?: boolean;
  requiredRole?: string;
}

export function DashboardLayout({
  children,
  requiredPermission,
  requiredPermissions,
  requireAll,
  requiredRole,
}: DashboardLayoutProps) {
  return (
    <ProtectedRoute
      requiredPermission={requiredPermission}
      requiredPermissions={requiredPermissions}
      requireAll={requireAll}
      requiredRole={requiredRole}
    >
      <div className="flex h-screen overflow-hidden bg-background">
        {/* Sidebar */}
        <Sidebar />

        {/* Main Content */}
        <div className="flex flex-1 flex-col overflow-hidden pl-64">
          {/* Header */}
          <Header />

          {/* Page Content */}
          <main className="flex-1 overflow-y-auto p-6">
            {children}
          </main>
        </div>
      </div>
    </ProtectedRoute>
  );
}
