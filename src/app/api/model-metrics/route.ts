import { ok } from "@/lib/server/http";
import { snapshot } from "@/lib/server/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return ok(await snapshot("model_metrics.json"));
}
