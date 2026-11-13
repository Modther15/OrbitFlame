/**
 * Habitat-relevance and ventilation physics (isomorphic, no I/O).
 *
 * TypeScript port of the research pipeline's physics ranker. Equations:
 *  (E1) u_b = C_b sqrt(g g0 L_c)           buoyant velocity
 *  (E2) u_eff = sqrt(u_forced^2 + u_b^2)   mixed convection
 *  (E3) H(u_eff) log-normal ventilation hazard, peak at 12 cm/s
 *  (E4) limiting oxygen concentration LOC(u, g, P)
 *  (E5) electric-field body force -> equivalent gravity
 *  (E8) habitat relevance score S = 100 [B + b (1 - B)]
 * Everything here is deterministic arithmetic on supplied numbers; nothing is learned or invented.
 */

export type Range = [number, number];

export type HabitatProfile = {
  key?: string;
  name: string;
  pressure_kpa: number;
  pressure_range_kpa: Range;
  o2_pct: number;
  o2_range_pct: Range;
  gravity_g: number;
  gravity_range_g: Range;
  ventilation_cm_s: Range;
  u_eff_cm_s: Range;
  ventilation_citation: string;
  fuel_relevance: Record<string, number>;
  pillar_priority: Record<string, number>;
  bonus: Record<string, number>;
};

export const HABITAT_KEYS = ["iss", "moon", "mars", "eva", "earth"] as const;
export type HabitatKey = (typeof HABITAT_KEYS)[number];

export const HABITAT_ALIASES: Record<string, HabitatKey> = {
  leo: "iss", station: "iss", artemis: "moon", lunar: "moon", rover: "moon", martian: "mars",
  suit: "eva", spacesuit: "eva", earth_analog: "earth", terrestrial: "earth", submarine: "earth",
};

export function resolveHabitatKey(raw: string): HabitatKey | null {
  const k = raw.trim().toLowerCase();
  const key = (HABITAT_ALIASES[k] ?? k) as HabitatKey;
  return (HABITAT_KEYS as readonly string[]).includes(key) ? key : null;
}

const G0_CM_S2 = 980.665;
const G0_M_S2 = 9.80665;
const E_CHARGE_C = 1.602176634e-19;
const P_REF_KPA = 101.325;
const L_C_CM = 5.0;
const C_B = 0.5;
const VENT_PEAK = 12.0;
const VENT_SIGMA_LOW = 0.8;
const VENT_SIGMA_HIGH = 1.2;
const LOC_1G = 17.0;
const LOC_MIN_RATIO = 0.88;
const LOC_EPS = 0.15;
const LOC_P_EXP = 0.15;
const EFIELD_N = 2.0e13;
const EFIELD_RHO = 0.3;
const EFIELD_MAX = 10.0;
const PROXY_WEIGHT = 0.25;
const NEUTRAL = 0.5;
const MISSING_ATMOSPHERE = 0.15;
const BONUS_MIN_O2 = 30.0;
const FUEL_DEFAULT = 0.5;

const WEIGHTS: Record<string, number> = { gravity: 0.2, flow: 0.2, po2: 0.2, pressure: 0.1, fuel: 0.15, pillar: 0.15 };
const SIGMA = { sqrtG: 0.25, uEff: 10.0, lnPo2: 0.35, lnP: 0.35 };
const PROXY_METHODS = ["convective_velocity_equivalence", "e_field_ion_body_force"];

const FUEL_CLASSES: Array<[string, RegExp]> = [
  ["textile", /cotton|nomex|fabric|cloth|sibal|fiberglass|cellulose|paper|kimwipe/i],
  ["polymer", /pmma|plexiglas|acrylic|delrin|polyethylene|hdpe|ldpe|polycarbonate|silicone|ultem|polymer|plastic|polystyrene/i],
  ["wire_insulation", /kapton|teflon|ptfe|wire|insulation|polyimide|etfe|tefzel/i],
  ["gaseous", /ethylene|methane|propane|hydrogen|ethane|c2h4|ch4|gaseous|\bgas\b/i],
  ["liquid", /heptane|decane|methanol|ethanol|alkane|octane|droplet|hexane|jp-?8|diesel/i],
  ["dust", /dust|regolith|simulant/i],
];
const BONUS_PATTERNS: Array<[string, RegExp]> = [
  ["cfig_high_o2", /psi-?159\b|cfi-?g/i],
  ["same_daft", /psi-?10[12]\b|psi-?115\b|\bsame\b|same-r|daft/i],
  ["flex_suppression", /psi-?6[89]\b|\bflex/i],
  ["efield_partial_g", /e-?field/i],
];

