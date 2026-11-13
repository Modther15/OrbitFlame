/**
 * Shared human-readable labels for PSI table keys returned by the FlameGuard API.
 * Never render a raw snake_case key in the UI; pass it through humanizeKey().
 */

const KEY_LABELS: Record<string, string> = {
  o_initial_ambient_composition__mole_fraction: "O₂ Mole Fraction",
  n_initial_ambient_composition__mole_fraction: "Nitrogen Fraction",
  co_initial_ambient_composition__mole_fraction: "CO₂ / Diluent Fraction",
  he_initial_ambient_composition__mole_fraction: "Helium Diluent Fraction",
  ambient_pressure__mmhg: "Ambient Pressure (mmHg)",
  droplet_initial_diameter__mm: "Initial Droplet Diameter (mm)",
  burning_rate__mm: "Droplet Burning Rate (mm²/s)",
  burn_time__s: "Burn Time (s)",
  burn_time__sec: "Burn Time (s)",
  burn_time_s: "Burn Time (s)",
  test_end: "Test Outcome",
  visible_flame_extinction_diameter__mm: "Flame Extinction Diameter (mm)",
  pressure__atm__num: "Pressure (atm)",
  data_pressure__atm: "Pressure (atm)",
  d0__mm: "Initial Droplet Diameter (mm)",
  khot__mm_2_s: "Hot-Flame Burning Rate K (mm²/s)",
  kcool__mm_2_s: "Cool-Flame Burning Rate K (mm²/s)",
  dext_hot__mm: "Hot-Flame Extinction Diameter (mm)",
  dext_cool__mm: "Cool-Flame Extinction Diameter (mm)",
  xo2: "O₂ Mole Fraction",
  xo2_before_test: "O₂ Mole Fraction",
  xf: "Fuel Mole Fraction",
  xf_before_test: "Fuel Mole Fraction",
  approx_p__bar: "Approx. Pressure (bar)",
  o2_flow_rate__mg_s: "O₂ Flow Rate (mg/s)",
  mhc__mg_s: "Hydrocarbon Flow (mg/s)",
  hot_ignition: "Hot Ignition",
  self_ext_or_flow_term: "Flame End State",
  nozzle__mm: "Nozzle Diameter (mm)",
  fuel_rate__sccm: "Fuel Rate (sccm)",
  fuel_rate__mg_s: "Fuel Rate (mg/s)",
  hc_fuel_rate__mg_s: "Hydrocarbon Fuel Rate (mg/s)",
  air_rate__cm_s: "Air Rate (cm/s)",
  inlet_velocity__cm_s: "Inlet Velocity (cm/s)",
  net_aging_time__sec: "Smoke Aging Time (s)",
  rt_r0: "Detector Response Ratio (Rt/R0)",
  weight_loss_rate__mg_min: "Weight-Loss Rate (mg/min)",
  air_flow__cm_s: "Air Flow (cm/s)",
  aging_duration__minutes: "Aging Duration (min)",
  oxygen: "Oxygen Fraction",
  nitrogen: "Nitrogen Fraction",
  helium: "Helium Fraction",
  fiber: "Support Fiber",
  color: "Flame Color",
  cool_flame: "Cool Flame",
};

const UNIT_LABELS: Record<string, string> = {
  mm: "mm",
  s: "s",
  sec: "s",
  mmhg: "mmHg",
  atm: "atm",
  bar: "bar",
  cm_s: "cm/s",
  mg_s: "mg/s",
  mg_min: "mg/min",
  mole_fraction: "mol frac",
  minutes: "min",
  sccm: "sccm",
};

function titleCase(s: string): string {
  return s
    .split(" ")
    .filter(Boolean)
    .map((w) => (/^[A-Z0-9]{2,}$/.test(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)))
    .join(" ");
}

/** Turn a snake_case / double-underscore API key into a readable label. */
export function humanizeKey(key: string): string {
  if (KEY_LABELS[key]) return KEY_LABELS[key];
  if (key.includes("=")) {
    const [k, v] = key.split("=");
    return `${humanizeKey(k)}: ${titleCase(v)}`;
  }
  const [base, ...unitParts] = key.split("__");
  const unitKey = unitParts.filter((u) => u !== "num").join("_");
  const name = titleCase(base.replace(/_/g, " "));
  const unit = unitKey ? (UNIT_LABELS[unitKey.toLowerCase()] ?? unitKey.replace(/_/g, " ")) : "";
  return unit ? `${name} (${unit})` : name;
}

/** Compact unit pill text for verbose unit tags like "[mol/mol (dimensionless mole fraction)]". */
export function compactUnit(raw: string): string {
  const s = raw.replace(/^\[|\]$/g, "").trim().toLowerCase();
  if (!s) return "";
  if (s.includes("mole fraction") || s.includes("mol/mol")) return "mol frac";
  if (s.includes("dimensionless")) return "–";
  return raw.replace(/^\[|\]$/g, "").trim();
}

/** Format a number for display (keeps NaN/null as an em dash; never invents a value). */
export function fmtNum(v: unknown, digits = 2): string {
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) v = Number(v);
  if (typeof v !== "number" || !Number.isFinite(v)) return "—";
  if (Math.abs(v) >= 1000) return v.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (Math.abs(v) >= 100) return v.toFixed(0);
  return v.toFixed(digits);
}

const HEADER_RULES: [RegExp, string][] = [
  [/^xo2\b/i, "O₂ Mole Fraction (XO₂)"],
  [/^xf\b/i, "Initial Fuel Fraction (Xf)"],
  [/^o initial ambient composition/i, "O₂ Mole Fraction"],
  [/^he initial ambient composition/i, "Helium Diluent Mole Fraction"],
  [/^n initial ambient composition/i, "Nitrogen Mole Fraction"],
  [/^co initial ambient composition/i, "CO₂ / Diluent Mole Fraction"],
  [/^approx\.? ?p\b/i, "Approx. Ambient Pressure"],
];

/** Readable label for a PSI table header (strips ";unit" / "(unit)" suffixes into a separate unit string). */
export function prettyHeader(header: string, unit?: string | null): { label: string; unit: string } {
  const raw = header.replace(/\s+/g, " ").trim();
  const m = raw.match(/^(.*?)\s*(?:;\s*([^;]+)|\(\s*([^()]+)\s*\))\s*$/);
  let base = m ? m[1].trim() : raw;
  let u = unit ?? (m ? (m[2] ?? m[3] ?? "") : "");
  if (!base) base = raw;
  let label = base;
  for (const [re, out] of HEADER_RULES) {
    if (re.test(base)) {
      label = out;
      break;
    }
  }
  if (label === base) label = base.charAt(0).toUpperCase() + base.slice(1);
  if (!u && /mole fraction/i.test(label)) u = "mol frac";
  return { label, unit: u.trim() };
}
