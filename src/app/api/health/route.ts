import { ok, NO_STORE } from "@/lib/server/http";
import { snapshot } from "@/lib/server/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const meta = await snapshot<Record<string, unknown>>("meta.json");
  return ok({ ...meta, status: "ok", mode: "built-in-api", time: new Date().toISOString() }, NO_STORE);
}
