"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { loadEffectiveGravity, loadHabitats, loadRankingsTop } from "@/lib/api/backend-client";
import type { DataSourceMode, EffectiveGravityPayload, HabitatInfo, RankAllPayload } from "@/lib/api/backend-types";
import type { HAB_KEYS } from "@/components/mission/habitat-keys";

const MissionPredictorPanel = dynamic(
  () => import("@/components/mission/mission-predictor-panel").then((m) => m.MissionPredictorPanel),
  { ssr: false },
);

/** Fetches habitats + top-N rankings on mount (shared once-per-page promises) instead of embedding them in the RSC payload. */
export function MissionPredictorLazy({ initialHabitat, dataSource, metadataOnly, totalInvestigations }: { initialHabitat: (typeof HAB_KEYS)[number]; dataSource: DataSourceMode; metadataOnly: { id: string; name: string }[]; totalInvestigations: number }) {
  const [habitats, setHabitats] = useState<HabitatInfo[]>([]);
  const [rankings, setRankings] = useState<RankAllPayload | null>(null);
  const [ladder, setLadder] = useState<EffectiveGravityPayload | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    loadHabitats()
      .then((r) => alive && setHabitats(r.data.habitats))
      .catch(() => alive && setFailed(true));
    loadEffectiveGravity()
      .then((r) => alive && setLadder(r.data))
      .catch(() => undefined);
    loadRankingsTop()
      .then((r) => alive && setRankings(r.data))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  if (failed) return null;
  if (habitats.length === 0) {
    return <div className="h-72 animate-pulse rounded-2xl border border-white/10 bg-[#09152e]/60" aria-hidden="true" />;
  }
  return <MissionPredictorPanel habitats={habitats} rankings={rankings} ladder={ladder} initialHabitat={initialHabitat} dataSource={dataSource} metadataOnly={metadataOnly} totalInvestigations={totalInvestigations} />;
}
