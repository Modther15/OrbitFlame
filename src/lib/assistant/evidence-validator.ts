import type { EvidenceSufficiencyState } from "@/lib/assistant/assistant-response-schema";
import type { RetrievalResult } from "@/lib/assistant/retrieval";
import { DEMO_WARNING } from "@/lib/demo/dataset";
import { checkNumericUnitCompatibility } from "@/lib/science/units";

export type SufficiencyValidationResult = {
  canProceedToModel: boolean;
  sufficiency: EvidenceSufficiencyState;
  abstentionReason: string | null;
  limitations: string[];
  unitCompatibilityNotes: string[];
};

const QUANTITATIVE_PARAMETER_LABELS: Record<string, string> = {
  oxygen_concentration: "Oxygen concentration",
  pressure: "Pressure",
  airflow: "Airflow",
};

export function validateEvidenceSufficiency(retrieval: RetrievalResult): SufficiencyValidationResult {
  const { intent, records, evidenceItems, provenanceSummary } = retrieval;
  const limitations: string[] = [];
  const unitCompatibilityNotes: string[] = [];

  if (records.length === 0) {
    return {
      canProceedToModel: false,
      sufficiency: "INSUFFICIENT_NO_RECORDS",
      abstentionReason:
        "No matching indexed investigation records were found in the OrbitFlame repository for this question. OrbitFlame never falls back to external knowledge or fabricated records.",
      limitations: [
        "Indexed repository returned zero matching records for the requested IDs, investigation family, or combustion parameters.",
      ],
      unitCompatibilityNotes,
    };
  }

  if (provenanceSummary.allDemoFixtures) {
    limitations.push(
      `Active repository contains illustrative demo fixtures only (${DEMO_WARNING}); records are NOT verified NASA flight measurements.`,
    );
  }

  // Verified NASA evidence requested when only DEMO_FIXTURE records match.
  if (intent.asksVerifiedNasaOnly && !records.some((r) => r.provenanceStatus === "NASA_VERIFIED_DATA" && r.source?.verificationStatus === "VERIFIED")) {
    return {
      canProceedToModel: false,
      sufficiency: "INSUFFICIENT_PROVENANCE_MISMATCH",
      abstentionReason:
        "Verified NASA experimental data was requested, but the retrieved records carry DEMO_FIXTURE provenance (fictional illustrative data) with zero attached verified NASA source documents.",
      limitations,
      unitCompatibilityNotes,
    };
  }

  // Causal, spacecraft safety, flammability certification, or suppression effectiveness conclusions.
  if (intent.asksCausalOrSafety) {
    return {
      canProceedToModel: false,
      sufficiency: "INSUFFICIENT_CAUSAL_UNSUPPORTED",
      abstentionReason:
        "Retrieved OrbitFlame records document experimental parameters only and do not support causal claims, flammability limits, suppression effectiveness, or spacecraft fire-safety conclusions.",
      limitations: [
        ...limitations,
        "Similarity or shared experimental parameters across indexed records never establish scientific causation or flight safety certification.",
      ],
      unitCompatibilityNotes,
    };
  }

  // Recorded measurements requested (peak temp, heat release, flame spread, burn rate, soot, etc.)
  if (intent.requestedParameters.includes("measurements")) {
    const measurementItems = evidenceItems.filter(
      (item) => item.fieldKey.startsWith("measurement:") && item.missingStatus === "PRESENT",
    );
    if (measurementItems.length === 0) {
      return {
        canProceedToModel: false,
        sufficiency: "INSUFFICIENT_MISSING_DATA",
        abstentionReason:
          "The retrieved investigation test runs contain zero recorded scientific measurements (0 measurement entries). Missing data cannot be estimated or synthesized.",
        limitations: [
          ...limitations,
          `Retrieved records (${records.map((r) => r.id).join(", ")}) currently hold no populated time-series or scalar measurement rows.`,
        ],
        unitCompatibilityNotes,
      };
    }
  }

  // Hardware or sensor channels requested
  if (intent.requestedParameters.includes("sensors") || intent.requestedParameters.includes("hardware")) {
    const hasMeasurementHardwareOrSensor = records.some((rec) =>
      rec.testRuns.some((run) => run.measurements.some((m) => m.missingStatus === "PRESENT")),
    );
    if (!hasMeasurementHardwareOrSensor) {
      return {
        canProceedToModel: false,
        sufficiency: "INSUFFICIENT_MISSING_DATA",
        abstentionReason:
          "Detailed sensor channels and experimental hardware specifications are NOT REPORTED in the retrieved records. General NASA program apparatus names are never substituted from model memory.",
        limitations: [
          ...limitations,
          `Sensors and experimental hardware fields are unpopulated across ${records.map((r) => r.id).join(", ")}.`,
        ],
        unitCompatibilityNotes,
      };
    }
  }

  // Check requested quantitative condition parameters for complete missingness & unit compatibility
  const requestedNumericParams = intent.requestedParameters.filter(
    (p) => p === "oxygen_concentration" || p === "pressure" || p === "airflow",
  );

  for (const param of requestedNumericParams) {
    const label = QUANTITATIVE_PARAMETER_LABELS[param] ?? param;
    const paramItems = evidenceItems.filter((item) => item.fieldKey === param);
    const presentItems = paramItems.filter((item) => item.missingStatus === "PRESENT" && item.numericValue !== null);
    const missingItems = paramItems.filter((item) => item.missingStatus !== "PRESENT");

    if (!intent.asksMissingAudit && presentItems.length === 0 && paramItems.length > 0) {
      return {
        canProceedToModel: false,
        sufficiency: "INSUFFICIENT_MISSING_DATA",
        abstentionReason: `${label} is NOT REPORTED for all retrieved investigations (${records
          .map((r) => r.id)
          .join(", ")}). OrbitFlame cannot infer or fill missing experimental parameters.`,
        limitations: [
          ...limitations,
          `${label} status is NOT REPORTED across ${records.map((r) => r.id).join(", ")}.`,
        ],
        unitCompatibilityNotes,
      };
    }

    if (missingItems.length > 0 && presentItems.length > 0) {
      limitations.push(
        `${label} is NOT REPORTED in ${missingItems.map((m) => m.investigationId).join(", ")}; comparison covers only the ${presentItems.length} record(s) reporting explicit values.`,
      );
    }

    // Check explicit unit compatibility across all present values for this physical parameter
    if (presentItems.length >= 2) {
      const baseline = presentItems[0];
      for (let i = 1; i < presentItems.length; i++) {
        const current = presentItems[i];
        const compat = checkNumericUnitCompatibility(
          { value: baseline.numericValue as number, unit: baseline.unitOriginal },
          { value: current.numericValue as number, unit: current.unitOriginal },
        );
        if (!compat.compatible) {
          return {
            canProceedToModel: false,
            sufficiency: "INSUFFICIENT_INCOMPATIBLE_UNITS",
            abstentionReason: `Cannot compare ${label} across retrieved records due to incompatible or missing physical units (${baseline.investigationId}: ${
              baseline.unitOriginal ?? "UNKNOWN"
            } vs ${current.investigationId}: ${current.unitOriginal ?? "UNKNOWN"}). ${compat.reason}.`,
            limitations: [...limitations, `${label} unit incompatibility: ${compat.reason}.`],
            unitCompatibilityNotes: [compat.reason],
          };
        }
        if (baseline.unitOriginal !== current.unitOriginal) {
          unitCompatibilityNotes.push(
            `${label} normalized via explicit SI rule to ${compat.sharedUnit} (${baseline.investigationId} & ${current.investigationId}).`,
          );
        }
      }
    }
  }

  const hasPartialMissing =
    requestedNumericParams.some((p) => evidenceItems.some((item) => item.fieldKey === p && item.missingStatus !== "PRESENT")) ||
    (intent.requestedParameters.length === 0 && records.some((r) => r.conditions.missingFields.length > 0));

  const sufficiency: EvidenceSufficiencyState = provenanceSummary.hasVerifiedRecords
    ? "SUFFICIENT_VERIFIED"
    : hasPartialMissing && !intent.asksMissingAudit
      ? "PARTIAL_NARROWER_ONLY"
      : "SUFFICIENT_DEMO_ONLY";

  return {
    canProceedToModel: true,
    sufficiency,
    abstentionReason: null,
    limitations,
    unitCompatibilityNotes,
  };
}
