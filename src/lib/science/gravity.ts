/** Actual gravity vs effective-gravity (HEURISTIC PROXY) labels, shared by run cards, the evidence drawer, explore and mission-lab. */

export const PROXY_CAVEAT =
  "HEURISTIC PROXY, not measured gravity: a 0 g flight row with a unit-proven forced-flow speed u (cm/s) is mapped to g_eff = min(1.5, (u/35)^2), the gravity whose natural-convection velocity scale (Lc = 5 cm, dT/Tinf ~ 5, assumed) equals u. Flow and buoyancy are not equivalent for flame spread.";
export const E_FIELD_PROXY_CAVEAT =
  "E-FIELD proxy (|E| / E_1g-equivalent) is NOT applied: PSI-22 has no per-test voltage/field and no stated E_1g-equivalent calibration.";

export type GravityParts = {
  actualG: number | null;
  source: string | null;
  effG: number | null;
  method: string | null;
};

type CondLike = { parameterKey?: string; k?: string; valueOriginal?: number | null; v?: number | null; textOriginal?: string | null; t?: string | null };

/** Extract gravity parts from either full conditions (parameterKey/valueOriginal) or run-stub conditions (k/v/t). */
export function gravityFromConds(conds: CondLike[]): GravityParts {
  const get = (key: string) => conds.find((c) => (c.parameterKey ?? c.k) === key);
  const val = (key: string) => {
    const c = get(key);
    const v = c ? (c.valueOriginal ?? c.v ?? null) : null;
    return typeof v === "number" && Number.isFinite(v) ? v : null;
  };
  const txt = (key: string) => {
    const c = get(key);
    return c ? (c.textOriginal ?? c.t ?? null) : null;
  };
  return { actualG: val("gravity_value"), source: txt("gravity_source"), effG: val("effective_gravity"), method: txt("effective_gravity_method") };
}

export function actualGravityText(g: number | null, source?: string | null): string {
  if (g === null) return "Actual gravity: not reported";
  if (g < 0.05) return "Actual gravity: 0.0 g (ISS/Cygnus flight)";
  if (Math.abs(g - 1) < 0.05) return "Actual gravity: 1.0 g (Ground test)";
  return `Actual gravity: ${g.toFixed(2)} g${source ? ` (${source})` : ""}`;
}

export function actualGravityTitle(g: number | null, source?: string | null): string {
  const base = g !== null && g < 0.05
    ? "Baseline stated by the project owner: every PSI investigation here is ISS (CIR/MSG) or Cygnus (Saffire) flight work, so actual gravity = 0.0 g (inferred, not tabulated in the PSI tables)."
    : g !== null && Math.abs(g - 1) < 0.05
      ? "Row carries a ground-test tag, so actual gravity = 1.0 g."
      : "Actual gravity of the test.";
  return source ? `${base} Source: ${source}.` : base;
}

function regimeOf(g: number): "zero" | "lunar" | "mars" | "earth" | "between" {
  if (g < 0.05) return "zero";
  if (g >= 0.16 / 1.5 && g <= 0.16 * 1.5) return "lunar";
  if (g >= 0.38 / 1.5 && g <= 0.38 * 1.5) return "mars";
  if (g >= 1 / 1.5 && g <= 1.5) return "earth";
  return "between";
}

export function isProxyMethod(method: string | null | undefined): boolean {
  return !!method && method !== "direct";
}

export function effectiveGravityText(g: number | null, method: string | null): string {
  if (g === null) return "Effective gravity: not reported";
  if (!isProxyMethod(method)) return `Effective gravity: ${g.toFixed(2)} g (direct, = actual)`;
  if (method === "e_field_ion_body_force") return `Effective gravity: ${g.toFixed(2)} g eq. (E-FIELD proxy)`;
  const r = regimeOf(g);
  const tag = r === "lunar" ? "Lunar buoyancy proxy" : r === "mars" ? "Mars buoyancy proxy" : r === "earth" ? "Earth buoyancy proxy" : r === "zero" ? "~0 g, negligible forced flow" : "buoyancy-equivalent proxy";
  return `Effective gravity: ${g.toFixed(2)} g eq. (${tag} via forced flow)`;
}

export function effectiveGravityTitle(method: string | null): string {
  if (!isProxyMethod(method)) return "Effective gravity equals actual gravity for this row (method: direct). No flow-equivalent proxy applied.";
  if (method === "e_field_ion_body_force") return `Method: e_field_ion_body_force. ${E_FIELD_PROXY_CAVEAT}`;
  return `Method: ${method}. ${PROXY_CAVEAT}`;
}
