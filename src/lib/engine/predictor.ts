/**
 * Gated empirical predictors (isomorphic, no I/O). TypeScript port of the research pipeline's inference code.
 *
 *  - A candidate that PASSED the dummy-baseline gate in group cross-validation runs its fitted model (trees exported from the trained
 *    GradientBoosting / RandomForest) -> mode "model".
 *  - Any other candidate (or a passing one with incomplete inputs) returns the k nearest REAL experimental rows
 *    (Euclidean distance on standardised verified features) with their measured outcomes and file/row provenance
 *    -> mode "nearest_real_test_lookup".
 * There are no synthetic rows: the bundle holds only rows parsed from NASA PSI tables and the fitted trees.
 */

export type Tree = { f: number[]; t: number[]; l: number[]; r: number[]; v: number[] };
export type TreeModel = { kind: "gbr"; init: number; learning_rate: number; trees: Tree[] } | { kind: "rfc"; trees: Tree[] };
export type NearestSourceRow = {
  source_file: string;
  source_sheet: string;
  source_row: number;
  features: Record<string, number | null>;
  outcomes: Record<string, number | string | null>;
};
export type Candidate = {
  id: string;
  title: string;
  psi_ids: string[];
  target_desc: string;
  task: "reg" | "clf" | "lookup";
  positive: string | null;
  passed_gate: boolean;
  report: { n_samples: number; scores: unknown; gate_checks: unknown; label: string | null };
  features?: string[];
  mean?: number[];
  std?: number[];
  rows?: NearestSourceRow[];
  model?: TreeModel;
};
export type PredictorBundle = { format_version: number; generated: string; label_insufficient: string | null; candidates: Record<string, Candidate> };

export type FlamInput = Record<string, unknown>;
export type RawFeatures = Record<string, number | string | null | undefined>;

export const LABEL_INSUFFICIENT = "Insufficient empirical signal in public table - showing nearest real experimental test lookup";
export const SMOKE_TITLE = "Empirical SAME / SAME-R Microgravity Smoke Aging & Detector Response Analyzer";
const MMHG_KPA = 0.133322368;
const ATM_KPA = 101.325;
const BAR_KPA = 100.0;

/* ------------------------------- input -> feature mapping (only proven relations) ------------------------------- */
function num(inp: FlamInput, k: string): number | null {
  const v = inp[k];
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isNaN(n) ? null : n;
}
const div = (inp: FlamInput, k: string, f: number): number | null => {
  const v = num(inp, k);
  return v === null ? null : v / f;
};

const NUM_MAP: Array<[RegExp, (i: FlamInput) => number | null]> = [
  [/^ambient_pressure__mmhg$/, (i) => div(i, "pressure_kpa", MMHG_KPA)],
  [/^approx_p__bar$/, (i) => div(i, "pressure_kpa", BAR_KPA)],
  [/^(pressure__atm__num|data_pressure__atm)$/, (i) => div(i, "pressure_kpa", ATM_KPA)],
  [/^o_initial_.*mole_fraction$/, (i) => div(i, "o2_pct", 100)],
  [/^he_initial_.*mole_fraction$/, (i) => div(i, "he_mole_pct", 100)],
  [/^n_initial_.*mole_fraction$/, (i) => num(i, "n_initial_mole_frac")],
  [/^co_initial_.*mole_fraction$/, (i) => num(i, "co_initial_mole_frac_as_labeled")],
  [/^(droplet_initial_diameter__mm|d0__mm)$/, (i) => num(i, "droplet_diameter_mm")],
  [/^(inlet_velocity__cm_s|air_flow__cm_s|air_rate__cm_s)$/, (i) => num(i, "flow_velocity_cm_s")],
  [/^net_aging_time__sec$/, (i) => num(i, "aging_time_s")],
  [/^aging_duration__minutes$/, (i) => div(i, "aging_time_s", 60)],
  [/^calibrated_initial_o2_by_vol__by_volume$/, (i) => num(i, "o2_pct")],
  [/^initial_co2_by_vol__by_volume$/, (i) => num(i, "co2_mole_pct")],
  [/^nozzle__mm$/, (i) => num(i, "nozzle_diameter_mm")],
];
const CAT_FIELDS: Record<string, string> = { fuel: "fuel", norm_fuel: "fuel", sample_type: "fuel", fiber: "fiber", flame_type: "flame_type", norm_geometry: "sample_geometry" };

