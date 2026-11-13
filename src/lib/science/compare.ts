import type { Condition, DemoInvestigation, Measurement, ProvenanceStatus } from "@/lib/api/schemas";
import { checkNumericUnitCompatibility, normalizeToKnownSi } from "@/lib/science/units";

export type ComparisonStatus =
  | "EXACT_MATCH"
  | "DIFFERENT"
  | "PARTIALLY_COMPARABLE"
  | "UNKNOWN_NOT_REPORTED";

export type CellMissingState = "PRESENT" | "NOT_REPORTED" | "PARTIAL";

export type CompareCell = {
  recordId: string;
  displayValue: string;
  unit: string | null;
  siDisplay: string | null;
  missingStatus: CellMissingState;
  provenanceLabel: string;
  isDemoFixture: boolean;
  isVerified: boolean;
  rawNumericValue: number | null;
};

export type CompareRow = {
  key:
    | "objectives"
    | "material"
    | "gravity"
    | "oxygen"
    | "pressure"
    | "airflow"
    | "hardware"
    | "sensors"
    | "variables"
    | "testRuns"
    | "provenance";
  label: string;
  status: ComparisonStatus;
  note: string;
  cells: CompareCell[];
};

export type ComparisonSummary = {
  shared: string[];
  differences: string[];
  cannotCompare: string[];
  missingEvidence: string[];
  provenanceNotes: string[];
};

function isRecordVerified(record: DemoInvestigation): boolean {
  return record.provenanceStatus === "NASA_VERIFIED_DATA" && record.source?.verificationStatus === "VERIFIED";
}

function getRecordProvenanceLabel(status: ProvenanceStatus, verified: boolean): string {
  if (status === "DEMO_FIXTURE") return "DEMO FIXTURE — NOT NASA MEASUREMENTS";
  if (verified) return "NASA VERIFIED DATA";
  if (status === "NASA_VERIFIED_DATA") return "NASA RECORD — SOURCE UNVERIFIED";
  if (status === "NOT_REPORTED") return "NOT REPORTED";
  return status.replaceAll("_", " ");
}

function classifyGravityRegime(raw: string): "MICROGRAVITY" | "PARTIAL_GRAVITY" | "NORMAL_GRAVITY" | "OTHER" {
  const lower = raw.toLocaleLowerCase();
  if (lower.includes("microgravity") || lower.includes("micro-gravity") || lower.includes("0 g")) return "MICROGRAVITY";
  if (lower.includes("partial") || lower.includes("lunar") || lower.includes("mars") || lower.includes("1/6") || lower.includes("0.38")) {
    return "PARTIAL_GRAVITY";
  }
  if (lower.includes("normal gravity") || lower.includes("1 g") || lower.includes("earth")) return "NORMAL_GRAVITY";
  return "OTHER";
}

function extractNumericCondition(
  record: DemoInvestigation,
  parameterKey: "oxygen_concentration" | "pressure" | "airflow",
): { value: number | null; unit: string | null; siDisplay: string | null; missing: boolean } {
  const runCondition: Condition | undefined = record.testRuns
    .flatMap((run) => run.conditions)
    .find((cond) => cond.parameterKey === parameterKey);

  if (runCondition) {
    if (runCondition.missingStatus !== "PRESENT" || runCondition.valueOriginal === null) {
      return { value: null, unit: null, siDisplay: null, missing: true };
    }
    const unit = runCondition.unitOriginal ?? null;
    const norm = normalizeToKnownSi(runCondition.valueOriginal, unit);
    const siDisplay =
      norm.valueSi !== null &&
      norm.unitSi !== null &&
      (norm.valueSi !== runCondition.valueOriginal || norm.unitSi !== unit)
        ? `${norm.valueSi} ${norm.unitSi}`
        : null;
    return {
      value: runCondition.valueOriginal,
      unit,
      siDisplay,
      missing: false,
    };
  }

  // Fallback strictly from explicit DemoInvestigation top-level condition fields
  if (parameterKey === "oxygen_concentration") {
    const val = record.conditions.oxygenPercent;
    return val === null
      ? { value: null, unit: null, siDisplay: null, missing: true }
      : { value: val, unit: "%", siDisplay: null, missing: false };
  }
  if (parameterKey === "pressure") {
    const val = record.conditions.pressureKpa;
    if (val === null) return { value: null, unit: null, siDisplay: null, missing: true };
    const norm = normalizeToKnownSi(val, "kPa");
    return {
      value: val,
      unit: "kPa",
      siDisplay: norm.valueSi !== null && norm.unitSi ? `${norm.valueSi} ${norm.unitSi}` : null,
      missing: false,
    };
  }
  const val = record.conditions.airflowMps;
  return val === null
    ? { value: null, unit: null, siDisplay: null, missing: true }
    : { value: val, unit: "m/s", siDisplay: null, missing: false };
}

