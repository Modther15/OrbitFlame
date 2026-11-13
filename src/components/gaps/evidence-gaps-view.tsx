"use client";

import {
  AlertTriangle,
  ArrowRight,
  Compass,
  FileWarning,
  GitCompareArrows,
  HelpCircle,
  Map,
  MessageSquare,
  ShieldAlert,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ExploreSpaceBackground } from "@/components/explorer/explore-space-background";
import { Sidebar } from "@/components/navigation/sidebar";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  RADAR_DOMAINS,
  RADAR_GRAVITY_AXES,
  type EvidenceGapCell,
  type EvidenceGapRadarReport,
  type GapCoverageStatus,
} from "@/lib/science/evidence-gaps";
import { setCompareIds } from "@/lib/state/compare-selection";

const CELL_STYLES: Record<GapCoverageStatus, string> = {
  DIRECT: "border-emerald-400/45 bg-emerald-500/15 text-emerald-200 hover:border-emerald-300",
  ANALOGOUS: "border-amber-400/40 bg-amber-400/12 text-amber-200 hover:border-amber-300",
  PLANNED: "border-indigo-400/40 bg-indigo-500/12 text-indigo-200 hover:border-indigo-300",
  UNAVAILABLE: "border-rose-400/30 bg-rose-500/[0.07] text-rose-200 hover:border-rose-400/60",
};

const BADGE_STYLES: Record<GapCoverageStatus, string> = {
  DIRECT: "border-emerald-400/40 bg-emerald-500/20 text-emerald-200",
  ANALOGOUS: "border-amber-400/40 bg-amber-400/20 text-amber-200",
  PLANNED: "border-indigo-400/40 bg-indigo-500/20 text-indigo-200",
  UNAVAILABLE: "border-rose-400/35 bg-rose-500/15 text-rose-200",
};

export type ProxyNote = { label: string; rows: number; investigations: { id: string; n: number }[] };