function fnorm(x: string): string {
  let s = String(x).toLowerCase().trim();
  s = s.replace(/^\s*\d+(\.\d+)?\s*%?\s*/, "");
  s = s.replace(/^n-/, "");
  return s.replace(/[^a-z0-9]/g, "");
}
/** Whole-label match after dropping a leading concentration / 'n-' (substring matching would confuse 'ethane' with 'methane'). */
export function fuelMatch(user: string | null | undefined, cat: string): boolean {
  if (!user) return false;
  const u = fnorm(user);
  return u !== "" && u === fnorm(cat);
}

function featureValue(fname: string, inp: FlamInput, raw: RawFeatures): number | null {
  const rv = raw[fname];
  if (rv !== undefined && rv !== null) return Number(rv);
  const eq = fname.indexOf("=");
  if (eq >= 0) {
    const col = fname.slice(0, eq);
    const cat = fname.slice(eq + 1);
    const field = CAT_FIELDS[col];
    if (!field) return null;
    const v = inp[field];
    if (v === null || v === undefined || String(v).trim() === "") return null;
    return fuelMatch(String(v), cat) ? 1 : 0;
  }
  for (const [rx, fn] of NUM_MAP) if (rx.test(fname)) return fn(inp);
  return null;
}

/* ------------------------------- nearest real rows ------------------------------- */
export type NearestResult = { dims_used: string[]; dims_missing: string[]; rows: Array<{ distance: number } & NearestSourceRow>; note?: string };

function nearest(c: Candidate, vals: Record<string, number | null>, k: number): NearestResult {
  const feats = c.features ?? [];
  const avail = feats.filter((f) => vals[f] !== null && vals[f] !== undefined);
  const out: NearestResult = { dims_used: avail, dims_missing: feats.filter((f) => vals[f] === null || vals[f] === undefined), rows: [] };
  if (avail.length === 0) {
    out.note = "no supplied input maps to a verified feature of this table";
    return out;
  }
  const idx = avail.map((f) => feats.indexOf(f));
  const z = avail.map((f, n) => ((vals[f] as number) - (c.mean as number[])[idx[n]]) / (c.std as number[])[idx[n]]);
  const rows = c.rows ?? [];
  const d = rows.map((r, i) => {
    let s = 0;
    for (let n = 0; n < idx.length; n++) {
      const fv = r.features[feats[idx[n]]] as number;
      const zr = (fv - (c.mean as number[])[idx[n]]) / (c.std as number[])[idx[n]];
      s += (zr - z[n]) ** 2;
    }
    return { i, dist: Math.sqrt(s) };
  });
  d.sort((a, b) => a.dist - b.dist || a.i - b.i);
  out.rows = d.slice(0, k).map(({ i, dist }) => ({ distance: dist, ...rows[i] }));
  return out;
}

/* ------------------------------- tree ensembles ------------------------------- */
function treeLeaf(t: Tree, x: Float32Array): number {
  let n = 0;
  while (t.f[n] >= 0) n = x[t.f[n]] <= t.t[n] ? t.l[n] : t.r[n];
  return t.v[n];
}
export function runModel(m: TreeModel, vals: number[]): number {
  const x = Float32Array.from(vals);
  if (m.kind === "gbr") {
    let acc = m.init;
    for (const t of m.trees) acc += m.learning_rate * treeLeaf(t, x);
    return acc;
  }
  let s = 0;
  for (const t of m.trees) s += treeLeaf(t, x);
  return s / m.trees.length;
}

/* ------------------------------- candidates ------------------------------- */
export type CandidateResult = {
  candidate: string;
  title: string;
  psi_ids: string[];
  target: string;
  task: string;
  n_samples: number;
  passed_gate: boolean;
  scores: unknown;
  gate_checks: unknown;
  mode: "model" | "nearest_real_test_lookup";
  label: string | null;
  prediction?: { probability_positive_class?: number; positive_class?: string | null; value?: number; typical_error_mae_group_cv?: number };
  features_used?: string[];
  nearest: NearestResult | { rows: never[]; note: string };
};

