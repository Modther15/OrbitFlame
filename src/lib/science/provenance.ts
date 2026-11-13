import type { Condition, DemoInvestigation, ProvenanceStatus, SourceLocator, TestRun } from "@/lib/api/schemas";
import { DEMO_WARNING } from "@/lib/demo/dataset";
import { normalizeToKnownSi } from "@/lib/science/units";

export type GravityRegimeClass =
  | "MICROGRAVITY"
  | "LUNAR_GRAVITY"
  | "MARS_GRAVITY"
  | "PARTIAL_GRAVITY"
  | "NORMAL_GRAVITY"
  | "OTHER";

export type DatasetScopeSummary = {
  scope: "EMPTY" | "DEMO_FIXTURE_ONLY" | "VERIFIED_INDEXED_DATA" | "MIXED";
  totalRecords: number;
  totalTestRuns: number;
  verifiedRecordCount: number;
  demoRecordCount: number;
  unverifiedNonDemoCount: number;
  sourceDocumentCount: number;
  verifiedSpanCount: number;
  activeDatasetBanner: string;
  scopeDisclosure: string;
};

/**
 * Returns true ONLY when the record is tagged NASA_VERIFIED_DATA AND carries an explicitly
 * verified primary SourceLocator. DEMO_MODE being disabled alone never constitutes verification.
 */
export function isSourceLocatorVerified(source: SourceLocator | null | undefined): boolean {
  return Boolean(source && source.verificationStatus === "VERIFIED");
}

export function isRecordVerified(
  record: Pick<DemoInvestigation, "provenanceStatus" | "source">,
): boolean {
  return record.provenanceStatus === "NASA_VERIFIED_DATA" && isSourceLocatorVerified(record.source);
}

export function formatProvenanceTag(
  provenanceStatus: ProvenanceStatus,
  source: SourceLocator | null | undefined,
): string {
  if (provenanceStatus === "NASA_VERIFIED_DATA" && isSourceLocatorVerified(source)) {
    return "VERIFIED NASA PSI EXPERIMENTAL DATA";
  }
  if (provenanceStatus === "NASA_VERIFIED_DATA") {
    return "NASA RECORD — SOURCE UNVERIFIED";
  }
  if (provenanceStatus === "DEMO_FIXTURE") {
    return DEMO_WARNING;
  }
  if (provenanceStatus === "NOT_REPORTED") {
    return "NOT REPORTED";
  }
  return provenanceStatus.replaceAll("_", " ");
}

/**
 * Distinguishes Microgravity, Lunar (~1/6 g), Mars (~0.38 g), unspecified Partial, and Normal gravity.
 * Never collapses Lunar, Mars, or unspecified Partial gravity into Microgravity.
 */
export function classifyGravityRegime(raw: string | null | undefined): GravityRegimeClass {
  if (!raw) return "OTHER";
  const lower = raw.trim().toLocaleLowerCase();
  if (!lower || lower === "unknown" || lower === "not reported") return "OTHER";
  if (lower.includes("microgravity") || lower.includes("micro-gravity") || /\b0\s*g\b/.test(lower)) {
    return "MICROGRAVITY";
  }
  if (lower.includes("lunar") || lower.includes("moon") || lower.includes("1/6")) {
    return "LUNAR_GRAVITY";
  }
  if (lower.includes("mars") || lower.includes("martian") || lower.includes("0.38")) {
    return "MARS_GRAVITY";
  }
  if (lower.includes("partial")) {
    return "PARTIAL_GRAVITY";
  }
  if (lower.includes("normal") || /\b1\s*g\b/.test(lower) || lower.includes("earth")) {
    return "NORMAL_GRAVITY";
  }
  return "OTHER";
}

export function gravityRegimeLabel(regime: GravityRegimeClass): string {
  switch (regime) {
    case "MICROGRAVITY":
      return "Microgravity";
    case "LUNAR_GRAVITY":
      return "Lunar gravity (~1/6 g)";
    case "MARS_GRAVITY":
      return "Mars gravity (~0.38 g)";
    case "PARTIAL_GRAVITY":
      return "Partial gravity (unspecified)";
    case "NORMAL_GRAVITY":
      return "Normal gravity (~1 g)";
    default:
      return "Other / Unclassified";
  }
}

export type ExtractedNumericCondition = {
  valueOriginal: number | null;
  unitOriginal: string | null;
  valueSi: number | null;
  unitSi: string | null;
  displayOriginal: string;
  missing: boolean;
  missingStatus: string;
  runId: string | null;
};

