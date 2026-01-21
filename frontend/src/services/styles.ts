import api from '@/lib/api';

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
  division_id: number | null;
  customer_id: number | null;
  agent_id: number | null;
  vendor_id: number | null;

  // Enhanced fields
  color_code: string | null;
  color_name: string | null;
  fabric_name: string | null;
  fabric_type: string | null;
  fabric_type_name: string | null; // NEW: Combined fabric type and name
  fabric_weight: string | null;
  country_of_origin: string | null;
  loading_port: string | null;
  item_description: string | null;
  packing_method: string | null;

  created_by: number | null;
  tp_date: string | null;
  shipping_term: string | null; // Changed from price_term
  payment_term: string | null;
  current_milestone: string | null;

  // Relationships (loaded when needed)
  brand?: any;
  season?: any;
  gender?: GenderObject; // Gender with active_sizes for size management
  division?: any;
  customer?: any;
  agent?: any;
  vendor?: any;
  purchase_orders?: any[];

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
  fabric?: string; // Deprecated - use fabric_type_name
  fabric_type_name?: string; // Combined fabric type and name
  fabric_weight?: string;
  color?: string; // Deprecated - use color_id
  color_id?: number; // NEW: Foreign key to colors table
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
  buyer_id?: number; // NEW: Buyer categorization
  category_id?: number; // NEW: Product category
  season_id?: number; // NEW: Season/collection
  gender_id?: number; // REQUIRED for size management

  // Enhanced fields
  color_code?: string; // Pantone code (optional)
  color_name?: string;
  fabric_name?: string; // Deprecated - use fabric_type_name
  fabric_type?: string; // Deprecated - use fabric_type_name
  country_of_origin?: string;

  // Pricing
  msrp?: number; // NEW: MSRP
  wholesale_price?: number; // NEW: Wholesale price

  // Status
  is_active?: boolean; // NEW: Active/Inactive
  item_description?: string;
  // REMOVED (PO-level fields):
  // - loading_port
  // - packing_method
  // - shipping_term (moved to PO pivot table)
  // - payment_term

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
  division_id?: number;
  customer_id?: number;
  page?: number;
  per_page?: number;
}

// ========================================
// STANDALONE STYLE MANAGEMENT (NEW)
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
 * Bulk create standalone styles
 */
export const bulkCreateStandaloneStyles = async (styles: CreateStyleData[]): Promise<any> => {
  const response = await api.post('/styles/bulk', { styles });
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

/**
 * Get styles available for PO selection (not yet in this PO)
 */
export const getAvailableStylesForPO = async (poId: number, filters?: StyleFilters): Promise<PaginatedStyles> => {
  const response = await api.get(`/styles/available-for-po/${poId}`, { params: filters });
  return response.data;
};

// ========================================
// PO-STYLE ASSOCIATIONS (NEW)
// ========================================

export interface POStyleData {
  style_id: number;
  quantity_in_po: number;
  unit_price_in_po?: number;
  shipping_term?: 'FOB' | 'DDP'; // Changed from price_term
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

export interface ExcelAnalysisResult {
  headers: string[];
  sample_data: any[];
  suggested_mappings: Record<string, string>;
  row_count: number;
}

export interface ExcelImportMapping {
  [key: string]: string; // column_name -> field_name
}

export interface ExcelImportRequest {
  temp_file_path: string;
  column_mapping: ExcelImportMapping;
  skip_first_row?: boolean;
  start_row?: number;
  end_row?: number;
}

export interface ExcelImportResult {
  message: string;
  imported_count: number;
  errors: Array<{
    row: number;
    errors: string[];
  }>;
  skipped_count: number;
}

/**
 * Analyze an Excel file for standalone style import
 */
export const analyzeExcelForStandaloneImport = async (file: File): Promise<ExcelAnalysisResult & { temp_file_path: string }> => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await api.post('/styles/import/analyze', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

  const { analysis, temp_file_path } = response.data;

  // Transform the response to match ExcelAnalysisResult type
  return {
    headers: analysis.headers.map((h: any) => h.original_name),
    sample_data: analysis.sample_rows,
    suggested_mappings: analysis.suggested_mappings,
    row_count: analysis.total_rows,
    temp_file_path,
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
// LEGACY ENDPOINTS (for backward compatibility)
// ========================================

/**
 * Create style within PO context (DEPRECATED - use attachStylesToPO instead)
 */
export const createStyleInPO = async (poId: number, data: CreateStyleData): Promise<Style> => {
  const response = await api.post(`/purchase-orders/${poId}/styles`, data);
  return response.data;
};

/**
 * Update style in PO context (DEPRECATED - use updatePOStyleData instead)
 */
export const updateStyleInPO = async (poId: number, styleId: number, data: UpdateStyleData): Promise<Style> => {
  const response = await api.put(`/purchase-orders/${poId}/styles/${styleId}`, data);
  return response.data;
};

/**
 * Delete style from PO (DEPRECATED - use detachStyleFromPO instead)
 */
export const deleteStyleFromPO = async (poId: number, styleId: number): Promise<void> => {
  await api.delete(`/purchase-orders/${poId}/styles/${styleId}`);
};
