import { intParam, ok } from "@/lib/server/http";
import { snapshot, sourceInfo } from "@/lib/server/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Snap = { title: string; samer_psi101_rows: unknown[]; same_psi102_rows: unknown[] };

/** Real SAME-R (PSI-101) and SAME (PSI-102) test rows with their measured outcomes (Rt/R0, weight-loss rate). */
export async function GET(req: Request) {
  const limit = intParam(new URL(req.url), "limit", 200, 1, 500);
  if (typeof limit !== "number") return limit;
  const s = await snapshot<Snap>("smoke_dust_examples.json");
  return ok({ ...(await sourceInfo()), title: s.title, samer_psi101_rows: s.samer_psi101_rows.slice(0, limit), same_psi102_rows: s.same_psi102_rows });
}