/* ---------------------------------- scalar physics ---------------------------------- */
export function buoyantVelocity(g: number): number {
  return C_B * Math.sqrt(Math.max(g, 0) * G0_CM_S2 * L_C_CM);
}
export function effectiveConvectiveVelocity(vForced: number, g: number): number {
  const v = Math.abs(vForced);
  const ub = buoyantVelocity(g);
  return Math.sqrt(v * v + ub * ub);
}
export function ventilationHazard(v: number, g: number): number {
  const u = effectiveConvectiveVelocity(v, g);
  const x = Math.log(Math.max(u, 1e-9) / VENT_PEAK);
  const s = x < 0 ? VENT_SIGMA_LOW : VENT_SIGMA_HIGH;
  return Math.exp(-0.5 * (x / s) ** 2);
}
export function limitingOxygenIndex(v: number, g: number, pressureKpa: number = P_REF_KPA): number {
  const H = ventilationHazard(v, g);
  const H1g = ventilationHazard(0, 1);
  const denom = Math.log((H1g + LOC_EPS) / (1 + LOC_EPS));
  const beta = Math.log(LOC_MIN_RATIO) / Math.min(denom, -1e-9);
  const flowTerm = ((H1g + LOC_EPS) / (H + LOC_EPS)) ** beta;
  const pTerm = (Math.max(pressureKpa, 1e-6) / P_REF_KPA) ** -LOC_P_EXP;
  return Math.min(Math.max(LOC_1G * flowTerm * pTerm, 0), 100);
}
export function efieldEquivalentG(eKvCm: number): number {
  const e = Math.min(Math.max(Math.abs(eKvCm), 0), EFIELD_MAX);
  const f = E_CHARGE_C * EFIELD_N * (e * 1.0e5);
  return Math.min(Math.max(f / (EFIELD_RHO * G0_M_S2), 0), 1);
}

const fin = Number.isFinite;
const nz = (x: number | null | undefined): number => (typeof x === "number" ? x : NaN);

/** Analytical physics features for one operating point (flammability endpoint). Missing flow counts as 0, missing pressure as 1 atm for the LOC term. */
export function physicsFeatures(i: { gravity_g: number; pressure_kpa: number | null; o2_pct: number | null; flow_velocity_cm_s: number | null }) {
  const g = Math.max(nz(i.gravity_g), 0);
  const v0 = nz(i.flow_velocity_cm_s);
  const v = fin(v0) ? v0 : 0;
  const P = nz(i.pressure_kpa);
  const X = nz(i.o2_pct);
  return {
    u_eff_cm_s: effectiveConvectiveVelocity(v, g),
    ventilation_hazard: ventilationHazard(v, g),
    loc_pred_pct: limitingOxygenIndex(v, g, fin(P) ? P : P_REF_KPA),
    po2_kpa: (P * X) / 100,
  };
}

/* ---------------------------------- habitat relevance (E8) ---------------------------------- */
function intervalGap(x: number, a: number, b: number): number {
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  return Math.max(lo - x, 0) + Math.max(x - hi, 0);
}
function gauss(gap: number, sigma: number, neutral = NEUTRAL): number {
  return fin(gap) ? Math.exp(-0.5 * (gap / sigma) ** 2) : neutral;
}
const safeLog = (x: number) => Math.log(Math.max(x, 1e-6));

export type ScoreRow = {
  gravity_g?: number | null;
  pressure_kpa?: number | null;
  o2_pct?: number | null;
  flow_velocity_cm_s?: number | null;
  efield_kv_cm?: number | null;
  effective_gravity_g?: number | null;
  effective_gravity_method?: string | null;
  fuel?: string | null;
  pillar?: string | null;
  psi_id?: string | null;
  investigation?: string | null;
};

export type ScoreComponents = {
  sim_gravity: number;
  sim_gravity_actual: number;
  sim_gravity_proxy: number | null;
  gravity_basis: "actual" | "proxy";
  sim_flow: number;
  sim_po2: number;
  sim_pressure: number;
  sim_fuel: number;
  sim_pillar: number;
  bonus: number;
  u_eff_test_cm_s: number;
  base: number;
  relevance_score: number;
};

function normPillar(p: string | null | undefined): string {
  const s = (p ?? "").toLowerCase().replace(/[^a-z]/g, "");
  return s.startsWith("partial") ? "partialg" : s;
}

