import type { Metadata } from "next";
import { TechnologyMapView } from "@/components/ecosystem/technology-map-view";
import { investigationRepository } from "@/lib/data/repository";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Technology Map | OrbitFlame",
  description: "Explore indexed combustion records grouped by Prevention, Detection, and Suppression domains.",
};

export default async function TechnologyMapPage() {
  const records = await investigationRepository.list();
  return <TechnologyMapView records={records} />;
}
