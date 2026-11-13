import { ok, parseBody } from "@/lib/server/http";
import { RankRequestSchema } from "@/lib/engine/schemas";
import { rankPayload } from "@/lib/server/rank";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST alias of GET /api/rank: ranked investigations + similarity breakdown for one habitat. */
export async function POST(req: Request) {
  const body = await parseBody(req, RankRequestSchema);
  if ("response" in body) return body.response;
  const r = await rankPayload(body.data.habitat, body.data.top);
  return r.error ?? ok(r.payload);
}
