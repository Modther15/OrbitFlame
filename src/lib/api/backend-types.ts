/** Typed shapes of the FlameGuard SI backend (src/api/server.py) and /public/data snapshots. */

export const BENCHMARK_SOURCE_LABEL = "VERIFIED NASA PSI EXPERIMENTAL DATA";
export const BENCHMARK_LABEL = "VERIFIED NASA PSI EXPERIMENTAL DATA" as const;
export const BENCHMARK_NOTE =
  "Every row is parsed unmodified from experimental tables and test matrices downloaded from psi.nasa.gov. Values a file does not state are NULL (never imputed). Model outputs are surrogate estimates trained only on these rows.";

export type Provenance = {
  source: string;
  source_label: string;
  provenance_note: string;
  row_count?: number;
  investigation_count?: number;
  source_file_count?: number;
  source_files?: string[];
};

export type PsiRow = {
  psi_id: string;
  investigation: string;
  pillar: string;
  hardware: string | null;
  fuel: string | null;
  fuel_phase: string | null;
  test_id: string;
  gravity_g: number | null;
  /** Actual gravity provenance: 'iss_cygnus_flight_metadata' | 'user_stated_iss_cygnus_baseline (...)' | 'row_ground_tag'. */
  gravity_source?: string | null;
  gravity_inferred?: boolean | null;
  /** HEURISTIC PROXY (never measured): equals gravity_g when effective_gravity_method === 'direct'. */
  effective_gravity_g?: number | null;
  effective_gravity_method?: string | null;
  effective_gravity_bin?: string | null;
  pressure_kpa: number | null;
  o2_pct: number | null;
  diluent: string | null;
  flow_velocity_cm_s: number | null;
  flow_direction?: string | null;
  efield_kv_cm?: number | null;
  sample_thickness_mm?: number | null;
  sample_geometry?: string | null;
  source_file?: string | null;
  source_sheet?: string | null;
  source_row?: number | null;
  sample_name?: string | null;
  material_raw?: string | null;
  flame_type?: string | null;
  flight_program?: string | null;
  ignited?: number | null;
  outcome_raw?: string | null;
  droplet_burn_rate_k_mm2_s?: number | null;
  droplet_diameter_mm?: number | null;
  co2_mole_pct?: number | null;
  he_mole_pct?: number | null;
  t_ad_k?: number | null;
  extra_metrics_json?: string | null;
  row_kind?: string | null;
  o2_basis?: string | null;
  xi_fuel_mole_frac?: number | null;
  n_flames_ignited?: number | null;
  flame_spread_rate_mm_s?: number | null;
  flame_temp_k?: number | null;
  burn_time_s?: number | null;
  extinction_flag?: number | null;
  loc_o2_pct?: number | null;
  soot_yield?: number | null;
  smoke_particle_um?: number | null;
  radiative_fraction?: number | null;
  source?: string | null;
  particle_d_gm_um?: number | null;
  event_class?: string | null;
  sample_id?: string | null;
  inferred_fields?: string | null;
  [key: string]: unknown;
};

export type InvestigationsPayload = Provenance & { total: number; rows: PsiRow[]; investigation_meta?: InvestigationMeta[] };

export type InvestigationMeta = {
  psi_id: string;
  investigation: string | null;
  title: string | null;
  objective: string | null;
  approach: string | null;
  experiment_hardware: string | null;
  flight_program: string | null;
  doi: string | null;
  n_publications: number;
  gravity_g?: number | null;
  gravity_inferred?: boolean | null;
  gravity_source?: string | null;
  gravity_conflict?: string | null;
  gravity_note?: string | null;
};

export type HabitatInfo = {
  key: string;
  name: string;
  pressure_kpa: number;
  pressure_range_kpa: [number, number];
  o2_pct: number;
  o2_range_pct: [number, number];
  gravity_g: number;
  gravity_range_g: [number, number];
  ventilation_cm_s: [number, number];
  u_eff_cm_s: [number, number];
  ventilation_citation: string;
};
export type HabitatsPayload = Provenance & { habitats: HabitatInfo[] };

export type RankedRow = {
  relevance_rank: number;
  relevance_score: number;
  psi_id: string;
  investigation: string;
  test_id: string;
  fuel: string | null;
  pillar: string;
  gravity_g: number | null;
  pressure_kpa: number | null;
  o2_pct: number | null;
  flow_velocity_cm_s: number | null;
  gravity_source?: string | null;
  effective_gravity_g?: number | null;
  effective_gravity_method?: string | null;
  effective_gravity_bin?: string | null;
  sim_gravity_actual?: number | null;
  sim_gravity_proxy?: number | null;
  gravity_basis?: "actual" | "proxy" | null;
  [component: string]: unknown;
};
export type RankByInvestigation = {
  psi_id: string; investigation: string; max_score: number; mean_score: number; n_rows: number;
  /** rows of this investigation whose gravity score came from the effective-gravity PROXY (not from actual gravity) */
  n_proxy_gravity_rows?: number; gravity_g?: number | null; gravity_source?: string | null;
  best_sim_gravity_actual?: number | null; best_sim_gravity_proxy?: number | null;
};
export type RankPayload = Provenance & { habitat: string; habitat_name: string; by_investigation: RankByInvestigation[]; ranked: RankedRow[] };
export type RankAllPayload = Provenance & { habitats: Record<string, RankPayload> };

