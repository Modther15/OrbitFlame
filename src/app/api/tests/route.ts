import { intParam, ok } from "@/lib/server/http";
import { listRows } from "@/lib/server/investigations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Test rows, filtered by PSI id and a free-text fuel / test search (same as the research backend's /api/tests). */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = intParam(url, "limit", 500, 1, 5000);
  const offset = intParam(url, "offset", 0, 0, Number.MAX_SAFE_INTEGER);
  if (typeof limit !== "number") return limit;
  if (typeof offset !== "number") return offset;
  return ok(await listRows({ psi_id: url.searchParams.get("psi_id"), pillar: null, fuel_phase: null, q: url.searchParams.get("fuel"), limit, offset }));
}
