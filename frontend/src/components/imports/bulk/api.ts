import api from '@/lib/api';
import type { BulkAnalyzeResponse, BulkCommitOptions, BulkCommitReport, CommitPoPayload, RetailerOption } from './types';

/** Existing retailers for the resolution picker. */
export const listRetailers = async (): Promise<RetailerOption[]> => {
  const { data } = await api.get('/master-data/retailers', { params: { all: 'true' } });
  return Array.isArray(data) ? data : (data.data ?? []);
};

/** Create a retailer (mirrors manual PO creation). Returns the new retailer. */
export const createRetailer = async (name: string): Promise<RetailerOption> => {
  const { data } = await api.post('/master-data/retailers', { name });
  return (data.data ?? data) as RetailerOption;
};

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