function buildNumericConditionRow(
  key: "oxygen" | "pressure" | "airflow",
  label: string,
  parameterKey: "oxygen_concentration" | "pressure" | "airflow",
  records: DemoInvestigation[],
): CompareRow {
  const extracted = records.map((rec) => {
    const verified = isRecordVerified(rec);
    const data = extractNumericCondition(rec, parameterKey);
    const cell: CompareCell = {
      recordId: rec.id,
      displayValue: data.missing || data.value === null ? "NOT REPORTED" : String(data.value),
      unit: data.unit,
      siDisplay: data.siDisplay,
      missingStatus: data.missing ? "NOT_REPORTED" : "PRESENT",
      provenanceLabel: getRecordProvenanceLabel(rec.provenanceStatus, verified),
      isDemoFixture: rec.provenanceStatus === "DEMO_FIXTURE",
      isVerified: verified,
      rawNumericValue: data.value,
    };
    return { data, cell };
  });

  const cells = extracted.map((e) => e.cell);
  const presentItems = extracted.filter((e) => !e.data.missing && e.data.value !== null);
  const missingItems = extracted.filter((e) => e.data.missing || e.data.value === null);

  if (presentItems.length === 0) {
    return {
      key,
      label,
      status: "UNKNOWN_NOT_REPORTED",
      note: "Not reported across the selected investigations. Missing values are never treated as equal or zero.",
      cells,
    };
  }

  if (missingItems.length > 0) {
    return {
      key,
      label,
      status: "PARTIALLY_COMPARABLE",
      note: `Reported in ${presentItems.length} of ${records.length} investigations; missing in ${missingItems.map((m) => m.cell.recordId).join(", ")}.`,
      cells,
    };
  }

  // All selected records have values — verify explicit unit compatibility before comparing numerically.
  const first = presentItems[0].data;
  const comparableNumbers: number[] = [];
  let sharedUnit = first.unit ?? "";

  for (let i = 0; i < presentItems.length; i++) {
    const current = presentItems[i].data;
    const compat = checkNumericUnitCompatibility(
      { value: first.value as number, unit: first.unit },
      { value: current.value as number, unit: current.unit },
    );
    if (!compat.compatible) {
      return {
        key,
        label,
        status: "PARTIALLY_COMPARABLE",
        note: `Cannot numerically compare: ${compat.reason}. Original values remain unmerged.`,
        cells,
      };
    }
    if (i === 0) comparableNumbers.push(compat.comparableValueA);
    comparableNumbers.push(compat.comparableValueB);
    sharedUnit = compat.sharedUnit;
  }

  const allEqual = comparableNumbers.every((val) => Math.abs(val - comparableNumbers[0]) < 1e-6);
  if (allEqual) {
    return {
      key,
      label,
      status: "EXACT_MATCH",
      note: `All selected records report ${presentItems[0].data.value}${presentItems[0].data.unit ? ` ${presentItems[0].data.unit}` : ""}.`,
      cells,
    };
  }

  const minVal = Math.min(...comparableNumbers);
  const maxVal = Math.max(...comparableNumbers);
  return {
    key,
    label,
    status: "DIFFERENT",
    note: `Values span ${minVal} to ${maxVal}${sharedUnit ? ` ${sharedUnit}` : ""} across selected investigations.`,
    cells,
  };
}

function buildTextRow(
  key: "objectives" | "material",
  label: string,
  extractor: (r: DemoInvestigation) => string | null,
  records: DemoInvestigation[],
): CompareRow {
  const cells: CompareCell[] = records.map((rec) => {
    const verified = isRecordVerified(rec);
    const val = extractor(rec)?.trim() || null;
    return {
      recordId: rec.id,
      displayValue: val ?? "NOT REPORTED",
      unit: null,
      siDisplay: null,
      missingStatus: val ? "PRESENT" : "NOT_REPORTED",
      provenanceLabel: getRecordProvenanceLabel(rec.provenanceStatus, verified),
      isDemoFixture: rec.provenanceStatus === "DEMO_FIXTURE",
      isVerified: verified,
      rawNumericValue: null,
    };
  });

  const present = cells.filter((c) => c.missingStatus === "PRESENT");
  if (present.length === 0) {
    return {
      key,
      label,
      status: "UNKNOWN_NOT_REPORTED",
      note: `Not reported in any selected investigation.`,
      cells,
    };
  }
  if (present.length < records.length) {
    return {
      key,
      label,
      status: "PARTIALLY_COMPARABLE",
      note: `Reported in ${present.length} of ${records.length} investigations.`,
      cells,
    };
  }

  const uniqueNormalized = new Set(present.map((c) => c.displayValue.toLocaleLowerCase()));
  if (uniqueNormalized.size === 1) {
    const allDemo = records.every((r) => r.provenanceStatus === "DEMO_FIXTURE");
    return {
      key,
      label,
      status: "EXACT_MATCH",
      note: allDemo
        ? "Identical descriptive wording in selected demo fixtures (does not establish physical equivalence)."
        : "Exact match across selected investigations.",
      cells,
    };
  }

  return {
    key,
    label,
    status: "DIFFERENT",
    note: `${uniqueNormalized.size} distinct values across selected investigations.`,
    cells,
  };
}

