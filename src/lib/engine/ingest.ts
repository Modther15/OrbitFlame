/**
 * Best-effort mapping of a user-supplied PSI export (CSV / TSV / ISA-Tab TXT) to the canonical row schema (isomorphic, no I/O).
 * Only units written in the header are converted; everything else stays null. Nothing is invented and nothing is stored.
 */
import { scoreAllHabitats, type HabitatProfile, type ScoreRow } from "./physics";

const PSI_KPA = 6.894757;
const MAX_ROWS = 1000;

/* ------------------------------- delimited text parsing ------------------------------- */
function detectDelimiter(text: string, forced?: string): string {
  if (forced) return forced;
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0).slice(0, 10);
  let bestDelim = ",";
  let bestScore = -1;
  for (const d of [",", ";", "\t", "|"]) {
    const counts = lines.map((l) => l.split(d).length - 1);
    if (!counts.length || counts[0] === 0) continue;
    const consistent = counts.filter((c) => c === counts[0]).length;
    const score = consistent * 1000 + counts[0];
    if (score > bestScore) {
      bestScore = score;
      bestDelim = d;
    }
  }
  return bestDelim;
}

export function parseDelimited(text: string, forcedDelimiter?: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const delim = detectDelimiter(src, forcedDelimiter);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
    } else if (ch === '"' && cell === "") quoted = true;
    else if (ch === delim) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell);
      cell = "";
      rows.push(row);
      row = [];
    } else cell += ch;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

/* ------------------------------- value parsing ------------------------------- */
const NUM = String.raw`[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?`;
const RANGE_RX = new RegExp(String.raw`^[~<>≈\s]*(${NUM})\s*(?:-|to)\s*(${NUM})(?!\d)`);
const LEAD_RX = new RegExp(String.raw`^[~<>≈\s]*(${NUM})`);

/** Number out of a cell: 'a - b' ranges -> midpoint; '~21.5', '.33 cm' -> number; anything else -> NaN. */
export function parseNum(v: string | null | undefined): number {
  if (v === null || v === undefined) return NaN;
  const s = String(v).trim().replace(/–/g, "-").replace(/—/g, "-");
  if (!s || ["nan", "none", "n/a", "na", "-", "--", "?"].includes(s.toLowerCase())) return NaN;
  const r = RANGE_RX.exec(s);
  if (r) return (parseFloat(r[1]) + parseFloat(r[2])) / 2;
  const m = LEAD_RX.exec(s);
  return m ? parseFloat(m[1]) : NaN;
}
function parseTxt(v: string | null | undefined): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).replace(/\s+/g, " ").trim();
  return ["", "nan", "none", "nat"].includes(s.toLowerCase()) ? null : s;
}
const normKey = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

const FUEL_NORM: Array<[RegExp, string]> = [
  [/pmma|plexiglas|acrylic|clear rod|1\/4"? clear|3\/8"? ?clear/i, "PMMA"],
  [/sibal|cotton.?fiberglass/i, "SIBAL cotton-fiberglass"], [/nomex/i, "Nomex"], [/kapton/i, "Kapton"],
  [/teflon|ptfe/i, "Teflon"], [/silicone/i, "Silicone"], [/cotton/i, "Cotton"],
  [/candle|wax/i, "Wax candle"], [/black rod/i, "Black PMMA rod"],
  [/propylene/i, "Propylene"], [/c2h4|ethylene/i, "Ethylene"], [/c3h8|propane/i, "Propane"],
  [/ethane/i, "Ethane"], [/butane/i, "n-Butane"], [/methane|ch4/i, "Methane"],
  [/methanol/i, "Methanol"], [/heptane/i, "n-Heptane"], [/iso.?dodecane/i, "n-Dodecane/iso-dodecane"],
  [/c12h26|dodecane/i, "n-Dodecane"], [/farnesane/i, "Farnesane"],
];
function normFuel(v: string | null): string | null {
  const s = parseTxt(v);
  if (s === null) return null;
  for (const [rx, name] of FUEL_NORM) {
    if (rx.test(s)) {
      const pct = /\d+\s*%/.exec(s);
      if (["Propylene", "Propane", "n-Butane", "Ethane"].includes(name) && pct) return pct[0].replace(/\s+/g, "") + " " + name;
      return name;
    }
  }
  return s;
}

