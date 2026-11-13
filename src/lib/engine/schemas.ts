/** Request validation for the same-origin API routes (mirrors the bounds and defaults of the research backend's request models). */
import { z } from "zod";

const optNum = z.number().nullable().optional();

export const FlammabilityRequestSchema = z.object({
  gravity_g: z.number().min(0).max(2).default(0),
  pressure_kpa: z.number().gt(0).max(500).default(101.3),
  o2_pct: z.number().min(0).max(100).default(21),
  flow_velocity_cm_s: z.number().min(0).max(500).default(10),
  fuel: z.string().nullable().optional().default("PMMA"),
  fuel_phase: z.string().default("Solid"),
  diluent: z.string().default("N2"),
  efield_kv_cm: z.number().default(0),
  sample_thickness_mm: z.number().default(1),
  flame_type: z.string().nullable().optional().default(null),
  co2_mole_pct: z.number().default(0),
  he_mole_pct: z.number().default(0),
  droplet_diameter_mm: optNum.default(null),
  n_initial_mole_frac: optNum.default(null),
  co_initial_mole_frac_as_labeled: optNum.default(null),
  aging_time_s: optNum.default(null),
  fiber: z.string().nullable().optional().default(null),
  nozzle_diameter_mm: optNum.default(null),
  raw_features: z.record(z.string(), z.union([z.number(), z.string(), z.null()])).default({}),
  k_nearest: z.number().int().min(1).max(20).default(5),
});
export type FlammabilityRequest = z.infer<typeof FlammabilityRequestSchema>;

export const SmokeRequestSchema = z.object({
  sample_material: z.string().nullable().optional().default("Kapton"),
  inlet_velocity_cm_s: z.number().min(0).max(100).default(5),
  net_aging_time_s: z.number().min(0).nullable().optional().default(60),
  primary_aging_time_s: optNum.default(null),
  primary_mixing_time_s: optNum.default(null),
  k_nearest: z.number().int().min(1).max(20).default(5),
  // legacy fields: accepted, mostly ignored (SAME / SAME-R / DAFT tables hold no particle-size or thermal-source columns)
  particle_d_gm_um: optNum.default(null),
  geometric_std_dev: optNum.default(null),
  aging_time_s: optNum.default(null),
  airflow_cm_s: optNum.default(null),
  thermal_source_temp_c: optNum.default(null),
});
export type SmokeRequest = z.infer<typeof SmokeRequestSchema>;

export const RankRequestSchema = z.object({
  habitat: z.string().default("iss"),
  top: z.number().int().min(1).nullable().optional().default(null),
});
