import { fail, ok } from "@/lib/server/http";
import { snapshot } from "@/lib/server/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Audit = { candidates: Array<{ id: string }>; [k: string]: unknown };

export async function GET(req: Request) {
  const candidate = new URL(req.url).searchParams.get("candidate");
  const audit = await snapshot<Audit>("model_audit.json");
  if (!candidate) return ok(audit);
  const candidates = audit.candidates.filter((c) => c.id === candidate);
  if (!candidates.length) return fail(404, `unknown candidate ${candidate}`);
  return ok({ ...audit, candidates });
}
