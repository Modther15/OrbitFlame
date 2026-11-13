"use client";
/** Browser-side backend client: live API with ~2.5 s timeout, automatic fallback to /data/*.json snapshots. */
import {
  API_BASE,
  API_TIMEOUT_MS,
  fetchLive,
  isLiveCoolingDown,
  loadWithFallback,
  markLiveDown,
  resetLiveCooldown,
  type Loaded,
} from "@/lib/api/backend-core";
import type { VarSummaryPayload } from "@/lib/data/variables";
import type {
  DataSourceMode,
  EffectiveGravityPayload,
  FlammabilityInput,
  FlammabilityResponse,
  GridCell,
  GridsSnapshot,
  HabitatsPayload,
  RankAllPayload,
  RankPayload,
  MetaPayload,
  SmokeAnalyzerResponse,
  SmokeInput,
  SmokeSnapshot,
  UploadPayload,
} from "@/lib/api/backend-types";

async function loadSnapshot(file: string): Promise<unknown> {
  const res = await fetch(`/data/${file}`, { cache: "force-cache" });
  if (!res.ok) throw new Error(`Snapshot ${file} unavailable`);
  return res.json();
}

export { API_BASE };

/** Probe the API; returns live/static plus meta (provenance label, generation time). */
export async function probeBackend(): Promise<Loaded<MetaPayload>> {
  resetLiveCooldown();
  return loadWithFallback<MetaPayload>("/api/health", "meta.json", loadSnapshot);
}

/** Actual-gravity vs effective-gravity-proxy ladder (live /api/effective-gravity, else /data/effective_gravity.json). */
export function loadEffectiveGravity(): Promise<Loaded<EffectiveGravityPayload>> {
  return loadWithFallback<EffectiveGravityPayload>("/api/effective-gravity", "effective_gravity.json", loadSnapshot);
}

function nearest(axis: number[], v: number): number {
  return axis.reduce((best, a) => (Math.abs(a - v) < Math.abs(best - v) ? a : best), axis[0]);
}

/** Per-gravity grid files are fetched on demand (one small file instead of the whole 4-gravity set). */
const GRID_GRAVITIES = [0, 0.16, 0.38, 1];
const gridPromises = new Map<number, Promise<GridsSnapshot>>();
function loadGridSnapshot(g: number): Promise<GridsSnapshot> {
  let p = gridPromises.get(g);
  if (!p) {
    p = loadSnapshot(`grid_${g}.json`) as Promise<GridsSnapshot>;
    p.catch(() => gridPromises.delete(g));
    gridPromises.set(g, p);
  }
  return p;
}

export type FlammabilityResult = { response: FlammabilityResponse; source: DataSourceMode; approximate: boolean };

