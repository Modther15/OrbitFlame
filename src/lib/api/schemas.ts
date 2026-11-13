import { z } from "zod";

export const ProvenanceStatusSchema = z.enum(["NASA_VERIFIED_DATA", "DEMO_FIXTURE", "ILLUSTRATIVE_SIMULATION", "NOT_REPORTED", "INFERRED_UNVERIFIED", "PSI_DIRECT_EXPORT"]);
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
  fixtureLabel: z.string().min(1),
  /** Facts copied from the PSI investigation record (optional: absent on legacy fixtures). */
  hardware: z.string().nullable().optional(),
  flightProgram: z.string().nullable().optional(),
  doi: z.string().nullable().optional(),
  fuelPhase: z.string().nullable().optional(),
  /** "rows" = per-test rows in the unified table; "metadata_only" = investigation record / protocol only. */
  rowStatus: z.enum(["rows", "metadata_only"]).optional(),
  ranges: z.object({ o2: z.string().nullable(), pressure: z.string().nullable(), airflow: z.string().nullable() }).optional(),
  /** Numeric min / max over ALL test rows (same rows as the medians in `conditions`): O2 %, pressure kPa, airflow cm/s. null = no values. */
  conditionRanges: z.object({
    o2: z.tuple([z.number(), z.number()]).nullable(),
    pressureKpa: z.tuple([z.number(), z.number()]).nullable(),
    airflowCmS: z.tuple([z.number(), z.number()]).nullable(),
  }).optional(),
  /** Actual gravity (0.0 g ISS/Cygnus baseline, row-level ground tags -> 1.0 g) and effective-gravity PROXY row counts. */
  gravityInfo: z.object({
    actualG: z.number().nullable(),
    source: z.string().nullable(),
    conflict: z.string().nullable(),
    note: z.string().nullable(),
    nActual0g: z.number().int(),
    nActual1g: z.number().int(),
    nProxyRows: z.number().int(),
    proxyBins: z.record(z.string(), z.number().int()),
  }).optional(),
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
export type MissingStatus = z.infer<typeof MissingStatusSchema>;
export type SourceLocator = z.infer<typeof SourceLocatorSchema>;
export type Condition = z.infer<typeof ConditionSchema>;
export type Measurement = z.infer<typeof MeasurementSchema>;
export type TestRun = z.infer<typeof TestRunSchema>;
export type Investigation = z.infer<typeof InvestigationSchema>;
