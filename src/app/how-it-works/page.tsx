import type { Metadata } from "next";
import { HowItWorksView } from "@/components/ecosystem/how-it-works-view";
import { investigationRepository } from "@/lib/data/repository";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "How It Works | OrbitFlame",
  description:
    "Unified methodology and scientific evidence rules: ingestion, SI unit compatibility, citation retrieval, provenance, missing data, and AI abstention.",
};

export default async function HowItWorksPage() {
  const records = await investigationRepository.list();
  return <HowItWorksView records={records} />;
}
