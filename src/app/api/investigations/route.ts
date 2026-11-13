import { intParam, ok } from "@/lib/server/http";
import { listRows } from "@/lib/server/investigations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const limit = intParam(url, "limit", 1000, 1, 5000);
  const offset = intParam(url, "offset", 0, 0, Number.MAX_SAFE_INTEGER);
  if (typeof limit !== "number") return limit;
  if (typeof offset !== "number") return offset;
  const q = url.searchParams;
  return ok(await listRows({ psi_id: q.get("psi_id"), pillar: q.get("pillar"), fuel_phase: q.get("fuel_phase"), q: q.get("q"), limit, offset }));
}
