/**
 * Control -> audited-model-feature map for the Mission Lab real-data predictor (data/processed/model_audit_report.json).
 * Every control below feeds exactly one audited feature (or the nearest-test lookup dimension of that table). Controls whose unit the table
 * does not state are labelled "unit not stated" (XO2 / Xf: mol/mol convention) and are sent as raw_features in the table's own unit. Nothing is derived from habitat inputs.
 */
export type UnitStatus = "proven" | "unproven" | "derived" | "convention";
export type Body = Record<string, unknown>;
export type RawFeatures = Record<string, number>;

export type SelectControl = { kind: "select"; id: string; label: string; options: string[]; def: string; feature: string; apply: (v: string, body: Body, raw: RawFeatures) => void };
export type SliderControl = {
  kind: "slider"; id: string; label: string; unit: string; min: number; max: number; step: number; def: number; feature: string; unitStatus: UnitStatus;
  note?: string; extra?: (v: number) => string; apply: (v: number, body: Body, raw: RawFeatures) => void;
};
export type Control = SelectControl | SliderControl;

export type Family = {
  id: string; title: string; psi: string; candidatePrefix: string; candidateIncludes?: string; blurb: string; controls: Control[]; fuelPhase: string;
};

const MMHG_KPA = 0.133322368;
const ATM_KPA = 101.325;
const oneHot = (names: string[], chosen: string, raw: RawFeatures) => names.forEach((n) => { raw[n] = n === chosen ? 1 : 0; });

const NORMAL_FUELS = ["propane", "ethane", "30% propane", "30% ethane", "30% butane", "50% butane"];
const SPICE_FUELS = ["Methane", "Ethylene", "Propane", "Propylene", "50 % Propylene", "75 % Propylene", "75% Propylene"];

