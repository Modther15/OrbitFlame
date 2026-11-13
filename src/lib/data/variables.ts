/** Controlled / varied / measured variables per PSI investigation (from investigation_variable_summary; see /api/variable-summary). */
export type VarRole = "controlled" | "varied" | "measured" | "identifier" | "diagnostic_imaging";

export type VarRow = {
  psi_id: string;
  source_table: string;
  source_file: string | null;
  source_sheet: string | null;
  column_name: string;
  header: string | null;
  unit: string | null;
  unit_status: string | null;
  role: VarRole;
  role_rule?: string | null;
  n_non_null: number | null;
  n_rows: number | null;
  pct_non_null: number | null;
  n_unique: number | null;
  min_value: number | null;
  max_value: number | null;
  controlled_value: string | null;
  categories_json: string | null;
  /** Why min / max differ from the raw column extremes (e.g. non-physical placeholder values excluded, sign convention applied). */
  range_note?: string | null;
  /** Investigation-level role / values: the same header combined across ALL tables of the investigation (case-insensitive for text). */
  role_investigation?: VarRole | null;
  inv_min_value?: number | null;
  inv_max_value?: number | null;
  inv_categories_json?: string | null;
  inv_n_unique?: number | null;
};

export type PsiVariables = Record<VarRole, VarRow[]>;
export type VarSummaryPayload = { by_psi: Record<string, PsiVariables> };

const EMPTY: PsiVariables = { controlled: [], varied: [], measured: [], identifier: [], diagnostic_imaging: [] };
export function varsFor(payload: VarSummaryPayload | null | undefined, psiId: string): PsiVariables {
  const v = payload?.by_psi?.[psiId];
  return v ? { ...EMPTY, ...v, diagnostic_imaging: v.diagnostic_imaging ?? [] } : EMPTY; // older snapshots have no diagnostic_imaging key
}

export function fmtNum(v: number): string {
  if (!Number.isFinite(v)) return "";
  const a = Math.abs(v);
  if (a !== 0 && (a >= 1e5 || a < 1e-3)) return v.toExponential(2);
  return Number(v.toPrecision(4)).toString();
}

export const XO2_CONVENTION_NOTE = "unit is the standard combustion-symbol convention (dimensionless mole fraction, mol/mol), user-confirmed; it is NOT stated in the PSI file";

export function unitLabel(r: VarRow): { text: string; proven: boolean; convention?: boolean } | null {
  if (r.unit_status?.startsWith("n/a")) return null; // non-numeric column
  if (r.unit_status === "proven" && r.unit) return { text: r.unit, proven: true };
  if (r.unit_status === "convention") return { text: r.unit ?? "mol/mol (dimensionless mole fraction)", proven: false, convention: true };
  if (r.unit_status?.startsWith("derived")) return { text: r.unit ? `${r.unit} (derived)` : "derived", proven: false };
  return { text: "unit not stated", proven: false };
}

export function categories(r: VarRow): string[] {
  if (!r.categories_json) return [];
  try {
    const v = JSON.parse(r.categories_json) as unknown;
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

/** Exact value / range / category text of a column as it appears in the table. */
export function valueText(r: VarRow): string {
  if (r.role === "controlled") {
    if (r.controlled_value !== null && r.controlled_value !== "") return r.controlled_value;
    if (r.min_value !== null && r.min_value === r.max_value) return fmtNum(r.min_value);
    return "single value";
  }
  const cats = categories(r);
  if (cats.length) return cats.length > 8 ? `${cats.slice(0, 8).join(", ")} … (+${cats.length - 8})` : cats.join(", ");
  if (r.min_value !== null && r.max_value !== null) return r.min_value === r.max_value ? fmtNum(r.min_value) : `${fmtNum(r.min_value)} – ${fmtNum(r.max_value)}`;
  return r.n_unique !== null ? `${r.n_unique} distinct values` : "—";
}

export function rowLabel(r: VarRow): string {
  return (r.header ?? r.column_name).trim();
}

/** Deduplicate same-header columns across the investigation's tables, keeping the one with most non-null coverage. */
export function dedupeByHeader(rows: VarRow[]): VarRow[] {
  const best = new Map<string, VarRow>();
  for (const r of rows) {
    const k = rowLabel(r).toLowerCase();
    const cur = best.get(k);
    if (!cur || (r.n_non_null ?? 0) > (cur.n_non_null ?? 0)) best.set(k, r);
  }
  return [...best.values()];
}

/** Compact one-line digest of an investigation for list cards. */
export type VarDigest = { controlled: string[]; varied: string[]; measured: string[]; diagnostics: string[]; nTables: number };
export function digestOf(v0: PsiVariables, max = 6): VarDigest {
  const v = combinedVars(v0);
  const names = (rows: VarRow[]) => dedupeByHeader(rows).map(rowLabel);
  const tables = new Set([...v.controlled, ...v.varied, ...v.measured].map((r) => r.source_table));
  const take = (a: string[]) => (a.length > max ? [...a.slice(0, max), `+${a.length - max} more`] : a);
  return { controlled: take(names(v.controlled)), varied: take(names(v.varied)), measured: take(names(v.measured)), diagnostics: (v.diagnostic_imaging?.length ? take(names(v.diagnostic_imaging)) : []), nTables: tables.size };
}

const hnorm = (r: VarRow) => rowLabel(r).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

/**
 * Investigation-level view of the setpoint variables: one entry per header across all tables of the investigation, with the role and
 * values computed over the COMBINED rows (a text value that is constant inside each table but differs between tables, e.g. Flame Type
 * Normal vs Inverse, is VARIED). Measured / identifier / diagnostic columns are passed through (deduplicated by header).
 */
export function combinedVars(v: PsiVariables): PsiVariables {
  const best = new Map<string, VarRow>();
  for (const r of [...v.controlled, ...v.varied]) {
    const k = hnorm(r);
    const cur = best.get(k);
    if (!cur || (r.n_non_null ?? 0) > (cur.n_non_null ?? 0)) best.set(k, r);
  }
  const controlled: VarRow[] = [];
  const varied: VarRow[] = [];
  for (const r of best.values()) {
    const role: VarRole = r.role_investigation ?? r.role;
    const merged: VarRow = {
      ...r,
      role,
      min_value: r.inv_min_value ?? r.min_value,
      max_value: r.inv_max_value ?? r.max_value,
      categories_json: r.inv_categories_json ?? r.categories_json,
      n_unique: r.inv_n_unique ?? r.n_unique,
    };
    (role === "varied" ? varied : controlled).push(merged);
  }
  return { ...v, controlled, varied, measured: dedupeByHeader(v.measured), diagnostic_imaging: dedupeByHeader(v.diagnostic_imaging ?? []) };
}
