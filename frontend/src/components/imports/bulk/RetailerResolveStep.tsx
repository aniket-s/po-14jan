'use client';

import { useState } from 'react';
import { Store, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { RetailerOption, RetailerResolution } from './types';

interface Props {
  retailers: RetailerResolution[];
  retailerMap: Record<string, number | null>;
  setRetailerId: (name: string, id: number | null) => void;
  options: RetailerOption[];
  onCreate: (name: string) => Promise<RetailerOption | null>;
}

const CREATE = '__create__';
const BLANK = '';
const UNSET = '__unset__';

export function RetailerResolveStep({ retailers, retailerMap, setRetailerId, options, onCreate }: Props) {
  const [creating, setCreating] = useState<Record<string, boolean>>({});

  const unresolved = retailers.filter((r) => retailerMap[r.name] === undefined).length;

  const handleChange = async (r: RetailerResolution, value: string) => {
    if (value === BLANK) { setRetailerId(r.name, null); return; }
    if (value === CREATE) {
      setCreating((p) => ({ ...p, [r.name]: true }));
      try {
        const created = await onCreate(r.name.slice(0, 255));
        if (created) {
          setRetailerId(r.name, created.id);
          toast.success(`Retailer “${created.name}” created`);
        }
      } catch (e) {
        toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Could not create retailer');
      } finally {
        setCreating((p) => ({ ...p, [r.name]: false }));
      }
      return;
    }
    setRetailerId(r.name, Number(value));
  };

  const valueFor = (name: string): string => {
    const v = retailerMap[name];
    if (v === undefined) return UNSET;
    if (v === null) return BLANK;
    return String(v);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm">
        <Store className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium">{retailers.length} retailer{retailers.length === 1 ? '' : 's'} from the sheet</span>
        {unresolved > 0
          ? <span className="text-amber-600">· {unresolved} still to resolve</span>
          : <span className="text-emerald-600">· all set</span>}
      </div>
      <p className="text-xs text-muted-foreground">
        Match each store name to an existing retailer, or create a new one — same as picking the Retailer when you create a PO manually.
        The chosen retailer is also set as the PO’s buyer.
      </p>

      <div className="rounded-md border divide-y">
        {retailers.map((r) => {
          const val = valueFor(r.name);
          const resolved = retailerMap[r.name];
          const isCreating = creating[r.name];
          return (
            <div key={r.name} className="flex items-center gap-3 px-3 py-2">
              <span className="shrink-0">
                {resolved === undefined
                  ? <AlertTriangle className="h-4 w-4 text-amber-500" />
                  : resolved === null
                  ? <span className="block h-2.5 w-2.5 rounded-full bg-muted-foreground/40" />
                  : <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate" title={r.name}>{r.name}</div>
                <div className="text-[11px] text-muted-foreground">
                  {r.po_count} PO{r.po_count === 1 ? '' : 's'} · {r.style_count} style{r.style_count === 1 ? '' : 's'}
                  {r.matched_name && resolved != null && (
                    <span className="text-emerald-700 dark:text-emerald-400"> · matched “{r.matched_name}”</span>
                  )}
                </div>
              </div>
              {isCreating ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : (
                <select
                  value={val}
                  onChange={(e) => handleChange(r, e.target.value)}
                  className="h-8 min-w-[220px] max-w-[280px] rounded-md border bg-background px-2 text-sm"
                >
                  {val === UNSET && <option value={UNSET} disabled hidden>Choose a retailer…</option>}
                  <option value={BLANK}>— Leave blank —</option>
                  <optgroup label="Existing retailers">
                    {options.map((o) => (
                      <option key={o.id} value={o.id}>{o.name}</option>
                    ))}
                  </optgroup>
                  <option value={CREATE}>➕ Create “{r.name.length > 40 ? r.name.slice(0, 40) + '…' : r.name}”</option>
                </select>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
