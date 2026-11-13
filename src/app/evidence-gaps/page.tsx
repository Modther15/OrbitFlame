import type { Metadata } from "next";
import { EvidenceGapsView } from "@/components/gaps/evidence-gaps-view";
import { investigationRepository } from "@/lib/data/repository";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Evidence Gap Radar | OrbitFlame",
  description: "Inspect indexed evidence coverage across gravity regimes and safety domains without fabricating coverage.",
};

export default async function EvidenceGapsPage() {
  const records = await investigationRepository.list();
  return <EvidenceGapsView records={records} />;
}
