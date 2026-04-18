import api from '@/lib/api';
import type { PdfAnalysisResult, PdfCreatePORequest, PdfCreatePOResult } from '@/types';

export interface ColorObject {
  id: number;
  name: string;
  code: string;
  pantone_code: string;
}

export interface SizeObject {
  id: number;
  gender_id: number;
  size_code: string;
  size_name: string;
  display_order: number;
}

export interface GenderObject {
  id: number;
  name: string;
  active_sizes?: SizeObject[];
}

export interface Style {
  id: number;
  style_number: string;
  description: string | null;
  fabric: string | null;
  color: ColorObject | null;
  fit: string | null;
  size_breakup: Record<string, number>;
  size_breakdown: Record<string, number> | null; // For PO-specific size breakdown
  total_quantity: number;
  unit_price: number;
  fob_price: number | null;
  images: string[] | null;
  technical_file_paths: string[] | null;
  packing_details: any;

  // Master data
  brand_id: number | null;
  season_id: number | null;
  gender_id: number | null;
  retailer_id: number | null;
  category_id: number | null;
  color_id: number | null;
  fabric_type_id: number | null;
  fabric_quality_id: number | null;

  // Enhanced fields
  color_code: string | null;
  color_name: string | null;
  fabric_name: string | null;
  fabric_type: string | null;
  fabric_type_name: string | null;
  fabric_weight: string | null;
  country_of_origin: string | null;
  item_description: string | null;
  msrp: number | null;
  wholesale_price: number | null;
  is_active: boolean;

  created_by: number | null;
  updated_by: number | null;
  tp_date: string | null;

  // Relationships (loaded when needed)
  brand?: any;
  season?: any;
  gender?: GenderObject; // Gender with active_sizes for size management
  retailer?: any;
  category?: any;
  fabric_quality?: any;
  purchase_orders?: any[];
  trims?: any[];
  creator?: { id: number; name: string; email?: string };
  updatedBy?: { id: number; name: string; email?: string };

  created_at: string;
  updated_at: string;
}

export interface PaginatedStyles {
  data: Style[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  from: number;
  to: number;
}

export interface CreateStyleData {
  style_number: string;
  description?: string;
  fabric_type_name?: string;
  fabric_type_id?: number;
  fabric_quality_id?: number;
  fabric_weight?: string;
  color_id?: number;
  fit?: string;
  size_breakup?: Record<string, number>;
  total_quantity?: number;
  unit_price?: number;
  fob_price?: number;
  images?: string[];
  technical_file_paths?: string[];
  packing_details?: any;

  // Master data
  brand_id?: number;
  retailer_id?: number;
  category_id?: number;
  season_id?: number;
  gender_id?: number;

  // Enhanced fields
  country_of_origin?: string;

  // Pricing
  msrp?: number;
  wholesale_price?: number;

  // Status
  is_active?: boolean;
  item_description?: string;

