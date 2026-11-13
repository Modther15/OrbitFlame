import type { ProvenanceStatus, SourceLocator } from "@/lib/api/schemas";
import {
  deriveDatasetScope,
  formatProvenanceTag,
  isRecordVerified,
  type DatasetScopeSummary,
  type ScopeRecord,
} from "@/lib/science/provenance";

export type SourceCatalogueEntry = {
  id: string;
  investigationId: string;
  investigationName: string;
  family: string | null;
  sourceTitle: string;
  documentType: string;
  publicationDate: string;
  locatorDisplay: string;
  verificationStatus: "VERIFIED" | "UNVERIFIED" | "REJECTED";
  provenanceStatus: ProvenanceStatus;
  provenanceLabel: string;
  sourceUrl: string | null;
  isDemoFixture: boolean;
  isVerified: boolean;
};

export type SourcePriorityTier = {
  rank: number;
  name: string;
  description: string;
  labelingRule: string;
};

export const NASA_SOURCE_PRIORITY_TIERS: readonly SourcePriorityTier[] = [
  {
    rank: 1,
    name: "NASA Physical Sciences Informatics (PSI)",
    description: "Primary microgravity combustion investigation records, test matrices, and flight telemetry tables.",
    labelingRule: "Used as verified data once the source file is located.",
  },
  {
    rank: 2,
    name: "NASA Technical Reports Server (NTRS)",
    description: "Authoritative NASA technical memorandums, facility descriptions, and peer-reviewed contractor reports.",
    labelingRule: "Cited with document title, URL, page and table.",
  },
  {
    rank: 3,
    name: "NASA Task Book & Program Briefings",
    description: "Investigation objective summaries, planned campaign scopes, and PI metadata.",
    labelingRule: "Planned studies without experimental results remain tagged PLANNED — never promoted to measured data.",
  },
  {
    rank: 4,
    name: "Peer-Reviewed Archival Publications",
    description: "Published combustion journals explicitly referencing NASA flight or drop-tower test campaigns.",
    labelingRule: "Cited with exact publication metadata and primary document verification status.",
  },
  {
    rank: 5,
    name: "Third-Party Commentary / Non-NASA Datasets",
    description: "Supplementary commentary or non-NASA datasets. None are used in this index.",
    labelingRule: "Must carry explicit non-NASA provenance banners; NEVER relabeled as verified NASA measurements.",
  },
];

function formatSourceLocator(source: SourceLocator | null): string {
  if (!source) return "SOURCE LOCATOR NOT AVAILABLE";
  const parts = [
    source.sectionHeading ? `Section: ${source.sectionHeading}` : null,
    source.pageNumber ? `Page ${source.pageNumber}` : null,
    source.tableFigureLabel ?? null,
    source.rowOrRecordKey ? `Row ${source.rowOrRecordKey}` : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : "SOURCE LOCATOR NOT AVAILABLE";
}

export function buildSourceCatalogue(records: ScopeRecord[]): {
  datasetScope: DatasetScopeSummary;
  entries: SourceCatalogueEntry[];
  verifiedSourceCount: number;
} {
  const datasetScope = deriveDatasetScope(records);

  const entries: SourceCatalogueEntry[] = records.map((rec) => {
    const verified = isRecordVerified(rec);
    const src = rec.source;
    return {
      id: src?.sourceDocumentId ?? `UNATTACHED-${rec.id}`,
      investigationId: rec.id,
      investigationName: rec.name,
      family: rec.family,
      sourceTitle: src?.sourceTitle ?? "NO CONNECTED SOURCE DOCUMENT",
      documentType: src ? "Indexed Technical Source" : "NOT REPORTED / UNCONNECTED",
      publicationDate: "NOT REPORTED",
      locatorDisplay: formatSourceLocator(src),
      verificationStatus: src?.verificationStatus ?? "UNVERIFIED",
      provenanceStatus: rec.provenanceStatus,
      provenanceLabel: formatProvenanceTag(rec.provenanceStatus, src),
      sourceUrl: src?.sourceUrl ?? null,
      isDemoFixture: rec.provenanceStatus === "DEMO_FIXTURE",
      isVerified: verified,
    };
  });

  return {
    datasetScope,
    entries,
    verifiedSourceCount: entries.filter((e) => e.isVerified).length,
  };
}
