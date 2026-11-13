import type { Metadata } from "next";
import { SourceCatalogueView } from "@/components/ecosystem/source-catalogue-view";
import { investigationRepository, listSummaries } from "@/lib/data/repository";
import { buildSourceCatalogue } from "@/lib/science/source-catalogue";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Research Library & Source Governance | OrbitFlame",
  description: "Indexed research library, source locators, NASA source governance hierarchy, and dry-run dataset validation.",
};

/** Validator examples are built from a real indexed record (smallest non-empty one, normally PSI-100) so no hand-written fixture exists. */
async function realExamples(ids: string[]) {
  const full = await investigationRepository.getById(ids.includes("PSI-100") ? "PSI-100" : (ids[0] ?? ""));
  if (!full) return { duplicate: "[]", sourceId: null };
  const { id, name, acronym, family, objective, summary, safetyDomains, gravityEnvironments, provenanceStatus, evidenceLevel, source, testRuns } = full;
  // First real test run only (keeps the page small); the client derives the "new ID" variant from this same text.
  const base = { id, name, acronym, family, objective, summary, safetyDomains, gravityEnvironments, provenanceStatus, evidenceLevel, source, testRuns: testRuns.slice(0, 1) };
  return { duplicate: JSON.stringify([base], null, 2), sourceId: id };
}

export default async function SourcesPage() {
  const records = await listSummaries();
  const { datasetScope, entries, verifiedSourceCount } = buildSourceCatalogue(records);
  const examples = await realExamples(records.map((r) => r.id));
  return <SourceCatalogueView datasetScope={datasetScope} entries={entries} verifiedSourceCount={verifiedSourceCount} existingIds={records.map((r) => r.id)} examples={examples} />;
}