/** Live model call; static mode does a nearest-cell lookup on the precomputed grid for the closest gravity. */
export async function predictFlammability(input: FlammabilityInput): Promise<FlammabilityResult> {
  if (!isLiveCoolingDown()) {
    try {
      const response = await fetchLive<FlammabilityResponse>("/api/predict/flammability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      return { response, source: "live", approximate: false };
    } catch {
      markLiveDown();
    }
  }
  const gNear = nearest(GRID_GRAVITIES, input.gravity_g);
  const snap = await loadGridSnapshot(gNear);
  const grid = Object.entries(snap.grids).find(([k]) => Number(k) === gNear)?.[1] ?? Object.values(snap.grids)[0];
  const o2 = nearest(grid.o2_axis, input.o2_pct);
  const flow = nearest(grid.flow_axis_cm_s, input.flow_velocity_cm_s);
  const cell = grid.cells.find((c: GridCell) => c.o2_pct === o2 && c.flow_velocity_cm_s === flow) ?? grid.cells[0];
  const { o2_pct: _o, flow_velocity_cm_s: _f, ...cellPrediction } = cell;
  void _o;
  void _f;
  // The static grid was computed for one fuel; do not present its model output for any other fuel.
  const sameFuel = (input.fuel ?? "").toLowerCase() === grid.fuel.toLowerCase();
  const prediction = sameFuel
    ? cellPrediction
    : { ...cellPrediction, flammability_probability: null, p_flame_extinction: null, droplet_burn_rate_k_mm2_s: null, model_domain: "out_of_domain" };
  return {
    response: {
      source: snap.source,
      source_label: snap.source_label,
      provenance_note: snap.provenance_note,
      input,
      prediction,
      model: `Static snapshot grid lookup (nearest cell: ${grid.gravity_g} g, ${o2.toFixed(1)}% O2, ${flow.toFixed(0)} cm/s, ${grid.pressure_kpa} kPa, ${grid.fuel})`,
    },
    source: "static",
    approximate: true,
  };
}

export type SmokeResult = { response: SmokeAnalyzerResponse; source: DataSourceMode; approximate: boolean; note: string };

/** Empirical SAME / SAME-R analyzer. Live API (200 always: model or nearest real tests) -> static snapshot grid of the same responses. */
export async function predictSmokeDust(input: SmokeInput): Promise<SmokeResult> {
  if (!isLiveCoolingDown()) {
    try {
      const response = await fetchLive<SmokeAnalyzerResponse>("/api/predict/smoke-dust", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      return { response, source: "live", approximate: false, note: "Live API" };
    } catch {
      markLiveDown();
    }
  }
  const snap = (await loadSnapshot("smoke_dust_examples.json")) as SmokeSnapshot;
  const mats = snap.materials;
  const mat = mats.find((m) => m.toLowerCase() === input.sample_material.toLowerCase()) ?? mats[0];
  const v = nearest(snap.velocities_cm_s, input.inlet_velocity_cm_s);
  const a = nearest(snap.aging_s, input.net_aging_time_s);
  const cell = snap.precomputed.find((p) => p.sample_material === mat && p.inlet_velocity_cm_s === v && p.net_aging_time_s === a) ?? snap.precomputed[0];
  const audit = snap.samer_psi101_audit as Record<string, unknown>;
  const psi101: SmokeAnalyzerResponse["samer_psi101"] = {
    candidate: "same_r_rt_r0",
    title: String(audit.title ?? "SAME-R smoke Rt/R0"),
    psi_ids: ["PSI-101"],
    target: String(audit.target ?? "PSI-101 Rt/R0"),
    mode: cell.mode,
    label: cell.label,
    n_samples: Number(audit.n_samples ?? 0),
    passed_gate: Boolean(audit.passed_gate),
    prediction: cell.prediction,
    scores: (audit.scores as SmokeAnalyzerResponse["samer_psi101"]["scores"]) ?? null,
    gate_checks: (audit.gate_checks as string[]) ?? null,
    nearest: { rows: cell.nearest },
  };
  const psi102: SmokeAnalyzerResponse["same_psi102"] = {
    candidate: "same_psi102_lookup",
    title: "SAME (PSI-102) weight-loss rate",
    psi_ids: ["PSI-102"],
    target: "PSI-102 weight loss rate (mg/min), n=4 labelled rows",
    mode: "nearest_real_test_lookup",
    label: "Insufficient empirical signal in public table - showing nearest real experimental test lookup",
    n_samples: 4,
    passed_gate: false,
    nearest: {
      rows: snap.same_psi102_rows
        .filter((r) => typeof r["weight_loss_rate__mg_min"] === "number")
        .map((r) => {
          const air = Number(r["air_flow__cm_s"] ?? 0);
          const age = Number(r["aging_duration__minutes"] ?? 0);
          return {
            distance: Math.hypot(air - input.inlet_velocity_cm_s, age - input.net_aging_time_s / 60),
            source_file: String(r["source_file"]),
            source_sheet: String(r["source_sheet"]),
            source_row: Number(r["source_row"]),
            features: { air_flow__cm_s: air, aging_duration__minutes: age },
            outcomes: { weight_loss_rate__mg_min: r["weight_loss_rate__mg_min"] as number, aging_duration__minutes: age, air_flow__cm_s: air },
          };
        })
        .sort((x, y) => x.distance - y.distance),
    },
  };
  return {
    response: {
      source: snap.source,
      source_label: snap.source_label,
      provenance_note: snap.provenance_note,
      title: snap.title,
      available: true,
      mode: cell.mode,
      label: cell.label,
      input,
      psi_ids: snap.psi_ids,
      samer_psi101: psi101,
      same_psi102: psi102,
      not_modeled: snap.not_modeled,
    },
    source: "static",
    approximate: true,
    note: `Static snapshot: precomputed response for ${mat}, ${v} cm/s, ${a} s aging (nearest grid point). Start the API for exact input handling.`,
  };
}

/** Upload requires the live API; throws a friendly error in static mode. */
export async function uploadDataset(file: File): Promise<UploadPayload> {
  const form = new FormData();
  form.append("file", file);
  let res: Response;
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), Math.max(API_TIMEOUT_MS, 15000));
    res = await fetch(`${API_BASE}/api/upload`, { method: "POST", body: form, signal: ctl.signal });
    clearTimeout(timer);
  } catch {
    throw new Error("Upload needs the live API. The app is currently running from static snapshots; start the backend (./start_orbitflame.sh) to enable parsing.");
  }
  if (!res.ok) {
    const j = (await res.json().catch(() => null)) as { detail?: string } | null;
    throw new Error(j?.detail ?? `Upload failed (${res.status})`);
  }
  return (await res.json()) as UploadPayload;
}

