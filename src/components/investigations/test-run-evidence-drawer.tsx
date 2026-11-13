"use client";

import { Activity, AlertTriangle, CheckCircle2, Database, FileSearch, FlaskConical, ShieldAlert, X } from "lucide-react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import type { Condition, Measurement, MissingStatus, ProvenanceStatus, SourceLocator, TestRun } from "@/lib/api/schemas";
import { RUN_PAGE_SIZE, type RunStub, type RunStubCondition } from "@/lib/data/run-stubs";
import { fetchRunDetail, fetchRunPage } from "@/lib/data/runs-client";

/** Conditions folded into the gravity badges instead of being listed as chips. */
const HIDDEN_CHIP_KEYS = new Set(["gravity_value", "gravity", "effective_gravity", "effective_gravity_method", "gravity_source"]);

type TestRunEvidenceSectionProps = {
  investigationId: string;
  investigationName: string;
  investigationSource: SourceLocator | null;
  fixtureLabel?: string;
  /** Total number of runs in the investigation (the page itself only carries the first RUN_PAGE_SIZE stubs). */
  totalRuns: number;
  initialRuns: RunStub[];
};

const PARAMETER_LABELS: Record<string, string> = {
  oxygen_concentration: "Oxygen concentration",
  pressure: "Pressure",
  airflow: "Airflow",
  gravity: "Actual gravity (flight baseline)",
  gravity_value: "Actual gravity (value)",
  effective_gravity: "Effective gravity (HEURISTIC PROXY)",
  effective_gravity_method: "Effective-gravity method",
  gravity_source: "Gravity source",
  co2_mole_fraction: "CO2 mole fraction",
  he_mole_fraction: "He mole fraction",
};

const MISSING_LABELS: Record<MissingStatus, string> = {
  PRESENT: "PRESENT",
  NOT_REPORTED: "NOT REPORTED",
  NOT_APPLICABLE: "NOT APPLICABLE",
  UNKNOWN: "UNKNOWN",
  AMBIGUOUS: "AMBIGUOUS",
};

function formatParameterName(key: string): string {
  if (PARAMETER_LABELS[key]) return PARAMETER_LABELS[key];
  return key
    .split("_")
    .map((part) => (part ? part[0].toUpperCase() + part.slice(1) : ""))
    .join(" ");
}

function toStatusBadgeValue(status: ProvenanceStatus, source: SourceLocator | null): "verified" | "demo" | "benchmark" | "direct" | "unverified" | "not-reported" {
  if (status === "NASA_VERIFIED_DATA" && source?.verificationStatus === "VERIFIED") return "verified";
  if (status === "DEMO_FIXTURE") return "demo";
  if (status === "PSI_DIRECT_EXPORT") return "direct";
  if (status === "NOT_REPORTED") return "not-reported";
  return "unverified";
}

function formatConditionValue(condition: Condition): string {
  if (condition.missingStatus !== "PRESENT") {
    return MISSING_LABELS[condition.missingStatus];
  }
  if (condition.valueOriginal !== null) {
    return condition.unitOriginal ? `${condition.valueOriginal} ${condition.unitOriginal}` : `${condition.valueOriginal}`;
  }
  if (condition.textOriginal !== null) {
    return condition.textOriginal;
  }
  return "NOT REPORTED";
}

function formatStubCondition(c: RunStubCondition): string {
  if (c.m !== "PRESENT") return MISSING_LABELS[c.m as MissingStatus] ?? "NOT REPORTED";
  if (c.v !== null) return c.u ? `${c.v} ${c.u}` : `${c.v}`;
  return c.t ?? "NOT REPORTED";
}

function formatMeasurementValue(measurement: Measurement): string {
  if (measurement.missingStatus !== "PRESENT") {
    return MISSING_LABELS[measurement.missingStatus];
  }
  if (measurement.valueOriginal !== null) {
    return measurement.unitOriginal ? `${measurement.valueOriginal} ${measurement.unitOriginal}` : `${measurement.valueOriginal}`;
  }
  if (measurement.textOriginal !== null) {
    return measurement.textOriginal;
  }
  return "NOT REPORTED";
}

