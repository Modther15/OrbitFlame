"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { compactUnit, prettyHeader } from "@/lib/labels";
import { shortenHardware } from "@/lib/science/hardware-label";
import type { DemoInvestigation } from "@/lib/api/schemas";
import { combinedVars, dedupeByHeader, rowLabel, unitLabel, valueText, varsFor, type VarRow, type VarSummaryPayload } from "@/lib/data/variables";

const PILLAR: Record<string, string> = { PREVENTION: "Prevention", DETECTION: "Detection", SUPPRESSION: "Suppression", OTHER: "Other" };

const CAP = 5;
const stripBrackets = (t: string) => t.replace(/\s*\[[^\]]*\]/g, "").replace(/\s*\((?:dimensionless )?mole fraction\)/gi, "").trim();

function VarList({ rows, withValue }: { rows: VarRow[]; withValue: boolean }) {
  const [open, setOpen] = useState(false);
  // Cleanest first: unit-proven / unit-free columns before columns whose unit is not stated; short plain names first.
  const list = [...dedupeByHeader(rows)].sort((x, y) => {
    const score = (r: VarRow) => (unitLabel(r)?.proven === false && !unitLabel(r)?.convention ? 1 : 0) * 2 + (/[_=]/.test(rowLabel(r)) || rowLabel(r).length > 40 ? 1 : 0);
    return score(x) - score(y);
  });
  if (!list.length) return <span className="text-[#6f88ad]">none</span>;
  const shown = open ? list : list.slice(0, CAP);
  const rest = list.length - CAP;
  const pill = (r: VarRow) => {
    const u = unitLabel(r);
    const { label: rawLabel, unit } = prettyHeader(stripBrackets(rowLabel(r)), u?.proven ? u.text : null);
    const label = stripBrackets(rawLabel);
    const isFrac = /mol|fraction|frac/i.test(`${u?.text ?? ""} ${unit} ${rowLabel(r)}`);
    const unitText = unit ? compactUnit(unit) : "";
    const inlineUnit = withValue && unitText && !isFrac ? ` ${unitText}` : "";
    return (
      <li
        key={r.column_name + r.source_table}
        className="max-w-full rounded-lg border border-white/10 bg-[#060e22]/80 px-2.5 py-1 text-[11.5px] leading-4 break-words whitespace-normal text-[#e6effc]"
      >
        {label}
        {withValue ? <>: <span className="font-semibold text-[#ffb067]">{valueText(r)}{inlineUnit}</span></> : null}
        {isFrac ? <span className="ml-1.5 text-[10px] text-[#8ea5c7]">mol frac</span> : null}
        {!withValue && unitText && !isFrac && !label.toLowerCase().includes(unitText.toLowerCase()) ? <span className="ml-1 text-[#8ea5c7]">({unitText})</span> : null}
      </li>
    );
  };
  return (
    <div className="min-w-0">
      <ul className="flex flex-wrap gap-1.5">{shown.map(pill)}</ul>
      {rest > 0 && (
        <button type="button" onClick={() => setOpen((v) => !v)} className="mt-1.5 rounded-full border border-[#36a9ff]/30 px-2.5 py-0.5 text-[11px] font-semibold text-[#52b6ff] hover:border-[#36a9ff]">
          {open ? "Show less" : `+${rest} more`}
        </button>
      )}
    </div>
  );
}

/** Side-by-side experiment-design matrix of 2+ investigations (hardware, fuel, conditions, controlled / varied variables, measurements). */
export function ExperimentDesignMatrix({ records, vars, loading }: { records: DemoInvestigation[]; vars: VarSummaryPayload | null; loading: boolean }) {
  const cell = "px-4 py-3 pr-6 align-top text-[12.5px] break-words text-[#c2d5ee]";
  const rows: { label: string; render: (r: DemoInvestigation) => React.ReactNode }[] = [
    { label: "Pillar", render: (r) => r.safetyDomains.map((d) => PILLAR[d] ?? d).join(", ") },
    { label: "Hardware", render: (r) => shortenHardware(r.hardware, r.flightProgram) ?? "—" },
    { label: "Fuel", render: (r) => [r.fuelPhase, r.fuelMaterial].filter(Boolean).join(" · ") || "not reported" },
    { label: "Gravity", render: (r) => r.gravityInfo && r.gravityInfo.actualG !== null ? `${r.gravityInfo.actualG.toFixed(1)} g${r.gravityInfo.actualG === 0 ? " (microgravity)" : ""}` : r.conditions.gravity },
    { label: "Test runs", render: (r) => (r.rowStatus === "metadata_only" ? "Metadata Only" : r.testRuns.length.toLocaleString("en-US")) },
    { label: "O₂ range", render: (r) => r.ranges?.o2 ?? "—" },
    { label: "Pressure range", render: (r) => r.ranges?.pressure ?? "—" },
    { label: "Airflow range", render: (r) => r.ranges?.airflow ?? "—" },
    { label: "Held Constant", render: (r) => <VarList rows={combinedVars(varsFor(vars, r.id)).controlled} withValue /> },
    { label: "Varied Variables", render: (r) => <VarList rows={combinedVars(varsFor(vars, r.id)).varied} withValue /> },
    { label: "Measured Outcomes", render: (r) => <VarList rows={varsFor(vars, r.id).measured} withValue={false} /> },
  ];
  return (
    <Card data-testid="design-matrix" className="mt-6 overflow-hidden border border-white/10 bg-[#09152e]/85 p-0 backdrop-blur-md">
      <div className="border-b border-white/10 px-6 py-4">
        <h2 className="text-lg font-extrabold tracking-tight text-[#f4f8ff]">Side-by-side comparison</h2>
        {(loading || !vars) && <p className="mt-1 text-xs text-[#8ea5c7]">{loading ? "Loading variables…" : "Variable summary unavailable."}</p>}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left" style={{ minWidth: 170 + records.length * 230 }}>
          <thead>
            <tr className="border-b border-white/10 bg-[#060e22]/85 font-mono text-[10px] tracking-[.14em] text-[#8ea5c7] uppercase">
              <th className="w-[170px] px-4 py-3 font-semibold">Dimension</th>
              {records.map((r) => (
                <th key={r.id} className="min-w-[200px] px-4 py-3 pr-6 font-semibold text-[#f4f8ff]">
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
                  <p className="text-[13px] font-semibold text-[#f4f8ff]">{row.label}</p>
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
