import api from '@/lib/api';
import type { AnalyzeResponse, BuySheetSummary, ImportStrategy } from './types';

export const fetchImportStrategies = async (): Promise<ImportStrategy[]> => {
  const { data } = await api.get('/imports/strategies');
  return data.strategies;
};

export const fetchBuySheetsForBuyer = async (buyerId: number, search = ''): Promise<BuySheetSummary[]> => {
  const { data } = await api.get('/imports/buy-sheets', {
    params: { buyer_id: buyerId, search },
  });
  return data.buy_sheets;
};

export interface AnalyzeArgs {
  strategyKey: string;
  buyerId: number | null;
  buySheetId: number | null;
  file: File;
}

export const analyzeImport = async (args: AnalyzeArgs): Promise<AnalyzeResponse> => {
  const fd = new FormData();
  fd.append('strategy_key', args.strategyKey);
  if (args.buyerId) fd.append('buyer_id', String(args.buyerId));
  if (args.buySheetId) fd.append('buy_sheet_id', String(args.buySheetId));
  fd.append('file', args.file);
  const { data } = await api.post('/imports/analyze', fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
};

export interface CommitArgs {
  kind: 'po' | 'buy_sheet';
  strategy_key: string;
  header: Record<string, any>;
  styles: Array<Record<string, any>>;
  temp_file_path?: string;
  metadata?: Record<string, any>;
  original_filename?: string;
}

export const commitImport = async (payload: CommitArgs) => {
  const { data } = await api.post('/imports/commit', payload);
  return data;
};