/* ------------------------------- header / unit parsing ------------------------------- */
const BASE_UNITS = new Set(["mm", "cm", "m", "km", "um", "µm", "micron", "microns", "s", "sec", "secs", "second", "seconds", "ms", "min", "minute", "minutes",
  "hr", "hour", "hours", "mg", "g", "kg", "sccm", "slpm", "lpm", "atm", "bar", "kpa", "pa", "psi", "mmhg", "torr", "k", "c", "°c", "degc", "w", "kw", "j",
  "ppm", "%", "percent", "adc", "v", "mv", "a", "ma", "hz", "kv", "mj", "ev", "µs", "us"]);

function isUnitText(t: string): boolean {
  const s = t.trim().toLowerCase().replace(/mm hg/g, "mmhg").replace(/mole fraction/g, "molefraction").replace(/% by vol/g, "%").replace(/by volume/g, "").replace(/[()]/g, "");
  if (!s) return false;
  if (["molefraction", "mole fractions", "vol%", "mol%", "-"].includes(s)) return s !== "-";
  const parts = s.split(/[/*·\s]+/).filter(Boolean);
  if (!parts.length) return false;
  for (const p of parts) {
    if (p === "1") continue;
    const m = /^([a-zµ°%]+)(\^?)(\d+)?$/.exec(p);
    if (!m || !BASE_UNITS.has(m[1])) return false;
    if (m[3] && !(m[2] || ["mm", "cm", "m", "km"].includes(m[1]))) return false;
  }
  return true;
}

type SplitHeader = { name: string; unit: string | null; proven: boolean };
function splitHeader(raw: string): SplitHeader {
  const h = raw.replace(/ /g, " ").replace(/\s+/g, " ").trim();
  const out: SplitHeader = { name: h, unit: null, proven: false };
  if (h.includes(";")) {
    const i = h.lastIndexOf(";");
    const unit = h.slice(i + 1).trim();
    if (unit) return { name: h.slice(0, i).trim(), unit, proven: true };
  }
  const br = /[(\[]\s*([^()[\]]+?)\s*[)\]]\s*$/.exec(h);
  if (br && isUnitText(br[1])) return { name: h.slice(0, br.index).trim(), unit: br[1].trim(), proven: true };
  if (h.includes(",")) {
    const i = h.lastIndexOf(",");
    if (isUnitText(h.slice(i + 1))) return { name: h.slice(0, i).trim(), unit: h.slice(i + 1).trim(), proven: true };
  }
  for (const [rx, unit] of [[/%\s*by\s*vol(?:ume)?/i, "% by volume"], [/\bmole\s*fraction\b/i, "mole fraction"], [/\bpercent\b/i, "percent"], [/\bppm\b/i, "ppm"]] as Array<[RegExp, string]>) {
    if (rx.test(h)) return { name: h, unit, proven: true };
  }
  return out;
}
const unitKey = (u: string) => u.toLowerCase().replace(/\s+/g, "");

const PRESSURE_RULES: Record<string, number> = { atm: 101.325, bar: 100.0, mmhg: 0.133322368, torr: 0.133322368, psi: PSI_KPA, kpa: 1.0 };
const MOLE_PCT_RULES: Record<string, number> = {
  molefraction: 100.0, "mol/mol(dimensionlessmolefraction)": 100.0, "%byvolume": 1.0,
};

const ALIASES: Record<string, string[]> = {
  psi_id: ["psiid", "psi"],
  test_id: ["testid", "test", "testnumber", "testno", "run", "runid", "sample", "samplenumber", "samplename"],
  fuel: ["fuel", "material", "samplematerial", "fuelsamplematerial", "fuelsample"],
  o2_mole_pct: ["o2", "percento2", "o2pct", "o2molepct", "oxygen", "initialo2", "calibratedinitialo2pctbyvol", "o2percent", "o2molefraction", "oxygenmolefraction"],
  pressure: ["pressure", "pressurekpa", "pressurepsi", "pressureatm", "pressuremmhg", "ambientpressure", "ambientpressureatm", "ambientpressuremmhg", "approxpbar", "pmeanatm", "pinitatm", "totalpressure"],
  airflow_cm_s: ["airflowcms", "airflow", "inletvelocitycms", "flowvelocity", "flowvelocitycms", "airratecms", "velocity"],
  flow_direction: ["flowdirection", "direction"],
  burn_time_s: ["burntimes", "burntime", "burntimesec"],
  sample_thickness_mm: ["samplethicknessmm", "thickness"],
  droplet_diameter_mm: ["dropletinitialdiametermm", "dropletdiametermm"],
  flame_spread_rate_mm_s: ["flamespreadratemms", "spreadrate"],
};
const ALIAS_LOOKUP: Record<string, string> = Object.fromEntries(Object.entries(ALIASES).flatMap(([c, ks]) => ks.map((k) => [k, c] as const)));

export const DIRECT_SOURCE = "psi_direct_export";
export const DIRECT_LABEL = "psi_direct_export (user upload, not persisted)";

const NUM_COLS = [
  "pressure_psi", "pressure_kpa", "o2_mole_pct", "ppo2_psi", "co2_mole_pct", "he_mole_pct", "n2_mole_pct", "airflow_cm_s", "sample_thickness_mm",
  "sample_length_cm", "sample_width_cm", "droplet_diameter_mm", "droplet_burn_rate_k_mm2_s", "flame_spread_rate_mm_s", "burn_time_s", "ignited",
  "extinction_flag", "t_ad_k", "aging_time_s", "xi_fuel_mole_frac", "n_flames_ignited", "o2_pct_reported", "gravity_g", "effective_gravity_g",
  "efield_voltage_kv", "o2_pct", "flow_velocity_cm_s", "efield_kv_cm", "flame_temp_k", "loc_o2_pct", "source_row",
];
const TEXT_COLS = [
  "row_uid", "psi_id", "investigation", "pillar", "hardware", "flight_program", "source", "source_file", "source_sheet", "row_kind", "test_id",
  "sample_name", "fuel", "material_raw", "fuel_phase", "flame_type", "flow_direction", "sample_geometry", "diluent", "outcome_raw",
  "extra_metrics_json", "o2_basis", "gravity_source", "gravity_note", "effective_gravity_method", "effective_gravity_bin",
];

export type IngestError = { error: string };
export type IngestResult = {
  filename: string;
  n_rows: number;
  recognised_columns: string[];
  missing_canonical: string[];
  inferred_fields: string[];
  rows: Array<Record<string, unknown>>;
};

/** Parse delimited text into canonical rows (no scoring). Returns { error } when nothing recognisable is found. */
export function ingestDelimited(text: string, filename: string): Omit<IngestResult, "n_rows"> | IngestError {
  const isTxt = /\.(txt|tsv)$/i.test(filename);
  const table = parseDelimited(text, isTxt ? "\t" : undefined).filter((r) => r.some((c) => c.trim() !== ""));
  if (table.length < 2) return { error: `${filename}: no data rows` };
  const headers = table[0];
  const body = table.slice(1).slice(0, 20000);
  const fileBase = filename.replace(/^.*[\\/]/, "");
  const stem = fileBase.replace(/\.[^.]*$/, "");

  const colMap: Array<{ col: number; canon: string; factor: number }> = [];
  const seen = new Set<string>();
  const mapped: string[] = [];
  headers.forEach((hdr, col) => {
    const h = hdr ?? "";
    const sh = splitHeader(h);
    const canon = ALIAS_LOOKUP[normKey(h)] ?? ALIAS_LOOKUP[normKey(sh.name)] ?? ALIAS_LOOKUP[normKey(h.replace(/\(.*?\)|\[.*?\]/g, ""))];
    if (!canon || seen.has(canon)) return;
    const unit = sh.proven && sh.unit ? unitKey(sh.unit) : "";
    let factor = 1;
    if (canon === "pressure") {
      const f = PRESSURE_RULES[unit];
      if (f === undefined) return;
      factor = f;
    } else if (canon === "o2_mole_pct") {
      const f = MOLE_PCT_RULES[unit];
      if (f === undefined) return;
      factor = f;
    }
    seen.add(canon);
    colMap.push({ col, canon, factor });
    mapped.push(canon);
  });
  if (!colMap.length) return { error: `${filename}: no recognisable PSI columns with stated units` };

  const m = /psi[-_ ]?(\d+)/i.exec(fileBase);
  const defaultPsi = m ? `PSI-${m[1]}` : "PSI-UPLOAD";
  const rows = body.map((cells, i) => {
    const r: Record<string, unknown> = {};
    for (const c of NUM_COLS) r[c] = null;
    for (const c of TEXT_COLS) r[c] = null;
    r.gravity_inferred = null;
    r.pressure_kpa = null;
    for (const { col, canon, factor } of colMap) {
      const cell = cells[col];
      if (canon === "pressure") {
        const v = parseNum(cell) * factor;
        r.pressure_kpa = Number.isNaN(v) ? null : v;
      } else if (["psi_id", "test_id", "fuel", "flow_direction"].includes(canon)) r[canon] = parseTxt(cell);
      else {
        const v = parseNum(cell) * (canon === "o2_mole_pct" ? factor : 1);
        r[canon] = Number.isNaN(v) ? null : v;
      }
    }
    r.psi_id = r.psi_id ?? defaultPsi;
    r.test_id = r.test_id ?? `${stem}-R${String(i + 1).padStart(4, "0")}`;
    r.fuel = normFuel(r.fuel as string | null);
    r.source = DIRECT_SOURCE;
    r.source_file = fileBase;
    r.row_kind = "test_point";
    const kpa = r.pressure_kpa as number | null;
    const o2 = r.o2_mole_pct as number | null;
    r.pressure_psi = kpa === null ? null : kpa / PSI_KPA;
    r.ppo2_psi = r.pressure_psi === null || o2 === null ? null : ((r.pressure_psi as number) * o2) / 100;
    r.o2_pct = o2;
    r.flow_velocity_cm_s = r.airflow_cm_s;
    return r;
  });
  const found = [...new Set(mapped)].sort();
  const missing = [
    ["pressure_kpa", "pressure"], ["o2_mole_pct", "o2_mole_pct"], ["airflow_cm_s", "airflow_cm_s"], ["fuel", "fuel"],
  ].filter(([, canon]) => !found.includes(canon)).map(([c]) => c);
  return { filename: fileBase, recognised_columns: found, missing_canonical: missing, inferred_fields: [], rows };
}

/** Parse, then score every row (max 1000) against the five habitat profiles. */
export function ingestAndScore(text: string, filename: string, habitats: Record<string, HabitatProfile>): IngestResult | IngestError {
  const parsed = ingestDelimited(text, filename);
  if ("error" in parsed) return parsed;
  const rows = parsed.rows.slice(0, MAX_ROWS).map((r) => {
    const { scores, best_habitat } = scoreAllHabitats(r as ScoreRow, habitats);
    return { ...r, ...scores, best_habitat };
  });
  return { ...parsed, rows, n_rows: rows.length };
}
