export type PhysicalDimension =
  | "pressure"
  | "velocity"
  | "length"
  | "temperature"
  | "percent"
  | "volume_percent"
  | "mass_percent"
  | "dimensionless";

export type NormalizedQuantity = {
  valueOriginal: number | null;
  unitOriginal: string | null;
  valueSi: number | null;
  unitSi: string | null;
  dimension: PhysicalDimension | null;
  unitKnown: boolean;
};

type UnitRule = {
  dimension: PhysicalDimension;
  unitSi: string;
  toSi: (v: number) => number;
};

// Explicit documented unit conversions only. Unlisted or ambiguous units are never assumed.
const UNIT_RULES: Record<string, UnitRule> = {
  Pa: { dimension: "pressure", unitSi: "Pa", toSi: (v) => v },
  kPa: { dimension: "pressure", unitSi: "Pa", toSi: (v) => v * 1000 },
  MPa: { dimension: "pressure", unitSi: "Pa", toSi: (v) => v * 1_000_000 },
  bar: { dimension: "pressure", unitSi: "Pa", toSi: (v) => v * 100_000 },
  mbar: { dimension: "pressure", unitSi: "Pa", toSi: (v) => v * 100 },
  atm: { dimension: "pressure", unitSi: "Pa", toSi: (v) => v * 101325 },
  psi: { dimension: "pressure", unitSi: "Pa", toSi: (v) => v * 6894.757 },
  torr: { dimension: "pressure", unitSi: "Pa", toSi: (v) => v * 133.322368 },

  "m/s": { dimension: "velocity", unitSi: "m/s", toSi: (v) => v },
  "cm/s": { dimension: "velocity", unitSi: "m/s", toSi: (v) => v * 0.01 },
  "mm/s": { dimension: "velocity", unitSi: "m/s", toSi: (v) => v * 0.001 },

  m: { dimension: "length", unitSi: "m", toSi: (v) => v },
  cm: { dimension: "length", unitSi: "m", toSi: (v) => v * 0.01 },
  mm: { dimension: "length", unitSi: "m", toSi: (v) => v * 0.001 },
  um: { dimension: "length", unitSi: "m", toSi: (v) => v * 1e-6 },
  "µm": { dimension: "length", unitSi: "m", toSi: (v) => v * 1e-6 },

  K: { dimension: "temperature", unitSi: "K", toSi: (v) => v },
  "°C": { dimension: "temperature", unitSi: "K", toSi: (v) => v + 273.15 },
};

const NON_SI_KNOWN_DIMENSIONS: Record<string, PhysicalDimension> = {
  "%": "percent",
  "% vol": "volume_percent",
  "vol%": "volume_percent",
  "% wt": "mass_percent",
  "wt%": "mass_percent",
};

function roundPrecision(n: number): number {
  return Math.round(n * 1e9) / 1e9;
}

/**
 * Normalizes a numeric measurement/condition only when its source unit is explicitly known.
 * Never infers or assumes units for null or unrecognized unit strings.
 */
export function normalizeToKnownSi(value: number | null, unit: string | null): NormalizedQuantity {
  if (value === null || !Number.isFinite(value)) {
    return {
      valueOriginal: null,
      unitOriginal: unit,
      valueSi: null,
      unitSi: null,
      dimension: unit && unit.trim() in UNIT_RULES ? UNIT_RULES[unit.trim()].dimension : unit && unit.trim() in NON_SI_KNOWN_DIMENSIONS ? NON_SI_KNOWN_DIMENSIONS[unit.trim()] : null,
      unitKnown: Boolean(unit && (unit.trim() in UNIT_RULES || unit.trim() in NON_SI_KNOWN_DIMENSIONS)),
    };
  }

  if (!unit || !unit.trim()) {
    return {
      valueOriginal: value,
      unitOriginal: null,
      valueSi: null,
      unitSi: null,
      dimension: null,
      unitKnown: false,
    };
  }

  const trimmed = unit.trim();
  const rule = UNIT_RULES[trimmed];
  if (rule) {
    return {
      valueOriginal: value,
      unitOriginal: trimmed,
      valueSi: roundPrecision(rule.toSi(value)),
      unitSi: rule.unitSi,
      dimension: rule.dimension,
      unitKnown: true,
    };
  }

  const knownDim = NON_SI_KNOWN_DIMENSIONS[trimmed];
  if (knownDim) {
    // Non-SI percentage labels stay un-converted so vol% vs wt% vs generic % are never conflated.
    return {
      valueOriginal: value,
      unitOriginal: trimmed,
      valueSi: null,
      unitSi: null,
      dimension: knownDim,
      unitKnown: true,
    };
  }

  return {
    valueOriginal: value,
    unitOriginal: trimmed,
    valueSi: null,
    unitSi: null,
    dimension: null,
    unitKnown: false,
  };
}

export type UnitCompatibilityResult =
  | { compatible: true; comparableValueA: number; comparableValueB: number; sharedUnit: string }
  | { compatible: false; reason: string };

/**
 * Checks whether two numeric quantities can be safely compared.
 * Rejects missing units, unknown units, and incompatible physical dimensions (e.g., kPa vs % or % vol vs % wt).
 */
export function checkNumericUnitCompatibility(
  a: { value: number; unit: string | null },
  b: { value: number; unit: string | null },
): UnitCompatibilityResult {
  if (!a.unit || !b.unit) {
    return { compatible: false, reason: "Missing explicit source unit on one or more records" };
  }

  const normA = normalizeToKnownSi(a.value, a.unit);
  const normB = normalizeToKnownSi(b.value, b.unit);

  if (!normA.unitKnown || !normB.unitKnown) {
    if (a.unit.trim() === b.unit.trim()) {
      return {
        compatible: true,
        comparableValueA: a.value,
        comparableValueB: b.value,
        sharedUnit: a.unit.trim(),
      };
    }
    return {
      compatible: false,
      reason: `Unverified or incompatible unit strings (${a.unit} vs ${b.unit})`,
    };
  }

  if (normA.dimension !== normB.dimension) {
    return {
      compatible: false,
      reason: `Incompatible physical units/meanings (${normA.unitOriginal} [${normA.dimension}] vs ${normB.unitOriginal} [${normB.dimension}])`,
    };
  }

  if (normA.valueSi !== null && normB.valueSi !== null && normA.unitSi && normA.unitSi === normB.unitSi) {
    return {
      compatible: true,
      comparableValueA: normA.valueSi,
      comparableValueB: normB.valueSi,
      sharedUnit: normA.unitSi,
    };
  }

  if (normA.unitOriginal === normB.unitOriginal && normA.unitOriginal !== null) {
    return {
      compatible: true,
      comparableValueA: a.value,
      comparableValueB: b.value,
      sharedUnit: normA.unitOriginal,
    };
  }

  return {
    compatible: false,
    reason: `Units cannot be safely normalized (${a.unit} vs ${b.unit})`,
  };
}