function buildGravityRow(records: DemoInvestigation[]): CompareRow {
  const cells: CompareCell[] = records.map((rec) => {
    const verified = isRecordVerified(rec);
    const raw = rec.conditions.gravity.trim() || rec.gravityEnvironments.join(", ").trim();
    const isPresent = Boolean(raw);
    return {
      recordId: rec.id,
      displayValue: isPresent ? raw : "NOT REPORTED",
      unit: null,
      siDisplay: null,
      missingStatus: isPresent ? "PRESENT" : "NOT_REPORTED",
      provenanceLabel: getRecordProvenanceLabel(rec.provenanceStatus, verified),
      isDemoFixture: rec.provenanceStatus === "DEMO_FIXTURE",
      isVerified: verified,
      rawNumericValue: null,
    };
  });

  const present = cells.filter((c) => c.missingStatus === "PRESENT");
  if (present.length === 0) {
    return {
      key: "gravity",
      label: "Gravity environment",
      status: "UNKNOWN_NOT_REPORTED",
      note: "Gravity environment not reported across selected investigations.",
      cells,
    };
  }
  if (present.length < records.length) {
    return {
      key: "gravity",
      label: "Gravity environment",
      status: "PARTIALLY_COMPARABLE",
      note: `Reported in ${present.length} of ${records.length} investigations.`,
      cells,
    };
  }

  const regimes = new Set(present.map((c) => classifyGravityRegime(c.displayValue)));
  if (regimes.size > 1) {
    const hasMicro = regimes.has("MICROGRAVITY");
    const hasPartial = regimes.has("PARTIAL_GRAVITY");
    return {
      key: "gravity",
      label: "Gravity environment",
      status: "DIFFERENT",
      note:
        hasMicro && hasPartial
          ? "Microgravity and Partial Gravity are distinct regimes and are never treated as equivalent."
          : "Selected investigations span different gravity regimes.",
      cells,
    };
  }

  const exactStrings = new Set(present.map((c) => c.displayValue.toLocaleLowerCase()));
  if (exactStrings.size === 1) {
    return {
      key: "gravity",
      label: "Gravity environment",
      status: "EXACT_MATCH",
      note: `All selected records share gravity classification: ${present[0].displayValue}.`,
      cells,
    };
  }

  return {
    key: "gravity",
    label: "Gravity environment",
    status: "PARTIALLY_COMPARABLE",
    note: "Same broad gravity class, with differing environment qualifiers.",
    cells,
  };
}

function buildMeasurementsDerivedRow(
  key: "hardware" | "sensors" | "variables",
  label: string,
  records: DemoInvestigation[],
): CompareRow {
  const cells: CompareCell[] = records.map((rec) => {
    const verified = isRecordVerified(rec);
    const measurements: Measurement[] = rec.testRuns.flatMap((run) => run.measurements);

    let extractedValues: string[] = [];
    if (key === "sensors") {
      extractedValues = [...new Set(measurements.filter((m) => m.missingStatus === "PRESENT").map((m) => m.measurementStatus))];
    } else if (key === "variables") {
      extractedValues = [
        ...new Set(
          measurements
            .filter((m) => m.missingStatus === "PRESENT")
            .map((m) => (m.unitOriginal ? `${m.label} (${m.unitOriginal})` : m.label)),
        ),
      ];
    } else {
      // Experimental hardware is only extracted when explicitly present in source metadata (never inferred from family acronym).
      extractedValues = [];
    }

    const isPresent = extractedValues.length > 0;
    return {
      recordId: rec.id,
      displayValue: isPresent ? extractedValues.join(", ") : "NOT REPORTED",
      unit: null,
      siDisplay: null,
      missingStatus: isPresent ? "PRESENT" : "NOT_REPORTED",
      provenanceLabel: getRecordProvenanceLabel(rec.provenanceStatus, verified),
      isDemoFixture: rec.provenanceStatus === "DEMO_FIXTURE",
      isVerified: verified,
      rawNumericValue: null,
    };
  });

  const present = cells.filter((c) => c.missingStatus === "PRESENT");
  if (present.length === 0) {
    return {
      key,
      label,
      status: "UNKNOWN_NOT_REPORTED",
      note: `${label} not reported in any selected record. Unreported metadata is never treated as a match.`,
      cells,
    };
  }
  if (present.length < records.length) {
    return {
      key,
      label,
      status: "PARTIALLY_COMPARABLE",
      note: `${label} documented in ${present.length} of ${records.length} investigations.`,
      cells,
    };
  }

  const distinctSets = new Set(present.map((c) => c.displayValue.toLocaleLowerCase()));
  if (distinctSets.size === 1) {
    return {
      key,
      label,
      status: "EXACT_MATCH",
      note: `Identical ${label.toLocaleLowerCase()} across selected investigations.`,
      cells,
    };
  }

  return {
    key,
    label,
    status: "PARTIALLY_COMPARABLE",
    note: `${label} sets differ across selected investigations.`,
    cells,
  };
}

