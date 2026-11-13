import type { Metadata } from "next";
import {
  AssistantView,
  type AssistantSuggestion,
  type FamilyShortcut,
} from "@/components/assistant/assistant-view";
import type { DemoInvestigation } from "@/lib/api/schemas";
import { isOpenAiConfigured } from "@/lib/assistant/assistant-provider";
import { investigationRepository } from "@/lib/data/repository";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "OrbitFlame AI Research Assistant | OrbitFlame",
  description: "Evidence-only answers grounded in indexed microgravity combustion investigations.",
};

function buildVerifiedSuggestions(records: DemoInvestigation[]): AssistantSuggestion[] {
  const suggestions: AssistantSuggestion[] = [];
  const byId = new Map(records.map((r) => [r.id, r]));

  if (byId.has("PSI-159") && byId.has("PSI-69")) {
    suggestions.push({
      id: "compare-psi159-psi69",
      category: "MULTI-RECORD COMPARISON",
      label: "Compare PSI-159 & PSI-69 conditions",
      question: "Compare the recorded oxygen concentration and pressure of PSI-159 and PSI-69.",
    });
  }

  if (byId.has("PSI-159")) {
    suggestions.push({
      id: "inspect-psi159",
      category: "SINGLE INVESTIGATION",
      label: "Inspect PSI-159 (ACME CFI-G) conditions",
      question: "What oxygen concentrations and pressures are recorded for PSI-159?",
    });
  }

  const bassCount = records.filter((r) => r.family === "BASS").length;
  if (bassCount > 0) {
    suggestions.push({
      id: "family-bass",
      category: "FAMILY EVIDENCE AUDIT",
      label: "Summarize BASS oxygen and pressure",
      question: "Summarize the reported oxygen concentration and pressure across BASS investigations.",
    });
  }

  const hasMissing = records.some((r) => r.conditions.missingFields.length > 0);
  if (hasMissing) {
    suggestions.push({
      id: "missing-fields-audit",
      category: "DATA COMPLETENESS",
      label: "Audit missing airflow or pressure",
      question: "Which indexed investigations have missing airflow or pressure fields?",
    });
  }

  return suggestions;
}

function buildFamilyShortcuts(records: DemoInvestigation[]): FamilyShortcut[] {
  const counts = new Map<string, number>();
  for (const rec of records) {
    if (!rec.family) continue;
    counts.set(rec.family, (counts.get(rec.family) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([family, count]) => ({
      family,
      count,
      question: `Compare the available experimental conditions and gravity environments across ${family} investigations.`,
    }));
}

export default async function AssistantPage() {
  let records: DemoInvestigation[] = [];
  try {
    records = await investigationRepository.list();
  } catch {
    records = [];
  }

  const hasVerified = records.some(
    (r) => r.provenanceStatus === "NASA_VERIFIED_DATA" && r.source?.verificationStatus === "VERIFIED",
  );
  const dataScope =
    records.length === 0 ? "EMPTY" : hasVerified ? "VERIFIED NASA PSI EXPERIMENTAL DATA" : "DEMO DATA";

  return (
    <AssistantView
      dataScope={dataScope}
      indexedCount={records.length}
      isAiConfigured={isOpenAiConfigured()}
      suggestions={buildVerifiedSuggestions(records)}
      familyShortcuts={buildFamilyShortcuts(records)}
    />
  );
}
