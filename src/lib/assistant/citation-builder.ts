import type { SourceLocator } from "@/lib/api/schemas";
import type {
  AssistantCitation,
  EvidenceRecordItem,
  ModelAssistantOutput,
  ValidatedClaim,
} from "@/lib/assistant/assistant-response-schema";

export function formatSourceLocator(source: SourceLocator | null): {
  sourceTitle: string | null;
  locatorDisplay: string;
  sourceUrl: string | null;
} {
  if (!source) {
    return {
      sourceTitle: null,
      locatorDisplay: "SOURCE LOCATOR NOT AVAILABLE",
      sourceUrl: null,
    };
  }

  const parts: string[] = [];
  if (source.sectionHeading) parts.push(source.sectionHeading);
  if (source.pageNumber) parts.push(`Page ${source.pageNumber}`);
  if (source.tableFigureLabel) parts.push(source.tableFigureLabel);
  if (source.rowOrRecordKey) parts.push(`Row ${source.rowOrRecordKey}`);

  return {
    sourceTitle: source.sourceTitle,
    locatorDisplay: parts.length > 0 ? parts.join(" · ") : "SOURCE LOCATOR NOT AVAILABLE",
    // Only trust an explicit URL present on the validated server-side source locator.
    sourceUrl: source.sourceUrl ?? null,
  };
}

export function buildEvidenceLookup(evidenceItems: EvidenceRecordItem[]): Map<string, EvidenceRecordItem> {
  return new Map(evidenceItems.map((item) => [item.evidenceId, item]));
}

export function toCitationRecord(item: EvidenceRecordItem, citationNumber: number): AssistantCitation {
  const { sourceTitle, locatorDisplay, sourceUrl } = formatSourceLocator(item.sourceLocator);
  return {
    citationNumber,
    evidenceId: item.evidenceId,
    investigationId: item.investigationId,
    investigationTitle: item.investigationTitle,
    family: item.family,
    testRunId: item.testRunId,
    fieldLabel: item.fieldLabel,
    valueDisplay: item.valueDisplay,
    originalValue: item.numericValue !== null ? String(item.numericValue) : item.valueDisplay,
    originalUnit: item.unitOriginal,
    missingStatus: item.missingStatus,
    provenanceStatus: item.provenanceStatus,
    provenanceLabel: item.provenanceLabel,
    isDemoFixture: item.isDemoFixture,
    isVerified: item.isVerified,
    sourceTitle,
    locatorDisplay,
    sourceUrl,
  };
}

export type CitationValidationOutcome = {
  abstained: boolean;
  abstentionReason: string | null;
  answer: string;
  claims: ValidatedClaim[];
  citations: AssistantCitation[];
  rejectedCitationIds: string[];
  droppedUngroundedClaims: number;
};

export function validateAndBindModelOutput(
  modelOutput: ModelAssistantOutput,
  evidenceItems: EvidenceRecordItem[],
  deterministicLimitations: string[],
): CitationValidationOutcome {
  const lookup = buildEvidenceLookup(evidenceItems);
  const rejectedSet = new Set<string>();
  const numberByEvidenceId = new Map<string, number>();
  const citations: AssistantCitation[] = [];

  const registerEvidenceId = (id: string): number | null => {
    const trimmed = id.trim();
    const record = lookup.get(trimmed);
    if (!record) {
      if (trimmed) rejectedSet.add(trimmed);
      return null;
    }
    const existing = numberByEvidenceId.get(trimmed);
    if (existing !== undefined) return existing;
    const nextNumber = citations.length + 1;
    numberByEvidenceId.set(trimmed, nextNumber);
    citations.push(toCitationRecord(record, nextNumber));
    return nextNumber;
  };

  if (modelOutput.abstained) {
    for (const id of modelOutput.citedEvidenceIds) {
      registerEvidenceId(id);
    }
    return {
      abstained: true,
      abstentionReason:
        modelOutput.abstentionReason ??
        "Insufficient indexed evidence to answer this question reliably without external assumptions.",
      answer: modelOutput.directAnswer,
      claims: [],
      citations,
      rejectedCitationIds: Array.from(rejectedSet),
      droppedUngroundedClaims: 0,
    };
  }

  const validatedClaims: ValidatedClaim[] = [];
  let droppedUngroundedClaims = 0;

  for (const claim of modelOutput.claims) {
    const nums: number[] = [];
    for (const cid of claim.citationIds) {
      const n = registerEvidenceId(cid);
      if (n !== null && !nums.includes(n)) {
        nums.push(n);
      }
    }
    if (nums.length === 0) {
      droppedUngroundedClaims += 1;
      continue;
    }
    validatedClaims.push({
      id: claim.id,
      text: claim.text,
      evidenceType: claim.evidenceType,
      citationNumbers: nums,
    });
  }

  for (const cid of modelOutput.citedEvidenceIds) {
    registerEvidenceId(cid);
  }

  // Every non-abstained scientific response must have at least one grounded claim and valid citation.
  if (validatedClaims.length === 0 || citations.length === 0) {
    return {
      abstained: true,
      abstentionReason:
        "Model response contained no verifiable claims backed by retrieved repository evidence IDs and was withheld.",
      answer:
        "Abstaining: generated claims could not be verified against retrieved evidence records in the OrbitFlame repository.",
      claims: [],
      citations: [],
      rejectedCitationIds: Array.from(rejectedSet),
      droppedUngroundedClaims: Math.max(droppedUngroundedClaims, modelOutput.claims.length),
    };
  }

  const citationTags = (nums: number[]) => nums.map((n) => `[${n}]`).join(" ");
  const hasDemo = citations.some((c) => c.isDemoFixture);

  const formattedSections = [
    `Direct Answer: ${modelOutput.directAnswer}`,
    "",
    "Supporting Evidence:",
    ...validatedClaims.map((c) => {
      const prefix = c.evidenceType === "DERIVED_CALCULATION" ? "[Derived from recorded values]" : "[Direct record]";
      return `- ${prefix} ${c.text} ${citationTags(c.citationNumbers)}`;
    }),
    "",
    `Limitations & Missing Information: ${
      [...deterministicLimitations, ...modelOutput.limitations].filter(Boolean).join(" ") || "None noted beyond active scope."
    }`,
    "",
    `Provenance Notice: ${
      hasDemo
        ? "DEMO FIXTURE — FICTIONAL DATA — NOT NASA MEASUREMENTS. Illustrative values only; never treat as verified NASA research findings."
        : "Grounded exclusively in retrieved indexed OrbitFlame records."
    }`,
  ];

  return {
    abstained: false,
    abstentionReason: null,
    answer: formattedSections.join("\n"),
    claims: validatedClaims,
    citations,
    rejectedCitationIds: Array.from(rejectedSet),
    droppedUngroundedClaims,
  };
}
