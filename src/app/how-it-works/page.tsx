import type { Metadata } from "next";
import { HowItWorksView } from "@/components/ecosystem/how-it-works-view";
import { listSummaries } from "@/lib/data/repository";
import { deriveDatasetScope } from "@/lib/science/provenance";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "How It Works | OrbitFlame",
  description:
    "Unified methodology and scientific evidence rules: ingestion, SI unit compatibility, citation retrieval, provenance, missing data, and AI abstention.",
};

export default async function HowItWorksPage() {
  const records = await listSummaries();
  const datasetScope = deriveDatasetScope(records);
  return <HowItWorksView datasetScope={datasetScope} />;
}
