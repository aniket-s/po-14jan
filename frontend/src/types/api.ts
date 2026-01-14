/**
 * Common API types and utilities
 */

export interface ApiError {
  response?: {
    data?: {
      message?: string;
      errors?: Record<string, string[]>;
    };
    status?: number;
  };
  message?: string;
}

export const isApiError = (error: unknown): error is ApiError => {
  return typeof error === 'object' && error !== null && 'response' in error;
};

export const getApiErrorMessage = (error: unknown, defaultMessage: string = 'An error occurred'): string => {
  if (isApiError(error)) {
    return error.response?.data?.message || error.message || defaultMessage;
  }
  return defaultMessage;
};

export interface PaginationParams {
  page?: number;
  per_page?: number;
  search?: string;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

export interface FilterParams extends Record<string, string | number | boolean | undefined> {
  status?: string;
  type?: string;
  start_date?: string;
  end_date?: string;
}
