"use client";

import { Flame, Loader2, Upload, Wind } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { HAB_KEYS } from "@/components/mission/habitat-keys";
import { Card } from "@/components/ui/card";
import {
  predictFlammability,
  predictFlammabilityRaw,
  predictSmokeDust,
  probeBackend,
  uploadDataset,
  type FlammabilityResult,
  type SmokeResult,
} from "@/lib/api/backend-client";
import type { DataSourceMode, EffectiveGravityPayload, FlammabilityResponse, HabitatInfo, NearestRealRow, RankAllPayload, SmokeCandidateResult, UploadPayload } from "@/lib/api/backend-types";
import { buildRequest, defaultsOf, FAMILIES, type Family } from "@/components/mission/predictor-families";
import { recordIdFromPsi } from "@/lib/data/psi-mapper";
import { GravityBadges } from "@/components/science/gravity-badges";
import { PROXY_CAVEAT } from "@/lib/science/gravity";

const HAB_SHORT: Record<string, string> = { iss: "ISS", moon: "Moon Base", mars: "Mars", eva: "EVA Suit", earth: "Earth Analog" };
const COMPONENTS: [string, string][] = [
  ["sim_gravity_actual", "G actual"],
  ["sim_gravity_proxy", "G proxy*"],
  ["sim_flow", "Flow"],
  ["sim_po2", "pO2"],
  ["sim_pressure", "Pressure"],
  ["sim_fuel", "Fuel"],
  ["sim_pillar", "Pillar"],
];

/** PSI-101 'Sample Type' values (SAME-R experimental table); the analyzer only knows these real materials. */
const SMOKE_MATERIALS = ["Kapton", "Silicone", "Lampwick", "Pyrell", "Teflon"] as const;
const labelCls = "block font-mono text-[10px] font-semibold tracking-[.14em] text-[#52b6ff] uppercase";
const sliderCls = "mt-1.5 w-full accent-[#36a9ff]";

function Slider({ label, unit, value, min, max, step, onChange, display, caption, testId }: { label: string; unit: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; display?: string; caption?: string; testId?: string }) {
  return (
    <label className="block">
      <span className={labelCls}>
        {label} <span className="font-sans text-[11px] font-bold text-[#f4f8ff] normal-case">{display ?? value} {unit}</span>
      </span>
      <input data-testid={testId} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} className={sliderCls} />
      {caption && <span className="block font-mono text-[9.5px] text-[#6f88ad]">{caption}</span>}
    </label>
  );
}

function featText(f: Record<string, number | string | null>): string {
  return Object.entries(f)
    .map(([k, v]) => {
      if (k.includes("=")) return v === 1 ? k.replace("=", ": ") : null;
      return `${k}: ${typeof v === "number" ? fmt(v) : String(v ?? "—")}`;
    })
    .filter(Boolean)
    .join(" · ");
}
function outText(o: Record<string, number | string | null>): string {
  return Object.entries(o).map(([k, v]) => `${k}: ${typeof v === "number" ? fmt(v) : String(v ?? "—")}`).join(" · ");
}

