"use client";

import { mapRowsToInvestigations } from "@/lib/data/psi-mapper";
import type { InvestigationsPayload } from "@/lib/api/backend-types";
import type { TestRun } from "@/lib/api/schemas";
import { pageOfRuns, type RunListResponse } from "@/lib/data/run-stubs";

/**
 * Browser-side access to the (paged / on-demand) test runs of one investigation.
 * 1) Next route /api/investigations/{id}/runs (live FastAPI -> static snapshot on the server)
 * 2) static hosting fallback: fetch /data/investigations.json (the same snapshot) once, map and slice in the browser.
 */
let snapshot: Promise<Map<string, TestRun[]>> | null = null;
function loadSnapshotRuns(): Promise<Map<string, TestRun[]>> {
  snapshot ??= fetch("/data/investigations.json")
    .then((r) => {
      if (!r.ok) throw new Error(`snapshot ${r.status}`);
      return r.json() as Promise<InvestigationsPayload>;
    })
    .then((p) => new Map(mapRowsToInvestigations(p.rows, p.investigation_meta ?? []).map((rec) => [rec.id, rec.testRuns] as const)))
    .catch((e) => {
      snapshot = null;
      throw e;
    });
  return snapshot;
}

export async function fetchRunPage(id: string, q: string, offset: number, limit: number): Promise<RunListResponse> {
  try {
    const res = await fetch(`/api/investigations/${encodeURIComponent(id)}/runs?${new URLSearchParams({ q, offset: String(offset), limit: String(limit) })}`);
    if (!res.ok) throw new Error(`runs ${res.status}`);
    return (await res.json()) as RunListResponse;
  } catch {
    const runs = (await loadSnapshotRuns()).get(id) ?? [];
    return { ...pageOfRuns(runs, q, offset, limit), source: "static" };
  }
}

export async function fetchRunDetail(id: string, runId: string): Promise<TestRun> {
  try {
    const res = await fetch(`/api/investigations/${encodeURIComponent(id)}/runs?run=${encodeURIComponent(runId)}`);
    if (!res.ok) throw new Error(`run ${res.status}`);
    return ((await res.json()) as { run: TestRun }).run;
  } catch {
    const run = ((await loadSnapshotRuns()).get(id) ?? []).find((r) => r.id === runId);
    if (!run) throw new Error("run not found in snapshot");
    return run;
  }
}
