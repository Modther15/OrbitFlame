import { z } from "zod";

export const ProvenanceStatusSchema = z.enum(["NASA_VERIFIED_DATA", "DEMO_FIXTURE", "ILLUSTRATIVE_SIMULATION", "NOT_REPORTED", "INFERRED_UNVERIFIED"]);
export const MissingStatusSchema = z.enum(["PRESENT", "NOT_REPORTED", "NOT_APPLICABLE", "UNKNOWN", "AMBIGUOUS"]);
export const EvidenceLevelSchema = z.enum(["DIRECT", "ANALOGOUS", "MECHANISM_ONLY", "PLANNED", "UNAVAILABLE"]);
export const SourceLocatorSchema = z.object({
  sourceDocumentId: z.string().min(1),
  sourceTitle: z.string().min(1),
  sourceUrl: z.string().url().nullable(),
  pageNumber: z.number().int().positive().nullable(),
  sectionHeading: z.string().nullable(),
  tableFigureLabel: z.string().nullable(),
  rowOrRecordKey: z.string().nullable(),
  verificationStatus: z.enum(["UNVERIFIED", "VERIFIED", "REJECTED"]),
});
export const MeasurementSchema = z.object({
  id: z.string().min(1),
  metricKey: z.string().min(1),
  label: z.string().min(1),
  valueOriginal: z.number().finite().nullable(),
  textOriginal: z.string().nullable(),
  unitOriginal: z.string().nullable(),
  valueSi: z.number().finite().nullable(),
  unitSi: z.string().nullable(),
  measurementStatus: z.enum(["MEASURED", "REPORTED", "DERIVED", "QUALITATIVE", "UNVERIFIED"]),
  missingStatus: MissingStatusSchema,
  source: SourceLocatorSchema.nullable(),
}).refine((value) => value.missingStatus === "PRESENT" || (value.valueOriginal === null && value.textOriginal === null), {
  message: "Missing measurement values must not carry a numeric or text value.",
});
export const ConditionSchema = z.object({
  parameterKey: z.string().min(1),
  valueOriginal: z.number().finite().nullable(),
  textOriginal: z.string().nullable(),
  unitOriginal: z.string().nullable(),
  valueSi: z.number().finite().nullable(),
  unitSi: z.string().nullable(),
  missingStatus: MissingStatusSchema,
  source: SourceLocatorSchema.nullable(),
});
export const TestRunSchema = z.object({
  id: z.string().min(1),
  sourceRunKey: z.string().nullable(),
  label: z.string().min(1),
  objectiveVariant: z.string().nullable(),
  conditions: z.array(ConditionSchema),
  measurements: z.array(MeasurementSchema),
  provenanceStatus: ProvenanceStatusSchema,
});
export const InvestigationSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  acronym: z.string().nullable(),
  family: z.string().nullable(),
  objective: z.string().nullable(),
  summary: z.string().nullable(),
  safetyDomains: z.array(z.enum(["PREVENTION", "DETECTION", "SUPPRESSION", "OTHER"])),
  gravityEnvironments: z.array(z.string()),
  provenanceStatus: ProvenanceStatusSchema,
  evidenceLevel: EvidenceLevelSchema,
  source: SourceLocatorSchema.nullable(),
  testRuns: z.array(TestRunSchema),
});
export const DemoInvestigationSchema = InvestigationSchema.extend({
  fuelMaterial: z.string(),
  conditions: z.object({
    oxygenPercent: z.number().finite().nullable(),
    pressureKpa: z.number().finite().nullable(),
    airflowMps: z.number().finite().nullable(),
    gravity: z.string(),
    missingFields: z.array(z.string()),
  }),
  findingsSummary: z.string(),
  dataCompleteness: z.number().int().min(0).max(100),
  fixtureLabel: z.literal("DEMO FIXTURE — FICTIONAL DATA — NOT NASA MEASUREMENTS"),
});
export type DemoInvestigation = z.infer<typeof DemoInvestigationSchema>;

export const ApiErrorSchema = z.object({ code: z.string(), message: z.string(), requestId: z.string().optional() });
export const DatasetSummarySchema = z.object({
  investigationCount: z.number().int().nonnegative().nullable(),
  testRunCount: z.number().int().nonnegative().nullable(),
  sourceDocumentCount: z.number().int().nonnegative().nullable(),
  verifiedEvidenceSpanCount: z.number().int().nonnegative().nullable(),
  datasetVersion: z.string().nullable(),
  collectionStatus: z.enum(["EMPTY", "PARTIAL", "AVAILABLE", "DEMO"]),
});
export type DatasetSummary = z.infer<typeof DatasetSummarySchema>;
export type ProvenanceStatus = z.infer<typeof ProvenanceStatusSchema>;
export type Investigation = z.infer<typeof InvestigationSchema>;