function buildTestRunsRow(records: DemoInvestigation[]): CompareRow {
  const signatures: string[] = [];
  const cells: CompareCell[] = records.map((rec) => {
    const verified = isRecordVerified(rec);
    const runs = rec.testRuns;
    const totalConditions = runs.flatMap((r) => r.conditions).length;
    const presentConditions = runs.flatMap((r) => r.conditions).filter((c) => c.missingStatus === "PRESENT").length;
    const totalMeasurements = runs.flatMap((r) => r.measurements).length;

    const sig = `${runs.length}:${presentConditions}/${totalConditions}:${totalMeasurements}`;
    signatures.push(sig);

    return {
      recordId: rec.id,
      displayValue:
        runs.length === 0
          ? "0 runs indexed"
          : `${runs.length} run (${presentConditions}/${totalConditions} conditions, ${totalMeasurements} measurements)`,
      unit: null,
      siDisplay: null,
      missingStatus: runs.length === 0 ? "NOT_REPORTED" : presentConditions < totalConditions ? "PARTIAL" : "PRESENT",
      provenanceLabel: getRecordProvenanceLabel(rec.provenanceStatus, verified),
      isDemoFixture: rec.provenanceStatus === "DEMO_FIXTURE",
      isVerified: verified,
      rawNumericValue: runs.length,
    };
  });

  if (records.every((r) => r.testRuns.length === 0)) {
    return {
      key: "testRuns",
      label: "Test run availability",
      status: "UNKNOWN_NOT_REPORTED",
      note: "No test runs indexed for selected investigations.",
      cells,
    };
  }

  const uniqueSigs = new Set(signatures);
  return {
    key: "testRuns",
    label: "Test run availability",
    status: uniqueSigs.size === 1 ? "EXACT_MATCH" : "DIFFERENT",
    note:
      uniqueSigs.size === 1
        ? "Selected investigations have matching run count and condition coverage."
        : "Run condition coverage or recorded telemetry count differs across selected investigations.",
    cells,
  };
}

function buildProvenanceRow(records: DemoInvestigation[]): CompareRow {
  const signatures: string[] = [];
  const cells: CompareCell[] = records.map((rec) => {
    const verified = isRecordVerified(rec);
    const provLabel = getRecordProvenanceLabel(rec.provenanceStatus, verified);
    const sourceText = rec.source ? rec.source.sourceTitle : "No source locator attached";
    signatures.push(`${rec.provenanceStatus}:${verified}:${rec.dataCompleteness}`);

    return {
      recordId: rec.id,
      displayValue: `${provLabel} · Completeness ${rec.dataCompleteness}% · ${sourceText}`,
      unit: null,
      siDisplay: null,
      missingStatus: "PRESENT",
      provenanceLabel: provLabel,
      isDemoFixture: rec.provenanceStatus === "DEMO_FIXTURE",
      isVerified: verified,
      rawNumericValue: rec.dataCompleteness,
    };
  });

  const uniqueSigs = new Set(signatures);
  const allDemo = records.every((r) => r.provenanceStatus === "DEMO_FIXTURE");
  const someVerified = records.some((r) => isRecordVerified(r));

  let note = "Provenance status and metadata completeness are tracked separately per record.";
  if (allDemo && uniqueSigs.size === 1) {
    note = "All selected records are DEMO FIXTURES (fictional data, not NASA measurements) with matching completeness.";
  } else if (allDemo) {
    note = "All selected records are DEMO FIXTURES (fictional data, not NASA measurements), with differing metadata completeness.";
  } else if (someVerified && records.some((r) => r.provenanceStatus === "DEMO_FIXTURE")) {
    note = "Mixed provenance: verified NASA evidence and unverified/demo fixtures must not be treated equally.";
  }

  return {
    key: "provenance",
    label: "Evidence provenance & completeness",
    status: uniqueSigs.size === 1 ? "EXACT_MATCH" : "DIFFERENT",
    note,
    cells,
  };
}

export function buildComparisonMatrix(records: DemoInvestigation[]): CompareRow[] {
  if (records.length === 0) return [];
  return [
    buildTextRow("objectives", "Research objectives", (r) => r.objective, records),
    buildTextRow("material", "Combustion material / sample", (r) => r.fuelMaterial, records),
    buildGravityRow(records),
    buildNumericConditionRow("oxygen", "Oxygen concentration", "oxygen_concentration", records),
    buildNumericConditionRow("pressure", "Pressure", "pressure", records),
    buildNumericConditionRow("airflow", "Airflow", "airflow", records),
    buildMeasurementsDerivedRow("hardware", "Experimental hardware", records),
    buildMeasurementsDerivedRow("sensors", "Sensors", records),
    buildMeasurementsDerivedRow("variables", "Measured variables", records),
    buildTestRunsRow(records),
    buildProvenanceRow(records),
  ];
}

