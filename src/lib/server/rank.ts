import { HABITAT_KEYS, resolveHabitatKey } from "@/lib/engine/physics";
import { fail } from "@/lib/server/http";
import { snapshot } from "@/lib/server/data";

type RankPayload = { ranked: unknown[]; [k: string]: unknown };
type RankSnapshot = { habitats: Record<string, RankPayload>; [k: string]: unknown };

/** Ranked investigations + similarity component breakdown for one habitat (precomputed over every real test row). */
export async function rankPayload(habitat: string, top: number | null) {
  const key = resolveHabitatKey(habitat);
  if (!key) return { error: fail(404, `Unknown habitat ${habitat.trim().toLowerCase()}; use one of [${HABITAT_KEYS.join(", ")}]`) };
  const snap = await snapshot<RankSnapshot>("rankings.json");
  const r = snap.habitats[key];
  return { payload: top ? { ...r, ranked: r.ranked.slice(0, top) } : r };
}

export async function rankAllPayload(top: number | null) {
  const snap = await snapshot<RankSnapshot>("rankings.json");
  const habitats = Object.fromEntries(Object.entries(snap.habitats).map(([k, r]) => [k, top ? { ...r, ranked: r.ranked.slice(0, top) } : r]));
  return { ...snap, habitats };
}