/**
 * Extracts a physical experimental condition from test runs (or explicit fallback fixture fields)
 * while preserving explicit source units and missing statuses. Never assumes units or treats null as zero.
 */
export function extractRecordNumericCondition(
  record: { conditions: DemoInvestigation["conditions"]; testRuns?: TestRun[]; leadRuns?: TestRun[] },
  parameterKey: "oxygen_concentration" | "pressure" | "airflow",
): ExtractedNumericCondition {
  const runs = record.leadRuns ?? record.testRuns ?? [];
  for (const run of runs) {
    const cond: Condition | undefined = run.conditions.find((c) => c.parameterKey === parameterKey);
    if (!cond) continue;
    if (cond.missingStatus !== "PRESENT" || cond.valueOriginal === null) {
      return {
        valueOriginal: null,
        unitOriginal: cond.unitOriginal,
        valueSi: null,
        unitSi: null,
        displayOriginal: cond.missingStatus === "NOT_REPORTED" ? "NOT REPORTED" : cond.missingStatus,
        missing: true,
        missingStatus: cond.missingStatus,
        runId: run.id,
      };
    }
    const norm = normalizeToKnownSi(cond.valueOriginal, cond.unitOriginal);
    const displayOriginal = cond.unitOriginal ? `${cond.valueOriginal} ${cond.unitOriginal}` : `${cond.valueOriginal} (UNIT NOT REPORTED)`;
    return {
      valueOriginal: cond.valueOriginal,
      unitOriginal: cond.unitOriginal,
      valueSi: norm.valueSi,
      unitSi: norm.unitSi,
      displayOriginal,
      missing: false,
      missingStatus: cond.missingStatus,
      runId: run.id,
    };
  }

  // Fallback to explicit DemoInvestigation top-level condition fields when run conditions omit the key.
  if (parameterKey === "oxygen_concentration") {
    const v = record.conditions.oxygenPercent;
    if (v === null) {
      return {
        valueOriginal: null,
        unitOriginal: null,
        valueSi: null,
        unitSi: null,
        displayOriginal: "NOT REPORTED",
        missing: true,
        missingStatus: "NOT_REPORTED",
        runId: runs[0]?.id ?? null,
      };
    }
    return {
      valueOriginal: v,
      unitOriginal: "%",
      valueSi: null,
      unitSi: null,
      displayOriginal: `${v} %`,
      missing: false,
      missingStatus: "PRESENT",
      runId: runs[0]?.id ?? null,
    };
  }

  if (parameterKey === "pressure") {
    const v = record.conditions.pressureKpa;
    if (v === null) {
      return {
        valueOriginal: null,
        unitOriginal: null,
        valueSi: null,
        unitSi: null,
        displayOriginal: "NOT REPORTED",
        missing: true,
        missingStatus: "NOT_REPORTED",
        runId: runs[0]?.id ?? null,
      };
    }
    const norm = normalizeToKnownSi(v, "kPa");
    return {
      valueOriginal: v,
      unitOriginal: "kPa",
      valueSi: norm.valueSi,
      unitSi: norm.unitSi,
      displayOriginal: `${v} kPa`,
      missing: false,
      missingStatus: "PRESENT",
      runId: runs[0]?.id ?? null,
    };
  }

  const v = record.conditions.airflowMps;
  if (v === null) {
    return {
      valueOriginal: null,
      unitOriginal: null,
      valueSi: null,
      unitSi: null,
      displayOriginal: "NOT REPORTED",
      missing: true,
      missingStatus: "NOT_REPORTED",
      runId: runs[0]?.id ?? null,
    };
  }
  const norm = normalizeToKnownSi(v, "m/s");
  return {
    valueOriginal: v,
    unitOriginal: "m/s",
    valueSi: norm.valueSi,
    unitSi: norm.unitSi,
    displayOriginal: `${v} m/s`,
    missing: false,
    missingStatus: "PRESENT",
    runId: runs[0]?.id ?? null,
  };
}

/** Full record or slim list summary (precomputed run-level counts). */
export type ScopeRecord = Omit<DemoInvestigation, "testRuns"> & {
  testRuns?: TestRun[];
  testRunCount?: number;
  presentMeasurementCount?: number;
  leadRuns?: TestRun[];
  runSourceDocIds?: string[];
  runVerifiedSpanCount?: number;
};

