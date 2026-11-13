import { Card } from "@/components/ui/card";
import { dedupeByHeader, rowLabel, unitLabel, type PsiVariables, type VarRow } from "@/lib/data/variables";
import { LazyTableDetails } from "@/components/science/variable-lazy-table";

/** Collapsed group: camera / imaging / date / file-path / operator-log / display columns. These are NOT experimental variables. */
export function DiagnosticsGroup({ rows, defaultOpen = false }: { rows: VarRow[]; defaultOpen?: boolean }) {
  if (!rows.length) return null;
  const uniq = dedupeByHeader(rows);
  return (
    <details open={defaultOpen} data-testid="diagnostics-group" className="rounded-xl border border-dashed border-white/15 bg-[#060e22]/40">
      <summary className="cursor-pointer select-none px-4 py-2.5 font-mono text-[10.5px] font-semibold tracking-wider text-[#9cb2d2]">
        Diagnostics / imaging settings ({uniq.length}) · not experimental variables (camera, display, date/GMT, file path, operator log)
      </summary>
      <ul className="grid gap-x-6 px-4 pb-3 md:grid-cols-2">
        {uniq.map((r) => (
          <li key={r.column_name + r.source_table + r.source_sheet} className="border-b border-white/5 py-1 last:border-0" title={r.role_rule ?? undefined}>
            <span className="text-[11px] font-semibold text-[#b7c9e4]">{rowLabel(r)}</span>
            <span className="ml-2 font-mono text-[10px] text-[#6f88ad]">{(r.role_rule ?? "").split(":")[0]}</span>
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
        <p className="font-mono text-[10px] font-bold tracking-[.16em] text-[#52b6ff] uppercase">Controlled vs varied variables</p>
        <p className="mt-2 text-sm text-[#9cb2d2]">{psiId} has no per-test table in the ingested PSI files, so no variable can be classified as controlled or varied. See the investigation record and protocol above.</p>
      </Card>
    );
  }
  const byTable = new Map<string, VarRow[]>();
  for (const r of all) byTable.set(r.source_table, [...(byTable.get(r.source_table) ?? []), r]);
  const tables = [...byTable.entries()].sort((a, b) => Math.max(...b[1].map((r) => r.n_rows ?? 0)) - Math.max(...a[1].map((r) => r.n_rows ?? 0)));
  const unitNote = all.filter((r) => unitLabel(r)).length;
  const unproven = all.filter((r) => unitLabel(r) && !unitLabel(r)!.proven && !unitLabel(r)!.convention).length;
  const conv = all.filter((r) => unitLabel(r)?.convention).length;
  return (
    <Card data-testid="variable-panel" className="mt-6 border border-white/10 bg-[#09152e]/80 p-6 backdrop-blur-md">
      <p className="font-mono text-[10px] font-bold tracking-[.16em] text-[#52b6ff] uppercase">Intra-investigation design // controlled vs varied</p>
      <h2 className="mt-1 text-lg font-extrabold tracking-tight text-[#f4f8ff]">How tests in this investigation were the same vs how they differed</h2>
      <p className="mt-1 text-xs text-[#8ea5c7]">
        Computed from the real PSI tables (exact values, ranges and coverage). Units are shown only where the file states them: <span className="text-emerald-300">green = unit proven by the table header</span>, <span className="text-sky-300">blue = dimensionless mole fraction (mol/mol) by standard combustion-symbol convention, user-confirmed, NOT stated in the PSI file</span>, <span className="text-amber-300">amber = unit not stated</span> ({unproven} of {unitNote} numeric columns here have no stated unit{conv ? `; ${conv} use the mol/mol convention` : ""}).
      </p>
      <p className="mt-1 text-[10.5px] text-[#6f88ad]">Controlled / varied below is per table. A value that is constant inside one table but differs between tables (e.g. Flame Type Normal vs Inverse) is counted as VARIED for the whole investigation in Explore and Compare.</p>
      {auxiliaryOnly && (
        <p className="mt-2 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-[11px] text-amber-200">
          Auxiliary tables only (a planned test envelope or a publication data index), not per-test rows: &quot;controlled&quot; and &quot;varied&quot; below describe the columns of those auxiliary tables.
        </p>
      )}
      <div className="mt-4 space-y-3">
        {tables.map(([tbl, rows], ti) => (
          <LazyTableDetails
            key={tbl}
            psiId={psiId}
            table={tbl}
            defaultOpen={ti === 0}
            summary={`${tableTitle(rows[0])} · ${rows[0].n_rows ?? "?"} rows · ${rows.filter((r) => r.role === "controlled").length} controlled / ${rows.filter((r) => r.role === "varied").length} varied / ${rows.filter((r) => r.role === "measured").length} measured`}
          />
        ))}
        <DiagnosticsGroup rows={vars.diagnostic_imaging} />
      </div>
    </Card>
  );
}
