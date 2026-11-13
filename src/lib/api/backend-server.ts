import { readFile } from "node:fs/promises";
import path from "node:path";
import { loadWithFallback, type Loaded } from "@/lib/api/backend-core";
import type { HabitatsPayload, InvestigationsPayload, MetaPayload, RankAllPayload } from "@/lib/api/backend-types";

const snapshotDir = path.join(process.cwd(), "public", "data");
async function loadSnapshot(file: string): Promise<unknown> {
  return JSON.parse(await readFile(path.join(snapshotDir, file), "utf8"));
}

/** Server-side data access (RSC / route handlers): live API -> static snapshot on disk. */
export const serverBackend = {
  investigations: (): Promise<Loaded<InvestigationsPayload>> => loadWithFallback("/api/investigations?limit=5000", "investigations.json", loadSnapshot),
  habitats: (): Promise<Loaded<HabitatsPayload>> => loadWithFallback("/api/habitats", "habitats.json", loadSnapshot),
  rankings: (): Promise<Loaded<RankAllPayload>> => loadWithFallback("/api/rank/all", "rankings.json", loadSnapshot),
  meta: (): Promise<Loaded<MetaPayload>> => loadWithFallback("/api/health", "meta.json", loadSnapshot),
};