export function buildComparisonSummary(records: DemoInvestigation[], rows: CompareRow[]): ComparisonSummary {
  const shared: string[] = [];
  const differences: string[] = [];
  const cannotCompare: string[] = [];
  const missingEvidence: string[] = [];
  const provenanceNotes: string[] = [];

  for (const row of rows) {
    if (row.status === "EXACT_MATCH") {
      shared.push(`${row.label}: ${row.note}`);
    } else if (row.status === "DIFFERENT") {
      const breakdown = row.cells
        .map((c) => `${c.recordId}=${c.unit ? `${c.displayValue} ${c.unit}` : c.displayValue}`)
        .join("; ");
      differences.push(`${row.label}: ${row.note} (${breakdown}).`);
    } else if (row.status === "PARTIALLY_COMPARABLE") {
      cannotCompare.push(`${row.label}: ${row.note}`);
      const missingIds = row.cells.filter((c) => c.missingStatus !== "PRESENT").map((c) => c.recordId);
      if (missingIds.length > 0) {
        missingEvidence.push(`${row.label} missing/partial in ${missingIds.join(", ")}.`);
      }
    } else if (row.status === "UNKNOWN_NOT_REPORTED") {
      cannotCompare.push(`${row.label}: Cannot compare because no selected investigation reports this field.`);
      missingEvidence.push(`${row.label} is NOT REPORTED across all ${records.length} selected investigations.`);
    }
  }

  const demoRecords = records.filter((r) => r.provenanceStatus === "DEMO_FIXTURE");
  if (demoRecords.length > 0) {
    provenanceNotes.push(
      `${demoRecords.length} of ${records.length} compared records (${demoRecords.map((d) => d.id).join(", ")}) are illustrative DEMO FIXTURES — fictional data, not NASA measurements.`,
    );
  }
  provenanceNotes.push(
    "Similarity across parameters does not imply scientific causation, flammability equivalence, or spacecraft safety certification.",
  );

  return { shared, differences, cannotCompare, missingEvidence, provenanceNotes };
}

export function buildCompareJsonExport(records: DemoInvestigation[], rows: CompareRow[], summary: ComparisonSummary): string {
  const payload = {
    exportedAt: new Date().toISOString(),
    scope: records.every((r) => r.provenanceStatus === "DEMO_FIXTURE") ? "DEMO_FIXTURE_ONLY" : "MIXED_PROVENANCE",
    comparedInvestigations: records.map((rec) => {
      const verified = isRecordVerified(rec);
      return {
        id: rec.id,
        name: rec.name,
        family: rec.family,
        provenanceStatus: rec.provenanceStatus,
        provenanceLabel: getRecordProvenanceLabel(rec.provenanceStatus, verified),
        isVerifiedEvidence: verified,
        dataCompletenessPercent: rec.dataCompleteness,
        sourceDocument: rec.source ?? null,
      };
    }),
    comparisonMatrix: rows.map((row) => ({
      dimensionKey: row.key,
      dimension: row.label,
      status: row.status,
      comparabilityNote: row.note,
      valuesByRecord: row.cells.map((cell) => ({
        recordId: cell.recordId,
        displayValue: cell.displayValue,
        unit: cell.unit,
        siEquivalent: cell.siDisplay,
        missingStatus: cell.missingStatus,
        provenanceLabel: cell.provenanceLabel,
        isVerifiedEvidence: cell.isVerified,
      })),
    })),
    deterministicSummary: summary,
  };
  return JSON.stringify(payload, null, 2);
}