export function EvidenceGapsView({ radar, proxyNotes = [] }: { radar: EvidenceGapRadarReport; proxyNotes?: ProxyNote[] }) {
  const [selectedCellId, setSelectedCellId] = useState<string>("LUNAR_GRAVITY__PREVENTION");

  const activeCell: EvidenceGapCell =
    radar.cells.find((c) => c.cellId === selectedCellId) ?? radar.cells[0];

  const scopeBadgeStatus =
    radar.datasetScope.scope === "VERIFIED_INDEXED_DATA"
      ? "verified"
      : radar.datasetScope.scope === "EMPTY"
        ? "empty"
        : "demo";

  const compareIdsForCell = activeCell.includedRecords.slice(0, 3).map((r) => r.id);

  return (
    <div className="relative min-h-screen overflow-x-clip bg-[#050b1b] text-[#f4f8ff] lg:grid lg:grid-cols-[260px_1fr]">
      <ExploreSpaceBackground />
      <Sidebar />

      <main className="explore-main-stage relative z-10 min-w-0 px-4 py-6 sm:px-8 sm:py-8 lg:px-10 lg:py-9">
        <div className="mx-auto max-w-[1220px] space-y-6">
          {/* Header & Dataset Scope Disclosure */}
          <Card className="border border-white/10 bg-[#09152e]/85 p-5 backdrop-blur-md sm:p-7">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="font-mono text-[10px] font-semibold tracking-[.18em] text-[#52b6ff] uppercase">
                  PHASE 5 INSTRUMENTATION // INDEXED COVERAGE & GAP RADAR
                </p>
                <h1 className="mt-1.5 flex items-center gap-2.5 text-2xl font-extrabold tracking-tight text-[#f4f8ff] sm:text-3xl">
                  <Map size={26} className="text-[#36a9ff]" aria-hidden="true" />
                  Evidence Gap Radar
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#9cb2d2]">
                  Follow where OrbitFlame&apos;s indexed investigations cover Gravity Regime × Safety Domain, inspect
                  missing measurements and unverified provenance, and examine gap-derived research proposals.
                </p>
              </div>
              <div className="flex flex-col items-start gap-2 lg:items-end">
                <StatusBadge status={scopeBadgeStatus} />
                <span className="font-mono text-[11px] text-[#8ea5c7]">{radar.datasetScope.activeDatasetBanner}</span>
              </div>
            </div>

            <div
              data-testid="gap-scope-disclosure"
              className="mt-5 flex items-start gap-3 rounded-xl border border-amber-400/35 bg-amber-400/10 p-3.5 text-xs leading-5 text-amber-100"
            >
              <ShieldAlert size={17} className="mt-0.5 shrink-0 text-amber-300" aria-hidden="true" />
              <div>
                <span className="font-mono text-[10.5px] font-bold tracking-wider text-amber-300 uppercase">
                  INDEX SCOPE DISCLOSURE — ABSENCE IN INDEX ≠ PROOF OF NO NASA RESEARCH
                </span>
                <p className="mt-0.5 text-[#fbe6b5]">{radar.datasetScope.scopeDisclosure}</p>
              </div>
            </div>
          </Card>

          {/* Status Summary Strip */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {(["DIRECT", "ANALOGOUS", "PLANNED", "UNAVAILABLE"] as const).map((status) => (
              <Card key={status} className="border border-white/10 bg-[#09152e]/80 p-4 backdrop-blur-md">
                <span className={`inline-block rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-bold ${BADGE_STYLES[status]}`}>
                  {status}
                </span>
                <p className="mt-2 text-2xl font-extrabold text-[#f4f8ff]">
                  {radar.totalsByStatus[status]}{" "}
                  <span className="text-xs font-normal text-[#8ea5c7]">/ {radar.cells.length} matrix cells</span>
                </p>
              </Card>
            ))}
          </div>

          {/* Interactive 4 x 3 Coverage Matrix */}
          <Card className="border border-white/10 bg-[#09152e]/85 p-5 backdrop-blur-md">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
              <div>
                <h2 className="font-mono text-[11px] font-bold tracking-[.16em] text-[#52b6ff] uppercase">
                  GRAVITY ENVIRONMENT × SAFETY DOMAIN MATRIX (CLICK ANY CELL TO TRACE GAP PATHWAY)
                </h2>
                <p className="mt-1 text-xs text-[#8ea5c7]">
                  Counts derive exclusively from active indexed records. Non-NASA illustrative records cannot rise above ANALOGOUS.
                </p>
              </div>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[680px] border-separate border-spacing-2.5 text-left">
                <thead>
                  <tr>
                    <th className="w-40 px-2 py-1 font-mono text-[10px] tracking-wider text-[#7d95b8] uppercase">
                      Safety Domain \ Gravity
                    </th>
                    {RADAR_GRAVITY_AXES.map((g) => (
                      <th key={g.id} className="px-2 py-1">
                        <span className="block font-mono text-[10.5px] font-bold text-[#f4f8ff]">{g.shortLabel}</span>
                        <span className="block font-mono text-[9.5px] font-normal text-[#8ea5c7]">{g.missionContextLabel}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {RADAR_DOMAINS.map((dom) => (
                    <tr key={dom.id}>
                      <td className="align-middle px-2">
                        <span className="block font-mono text-xs font-bold text-[#ffb067]">{dom.label}</span>
                        <span className="mt-0.5 block text-[11px] text-[#8ea5c7]">{dom.focusNote}</span>
                      </td>
                      {RADAR_GRAVITY_AXES.map((grav) => {
                        const cell = radar.cells.find((c) => c.gravity === grav.id && c.domain === dom.id)!;
                        const active = activeCell.cellId === cell.cellId;
                        return (
                          <td key={cell.cellId}>
                            <button
                              type="button"
                              data-testid={`gap-cell-${cell.cellId}`}
                              aria-pressed={active}
                              onClick={() => setSelectedCellId(cell.cellId)}
                              className={`w-full rounded-xl border p-3.5 text-left transition-all ${
                                CELL_STYLES[cell.highestStatus]
                              } ${active ? "ring-2 ring-[#36a9ff] ring-offset-2 ring-offset-[#050b1b]" : ""}`}
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-mono text-[10px] font-extrabold tracking-wider">
                                  {cell.highestStatus}
                                </span>
                                <span className="font-mono text-sm font-black text-white">
                                  {cell.counts.totalInCell}
                                </span>
                              </div>
                              <p className="mt-1.5 font-mono text-[10px] opacity-90">
                                {cell.counts.totalInCell === 0
                                  ? cell.adjacentPartialContextRecords.length > 0
                                    ? `0 direct (${cell.adjacentPartialContextRecords.length} partial analog)`
                                    : "0 indexed records"
                                  : `D:${cell.counts.direct} · A:${cell.counts.analogous} · P:${cell.counts.planned}`}
                              </p>
                              <p className="mt-0.5 font-mono text-[9.5px] text-white/70">
                                {cell.counts.verified > 0
                                  ? `${cell.counts.verified} NASA verified`
                                  : cell.counts.demoOnly > 0
                                    ? `${cell.counts.demoOnly} demo fixture(s)`
                                    : "No records"}
                              </p>
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {proxyNotes.length > 0 && (
              <div data-testid="gap-proxy-note" className="mt-3 rounded-xl border border-amber-400/25 bg-amber-400/[0.06] px-4 py-3 text-xs leading-5 text-[#fff1d0]">
                <span className="font-mono text-[10px] font-bold tracking-wider text-amber-300 uppercase">Effective-gravity proxy rows (heuristic, NOT counted as coverage above): </span>
                {proxyNotes.map((n) => (
                  <span key={n.label} className="mr-3">
                    {n.label}: {n.rows} rows ({n.investigations.map((i) => `${i.id} ${i.n}`).join(", ")});
                  </span>
                ))}
                These are 0 g flight rows whose forced-flow speed maps to a buoyancy-equivalent gravity; they are not measured Lunar / Mars / Earth data, so the Lunar and Normal gravity cells keep their gaps.
              </div>
            )}
            {radar.unclassifiedPartialRecords.length > 0 && (
              <div className="mt-3 rounded-xl border border-white/10 bg-[#050d21]/85 px-4 py-3 text-xs text-[#9cb2d2]">
                <span className="font-mono text-[10px] font-bold tracking-wider text-[#52b6ff] uppercase">
                  UNSPECIFIED PARTIAL-GRAVITY RECORDS ACCOUNTED FOR SEPARATELY:
                </span>{" "}
                {radar.unclassifiedPartialRecords.map((r) => (
                  <Link
                    key={r.id}
                    href={`/investigations/${encodeURIComponent(r.id)}`}
                    className="mr-2 font-mono font-semibold text-[#ffb067] hover:underline"
                  >
                    {r.id} ({r.gravityDisplay})
                  </Link>
                ))}
                — Not equated with specific Lunar (1/6 g) or Mars (0.38 g) surface evidence.
              </div>
            )}
          </Card>

          {/* Connected 5-Stage Exploration Chain for Selected Cell */}
          <Card
            data-testid="gap-pathway-explorer"
            className="border border-[#36a9ff]/30 bg-[#09152e]/90 p-5 backdrop-blur-md sm:p-6"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
              <div>
                <p className="font-mono text-[10px] font-bold tracking-[.16em] text-[#52b6ff] uppercase">
                  INTERACTIVE GAP EXPLORATION PATHWAY
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5 font-mono text-xs font-semibold text-[#e5efff]">
                  <span className="rounded bg-[#0d254f] px-2 py-0.5 text-[#7bc5ff]">{activeCell.missionContextLabel}</span>
                  <ArrowRight size={13} className="text-[#ff8a32]" aria-hidden="true" />
                  <span className="rounded bg-[#2d1a0b] px-2 py-0.5 text-[#ffb067]">{activeCell.domainLabel}</span>
                  <ArrowRight size={13} className="text-[#ff8a32]" aria-hidden="true" />
                  <span>Available Evidence ({activeCell.counts.totalInCell})</span>
                  <ArrowRight size={13} className="text-[#ff8a32]" aria-hidden="true" />
                  <span>Missing Evidence</span>
                  <ArrowRight size={13} className="text-[#ff8a32]" aria-hidden="true" />
                  <span>Proposed Research Question</span>
                </div>
              </div>
              <span className={`rounded-full border px-3 py-1 font-mono text-[10.5px] font-bold ${BADGE_STYLES[activeCell.highestStatus]}`}>
                CELL STATUS: {activeCell.highestStatus}
              </span>
            </div>

            <div className="mt-5 grid gap-5 lg:grid-cols-3">
              {/* Step 1-3: Available Evidence */}
              <div className="rounded-xl border border-white/10 bg-[#050d21]/85 p-4">
                <p className="font-mono text-[10px] font-bold tracking-[.14em] text-[#52b6ff] uppercase">
                  1. AVAILABLE EVIDENCE ({activeCell.counts.totalInCell} RECORD{activeCell.counts.totalInCell === 1 ? "" : "S"})
                </p>
                {activeCell.includedRecords.length === 0 ? (
                  <div className="mt-3 space-y-2 text-xs text-[#9cb2d2]">
                    <p className="flex items-center gap-2 font-semibold text-rose-200">
                      <AlertTriangle size={14} aria-hidden="true" /> 0 indexed records match {activeCell.gravityLabel} +{" "}
                      {activeCell.domainLabel}.
                    </p>
                    {activeCell.adjacentPartialContextRecords.length > 0 && (
                      <div className="rounded-lg border border-amber-400/25 bg-amber-400/10 p-2.5 text-[11px] text-amber-100">
                        <p className="font-mono font-bold text-amber-300">ADJACENT UNSPECIFIED PARTIAL-G CONTEXT:</p>
                        {activeCell.adjacentPartialContextRecords.map((adj) => (
                          <Link
                            key={adj.id}
                            href={`/investigations/${encodeURIComponent(adj.id)}`}
                            className="mt-1 block font-mono text-[#ffb067] hover:underline"
                          >
                            {adj.id}: {adj.name} ({adj.gravityDisplay})
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <ul className="mt-3 space-y-2.5">
                    {activeCell.includedRecords.map((rec) => (
                      <li key={rec.id} className="rounded-lg border border-white/10 bg-[#09152e]/85 p-3 text-xs">
                        <div className="flex flex-wrap items-center justify-between gap-1.5">
                          <Link
                            href={`/investigations/${encodeURIComponent(rec.id)}`}
                            className="font-mono font-bold text-[#7bc5ff] hover:underline"
                          >
                            {rec.id} {rec.family ? `// ${rec.family}` : ""}
                          </Link>
                          <span className={`rounded border px-1.5 py-0.5 font-mono text-[9.5px] font-bold ${BADGE_STYLES[rec.classifiedCellRole]}`}>
                            {rec.classifiedCellRole}
                          </span>
                        </div>
                        <p className="mt-1 font-medium text-[#f4f8ff]">{rec.name}</p>
                        <p className="mt-1 font-mono text-[10px] text-amber-200/90">{rec.provenanceLabel}</p>
                        <p className="mt-1 text-[11px] text-[#8ea5c7]">
                          Measurements: {rec.measurementCount} · Missing: {rec.missingFields.join(", ") || "None"}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Step 4: Missing Evidence & Insufficiency Explanation */}
              <div className="rounded-xl border border-white/10 bg-[#050d21]/85 p-4">
                <p className="flex items-center gap-1.5 font-mono text-[10px] font-bold tracking-[.14em] text-[#ffb067] uppercase">
                  <FileWarning size={13} aria-hidden="true" /> 2. WHY EVIDENCE IS MISSING OR INSUFFICIENT
                </p>
                <ul className="mt-3 list-disc space-y-2 pl-4 text-xs leading-relaxed text-[#d7e5fb]">
                  {activeCell.missingEvidenceReasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              </div>

              {/* Step 5: Suggested Research Questions (Proposals Only) */}
              <div className="rounded-xl border border-white/10 bg-[#050d21]/85 p-4">
                <p className="flex items-center gap-1.5 font-mono text-[10px] font-bold tracking-[.14em] text-emerald-300 uppercase">
                  <HelpCircle size={13} aria-hidden="true" /> 3. PROPOSED NEXT RESEARCH QUESTIONS
                </p>
                <p className="mt-1 font-mono text-[9.5px] text-[#7d95b8]">
                  HYPOTHETICAL PROPOSALS DERIVED FROM INDEX GAPS — NOT CLAIMS ABOUT NASA ARCHIVES
                </p>
                <ul className="mt-3 space-y-2.5">
                  {activeCell.proposedResearchQuestions.map((q) => (
                    <li key={q} className="rounded-lg border border-white/10 bg-[#09152e]/85 p-2.5 text-xs leading-relaxed text-[#e5efff]">
                      {q}
                    </li>
                  ))}
                </ul>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    href={`/mission-lab?habitat=${activeCell.suggestedHabitatId}`}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#36a9ff]/35 bg-[#36a9ff]/10 px-2.5 py-1.5 font-mono text-[10px] font-semibold text-[#7bc5ff] hover:border-[#36a9ff]"
                  >
                    <Compass size={12} aria-hidden="true" /> Test in Mission Lab
                  </Link>
                  {compareIdsForCell.length >= 2 && (
                    <Link
                      href={`/compare?ids=${encodeURIComponent(compareIdsForCell.join(","))}`}
                      onClick={() => setCompareIds(compareIdsForCell)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[#ff8a32]/35 bg-[#ff5500]/10 px-2.5 py-1.5 font-mono text-[10px] font-semibold text-[#ffb067]"
                    >
                      <GitCompareArrows size={12} aria-hidden="true" /> Compare Cell Records
                    </Link>
                  )}
                  <Link
                    href="/assistant"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/[0.04] px-2.5 py-1.5 font-mono text-[10px] font-semibold text-[#c4d7f2] hover:border-[#36a9ff]"
                  >
                    <MessageSquare size={12} aria-hidden="true" /> Query AI Assistant
                  </Link>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
}
