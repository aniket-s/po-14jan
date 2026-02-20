'use client';

import { useState, useCallback, useRef } from 'react';
import api from '@/lib/api';
import { PoListRow, CellSaveStatus } from '@/types/spreadsheet';

interface UsePoListSpreadsheetDataReturn {
  rows: PoListRow[];
  loading: boolean;
  error: string | null;
  currentPage: number;
  totalPages: number;
  totalRows: number;
  fetchData: (params?: { search?: string; page?: number; perPage?: number }) => Promise<void>;
  navigateToPage: (page: number) => void;
}

export function usePoListSpreadsheetData(): UsePoListSpreadsheetDataReturn {
  const [rows, setRows] = useState<PoListRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRows, setTotalRows] = useState(0);

  const lastParams = useRef<{ search?: string; perPage?: number }>({});

  const fetchData = useCallback(async (params?: { search?: string; page?: number; perPage?: number }) => {
    setLoading(true);
    setError(null);

    const page = params?.page ?? 1;
    const perPage = params?.perPage ?? lastParams.current.perPage ?? 100;
    const search = params?.search ?? lastParams.current.search;

    lastParams.current = { search, perPage };

    try {
      const queryParams: Record<string, any> = {
        view: 'excel',
        page,
        per_page: perPage,
      };
      if (search) queryParams.search = search;

      const res = await api.get('/purchase-orders', { params: queryParams });
      const data = res.data;

      const mapped: PoListRow[] = (data.data || []).map((po: any) => ({
        _poId: po.id,
        po_number: po.po_number,
        headline: po.headline ?? null,
        status: po.status ?? '',
        po_date: po.po_date ?? null,
        revision_date: po.revision_date ?? null,
        shipping_term: po.shipping_term ?? null,
        etd_date: po.etd_date ?? null,
        eta_date: po.eta_date ?? null,
        ex_factory_date: po.ex_factory_date ?? null,
        in_warehouse_date: po.in_warehouse_date ?? null,
        total_quantity: po.total_quantity ?? 0,
        total_value: po.total_value ?? 0,
        styles_count: po.styles_count ?? (po.styles?.length ?? 0),
        payment_terms: po.payment_terms ?? null,
        ship_to: po.ship_to ?? null,
        importer_name: po.importer?.name ?? null,
        agency_name: po.agency?.name ?? null,
        retailer_name: po.retailer?.name ?? null,
        season_name: po.season?.name ?? null,
        country_name: po.country?.name ?? null,
        warehouse_name: po.warehouse?.name ?? null,
        currency_code: po.currency?.code ?? null,
        currency_symbol: po.currency?.symbol ?? '$',
        created_at: po.created_at ?? null,
      }));

      setRows(mapped);
      setCurrentPage(data.current_page ?? 1);
      setTotalPages(data.last_page ?? 1);
      setTotalRows(data.total ?? mapped.length);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to load purchase orders');
    } finally {
      setLoading(false);
    }
  }, []);

  const navigateToPage = useCallback((page: number) => {
    fetchData({ page });
  }, [fetchData]);

  return {
    rows,
    loading,
    error,
    currentPage,
    totalPages,
    totalRows,
    fetchData,
    navigateToPage,
  };
}
