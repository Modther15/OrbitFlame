import type { Metadata } from "next";
import { EvidenceGapsView } from "@/components/gaps/evidence-gaps-view";
import { listSummaries } from "@/lib/data/repository";
import { buildEvidenceGapRadar } from "@/lib/science/evidence-gaps";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Evidence Gap Radar | OrbitFlame",
  description: "Inspect indexed evidence coverage across gravity regimes and safety domains without fabricating coverage.",
};

export default async function EvidenceGapsPage() {
  const records = await listSummaries();
  const radar = buildEvidenceGapRadar(records);
  const bins: [string, string][] = [["lunar_eq", "~0.16 g eq. (Lunar)"], ["mars_eq", "~0.38 g eq. (Mars)"], ["earth_eq", "~1.0 g eq. (Earth)"]];
  const proxyNotes = bins
    .map(([bin, label]) => {
      const inv = records.filter((r) => (r.gravityInfo?.proxyBins[bin] ?? 0) > 0).map((r) => ({ id: r.id, n: r.gravityInfo!.proxyBins[bin] }));
      return { label, rows: inv.reduce((n, i) => n + i.n, 0), investigations: inv };
    })
    .filter((n) => n.rows > 0);
  return <EvidenceGapsView radar={radar} proxyNotes={proxyNotes} />;
}
