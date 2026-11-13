"use client";

import { useEffect, useState } from "react";
import { loadVariableSummary } from "@/lib/api/backend-client";
import { TableBody } from "@/components/science/variable-items";
import { varsFor, type VarRow } from "@/lib/data/variables";

/**
 * One table of the controlled / varied / measured panel. The page HTML carries only the summary line; the column lists are fetched
 * (live /api/variable-summary -> static snapshot) when the section is opened, so /investigations/* stays small.
 */
export function LazyTableDetails({ psiId, table, summary, defaultOpen }: { psiId: string; table: string; summary: string; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const [rows, setRows] = useState<VarRow[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (!open || rows) return;
    let alive = true;
    loadVariableSummary()
      .then((r) => {
        if (!alive) return;
        const v = varsFor(r.data, psiId);
        setRows([...v.controlled, ...v.varied, ...v.measured].filter((x) => x.source_table === table));
      })
      .catch((e: unknown) => alive && setErr(e instanceof Error ? e.message : "could not load variable summary"));
    return () => {
      alive = false;
    };
  }, [open, rows, psiId, table]);
  return (
    <details open={defaultOpen} onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)} className="rounded-xl border border-white/10 bg-[#060e22]/60" data-testid="var-table">
      <summary className="cursor-pointer select-none px-4 py-2.5 text-xs font-semibold text-[#c4d7f2]">{summary}</summary>
      {open && !rows && <p className="px-4 pb-3 text-[11px] text-[#8ea5c7]" role="status">{err ? `Could not load: ${err}` : "Loading variables…"}</p>}
      {open && rows && <TableBody rows={rows} />}
    </details>
  );
}
