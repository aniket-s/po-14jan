'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, FileUp, AlertTriangle, ChevronRight } from 'lucide-react';
import api from '@/lib/api';
import { ImportWizardDialog } from '@/components/imports/ImportWizardDialog';
import type { BuySheetSummary } from '@/components/imports/types';
import { useAuth } from '@/contexts/AuthContext';

export default function BuySheetsPage() {
  const { can } = useAuth();
  const router = useRouter();
  const [sheets, setSheets] = useState<BuySheetSummary[]>([]);
  const [buyers, setBuyers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [buyerFilter, setBuyerFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showImport, setShowImport] = useState(false);

  const fetchBuyers = async () => {
    try {
      const res = await api.get('/master-data/buyers', { params: { all: 1, is_active: true } });
      // Endpoint returns a bare array when ?all=1, else a paginator with .data
      const payload = res.data;
      setBuyers(Array.isArray(payload) ? payload : (payload?.data ?? []));
    } catch { /* noop */ }
  };

  const fetchSheets = async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const params: any = { per_page: 50 };
      if (search) params.search = search;
      if (buyerFilter !== 'all') params.buyer_id = buyerFilter;
      if (statusFilter !== 'all') params.status = statusFilter;
      const res = await api.get('/buy-sheets', { params });
      setSheets(res.data?.data ?? res.data ?? []);
    } catch (e: any) {
      setSheets([]);
      const status = e?.response?.status;
      if (status === 403) {
        setErrorMessage(
          'You do not have the buy_sheet.view permission. Run `php artisan migrate` on the backend to apply the migration that grants this permission, or ask an admin to grant it to your role.',
        );
      } else if (status === 401) {
        setErrorMessage('Your session has expired. Please log in again.');
      } else {
        setErrorMessage(e?.response?.data?.message || e?.message || 'Failed to load buy sheets.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchBuyers(); }, []);
  useEffect(() => { fetchSheets(); /* eslint-disable-next-line */ }, [search, buyerFilter, statusFilter]);

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      open: 'bg-blue-500',
      po_issued: 'bg-emerald-600',
      closed: 'bg-gray-500',
      cancelled: 'bg-red-500',
    };
    return <Badge className={`${map[s] ?? 'bg-gray-500'} text-xs`}>{s.replace('_', ' ')}</Badge>;
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Buy Sheets</h1>
            <p className="text-sm text-muted-foreground">
              Pre-PO style submissions from buyers. Link a PO to a buy sheet when it arrives.
            </p>
          </div>
          {can('buy_sheet.import') && (
            <Button size="sm" onClick={() => setShowImport(true)}>
              <FileUp className="h-4 w-4 mr-1" /> Import Buy Sheet
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-8 h-9"
              placeholder="Search by number or name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={buyerFilter} onValueChange={setBuyerFilter}>
            <SelectTrigger className="h-9 w-[180px]"><SelectValue placeholder="Buyer" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Buyers</SelectItem>
              {buyers.map((b: any) => <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="po_issued">PO Issued</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {errorMessage && (
          <div className="rounded-md border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-900 p-3 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
            <div className="text-sm text-red-800 dark:text-red-300">{errorMessage}</div>
          </div>
        )}

        <div className="border rounded-md">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Number</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Buyer</TableHead>
                <TableHead>Retailer</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Styles</TableHead>
                <TableHead className="text-right">Units</TableHead>
                <TableHead>Date</TableHead>
                <TableHead className="w-8" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground">Loading…</TableCell></TableRow>
              ) : sheets.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                  {errorMessage ? 'Could not load buy sheets — see message above.' : 'No buy sheets yet.'}
                </TableCell></TableRow>
              ) : (
                sheets.map((s) => (
                  <TableRow
                    key={s.id}
                    className="cursor-pointer hover:bg-muted/40"
                    onClick={() => router.push(`/buy-sheets/${s.id}`)}
                  >
                    <TableCell className="font-mono font-medium text-primary">{s.buy_sheet_number}</TableCell>
                    <TableCell>{s.name ?? <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell>{s.buyer?.name ?? '—'}</TableCell>
                    <TableCell>{s.retailer?.name ?? '—'}</TableCell>
                    <TableCell>{statusBadge(s.status)}</TableCell>
                    <TableCell className="text-right">{s.total_styles}</TableCell>
                    <TableCell className="text-right">{Number(s.total_quantity ?? 0).toLocaleString()}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{s.date_submitted ?? '—'}</TableCell>
                    <TableCell className="text-muted-foreground">
                      <ChevronRight className="h-4 w-4" />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <ImportWizardDialog
          isOpen={showImport}
          onClose={() => setShowImport(false)}
          buyers={buyers}
          onRefreshBuyers={fetchBuyers}
          onImportComplete={fetchSheets}
          initialStrategyKey={null}
        />
      </div>
    </DashboardLayout>
  );
}
