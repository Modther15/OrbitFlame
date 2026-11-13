import { intParam, ok } from "@/lib/server/http";
import { rankPayload } from "@/lib/server/rank";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const topRaw = url.searchParams.get("top");
  const top = topRaw ? intParam(url, "top", 0, 1, Number.MAX_SAFE_INTEGER) : null;
  if (typeof top !== "number" && top !== null) return top;
  const r = await rankPayload(url.searchParams.get("habitat") || "iss", top);
  return r.error ?? ok(r.payload);
}
