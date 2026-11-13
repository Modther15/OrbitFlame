import type { Metadata } from "next";
import { TechnologyMapView } from "@/components/ecosystem/technology-map-view";
import { listSummaries } from "@/lib/data/repository";
import { buildTechnologyMap } from "@/lib/science/technology-map";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Technology Map | OrbitFlame",
  description: "Explore indexed combustion records grouped by Prevention, Detection, and Suppression domains.",
};

export default async function TechnologyMapPage() {
  const records = await listSummaries();
  const report = buildTechnologyMap(records);
  return <TechnologyMapView report={report} />;
}
