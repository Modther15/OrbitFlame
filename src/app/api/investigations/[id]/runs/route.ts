import { NextResponse } from "next/server";
import { investigationRepository, getDatasetSource } from "@/lib/data/repository";
import { pageOfRuns, RUN_PAGE_SIZE } from "@/lib/data/run-stubs";

export const runtime = "nodejs";

/**
 * Paged / searchable test runs of one investigation (lean stubs), or the full evidence for one run (?run=<runId>).
 * Backed by the live API with automatic fallback to the static snapshot (see lib/data/repository.ts).
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const record = await investigationRepository.getById(id);
  if (!record) return NextResponse.json({ error: "not found" }, { status: 404 });
  const url = new URL(req.url);
  const runId = url.searchParams.get("run");
  const headers = { "Cache-Control": "public, max-age=30, stale-while-revalidate=120" };
  if (runId) {
    const run = record.testRuns.find((r) => r.id === runId);
    if (!run) return NextResponse.json({ error: "run not found" }, { status: 404 });
    return NextResponse.json({ run, source: record.source }, { headers });
  }
  const q = url.searchParams.get("q") ?? "";
  const offset = Number.parseInt(url.searchParams.get("offset") ?? "0", 10) || 0;
  const limit = Math.min(200, Math.max(1, Number.parseInt(url.searchParams.get("limit") ?? String(RUN_PAGE_SIZE), 10) || RUN_PAGE_SIZE));
  return NextResponse.json({ ...pageOfRuns(record.testRuns, q, offset, limit), source: await getDatasetSource() }, { headers });
}
