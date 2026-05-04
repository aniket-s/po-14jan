// Shape returned by GET /api/reports/purchase-orders. Mirrors what
// ReportService::getPurchaseOrderReport now emits (see backend for source of truth).

export interface POReportSampleSummary {
  pending: number;
  approved: number;
  rejected: number;
  total: number;
}

export interface POReportProductionSummary {
  not_started: number;
  in_progress: number;
  completed: number;
  total: number;
}

export interface POReportShipmentSummary {
  preparing: number;
  in_transit: number;
  delivered: number;
  overdue: number;
  total: number;
}

export interface POReportQualitySummary {
  passed: number;
  failed: number;
  pending: number;
  total: number;
}

export interface POReportFactoryRef {
  id: number;
  name: string;
}

export type POEtdStatus = 'overdue' | 'urgent' | 'soon' | 'on_track' | 'none';

export interface POReportItem {
  id: number;
  po_number: string;
  headline: string | null;
  status: string;
  po_date: string | null;
  etd_date: string | null;
  eta_date: string | null;
  ex_factory_date: string | null;
  in_warehouse_date: string | null;
  shipping_term: 'FOB' | 'DDP' | null;
  total_quantity: number;
  total_value: number;
  currency_id: number | null;
  currency_code: string | null;
  currency_symbol: string | null;
  styles_count: number;
  importer_id: number | null;
  importer_name: string | null;
  agency_id: number | null;
  agency_name: string | null;
  buyer_id: number | null;
  buyer_name: string | null;
  buyer_code: string | null;
  retailer_id: number | null;
  retailer_name: string | null;
  season_id: number | null;
  season_name: string | null;
  country_id: number | null;
  country_name: string | null;
  warehouse_id: number | null;
  warehouse_name: string | null;
  buy_sheet_id: number | null;
  buy_sheet_number: string | null;
  etd_status: POEtdStatus;
  samples_summary: POReportSampleSummary;
  production_summary: POReportProductionSummary;
  shipments_summary: POReportShipmentSummary;
  quality_summary: POReportQualitySummary;
  factories: POReportFactoryRef[];
}

export interface POReportSummary {
  total_orders: number;
  total_value: number;
  total_quantity: number;
  by_status: Record<string, number>;
  overdue_etd: number;
  upcoming_etd: number;
}

export interface POReportPagination {
  current_page: number;
  per_page: number;
  total: number;
  last_page: number;
}

export interface POReportResponse {
  summary: POReportSummary;
  orders: POReportItem[];
  pagination?: POReportPagination;
}

export interface POReportFilters {
  search: string;
  status: string;
  retailer_id: string;
  buyer_id: string;
  agency_id: string;
  season_id: string;
  factory_id: string;
  country_id: string;
  shipping_term: string;
  etd_overdue: boolean;
  start_date: string;
  end_date: string;
}

export const DEFAULT_PO_REPORT_FILTERS: POReportFilters = {
  search: '',
  status: 'all',
  retailer_id: 'all',
  buyer_id: 'all',
  agency_id: 'all',
  season_id: 'all',
  factory_id: 'all',
  country_id: 'all',
  shipping_term: 'all',
  etd_overdue: false,
  start_date: '',
  end_date: '',
};

export type POReportGroupBy = 'none' | 'retailer' | 'buyer' | 'agency' | 'season' | 'status' | 'month';

export interface POReportLookups {
  retailers: Array<{ id: number; name: string }>;
  buyers: Array<{ id: number; name: string; code?: string | null }>;
  agencies: Array<{ id: number; name: string }>;
  seasons: Array<{ id: number; name: string }>;
  factories: Array<{ id: number; name: string }>;
  countries: Array<{ id: number; name: string }>;
}