  trims?: Array<{
    trim_id: number;
    quantity?: number | null;
    notes?: string | null;
  }>;
  // Prepacks
  prepacks?: Array<{
    prepack_code_id: number;
    quantity: number;
    notes?: string;
  }>;
}

export interface UpdateStyleData extends Partial<CreateStyleData> {}

export interface StyleFilters {
  search?: string;
  brand_id?: number;
  season_id?: number;
  page?: number;
  per_page?: number;
}

// ========================================
// STANDALONE STYLE MANAGEMENT
// ========================================

/**
 * Get all styles (standalone, not tied to PO)
 */
export const getAllStyles = async (filters?: StyleFilters): Promise<PaginatedStyles> => {
  const response = await api.get('/styles', { params: filters });
  return response.data;
};

/**
 * Get a single standalone style by ID
 */
export const getStyleById = async (id: number): Promise<Style> => {
  const response = await api.get(`/styles/${id}`);
  return response.data;
};

/**
 * Create a new standalone style
 */
export const createStandaloneStyle = async (data: CreateStyleData): Promise<Style> => {
  const response = await api.post('/styles', data);
  return response.data;
};

/**
 * Update a standalone style
 */
export const updateStandaloneStyle = async (id: number, data: UpdateStyleData): Promise<Style> => {
  const response = await api.put(`/styles/${id}`, data);
  return response.data;
};

/**
 * Delete a standalone style
 */
export const deleteStandaloneStyle = async (id: number): Promise<void> => {
  await api.delete(`/styles/${id}`);
};

// ========================================
// PO-STYLE ASSOCIATIONS
// ========================================

export interface POStyleData {
  style_id: number;
  quantity_in_po: number;
  unit_price_in_po?: number;
  shipping_term?: 'FOB' | 'DDP';
  size_breakdown?: Record<string, number>;
  assigned_factory_id?: number;
  assigned_agency_id?: number;
  assignment_type?: 'direct_to_factory' | 'via_agency';
  target_production_date?: string;
  target_shipment_date?: string;
  ex_factory_date?: string;
  status?: string;
  notes?: string;
}

export interface AttachStylesRequest {
  styles: POStyleData[];
}

export interface AttachStylesResponse {
  message: string;
  attached_count: number;
  errors: string[];
  po_totals: {
    total_quantity: number;
    total_value: number;
    total_styles: number;
  };
}

/**
 * Get styles associated with a purchase order
 */
export const getPOStyles = async (poId: number, filters?: any): Promise<PaginatedStyles> => {
  const response = await api.get(`/purchase-orders/${poId}/styles`, { params: filters });
  return response.data;
};

/**
 * Attach styles to a purchase order
 */
export const attachStylesToPO = async (poId: number, data: AttachStylesRequest): Promise<AttachStylesResponse> => {
  const response = await api.post(`/purchase-orders/${poId}/styles/attach`, data);
  return response.data;
};

/**
 * Bulk attach styles to a purchase order (simple version)
 */
export const bulkAttachStylesToPO = async (
  poId: number,
  styleIds: number[],
  defaultQuantity?: number,
  defaultStatus?: string
): Promise<AttachStylesResponse> => {
  const response = await api.post(`/purchase-orders/${poId}/styles/attach-bulk`, {
    style_ids: styleIds,
    default_quantity: defaultQuantity,
    default_status: defaultStatus,
  });
  return response.data;
};

/**
 * Detach a style from a purchase order
 */
export const detachStyleFromPO = async (poId: number, styleId: number): Promise<any> => {
  const response = await api.delete(`/purchase-orders/${poId}/styles/${styleId}/detach`);
  return response.data;
};

/**
 * Update PO-specific style data (pivot data)
 */
export const updatePOStyleData = async (
  poId: number,
  styleId: number,
  data: Partial<POStyleData>
): Promise<any> => {
  const response = await api.put(`/purchase-orders/${poId}/styles/${styleId}`, data);
  return response.data;
};

/**
 * Assign factory to a style within a purchase order
 */
export const assignFactoryToPOStyle = async (
  poId: number,
  styleId: number,
  data: {
    assignment_type: 'direct_to_factory' | 'via_agency';
    assigned_factory_id?: number;
    assigned_agency_id?: number;
  }
): Promise<any> => {
  const response = await api.post(`/purchase-orders/${poId}/styles/${styleId}/assign-factory`, data);
  return response.data;
};

// ========================================
// EXCEL IMPORT FOR STANDALONE STYLES
// ========================================

export interface ExcelAnalysisHeader {
  index: number;
  original_name: string;
  suggested_field: string | null;
}

export interface ExcelAnalysisResult {
  headers: ExcelAnalysisHeader[];
  sample_data: (string | number | null)[][];
  suggested_mappings: Record<string, number | null>;
  row_count: number;
  temp_file_path: string;
  header_row?: number;
  data_start_row?: number;
  row_images?: Record<number, string>;
  has_images?: boolean;
  total_images?: number;
  image_columns?: Record<string, number>;
  image_format_detected?: string | null;
  column_images?: Record<number, Record<number, { url: string; format: string }>>;
}

export interface ExcelImportMapping {
  [key: string]: number | null; // field_name -> column_index
}

export interface ExcelImportRequest {
  temp_file_path: string;
  column_mapping: ExcelImportMapping;
  skip_first_row?: boolean;
  start_row?: number;
  end_row?: number;
  image_columns?: Record<string, number>;
  style_images?: Record<number, string[]>;
}

export interface ExcelImportResult {
  message: string;
  imported_count: number;
  errors: Array<{
    row: number;
    error: string;
  }>;
  skipped_count: number;
}

/**
 * Analyze an Excel file for standalone style import
 */
export const analyzeExcelForStandaloneImport = async (file: File): Promise<ExcelAnalysisResult> => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await api.post('/styles/import/analyze', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

  const { analysis, temp_file_path } = response.data;

  return {
    headers: analysis.headers,
    sample_data: analysis.sample_rows,
    suggested_mappings: analysis.suggested_mappings,
    row_count: analysis.total_rows,
    temp_file_path,
    header_row: analysis.header_row,
    data_start_row: analysis.data_start_row,
    row_images: analysis.row_images,
    has_images: analysis.has_images,
    total_images: analysis.total_images,
    image_columns: analysis.image_columns,
    image_format_detected: analysis.image_format_detected,
    column_images: analysis.column_images,
  };
};

/**
 * Execute Excel import for standalone styles
 */
export const executeStandaloneStylesImport = async (data: ExcelImportRequest): Promise<ExcelImportResult> => {
  const response = await api.post('/styles/import/execute', data);

  const { message, result } = response.data;

  // Transform the response to match ExcelImportResult type
  return {
    message,
    imported_count: result.imported,
    skipped_count: result.skipped,
    errors: result.errors || [],
  };
};

/**
 * Download Excel template for styles
 */
export const downloadStylesTemplate = async (): Promise<Blob> => {
  const response = await api.get('/styles/template/download', { responseType: 'blob' });
  return response.data;
};

// ========================================
// PDF IMPORT FOR PURCHASE ORDERS
// ========================================

/**
 * Analyze a PDF purchase order file
 */
export const analyzePdfForPOImport = async (file: File): Promise<PdfAnalysisResult> => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await api.post('/purchase-orders/pdf-import/analyze', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

  return response.data;
};

/**
 * Create a PO from parsed PDF data
 */
export const createPOFromPdf = async (data: PdfCreatePORequest): Promise<PdfCreatePOResult> => {
  const response = await api.post('/purchase-orders/pdf-import/create', data);
  return response.data;
};
