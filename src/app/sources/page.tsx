import type { Metadata } from "next";
import { SourceCatalogueView } from "@/components/ecosystem/source-catalogue-view";
import { investigationRepository } from "@/lib/data/repository";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Research Library & Source Governance | OrbitFlame",
  description: "Indexed research library, source locators, NASA source governance hierarchy, and dry-run dataset validation.",
};

export default async function SourcesPage() {
  const records = await investigationRepository.list();
  return <SourceCatalogueView records={records} />;
}
