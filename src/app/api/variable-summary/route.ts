import { ok } from "@/lib/server/http";
import { snapshot } from "@/lib/server/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Item = { role: string };
type Snap = { by_psi: Record<string, Record<string, Item[]>>; [k: string]: unknown };

const ROLES = {
  controlled: "exactly 1 unique non-null value in the table",
  varied: "setpoint with > 1 unique value (exact min-max / categories listed)",
  measured: "output / sensor / derived-result column, classified from the header semantics (role_rule)",
  identifier: "test id / sample no. / run key",
  diagnostic_imaging: "camera / imaging / gain / display-readout / date-GMT / file-path / operator-log columns: NOT experimental variables (rule id + matched header in role_rule)",
};

/** Controlled / varied / measured variables per PSI id, computed from the real tables. Optional ?psi_id= and ?role= filters. */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const psi = q.get("psi_id")?.toLowerCase();
  const role = q.get("role");
  const snap = await snapshot<Snap>("variable_summary.json");
  const by: Record<string, Record<string, Item[]>> = {};
  let n = 0;
  for (const [id, groups] of Object.entries(snap.by_psi)) {
    if (psi && id.toLowerCase() !== psi) continue;
    const g = Object.fromEntries(Object.entries(groups).map(([r, items]) => [r, role && r !== role ? [] : items]));
    const count = Object.values(g).reduce((a, items) => a + items.length, 0);
    if (role && count === 0) continue;
    by[id] = g;
    n += count;
  }
  return ok({ ...snap, n_columns: n, by_psi: by, roles: ROLES });
}
