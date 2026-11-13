import { Card } from "@/components/ui/card";
import { dedupeByHeader, rowLabel, type PsiVariables, type VarRow } from "@/lib/data/variables";
import { prettyHeader } from "@/lib/labels";
import { LazyTableDetails } from "@/components/science/variable-lazy-table";

/** Collapsed group: camera / imaging / date / file-path / operator-log / display columns. These are NOT experimental variables. */
export function DiagnosticsGroup({ rows, defaultOpen = false }: { rows: VarRow[]; defaultOpen?: boolean }) {
  if (!rows.length) return null;
  const uniq = dedupeByHeader(rows);
  return (
    <details open={defaultOpen} data-testid="diagnostics-group" className="rounded-xl border border-dashed border-white/15 bg-[#060e22]/40">
      <summary className="cursor-pointer select-none px-4 py-2.5 text-xs font-semibold text-[#9cb2d2]">
        Instrument and imaging settings ({uniq.length})
      </summary>
      <ul className="grid gap-x-6 px-4 pb-3 md:grid-cols-2">
        {uniq.map((r) => (
          <li key={r.column_name + r.source_table + r.source_sheet} className="border-b border-white/5 py-1 last:border-0" title={r.role_rule ?? undefined}>
            <span className="text-[11px] font-semibold text-[#b7c9e4]">{prettyHeader(rowLabel(r)).label}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}

function tableTitle(r: VarRow): string {
  const f = (r.source_file ?? r.source_table).replace(/^PSI-\d+_/, "").replace(/\.(csv|xlsx)$/i, "");
  return r.source_sheet && r.source_sheet !== "csv" ? `${f} [${r.source_sheet}]` : f;
}

/** Same-vs-differed panel for one investigation. Pure presentational (usable from server and client components). */
export function VariablePanel({ vars, psiId, auxiliaryOnly = false }: { vars: PsiVariables; psiId: string; auxiliaryOnly?: boolean }) {
  const all = [...vars.controlled, ...vars.varied, ...vars.measured];
  if (all.length === 0) {
    return (
      <Card className="mt-6 border border-white/10 bg-[#09152e]/80 p-6 backdrop-blur-md">
        <h2 className="text-lg font-extrabold tracking-tight text-[#f4f8ff]">Experiment Design</h2>
        <p className="mt-2 text-sm text-[#9cb2d2]">{psiId} has no per-test table in PSI, so variables are described in the investigation record above.</p>
      </Card>
    );
  }
  const byTable = new Map<string, VarRow[]>();
  for (const r of all) byTable.set(r.source_table, [...(byTable.get(r.source_table) ?? []), r]);
  const tables = [...byTable.entries()].sort((a, b) => Math.max(...b[1].map((r) => r.n_rows ?? 0)) - Math.max(...a[1].map((r) => r.n_rows ?? 0)));
  return (
    <Card data-testid="variable-panel" className="mt-6 border border-white/10 bg-[#09152e]/80 p-6 backdrop-blur-md">
      <h2 className="text-lg font-extrabold tracking-tight text-[#f4f8ff]">Experiment Design: Held Constant vs Varied</h2>
      <p className="mt-1 text-xs text-[#8ea5c7]">What stayed fixed across test runs, what was changed, and what was measured, from the NASA test tables.</p>
      {auxiliaryOnly && (
        <p className="mt-2 text-xs text-[#9cb2d2]">These tables describe a planned test envelope or publication index rather than individual test runs.</p>
      )}
      <div className="mt-4 space-y-3">
        {tables.map(([tbl, rows], ti) => (
          <LazyTableDetails
            key={tbl}
            psiId={psiId}
            table={tbl}
            defaultOpen={ti === 0}
            summary={`${tableTitle(rows[0]).replace(/_/g, " ")} · ${rows[0].n_rows ?? "?"} runs · ${rows.filter((r) => r.role === "controlled").length} held constant · ${rows.filter((r) => r.role === "varied").length} varied · ${rows.filter((r) => r.role === "measured").length} measured`}
          />
        ))}
        <DiagnosticsGroup rows={vars.diagnostic_imaging} />
      </div>
    </Card>
  );
}
