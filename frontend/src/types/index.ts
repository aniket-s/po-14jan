export interface ColorObject {
  id: number;
  name: string;
  code: string;
  pantone_code: string;
}

export interface SampleSchedule {
  // Sample Submissions
  top_approval?: string;
  trim_approvals?: string;
  lab_dip_submission?: string;
  pp_sample_submission?: string;
  fit_sample_submission?: string;
  first_proto_submission?: string;

  // Production Milestones
  production_start?: string;
  bulk_fabric_inhouse?: string;
}

export interface PurchaseOrder {
  id: number;
  po_number: string;
  headline?: string | null;
  importer_id: number;
  agency_id: number | null;
  po_date: string;
  status: string;
  total_quantity: number;
  total_value: number;
  currency: string;
  exchange_rate?: number;
  payment_terms: string | null;
  payment_terms_structured?: { term: string; percentage?: number } | null;
  shipping_method: string | null;
  notes: string | null;
  additional_notes?: string | null;
  created_at: string;
  updated_at: string;
  importer?: User;
  agency?: User;
  styles?: Style[];
  styles_count?: number;
  // Enhanced PO fields
  revision_date?: string;
  etd_date?: string;
  eta_date?: string;
  in_warehouse_date?: string;
  ship_to?: string;
  ship_to_address?: string;
  sample_schedule?: SampleSchedule;
  packing_guidelines?: string;
  // Master data foreign keys
  season_id?: number | null;
  retailer_id?: number | null;
  country_id?: number | null;
  warehouse_id?: number | null;
  // Shipping term and additional fields
  shipping_term?: 'FOB' | 'DDP' | null;
  payment_term?: string | null;
  country_of_origin?: string | null;
  packing_method?: string | null;
  other_terms?: string | null;
}

export interface PackDetail {
  pack_size: string;
  width: string;
  size_breakdown: Record<string, number>;
  quantity: number;
  cost_per_unit: number;
  total_cost: number;
}

export interface PackingDetails {
  packs: PackDetail[];
  total_quantity: number;
  overall_size_breakdown: Record<string, number>;
}

export interface Style {
  id: number;
  style_number: string;
  description: string | null;
  fabric?: string | null;
  quantity: number;
  total_quantity?: number;
  unit_price: number;
  total_price: number;
  color: ColorObject | null;
  size_breakdown: Record<string, number> | null;
  packing_details?: PackingDetails | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  purchase_orders?: PurchaseOrder[];
  factory_assignments?: FactoryAssignment[];
  samples?: Sample[];
  assignedFactory?: User;
  assignedAgency?: User;
  // Pivot table fields (from purchase_order_style)
  pivot?: {
    quantity_in_po?: number;
    unit_price_in_po?: number;
    shipping_term?: 'FOB' | 'DDP';
    size_breakdown?: Record<string, number>;
    assigned_factory_id?: number;
    assigned_agency_id?: number;
    assignment_type?: 'direct_to_factory' | 'via_agency';
    assigned_at?: string;
    target_production_date?: string;
    target_shipment_date?: string;
    ex_factory_date?: string;
    estimated_ex_factory_date?: string;
    production_status?: string;
    shipping_approval_status?: string;
    status?: string;
    notes?: string;
  };
}

export interface FactoryAssignment {
  id: number;
  style_id: number;
  factory_id: number;
  assigned_quantity: number;
  status: string;
  assigned_date: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  style?: Style;
  factory?: User;
}

export interface Sample {
  id: number;
  style_id: number;
  sample_type_id: number;
  submitted_by: number;
  sample_reference: string;
  submission_date: string;
  quantity: number | null;
  images: string[] | null;
  attachment_paths: string[] | null;
  notes: string | null;
  agency_status: string;
  agency_approved_by: number | null;
  agency_approved_at: string | null;
  agency_rejection_reason: string | null;
  importer_status: string;
  importer_approved_by: number | null;
  importer_approved_at: string | null;
  importer_rejection_reason: string | null;
  final_status: string;
  metadata: Record<string, any> | null;
  created_at: string;
  updated_at: string;
  style?: Style;
  sample_type?: SampleType;
  submittedBy?: User;
  agencyApprovedBy?: User;
  importerApprovedBy?: User;
}

export interface SampleType {
  id: number;
  name: string;
  display_name: string;
  description: string | null;
  display_order: number;
  is_active: boolean;
  is_custom?: boolean;
  created_by?: number;
  prerequisites: string[] | null;
  parallel_submission_allowed?: boolean;
  required_for_production?: boolean;
  typical_days?: number | null;
  max_images?: number | null;
  allows_parallel_submission?: boolean; // Computed from backend
  can_submit?: boolean; // From availableSampleTypes endpoint
  created_at: string;
  updated_at: string;
  creator?: User;
  samples_count?: number;
}

export interface StyleSampleProcess {
  id: number;
  style_id: number;
  sample_type_id: number;
  priority: number;
  is_required: boolean;
  status: 'pending' | 'in_progress' | 'approved' | 'rejected' | 'skipped';
  created_at: string;
  updated_at: string;
  style?: Style;
  sampleType?: SampleType;
}

export interface User {
  id: number;
  name: string;
  email: string;
  company: string | null;
  roles: Role[];
  permissions: string[];
}

export interface Role {
  id: number;
  name: string;
  display_name: string;
  description: string | null;
}

export interface PaginatedResponse<T> {
  data: T[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  from: number;
  to: number;
}

export interface CreatePurchaseOrderData {
  po_number: string;
  headline?: string | null;
  importer_id?: number;
  agency_id?: number | null;
  po_date: string;
  currency: string;
  payment_terms?: string;
  shipping_method?: string;
  notes?: string;
  // Enhanced PO fields
  revision_date?: string;
  etd_date?: string;
  eta_date?: string;
  in_warehouse_date?: string;
  ship_to?: string;
  ship_to_address?: string;
  sample_schedule?: SampleSchedule;
  packing_guidelines?: string;
}

export interface UpdatePurchaseOrderData extends Partial<CreatePurchaseOrderData> {
  id: number;
}
