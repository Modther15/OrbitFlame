import type { Metadata } from "next";
import { TechnologyMapView } from "@/components/ecosystem/technology-map-view";
import { listSummaries } from "@/lib/data/repository";
import { buildEvidenceGapRadar } from "@/lib/science/evidence-gaps";
import { buildTechnologyMap } from "@/lib/science/technology-map";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Technology Map | OrbitFlame",
  description: "Combustion investigations grouped by Prevention, Detection and Suppression, with coverage gaps by gravity level.",
};

export default async function TechnologyMapPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  const records = await listSummaries();
  const report = buildTechnologyMap(records);
  const radar = buildEvidenceGapRadar(records);
  const bins: [string, string][] = [["lunar_eq", "~0.16 g eq. (Lunar)"], ["mars_eq", "~0.38 g eq. (Mars)"], ["earth_eq", "~1.0 g eq. (Earth)"]];
  const proxyNotes = bins
    .map(([bin, label]) => {
      const inv = records.filter((r) => (r.gravityInfo?.proxyBins[bin] ?? 0) > 0).map((r) => ({ id: r.id, n: r.gravityInfo!.proxyBins[bin] }));
      return { label, rows: inv.reduce((n, i) => n + i.n, 0), investigations: inv };
    })
    .filter((n) => n.rows > 0);
  return <TechnologyMapView report={report} radar={radar} proxyNotes={proxyNotes} initialTab={tab === "gaps" ? "gaps" : "jobs"} />;
}
