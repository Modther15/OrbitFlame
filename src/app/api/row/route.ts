import { fail, ok } from "@/lib/server/http";
import { sourceInfo } from "@/lib/server/data";
import { findRow } from "@/lib/server/investigations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Full detail (incl. extra_metrics_json) of one test row. */
export async function GET(req: Request) {
  const uid = new URL(req.url).searchParams.get("row_uid");
  if (!uid) return fail(422, [{ loc: ["query", "row_uid"], msg: "field required", type: "missing" }]);
  const row = await findRow(uid);
  if (!row) return fail(404, `Unknown row_uid ${uid}`);
  return ok({ ...(await sourceInfo()), row });
}
