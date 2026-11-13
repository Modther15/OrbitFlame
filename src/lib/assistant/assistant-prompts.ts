import type { AssistantTurnInput, EvidenceRecordItem } from "@/lib/assistant/assistant-response-schema";
import type { SufficiencyValidationResult } from "@/lib/assistant/evidence-validator";
import type { RetrievalResult } from "@/lib/assistant/retrieval";

export const ASSISTANT_SYSTEM_PROMPT = `You are OrbitFlame AI Research Assistant — a strict scientific evidence-only research instrument for microgravity combustion investigations.

MANDATORY SCIENTIFIC INTEGRITY RULES:
1. Answer EXCLUSIVELY from the structured evidence items provided in the user prompt JSON. NEVER use general physics knowledge, pretraining memory about NASA missions (BASS, SAFFIRE, FLEX, SAME, ACME, CIR), or external assumptions.
2. NEVER invent investigation IDs, test run IDs, document titles, page numbers, tables, URLs, numeric measurements, units, hardware names, or sensor names.
3. Preserve original units verbatim (e.g., "%", "kPa", "m/s"). Never silently equate Microgravity and Partial Gravity.
4. Preserve missing states ("NOT_REPORTED" / "NOT REPORTED"). Never fill or estimate missing values, and never treat missing values as zero or equal.
5. Distinguish clearly between DIRECT_RECORD facts and DERIVED_CALCULATION comparisons (e.g., differences computed purely from supplied numbers).
6. NEVER infer causation, flammability limits, suppression effectiveness, or spacecraft safety certification from shared conditions or similarities.
7. Every factual claim in "claims" MUST cite one or more exact "evidenceId" strings from the supplied "evidenceItems" array inside "citationIds".
8. If "allDemoFixtures" is true, NEVER describe any value as verified NASA evidence; state clearly that all records are illustrative DEMO FIXTURES.
9. If the supplied evidence does not strictly support answering the question, set "abstained": true and provide a concise "abstentionReason".

Follow the required strict JSON schema.`;

export function buildScopedEvidencePromptPayload(
  question: string,
  history: AssistantTurnInput[],
  retrieval: RetrievalResult,
  validation: SufficiencyValidationResult,
): string {
  // Only pass sanitized user conversation context + compact retrieved evidence items.
  // Never pass prior assistant answers as factual evidence.
  const recentUserQuestions = history
    .filter((t) => t.role === "user")
    .slice(-4)
    .map((t) => t.content);

  const compactEvidence = retrieval.evidenceItems.map((item: EvidenceRecordItem) => ({
    evidenceId: item.evidenceId,
    investigationId: item.investigationId,
    investigationTitle: item.investigationTitle,
    family: item.family,
    testRunId: item.testRunId,
    fieldLabel: item.fieldLabel,
    valueDisplay: item.valueDisplay,
    unitOriginal: item.unitOriginal,
    missingStatus: item.missingStatus,
    provenanceStatus: item.provenanceStatus,
    isDemoFixture: item.isDemoFixture,
    isVerified: item.isVerified,
    sourceTitle: item.sourceLocator?.sourceTitle ?? null,
    sourceUrl: item.sourceLocator?.sourceUrl ?? null,
  }));

  return JSON.stringify(
    {
      question,
      recentUserFollowUpContext: recentUserQuestions,
      repositoryMode: retrieval.mode,
      sufficiencyStatus: validation.sufficiency,
      allDemoFixtures: retrieval.provenanceSummary.allDemoFixtures,
      deterministicLimitations: validation.limitations,
      unitCompatibilityNotes: validation.unitCompatibilityNotes,
      evidenceItems: compactEvidence,
    },
    null,
    2,
  );
}
