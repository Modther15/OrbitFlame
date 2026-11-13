import { Card } from "@/components/ui/card";
import type { DemoInvestigation } from "@/lib/api/schemas";
import { combinedVars, dedupeByHeader, rowLabel, unitLabel, valueText, varsFor, type VarRow, type VarSummaryPayload } from "@/lib/data/variables";

const PILLAR: Record<string, string> = { PREVENTION: "Prevention", DETECTION: "Detection", SUPPRESSION: "Suppression", OTHER: "Other" };

function VarList({ rows, withValue }: { rows: VarRow[]; withValue: boolean }) {
  const list = dedupeByHeader(rows);
  if (!list.length) return <span className="text-[#6f88ad]">none</span>;
  const shown = list.slice(0, 10);
  const rest = list.slice(10);
  const item = (r: VarRow) => {
    const u = unitLabel(r);
    return (
      <li key={r.column_name + r.source_table} className="leading-4">
        <span className="text-[#e6effc]">{rowLabel(r)}</span>
        {withValue && <span className="font-mono text-[#ffb067]"> {valueText(r)}</span>}
        {u && <span className={`font-mono text-[9.5px] ${u.proven ? "text-emerald-300" : "text-amber-300"}`}> [{u.text}]</span>}
      </li>
    );
  };
  return (
    <>
      <ul className="space-y-1 text-[11px]">{shown.map(item)}</ul>
      {rest.length > 0 && (
        <details className="mt-1">
          <summary className="cursor-pointer font-mono text-[10px] text-[#52b6ff]">+{rest.length} more</summary>
          <ul className="mt-1 space-y-1 text-[11px]">{rest.map(item)}</ul>
        </details>
      )}
    </>
  );
}

function DiagList({ rows }: { rows: VarRow[] }) {
  const list = dedupeByHeader(rows);
  if (!list.length) return <span className="text-[#6f88ad]">none</span>;
  return (
    <details>
      <summary className="cursor-pointer font-mono text-[10px] text-[#8ea5c7]">{list.length} columns (collapsed)</summary>
      <ul className="mt-1 space-y-0.5 text-[10.5px] text-[#9cb2d2]">{list.map((r) => <li key={r.column_name + r.source_table}>{rowLabel(r)}</li>)}</ul>
    </details>
  );
}

/** Side-by-side experiment-design matrix of 2+ investigations (hardware, fuel, conditions, controlled / varied variables, measurements). */
export function ExperimentDesignMatrix({ records, vars, loading }: { records: DemoInvestigation[]; vars: VarSummaryPayload | null; loading: boolean }) {
  const cell = "px-4 py-3 align-top text-[11.5px] text-[#c2d5ee]";
  const rows: { label: string; note?: string; render: (r: DemoInvestigation) => React.ReactNode }[] = [
    { label: "Safety pillar", render: (r) => r.safetyDomains.map((d) => PILLAR[d] ?? d).join(", ") },
    { label: "Hardware (PSI record)", render: (r) => r.hardware ?? "none listed" },
    { label: "Flight program", render: (r) => r.flightProgram ?? "—" },
    { label: "Fuel phase / shape / size", note: "fuel and sample geometry as named in the tables", render: (r) => [r.fuelPhase, r.fuelMaterial].filter(Boolean).join(" · ") || "not reported" },
    { label: "Actual gravity", note: "0.0 g = ISS/Cygnus flight baseline (inferred); 1.0 g only for ground-tagged rows", render: (r) => r.gravityInfo ? `${r.gravityInfo.actualG === null ? "not reported" : `${r.gravityInfo.actualG.toFixed(1)} g`} · ${r.gravityInfo.source?.startsWith("user_stated") ? "user-stated baseline" : "PSI flight metadata"}` : r.conditions.gravity },
    { label: "Effective gravity (proxy)", note: "HEURISTIC flow-equivalent proxy, not measured partial gravity", render: (r) => r.gravityInfo && r.gravityInfo.nProxyRows > 0 ? `${r.gravityInfo.nProxyRows}/${r.testRuns.length} rows: ${Object.entries(r.gravityInfo.proxyBins).map(([b, n]) => `${b.replace("_eq", "")} ${n}`).join(", ")}` : "direct (= actual)" },
    { label: "Test rows (n)", render: (r) => (r.rowStatus === "metadata_only" ? "METADATA & PROTOCOL ONLY IN PSI" : r.testRuns.length.toLocaleString("en-US")) },
    { label: "O2 range", note: "only where a unit-proven O2 column exists", render: (r) => r.ranges?.o2 ?? "no unit-proven O2 column (see varied variables)" },
    { label: "Pressure range", render: (r) => r.ranges?.pressure ?? "no unit-proven pressure column (see varied variables)" },
    { label: "Airflow range", render: (r) => r.ranges?.airflow ?? "no airflow column (see varied variables)" },
    { label: "SAME across tests (controlled)", note: "exactly 1 distinct value", render: (r) => <VarList rows={combinedVars(varsFor(vars, r.id)).controlled} withValue /> },
    { label: "DIFFERED across tests (varied)", note: "exact range / categories", render: (r) => <VarList rows={combinedVars(varsFor(vars, r.id)).varied} withValue /> },
    { label: "Measured outcomes", render: (r) => <VarList rows={varsFor(vars, r.id).measured} withValue={false} /> },
    { label: "Diagnostics / imaging settings", note: "camera, display, date/GMT, file paths, operator log: NOT experimental variables", render: (r) => <DiagList rows={varsFor(vars, r.id).diagnostic_imaging} /> },
  ];
  return (
    <Card data-testid="design-matrix" className="mt-6 overflow-hidden border border-white/10 bg-[#09152e]/85 p-0 backdrop-blur-md">
      <div className="border-b border-white/10 px-6 py-4">
        <span className="font-mono text-[10px] font-semibold tracking-[.16em] text-[#52b6ff] uppercase">EXPERIMENT DESIGN MATRIX // {records.length} INVESTIGATIONS</span>
        <h2 className="mt-1 text-lg font-extrabold tracking-tight text-[#f4f8ff]">Hardware, fuel, conditions, and what was held fixed vs varied</h2>
        <p className="mt-1 text-xs text-[#8ea5c7]">
          Values are computed from the real PSI tables. [unit] in green = unit proven by the table header; amber = unit not stated. {loading ? "Loading variable summary…" : vars ? "" : "Variable summary unavailable."}
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-left">
          <thead>
            <tr className="border-b border-white/10 bg-[#060e22]/85 font-mono text-[10px] tracking-[.14em] text-[#8ea5c7] uppercase">
              <th className="w-[170px] px-4 py-3 font-semibold">Dimension</th>
              {records.map((r) => (
                <th key={r.id} className="min-w-[200px] px-4 py-3 font-semibold text-[#f4f8ff]">
                  <span className="text-[#ff8a32]">{r.id}</span> · {r.family ?? "Other"}
                  <span className="mt-0.5 block font-sans text-xs font-semibold normal-case tracking-normal text-[#c2d5ee]">{r.name}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {rows.map((row) => (
              <tr key={row.label}>
                <td className="px-4 py-3 align-top">
                  <p className="text-[12px] font-semibold text-[#f4f8ff]">{row.label}</p>
                  {row.note && <p className="mt-0.5 text-[10px] leading-3.5 text-[#6f88ad]">{row.note}</p>}
                </td>
                {records.map((r) => (
                  <td key={r.id} className={cell}>{row.render(r)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
