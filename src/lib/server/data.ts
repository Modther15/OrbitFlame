/** Server-side access to the committed snapshots in public/data (cached in memory per server process). */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { sourceInfoFrom, type SourceInfo } from "@/lib/engine/service";
import type { PredictorBundle } from "@/lib/engine/predictor";
import type { HabitatProfile } from "@/lib/engine/physics";

const dir = path.join(process.cwd(), "public", "data");
type Cache = Map<string, Promise<unknown>>;
const g = globalThis as unknown as { __orbitflameSnap?: Cache };
const cache: Cache = (g.__orbitflameSnap ??= new Map());

export function snapshot<T = unknown>(file: string): Promise<T> {
  let p = cache.get(file);
  if (!p) {
    p = readFile(path.join(dir, file), "utf8").then((t) => JSON.parse(t) as unknown);
    p.catch(() => cache.delete(file));
    cache.set(file, p);
  }
  return p as Promise<T>;
}

export async function sourceInfo(): Promise<SourceInfo> {
  return sourceInfoFrom(await snapshot<Record<string, unknown>>("meta.json"));
}
export const predictorBundle = () => snapshot<PredictorBundle>("predictor_bundle.json");

export async function habitatProfiles(): Promise<Record<string, HabitatProfile>> {
  const h = await snapshot<{ habitats: Array<HabitatProfile & { key: string }> }>("habitats.json");
  return Object.fromEntries(h.habitats.map((x) => [x.key, x]));
}
