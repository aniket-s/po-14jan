'use client';

import dynamic from 'next/dynamic';
import type { SpreadsheetGridProps } from './SpreadsheetGridInner';

const SpreadsheetGridInner = dynamic(() => import('./SpreadsheetGridInner'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full w-full bg-white">
      <span className="text-sm text-gray-400">Loading grid...</span>
    </div>
  ),
});

export function SpreadsheetGrid(props: SpreadsheetGridProps) {
  return <SpreadsheetGridInner {...props} />;
}
