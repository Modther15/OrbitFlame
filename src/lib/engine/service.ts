/** Response builders shared by the same-origin API routes and the in-browser fallback (pure functions, no I/O). */
import { gateSummary, predictFlammabilityEmpirical, predictSmokeEmpirical, type PredictorBundle } from "./predictor";
import { physicsFeatures } from "./physics";
import type { FlammabilityRequest, SmokeRequest } from "./schemas";

export type SourceInfo = Record<string, unknown>;

/** Provenance block carried by every response (taken from public/data/meta.json). */
export function sourceInfoFrom(meta: Record<string, unknown>): SourceInfo {
  const keys = ["source", "source_label", "provenance_note", "row_count", "investigation_count", "source_file_count", "source_files"];
  return Object.fromEntries(keys.filter((k) => k in meta).map((k) => [k, meta[k]]));
}

type PhysicsInput = { gravity_g: number; pressure_kpa: number; o2_pct: number; flow_velocity_cm_s: number };

function physicsItem(row: PhysicsInput) {
  const p = physicsFeatures(row);
  return {
    flammability_probability: null as number | null, // no hot-ignition model passes the dummy-baseline gate
    p_flame_extinction: null as number | null,
    droplet_burn_rate_k_mm2_s: null as number | null,
    predicted_flame_spread_mm_s: null as number | null, // the PSI tables hold no spread-rate labels
    model_domain: "empirical_gate",
    limiting_o2_index_pct: p.loc_pred_pct, // analytical physics, not learned from PSI rows
    u_eff_cm_s: p.u_eff_cm_s,
    ventilation_hazard: p.ventilation_hazard,
    po2_kpa: p.po2_kpa,
    above_loc: row.o2_pct >= p.loc_pred_pct,
  };
}

export function flammabilityBody(req: FlammabilityRequest, bundle: PredictorBundle, info: SourceInfo) {
  const { raw_features, k_nearest, ...row } = req;
  const item: ReturnType<typeof physicsItem> & { empirical?: unknown; empirical_mode?: string; empirical_label?: string | null } = physicsItem(row);
  const emp = predictFlammabilityEmpirical(bundle, row, raw_features, k_nearest);
  item.empirical = emp.empirical;
  item.empirical_mode = emp.overall_mode;
  item.empirical_label = emp.label_insufficient;
  for (const r of emp.empirical) {
    if (r.mode === "model" && r.candidate === "flex_extinction_outcome") item.p_flame_extinction = r.prediction?.probability_positive_class ?? null;
  }
  return {
    ...info,
    input: row,
    prediction: item,
    model_mode: emp.overall_mode,
    model: "gated empirical predictors: fitted model only when it beats dummy baselines under group-CV, else nearest real experimental tests",
    label: emp.label_insufficient,
    model_audit_summary: gateSummary(bundle),
  };
}

function linspace(a: number, b: number, n: number): number[] {
  if (n === 1) return [a];
  const step = (b - a) / (n - 1);
  return Array.from({ length: n }, (_, i) => (i === n - 1 ? b : a + i * step));
}

export type GridParams = { gravity: number; pressure_kpa: number; fuel: string; o2_min: number; o2_max: number; o2_steps: number; flow_max: number; flow_steps: number };

export function gridBody(p: GridParams, info: SourceInfo) {
  const o2 = linspace(p.o2_min, p.o2_max, p.o2_steps);
  const fl = linspace(0, p.flow_max, p.flow_steps);
  const cells = o2.flatMap((a) =>
    fl.map((b) => ({ o2_pct: a, flow_velocity_cm_s: b, ...physicsItem({ gravity_g: p.gravity, pressure_kpa: p.pressure_kpa, o2_pct: a, flow_velocity_cm_s: b }) })),
  );
  return {
    ...info,
    gravity_g: p.gravity,
    pressure_kpa: p.pressure_kpa,
    fuel: p.fuel,
    o2_axis: o2,
    flow_axis_cm_s: fl,
    cells,
    note: "No empirical hot-ignition model passes the dummy-baseline gate, so flammability_probability is null. limiting_o2_index_pct and ventilation_hazard are ANALYTICAL physics (physics ranker), not learned from PSI rows.",
  };
}

export function smokeBody(req: SmokeRequest, bundle: PredictorBundle, info: SourceInfo) {
  const inp = {
    fuel: req.sample_material,
    flow_velocity_cm_s: req.airflow_cm_s ?? req.inlet_velocity_cm_s,
    aging_time_s: req.aging_time_s ?? req.net_aging_time_s,
  };
  const out = predictSmokeEmpirical(bundle, inp, req.k_nearest);
  const ignored = (["particle_d_gm_um", "geometric_std_dev", "thermal_source_temp_c"] as const).filter((k) => req[k] !== null && req[k] !== undefined);
  return { ...info, input: inp, ignored_legacy_fields: ignored, ...out };
}
