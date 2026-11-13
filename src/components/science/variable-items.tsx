import { XO2_CONVENTION_NOTE, rowLabel, unitLabel, valueText, type VarRole, type VarRow } from "@/lib/data/variables";

function UnitChip({ r }: { r: VarRow }) {
  const u = unitLabel(r);
  if (!u) return null;
  return (
    <span title={u.convention ? XO2_CONVENTION_NOTE : undefined} className={`ml-1.5 rounded-full border px-1.5 py-px font-mono text-[9px] font-semibold ${u.proven ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300" : u.convention ? "border-sky-400/30 bg-sky-400/10 text-sky-300" : "border-amber-400/30 bg-amber-400/10 text-amber-300"}`}>
      {u.text}
    </span>
  );
}

export function Item({ r }: { r: VarRow }) {
  const cov = r.n_non_null !== null && r.n_rows ? `${r.n_non_null}/${r.n_rows} rows (${(r.pct_non_null ?? (100 * r.n_non_null) / r.n_rows).toFixed(0)}%)` : null;
  return (
    <li className="border-b border-white/5 py-1.5 last:border-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-2">
        <span className="text-[11.5px] font-semibold text-[#e6effc]">
          {rowLabel(r)}
          <UnitChip r={r} />
        </span>
        <span className="font-mono text-[11px] text-[#ffb067]">{valueText(r)}</span>
      </div>
      {r.range_note && <p data-testid="range-note" className="font-mono text-[9.5px] text-amber-300/80">range note: {r.range_note}</p>}
      {cov && <p className="font-mono text-[9.5px] text-[#6f88ad]">{cov}{r.n_unique !== null && r.role === "varied" ? ` · ${r.n_unique} distinct` : ""}</p>}
    </li>
  );
}

const COLS: { role: VarRole; title: string; blurb: string; tone: string }[] = [
  { role: "controlled", title: "SAME (controlled)", blurb: "exactly 1 distinct value in the table", tone: "text-[#7bc5ff]" },
  { role: "varied", title: "DIFFERED (varied)", blurb: "setpoint with more than 1 distinct value; exact range / categories", tone: "text-[#ff8a32]" },
  { role: "measured", title: "MEASURED OUTCOMES", blurb: "output / sensor columns as named in the table", tone: "text-emerald-300" },
];


/** The controlled / varied / measured columns of ONE table. Pure presentational (server or client). */
export function TableBody({ rows }: { rows: VarRow[] }) {
  return (
    <div className="grid gap-4 px-4 pb-4 md:grid-cols-3">
      {COLS.map((c) => {
        const items = rows.filter((r) => r.role === c.role);
        return (
          <div key={c.role}>
            <p className={`font-mono text-[10px] font-bold tracking-[.14em] ${c.tone}`}>{c.title} ({items.length})</p>
            <p className="mb-1 text-[10px] text-[#6f88ad]">{c.blurb}</p>
            {items.length ? <ul>{items.map((r) => <Item key={r.column_name + r.source_sheet} r={r} />)}</ul> : <p className="text-[11px] text-[#6f88ad]">None in this table.</p>}
          </div>
        );
      })}
    </div>
  );
}
