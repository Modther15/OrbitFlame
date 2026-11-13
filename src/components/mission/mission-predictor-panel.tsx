"use client";

import { Flame, Loader2, Wind } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { HAB_KEYS } from "@/components/mission/habitat-keys";
import { Card } from "@/components/ui/card";
import {
  predictFlammability,
  predictFlammabilityRaw,
  predictSmokeDust,
  type FlammabilityResult,
  type SmokeResult,
} from "@/lib/api/backend-client";
import type {
  DataSourceMode,
  EffectiveGravityPayload,
  FlammabilityResponse,
  HabitatInfo,
  NearestRealRow,
  RankAllPayload,
  SmokeCandidateResult,
} from "@/lib/api/backend-types";
import { buildRequest, defaultsOf, FAMILIES, type Control, type Family } from "@/components/mission/predictor-families";
import { recordIdFromPsi } from "@/lib/data/psi-mapper";
import { fmtNum, humanizeKey } from "@/lib/labels";

export type PanelView = "habitat" | "flammability" | "smoke";

const HAB_SHORT: Record<string, string> = { iss: "ISS", moon: "Moon Base", mars: "Mars", eva: "EVA Suit", earth: "Earth Analog" };
const HAB_ACCENT: Record<string, string> = { iss: "0 g", moon: "0.16 g", mars: "0.38 g", eva: "Suit", earth: "1 g" };
type BarSpec = { label: string; value: (row: Record<string, unknown>) => number };
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const BARS: BarSpec[] = [
  { label: "Atmosphere", value: (r) => (num(r.sim_po2) + num(r.sim_pressure)) / 2 },
  { label: "Airflow", value: (r) => num(r.sim_flow) },
  { label: "Gravity", value: (r) => Math.max(num(r.sim_gravity_actual), 0.5 * num(r.sim_gravity_proxy)) },
  { label: "Fuel", value: (r) => num(r.sim_fuel) },
];

/** PSI-101 'Sample Type' values (SAME-R experimental table); the analyzer only knows these real materials. */
const SMOKE_MATERIALS = ["Kapton", "Silicone", "Lampwick", "Pyrell", "Teflon"] as const;
const sliderCls = "mt-2 w-full accent-[#36a9ff]";
const pillBtn = (active: boolean) =>
  `rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors ${
    active
      ? "border-[#ff8a32]/55 bg-[#ff5500]/20 text-[#ffb067]"
      : "border-white/10 bg-[#050b1b] text-[#9cb2d2] hover:border-white/25 hover:text-white"
  }`;