function NearestTable({ rows }: { rows: NearestRealRow[] }) {
  if (!rows.length) return <p className="mt-1 text-[11px] text-[#8ea5c7]">No nearest rows (no supplied input maps to a verified feature of this table).</p>;
  return (
    <div className="mt-1 overflow-x-auto">
      <table className="w-full min-w-[560px] text-left text-[10.5px]">
        <thead><tr className="font-mono text-[9.5px] text-[#7d95b8] uppercase"><th className="py-1 pr-2">Source row</th><th className="pr-2">Dist.</th><th className="pr-2">Real test conditions</th><th>Real measured outcomes</th></tr></thead>
        <tbody className="align-top font-mono text-[#c4d7f2]">
          {rows.map((n, i) => (
            <tr key={i} className="border-t border-white/5">
              <td className="py-1 pr-2 text-[#7bc5ff]">{n.source_file.replace(/^PSI-\d+_/, "").replace(/\.(csv|xlsx)$/i, "")} · row {n.source_row}</td>
              <td className="pr-2">{n.distance.toFixed(2)}</td>
              <td className="pr-2">{featText(n.features)}</td>
              <td className="text-[#ffb067]">{outText(n.outcomes)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CandidateCard({ c }: { c: SmokeCandidateResult }) {
  const sc = c.scores as { model?: Record<string, number>; dummy_mean?: Record<string, number>; dummy_prior?: Record<string, number> } | null | undefined;
  const dummy = sc?.dummy_mean ?? sc?.dummy_prior;
  const metric = sc?.model ? (["roc_auc", "r2", "mae"] as const).find((m) => typeof sc.model?.[m] === "number") : undefined;
  const isModel = c.mode === "model";
  const p = c.prediction;
  return (
    <div data-testid={`candidate-${c.candidate}`} className="rounded-lg border border-white/10 bg-[#060e22]/70 p-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11.5px] font-semibold text-[#e6effc]">{c.title}</p>
        <span className={`rounded-full border px-2 py-0.5 font-mono text-[9px] font-bold ${isModel ? "border-emerald-400/35 bg-emerald-400/15 text-emerald-300" : "border-amber-400/35 bg-amber-400/10 text-amber-300"}`}>
          {isModel ? "MODEL PASSES DUMMY GATE" : "LOOKUP: MODEL FAILS GATE OR INPUTS INCOMPLETE"}
        </span>
      </div>
      <p className="font-mono text-[9.5px] text-[#6f88ad]">Target: {c.target} · n={c.n_samples}</p>
      {isModel && p ? (
        <p className="mt-1 text-sm font-extrabold text-[#f4f8ff]">
          {p.probability_positive_class !== undefined ? `P(positive class) = ${(p.probability_positive_class * 100).toFixed(0)}%` : p.value !== undefined ? `${p.value.toFixed(3)}` : "—"}
          {p.typical_error_mae_group_cv !== undefined && <span className="ml-2 font-mono text-[10px] font-semibold text-[#8ea5c7]">± {p.typical_error_mae_group_cv.toFixed(3)} (group-CV MAE)</span>}
        </p>
      ) : (
        <p className="mt-1 text-[11px] text-amber-200">{c.label}</p>
      )}
      {isModel && metric && sc?.model && <p className="font-mono text-[9.5px] text-emerald-300/80">group-CV {metric}: model {sc.model[metric].toFixed(3)} vs dummy baseline {dummy?.[metric]?.toFixed(3) ?? "n/a"}</p>}
      {!isModel && c.gate_checks && c.gate_checks.length > 0 && <p className="font-mono text-[9.5px] text-amber-300/80">gate checks: {c.gate_checks.join(" · ")}</p>}
      {c.nearest.dims_missing && c.nearest.dims_missing.length > 0 && <p className="font-mono text-[9.5px] text-amber-300/80">dimensions not supplied: {c.nearest.dims_missing.join(", ")}</p>}
      <p className="mt-1.5 font-mono text-[9.5px] tracking-wider text-[#7d95b8] uppercase">Nearest real experimental tests (provenance + measured outcomes)</p>
      <NearestTable rows={c.nearest.rows} />
    </div>
  );
}

export function MissionPredictorPanel({
  habitats,
  rankings,
  ladder = null,
  initialHabitat,
  dataSource,
  metadataOnly = [],
  totalInvestigations = 0,
}: {
  metadataOnly?: { id: string; name: string }[];
  totalInvestigations?: number;
  habitats: HabitatInfo[];
  rankings: RankAllPayload | null;
  ladder?: EffectiveGravityPayload | null;
  initialHabitat: (typeof HAB_KEYS)[number];
  dataSource: DataSourceMode;
}) {
  const [habKey, setHabKey] = useState<(typeof HAB_KEYS)[number]>(initialHabitat);
  const hab = habitats.find((h) => h.key === habKey);
  const [mode, setMode] = useState<DataSourceMode | "checking">(dataSource === "fixture" ? "checking" : dataSource);

  // Flammability inputs
  const [g, setG] = useState(hab?.gravity_g ?? 0);
  const [pKpa, setPKpa] = useState(Math.round(hab?.pressure_kpa ?? 101.3));
  const [o2, setO2] = useState(Math.round(hab?.o2_pct ?? 21));
  const [flow, setFlow] = useState(Math.round(((hab?.ventilation_cm_s?.[0] ?? 5) + (hab?.ventilation_cm_s?.[1] ?? 20)) / 2));
  const [flam, setFlam] = useState<FlammabilityResult | null>(null);

  // Real-data predictor families (each control maps to one audited feature; see predictor-families.ts)
  const [famId, setFamId] = useState(FAMILIES[0].id);
  const fam: Family = FAMILIES.find((f) => f.id === famId) ?? FAMILIES[0];
  const [famVals, setFamVals] = useState<Record<string, Record<string, number | string>>>(() => Object.fromEntries(FAMILIES.map((f) => [f.id, defaultsOf(f)])));
  const [famRes, setFamRes] = useState<FlammabilityResponse | null>(null);
  const [famBusy, setFamBusy] = useState(false);
  const [famErr, setFamErr] = useState<string | null>(null);
  const [famBody, setFamBody] = useState<string>("");

  const [smokeMat, setSmokeMat] = useState<(typeof SMOKE_MATERIALS)[number]>("Kapton");
  const [smokeVel, setSmokeVel] = useState(5);
  const [smokeAge, setSmokeAge] = useState(60);
  const [smoke, setSmoke] = useState<SmokeResult | null>(null);
  const [smokeBusy, setSmokeBusy] = useState(false);

  const [busy, setBusy] = useState(false);
  const [upload, setUpload] = useState<UploadPayload | null>(null);
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    probeBackend().then((r) => alive && setMode(r.source)).catch(() => alive && setMode("static"));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
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
  }, [g, pKpa, o2, flow]);

  const famVal = famVals[famId];
  useEffect(() => {
    let alive = true;
    const body = buildRequest(fam, famVal);
    setFamBody(JSON.stringify(body));
    const t = setTimeout(() => {
      setFamBusy(true);
      predictFlammabilityRaw(body)
        .then((r) => { if (alive) { setFamRes(r); setFamErr(null); } })
        .catch(() => { if (alive) { setFamRes(null); setFamErr("Model / nearest-test lookup needs the live API (the static snapshot has no model bundle). Start it with ./start_orbitflame.sh."); } })
        .finally(() => alive && setFamBusy(false));
    }, 250);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [fam, famVal]);

  useEffect(() => {
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
  }, [smokeMat, smokeVel, smokeAge]);

  function selectHabitat(k: (typeof HAB_KEYS)[number]) {
    setHabKey(k);
    const h = habitats.find((x) => x.key === k);
    if (!h) return;
    setG(h.gravity_g);
    setPKpa(Math.round(h.pressure_kpa));
    setO2(Math.round(h.o2_pct));
    setFlow(Math.round((h.ventilation_cm_s[0] + h.ventilation_cm_s[1]) / 2));
  }

  const regime = useMemo(() => {
    const key = habKey === "moon" ? "lunar_eq" : habKey === "mars" ? "mars_eq" : habKey === "earth" ? "earth_eq" : null;
    return key && ladder ? (ladder.regimes.find((r) => r.regime === key) ?? null) : null;
  }, [ladder, habKey]);

  const top = useMemo(() => {
    const r = rankings?.habitats?.[habKey];
    if (!r) return [];
    const bestRow = new Map<string, (typeof r.ranked)[number]>();
    for (const row of r.ranked) if (!bestRow.has(row.psi_id)) bestRow.set(row.psi_id, row);
    return r.by_investigation.slice(0, 6).map((b) => ({ ...b, row: bestRow.get(b.psi_id) }));
  }, [rankings, habKey]);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setUploading(true);
    setUploadErr(null);
    try {
      setUpload(await uploadDataset(file));
    } catch (e) {
      setUpload(null);
      setUploadErr(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const live = mode === "live";
  const pred = flam?.response.prediction;

  return (
    <Card data-testid="mission-predictor-panel" className="border border-[#36a9ff]/25 bg-[#09152e]/85 p-5 backdrop-blur-md">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/10 pb-3">
        <div>
          <p className="font-mono text-[10px] font-bold tracking-[.16em] text-[#52b6ff] uppercase">PHYSICS RANKING · FLAMMABILITY &amp; SMOKE AGING ANALYZER</p>
          <p className="mt-0.5 text-[11px] text-[#8ea5c7]">
            VERIFIED NASA PSI EXPERIMENTAL DATA. An empirical model is shown only if it beats dummy baselines under group cross-validation (see /api/model-audit); otherwise the nearest real experimental tests are listed. Not a safety certification.
          </p>
        </div>
        <span className={`rounded-full border px-2.5 py-0.5 font-mono text-[9.5px] font-bold tracking-[.12em] ${live ? "border-emerald-400/35 bg-emerald-400/15 text-emerald-300" : "border-amber-400/35 bg-amber-400/10 text-amber-300"}`}>
          {mode === "checking" ? "CHECKING…" : live ? "LIVE API" : "STATIC SNAPSHOT"}
        </span>
      </div>

      {/* Habitat physics ranking */}
      <div className="mt-4">
        <span className={labelCls}>Habitat relevance ranking (physics-informed)</span>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {HAB_KEYS.map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={habKey === k}
              onClick={() => selectHabitat(k)}
              className={`rounded-lg border px-2.5 py-1.5 font-mono text-[10px] font-semibold tracking-wider uppercase ${habKey === k ? "border-[#ff8a32]/50 bg-[#ff5500]/20 text-[#ffb067]" : "border-white/10 bg-[#050b1b] text-[#8ea5c7] hover:text-white"}`}
            >
              {HAB_SHORT[k]}
            </button>
          ))}
        </div>
        {hab && (
          <p className="mt-2.5 rounded-lg border border-white/10 bg-[#060e22]/70 p-2.5 text-[11px] leading-relaxed text-[#a8bedf]">
            <span className="font-semibold text-[#e5efff]">{hab.name}</span> · {hab.pressure_kpa.toFixed(1)} kPa · {hab.o2_pct}% O2 · {hab.gravity_g} g · ventilation {hab.ventilation_cm_s[0]}–{hab.ventilation_cm_s[1]} cm/s.
            <span className="mt-1 block font-mono text-[10px] text-[#7d95b8]">Citation: {hab.ventilation_citation}</span>
          </p>
        )}
        {regime && (
          <div data-testid="habitat-gravity-counts" className="mt-2.5 rounded-lg border border-amber-400/25 bg-amber-400/[0.06] p-2.5 text-[11px] leading-4 text-[#d9e6fb]">
            <p className="font-mono text-[10px] font-bold tracking-wider text-[#7bc5ff]">ACTUAL GRAVITY at {regime.label}: {regime.actual_rows} rows{regime.actual_rows === 0 ? " (no PSI row is tagged at this gravity)" : ""}</p>
            <p className="mt-1 font-mono text-[10px] font-bold tracking-wider text-amber-300">
              EFFECTIVE-GRAVITY PROXY (heuristic, flow-equivalent) at ~{regime.label}: {regime.proxy_rows} 0 g rows
              {regime.proxy_investigations.length > 0 && <> from {regime.proxy_investigations.map((x) => `${x.psi_id} (${x.n_rows})`).join(", ")}</>}
            </p>
            <p className="mt-1 text-[10px] text-[#8ea5c7]">Not measured {regime.label} data. The ranking below uses the actual-gravity match and, separately, the proxy match at half weight.</p>
          </div>
        )}
        <ol className="mt-3 grid gap-2 sm:grid-cols-2">
          {top.map((t, i) => (
            <li key={t.psi_id} className="rounded-xl border border-white/10 bg-[#050d21]/80 p-3">
              <div className="flex items-baseline justify-between gap-2">
                <Link href={`/investigations/${encodeURIComponent(recordIdFromPsi(t.psi_id))}`} className="min-w-0 truncate font-mono text-[11px] font-bold text-[#7bc5ff] hover:underline">
                  #{i + 1} {t.psi_id} · {t.investigation}
                </Link>
                <span className="font-mono text-xs font-bold text-[#ff8a32]">{t.max_score.toFixed(1)}</span>
              </div>
              {t.row && (
                <div className="mt-2 grid grid-cols-7 gap-1" title={`Best test point ${t.row.test_id}`}>
                  {COMPONENTS.map(([key, label]) => {
                    const v = typeof t.row?.[key] === "number" ? (t.row[key] as number) : 0;
                    const isProxyBar = key === "sim_gravity_proxy";
                    return (
                      <div key={key} className={`text-center ${isProxyBar && typeof t.row?.[key] !== "number" ? "opacity-40" : ""}`} title={isProxyBar ? "Effective-gravity HEURISTIC PROXY match (down-weighted x0.5; n/a when the row has no flow-equivalent proxy)" : undefined}>
                        <div className="h-8 overflow-hidden rounded bg-white/10"><div className="w-full bg-[linear-gradient(180deg,#36a9ff,#0b3d91)]" style={{ height: `${Math.round(v * 100)}%`, marginTop: `${100 - Math.round(v * 100)}%` }} /></div>
                        <span className="mt-0.5 block font-mono text-[8px] text-[#7d95b8]">{label}</span>
                      </div>
                    );
                  })}
                </div>
              )}
              {t.row && (
                <p className="mt-2">
                  <GravityBadges compact parts={{ actualG: typeof t.row.gravity_g === "number" ? t.row.gravity_g : null, source: t.row.gravity_source ?? null, effG: typeof t.row.effective_gravity_g === "number" ? t.row.effective_gravity_g : null, method: t.row.effective_gravity_method ?? null }} />
                </p>
              )}
              {typeof t.n_proxy_gravity_rows === "number" && t.n_proxy_gravity_rows > 0 && (
                <p className="mt-1 font-mono text-[9.5px] text-amber-300">{t.n_proxy_gravity_rows} of {t.n_rows} rows score on the effective-gravity PROXY (heuristic), not actual gravity</p>
              )}
            </li>
          ))}
        </ol>
        <p className="mt-1.5 font-mono text-[10px] leading-4 text-amber-200/80" data-testid="ranking-proxy-note">* {PROXY_CAVEAT} Actual gravity of every row is 0.0 g (ISS/Cygnus flight), so Moon (0.16 g) / Mars (0.38 g) / Earth (1.0 g) similarity comes only from the down-weighted proxy.</p>
        <p className="mt-1.5 font-mono text-[10px] text-[#6a84a9]">Score 0–100 = weighted Gaussian similarity (gravity, flow, pO2, pressure, fuel, pillar) of the best real test row; bars show component similarity 0–1.</p>
        {metadataOnly.length > 0 && (
          <p data-testid="ranking-coverage-note" className="mt-2 rounded-lg border border-amber-400/25 bg-amber-400/[0.07] p-2.5 text-[11px] leading-4 text-amber-100">
            Ranking covers {totalInvestigations - metadataOnly.length} of {totalInvestigations} PSI investigations: those with per-test rows. Not ranked (metadata &amp; protocol only in PSI):{" "}
            {metadataOnly.map((m, i) => (
              <span key={m.id}>{i > 0 && ", "}<Link href={`/investigations/${m.id}`} className="font-mono font-semibold text-[#7bc5ff] hover:underline">{m.id}</Link></span>
            ))}.
          </p>
        )}
      </div>

      <div className="mt-5 grid gap-5 border-t border-white/10 pt-4 lg:grid-cols-2">
        {/* Analytical physics bound */}
        <div data-testid="physics-block">
          <div className="flex items-center gap-2"><Flame size={14} className="text-[#ff8a32]" aria-hidden="true" /><span className={labelCls}>Analytical physics bound (physics_ranker; not learned from PSI rows)</span></div>
          <p className="mt-1 text-[10.5px] leading-4 text-[#7d95b8]">Controls map to the physics_ranker inputs gravity_g, pressure_kpa, o2_pct and flow_velocity_cm_s. Fuel does not enter this calculation. Gravity presets are analytical conditions; no PSI test row exists at 0.16 g, 0.38 g or 1 g.</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {[0, 0.16, 0.38, 1].map((gv) => (
              <button key={gv} type="button" aria-pressed={g === gv} onClick={() => setG(gv)} className={`rounded-lg border px-2 py-1 font-mono text-[10px] font-semibold ${g === gv ? "border-[#36a9ff]/60 bg-[#13386e] text-white" : "border-white/10 bg-[#050b1b] text-[#8ea5c7] hover:text-white"}`}>
                {gv} g
              </button>
            ))}
          </div>
          <div className="mt-3 space-y-3">
            <Slider testId="slider-physics-o2" label="Oxygen (o2_pct)" unit="%" value={o2} min={15} max={100} step={1} onChange={setO2} />
            <Slider testId="slider-physics-p" label="Pressure (pressure_kpa)" unit="kPa" value={pKpa} min={20} max={110} step={1} onChange={setPKpa} />
            <Slider testId="slider-physics-flow" label="Forced flow (flow_velocity_cm_s)" unit="cm/s" value={flow} min={0} max={40} step={1} onChange={setFlow} />
          </div>
          <div className="mt-3 rounded-xl border border-white/10 bg-[#050d21]/90 p-3" aria-live="polite">
            <div className="flex items-center justify-between font-mono text-[10px] tracking-wider text-[#8ea5c7] uppercase">
              <span>Analytical outputs</span>{busy && <Loader2 size={12} className="animate-spin" />}
            </div>
            {pred ? (
              <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-[11px] text-[#c4d7f2]">
                <dt className="text-[#7d95b8]">LOC (analytical physics)</dt><dd>{pred.limiting_o2_index_pct != null ? `${pred.limiting_o2_index_pct.toFixed(1)}%` : "n/a"}</dd>
                <dt className="text-[#7d95b8]">Effective flow</dt><dd>{pred.u_eff_cm_s.toFixed(1)} cm/s</dd>
                <dt className="text-[#7d95b8]">Ventilation hazard</dt><dd>{pred.ventilation_hazard.toFixed(2)}</dd>
                <dt className="text-[#7d95b8]">pO2</dt><dd>{pred.po2_kpa.toFixed(1)} kPa</dd>
                <dt className="text-[#7d95b8]">O2 vs LOC</dt><dd className={pred.above_loc ? "text-[#ff8a32]" : "text-[#7bc5ff]"}>{pred.above_loc ? "above LOC" : "below LOC"}</dd>
              </dl>
            ) : (
              <p className="mt-1.5 text-xs text-[#8ea5c7]">Physics response unavailable.</p>
            )}
            {flam?.approximate && <p className="mt-2 text-[10.5px] text-amber-300">Static snapshot: nearest precomputed grid cell ({flam.response.model}). Start the API for exact values.</p>}
          </div>
        </div>

        {/* Empirical SAME / SAME-R smoke aging analyzer */}
        <div data-testid="smoke-analyzer">
          <div className="flex items-center gap-2"><Wind size={14} className="text-[#52b6ff]" aria-hidden="true" /><span className={labelCls}>Empirical SAME / SAME-R Microgravity Smoke Aging &amp; Detector Response Analyzer</span></div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {SMOKE_MATERIALS.map((m) => (
              <button key={m} type="button" aria-pressed={smokeMat === m} onClick={() => setSmokeMat(m)} className={`rounded-lg border px-2 py-1 font-mono text-[10px] font-semibold ${smokeMat === m ? "border-[#36a9ff]/60 bg-[#13386e] text-white" : "border-white/10 bg-[#050b1b] text-[#8ea5c7] hover:text-white"}`}>
                {m}
              </button>
            ))}
          </div>
          <div className="mt-3 space-y-3">
            <Slider testId="slider-smoke-velocity" label="Inlet velocity" unit="cm/s" value={smokeVel} min={0} max={8.1} step={0.1} onChange={setSmokeVel} display={smokeVel.toFixed(1)} caption="feature: Inlet velocity (cm/s) · PSI-101 range 0–8.1" />
            <Slider testId="slider-smoke-aging" label="Net aging time" unit="s" value={smokeAge} min={21} max={1923} step={1} onChange={setSmokeAge} caption="feature: Net aging time (sec) · PSI-101 range 21–1923" />
          </div>
          <div className="mt-3 rounded-xl border border-white/10 bg-[#050d21]/90 p-3" aria-live="polite">
            <div className="flex items-center justify-between font-mono text-[10px] tracking-wider text-[#8ea5c7] uppercase">
              <span>SAME-R (PSI-101) smoke Rt/R0</span>{smokeBusy && <Loader2 size={12} className="animate-spin" />}
            </div>
            {smoke ? (
              (() => {
                const r = smoke.response.samer_psi101;
                const sc = r.scores as { model?: { r2?: number; mae?: number }; dummy_mean?: { r2?: number; mae?: number } } | null | undefined;
                return (
                  <>
                    {r.mode === "model" && r.prediction?.value !== undefined ? (
                      <>
                        <p className="mt-1.5 text-xl font-extrabold text-[#f4f8ff]">Rt/R0 ≈ {r.prediction.value.toFixed(2)} <span className="font-mono text-xs font-semibold text-[#8ea5c7]">± {(r.prediction.typical_error_mae_group_cv ?? 0).toFixed(3)} (group-CV MAE)</span></p>
                        <p className="mt-1 font-mono text-[10.5px] text-emerald-300">Model passes the dummy-baseline gate: group-CV R² {sc?.model?.r2?.toFixed(2) ?? "n/a"} vs dummy {sc?.dummy_mean?.r2?.toFixed(2) ?? "n/a"} · MAE {sc?.model?.mae?.toFixed(3) ?? "n/a"} vs {sc?.dummy_mean?.mae?.toFixed(3) ?? "n/a"} · n={r.n_samples}</p>
                      </>
                    ) : (
                      <p className="mt-1.5 rounded-lg border border-amber-400/30 bg-amber-400/10 px-2.5 py-1.5 text-[11px] text-amber-200">{r.label}</p>
                    )}
                    <p className="mt-2 font-mono text-[10px] tracking-wider text-[#7d95b8] uppercase">Nearest real SAME-R tests (measured Rt/R0)</p>
                    <table className="mt-1 w-full text-left text-[10.5px]">
                      <thead><tr className="font-mono text-[9.5px] text-[#7d95b8] uppercase"><th className="py-1 pr-2">Row</th><th className="pr-2">Material</th><th className="pr-2">cm/s</th><th className="pr-2">Aging s</th><th>Rt/R0</th></tr></thead>
                      <tbody className="font-mono text-[#c4d7f2]">
                        {r.nearest.rows.slice(0, 4).map((n, i) => {
                          const mat = Object.entries(n.features).find(([k, v]) => k.startsWith("sample_type=") && v === 1)?.[0]?.split("=")[1] ?? "—";
                          const rt = n.outcomes["rt_r0"];
                          return (
                            <tr key={i} title={`${n.source_file} row ${n.source_row}`}>
                              <td className="py-0.5 pr-2">{n.source_row}</td><td className="pr-2 capitalize">{mat}</td>
                              <td className="pr-2">{fmt(n.features["inlet_velocity__cm_s"])}</td><td className="pr-2">{fmt(n.features["net_aging_time__sec"])}</td>
                              <td className="text-[#ffb067]">{typeof rt === "number" ? rt.toFixed(2) : "—"}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    <p className="mt-2 font-mono text-[10px] tracking-wider text-[#7d95b8] uppercase">SAME (PSI-102, n=4 labelled) weight-loss rate</p>
                    <p className="mt-0.5 text-[10.5px] leading-4 text-amber-200">{smoke.response.same_psi102.label}</p>
                    {smoke.response.same_psi102.nearest.rows.slice(0, 2).map((n, i) => (
                      <p key={i} className="font-mono text-[10.5px] text-[#c4d7f2]">row {n.source_row}: {fmt(n.outcomes["weight_loss_rate__mg_min"])} mg/min at {fmt(n.outcomes["air_flow__cm_s"])} cm/s, aging {fmt(n.outcomes["aging_duration__minutes"])} min</p>
                    ))}
                    {smoke.approximate && <p className="mt-2 text-[10.5px] text-amber-300">{smoke.note}</p>}
                  </>
                );
              })()
            ) : (
              <p className="mt-1.5 text-xs text-[#8ea5c7]">Analyzer response unavailable.</p>
            )}
            <p className="mt-2 text-[10.5px] leading-4 text-[#8ea5c7]">{smoke?.response.not_modeled}</p>
          </div>
        </div>
      </div>

      {/* Real-data predictors: every control = one audited feature */}
      <div data-testid="family-predictor" className="mt-5 border-t border-white/10 pt-4">
        <span className={labelCls}>Real-data predictors and nearest-test lookup (each control = one audited table feature)</span>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {FAMILIES.map((f) => (
            <button key={f.id} type="button" aria-pressed={famId === f.id} onClick={() => setFamId(f.id)} className={`rounded-lg border px-2.5 py-1.5 font-mono text-[10px] font-semibold tracking-wider ${famId === f.id ? "border-[#ff8a32]/50 bg-[#ff5500]/20 text-[#ffb067]" : "border-white/10 bg-[#050b1b] text-[#8ea5c7] hover:text-white"}`}>
              {f.title} · {f.psi}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[11px] leading-4 text-[#a8bedf]">{fam.blurb}</p>
        <div className="mt-3 grid gap-5 lg:grid-cols-[minmax(0,380px)_1fr]">
          <div className="space-y-3">
            {fam.controls.map((c) =>
              c.kind === "select" ? (
                <label key={c.id} className="block">
                  <span className={labelCls}>{c.label}</span>
                  <select data-testid={`ctl-${fam.id}-${c.id}`} value={String(famVal[c.id])} onChange={(e) => setFamVals((p) => ({ ...p, [famId]: { ...p[famId], [c.id]: e.target.value } }))} className="mt-1.5 w-full rounded-xl border border-white/15 bg-[#050b1b] px-3 py-1.5 text-xs text-[#f4f8ff] focus:border-[#36a9ff] focus:outline-none">
                    {c.options.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                  <span className="block font-mono text-[9.5px] text-[#6f88ad]">feature: {c.feature}</span>
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
                  display={`${Number(famVal[c.id])}${c.extra ? ` (${c.extra(Number(famVal[c.id]))})` : ""}`}
                  caption={`feature: ${c.feature} · ${c.unitStatus === "proven" ? "unit proven by header" : c.unitStatus === "convention" ? "mol/mol dimensionless: standard combustion convention (user-confirmed), not stated in the PSI file" : "unit not stated in table"}${c.note ? ` · ${c.note}` : ""} · table range ${c.min}–${c.max}`}
                  onChange={(v) => setFamVals((p) => ({ ...p, [famId]: { ...p[famId], [c.id]: v } }))}
                />
              ),
            )}
          </div>
          <div className="min-w-0 space-y-2.5" aria-live="polite">
            <div className="flex items-center gap-2 font-mono text-[10px] tracking-wider text-[#8ea5c7] uppercase">Results from the audited tables {famBusy && <Loader2 size={12} className="animate-spin" />}</div>
            {famErr && <p className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-[11px] text-amber-200">{famErr}</p>}
            {famRes?.prediction.empirical
              ?.filter((c) => c.candidate.startsWith(fam.candidatePrefix) && (!fam.candidateIncludes || c.candidate.includes(fam.candidateIncludes)))
              .map((c) => <CandidateCard key={c.candidate} c={c} />)}
            {famRes && !famRes.prediction.empirical?.some((c) => c.candidate.startsWith(fam.candidatePrefix)) && <p className="text-[11px] text-[#8ea5c7]">No audited candidate matches this fuel in {fam.psi}.</p>}
            <details className="font-mono text-[10px] text-[#6f88ad]"><summary className="cursor-pointer">Request body sent to /api/predict/flammability</summary><pre data-testid="family-request" className="mt-1 whitespace-pre-wrap break-all">{famBody}</pre></details>
          </div>
        </div>
      </div>

      {/* Upload */}
      <div className="mt-5 border-t border-white/10 pt-4">
        <span className={labelCls}>Score your own PSI export (CSV / XLSX / ISA-Tab TXT)</span>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls,.txt" disabled={!live || uploading} onChange={(e) => void onFile(e.target.files?.[0])} className="max-w-full text-xs text-[#9cb2d2] file:mr-3 file:rounded-lg file:border file:border-white/15 file:bg-[#050b1b] file:px-3 file:py-1.5 file:font-mono file:text-[10px] file:text-[#c4d7f2] disabled:opacity-45" aria-label="Upload dataset" />
          {uploading && <Loader2 size={14} className="animate-spin text-[#52b6ff]" />}
          <Upload size={14} className="text-[#52b6ff]" aria-hidden="true" />
        </div>
        {!live && <p className="mt-2 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-[11px] text-amber-200">Upload is disabled in static-snapshot mode. Start the live API (./start_orbitflame.sh) to parse and score files. Nothing is persisted.</p>}
        {uploadErr && <p className="mt-2 rounded-lg border border-rose-400/35 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">{uploadErr}</p>}
        {upload && (
          <div className="mt-3 overflow-x-auto rounded-xl border border-white/10 bg-[#050d21]/80">
            <p className="border-b border-white/10 px-3 py-2 font-mono text-[10px] text-[#8ea5c7]">{upload.filename}: {upload.n_rows} row(s) parsed · not persisted · source {upload.source}</p>
            <table className="w-full min-w-[520px] text-left text-[11px]">
              <thead><tr className="font-mono text-[10px] tracking-wider text-[#7d95b8] uppercase"><th className="px-3 py-1.5">Test</th><th className="px-3 py-1.5">O2 %</th><th className="px-3 py-1.5">kPa</th><th className="px-3 py-1.5">g</th><th className="px-3 py-1.5">Best habitat</th><th className="px-3 py-1.5">ISS</th><th className="px-3 py-1.5">Moon</th><th className="px-3 py-1.5">Mars</th></tr></thead>
              <tbody className="divide-y divide-white/10 font-mono text-[#c4d7f2]">
                {upload.rows.slice(0, 6).map((r, i) => (
                  <tr key={i}>
                    <td className="px-3 py-1.5">{String(r.test_id ?? r.psi_id ?? i + 1)}</td>
                    <td className="px-3 py-1.5">{fmt(r.o2_pct)}</td><td className="px-3 py-1.5">{fmt(r.pressure_kpa)}</td><td className="px-3 py-1.5">{fmt(r.gravity_g)}</td>
                    <td className="px-3 py-1.5 text-[#ffb067]">{String(r.best_habitat ?? "—")}</td>
                    <td className="px-3 py-1.5">{fmt(r.score_iss)}</td><td className="px-3 py-1.5">{fmt(r.score_moon)}</td><td className="px-3 py-1.5">{fmt(r.score_mars)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Card>
  );
}

function fmt(v: unknown): string {
  return typeof v === "number" && Number.isFinite(v) ? (Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(2)) : "—";
}