export const FAMILIES: Family[] = [
  {
    id: "flex", title: "FLEX Liquid Droplets", psi: "PSI-69", candidatePrefix: "flex_", fuelPhase: "Liquid",
    blurb: "Liquid-droplet combustion in the Combustion Integrated Rack (MDCA): heptane and methanol droplets burning in O₂ / N₂ / He / diluent atmospheres. No forced airflow in this experiment.",
    controls: [
      { kind: "select", id: "fuel", label: "Fuel", options: ["Heptane", "Methanol"], def: "Methanol", feature: "fuel=heptane | fuel=methanol", apply: (v, b) => { b.fuel = v; } },
      { kind: "slider", id: "p", label: "Ambient Pressure", unit: "mmHg", min: 526, max: 2320, step: 1, def: 760, feature: "Ambient pressure; mmHg", unitStatus: "proven", extra: (v) => `${(v * MMHG_KPA).toFixed(1)} kPa`, apply: (v, b) => { b.pressure_kpa = v * MMHG_KPA; } },
      { kind: "slider", id: "o2", label: "Oxygen Concentration", unit: "%", min: 12, max: 34, step: 1, def: 21, feature: "O initial ambient composition; mole fraction", unitStatus: "proven", apply: (v, b) => { b.o2_pct = v; } },
      { kind: "slider", id: "he", label: "Helium Diluent", unit: "%", min: 0, max: 45, step: 1, def: 0, feature: "He initial ambient composition; mole fraction", unitStatus: "proven", apply: (v, b) => { b.he_mole_pct = v; } },
      { kind: "slider", id: "n", label: "Nitrogen Fraction", unit: "", min: 0.09, max: 0.88, step: 0.01, def: 0.79, feature: "N initial ambient composition; mole fraction", unitStatus: "proven", note: "species named only 'N' in the table", apply: (v, b) => { b.n_initial_mole_frac = v; } },
      { kind: "slider", id: "co", label: "CO₂ Diluent", unit: "", min: 0, max: 0.7, step: 0.01, def: 0, feature: "CO initial ambient composition; mole fraction", unitStatus: "proven", note: "labeled 'CO' in the table", apply: (v, b) => { b.co_initial_mole_frac_as_labeled = v; } },
      { kind: "slider", id: "d0", label: "Initial Droplet Diameter", unit: "mm", min: 1.1, max: 4.67, step: 0.01, def: 3, feature: "Droplet initial diameter; mm", unitStatus: "proven", apply: (v, b) => { b.droplet_diameter_mm = v; } },
    ],
  },
  {
    id: "cfi", title: "CFI Cool Flames", psi: "PSI-39", candidatePrefix: "cfi_", fuelPhase: "Liquid",
    blurb: "Cool Flames Investigation: n-dodecane droplets in the Combustion Integrated Rack. Atmosphere fractions are used in the table's own scale.",
    controls: [
      { kind: "select", id: "fuel", label: "Fuel", options: ["C12H26", "[.60]/[.40] C12H26/iso-dodecane", "[.75]/[.25] C12H26/iso-dodecane"], def: "C12H26", feature: "Fuel", apply: (v, b) => { b.fuel = v; } },
      { kind: "select", id: "fiber", label: "Fiber", options: ["No", "Yes"], def: "No", feature: "Fiber", apply: (v, b) => { b.fiber = v; } },
      { kind: "slider", id: "p", label: "Ambient Pressure", unit: "atm", min: 0.5, max: 5, step: 0.25, def: 1, feature: "Pressure (atm)", unitStatus: "proven", extra: (v) => `${(v * ATM_KPA).toFixed(1)} kPa`, apply: (v, b) => { b.pressure_kpa = v * ATM_KPA; } },
      { kind: "slider", id: "d0", label: "Initial Droplet Diameter", unit: "mm", min: 3.793, max: 6.447, step: 0.01, def: 4.5, feature: "D0 ( mm )", unitStatus: "proven", apply: (v, b) => { b.droplet_diameter_mm = v; } },
      { kind: "slider", id: "oxygen", label: "Oxygen Fraction", unit: "", min: 0.17, max: 0.21, step: 0.01, def: 0.21, feature: "Oxygen", unitStatus: "unproven", apply: (v, _b, r) => { r.oxygen = v; } },
      { kind: "slider", id: "nitrogen", label: "Nitrogen Fraction", unit: "", min: 0.2, max: 0.83, step: 0.01, def: 0.79, feature: "Nitrogen", unitStatus: "unproven", apply: (v, _b, r) => { r.nitrogen = v; } },
      { kind: "slider", id: "helium", label: "Helium Fraction", unit: "", min: 0, max: 0.59, step: 0.01, def: 0, feature: "Helium", unitStatus: "unproven", apply: (v, _b, r) => { r.helium = v; } },
    ],
  },
  {
    id: "cfig-inv", title: "CFI-G Inverse Flames", psi: "PSI-159", candidatePrefix: "cfig_", candidateIncludes: "inverse", fuelPhase: "Gas",
    blurb: "ACME CFI-G inside-out (inverse) spherical gas flames of propane, butane and ethane, up to 85% O₂ (Moon / spacesuit proxy).",
    controls: [
      { kind: "select", id: "fuel", label: "Fuel", options: ["butane", "ethane", "propane"], def: "propane", feature: "Fuel", apply: (v, b) => { b.fuel = v; } },
      { kind: "slider", id: "p", label: "Ambient Pressure", unit: "bar", min: 0.5, max: 3.3, step: 0.1, def: 1, feature: "approx p (bar)", unitStatus: "proven", extra: (v) => `${(v * 100).toFixed(0)} kPa`, apply: (v, b) => { b.pressure_kpa = v * 100; } },
      { kind: "slider", id: "xo2", label: "Oxygen Mole Fraction (XO₂)", unit: "", min: 0.12, max: 0.85, step: 0.01, def: 0.4, feature: "XO2", unitStatus: "convention", apply: (v, _b, r) => { r.xo2 = v; } },
      { kind: "slider", id: "xf", label: "Initial Fuel Mole Fraction (Xf)", unit: "", min: 0.056, max: 0.43, step: 0.005, def: 0.2, feature: "Xf  before test", unitStatus: "convention", apply: (v, _b, r) => { r.xf_before_test = v; } },
      { kind: "slider", id: "flow", label: "Oxygen Flow Rate", unit: "mg/s", min: 0.93, max: 9.08, step: 0.01, def: 3, feature: "O2 flow rate (mg/s)", unitStatus: "proven", apply: (v, _b, r) => { r.o2_flow_rate__mg_s = v; } },
    ],
  },
  {
    id: "cfig-norm", title: "CFI-G Normal Flames", psi: "PSI-159", candidatePrefix: "cfig_", candidateIncludes: "normal", fuelPhase: "Gas",
    blurb: "ACME CFI-G normal spherical gas flames across six fuel blends.",
    controls: [
      { kind: "select", id: "fuel", label: "Fuel", options: NORMAL_FUELS, def: "propane", feature: "Fuel (one-hot)", apply: (v, b, r) => { b.fuel = v; oneHot(NORMAL_FUELS.map((f) => `fuel=${f}`), `fuel=${v}`, r); } },
      { kind: "slider", id: "p", label: "Ambient Pressure", unit: "bar", min: 0.5, max: 3.04, step: 0.1, def: 1, feature: "approx p (bar)", unitStatus: "proven", extra: (v) => `${(v * 100).toFixed(0)} kPa`, apply: (v, b) => { b.pressure_kpa = v * 100; } },
      { kind: "slider", id: "xo2", label: "Oxygen Mole Fraction (XO₂)", unit: "", min: 0.18, max: 0.4, step: 0.01, def: 0.3, feature: "XO2 before test", unitStatus: "convention", apply: (v, _b, r) => { r.xo2_before_test = v; } },
      { kind: "slider", id: "xf", label: "Fuel Mole Fraction (Xf)", unit: "", min: 0, max: 1, step: 0.05, def: 0.5, feature: "Xf", unitStatus: "convention", apply: (v, _b, r) => { r.xf = v; } },
      { kind: "slider", id: "mhc", label: "Hydrocarbon Flow Rate", unit: "mg/s", min: 0, max: 3.2, step: 0.05, def: 1, feature: "mHC (mg/s)", unitStatus: "proven", apply: (v, _b, r) => { r.mhc__mg_s = v; } },
    ],
  },
  {
    id: "spice", title: "SPICE Co-Flow", psi: "PSI-107", candidatePrefix: "spice_", fuelPhase: "Gas",
    blurb: "Microgravity Science Glovebox co-flow smoke-point flames. This table includes an air-rate column, so a ventilation control applies.",
    controls: [
      { kind: "select", id: "fuel", label: "Fuel", options: SPICE_FUELS, def: "Ethylene", feature: "Fuel (one-hot)", apply: (v, b, r) => { b.fuel = v; oneHot(SPICE_FUELS.map((f) => `fuel=${f.toLowerCase()}`), `fuel=${v.toLowerCase()}`, r); } },
      { kind: "slider", id: "nozzle", label: "Nozzle Diameter", unit: "mm", min: 0.4064, max: 1.6002, step: 0.01, def: 0.81, feature: "Nozzle (mm)", unitStatus: "proven", apply: (v, b) => { b.nozzle_diameter_mm = v; } },
      { kind: "slider", id: "sccm", label: "Fuel Flow", unit: "sccm", min: 0, max: 231.6, step: 0.5, def: 20, feature: "Fuel Rate (sccm)", unitStatus: "proven", apply: (v, _b, r) => { r.fuel_rate__sccm = v; } },
      { kind: "slider", id: "mgs", label: "Fuel Mass Flow", unit: "mg/s", min: 0, max: 4.397, step: 0.01, def: 0.5, feature: "Fuel Rate (mg/s)", unitStatus: "proven", apply: (v, _b, r) => { r.fuel_rate__mg_s = v; } },
      { kind: "slider", id: "hc", label: "Hydrocarbon Fuel Mass Flow", unit: "mg/s", min: 0, max: 4.397, step: 0.01, def: 0.5, feature: "HC Fuel Rate (mg/s)", unitStatus: "proven", apply: (v, _b, r) => { r.hc_fuel_rate__mg_s = v; } },
      { kind: "slider", id: "air", label: "Ventilation Airflow", unit: "cm/s", min: 0, max: 85.28, step: 0.5, def: 10, feature: "Air Rate (cm/s)", unitStatus: "proven", note: "table range is -5.92 to 85.28 cm/s; negatives omitted", apply: (v, b) => { b.flow_velocity_cm_s = v; } },
    ],
  },
];

export function defaultsOf(f: Family): Record<string, number | string> {
  return Object.fromEntries(f.controls.map((c) => [c.id, c.def]));
}

/** Request body for POST /api/predict/flammability built only from the family's controls (+ explicit 0 g analytical value). */
export function buildRequest(f: Family, vals: Record<string, number | string>): Body {
  const body: Body = { fuel_phase: f.fuelPhase, gravity_g: 0, k_nearest: 5 };
  const raw: RawFeatures = {};
  for (const c of f.controls) {
    const v = vals[c.id] ?? c.def;
    if (c.kind === "select") c.apply(String(v), body, raw);
    else c.apply(Number(v), body, raw);
  }
  body.raw_features = raw;
  return body;
}