function csvEscape(value: string): string {
  const safe = value.replaceAll('"', '""');
  return /[",\n\r]/.test(safe) ? `"${safe}"` : safe;
}

export function buildCompareCsvExport(records: DemoInvestigation[], rows: CompareRow[]): string {
  const headers = [
    "Dimension",
    "Comparison Status",
    "Comparability Note",
    ...records.flatMap((rec) => [
      `${rec.id} Value`,
      `${rec.id} Unit`,
      `${rec.id} SI Equivalent`,
      `${rec.id} Missing Status`,
      `${rec.id} Provenance`,
    ]),
  ];

  const lines = [headers.map(csvEscape).join(",")];
  for (const row of rows) {
    const cols = [
      row.label,
      row.status,
      row.note,
      ...row.cells.flatMap((cell) => [
        cell.displayValue,
        cell.unit ?? "",
        cell.siDisplay ?? "",
        cell.missingStatus,
        cell.provenanceLabel,
      ]),
    ];
    lines.push(cols.map(csvEscape).join(","));
  }
  return lines.join("\r\n");
}

export type ConditionChartPoint = {
  recordId: string;
  plottedValue: number | null;
  originalDisplay: string;
  unit: string | null;
  siDisplay: string | null;
  missing: boolean;
  isDemoFixture: boolean;
  isVerified: boolean;
  provenanceLabel: string;
};

export type ConditionChartSeries = {
  key: "oxygen" | "pressure" | "airflow";
  label: string;
  plottedUnit: string | null;
  compatible: boolean;
  incompatibilityReason: string | null;
  allMissing: boolean;
  presentCount: number;
  missingCount: number;
  points: ConditionChartPoint[];
};

export function prepareConditionChartSeries(row: CompareRow): ConditionChartSeries {
  const key = row.key as "oxygen" | "pressure" | "airflow";
  const presentCells = row.cells.filter((c) => c.missingStatus === "PRESENT" && c.rawNumericValue !== null);
  const missingCount = row.cells.length - presentCells.length;

  if (presentCells.length === 0) {
    return {
      key,
      label: row.label,
      plottedUnit: null,
      compatible: true,
      incompatibilityReason: null,
      allMissing: true,
      presentCount: 0,
      missingCount,
      points: row.cells.map((c) => ({
        recordId: c.recordId,
        plottedValue: null,
        originalDisplay: c.displayValue,
        unit: c.unit,
        siDisplay: c.siDisplay,
        missing: true,
        isDemoFixture: c.isDemoFixture,
        isVerified: c.isVerified,
        provenanceLabel: c.provenanceLabel,
      })),
    };
  }

  if (presentCells.length === 1) {
    const single = presentCells[0];
    const hasExplicitUnit = Boolean(single.unit && single.unit.trim());
    return {
      key,
      label: row.label,
      plottedUnit: hasExplicitUnit ? single.unit : null,
      compatible: hasExplicitUnit,
      incompatibilityReason: hasExplicitUnit ? null : "Missing explicit source unit; cannot plot without unit definition.",
      allMissing: false,
      presentCount: 1,
      missingCount,
      points: row.cells.map((c) => {
        const isPresent = c.missingStatus === "PRESENT" && c.rawNumericValue !== null;
        return {
          recordId: c.recordId,
          plottedValue: isPresent && hasExplicitUnit ? c.rawNumericValue : null,
          originalDisplay: c.displayValue,
          unit: c.unit,
          siDisplay: c.siDisplay,
          missing: !isPresent,
          isDemoFixture: c.isDemoFixture,
          isVerified: c.isVerified,
          provenanceLabel: c.provenanceLabel,
        };
      }),
    };
  }

  const first = presentCells[0];
  let incompatibilityReason: string | null = null;
  let sharedUnit: string | null = first.unit;
  const allSameOriginalUnit = presentCells.every((c) => c.unit && first.unit && c.unit.trim() === first.unit.trim());

  const normalizedByRecordId = new Map<string, number>();

  for (let i = 0; i < presentCells.length; i++) {
    const current = presentCells[i];
    const compat = checkNumericUnitCompatibility(
      { value: first.rawNumericValue as number, unit: first.unit },
      { value: current.rawNumericValue as number, unit: current.unit },
    );
    if (!compat.compatible) {
      incompatibilityReason = compat.reason;
      break;
    }
    if (allSameOriginalUnit) {
      normalizedByRecordId.set(current.recordId, current.rawNumericValue as number);
    } else {
      sharedUnit = compat.sharedUnit;
      normalizedByRecordId.set(current.recordId, i === 0 ? compat.comparableValueA : compat.comparableValueB);
    }
  }

  if (incompatibilityReason) {
    return {
      key,
      label: row.label,
      plottedUnit: null,
      compatible: false,
      incompatibilityReason,
      allMissing: false,
      presentCount: presentCells.length,
      missingCount,
      points: row.cells.map((c) => ({
        recordId: c.recordId,
        plottedValue: null,
        originalDisplay: c.displayValue,
        unit: c.unit,
        siDisplay: c.siDisplay,
        missing: c.missingStatus !== "PRESENT",
        isDemoFixture: c.isDemoFixture,
        isVerified: c.isVerified,
        provenanceLabel: c.provenanceLabel,
      })),
    };
  }

  return {
    key,
    label: row.label,
    plottedUnit: sharedUnit,
    compatible: true,
    incompatibilityReason: null,
    allMissing: false,
    presentCount: presentCells.length,
    missingCount,
    points: row.cells.map((c) => {
      const isPresent = c.missingStatus === "PRESENT" && c.rawNumericValue !== null;
      return {
        recordId: c.recordId,
        plottedValue: isPresent ? (normalizedByRecordId.get(c.recordId) ?? null) : null,
        originalDisplay: c.displayValue,
        unit: c.unit,
        siDisplay: c.siDisplay,
        missing: !isPresent,
        isDemoFixture: c.isDemoFixture,
        isVerified: c.isVerified,
        provenanceLabel: c.provenanceLabel,
      };
    }),
  };
}

export type EvidenceCoverageItem = {
  key: string;
  label: string;
  availableCount: number;
  totalCount: number;
  availabilityPercent: number;
  detail: string;
};

export function buildEvidenceCoverageMetrics(records: DemoInvestigation[], rows: CompareRow[]): EvidenceCoverageItem[] {
  const n = records.length;
  if (n === 0) return [];

  const rowByKey = new Map(rows.map((r) => [r.key, r]));

  // 1. Experimental conditions across Oxygen, Pressure, Airflow, Gravity
  const conditionKeys: CompareRow["key"][] = ["oxygen", "pressure", "airflow", "gravity"];
  const conditionCells = conditionKeys.flatMap((k) => rowByKey.get(k)?.cells ?? []);
  const presentConditionCells = conditionCells.filter((c) => c.missingStatus === "PRESENT").length;
  const totalConditionSlots = n * conditionKeys.length;

  // 2. Recorded measurements per investigation
  const recordsWithMeasurements = records.filter((rec) =>
    rec.testRuns.some((run) => run.measurements.some((m) => m.missingStatus === "PRESENT")),
  ).length;

  // 3. Sensors, Hardware, Research objectives directly from matrixRows
  const sensorPresent = rowByKey.get("sensors")?.cells.filter((c) => c.missingStatus === "PRESENT").length ?? 0;
  const hardwarePresent = rowByKey.get("hardware")?.cells.filter((c) => c.missingStatus === "PRESENT").length ?? 0;
  const objectivesPresent = rowByKey.get("objectives")?.cells.filter((c) => c.missingStatus === "PRESENT").length ?? 0;

  // 4. Source provenance (verified NASA source locator attached)
  const verifiedSourceCount = records.filter((rec) => isRecordVerified(rec)).length;

  const pct = (a: number, b: number) => (b === 0 ? 0 : Math.round((a / b) * 100));

  return [
    {
      key: "conditions",
      label: "Experimental conditions",
      availableCount: presentConditionCells,
      totalCount: totalConditionSlots,
      availabilityPercent: pct(presentConditionCells, totalConditionSlots),
      detail: `${presentConditionCells} of ${totalConditionSlots} condition slots documented`,
    },
    {
      key: "measurements",
      label: "Recorded measurements",
      availableCount: recordsWithMeasurements,
      totalCount: n,
      availabilityPercent: pct(recordsWithMeasurements, n),
      detail: `${recordsWithMeasurements} of ${n} records include recorded measurements`,
    },
    {
      key: "sensors",
      label: "Sensors",
      availableCount: sensorPresent,
      totalCount: n,
      availabilityPercent: pct(sensorPresent, n),
      detail: `${sensorPresent} of ${n} records document sensor channels`,
    },
    {
      key: "hardware",
      label: "Hardware",
      availableCount: hardwarePresent,
      totalCount: n,
      availabilityPercent: pct(hardwarePresent, n),
      detail: `${hardwarePresent} of ${n} records document test hardware`,
    },
    {
      key: "objectives",
      label: "Research objectives",
      availableCount: objectivesPresent,
      totalCount: n,
      availabilityPercent: pct(objectivesPresent, n),
      detail: `${objectivesPresent} of ${n} records document research objectives`,
    },
    {
      key: "provenance",
      label: "Source provenance",
      availableCount: verifiedSourceCount,
      totalCount: n,
      availabilityPercent: pct(verifiedSourceCount, n),
      detail: `${verifiedSourceCount} of ${n} records have verified NASA source locators`,
    },
  ];
}

export type MeasurementTrendsInspection = {
  available: boolean;
  totalMeasurements: number;
  timestampedSeriesCount: number;
  reason: string;
};

export function inspectMeasurementTrends(records: DemoInvestigation[]): MeasurementTrendsInspection {
  const allMeasurements = records.flatMap((rec) => rec.testRuns.flatMap((run) => run.measurements));
  const totalMeasurements = allMeasurements.length;

  // Check if any measurement carries explicit numeric timestamp metadata with a known physical unit.
  const timestamped = allMeasurements.filter((m) => {
    const withTime = m as Measurement & { timestampSec?: unknown };
    return (
      typeof withTime.timestampSec === "number" &&
      Number.isFinite(withTime.timestampSec) &&
      m.missingStatus === "PRESENT" &&
      m.valueOriginal !== null &&
      Boolean(m.unitOriginal && normalizeToKnownSi(m.valueOriginal, m.unitOriginal).unitKnown)
    );
  });

  if (timestamped.length === 0) {
    return {
      available: false,
      totalMeasurements,
      timestampedSeriesCount: 0,
      reason:
        totalMeasurements === 0
          ? "No recorded measurements exist across the selected investigations. OrbitFlame never generates synthetic curves or sample trend points."
          : "Available measurements lack verified time-series timestamps and explicit compatible units required for a trend plot.",
    };
  }

  return {
    available: true,
    totalMeasurements,
    timestampedSeriesCount: timestamped.length,
    reason: `${timestamped.length} timestamped measurements available.`,
  };
}

export type DocumentationRadarRecordDetail = {
  recordId: string;
  recordName: string;
  slotKey: string;
  numerator: number;
  denominator: number;
  percentage: number;
  missingFields: string[];
  isDemoFixture: boolean;
  isVerified: boolean;
  provenanceLabel: string;
};

export type DocumentationRadarDimension = {
  key: "conditions" | "measurements" | "sensors" | "hardware" | "objectives" | "provenance";
  label: string;
  shortLabel: string;
  records: DocumentationRadarRecordDetail[];
  slotScores: Record<string, number>;
};

export function buildDocumentationRadarMetrics(
  records: DemoInvestigation[],
  rows: CompareRow[],
): DocumentationRadarDimension[] {
  if (records.length === 0) return [];

  const rowByKey = new Map(rows.map((r) => [r.key, r]));
  const pct = (num: number, den: number) => (den === 0 ? 0 : Math.round((num / den) * 100));

  const conditionSpecs: ReadonlyArray<{ rowKey: "oxygen" | "pressure" | "airflow" | "gravity"; label: string }> = [
    { rowKey: "oxygen", label: "Oxygen concentration" },
    { rowKey: "pressure", label: "Pressure" },
    { rowKey: "airflow", label: "Airflow" },
    { rowKey: "gravity", label: "Gravity environment" },
  ];

  const makeCellLookup = (rowKey: CompareRow["key"]) =>
    new Map((rowByKey.get(rowKey)?.cells ?? []).map((cell) => [cell.recordId, cell]));

  const oxygenCells = makeCellLookup("oxygen");
  const pressureCells = makeCellLookup("pressure");
  const airflowCells = makeCellLookup("airflow");
  const gravityCells = makeCellLookup("gravity");
  const conditionCellLookups: Record<string, Map<string, CompareCell>> = {
    oxygen: oxygenCells,
    pressure: pressureCells,
    airflow: airflowCells,
    gravity: gravityCells,
  };

  const sensorsCells = makeCellLookup("sensors");
  const hardwareCells = makeCellLookup("hardware");
  const objectivesCells = makeCellLookup("objectives");

  const dimensions: Array<{
    key: DocumentationRadarDimension["key"];
    label: string;
    shortLabel: string;
    evaluate: (rec: DemoInvestigation) => { numerator: number; denominator: number; missingFields: string[] };
  }> = [
    {
      key: "conditions",
      label: "Experimental Conditions",
      shortLabel: "Conditions",
      evaluate: (rec) => {
        const missingFields: string[] = [];
        let numerator = 0;
        for (const spec of conditionSpecs) {
          const cell = conditionCellLookups[spec.rowKey]?.get(rec.id);
          if (cell?.missingStatus === "PRESENT") {
            numerator += 1;
          } else {
            missingFields.push(spec.label);
          }
        }
        return { numerator, denominator: conditionSpecs.length, missingFields };
      },
    },
    {
      key: "measurements",
      label: "Recorded Measurements",
      shortLabel: "Measurements",
      evaluate: (rec) => {
        const allMeasurements = rec.testRuns.flatMap((run) => run.measurements);
        if (allMeasurements.length === 0) {
          return {
            numerator: 0,
            denominator: 1,
            missingFields: ["Recorded measurement rows (0 indexed)"],
          };
        }
        const present = allMeasurements.filter((m) => m.missingStatus === "PRESENT");
        const missingFields = allMeasurements
          .filter((m) => m.missingStatus !== "PRESENT")
          .map((m) => `${m.label} (${m.missingStatus})`);
        return {
          numerator: present.length,
          denominator: allMeasurements.length,
          missingFields,
        };
      },
    },
    {
      key: "sensors",
      label: "Sensors",
      shortLabel: "Sensors",
      evaluate: (rec) => {
        const present = sensorsCells.get(rec.id)?.missingStatus === "PRESENT";
        return {
          numerator: present ? 1 : 0,
          denominator: 1,
          missingFields: present ? [] : ["Sensors / instrumentation channel"],
        };
      },
    },
    {
      key: "hardware",
      label: "Hardware",
      shortLabel: "Hardware",
      evaluate: (rec) => {
        const present = hardwareCells.get(rec.id)?.missingStatus === "PRESENT";
        return {
          numerator: present ? 1 : 0,
          denominator: 1,
          missingFields: present ? [] : ["Experimental hardware metadata"],
        };
      },
    },
    {
      key: "objectives",
      label: "Research Objectives",
      shortLabel: "Objectives",
      evaluate: (rec) => {
        const present = objectivesCells.get(rec.id)?.missingStatus === "PRESENT";
        return {
          numerator: present ? 1 : 0,
          denominator: 1,
          missingFields: present ? [] : ["Research objectives"],
        };
      },
    },
    {
      key: "provenance",
      label: "Source Provenance",
      shortLabel: "Provenance",
      evaluate: (rec) => {
        const verified = isRecordVerified(rec);
        const missingFields: string[] = [];
        if (!verified) {
          if (rec.provenanceStatus === "DEMO_FIXTURE") {
            missingFields.push("Verified NASA source locator (demo fixture only)");
          } else if (!rec.source) {
            missingFields.push("SourceLocator attachment");
          } else {
            missingFields.push("Verified source locator status");
          }
        }
        return {
          numerator: verified ? 1 : 0,
          denominator: 1,
          missingFields,
        };
      },
    },
  ];

  return dimensions.map((dim) => {
    const slotScores: Record<string, number> = {};
    const recordDetails: DocumentationRadarRecordDetail[] = records.map((rec, idx) => {
      const verified = isRecordVerified(rec);
      const slotKey = `s${idx}`;
      const evaluated = dim.evaluate(rec);
      const percentage = pct(evaluated.numerator, evaluated.denominator);
      slotScores[slotKey] = percentage;
      return {
        recordId: rec.id,
        recordName: rec.name,
        slotKey,
        numerator: evaluated.numerator,
        denominator: evaluated.denominator,
        percentage,
        missingFields: evaluated.missingFields,
        isDemoFixture: rec.provenanceStatus === "DEMO_FIXTURE",
        isVerified: verified,
        provenanceLabel: getRecordProvenanceLabel(rec.provenanceStatus, verified),
      };
    });

    return {
      key: dim.key,
      label: dim.label,
      shortLabel: dim.shortLabel,
      records: recordDetails,
      slotScores,
    };
  });
}


