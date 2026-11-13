import { intParam, ok } from "@/lib/server/http";
import { rankAllPayload } from "@/lib/server/rank";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const topRaw = url.searchParams.get("top");
  const top = topRaw ? intParam(url, "top", 0, 1, Number.MAX_SAFE_INTEGER) : null;
  if (typeof top !== "number" && top !== null) return top;
  return ok(await rankAllPayload(top));
}
