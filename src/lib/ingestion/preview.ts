import { InvestigationSchema, type Investigation } from "@/lib/api/schemas";
import { normalizeToKnownSi } from "@/lib/science/units";

export type ImportPreviewRow = {
  index: number;
  record: Investigation | null;
  errors: string[];
  warnings: string[];
};

export type BatchRowStatus = "ACCEPTED" | "ACCEPTED_WITH_WARNINGS" | "REJECTED";

export type BatchValidationRowReport = {
  index: number;
  recordId: string | null;
  status: BatchRowStatus;
  schemaErrors: string[];
  unitValidationIssues: string[];
  provenanceIssues: string[];
  duplicateIssues: string[];
  warnings: string[];
  rejectionReasons: string[];
};

export type DatasetImportReport = {
  totalProcessed: number;
  acceptedCount: number;
  acceptedWithWarningsCount: number;
  rejectedCount: number;
  duplicateIds: string[];
  unrecognizedUnits: string[];
  provenanceBreakdown: Record<string, number>;
  rows: BatchValidationRowReport[];
};

/** Validates proposed JSON records without storing or importing them. */
export function previewInvestigationImport(input: unknown): ImportPreviewRow[] {
  const records = Array.isArray(input) ? input : [input];
  return records.map((record, index) => {
    const result = InvestigationSchema.safeParse(record);
    if (!result.success) {
      return {
        index,
        record: null,
        errors: result.error.issues.map((issue) => `${issue.path.join(".") || "record"}: ${issue.message}`),
        warnings: [],
      };
    }

    const warnings: string[] = [];
    if (result.data.provenanceStatus === "NASA_VERIFIED_DATA" && !result.data.source) {
      warnings.push("NASA_VERIFIED_DATA requires a source locator before acceptance.");
    }
    if (
      result.data.provenanceStatus === "DEMO_FIXTURE" &&
      result.data.testRuns.some((run) => run.provenanceStatus !== "DEMO_FIXTURE")
    ) {
      warnings.push("A demo investigation contains a run with a different provenance status.");
    }
    return { index, record: result.data, errors: [], warnings };
  });
}

/**
 * Comprehensive dry-run dataset ingestion validator for preparing future verified NASA data integration.
 * Checks Zod schema contracts, explicit physical units, strict verified-source locators, duplicate IDs,
 * and provenance isolation without persisting or fabricating any records.
 */