export function scoreRow(row: ScoreRow, hab: HabitatProfile): ScoreComponents {
  let g = nz(row.gravity_g);
  const E = nz(row.efield_kv_cm);
  if (fin(E) && E > 0) {
    const ge = efieldEquivalentG(E);
    g = Number.isNaN(g) ? ge : Math.max(g, ge);
  }
  g = Math.max(g, 0);
  const v0 = nz(row.flow_velocity_cm_s);
  const v = fin(v0) ? v0 : 0;
  const P = nz(row.pressure_kpa);
  const X = nz(row.o2_pct);
  const po2 = (P * X) / 100;

  const [gLo, gHi] = hab.gravity_range_g;
  const [pLo, pHi] = hab.pressure_range_kpa;
  const [xLo, xHi] = hab.o2_range_pct;

  const simGActual = gauss(intervalGap(Math.sqrt(g), Math.sqrt(gLo), Math.sqrt(gHi)), SIGMA.sqrtG);
  const gEff = nz(row.effective_gravity_g);
  const method = row.effective_gravity_method ?? "direct";
  const atmComplete = fin(X) && fin(P);
  const isProxy = PROXY_METHODS.includes(method) && fin(gEff) && atmComplete;
  const simGProxyRaw = gauss(intervalGap(Math.sqrt(Math.max(fin(gEff) ? gEff : 0, 0)), Math.sqrt(gLo), Math.sqrt(gHi)), SIGMA.sqrtG);
  const simGProxy = isProxy ? PROXY_WEIGHT * simGProxyRaw : null;
  const useProxy = isProxy && simGProxy !== null && simGProxy > simGActual;
  const simG = useProxy ? (simGProxy as number) : simGActual;

  const uTest = effectiveConvectiveVelocity(v, g);
  const [uLo, uHi] = hab.u_eff_cm_s;
  const simU = gauss(intervalGap(uTest, uLo, uHi), SIGMA.uEff);
  const simPo2 = gauss(intervalGap(safeLog(po2), Math.log((pLo * xLo) / 100), Math.log((pHi * xHi) / 100)), SIGMA.lnPo2, MISSING_ATMOSPHERE);
  const simP = gauss(intervalGap(safeLog(P), Math.log(pLo), Math.log(pHi)), SIGMA.lnP, MISSING_ATMOSPHERE);

  const fuel = (row.fuel ?? "").toLowerCase();
  let best = -1;
  for (const [cls, rx] of FUEL_CLASSES) if (rx.test(fuel)) best = Math.max(best, hab.fuel_relevance[cls] ?? FUEL_DEFAULT);
  const simFuel = best < 0 ? FUEL_DEFAULT : best;
  const simPillar = hab.pillar_priority[normPillar(row.pillar)] ?? NEUTRAL;

  const text = ` ${row.psi_id ?? ""} ${row.investigation ?? ""}`.toLowerCase();
  let bonus = 0;
  for (const [key, rx] of BONUS_PATTERNS) {
    const b = Number(hab.bonus[key] ?? 0);
    if (b <= 0) continue;
    if (key === "cfig_high_o2" && Math.max(...hab.o2_range_pct) < BONUS_MIN_O2) continue;
    if (rx.test(text)) bonus = Math.max(bonus, b);
  }
  bonus = Math.min(Math.max(bonus, 0), 0.35);

  const sims: Record<string, number> = { gravity: simG, flow: simU, po2: simPo2, pressure: simP, fuel: simFuel, pillar: simPillar };
  let wTot = 0;
  let acc = 0;
  for (const k of Object.keys(sims)) {
    const w = Math.max(WEIGHTS[k] ?? 0, 0);
    wTot += w;
    acc += w * sims[k];
  }
  const base = acc / (wTot || 1);
  const score = 100 * Math.min(Math.max(base + bonus * (1 - base), 0), 1);
  return {
    sim_gravity: simG, sim_gravity_actual: simGActual, sim_gravity_proxy: simGProxy, gravity_basis: useProxy ? "proxy" : "actual",
    sim_flow: simU, sim_po2: simPo2, sim_pressure: simP, sim_fuel: simFuel, sim_pillar: simPillar, bonus, u_eff_test_cm_s: uTest, base,
    relevance_score: score,
  };
}

/** Score one row against every habitat; best_habitat is the first maximum (ties resolve in habitat order). */
export function scoreAllHabitats(row: ScoreRow, habitats: Record<string, HabitatProfile>): { scores: Record<string, number>; best_habitat: string } {
  const scores: Record<string, number> = {};
  let best = "";
  let bestVal = -Infinity;
  for (const k of HABITAT_KEYS) {
    const s = scoreRow(row, habitats[k]).relevance_score;
    scores[`score_${k}`] = s;
    if (s > bestVal) {
      bestVal = s;
      best = k;
    }
  }
  return { scores, best_habitat: best };
}