/** Lightweight hover/focus tooltip (no provider needed). */
export function Tip({ text, children, className = "" }: { text: string; children: ReactNode; className?: string }) {
  return (
    <span className={`group/tip relative inline-flex ${className}`} tabIndex={0}>
      {children}
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-full left-0 z-30 mb-1.5 hidden w-64 rounded-lg border border-white/15 bg-[#050b1b] p-2.5 text-left text-[11px] leading-4 font-normal tracking-normal text-[#c4d7f2] normal-case shadow-xl group-hover/tip:block group-focus/tip:block"
      >
        {text}
      </span>
    </span>
  );
}

function decimals(step: number): number {
  const s = String(step);
  return s.includes(".") ? s.split(".")[1].length : 0;
}

function Slider({
  label, unit, value, min, max, step, onChange, extra, hint, testId,
}: {
  label: string; unit: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void; extra?: string; hint?: string; testId?: string;
}) {
  const shown = decimals(step) > 0 ? value.toFixed(Math.min(2, decimals(step))) : String(value);
  const u = unit ? (unit.startsWith("%") ? unit : ` ${unit}`) : "";
  return (
    <label className="block" title={hint}>
      <span className="block text-xs font-semibold text-[#c4d7f2]">
        {label}: <span className="font-bold text-[#f4f8ff]">{shown}{u}{extra ? ` (${extra})` : ""}</span>
      </span>
      <input data-testid={testId} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className={sliderCls} />
    </label>
  );
}

/* ------------------------------ KPI cards + nearest tests ------------------------------ */

type KpiMeta = { title: string; unit: string; digits: number; kind: "reg" | "clf" };
const KPI_META: Record<string, KpiMeta> = {
  flex_burning_rate: { title: "Droplet Burning Rate", unit: "mm²/s", digits: 2, kind: "reg" },
  flex_extinction_outcome: { title: "Extinction Likelihood", unit: "", digits: 0, kind: "clf" },
  flex_extinction_diameter: { title: "Extinction Diameter", unit: "mm", digits: 2, kind: "reg" },
  cfi_khot: { title: "Hot-Flame Burning Rate (K)", unit: "mm²/s", digits: 2, kind: "reg" },
  cfi_dext_hot: { title: "Hot-Flame Extinction Diameter", unit: "mm", digits: 2, kind: "reg" },
  cfig_inverse_self_extinguish: { title: "Self-Extinction Probability", unit: "", digits: 0, kind: "clf" },
  cfig_normal_self_extinguish: { title: "Self-Extinction Probability", unit: "", digits: 0, kind: "clf" },
  cfig_inverse_burn_time: { title: "Flame Burn Time", unit: "s", digits: 0, kind: "reg" },
  cfig_normal_burn_time: { title: "Flame Burn Time", unit: "s", digits: 0, kind: "reg" },
  cfig_inverse_hot_ignition: { title: "Hot-Ignition Probability", unit: "", digits: 0, kind: "clf" },
  cfig_normal_hot_ignition: { title: "Hot-Ignition Probability", unit: "", digits: 0, kind: "clf" },
  spice_burn_time: { title: "Flame Burn Time", unit: "s", digits: 0, kind: "reg" },
};

type Scores = { model?: Record<string, number | number[]>; dummy_mean?: Record<string, number>; dummy_prior?: Record<string, number> };

function KpiCard({ c }: { c: SmokeCandidateResult }) {
  const meta = KPI_META[c.candidate] ?? { title: c.title, unit: "", digits: 2, kind: c.prediction?.probability_positive_class !== undefined ? "clf" : "reg" };
  const sc = c.scores as Scores | null | undefined;
  const dummy = sc?.dummy_mean ?? sc?.dummy_prior;
  const isModel = c.mode === "model" && c.prediction;
  const p = c.prediction;
  const metricKey = meta.kind === "clf" ? "roc_auc" : "r2";
  const mv = sc?.model?.[metricKey];
  const dv = dummy?.[metricKey];
  const pill = isModel && typeof mv === "number" ? `${meta.kind === "clf" ? "ROC-AUC" : "R²"} ${mv.toFixed(2)}` : null;
  const tip = isModel && typeof mv === "number"
    ? `Cross-validated across experiment groups (naive baseline ${meta.kind === "clf" ? "ROC-AUC" : "R²"} ${typeof dv === "number" ? dv.toFixed(2) : "n/a"}). Trained on ${c.n_samples} NASA test rows.`
    : "No model beat the naive baseline under cross-validation for this output, so only nearby real NASA tests are shown.";
  let value = "—";
  let err = "";
  if (isModel && p) {
    if (meta.kind === "clf" && p.probability_positive_class !== undefined) value = `${(p.probability_positive_class * 100).toFixed(0)}%`;
    else if (p.value !== undefined) {
      value = p.value.toFixed(meta.digits);
      if (p.typical_error_mae_group_cv !== undefined) err = ` ± ${p.typical_error_mae_group_cv.toFixed(meta.digits)}`;
    }
  }
  return (
    <div data-testid={`kpi-${c.candidate}`} className="flex flex-col rounded-xl border border-white/10 bg-[#050d21]/85 p-4">
      <p className="text-sm font-semibold text-[#c4d7f2]">{meta.title}</p>
      <p className="mt-1.5 text-3xl font-extrabold leading-tight break-words text-[#f4f8ff]">
        {value}
        {err && <span className="text-base font-bold text-[#c4d7f2]">{err}</span>}
        {meta.unit && value !== "—" && <span className="ml-1 text-sm font-semibold text-[#8ea5c7]">{meta.unit}</span>}
      </p>
      <p className="mt-2 text-[11px] text-[#7d95b8]" title={tip}>{pill ? `Model fit · ${pill}` : "Nearest-test lookup only"}</p>
    </div>
  );
}

function featFuel(f: Record<string, number | string | null>): string {
  const hot = Object.entries(f).find(([k, v]) => k.startsWith("fuel=") && v === 1);
  if (hot) return hot[0].split("=")[1].replace(/\b[a-z]/g, (m) => m.toUpperCase());
  const plain = f["fuel"];
  return typeof plain === "string" ? plain : "—";
}

function rowLabel(n: NearestRealRow): string {
  const id = n.source_file.match(/^(PSI-\d+)/)?.[1] ?? "PSI";
  return `${id} · row ${n.source_row}`;
}

const MOLE = (v: unknown) => (typeof v === "number" ? `${(v * 100).toFixed(0)}%` : "—");

type Col = { head: string; cell: (n: NearestRealRow) => string; accent?: boolean };

/** FLEX-specific compact columns (all values come straight from the PSI-69 table row). */
const FLEX_COLS: Col[] = [
  { head: "Fuel", cell: (n) => featFuel(n.features) },
  { head: "Pressure", cell: (n) => `${fmtNum(n.features["ambient_pressure__mmhg"], 0)} mmHg` },
  { head: "O₂ %", cell: (n) => MOLE(n.features["o_initial_ambient_composition__mole_fraction"]) },
  { head: "Droplet Size", cell: (n) => `${fmtNum(n.features["droplet_initial_diameter__mm"])} mm` },
  { head: "Measured Burn Rate", cell: (n) => (n.outcomes["burning_rate__mm"] != null ? `${fmtNum(n.outcomes["burning_rate__mm"])} mm²/s` : "—"), accent: true },
  { head: "Outcome", cell: (n) => (typeof n.outcomes["test_end"] === "string" ? String(n.outcomes["test_end"]) : "—"), accent: true },
];

function genericCols(rows: NearestRealRow[]): Col[] {
  const cols: Col[] = [];
  if (rows.some((r) => Object.keys(r.features).some((k) => k.startsWith("fuel=") || k === "fuel"))) cols.push({ head: "Fuel", cell: (n) => featFuel(n.features) });
  const fkeys = Object.keys(rows[0]?.features ?? {}).filter((k) => !k.includes("=") && k !== "fuel" && !k.startsWith("data_"));
  for (const k of fkeys) cols.push({ head: humanizeKey(k), cell: (n) => fmtNum(n.features[k]) });
  const okeys = Object.keys(rows[0]?.outcomes ?? {}).filter((k) => rows.some((r) => r.outcomes[k] != null));
  for (const k of okeys) cols.push({ head: humanizeKey(k), accent: true, cell: (n) => { const v = n.outcomes[k]; return typeof v === "string" && !Number.isFinite(Number(v)) ? v : fmtNum(v); } });
  return cols;
}

function NearestRunsTable({ rows, familyId }: { rows: NearestRealRow[]; familyId: string }) {
  if (!rows.length) return <p className="text-xs text-[#8ea5c7]">No nearby NASA test runs found for these inputs.</p>;
  const cols = familyId === "flex" ? FLEX_COLS : genericCols(rows);
  return (
    <div className="overflow-x-auto rounded-xl border border-white/10 bg-[#050d21]/80">
      <table data-testid="nearest-runs-table" className="w-full text-left text-xs">
        <thead>
          <tr className="border-b border-white/10 text-[11px] font-semibold text-[#8ea5c7]">
            <th className="px-3 py-2.5">Test Row</th>
            <th className="px-3 py-2.5">Match Dist.</th>
            {cols.map((c) => <th key={c.head} className="px-3 py-2.5">{c.head}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/10 text-[#c4d7f2]">
          {rows.map((n, i) => (
            <tr key={i} className="align-top">
              <td className="px-3 py-2.5 font-semibold text-[#7bc5ff]">{rowLabel(n)}</td>
              <td className="px-3 py-2.5 tabular-nums">{fmtNum(n.distance)}</td>
              {cols.map((c) => <td key={c.head} className={`px-3 py-2.5 ${c.accent ? "font-semibold text-[#ffb067]" : ""}`}>{c.cell(n)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------- main panel ------------------------------------- */

export function MissionPredictorPanel({
  habitats,
  rankings,
  initialHabitat,
  metadataOnly = [],
  totalInvestigations = 0,
  view = "habitat",
  ladderSlot,
}: {
  metadataOnly?: { id: string; name: string }[];
  totalInvestigations?: number;
  habitats: HabitatInfo[];
  rankings: RankAllPayload | null;
  ladder?: EffectiveGravityPayload | null;
  initialHabitat: (typeof HAB_KEYS)[number];
  dataSource?: DataSourceMode;
  view?: PanelView;
  ladderSlot?: ReactNode;
}) {
  const [habKey, setHabKey] = useState<(typeof HAB_KEYS)[number]>(initialHabitat);
  const hab = habitats.find((h) => h.key === habKey);

  // Analytical convection / LOC inputs
  const [g, setG] = useState(hab?.gravity_g ?? 0);
  const [pKpa, setPKpa] = useState(Math.round(hab?.pressure_kpa ?? 101.3));
  const [o2, setO2] = useState(Math.round(hab?.o2_pct ?? 21));
  const [flow, setFlow] = useState(Math.round(((hab?.ventilation_cm_s?.[0] ?? 5) + (hab?.ventilation_cm_s?.[1] ?? 20)) / 2));
  const [flam, setFlam] = useState<FlammabilityResult | null>(null);
  const [busy, setBusy] = useState(false);

  // Real-data predictor families
  const [famId, setFamId] = useState(FAMILIES[0].id);
  const fam: Family = FAMILIES.find((f) => f.id === famId) ?? FAMILIES[0];
  const [famVals, setFamVals] = useState<Record<string, Record<string, number | string>>>(() => Object.fromEntries(FAMILIES.map((f) => [f.id, defaultsOf(f)])));
  const [famRes, setFamRes] = useState<FlammabilityResponse | null>(null);
  const [famBusy, setFamBusy] = useState(false);
  const [famErr, setFamErr] = useState<string | null>(null);

  const [smokeMat, setSmokeMat] = useState<(typeof SMOKE_MATERIALS)[number]>("Kapton");
  const [smokeVel, setSmokeVel] = useState(5);
  const [smokeAge, setSmokeAge] = useState(60);
  const [smoke, setSmoke] = useState<SmokeResult | null>(null);
  const [smokeBusy, setSmokeBusy] = useState(false);

  useEffect(() => {
    if (view !== "habitat") return;
    let alive = true;
    const t = setTimeout(() => {
      setBusy(true);
      predictFlammability({ gravity_g: g, pressure_kpa: pKpa, o2_pct: o2, flow_velocity_cm_s: flow, fuel: "physics-only", fuel_phase: "Gas" })
        .then((r) => alive && setFlam(r))
        .catch(() => alive && setFlam(null))
        .finally(() => alive && setBusy(false));
    }, 250);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [view, g, pKpa, o2, flow]);

  const famVal = famVals[famId];
  useEffect(() => {
    if (view !== "flammability") return;
    let alive = true;
    const body = buildRequest(fam, famVal);
    const t = setTimeout(() => {
      setFamBusy(true);
      predictFlammabilityRaw(body)
        .then((r) => { if (alive) { setFamRes(r); setFamErr(null); } })
        .catch(() => { if (alive) { setFamRes(null); setFamErr("The prediction models could not be reached. Reload the page; if it persists, restart the app (npm run dev or npm start)."); } })
        .finally(() => alive && setFamBusy(false));
    }, 250);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [view, fam, famVal]);

  useEffect(() => {
    if (view !== "smoke") return;
    let alive = true;
    const t = setTimeout(() => {
      setSmokeBusy(true);
      predictSmokeDust({ sample_material: smokeMat, inlet_velocity_cm_s: smokeVel, net_aging_time_s: smokeAge })
        .then((r) => alive && setSmoke(r))
        .catch(() => alive && setSmoke(null))
        .finally(() => alive && setSmokeBusy(false));
    }, 250);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [view, smokeMat, smokeVel, smokeAge]);

  function selectHabitat(k: (typeof HAB_KEYS)[number]) {
    setHabKey(k);
    const h = habitats.find((x) => x.key === k);
    if (!h) return;
    setG(h.gravity_g);
    setPKpa(Math.round(h.pressure_kpa));
    setO2(Math.round(h.o2_pct));
    setFlow(Math.round((h.ventilation_cm_s[0] + h.ventilation_cm_s[1]) / 2));
  }

  const top = useMemo(() => {
    const r = rankings?.habitats?.[habKey];
    if (!r) return [];
    const bestRow = new Map<string, (typeof r.ranked)[number]>();
    for (const row of r.ranked) if (!bestRow.has(row.psi_id)) bestRow.set(row.psi_id, row);
    return r.by_investigation.slice(0, 6).map((b) => ({ ...b, row: bestRow.get(b.psi_id) }));
  }, [rankings, habKey]);

  const pred = flam?.response.prediction;
  /* ------------------------------ 1. Habitat risk + ranker ------------------------------ */
  if (view === "habitat") {
    return (
      <Card data-testid="physics-ranking-panel" className="col-span-full w-full border border-[#36a9ff]/25 bg-[#09152e]/85 p-5 backdrop-blur-md sm:p-6">
        <div className="border-b border-white/10 pb-3">
          <h2 className="text-lg font-extrabold tracking-tight text-[#f4f8ff]">Which NASA experiments best match your habitat?</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-[#9cb2d2]">Pick an environment. Each investigation gets a 0–100 score from how closely its best test matches it.</p>
        </div>

        <div className="mt-4 grid w-full grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5" data-testid="habitat-cards">
          {HAB_KEYS.map((k) => {
            const h = habitats.find((x) => x.key === k);
            const active = habKey === k;
            return (
              <button
                key={k}
                type="button"
                aria-pressed={active}
                onClick={() => selectHabitat(k)}
                className={`rounded-xl border p-3.5 text-left transition-all ${active ? "border-[#36a9ff]/60 bg-[linear-gradient(135deg,#0d254f_0%,#13386e_100%)] shadow-[0_6px_18px_-6px_rgba(54,169,255,0.45)]" : "border-white/10 bg-[#060e22]/80 hover:border-white/25"}`}
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold text-[#f4f8ff]">{HAB_SHORT[k]}</span>
                  <span className="rounded-full border border-[#ff8a32]/40 bg-[#ff5500]/15 px-2 py-0.5 font-mono text-[10px] font-bold text-[#ffb067]">{HAB_ACCENT[k]}</span>
                </span>
                {h && (
                  <dl className="mt-2.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[11.5px]">
                    <dt className="text-[#8ea5c7]">Pressure</dt><dd className="text-right font-semibold text-[#e5efff]">{h.pressure_kpa.toFixed(1)} kPa</dd>
                    <dt className="text-[#8ea5c7]">Oxygen</dt><dd className="text-right font-semibold text-[#e5efff]">{h.o2_pct}%</dd>
                    <dt className="text-[#8ea5c7]">Gravity</dt><dd className="text-right font-semibold text-[#e5efff]">{h.gravity_g} g</dd>
                    <dt className="text-[#8ea5c7]">Airflow</dt><dd className="text-right font-semibold text-[#e5efff]">{h.ventilation_cm_s[0]}–{h.ventilation_cm_s[1]} cm/s</dd>
                  </dl>
                )}
              </button>
            );
          })}
        </div>
        {hab && (
          <p className="mt-3 rounded-lg border border-white/10 bg-[#060e22]/70 p-3 text-xs leading-5 text-[#a8bedf]">
            <span className="font-semibold text-[#e5efff]">{hab.name}</span> · Airflow basis: {hab.ventilation_citation}
          </p>
        )}
        <h3 className="mt-6 text-base font-bold text-[#f4f8ff]">Top investigations for {HAB_SHORT[habKey]}</h3>
        <ol className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3" data-testid="ranking-leaderboard">
          {top.map((t, i) => (
            <li key={t.psi_id} className="rounded-xl border border-white/10 bg-[#050d21]/80 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-mono text-[11px] font-bold text-[#ff8a32]">#{i + 1} · {t.psi_id}</p>
                  <Link href={`/investigations/${encodeURIComponent(recordIdFromPsi(t.psi_id))}`} className="mt-0.5 block text-sm font-bold break-words text-[#7bc5ff] hover:underline">
                    {t.investigation}
                  </Link>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-3xl leading-none font-extrabold text-[#f4f8ff]">{Math.round(t.max_score)}<span className="text-sm font-semibold text-[#8ea5c7]">/100</span></p>
                </div>
              </div>
              {t.row && (
                <div className="mt-4 space-y-2">
                  {BARS.map((bar) => {
                    const pct = Math.round(Math.min(1, bar.value(t.row as Record<string, unknown>)) * 100);
                    return (
                      <div key={bar.label} className="grid grid-cols-[80px_1fr_38px] items-center gap-2 text-xs">
                        <span className="text-[#b5c9e8]">{bar.label}</span>
                        <span className="h-2 overflow-hidden rounded-full bg-white/10"><span className="block h-full rounded-full bg-[linear-gradient(90deg,#0b3d91,#36a9ff)]" style={{ width: `${pct}%` }} /></span>
                        <span className="text-right font-mono text-[#c4d7f2]">{pct}%</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </li>
          ))}
        </ol>
        {metadataOnly.length > 0 && (
          <p data-testid="ranking-coverage-note" className="mt-2 rounded-lg border border-white/10 bg-[#060e22]/70 p-3 text-xs leading-5 text-[#a8bedf]">
            Ranking covers {totalInvestigations - metadataOnly.length} of {totalInvestigations} PSI investigations (those with per-test data). Metadata-only:{" "}
            {metadataOnly.map((m, i) => (
              <span key={m.id}>{i > 0 && ", "}<Link href={`/investigations/${m.id}`} className="font-semibold text-[#7bc5ff] hover:underline">{m.id}</Link></span>
            ))}.
          </p>
        )}

        <div className="mt-6 grid grid-cols-1 gap-6 border-t border-white/10 pt-5 lg:grid-cols-2">
          <div className="min-w-0">{ladderSlot}</div>
          <div data-testid="physics-block" className="min-w-0 rounded-xl border border-white/10 bg-[#060e22]/70 p-5">
            <div className="flex items-center gap-2"><Flame size={15} className="text-[#ff8a32]" aria-hidden="true" /><h3 className="text-sm font-bold text-[#f4f8ff]">Analytical Convection &amp; LOC Calculator</h3></div>
            <p className="mt-1 text-xs leading-5 text-[#8ea5c7]">Closed-form physics estimate of flammability and the limiting oxygen concentration (LOC) for any gravity.</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {[0, 0.16, 0.38, 1].map((gv) => (
                <button key={gv} type="button" aria-pressed={g === gv} onClick={() => setG(gv)} className={pillBtn(g === gv)}>{gv} g</button>
              ))}
            </div>
            <div className="mt-4 space-y-4">
              <Slider testId="slider-physics-o2" label="Oxygen Concentration" unit="%" value={o2} min={15} max={100} step={1} onChange={setO2} />
              <Slider testId="slider-physics-p" label="Ambient Pressure" unit="kPa" value={pKpa} min={20} max={110} step={1} onChange={setPKpa} />
              <Slider testId="slider-physics-flow" label="Ventilation Airflow" unit="cm/s" value={flow} min={0} max={40} step={1} onChange={setFlow} />
            </div>
            <div className="mt-4 rounded-xl border border-white/10 bg-[#050d21]/90 p-3.5" aria-live="polite">
              <div className="flex items-center justify-between text-[11px] font-semibold text-[#8ea5c7]">
                <span>Analytical outputs</span>{busy && <Loader2 size={12} className="animate-spin" />}
              </div>
              {pred ? (
                <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs text-[#c4d7f2]">
                  <dt className="text-[#8ea5c7]">Limiting Oxygen Concentration</dt><dd className="font-semibold">{pred.limiting_o2_index_pct != null ? `${pred.limiting_o2_index_pct.toFixed(1)}%` : "—"}</dd>
                  <dt className="text-[#8ea5c7]">Effective Flow</dt><dd className="font-semibold">{pred.u_eff_cm_s.toFixed(1)} cm/s</dd>
                  <dt className="text-[#8ea5c7]">Ventilation Hazard Index</dt><dd className="font-semibold">{pred.ventilation_hazard.toFixed(2)}</dd>
                  <dt className="text-[#8ea5c7]">O₂ Partial Pressure</dt><dd className="font-semibold">{pred.po2_kpa.toFixed(1)} kPa</dd>
                  <dt className="text-[#8ea5c7]">Oxygen vs. LOC</dt><dd className={`font-bold ${pred.above_loc ? "text-[#ff8a32]" : "text-[#7bc5ff]"}`}>{pred.above_loc ? "Above LOC (flammable)" : "Below LOC"}</dd>
                </dl>
              ) : (
                <p className="mt-1.5 text-xs text-[#8ea5c7]">Physics response unavailable.</p>
              )}
              {flam?.approximate && <p className="mt-2 text-[11px] text-amber-300">Fallback mode: nearest precomputed grid cell. Run the app with npm run dev / npm start for exact values.</p>}
            </div>
          </div>
        </div>
      </Card>
    );
  }

  /* ------------------------------ 2. Flammability & extinction lab ------------------------------ */
  if (view === "flammability") {
    const cands = (famRes?.prediction.empirical ?? []).filter((c) => c.candidate.startsWith(fam.candidatePrefix) && (!fam.candidateIncludes || c.candidate.includes(fam.candidateIncludes)));
    const primary = cands.find((c) => c.nearest.rows.length > 0);
    const nearestRows = (primary?.nearest.rows ?? []).slice(0, 3);
    const renderControl = (c: Control) =>
      c.kind === "select" ? (
        <label key={c.id} className="block">
          <span className="block text-xs font-semibold text-[#c4d7f2]">{c.label}</span>
          <select data-testid={`ctl-${fam.id}-${c.id}`} value={String(famVal[c.id])} onChange={(e) => setFamVals((p) => ({ ...p, [famId]: { ...p[famId], [c.id]: e.target.value } }))} className="mt-1.5 w-full rounded-xl border border-white/15 bg-[#050b1b] px-3 py-2 text-xs text-[#f4f8ff] focus:border-[#36a9ff] focus:outline-none">
            {c.options.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </label>
      ) : (
        <Slider
          key={c.id}
          testId={`ctl-${fam.id}-${c.id}`}
          label={c.label}
          unit={c.unit}
          value={Number(famVal[c.id])}
          min={c.min}
          max={c.max}
          step={c.step}
          extra={c.extra ? c.extra(Number(famVal[c.id])) : undefined}
          hint={`Range tested by NASA: ${c.min}–${c.max}${c.unit ? ` ${c.unit}` : ""}${c.note ? `. ${c.note}` : ""}`}
          onChange={(v) => setFamVals((p) => ({ ...p, [famId]: { ...p[famId], [c.id]: v } }))}
        />
      );
    return (
      <Card data-testid="ml-predictor-panel" className="col-span-full w-full border border-[#36a9ff]/25 bg-[#09152e]/85 p-5 backdrop-blur-md sm:p-6">
        <div className="border-b border-white/10 pb-3">
          <h2 className="text-lg font-extrabold tracking-tight text-[#f4f8ff]">Flammability &amp; Extinction Lab</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-[#9cb2d2]">Set the test conditions and see predicted burning and extinction, next to the closest real NASA tests.</p>
        </div>

        <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Experiment">
          {FAMILIES.map((f) => (
            <button key={f.id} type="button" aria-pressed={famId === f.id} onClick={() => setFamId(f.id)} className={pillBtn(famId === f.id)}>
              {f.title} · {f.psi}
            </button>
          ))}
        </div>
        
        <div data-testid="family-predictor" className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="space-y-4 rounded-xl border border-white/10 bg-[#060e22]/70 p-4 lg:col-span-4">
            {fam.controls.map(renderControl)}
          </div>
          <div className="min-w-0 space-y-5 lg:col-span-8" aria-live="polite">
            {famErr && <p className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">{famErr}</p>}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3" data-testid="kpi-grid">
              {cands.slice(0, 3).map((c) => <KpiCard key={c.candidate} c={c} />)}
            </div>
            {famRes && cands.length === 0 && <p className="text-xs text-[#8ea5c7]">No model is available for this fuel in {fam.psi}.</p>}
            {cands.length > 3 && (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {cands.slice(3).map((c) => <KpiCard key={c.candidate} c={c} />)}
              </div>
            )}
            <div>
              <h3 className="flex items-center gap-2 text-base font-bold text-[#f4f8ff]">Nearest Real NASA Tests {famBusy && <Loader2 size={13} className="animate-spin" />}</h3>
              <div className="mt-2"><NearestRunsTable rows={nearestRows} familyId={fam.id} /></div>
            </div>
          </div>
        </div>
      </Card>
    );
  }

  /* ------------------------------ 3. Smoke detection & aerosol lab ------------------------------ */
  const samer = smoke?.response.samer_psi101;
  const sc = samer?.scores as { model?: { r2?: number }; dummy_mean?: { r2?: number } } | null | undefined;
  const smokeRows = (samer?.nearest.rows ?? []).slice(0, 4);
  return (
    <Card data-testid="smoke-analyzer" className="col-span-full w-full border border-[#36a9ff]/25 bg-[#09152e]/85 p-5 backdrop-blur-md sm:p-6">
      <div className="border-b border-white/10 pb-3">
        <h2 className="flex items-center gap-2 text-lg font-extrabold tracking-tight text-[#f4f8ff]"><Wind size={18} className="text-[#52b6ff]" aria-hidden="true" />Smoke Detection Lab (SAME / SAME-R)</h2>
        <p className="mt-1 max-w-3xl text-sm leading-6 text-[#9cb2d2]">See how smoke aging and airflow change a detector&apos;s reading (Rt/R0, reading relative to its baseline), based on real flight tests.</p>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="space-y-4 rounded-xl border border-white/10 bg-[#060e22]/70 p-4 lg:col-span-4">
          <div>
            <span className="block text-xs font-semibold text-[#c4d7f2]">Smoke Source Material</span>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {SMOKE_MATERIALS.map((m) => (
                <button key={m} type="button" aria-pressed={smokeMat === m} onClick={() => setSmokeMat(m)} className={pillBtn(smokeMat === m)}>{m}</button>
              ))}
            </div>
          </div>
          <Slider testId="slider-smoke-velocity" label="Inlet Velocity (cm/s)" unit="" value={smokeVel} min={0} max={8.1} step={0.1} onChange={setSmokeVel} hint="Range tested in PSI-101: 0–8.1 cm/s" />
          <Slider testId="slider-smoke-aging" label="Smoke Aging Time (s)" unit="" value={smokeAge} min={21} max={1923} step={1} onChange={setSmokeAge} hint="Range tested in PSI-101: 21–1923 s" />
        </div>

        <div className="min-w-0 space-y-4 lg:col-span-8" aria-live="polite">
          <div className="rounded-xl border border-white/10 bg-[#050d21]/85 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#c4d7f2]">Detector Response (Rt/R0) {smokeBusy && <Loader2 size={12} className="animate-spin" />}</div>
            {samer ? (
              samer.mode === "model" && samer.prediction?.value !== undefined ? (
                <>
                  <p className="mt-1.5 text-3xl font-extrabold text-[#f4f8ff]">
                    {samer.prediction.value.toFixed(2)}
                    <span className="ml-2 text-base font-bold text-[#c4d7f2]">± {(samer.prediction.typical_error_mae_group_cv ?? 0).toFixed(2)}</span>
                  </p>
                  <p className="mt-2 text-[11px] text-[#7d95b8]">{`Model fit · R² ${sc?.model?.r2?.toFixed(2) ?? "—"}`}</p>
                </>
              ) : (
                <>
                  <p className="mt-1.5 text-3xl font-extrabold text-[#f4f8ff]">—</p>
                  <p className="mt-1.5 text-xs text-amber-200">No validated model for this setting; the nearest measured flight tests are shown below.</p>
                </>
              )
            ) : (
              <p className="mt-1.5 text-xs text-[#8ea5c7]">Analyzer response unavailable.</p>
            )}
          </div>

          <div>
            <h3 className="text-base font-bold text-[#f4f8ff]">Nearest Real Flight Tests</h3>
            <div className="mt-2 overflow-x-auto rounded-xl border border-white/10 bg-[#050d21]/80">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-[11px] font-semibold text-[#8ea5c7]">
                    <th className="px-3 py-2.5">Test Row</th><th className="px-3 py-2.5">Match Dist.</th><th className="px-3 py-2.5">Material</th><th className="px-3 py-2.5">Inlet Velocity</th><th className="px-3 py-2.5">Aging Time</th><th className="px-3 py-2.5">Measured Rt/R0</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10 text-[#c4d7f2]">
                  {smokeRows.map((n, i) => {
                    const mat = Object.entries(n.features).find(([k, v]) => k.startsWith("sample_type=") && v === 1)?.[0]?.split("=")[1] ?? "—";
                    return (
                      <tr key={i}>
                        <td className="px-3 py-2.5 font-semibold text-[#7bc5ff]">PSI-101 · row {n.source_row}</td>
                        <td className="px-3 py-2.5 tabular-nums">{fmtNum(n.distance)}</td>
                        <td className="px-3 py-2.5 capitalize">{mat}</td>
                        <td className="px-3 py-2.5">{fmtNum(n.features["inlet_velocity__cm_s"])} cm/s</td>
                        <td className="px-3 py-2.5">{fmtNum(n.features["net_aging_time__sec"])} s</td>
                        <td className="px-3 py-2.5 font-semibold text-[#ffb067]">{fmtNum(n.outcomes["rt_r0"])}</td>
                      </tr>
                    );
                  })}
                  {smokeRows.length === 0 && <tr><td className="px-3 py-3 text-[#8ea5c7]" colSpan={6}>No nearby tests available.</td></tr>}
                </tbody>
              </table>
            </div>
            {smoke?.approximate && <p className="mt-2 text-[11px] text-amber-300">{smoke.note}</p>}
          </div>

          <div data-testid="daft-summary" className="rounded-xl border border-[#36a9ff]/25 bg-[#06122c]/80 p-4">
            <h3 className="text-sm font-bold text-[#f4f8ff]">DAFT Dust vs. Smoke Qualification</h3>
            <p className="mt-1.5 text-xs leading-5 text-[#c2d5ee]">
              DAFT (<Link href="/investigations/PSI-47" className="font-semibold text-[#7bc5ff] hover:underline">PSI-47</Link>) qualified the microgravity particle counter used by SAME against a DustTrak reference with Arizona Red Dust as the aerosol standard, to reduce risk before SAME flew. SAME and SAME-R then used that counter to measure smoke aging.
            </p>
            {smoke && smoke.response.same_psi102.nearest.rows.length > 0 && (
              <p className="mt-2 text-xs leading-5 text-[#9cb2d2]">
                SAME (PSI-102) has only 4 labelled flight runs. Closest measured weight-loss rate:{" "}
                {smoke.response.same_psi102.nearest.rows.slice(0, 1).map((n) => `${fmtNum(n.outcomes["weight_loss_rate__mg_min"])} mg/min at ${fmtNum(n.outcomes["air_flow__cm_s"])} cm/s airflow, ${fmtNum(n.outcomes["aging_duration__minutes"])} min aging`)}.
              </p>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
