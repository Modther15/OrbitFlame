import { snapshot, sourceInfo } from "@/lib/server/data";

type Row = Record<string, unknown>;
type InvPayload = { rows: Row[]; investigation_meta: unknown[] };

export type RowQuery = { psi_id: string | null; pillar: string | null; fuel_phase: string | null; q: string | null; limit: number; offset: number };

const eq = (v: unknown, want: string) => String(v ?? "").toLowerCase() === want.toLowerCase();

export async function listRows(query: RowQuery) {
  const snap = await snapshot<InvPayload>("investigations.json");
  let rows = snap.rows;
  if (query.psi_id) rows = rows.filter((r) => eq(r.psi_id, query.psi_id as string));
  if (query.pillar) rows = rows.filter((r) => eq(r.pillar, query.pillar as string));
  if (query.fuel_phase) rows = rows.filter((r) => eq(r.fuel_phase, query.fuel_phase as string));
  if (query.q) {
    const t = query.q.toLowerCase();
    rows = rows.filter((r) => ["psi_id", "investigation", "fuel", "test_id", "hardware", "pillar"].map((k) => String(r[k] ?? "")).join(" ").toLowerCase().includes(t));
  }
  return {
    ...(await sourceInfo()),
    total: rows.length,
    limit: query.limit,
    offset: query.offset,
    rows: rows.slice(query.offset, query.offset + query.limit),
    investigation_meta: snap.investigation_meta,
  };
}

export async function findRow(rowUid: string): Promise<Row | null> {
  const snap = await snapshot<InvPayload>("investigations.json");
  return snap.rows.find((r) => r.row_uid === rowUid) ?? null;
}
