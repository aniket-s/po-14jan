export interface Sample {
  id: number;
  style_id: number;
  sample_type_id: number;
  sample_reference: string | null;
  submission_date: string;
  agency_status: string;
  agency_approved_by: number | null;
  agency_approved_at: string | null;
  agency_rejection_reason: string | null;
  importer_status: string;
  importer_approved_by: number | null;
  importer_approved_at: string | null;
  importer_rejection_reason: string | null;
  final_status: string;
  notes: string | null;
  images: string[] | null;
  attachment_paths: string[] | null;
  quantity?: number | null;
  created_at: string;
  style?: {
    style_number: string;
    purchase_orders?: Array<{
      id: number;
      po_number: string;
    }>;
  };
  sample_type?: {
    name: string;
    display_name?: string;
    display_order: number;
  };
  submitted_by?: {
    id: number;
    name: string;
    email: string;
  };
}

export interface SampleType {
  id: number;
  name: string;
  display_name: string;
  description: string | null;
  display_order: number;
  is_active: boolean;
  prerequisites: string[] | null;
  allows_parallel_submission?: boolean;
  can_submit?: boolean;
}

export interface Style {
  id: number;
  style_number: string;
  purchase_orders?: Array<{
    id: number;
    po_number: string;
  }>;
}

export interface TimelineEvent {
  id?: number;
  action: string;
  description?: string;
  user_name?: string;
  created_at?: string;
  metadata?: Record<string, any>;
}

export type ViewMode = 'board' | 'table';

export type SampleStatus = 'pending' | 'approved' | 'rejected';

export interface SampleFilters {
  search: string;
  status: string;
  sampleType: string;
  dateRange: string;
}