/* ---- Lazy, once-per-page-load shared loaders for the Mission Lab panel (not embedded in page props) ---- */
const TOP_N = 15;
let habitatsPromise: Promise<Loaded<HabitatsPayload>> | null = null;
let rankingsPromise: Promise<Loaded<RankAllPayload>> | null = null;

export function loadHabitats(): Promise<Loaded<HabitatsPayload>> {
  habitatsPromise ??= loadWithFallback<HabitatsPayload>("/api/habitats", "habitats.json", loadSnapshot).catch((e) => {
    habitatsPromise = null;
    throw e;
  });
  return habitatsPromise;
}

/** Keep only top-N investigations per habitat and their best-scoring row (all the Mission Lab panel renders). */
function trimRankings(full: RankAllPayload): RankAllPayload {
  const habitats: Record<string, RankPayload> = {};
  for (const [k, r] of Object.entries(full.habitats ?? {})) {
    const by = r.by_investigation.slice(0, TOP_N);
    const keep = new Set(by.map((b) => b.psi_id));
    const seen = new Set<string>();
    const ranked = r.ranked.filter((row) => keep.has(row.psi_id) && !seen.has(row.psi_id) && seen.add(row.psi_id));
    habitats[k] = { ...r, by_investigation: by, ranked };
  }
  return { ...full, habitats };
}

/** Live API (trimmed client-side) -> slim rankings_top.json snapshot. */
export function loadRankingsTop(): Promise<Loaded<RankAllPayload>> {
  rankingsPromise ??= loadWithFallback<RankAllPayload>("/api/rank/all", "rankings_top.json", loadSnapshot)
    .then((r) => (r.source === "live" ? { ...r, data: trimRankings(r.data) } : r))
    .catch((e) => {
      rankingsPromise = null;
      throw e;
    });
  return rankingsPromise;
}

/* ---- Controlled / varied variable summary (investigation_variable_summary): live API -> static snapshot ---- */
let varsPromise: Promise<Loaded<VarSummaryPayload>> | null = null;
export function loadVariableSummary(): Promise<Loaded<VarSummaryPayload>> {
  varsPromise ??= loadWithFallback<VarSummaryPayload>("/api/variable-summary", "variable_summary.json", loadSnapshot).catch((e) => {
    varsPromise = null;
    throw e;
  });
  return varsPromise;
}

/** Live-only call of POST /api/predict/flammability with an arbitrary audited-feature body (needs the model bundle, no static fallback). */
export async function predictFlammabilityRaw(body: Record<string, unknown>): Promise<FlammabilityResponse> {
  return fetchLive<FlammabilityResponse>("/api/predict/flammability", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }, 8000);
}
