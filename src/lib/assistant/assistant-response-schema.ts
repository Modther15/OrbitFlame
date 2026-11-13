import { z } from "zod";
import { MissingStatusSchema, ProvenanceStatusSchema, SourceLocatorSchema } from "@/lib/api/schemas";

export const AssistantTurnInputSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().trim().min(1).max(1500),
});
export type AssistantTurnInput = z.infer<typeof AssistantTurnInputSchema>;

export const AssistantRequestSchema = z.object({
  question: z.string().trim().min(1, "Question cannot be empty.").max(1000, "Question exceeds 1000-character limit."),
  history: z.array(AssistantTurnInputSchema).max(8, "Conversation history limit exceeded.").optional().default([]),
  investigationIds: z.array(z.string().trim().min(1).max(32)).max(5).optional(),
});
export type AssistantRequest = z.infer<typeof AssistantRequestSchema>;

export const EvidenceRecordItemSchema = z.object({
  evidenceId: z.string().min(1),
  investigationId: z.string().min(1),
  investigationTitle: z.string().min(1),
  family: z.string().nullable(),
  testRunId: z.string().nullable(),
  fieldKey: z.string().min(1),
  fieldLabel: z.string().min(1),
  valueDisplay: z.string(),
  numericValue: z.number().finite().nullable(),
  unitOriginal: z.string().nullable(),
  valueSi: z.number().finite().nullable(),
  unitSi: z.string().nullable(),
  missingStatus: MissingStatusSchema,
  provenanceStatus: ProvenanceStatusSchema,
  provenanceLabel: z.string(),
  isDemoFixture: z.boolean(),
  isVerified: z.boolean(),
  sourceLocator: SourceLocatorSchema.nullable(),
});
export type EvidenceRecordItem = z.infer<typeof EvidenceRecordItemSchema>;

export const ModelClaimSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  evidenceType: z.enum(["DIRECT_RECORD", "DERIVED_CALCULATION", "UNAVAILABLE"]),
  citationIds: z.array(z.string().min(1)),
});

export const ModelAssistantOutputSchema = z.object({
  directAnswer: z.string(),
  claims: z.array(ModelClaimSchema),
  citedEvidenceIds: z.array(z.string()),
  limitations: z.array(z.string()),
  abstained: z.boolean(),
  abstentionReason: z.string().nullable(),
});
export type ModelAssistantOutput = z.infer<typeof ModelAssistantOutputSchema>;

export const AssistantCitationSchema = z.object({
  citationNumber: z.number().int().positive(),
  evidenceId: z.string().min(1),
  investigationId: z.string().min(1),
  investigationTitle: z.string().min(1),
  family: z.string().nullable(),
  testRunId: z.string().nullable(),
  fieldLabel: z.string().min(1),
  valueDisplay: z.string(),
  originalValue: z.string(),
  originalUnit: z.string().nullable(),
  missingStatus: MissingStatusSchema,
  provenanceStatus: ProvenanceStatusSchema,
  provenanceLabel: z.string(),
  isDemoFixture: z.boolean(),
  isVerified: z.boolean(),
  sourceTitle: z.string().nullable(),
  locatorDisplay: z.string(),
  sourceUrl: z.string().url().nullable(),
});
export type AssistantCitation = z.infer<typeof AssistantCitationSchema>;

export const EvidenceSufficiencyStateSchema = z.enum([
  "SUFFICIENT_DEMO_ONLY",
  "SUFFICIENT_VERIFIED",
  "PARTIAL_NARROWER_ONLY",
  "INSUFFICIENT_NO_RECORDS",
  "INSUFFICIENT_MISSING_DATA",
  "INSUFFICIENT_INCOMPATIBLE_UNITS",
  "INSUFFICIENT_CAUSAL_UNSUPPORTED",
  "INSUFFICIENT_PROVENANCE_MISMATCH",
  "PROVIDER_UNAVAILABLE",
]);
export type EvidenceSufficiencyState = z.infer<typeof EvidenceSufficiencyStateSchema>;

export const ValidatedClaimSchema = z.object({
  id: z.string(),
  text: z.string(),
  evidenceType: z.enum(["DIRECT_RECORD", "DERIVED_CALCULATION", "UNAVAILABLE"]),
  citationNumbers: z.array(z.number().int().positive()),
});
export type ValidatedClaim = z.infer<typeof ValidatedClaimSchema>;

export const AssistantApiResponseSchema = z.object({
  requestId: z.string(),
  /** How the answer was produced: 'llm' = OpenAI synthesis over retrieved evidence; 'deterministic' = evidence-only answer built by the shared FastAPI builder (habitat risk readout);
   *  'deterministic_fallback' = evidence-only answer used because the LLM path was unavailable (or FastAPI was unreachable and the static snapshot was used). */
  mode: z.enum(["llm", "deterministic", "deterministic_fallback"]),
  /** Provenance class of the retrieved records (formerly `mode`). */
  dataMode: z.enum(["DEMO_FIXTURE_ONLY", "VERIFIED_INDEXED_DATA", "EMPTY"]),
  /** Why the deterministic fallback ran (missing key, provider error, timeout, malformed output, budget, vague query). */
  fallbackReason: z.string().nullable().optional(),
  /** True for greeting / vague queries: a short "ask about PSI-xx" hint rather than an evidence answer. */
  hint: z.boolean().optional(),
  /** Deterministic habitat-ranking paragraph (physics_ranker, actual-vs-effective gravity caveat), attached to LLM answers about a habitat. */
  habitatView: z.string().nullable().optional(),
  status: z.enum(["ANSWERED", "ABSTAINED", "CONFIGURATION_REQUIRED", "PROVIDER_ERROR"]),
  sufficiency: EvidenceSufficiencyStateSchema,
  provenanceBanner: z.string(),
  answer: z.string(),
  claims: z.array(ValidatedClaimSchema),
  citations: z.array(AssistantCitationSchema),
  limitations: z.array(z.string()),
  abstained: z.boolean(),
  abstentionReason: z.string().nullable(),
  retrievedInvestigations: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      family: z.string().nullable(),
      missingFields: z.array(z.string()),
    }),
  ),
  configStatus: z
    .object({
      configured: z.boolean(),
      message: z.string(),
    })
    .optional(),
});
export type AssistantApiResponse = z.infer<typeof AssistantApiResponseSchema>;

/** Strict JSON Schema for OpenAI Responses API Structured Outputs */
export const OPENAI_ASSISTANT_JSON_SCHEMA: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  required: ["directAnswer", "claims", "citedEvidenceIds", "limitations", "abstained", "abstentionReason"],
  properties: {
    directAnswer: { type: "string" },
    claims: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "text", "evidenceType", "citationIds"],
        properties: {
          id: { type: "string" },
          text: { type: "string" },
          evidenceType: {
            type: "string",
            enum: ["DIRECT_RECORD", "DERIVED_CALCULATION", "UNAVAILABLE"],
          },
          citationIds: {
            type: "array",
            items: { type: "string" },
          },
        },
      },
    },
    citedEvidenceIds: {
      type: "array",
      items: { type: "string" },
    },
    limitations: {
      type: "array",
      items: { type: "string" },
    },
    abstained: { type: "boolean" },
    abstentionReason: {
      type: ["string", "null"],
    },
  },
};