function formatSourceSummary(source: SourceLocator | null): string {
  if (!source) return "No source locator attached";
  const parts = [source.sourceTitle];
  if (source.pageNumber) parts.push(`p. ${source.pageNumber}`);
  if (source.tableFigureLabel) parts.push(source.tableFigureLabel);
  if (source.rowOrRecordKey) parts.push(`row ${source.rowOrRecordKey}`);
  return parts.join(" · ");
}

function renderStatusChip(
  missingStatus: MissingStatus,
  provenanceStatus: ProvenanceStatus,
  itemSource: SourceLocator | null,
  parentSource: SourceLocator | null,
) {
  if (missingStatus !== "PRESENT") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/35 bg-amber-400/10 px-2.5 py-0.5 font-mono text-[10px] font-semibold tracking-wider text-amber-300">
        {MISSING_LABELS[missingStatus]}
      </span>
    );
  }
  if (provenanceStatus === "DEMO_FIXTURE") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-sky-400/35 bg-sky-400/10 px-2.5 py-0.5 font-mono text-[10px] font-semibold tracking-wider text-sky-300">
        DEMO ONLY
      </span>
    );
  }
  if (provenanceStatus === "PSI_DIRECT_EXPORT") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/35 bg-emerald-400/15 px-2.5 py-0.5 font-mono text-[10px] font-semibold tracking-wider text-emerald-300">
        PSI DIRECT EXPORT
      </span>
    );
  }
  const effectiveSource = itemSource ?? parentSource;
  if (provenanceStatus === "NASA_VERIFIED_DATA" && effectiveSource?.verificationStatus === "VERIFIED") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/35 bg-emerald-400/15 px-2.5 py-0.5 font-mono text-[10px] font-semibold tracking-wider text-emerald-300">
        <CheckCircle2 size={11} aria-hidden="true" /> VERIFIED
      </span>
    );
  }
  if (provenanceStatus === "NASA_VERIFIED_DATA") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/35 bg-amber-400/10 px-2.5 py-0.5 font-mono text-[10px] font-semibold tracking-wider text-amber-300">
        UNVERIFIED SOURCE
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/10 px-2.5 py-0.5 font-mono text-[10px] font-semibold tracking-wider text-[#d8e6fa]">
      {provenanceStatus}
    </span>
  );
}

