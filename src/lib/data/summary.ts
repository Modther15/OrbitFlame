import type { DemoInvestigation, TestRun } from "@/lib/api/schemas";
import { isSourceLocatorVerified } from "@/lib/science/provenance";

const LEAD_KEYS = ["oxygen_concentration", "pressure", "airflow"] as const;

/**
 * List-view investigation: everything except the (large) testRuns/measurements arrays, plus precomputed counts.
 * `leadRuns` are minimal run stubs (first run + the first run carrying each of O2/pressure/airflow, reduced to that
 * one condition) so condition extraction gives identical results to the full record.
 */
export type InvestigationSummary = Omit<DemoInvestigation, "testRuns"> & {
  testRunCount: number;
  presentMeasurementCount: number;
  leadRuns: TestRun[];
  /** Precomputed run-level evidence counts for dataset-scope banners. */
  runSourceDocIds: string[];
  runVerifiedSpanCount: number;
};

export function toSummary(rec: DemoInvestigation): InvestigationSummary {
  const { testRuns, ...rest } = rec;
  let present = 0;
  let verifiedSpans = 0;
  const docIds = new Set<string>();
  const tally = (src: { sourceDocumentId: string } | null) => {
    if (!src) return;
    docIds.add(src.sourceDocumentId);
    if (isSourceLocatorVerified(src as Parameters<typeof isSourceLocatorVerified>[0])) verifiedSpans += 1;
  };
  for (const run of testRuns) {
    run.conditions.forEach((c) => tally(c.source));
    for (const m of run.measurements) {
      if (m.missingStatus === "PRESENT") present += 1;
      tally(m.source);
    }
  }

  const picked = new Map<string, { run: TestRun; keys: Set<string> }>();
  const add = (run: TestRun, keys: string[]) => {
    const e = picked.get(run.id) ?? { run, keys: new Set<string>() };
    keys.forEach((k) => e.keys.add(k));
    picked.set(run.id, e);
  };
  if (testRuns[0]) add(testRuns[0], []);
  for (const key of LEAD_KEYS) {
    const run = testRuns.find((r) => r.conditions.some((c) => c.parameterKey === key));
    if (run) add(run, [key]);
  }
  const leadRuns: TestRun[] = testRuns
    .filter((r) => picked.has(r.id))
    .map((r) => {
      const keys = picked.get(r.id)!.keys;
      const conditions = [...keys].map((k) => r.conditions.find((c) => c.parameterKey === k)!).filter(Boolean);
      return { ...r, label: r.label, sourceRunKey: null, objectiveVariant: null, conditions, measurements: [] };
    });
  return { ...rest, testRunCount: testRuns.length, presentMeasurementCount: present, leadRuns, runSourceDocIds: [...docIds], runVerifiedSpanCount: verifiedSpans };
}
