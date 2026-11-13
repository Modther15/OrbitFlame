"use client";

import { Activity, AlertTriangle, CheckCircle2, Database, FileSearch, FlaskConical, ShieldAlert, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import type { Condition, Measurement, MissingStatus, ProvenanceStatus, SourceLocator, TestRun } from "@/lib/api/schemas";

type TestRunEvidenceSectionProps = {
  investigationId: string;
  investigationName: string;
  investigationSource: SourceLocator | null;
  fixtureLabel?: string;
  testRuns: TestRun[];
};

const PARAMETER_LABELS: Record<string, string> = {
  oxygen_concentration: "Oxygen concentration",
  pressure: "Pressure",
  airflow: "Airflow",
  gravity: "Gravity environment",
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

function toStatusBadgeValue(status: ProvenanceStatus, source: SourceLocator | null): "verified" | "demo" | "unverified" | "not-reported" {
  if (status === "NASA_VERIFIED_DATA" && source?.verificationStatus === "VERIFIED") return "verified";
  if (status === "DEMO_FIXTURE") return "demo";
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
  fixtureLabel,
  testRuns,
}: TestRunEvidenceSectionProps) {
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const activeRun = testRuns.find((run) => run.id === selectedRunId) ?? null;

  useEffect(() => {
    if (!activeRun) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedRunId(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeRun]);

  return (
    <>
      <Card className="mt-6 border border-white/10 bg-[#09152e]/80 p-6 backdrop-blur-md">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <span className="font-mono text-[10px] font-semibold tracking-[.16em] text-[#52b6ff] uppercase">
              TEST RUN EVIDENCE // {testRuns.length} {testRuns.length === 1 ? "RUN" : "RUNS"}
            </span>
            <h2 className="mt-1 text-lg font-extrabold tracking-tight text-[#f4f8ff]">Test runs &amp; evidence inspection</h2>
            <p className="mt-1 text-xs text-[#8ea5c7]">
              Inspect individual test-run conditions, missing-value states, measurements, and source locators.
            </p>
          </div>
          {fixtureLabel && (
            <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 font-mono text-[10px] font-semibold tracking-wider text-amber-300">
              DEMO FIXTURE SCOPE
            </span>
          )}
        </div>

        {testRuns.length === 0 ? (
          <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-5 text-sm text-[#9cb2d2]">
            No test runs are indexed for this investigation. Empty run lists do not imply zero experiments exist in NASA records.
          </div>
        ) : (
          <div className="mt-5 grid gap-4">
            {testRuns.map((run) => {
              const presentConditions = run.conditions.filter((c) => c.missingStatus === "PRESENT").length;
              const missingConditions = run.conditions.filter((c) => c.missingStatus !== "PRESENT").length;
              const presentMeasurements = run.measurements.filter((m) => m.missingStatus === "PRESENT").length;

              return (
                <div
                  key={run.id}
                  className="flex flex-col justify-between gap-4 rounded-xl border border-white/10 bg-[#060e22]/75 p-5 transition-colors hover:border-[#36a9ff]/35 sm:flex-row sm:items-center"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="font-mono text-xs font-bold tracking-[.14em] text-[#ff8a32]">{run.id}</span>
                      <span className="text-xs text-[#5a7294]">•</span>
                      <span className="font-mono text-[11px] text-[#8ea5c7]">
                        {run.sourceRunKey ? `Source run: ${run.sourceRunKey}` : "Source run key: NOT REPORTED"}
                      </span>
                    </div>
                    <h3 className="mt-1.5 text-base font-bold text-[#f4f8ff]">{run.label}</h3>
                    {run.objectiveVariant && <p className="mt-1 text-xs text-[#9cb2d2]">{run.objectiveVariant}</p>}
                    <div className="mt-3 flex flex-wrap gap-2">
                      {run.conditions.map((cond) => (
                        <span
                          key={cond.parameterKey}
                          className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 font-mono text-[11px] ${
                            cond.missingStatus === "PRESENT"
                              ? "border-white/10 bg-white/[0.04] text-[#e6effc]"
                              : "border-amber-400/25 bg-amber-400/10 text-amber-300"
                          }`}
                        >
                          <span className="text-[#8ea5c7]">{formatParameterName(cond.parameterKey)}:</span>
                          <span className="font-semibold">{formatConditionValue(cond)}</span>
                        </span>
                      ))}
                    </div>
                    <p className="mt-3 font-mono text-[11px] text-[#7d95b8]">
                      {`${presentConditions} condition${presentConditions === 1 ? "" : "s"} present · ${missingConditions} not reported · ${presentMeasurements} recorded measurement${presentMeasurements === 1 ? "" : "s"}`}
                    </p>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => setSelectedRunId(run.id)}
                      aria-haspopup="dialog"
                      aria-expanded={selectedRunId === run.id}
                      className="inline-flex min-h-10 items-center gap-2 rounded-full bg-[linear-gradient(110deg,#0a1b3a_0%,#174585_45%,#2563eb_72%,#ff5500_100%)] bg-[length:240%_100%] bg-[position:0%_50%] px-4 py-2 text-xs font-semibold tracking-wider !text-white uppercase shadow-[0_8px_22px_-10px_rgba(37,99,235,0.45)] transition-all duration-500 ease-[cubic-bezier(0.2,0.75,0.2,1)] hover:-translate-y-0.5 hover:bg-[position:100%_50%] hover:shadow-[0_14px_28px_-10px_rgba(255,85,0,0.5)]"
                    >
                      <FileSearch size={14} aria-hidden="true" /> Inspect run evidence
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {activeRun && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-[#020612]/75 backdrop-blur-sm"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) setSelectedRunId(null);
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
                  {`TEST RUN EVIDENCE DRAWER // ${activeRun.id}`}
                </span>
                <h2 id="test-run-drawer-title" className="mt-1.5 text-xl font-extrabold tracking-tight text-[#f4f8ff]">
                  {activeRun.label}
                </h2>
                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  <StatusBadge status={toStatusBadgeValue(activeRun.provenanceStatus, investigationSource)} />
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRunId(null)}
                aria-label="Close test run evidence drawer"
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/[0.05] text-[#c4d7f2] transition-colors hover:border-[#36a9ff]/50 hover:bg-white/10 hover:text-white"
              >
                <X size={16} />
              </button>
            </header>

            <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
              {activeRun.provenanceStatus === "DEMO_FIXTURE" && (
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
                    <dd className={`mt-0.5 font-mono font-semibold ${activeRun.sourceRunKey ? "text-[#f4f8ff]" : "text-amber-300"}`}>
                      {activeRun.sourceRunKey ?? "NOT REPORTED"}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-mono text-[10px] text-[#7d95b8] uppercase">Objective Variant</dt>
                    <dd className="mt-0.5 text-[#c2d5ee]">{activeRun.objectiveVariant ?? "NOT REPORTED"}</dd>
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
                    {activeRun.conditions.length} PARAMETERS
                  </span>
                </div>

                {activeRun.conditions.length === 0 ? (
                  <div className="mt-3 rounded-xl border border-white/10 bg-[#09152e]/60 p-4 text-xs text-[#9cb2d2]">
                    No structured condition entries recorded in this test run.
                  </div>
                ) : (
                  <div className="mt-3 divide-y divide-white/10 overflow-hidden rounded-xl border border-white/10 bg-[#09152e]/70">
                    {activeRun.conditions.map((condition) => {
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
                            {renderStatusChip(condition.missingStatus, activeRun.provenanceStatus, condition.source, investigationSource)}
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
                    {activeRun.measurements.length} RECORDED
                  </span>
                </div>

                {activeRun.measurements.length === 0 ? (
                  <div className="mt-3 flex items-start gap-3 rounded-xl border border-white/10 bg-[#09152e]/60 p-4 text-xs leading-5 text-[#9cb2d2]">
                    <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-400" aria-hidden="true" />
                    <div>
                      <p className="font-mono text-[11px] font-semibold tracking-wider text-amber-300 uppercase">
                        NO RECORDED MEASUREMENTS // NOT REPORTED
                      </p>
                      <p className="mt-1">
                        {activeRun.provenanceStatus === "DEMO_FIXTURE"
                          ? "This illustrative demo run carries no sensor telemetry or measured output variables. OrbitFlame never invents measurements or infers missing values."
                          : "No measurements have been extracted or verified for this run yet."}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 divide-y divide-white/10 overflow-hidden rounded-xl border border-white/10 bg-[#09152e]/70">
                    {activeRun.measurements.map((measurement) => {
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
                              {renderStatusChip(measurement.missingStatus, activeRun.provenanceStatus, measurement.source, investigationSource)}
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
                onClick={() => setSelectedRunId(null)}
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