export type FlammabilityInput = {
  gravity_g: number;
  pressure_kpa: number;
  o2_pct: number;
  flow_velocity_cm_s: number;
  fuel?: string;
  fuel_phase?: string;
};
export type FlammabilityPrediction = {
  /** P(hot ignition) from the real PSI-159 (CFI-G) rows; null outside that domain. */
  flammability_probability: number | null;
  p_flame_extinction?: number | null;
  droplet_burn_rate_k_mm2_s?: number | null;
  /** Always null: the PSI tables contain no numeric flame-spread-rate labels. */
  predicted_flame_spread_mm_s: number | null;
  model_domain?: string;
  /** Analytical physics bound (not learned from PSI rows). */
  limiting_o2_index_pct: number;
  u_eff_cm_s: number;
  ventilation_hazard: number;
  po2_kpa: number;
  above_loc: boolean;
  /** Per-candidate gated empirical results (model only if it beat the dummy baselines; otherwise nearest real tests). */
  empirical?: SmokeCandidateResult[];
  empirical_mode?: string;
  empirical_label?: string | null;
};
export type FlammabilityResponse = Provenance & { input: FlammabilityInput; prediction: FlammabilityPrediction; model?: string };

export type GridCell = { o2_pct: number; flow_velocity_cm_s: number } & FlammabilityPrediction;
export type GridPayload = Provenance & { gravity_g: number; pressure_kpa: number; fuel: string; o2_axis: number[]; flow_axis_cm_s: number[]; cells: GridCell[] };
export type GridsSnapshot = Provenance & { grids: Record<string, GridPayload> };

export type SmokeInput = {
  /** PSI-101 'Sample Type' / PSI-102 'Sample Material' (Kapton, Silicone, Lampwick, Pyrell, Teflon ...). */
  sample_material: string;
  /** PSI-101 'Inlet velocity (cm/s)' / PSI-102 'Air Flow (cm/s)'. */
  inlet_velocity_cm_s: number;
  /** PSI-101 'Net aging time (sec)'. */
  net_aging_time_s: number;
};
export type NearestRealRow = {
  distance: number;
  source_file: string;
  source_sheet: string;
  source_row: number;
  features: Record<string, number | string | null>;
  outcomes: Record<string, number | string | null>;
};
export type SmokeCandidateResult = {
  candidate: string;
  title: string;
  psi_ids: string[];
  target: string;
  mode: "model" | "nearest_real_test_lookup";
  label: string;
  n_samples: number;
  passed_gate: boolean;
  prediction?: { value?: number; typical_error_mae_group_cv?: number; probability_positive_class?: number };
  scores?: { model?: Record<string, number | number[]>; dummy_mean?: Record<string, number>; delta_mae_dummy_minus_model_ci95?: number[] } | null;
  gate_checks?: string[] | null;
  nearest: { rows: NearestRealRow[]; dims_used?: string[]; dims_missing?: string[]; note?: string };
};
/** 200 response of POST /api/predict/smoke-dust (never 503). */
export type SmokeAnalyzerResponse = Provenance & {
  title: string;
  available: boolean;
  mode: "model" | "nearest_real_test_lookup";
  label: string;
  input?: Record<string, unknown>;
  psi_ids: string[];
  samer_psi101: SmokeCandidateResult;
  same_psi102: SmokeCandidateResult;
  not_modeled: string;
};
export type SmokePrecomputed = {
  sample_material: string;
  inlet_velocity_cm_s: number;
  net_aging_time_s: number;
  mode: "model" | "nearest_real_test_lookup";
  label: string;
  prediction?: SmokeCandidateResult["prediction"];
  nearest: NearestRealRow[];
};
export type SmokeSnapshot = Provenance & {
  available: boolean;
  title: string;
  psi_ids: string[];
  materials: string[];
  velocities_cm_s: number[];
  aging_s: number[];
  precomputed: SmokePrecomputed[];
  samer_psi101_rows: Record<string, unknown>[];
  same_psi102_rows: Record<string, unknown>[];
  samer_psi101_audit: Record<string, unknown>;
  not_modeled: string;
};

export type UploadPayload = Provenance & { filename: string; n_rows: number; persisted: boolean; rows: Record<string, unknown>[] };

export type DataSourceMode = "live" | "static" | "fixture";
export type MetaPayload = Provenance & { generated?: string; rows?: number; investigations?: number; mode?: string };

/** /api/effective-gravity and public/data/effective_gravity.json: actual-gravity vs effective-gravity (HEURISTIC PROXY) ladder. */
export type GravityContributor = { psi_id: string; investigation: string; n_rows: number; methods: string[] };
export type GravityRegime = {
  regime: "zero" | "lunar_eq" | "mars_eq" | "earth_eq";
  label: string;
  target_g: number;
  actual_rows: number;
  actual_investigations: GravityContributor[];
  proxy_rows: number;
  proxy_investigations: GravityContributor[];
  ground_tagged_rows: number;
};
export type EffectiveGravityPayload = Provenance & {
  regimes: GravityRegime[];
  definition: Record<string, unknown> & { label: string };
  rows_by_gravity_source: Record<string, number>;
  rows_by_effective_method: Record<string, number>;
  n_rows: number;
  n_actual_0g_rows: number;
  n_actual_1g_rows: number;
  caveat: string;
  investigations?: Array<Record<string, unknown>>;
};
