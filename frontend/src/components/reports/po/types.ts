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

const EMPTY_SAMPLE_SUMMARY: POReportSampleSummary = { pending: 0, approved: 0, rejected: 0, total: 0 };
const EMPTY_PRODUCTION_SUMMARY: POReportProductionSummary = { not_started: 0, in_progress: 0, completed: 0, total: 0 };
const EMPTY_SHIPMENT_SUMMARY: POReportShipmentSummary = { preparing: 0, in_transit: 0, delivered: 0, overdue: 0, total: 0 };
const EMPTY_QUALITY_SUMMARY: POReportQualitySummary = { passed: 0, failed: 0, pending: 0, total: 0 };

// Defensive normalization at the API boundary - older backend responses (or
// rows that pre-date the aggregation join) may not carry every field. This
// keeps the table/detail-panel from null-deref crashing when that happens.
export function normalizePOReportItem(raw: any): POReportItem {
  return {
    id: raw?.id,
    po_number: raw?.po_number ?? '',
    headline: raw?.headline ?? null,
    status: raw?.status ?? 'draft',
    po_date: raw?.po_date ?? null,
    etd_date: raw?.etd_date ?? null,
    eta_date: raw?.eta_date ?? null,
    ex_factory_date: raw?.ex_factory_date ?? null,
    in_warehouse_date: raw?.in_warehouse_date ?? null,
    shipping_term: raw?.shipping_term ?? null,
    total_quantity: Number(raw?.total_quantity ?? 0),
    total_value: Number(raw?.total_value ?? 0),
    currency_id: raw?.currency_id ?? null,
    currency_code: raw?.currency_code ?? null,
    currency_symbol: raw?.currency_symbol ?? null,
    styles_count: Number(raw?.styles_count ?? 0),
    importer_id: raw?.importer_id ?? null,
    importer_name: raw?.importer_name ?? null,
    agency_id: raw?.agency_id ?? null,
    agency_name: raw?.agency_name ?? null,
    buyer_id: raw?.buyer_id ?? null,
    buyer_name: raw?.buyer_name ?? null,
    buyer_code: raw?.buyer_code ?? null,
    retailer_id: raw?.retailer_id ?? null,
    retailer_name: raw?.retailer_name ?? null,
    season_id: raw?.season_id ?? null,
    season_name: raw?.season_name ?? null,
    country_id: raw?.country_id ?? null,
    country_name: raw?.country_name ?? null,
    warehouse_id: raw?.warehouse_id ?? null,
    warehouse_name: raw?.warehouse_name ?? null,
    buy_sheet_id: raw?.buy_sheet_id ?? null,
    buy_sheet_number: raw?.buy_sheet_number ?? null,
    etd_status: (raw?.etd_status ?? 'none') as POEtdStatus,
    samples_summary: { ...EMPTY_SAMPLE_SUMMARY, ...(raw?.samples_summary ?? {}) },
    production_summary: { ...EMPTY_PRODUCTION_SUMMARY, ...(raw?.production_summary ?? {}) },
    shipments_summary: { ...EMPTY_SHIPMENT_SUMMARY, ...(raw?.shipments_summary ?? {}) },
    quality_summary: { ...EMPTY_QUALITY_SUMMARY, ...(raw?.quality_summary ?? {}) },
    factories: Array.isArray(raw?.factories) ? raw.factories : [],
  };
}

export function normalizePOReportResponse(raw: any): POReportResponse {
  return {
    summary: {
      total_orders: Number(raw?.summary?.total_orders ?? 0),
      total_value: Number(raw?.summary?.total_value ?? 0),
      total_quantity: Number(raw?.summary?.total_quantity ?? 0),
      by_status: raw?.summary?.by_status ?? {},
      overdue_etd: Number(raw?.summary?.overdue_etd ?? 0),
      upcoming_etd: Number(raw?.summary?.upcoming_etd ?? 0),
    },
    orders: Array.isArray(raw?.orders) ? raw.orders.map(normalizePOReportItem) : [],
    pagination: raw?.pagination
      ? {
          current_page: Number(raw.pagination.current_page ?? 1),
          per_page: Number(raw.pagination.per_page ?? 25),
          total: Number(raw.pagination.total ?? 0),
          last_page: Number(raw.pagination.last_page ?? 1),
        }
      : undefined,
  };
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
