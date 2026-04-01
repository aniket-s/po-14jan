'use client';

import { use } from 'react';
import { SpreadsheetView } from '@/components/spreadsheet/SpreadsheetView';
import { DashboardLayout } from '@/components/layout/DashboardLayout';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function SpreadsheetPage({ params }: PageProps) {
  const { id } = use(params);
  const numericId = parseInt(id, 10);

  if (isNaN(numericId)) {
    return (
      <DashboardLayout requiredPermissions={['po.view', 'po.view_all', 'po.view_own']} requireAll={false}>
        <div className="flex items-center justify-center h-screen">
          <p className="text-red-600">Invalid PO ID</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout requiredPermissions={['po.view', 'po.view_all', 'po.view_own']} requireAll={false}>
      <SpreadsheetView poId={numericId} />
    </DashboardLayout>
  );
}
