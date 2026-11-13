import type { Metadata } from "next";
import { MissionLabView } from "@/components/mission/mission-lab-view";
import { isOpenAiConfigured } from "@/lib/assistant/assistant-provider";
import { investigationRepository } from "@/lib/data/repository";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Mission Lab | OrbitFlame",
  description: "Match hypothetical mission environments against indexed combustion evidence with explicit evidence boundaries.",
};

export default async function MissionLabPage({
  searchParams,
}: {
  searchParams: Promise<{ habitat?: string }>;
}) {
  const [records, params] = await Promise.all([investigationRepository.list(), searchParams]);
  return (
    <MissionLabView
      records={records}
      isAiConfigured={isOpenAiConfigured()}
      initialHabitat={params.habitat?.toUpperCase()}
    />
  );
}