export function validateInvestigationDatasetBatch(
  input: unknown,
  existingRecords: Pick<Investigation, "id">[] = [],
): DatasetImportReport {
  const rawList = Array.isArray(input) ? input : input === null || input === undefined ? [] : [input];
  const existingIdSet = new Set(existingRecords.map((r) => r.id.trim().toLocaleUpperCase()));
  const seenBatchIds = new Set<string>();
  const duplicateIds = new Set<string>();
  const unrecognizedUnits = new Set<string>();
  const provenanceBreakdown: Record<string, number> = {};

  const rows: BatchValidationRowReport[] = rawList.map((raw, index) => {
    const schemaResult = InvestigationSchema.safeParse(raw);
    if (!schemaResult.success) {
      const schemaErrors = schemaResult.error.issues.map(
        (issue) => `${issue.path.join(".") || "record"}: ${issue.message}`,
      );
      const maybeId =
        typeof raw === "object" && raw !== null && "id" in raw && typeof (raw as { id: unknown }).id === "string"
          ? (raw as { id: string }).id
          : null;
      return {
        index,
        recordId: maybeId,
        status: "REJECTED",
        schemaErrors,
        unitValidationIssues: [],
        provenanceIssues: [],
        duplicateIssues: [],
        warnings: [],
        rejectionReasons: schemaErrors,
      };
    }

    const rec = schemaResult.data;
    const upperId = rec.id.trim().toLocaleUpperCase();
    provenanceBreakdown[rec.provenanceStatus] = (provenanceBreakdown[rec.provenanceStatus] ?? 0) + 1;

    const unitValidationIssues: string[] = [];
    const provenanceIssues: string[] = [];
    const duplicateIssues: string[] = [];
    const warnings: string[] = [];
    const rejectionReasons: string[] = [];

    // 1. Duplicate ID detection (batch & active index)
    if (seenBatchIds.has(upperId)) {
      const msg = `Duplicate investigation ID "${rec.id}" appears multiple times inside import batch.`;
      duplicateIssues.push(msg);
      duplicateIds.add(rec.id);
      rejectionReasons.push(msg);
    }
    seenBatchIds.add(upperId);

    if (existingIdSet.has(upperId)) {
      const msg = `Investigation ID "${rec.id}" already exists in the active repository index.`;
      duplicateIssues.push(msg);
      duplicateIds.add(rec.id);
      rejectionReasons.push(msg);
    }

    const runIdSet = new Set<string>();
    for (const run of rec.testRuns) {
      const upperRunId = run.id.trim().toLocaleUpperCase();
      if (runIdSet.has(upperRunId)) {
        const msg = `Duplicate test run ID "${run.id}" inside investigation "${rec.id}".`;
        duplicateIssues.push(msg);
        rejectionReasons.push(msg);
      }
      runIdSet.add(upperRunId);
    }

    // 2. Strict provenance verification checks
    if (rec.provenanceStatus === "NASA_VERIFIED_DATA") {
      if (!rec.source) {
        const msg = "NASA_VERIFIED_DATA record rejected: missing mandatory primary SourceLocator metadata.";
        provenanceIssues.push(msg);
        rejectionReasons.push(msg);
      } else if (rec.source.verificationStatus !== "VERIFIED") {
        const msg = `NASA_VERIFIED_DATA record rejected: SourceLocator verificationStatus is "${rec.source.verificationStatus}", must be "VERIFIED".`;
        provenanceIssues.push(msg);
        rejectionReasons.push(msg);
      }
    }

    if (
      rec.provenanceStatus === "DEMO_FIXTURE" &&
      rec.testRuns.some((run) => run.provenanceStatus === "NASA_VERIFIED_DATA")
    ) {
      const msg = "Provenance isolation violation: DEMO_FIXTURE investigation cannot contain NASA_VERIFIED_DATA runs.";
      provenanceIssues.push(msg);
      rejectionReasons.push(msg);
    }

    if (rec.testRuns.length === 0) {
      warnings.push("Investigation has 0 testRuns entries; evidence coverage will reflect no attached run telemetry.");
    }

    // 3. Physical unit validation across run conditions & measurements
    for (const run of rec.testRuns) {
      for (const cond of run.conditions) {
        if (cond.missingStatus === "PRESENT" && cond.valueOriginal !== null) {
          if (cond.parameterKey !== "gravity") {
            const norm = normalizeToKnownSi(cond.valueOriginal, cond.unitOriginal);
            if (!cond.unitOriginal || !cond.unitOriginal.trim()) {
              const msg = `Run ${run.id} condition "${cond.parameterKey}" has numeric value (${cond.valueOriginal}) without an explicit unit.`;
              unitValidationIssues.push(msg);
              rejectionReasons.push(msg);
            } else if (!norm.unitKnown) {
              const msg = `Run ${run.id} condition "${cond.parameterKey}" carries unrecognized unit "${cond.unitOriginal}".`;
              unitValidationIssues.push(msg);
              unrecognizedUnits.add(cond.unitOriginal);
              warnings.push(msg);
            }
          }
        } else if (cond.missingStatus !== "PRESENT" && (cond.valueOriginal !== null || cond.textOriginal !== null)) {
          const msg = `Run ${run.id} condition "${cond.parameterKey}" has missingStatus="${cond.missingStatus}" but still contains a value.`;
          unitValidationIssues.push(msg);
          rejectionReasons.push(msg);
        }
      }

      for (const meas of run.measurements) {
        if (meas.missingStatus === "PRESENT" && meas.valueOriginal !== null) {
          const norm = normalizeToKnownSi(meas.valueOriginal, meas.unitOriginal);
          if (!meas.unitOriginal || !meas.unitOriginal.trim()) {
            const msg = `Run ${run.id} measurement "${meas.metricKey}" has numeric value (${meas.valueOriginal}) without an explicit unit.`;
            unitValidationIssues.push(msg);
            rejectionReasons.push(msg);
          } else if (!norm.unitKnown) {
            const msg = `Run ${run.id} measurement "${meas.metricKey}" carries unrecognized unit "${meas.unitOriginal}".`;
            unitValidationIssues.push(msg);
            unrecognizedUnits.add(meas.unitOriginal);
            warnings.push(msg);
          }
        }
      }
    }

    const status: BatchRowStatus =
      rejectionReasons.length > 0
        ? "REJECTED"
        : warnings.length > 0
          ? "ACCEPTED_WITH_WARNINGS"
          : "ACCEPTED";

    return {
      index,
      recordId: rec.id,
      status,
      schemaErrors: [],
      unitValidationIssues,
      provenanceIssues,
      duplicateIssues,
      warnings,
      rejectionReasons,
    };
  });

  return {
    totalProcessed: rows.length,
    acceptedCount: rows.filter((r) => r.status === "ACCEPTED").length,
    acceptedWithWarningsCount: rows.filter((r) => r.status === "ACCEPTED_WITH_WARNINGS").length,
    rejectedCount: rows.filter((r) => r.status === "REJECTED").length,
    duplicateIds: Array.from(duplicateIds),
    unrecognizedUnits: Array.from(unrecognizedUnits),
    provenanceBreakdown,
    rows,
  };
}
