import type { DatasetSummary } from "@/lib/api/schemas";

/** Deliberately empty fixture: there is no supplied NASA dataset or API contract yet. */
export const mockApi = {
  async getDatasetSummary(): Promise<DatasetSummary> {
    return {
      investigationCount: null,
      testRunCount: null,
      sourceDocumentCount: 0,
      verifiedEvidenceSpanCount: 0,
      datasetVersion: null,
      collectionStatus: "EMPTY",
    };
  },
};
