import { InvestigationSchema, type Investigation } from "@/lib/api/schemas";

export type ImportPreviewRow = {
  index: number;
  record: Investigation | null;
  errors: string[];
  warnings: string[];
};

/** Validates proposed JSON records without storing or importing them. */
export function previewInvestigationImport(input: unknown): ImportPreviewRow[] {
  const records = Array.isArray(input) ? input : [input];
  return records.map((record, index) => {
    const result = InvestigationSchema.safeParse(record);
    if (!result.success) {
      return { index, record: null, errors: result.error.issues.map((issue) => `${issue.path.join(".") || "record"}: ${issue.message}`), warnings: [] };
    }

    const warnings: string[] = [];
    if (result.data.provenanceStatus === "NASA_VERIFIED_DATA" && !result.data.source) {
      warnings.push("NASA_VERIFIED_DATA requires a source locator before acceptance.");
    }
    if (result.data.provenanceStatus === "DEMO_FIXTURE" && result.data.testRuns.some((run) => run.provenanceStatus !== "DEMO_FIXTURE")) {
      warnings.push("A demo investigation contains a run with a different provenance status.");
    }
    return { index, record: result.data, errors: [], warnings };
  });
}
