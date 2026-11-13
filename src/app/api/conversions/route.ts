import { ok } from "@/lib/server/http";
import { snapshot } from "@/lib/server/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Snap = { conversions: Array<{ status?: string }>; [k: string]: unknown };

/** Unit-conversion ledger: every conversion applied (or refused) with the header evidence. Optional ?status= filter. */
export async function GET(req: Request) {
  const status = new URL(req.url).searchParams.get("status");
  const snap = await snapshot<Snap>("conversions.json");
  const conversions = status ? snap.conversions.filter((c) => c.status === status) : snap.conversions;
  return ok({ ...snap, n: conversions.length, conversions });
}
