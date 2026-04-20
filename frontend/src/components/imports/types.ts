export interface ImportStrategy {
  key: string;
  label: string;
  buyer_code: string;
  format: 'pdf' | 'excel';
  document_kind: 'po' | 'buy_sheet';
  supports_buy_sheet: boolean;
  date_policy: 'fob' | 'ddp' | 'massive_fob' | 'none';
}

export interface BuySheetSummary {
  id: number;
  buy_sheet_number: string;
  name: string | null;
  buyer_id: number;
  buyer?: { id: number; name: string; code?: string };
  retailer?: { id: number; name: string } | null;
  status: 'open' | 'po_issued' | 'closed' | 'cancelled';
  total_styles: number;
  total_quantity: number;
  total_value: number;
  date_submitted: string | null;
  created_at: string;
}

export interface ImportWizardContext {
  strategy: ImportStrategy | null;
  buyerId: number | null;
  useBuySheet: 'yes' | 'no' | null;
  buySheet: BuySheetSummary | null;
  file: File | null;
}

export interface AnalyzeResponse {
  success: boolean;
  kind: 'po' | 'buy_sheet';
  strategy_key: string;
  po_header: Record<string, any>;
  styles: Array<Record<string, any>>;
  totals: { total_quantity: number; total_value: number };
  warnings: string[];
  errors: string[];
  raw_text?: string;
  ai_usage?: any;
  temp_file_path: string;
  strategy: {
    key: string;
    label: string;
    buyer_code: string;
    format: string;
    document_kind: string;
    date_policy: string;
  };
}
