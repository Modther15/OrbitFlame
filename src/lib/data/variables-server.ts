import { readFile } from "node:fs/promises";
import path from "node:path";
import { fetchLive } from "@/lib/api/backend-core";
import type { Loaded } from "@/lib/api/backend-core";
import type { VarSummaryPayload } from "@/lib/data/variables";

let cache: { at: number; value: Loaded<VarSummaryPayload> } | null = null;

/** Server-side: live /api/variable-summary, else the static snapshot public/data/variable_summary.json. Cached 2 minutes. */
export async function loadVariableSummaryServer(): Promise<Loaded<VarSummaryPayload>> {
  if (cache && Date.now() - cache.at < 120_000) return cache.value;
  let value: Loaded<VarSummaryPayload>;
  try {
    value = { data: await fetchLive<VarSummaryPayload>("/api/variable-summary"), source: "live" };
  } catch {
    const snap = JSON.parse(await readFile(path.join(process.cwd(), "public", "data", "variable_summary.json"), "utf8")) as VarSummaryPayload;
    value = { data: snap, source: "static" };
  }
  cache = { at: Date.now(), value };
  return value;
}
