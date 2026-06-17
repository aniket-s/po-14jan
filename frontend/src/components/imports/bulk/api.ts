import api from '@/lib/api';
import type { BulkAnalyzeResponse, BulkCommitOptions, BulkCommitReport, CommitPoPayload } from './types';

export const analyzeBulkExcel = async (file: File): Promise<BulkAnalyzeResponse> => {
  const fd = new FormData();
  fd.append('file', file);
  const { data } = await api.post('/imports/bulk-po/analyze', fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
};

export interface BulkCommitArgs {
  pos: CommitPoPayload[];
  options: BulkCommitOptions;
}

export const commitBulkImport = async (payload: BulkCommitArgs): Promise<BulkCommitReport> => {
  const { data } = await api.post('/imports/bulk-po/commit', payload);
  return data;
};
