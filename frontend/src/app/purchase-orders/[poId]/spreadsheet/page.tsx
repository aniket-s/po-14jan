'use client';

import { use } from 'react';
import { SpreadsheetView } from '@/components/spreadsheet/SpreadsheetView';

interface PageProps {
  params: Promise<{ poId: string }>;
}

export default function SpreadsheetPage({ params }: PageProps) {
  const { poId } = use(params);
  const numericId = parseInt(poId, 10);

  if (isNaN(numericId)) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-red-600">Invalid PO ID</p>
      </div>
    );
  }

  return <SpreadsheetView poId={numericId} />;
}
