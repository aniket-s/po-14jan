'use client';

import { useState } from 'react';
import { Factory, CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { FactoryOption, FactoryResolution } from './types';

interface Props {
  factories: FactoryResolution[];
  factoryMap: Record<string, number | null>;
  setFactoryId: (name: string, id: number | null) => void;
  options: FactoryOption[];
  onCreate: (name: string) => Promise<FactoryOption | null>;
}

const CREATE = '__create__';
const BLANK = '';
const UNSET = '__unset__';

export function FactoryResolveStep({ factories, factoryMap, setFactoryId, options, onCreate }: Props) {
  const [creating, setCreating] = useState<Record<string, boolean>>({});

  const unresolved = factories.filter((f) => factoryMap[f.name] === undefined).length;

  const handleChange = async (f: FactoryResolution, value: string) => {
    if (value === BLANK) { setFactoryId(f.name, null); return; }
    if (value === CREATE) {
      setCreating((p) => ({ ...p, [f.name]: true }));
      try {
        const created = await onCreate(f.name.slice(0, 255));
        if (created) {
          setFactoryId(f.name, created.id);
          toast.success(`Factory “${created.name}” created`);
        }
      } catch (e) {
        toast.error((e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Could not create factory');
      } finally {
        setCreating((p) => ({ ...p, [f.name]: false }));
      }
      return;
    }
    setFactoryId(f.name, Number(value));
  };

  const valueFor = (name: string): string => {
    const v = factoryMap[name];
    if (v === undefined) return UNSET;
    if (v === null) return BLANK;
    return String(v);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm">
        <Factory className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium">{factories.length} factor{factories.length === 1 ? 'y' : 'ies'} from the sheet</span>
        {unresolved > 0
          ? <span className="text-amber-600">· {unresolved} not matched yet</span>
          : <span className="text-emerald-600">· all set</span>}
      </div>
      <p className="text-xs text-muted-foreground">
        Match each factory name to an existing factory, or create one. Creating makes a placeholder factory
        (no login) just so the assignment and factory price attach to the right factory — you can activate it later.
        Factory is optional: leave a name blank to import those styles unassigned.
      </p>

      <div className="rounded-md border divide-y">
        {factories.map((f) => {
          const val = valueFor(f.name);
          const resolved = factoryMap[f.name];
          const isCreating = creating[f.name];
          return (
            <div key={f.name} className="flex items-center gap-3 px-3 py-2">
              <span className="shrink-0">
                {resolved === undefined
                  ? <AlertTriangle className="h-4 w-4 text-amber-500" />
                  : resolved === null
                  ? <span className="block h-2.5 w-2.5 rounded-full bg-muted-foreground/40" />
                  : <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate" title={f.name}>{f.name}</div>
                <div className="text-[11px] text-muted-foreground">
                  {f.po_count} PO{f.po_count === 1 ? '' : 's'} · {f.style_count} style{f.style_count === 1 ? '' : 's'}
                  {f.matched_name && resolved != null && (
                    <span className="text-emerald-700 dark:text-emerald-400"> · matched “{f.matched_name}”</span>
                  )}
                </div>
              </div>
              {isCreating ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : (
                <select
                  value={val}
                  onChange={(e) => handleChange(f, e.target.value)}
                  className="h-8 min-w-[220px] max-w-[280px] rounded-md border bg-background px-2 text-sm"
                >
                  {val === UNSET && <option value={UNSET} disabled hidden>Choose a factory…</option>}
                  <option value={BLANK}>— Leave blank —</option>
                  <optgroup label="Existing factories">
                    {options.map((o) => (
                      <option key={o.id} value={o.id}>{o.company ? `${o.name} (${o.company})` : o.name}</option>
                    ))}
                  </optgroup>
                  <option value={CREATE}>➕ Create “{f.name.length > 40 ? f.name.slice(0, 40) + '…' : f.name}”</option>
                </select>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