/** Count of PRESENT measurements for a full record or a slim summary. */
export function presentMeasurementTotal(rec: ScopeRecord): number {
  if (rec.presentMeasurementCount !== undefined) return rec.presentMeasurementCount;
  return (rec.testRuns ?? []).reduce((sum, run) => sum + run.measurements.filter((m) => m.missingStatus === "PRESENT").length, 0);
}

export function deriveDatasetScope(records: ScopeRecord[]): DatasetScopeSummary {
  if (records.length === 0) {
    return {
      scope: "EMPTY",
      totalRecords: 0,
      totalTestRuns: 0,
      verifiedRecordCount: 0,
      demoRecordCount: 0,
      unverifiedNonDemoCount: 0,
      sourceDocumentCount: 0,
      verifiedSpanCount: 0,
      activeDatasetBanner: "ACTIVE DATASET: NO INDEXED RECORDS CONNECTED",
      scopeDisclosure:
        "Indexed repository contains 0 records. Absence in this index does not imply absence of research in external NASA archives.",
    };
  }

  const totalTestRuns = records.reduce((acc, rec) => acc + (rec.testRunCount ?? rec.testRuns?.length ?? 0), 0);
  const verifiedRecordCount = records.filter((rec) => isRecordVerified(rec)).length;
  const demoRecordCount = records.filter((rec) => rec.provenanceStatus === "DEMO_FIXTURE").length;
  const unverifiedNonDemoCount = records.length - verifiedRecordCount - demoRecordCount;

  const docIds = new Set<string>();
  let verifiedSpanCount = 0;

  for (const rec of records) {
    // investigation-record JSON is metadata, not a data file: only files that contribute test rows are counted as source files
    if (rec.source && !/_investigation\.json$/i.test(rec.source.sourceDocumentId)) {
      docIds.add(rec.source.sourceDocumentId);
      if (isSourceLocatorVerified(rec.source)) verifiedSpanCount += 1;
    }
    if (rec.runSourceDocIds) {
      rec.runSourceDocIds.forEach((d) => docIds.add(d));
      verifiedSpanCount += rec.runVerifiedSpanCount ?? 0;
    }
    for (const run of rec.testRuns ?? []) {
      for (const cond of run.conditions) {
        if (cond.source) {
          docIds.add(cond.source.sourceDocumentId);
          if (isSourceLocatorVerified(cond.source)) verifiedSpanCount += 1;
        }
      }
      for (const meas of run.measurements) {
        if (meas.source) {
          docIds.add(meas.source.sourceDocumentId);
          if (isSourceLocatorVerified(meas.source)) verifiedSpanCount += 1;
        }
      }
    }
  }

  const scope: DatasetScopeSummary["scope"] =
    verifiedRecordCount > 0 && demoRecordCount === 0
      ? "VERIFIED_INDEXED_DATA"
      : verifiedRecordCount > 0 && demoRecordCount > 0
        ? "MIXED"
        : "DEMO_FIXTURE_ONLY";

  const activeDatasetBanner =
    scope === "VERIFIED_INDEXED_DATA"
      ? "ACTIVE DATASET: VERIFIED NASA PSI EXPERIMENTAL DATA"
      : scope === "MIXED"
        ? "ACTIVE DATASET: MIXED VERIFIED & DEMO RECORDS — CHECK PROVENANCE PER ITEM"
        : `ACTIVE DATASET: DEMO FIXTURES — FICTIONAL DATA — NOT NASA MEASUREMENTS`;

  const scopeDisclosure =
    scope === "VERIFIED_INDEXED_DATA"
      ? `Derived from ${records.length} investigations / ${totalTestRuns.toLocaleString("en-US")} test rows parsed unmodified from ${docIds.size} NASA PSI source file(s). Coverage reflects only the PSI files ingested so far, not the complete PSI archive; quantities a file does not state stay NULL.`
      : `Derived from ${records.length} fictional demo fixture records across ${totalTestRuns} illustrative runs (${verifiedRecordCount} verified NASA records, ${docIds.size} connected NASA source documents). Absence in this index never proves scientific research does not exist elsewhere.`;

  return {
    scope,
    totalRecords: records.length,
    totalTestRuns,
    verifiedRecordCount,
    demoRecordCount,
    unverifiedNonDemoCount,
    sourceDocumentCount: docIds.size,
    verifiedSpanCount,
    activeDatasetBanner,
    scopeDisclosure,
  };
}