export function TestRunEvidenceSection({
  investigationId,
  investigationName,
  investigationSource,
  totalRuns,
  initialRuns,
}: TestRunEvidenceSectionProps) {
  const [runs, setRuns] = useState<RunStub[]>(initialRuns);
  const [matched, setMatched] = useState(totalRuns);
  const [offset, setOffset] = useState(0);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(initialRuns.length === 0 && totalRuns > 0);
  const [listError, setListError] = useState<string | null>(null);
  const [selected, setSelected] = useState<RunStub | null>(null);
  const [detail, setDetail] = useState<TestRun | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const reqSeq = useRef(0);
  const sectionRef = useRef<HTMLDivElement>(null);

  const load = (q: string, off: number) => {
    const seq = ++reqSeq.current;
    setBusy(true);
    setListError(null);
    fetchRunPage(investigationId, q, off, RUN_PAGE_SIZE)
      .then((res) => {
        if (seq !== reqSeq.current) return;
        setRuns(res.runs);
        setMatched(res.matched);
        setOffset(res.offset);
      })
      .catch((e: unknown) => {
        if (seq === reqSeq.current) setListError(e instanceof Error ? e.message : "could not load runs");
      })
      .finally(() => {
        if (seq === reqSeq.current) setBusy(false);
      });
  };

  // debounced server/snapshot search (the first page is already in the HTML)
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      // the page HTML carries no run rows (keeps /investigations/* small): the first page is fetched on mount
      if (initialRuns.length === 0 && totalRuns > 0) load("", 0);
      return;
    }
    const t = setTimeout(() => load(query, 0), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const openRun = (stub: RunStub) => {
    setSelected(stub);
    setDetail(null);
    setDetailError(null);
    fetchRunDetail(investigationId, stub.id)
      .then(setDetail)
      .catch((e: unknown) => setDetailError(e instanceof Error ? e.message : "could not load run evidence"));
  };
  const closeRun = () => {
    setSelected(null);
    setDetail(null);
    setDetailError(null);
  };

  useEffect(() => {
    if (!selected) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeRun();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selected]);

  const from = matched === 0 ? 0 : offset + 1;
  const to = Math.min(matched, offset + RUN_PAGE_SIZE);
  const go = (off: number) => {
    load(query, off);
    sectionRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  };

  return (
    <>
      <Card className="mt-6 border border-white/10 bg-[#09152e]/80 p-6 backdrop-blur-md">
        <div ref={sectionRef} className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <h2 className="text-lg font-extrabold tracking-tight text-[#f4f8ff]">Test Runs ({totalRuns.toLocaleString("en-US")})</h2>
            <p className="mt-1 text-xs text-[#8ea5c7]">
              Conditions and measurements for each run. Open a run to see every value and its source row.
            </p>
          </div>
        </div>

        {totalRuns === 0 ? (
          <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-5 text-sm text-[#9cb2d2]">
            <p className="font-semibold text-[#f4f8ff]">Metadata only</p>
            <p className="mt-1">PSI publishes no per-test table for this investigation, so no runs are listed. The objective and hardware above come from its investigation record.</p>
          </div>
        ) : (
          <>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <label className="run-search">
                <Search size={14} aria-hidden="true" />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by run, material or row…"
                  aria-label="Search test runs"
                />
              </label>
              <div className="flex items-center gap-2 font-mono text-[11px] text-[#8ea5c7]" data-testid="run-pager">
                <span data-testid="run-range">
                  {matched === 0 ? "0 runs" : `${from}–${to} of ${matched}`}
                  {query.trim() ? ` (filtered from ${totalRuns})` : ""}
                </span>
                <button type="button" className="run-pg" disabled={busy || offset === 0} onClick={() => go(Math.max(0, offset - RUN_PAGE_SIZE))} aria-label="Previous page">
                  <ChevronLeft size={14} />
                </button>
                <button type="button" className="run-pg" disabled={busy || offset + RUN_PAGE_SIZE >= matched} onClick={() => go(offset + RUN_PAGE_SIZE)} aria-label="Next page">
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
            {listError && <p className="mt-3 text-xs text-amber-300">Could not load runs: {listError}</p>}
            {busy && runs.length === 0 && <p className="mt-4 font-mono text-xs text-[#8ea5c7]" role="status">Loading the first {RUN_PAGE_SIZE} of {totalRuns} runs…</p>}
            {matched === 0 && !busy ? (
              <p className="mt-4 text-sm text-[#9cb2d2]">No runs match this search.</p>
            ) : (
              <ul className="mt-4 grid gap-3" aria-busy={busy}>
                {runs.map((run) => {
                  const vis = run.conds.filter((c) => !HIDDEN_CHIP_KEYS.has(c.k) || c.k === "gravity");
                  const present = vis.filter((c) => c.m === "PRESENT").length;
                  const missing = vis.length - present;
                  return (
                    <li key={run.id} className="run-row">
                      <div className="min-w-0 flex-1">
                        <p className="run-id">
                          {run.id} <span className="run-key">· {run.key ? run.key.replace(/^PSI-\d+_/, "").replace(/_/g, " ") : "Source row not reported"}</span>
                        </p>
                        <h3 className="run-title">{run.label}</h3>
                        {run.variant && <p className="run-variant">{run.variant}</p>}
                        <p className="mt-2 flex flex-wrap gap-1.5">
                          {run.conds.filter((c) => !HIDDEN_CHIP_KEYS.has(c.k)).map((c) => (
                            <span key={c.k} className={c.m === "PRESENT" ? "rc" : "rc rc-miss"}>
                              <span className="rc-k">{formatParameterName(c.k)}:</span> {formatStubCondition(c)}
                            </span>
                          ))}
                        </p>
                        <p className="run-meta">{`${missing > 0 ? `${missing} condition${missing === 1 ? "" : "s"} not reported · ` : ""}${run.nMeas} measurement${run.nMeas === 1 ? "" : "s"}`}</p>
                      </div>
                      <button type="button" onClick={() => openRun(run)} aria-haspopup="dialog" className="run-inspect">
                        <FileSearch size={14} aria-hidden="true" /> Inspect run evidence
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </Card>

      {selected && !detail && (
        <div className="fixed inset-0 z-50 flex justify-end bg-[#020612]/75 backdrop-blur-sm" role="presentation" onClick={(e) => e.target === e.currentTarget && closeRun()}>
          <section role="dialog" aria-modal="true" aria-label="Test run evidence drawer (loading)" className="flex h-full w-full max-w-2xl flex-col border-l border-white/15 bg-[#060e22]/95 p-6 text-[#f4f8ff]">
            <span className="font-mono text-[10px] font-semibold tracking-[.18em] text-[#ff8a32] uppercase">{`Test run · ${selected.id}`}</span>
            <h2 className="mt-1.5 text-xl font-extrabold tracking-tight">{selected.label}</h2>
            <p className="mt-4 font-mono text-xs text-[#8ea5c7]" role="status">
              {detailError ? `Could not load run evidence: ${detailError}` : "Loading full run evidence (conditions, measurements, source locators)…"}
            </p>
            <button type="button" onClick={closeRun} className="mt-6 w-fit rounded-full border border-white/15 bg-white/[0.06] px-4 py-1.5 text-xs font-semibold tracking-wider text-[#e6effc] uppercase">
              Close drawer
            </button>
          </section>
        </div>
      )}

      {selected && detail && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-[#020612]/75 backdrop-blur-sm"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) closeRun();
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="test-run-drawer-title"
            className="flex h-full w-full max-w-2xl flex-col border-l border-white/15 bg-[#060e22]/95 text-[#f4f8ff] shadow-[-24px_0_60px_-15px_rgba(0,0,0,0.85)]"
          >
            <header className="flex items-start justify-between gap-4 border-b border-white/10 px-6 py-5">
              <div>
                <span className="font-mono text-[10px] font-semibold tracking-[.18em] text-[#ff8a32] uppercase">
                  {`TEST RUN EVIDENCE DRAWER // ${detail.id}`}
                </span>
                <h2 id="test-run-drawer-title" className="mt-1.5 text-xl font-extrabold tracking-tight text-[#f4f8ff]">
                  {detail.label}
                </h2>
                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  <StatusBadge status={toStatusBadgeValue(detail.provenanceStatus, investigationSource)} />
                </div>
              </div>
              <button
                type="button"
                onClick={() => closeRun()}
                aria-label="Close test run evidence drawer"
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/[0.05] text-[#c4d7f2] transition-colors hover:border-[#36a9ff]/50 hover:bg-white/10 hover:text-white"
              >
                <X size={16} />
              </button>
            </header>

            <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
              {detail.provenanceStatus === "DEMO_FIXTURE" && (
                <div className="flex items-start gap-3 rounded-xl border border-amber-400/30 bg-amber-400/10 p-4 text-xs leading-5 text-amber-200">
                  <ShieldAlert size={16} className="mt-0.5 shrink-0 text-amber-400" aria-hidden="true" />
                  <div>
                    <p className="font-mono text-[11px] font-bold tracking-wider text-amber-300 uppercase">
                      DEMO FIXTURE — FICTIONAL DATA — NOT NASA MEASUREMENTS
                    </p>
                    <p className="mt-1">
                      Present values are labelled <strong className="text-amber-100">DEMO ONLY</strong> for UI verification.
                      Missing fields remain <strong className="text-amber-100">NOT REPORTED</strong> and measurements are
                      never invented or inferred.
                    </p>
                  </div>
                </div>
              )}

              <div className="rounded-xl border border-white/10 bg-[#09152e]/70 p-4">
                <p className="font-mono text-[10px] font-semibold tracking-[.16em] text-[#52b6ff] uppercase">
                  Run Metadata &amp; Provenance
                </p>
                <dl className="mt-3 grid gap-3 text-xs sm:grid-cols-2">
                  <div>
                    <dt className="font-mono text-[10px] text-[#7d95b8] uppercase">Parent Investigation</dt>
                    <dd className="mt-0.5 font-medium text-[#f4f8ff]">
                      {investigationId} — {investigationName}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-mono text-[10px] text-[#7d95b8] uppercase">Source Run Identifier</dt>
                    <dd className={`mt-0.5 font-mono font-semibold ${detail.sourceRunKey ? "text-[#f4f8ff]" : "text-amber-300"}`}>
                      {detail.sourceRunKey ?? "NOT REPORTED"}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-mono text-[10px] text-[#7d95b8] uppercase">Objective Variant</dt>
                    <dd className="mt-0.5 text-[#c2d5ee]">{detail.objectiveVariant ?? "NOT REPORTED"}</dd>
                  </div>
                  <div>
                    <dt className="font-mono text-[10px] text-[#7d95b8] uppercase">Parent Source Document</dt>
                    <dd className="mt-0.5 text-[#9cb2d2]">{formatSourceSummary(investigationSource)}</dd>
                  </div>
                </dl>
              </div>

              <div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <FlaskConical size={16} className="text-[#36a9ff]" aria-hidden="true" />
                    <h3 className="text-base font-bold text-[#f4f8ff]">Experimental Conditions</h3>
                  </div>
                  <span className="font-mono text-[10px] tracking-wider text-[#8ea5c7] uppercase">
                    {detail.conditions.length} PARAMETERS
                  </span>
                </div>

                {detail.conditions.length === 0 ? (
                  <div className="mt-3 rounded-xl border border-white/10 bg-[#09152e]/60 p-4 text-xs text-[#9cb2d2]">
                    No structured condition entries recorded in this test run.
                  </div>
                ) : (
                  <div className="mt-3 divide-y divide-white/10 overflow-hidden rounded-xl border border-white/10 bg-[#09152e]/70">
                    {detail.conditions.map((condition) => {
                      const isPresent = condition.missingStatus === "PRESENT";
                      const showSi =
                        isPresent &&
                        condition.valueSi !== null &&
                        condition.unitSi !== null &&
                        (condition.valueSi !== condition.valueOriginal || condition.unitSi !== condition.unitOriginal);

                      return (
                        <div key={condition.parameterKey} className="p-4">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-sm font-semibold text-[#f4f8ff]">
                              {formatParameterName(condition.parameterKey)}
                            </span>
                            {renderStatusChip(condition.missingStatus, detail.provenanceStatus, condition.source, investigationSource)}
                          </div>
                          <div className="mt-2 flex flex-wrap items-baseline justify-between gap-3">
                            <span
                              className={`font-mono text-sm font-bold ${
                                isPresent ? "text-[#f4f8ff]" : "text-amber-300"
                              }`}
                            >
                              {formatConditionValue(condition)}
                            </span>
                            {showSi && (
                              <span className="font-mono text-[11px] text-[#8ea5c7]">
                                SI: {condition.valueSi} {condition.unitSi}
                              </span>
                            )}
                          </div>
                          <p className="mt-1.5 font-mono text-[10px] text-[#7d95b8]">
                            Source: {formatSourceSummary(condition.source)}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Activity size={16} className="text-[#ff8a32]" aria-hidden="true" />
                    <h3 className="text-base font-bold text-[#f4f8ff]">Recorded Measurements</h3>
                  </div>
                  <span className="font-mono text-[10px] tracking-wider text-[#8ea5c7] uppercase">
                    {detail.measurements.length} RECORDED
                  </span>
                </div>

                {detail.measurements.length === 0 ? (
                  <div className="mt-3 flex items-start gap-3 rounded-xl border border-white/10 bg-[#09152e]/60 p-4 text-xs leading-5 text-[#9cb2d2]">
                    <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-400" aria-hidden="true" />
                    <div>
                      <p className="font-mono text-[11px] font-semibold tracking-wider text-amber-300 uppercase">
                        NO RECORDED MEASUREMENTS // NOT REPORTED
                      </p>
                      <p className="mt-1">
                        {detail.provenanceStatus === "DEMO_FIXTURE"
                          ? "This illustrative demo run carries no sensor telemetry or measured output variables. OrbitFlame never invents measurements or infers missing values."
                          : "No measurements have been extracted or verified for this run yet."}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 divide-y divide-white/10 overflow-hidden rounded-xl border border-white/10 bg-[#09152e]/70">
                    {detail.measurements.map((measurement) => {
                      const isPresent = measurement.missingStatus === "PRESENT";
                      const showSi =
                        isPresent &&
                        measurement.valueSi !== null &&
                        measurement.unitSi !== null &&
                        (measurement.valueSi !== measurement.valueOriginal || measurement.unitSi !== measurement.unitOriginal);

                      return (
                        <div key={measurement.id} className="p-4">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <span className="text-sm font-semibold text-[#f4f8ff]">{measurement.label}</span>
                              <span className="ml-2 font-mono text-[10px] text-[#7d95b8]">{measurement.metricKey}</span>
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="rounded-full border border-white/15 bg-white/[0.06] px-2 py-0.5 font-mono text-[10px] text-[#c2d5ee]">
                                {measurement.measurementStatus}
                              </span>
                              {renderStatusChip(measurement.missingStatus, detail.provenanceStatus, measurement.source, investigationSource)}
                            </div>
                          </div>
                          <div className="mt-2 flex flex-wrap items-baseline justify-between gap-3">
                            <span
                              className={`font-mono text-sm font-bold ${
                                isPresent ? "text-[#f4f8ff]" : "text-amber-300"
                              }`}
                            >
                              {formatMeasurementValue(measurement)}
                            </span>
                            {showSi && (
                              <span className="font-mono text-[11px] text-[#8ea5c7]">
                                SI: {measurement.valueSi} {measurement.unitSi}
                              </span>
                            )}
                          </div>
                          <p className="mt-1.5 flex items-center gap-1.5 font-mono text-[10px] text-[#7d95b8]">
                            <Database size={11} aria-hidden="true" />
                            <span>
                              {formatSourceSummary(measurement.source)}
                              {measurement.source ? ` (${measurement.source.verificationStatus})` : ""}
                            </span>
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <footer className="flex items-center justify-between gap-3 border-t border-white/10 px-6 py-4">
              <span className="font-mono text-[10px] tracking-wider text-[#7d95b8] uppercase">
                Press ESC or click Close to dismiss
              </span>
              <button
                type="button"
                onClick={() => closeRun()}
                className="inline-flex min-h-9 shrink-0 items-center whitespace-nowrap rounded-full border border-white/15 bg-white/[0.06] px-4 py-1.5 text-xs font-semibold tracking-wider text-[#e6effc] uppercase transition-colors hover:border-[#36a9ff]/40 hover:bg-white/10 hover:text-white"
              >
                Close drawer
              </button>
            </footer>
          </section>
        </div>
      )}
    </>
  );
}
