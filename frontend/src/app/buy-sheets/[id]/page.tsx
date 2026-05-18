'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, FileUp } from 'lucide-react';
import api from '@/lib/api';
import { ImportWizardDialog } from '@/components/imports/ImportWizardDialog';
import { useAuth } from '@/contexts/AuthContext';
import { formatDate } from '@/lib/dateUtils';

export default function BuySheetDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { can } = useAuth();

  const [sheet, setSheet] = useState<any>(null);
  const [buyers, setBuyers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showImport, setShowImport] = useState(false);

  const fetch = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/buy-sheets/${params.id}`);
      setSheet(res.data?.buy_sheet ?? null);
    } finally {
      setLoading(false);
    }
  };
  const fetchBuyers = async () => {
    try {
      const r = await api.get('/master-data/buyers', { params: { all: 1, is_active: true } });
      const payload = r.data;
      setBuyers(Array.isArray(payload) ? payload : (payload?.data ?? []));
    } catch { /* noop */ }
  };

  useEffect(() => { fetch(); fetchBuyers(); /* eslint-disable-next-line */ }, [params.id]);

  if (loading) return <DashboardLayout><div className="p-6">Loading…</div></DashboardLayout>;
  if (!sheet) return <DashboardLayout><div className="p-6">Not found.</div></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
        </div>

        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-2xl font-semibold">
              #{sheet.buy_sheet_number}
              {sheet.name && <span className="text-muted-foreground font-normal"> — {sheet.name}</span>}
            </h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <Badge>{sheet.status.replace('_', ' ')}</Badge>
              <span className="text-sm text-muted-foreground">Buyer: {sheet.buyer?.name}</span>
              {sheet.retailer && <span className="text-sm text-muted-foreground">· Retailer: {sheet.retailer.name}</span>}
            </div>
          </div>
          {can('po.create') && sheet.status === 'open' && (
            <Button onClick={() => setShowImport(true)}>
              <FileUp className="h-4 w-4 mr-1" /> Import PO against this buy sheet
            </Button>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Stat label="Styles" value={sheet.total_styles} />
          <Stat label="Total Units" value={Number(sheet.total_quantity).toLocaleString()} />
          <Stat label="Total Value" value={Number(sheet.total_value).toLocaleString(undefined, { style: 'currency', currency: 'USD' })} />
          <Stat label="Date Submitted" value={formatDate(sheet.date_submitted, '—')} />
        </div>

        <Card>
          <CardContent className="p-0">
            <div className="p-3 border-b text-sm font-medium">Styles</div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Style #</TableHead>
                  <TableHead>Color</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Qty</TableHead>
                  <TableHead className="text-right">Unit Price</TableHead>
                  <TableHead>IHD</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(sheet.styles ?? []).length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">No styles.</TableCell></TableRow>
                ) : sheet.styles.map((s: any) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono">{s.style_number}</TableCell>
                    <TableCell>{s.color_name ?? s.pivot?.color_name ?? '—'}</TableCell>
                    <TableCell>{s.description ?? '—'}</TableCell>
                    <TableCell className="text-right">{s.pivot?.quantity ?? s.total_quantity}</TableCell>
                    <TableCell className="text-right">${s.pivot?.unit_price ?? s.unit_price}</TableCell>
                    <TableCell>{formatDate(s.pivot?.ihd, '—')}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {sheet.purchase_orders?.length > 0 && (
          <Card>
            <CardContent className="p-0">
              <div className="p-3 border-b text-sm font-medium">Linked Purchase Orders</div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>PO #</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>PO Date</TableHead>
                    <TableHead className="text-right">Units</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sheet.purchase_orders.map((po: any) => (
                    <TableRow key={po.id}>
                      <TableCell><Link href={`/purchase-orders/${po.id}`} className="text-primary hover:underline font-mono">{po.po_number}</Link></TableCell>
                      <TableCell>{po.status}</TableCell>
                      <TableCell>{formatDate(po.po_date, '—')}</TableCell>
                      <TableCell className="text-right">{Number(po.total_quantity).toLocaleString()}</TableCell>
                      <TableCell className="text-right">${Number(po.total_value).toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        <ImportWizardDialog
          isOpen={showImport}
          onClose={() => setShowImport(false)}
          buyers={buyers}
          onRefreshBuyers={fetchBuyers}
          onImportComplete={fetch}
        />
      </div>
    </DashboardLayout>
  );
}

function Stat({ label, value }: { label: string; value: any }) {
  return (
    <Card><CardContent className="p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-xl font-semibold mt-1">{value}</div>
    </CardContent></Card>
  );
}