export function predictCandidate(bundle: PredictorBundle, cid: string, inp: FlamInput, raw: RawFeatures = {}, k = 5): CandidateResult {
  const c = bundle.candidates[cid];
  const base = {
    candidate: cid, title: c.title, psi_ids: c.psi_ids, target: c.target_desc, task: c.task,
    n_samples: c.report.n_samples, passed_gate: c.passed_gate, scores: c.report.scores ?? null, gate_checks: c.report.gate_checks ?? null,
  };
  if (!c.features) {
    return { ...base, mode: "nearest_real_test_lookup", label: LABEL_INSUFFICIENT, nearest: { rows: [], note: "no verified feature survived the audit" } };
  }
  const vals: Record<string, number | null> = {};
  for (const f of c.features) vals[f] = featureValue(f, inp, raw);
  const missing = c.features.filter((f) => vals[f] === null);
  if (c.passed_gate && missing.length === 0 && c.model) {
    const p = runModel(c.model, c.features.map((f) => vals[f] as number));
    const prediction =
      c.task === "clf"
        ? { probability_positive_class: p, positive_class: c.positive }
        : { value: p, typical_error_mae_group_cv: ((c.report.scores as { model?: { mae?: number } } | null)?.model?.mae) as number };
    return { ...base, mode: "model", label: c.report.label, prediction, features_used: c.features, nearest: nearest(c, vals, 3) };
  }
  const label = !c.passed_gate
    ? LABEL_INSUFFICIENT
    : "Model passed the gate, but inputs for these verified features were not supplied (showing nearest real tests on the supplied dimensions): " + missing.join(", ");
  return { ...base, mode: "nearest_real_test_lookup", label, nearest: nearest(c, vals, k) };
}

/** Candidates whose table contains the caller's fuel (or all candidates when no fuel was given). */
export function applicableCandidates(bundle: PredictorBundle, inp: FlamInput, family?: string): string[] {
  const fuel = inp.fuel as string | null | undefined;
  const out: string[] = [];
  for (const [cid, c] of Object.entries(bundle.candidates)) {
    if (family && !cid.includes(family)) continue;
    if (!c.features) continue;
    const cats = c.features.filter((f) => ["fuel", "norm_fuel", "sample_type"].includes(f.split("=")[0]) && f.includes("=")).map((f) => f.slice(f.indexOf("=") + 1));
    if (fuel && cats.length && !cats.some((cat) => fuelMatch(fuel, cat))) continue;
    if (fuel && !cats.length) continue;
    out.push(cid);
  }
  return out;
}

export type FlammabilityEmpirical = {
  empirical: CandidateResult[];
  n_candidates: number;
  overall_mode: "model" | "nearest_real_test_lookup" | "mixed";
  label_insufficient: string | null;
  note: string | null;
};

export function predictFlammabilityEmpirical(bundle: PredictorBundle, inp: FlamInput, raw: RawFeatures = {}, k = 5): FlammabilityEmpirical {
  const ids = applicableCandidates(bundle, inp).filter((c) => !c.startsWith("same_") && !c.startsWith("cld_"));
  const results = ids.map((c) => predictCandidate(bundle, c, inp, raw, k));
  const modes = new Set(results.map((r) => r.mode));
  const overall = modes.size === 1 && modes.has("model") ? "model" : !modes.has("model") ? "nearest_real_test_lookup" : "mixed";
  return {
    empirical: results,
    n_candidates: results.length,
    overall_mode: overall,
    label_insufficient: results.length ? LABEL_INSUFFICIENT : null,
    note: results.length ? null : "no PSI table with a verified outcome column contains this fuel",
  };
}

export const SMOKE_NOT_MODELED =
  "Particle size / dust-versus-smoke discrimination and detector (ionisation / photoelectric) response: the ingested SAME / SAME-R / DAFT " +
  "tables contain no particle-size, dust-class or detector-response columns, so nothing is predicted for them. Rt/R0 (PSI-101) and " +
  "weight-loss rate (PSI-102) are the only measured smoke outcomes available.";

export function predictSmokeEmpirical(bundle: PredictorBundle, inp: FlamInput, k = 5) {
  const r = predictCandidate(bundle, "same_r_rt_r0", inp, {}, k);
  const s = predictCandidate(bundle, "same_psi102_lookup", { ...inp, aging_time_s: inp.aging_time_s ?? null }, {}, k);
  return {
    title: SMOKE_TITLE, available: true, mode: r.mode, label: r.label, samer_psi101: r, same_psi102: s,
    not_modeled: SMOKE_NOT_MODELED, psi_ids: ["PSI-101", "PSI-102"],
  };
}

export function gateSummary(bundle: PredictorBundle) {
  const all = Object.values(bundle.candidates);
  const passed = all.filter((c) => c.passed_gate).map((c) => c.id);
  return { n_candidates: all.length, n_pass: passed.length, passed, lookup_only: all.filter((c) => !c.passed_gate).map((c) => c.id) };
}
