import type { SourceLocator, TestRun } from "@/lib/api/schemas";

/**
 * Lean projection of a TestRun for list views. The full run (source locators, every measurement) is fetched on demand
 * (GET /api/investigations/{id}/runs?run=...) so the investigation page HTML never carries per-row evidence payloads.
 */
export type RunStubCondition = { k: string; v: number | null; t: string | null; u: string | null; m: string };
export type RunStub = {
  id: string;
  key: string | null; // "file · sheet · row n"
  label: string;
  variant: string | null;
  conds: RunStubCondition[];
  nMeas: number; // present measurements (count only)
};

export const RUN_PAGE_SIZE = 50;

export function toStub(run: TestRun): RunStub {
  return {
    id: run.id,
    key: run.sourceRunKey,
    label: run.label,
    variant: run.objectiveVariant,
    conds: run.conditions.filter((c) => c.parameterKey !== "oxygen_basis").map((c) => ({ k: c.parameterKey, v: c.valueOriginal, t: c.textOriginal, u: c.unitOriginal, m: c.missingStatus })),
    nMeas: run.measurements.filter((m) => m.missingStatus === "PRESENT").length,
  };
}

export type RunListResponse = {
  /** All runs of the investigation (unfiltered). */
  total: number;
  /** Runs matching `q`. */
  matched: number;
  offset: number;
  limit: number;
  runs: RunStub[];
  source: "live" | "local" | "static" | "fixture";
};
export type RunDetailResponse = { run: TestRun; source: SourceLocator | null };

export function runSearchText(run: TestRun): string {
  return `${run.id} ${run.sourceRunKey ?? ""} ${run.label} ${run.objectiveVariant ?? ""}`.toLocaleLowerCase();
}

export function filterRuns(runs: TestRun[], q: string): TestRun[] {
  const term = q.trim().toLocaleLowerCase();
  if (!term) return runs;
  return runs.filter((r) => runSearchText(r).includes(term));
}

export function pageOfRuns(runs: TestRun[], q: string, offset: number, limit: number): Omit<RunListResponse, "source"> {
  const matched = filterRuns(runs, q);
  const o = Math.max(0, Math.min(offset, Math.max(0, matched.length - 1)));
  return { total: runs.length, matched: matched.length, offset: o, limit, runs: matched.slice(o, o + limit).map(toStub) };
}
