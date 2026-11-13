import { XO2_CONVENTION_NOTE, rowLabel, unitLabel, valueText, type VarRole, type VarRow } from "@/lib/data/variables";
import { compactUnit, prettyHeader } from "@/lib/labels";

function UnitChip({ r }: { r: VarRow }) {
  const u = unitLabel(r);
  if (!u || (!u.proven && !u.convention)) return null; // columns without a stated unit simply show no unit tag
  return (
    <span title={u.convention ? XO2_CONVENTION_NOTE : undefined} className="ml-1.5 rounded-full border border-white/15 bg-white/[0.05] px-1.5 py-px text-[9.5px] font-semibold text-[#9cb2d2]">
      {compactUnit(u.text)}
    </span>
  );
}

export function Item({ r }: { r: VarRow }) {
  const pct = r.n_non_null !== null && r.n_rows ? Math.round(r.pct_non_null ?? (100 * r.n_non_null) / r.n_rows) : null;
  const cov = pct !== null ? `Reported in ${pct}% of runs${r.n_unique !== null && r.role === "varied" ? ` · ${r.n_unique} distinct values` : ""}` : null;
  const label = prettyHeader(rowLabel(r).replace(/\s*\[[^\]]*\]/g, ""), unitLabel(r)?.proven ? unitLabel(r)!.text : null);
  return (
    <li className="border-b border-white/5 py-1.5 last:border-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-2">
        <span className="text-[11.5px] font-semibold text-[#e6effc]">
          {label.label}
          <UnitChip r={r} />
        </span>
        <span className="text-[11.5px] font-semibold text-[#ffb067]">{valueText(r)}</span>
      </div>
      {r.range_note && <p data-testid="range-note" className="text-[10px] text-[#8ea5c7]" title={r.range_note}>Range excludes placeholder values</p>}
      {cov && <p className="text-[10px] text-[#6f88ad]">{cov}</p>}
    </li>
  );
}

const COLS: { role: VarRole; title: string; blurb: string; tone: string }[] = [
  { role: "controlled", title: "Held Constant", blurb: "One fixed setting in this table", tone: "text-[#7bc5ff]" },
  { role: "varied", title: "Varied Between Runs", blurb: "Settings changed from run to run, with range", tone: "text-[#ff8a32]" },
  { role: "measured", title: "Measured Outcomes", blurb: "Quantities recorded as results", tone: "text-emerald-300" },
];


/** The controlled / varied / measured columns of ONE table. Pure presentational (server or client). */
export function TableBody({ rows }: { rows: VarRow[] }) {
  return (
    <div className="grid gap-4 px-4 pb-4 md:grid-cols-3">
      {COLS.map((c) => {
        const items = rows.filter((r) => r.role === c.role);
        return (
          <div key={c.role}>
            <p className={`text-sm font-bold ${c.tone}`}>{c.title} ({items.length})</p>
            <p className="mb-1 text-[11px] text-[#6f88ad]">{c.blurb}</p>
            {items.length ? <ul>{items.map((r) => <Item key={r.column_name + r.source_sheet} r={r} />)}</ul> : <p className="text-[11px] text-[#6f88ad]">None</p>}
          </div>
        );
      })}
    </div>
  );
}
