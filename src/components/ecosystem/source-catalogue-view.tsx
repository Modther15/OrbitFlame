"use client";

import {
  Archive,
  CheckCircle2,
  Database,
  ExternalLink,
  FileJson,
  Search,
  Upload,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ExploreSpaceBackground } from "@/components/explorer/explore-space-background";
import { Sidebar } from "@/components/navigation/sidebar";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { validateInvestigationDatasetBatch, type DatasetImportReport } from "@/lib/ingestion/preview";
import type { DatasetScopeSummary } from "@/lib/science/provenance";
import { NASA_SOURCE_PRIORITY_TIERS, type SourceCatalogueEntry } from "@/lib/science/source-catalogue";

export function SourceCatalogueView({
  datasetScope,
  entries,
  verifiedSourceCount,
  existingIds,
  examples,
}: {
  datasetScope: DatasetScopeSummary;
  entries: SourceCatalogueEntry[];
  verifiedSourceCount: number;
  /** Indexed investigation ids, used only for duplicate-ID detection in the dry-run validator. */
  existingIds: string[];
  /** Validator examples derived from a real indexed PSI record (no hand-written fixtures). */
  examples: { duplicate: string; sourceId: string | null };
}) {
  const records = useMemo(() => existingIds.map((id) => ({ id })), [existingIds]);
  /** Same real record re-submitted under a new investigation / run id (derived from the real record text). */
  const validExample = useMemo(() => {
    try {
      const arr = JSON.parse(examples.duplicate) as { id: string; testRuns: { id: string }[] }[];
      return JSON.stringify(arr.map((r) => ({ ...r, id: `${r.id}-RESUBMISSION-EXAMPLE`, testRuns: r.testRuns.map((t) => ({ ...t, id: `${t.id}-resub` })) })), null, 2);
    } catch {
      return "[]";
    }
  }, [examples.duplicate]);
  const [search, setSearch] = useState("");
  const [filterMode, setFilterMode] = useState<"ALL" | "VERIFIED_ONLY" | "DEMO_UNCONNECTED">("ALL");

  // Client-side dry-run ingestion validator state
  const [jsonInput, setJsonInput] = useState(examples.duplicate);
  const [parseError, setParseError] = useState<string | null>(null);
  const [importReport, setImportReport] = useState<DatasetImportReport | null>(() =>
    validateInvestigationDatasetBatch(JSON.parse(examples.duplicate), records),
  );

  const filteredEntries = useMemo(() => {
    const q = search.trim().toLocaleLowerCase();
    return entries.filter((entry) => {
      if (filterMode === "VERIFIED_ONLY" && !entry.isVerified) return false;
      if (filterMode === "DEMO_UNCONNECTED" && entry.isVerified) return false;
      if (!q) return true;
      return (
        entry.investigationId.toLocaleLowerCase().includes(q) ||
        entry.investigationName.toLocaleLowerCase().includes(q) ||
        entry.sourceTitle.toLocaleLowerCase().includes(q) ||
        (entry.family ?? "").toLocaleLowerCase().includes(q)
      );
    });
  }, [entries, filterMode, search]);

  function runDryRunValidation(rawText: string) {
    setParseError(null);
    try {
      const parsed: unknown = JSON.parse(rawText);
      const report = validateInvestigationDatasetBatch(parsed, records);
      setImportReport(report);
    } catch (err) {
      setImportReport(null);
      setParseError(err instanceof Error ? err.message : "Invalid JSON payload.");
    }
  }

  const fileOf = (t: string) => t.replace(/^NASA PSI\s+PSI-\d+:\s*/, "").replace(/^PSI-\d+_/, "").replace(/_/g, " ");
  const uniform = (vals: string[]) => (new Set(vals).size === 1 ? vals[0] : null);
  const uniformLocator = uniform(entries.map((e) => e.locatorDisplay))?.replace(/^Section:\s*/, "").replace(/\s+/g, " ") ?? null;
  const uniformDate = uniform(entries.map((e) => e.publicationDate)) !== null;
  const allVerified = entries.every((e) => e.isVerified);
  const scopeBadgeStatus =
    datasetScope.scope === "VERIFIED_INDEXED_DATA"
      ? "verified"
      : datasetScope.scope === "EMPTY"
        ? "empty"
        : "demo";

  return (
    <div className="relative min-h-screen overflow-x-clip bg-[#050b1b] text-[#f4f8ff] lg:grid lg:grid-cols-[260px_1fr]">
      <ExploreSpaceBackground />
      <Sidebar />

      <main className="explore-main-stage relative z-10 min-w-0 px-4 py-6 sm:px-8 sm:py-8 lg:px-10 lg:py-9">
        <div className="mx-auto max-w-[1220px] space-y-6">
          {/* Header */}
          <Card className="border border-white/10 bg-[#09152e]/85 p-5 backdrop-blur-md sm:p-7">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="font-mono text-[10px] font-semibold tracking-[.18em] text-[#52b6ff] uppercase">
                  Source Files &amp; Provenance
                </p>
                <h1 className="mt-1.5 flex items-center gap-2.5 text-2xl font-extrabold tracking-tight text-[#f4f8ff] sm:text-3xl">
                  <Archive size={26} className="text-[#36a9ff]" aria-hidden="true" />
                  Research Library
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#9cb2d2]">
                  The NASA PSI files behind each investigation, with where each one was retrieved from.
                </p>
              </div>
              <div className="flex flex-col items-start gap-2 lg:items-end">
                <StatusBadge status={scopeBadgeStatus} />
                <span className="text-xs text-[#8ea5c7]">{entries.length} investigations</span>
              </div>
            </div>

            {verifiedSourceCount === 0 && (
              <p data-testid="sources-honest-empty-banner" className="mt-4 text-xs leading-5 text-[#9cb2d2]">
                No NASA source documents are connected yet.
              </p>
            )}
          </Card>

          {/* Source Priority Hierarchy */}
          <Card className="border border-white/10 bg-[#09152e]/80 p-5 backdrop-blur-md">
            <h2 className="text-lg font-extrabold tracking-tight text-[#f4f8ff]">Source Priority</h2>
            <p className="mt-0.5 text-xs text-[#8ea5c7]">How OrbitFlame ranks the kinds of sources it can draw on.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {NASA_SOURCE_PRIORITY_TIERS.map((tier) => (
                <div key={tier.rank} className="rounded-xl border border-white/10 bg-[#050d21]/85 p-3.5">
                  <span className="text-[11px] font-bold text-[#ff8a32]">Tier {tier.rank}</span>
                  <h3 className="mt-1 text-xs font-bold text-[#f4f8ff]">{tier.name}</h3>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-[#9cb2d2]">{tier.description}</p>
                  <p className="mt-2 text-[11px] text-[#7bc5ff]">{tier.labelingRule}</p>
                </div>
              ))}
            </div>
          </Card>

          {/* Indexed Source Records Table */}
          <Card className="border border-white/10 bg-[#09152e]/85 p-5 backdrop-blur-md">
            <div className="flex flex-col gap-3 border-b border-white/10 pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative min-w-0 flex-1 sm:max-w-sm">
                <Search
                  size={14}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#7d95b8]"
                  aria-hidden="true"
                />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Filter by ID, family, or source title..."
                  aria-label="Filter indexed research library"
                  className="w-full rounded-xl border border-white/15 bg-[#050b1b] py-2 pl-9 pr-3 text-xs text-[#f4f8ff] placeholder:text-[#6a84a9] focus:border-[#36a9ff] focus:outline-none"
                />
              </div>

              {entries.length - verifiedSourceCount > 0 && <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    ["ALL", `All (${entries.length})`],
                    ["VERIFIED_ONLY", `NASA PSI (${verifiedSourceCount})`],
                    ["DEMO_UNCONNECTED", `Demo (${entries.length - verifiedSourceCount})`],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setFilterMode(key)}
                    aria-pressed={filterMode === key}
                    className={`rounded-lg border px-3 py-1.5 font-mono text-[10.5px] font-semibold ${
                      filterMode === key
                        ? "border-[#36a9ff]/60 bg-[#36a9ff]/15 text-white"
                        : "border-white/10 bg-[#050b1b] text-[#8ea5c7] hover:text-white"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>}
            </div>

            {filteredEntries.length === 0 ? (
              <div className="py-10 text-center text-xs text-[#8ea5c7]">
                <Database size={24} className="mx-auto mb-2 text-[#52b6ff]" aria-hidden="true" />
                No source records match this filter.
              </div>
            ) : (
              <div className="mt-4 overflow-x-auto">
                {uniformLocator && <p className="mb-2 text-xs text-[#8ea5c7]">All files: {uniformLocator}.</p>}
                <table className="w-full min-w-[560px] text-left text-xs">
                  <thead>
                    <tr className="border-b border-white/10 text-[11px] font-semibold text-[#8ea5c7]">
                      <th className="px-3 py-2.5">Investigation</th>
                      <th className="px-3 py-2.5">Data File</th>
                      {!uniformDate && <th className="px-3 py-2.5">Published</th>}
                      {!uniformLocator && <th className="px-3 py-2.5">Where Retrieved</th>}
                      {!allVerified && <th className="px-3 py-2.5">Status</th>}
                      <th className="px-3 py-2.5">PSI Link</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {filteredEntries.map((entry) => (
                      <tr key={entry.investigationId} className="align-top hover:bg-white/[0.02]">
                        <td className="px-3 py-3">
                          <Link
                            href={`/investigations/${encodeURIComponent(entry.investigationId)}`}
                            className="font-mono font-bold text-[#7bc5ff] hover:underline"
                          >
                            {entry.investigationId}
                          </Link>
                          <p className="mt-0.5 text-[11px] font-medium text-[#e5efff]">{entry.investigationName}</p>
                        </td>
                        <td className="px-3 py-3">
                          <p className="font-semibold break-words text-[#f4f8ff]">{fileOf(entry.sourceTitle)}</p>
                        </td>
                        {!uniformDate && <td className="px-3 py-3 text-[11px] text-[#9cb2d2]">{entry.publicationDate}</td>}
                        {!uniformLocator && <td className="px-3 py-3 text-[11px] text-[#9cb2d2]">{entry.locatorDisplay}</td>}
                        {!allVerified && <td className="px-3 py-3">
                          <span
                            className={`inline-block rounded-full border px-2.5 py-0.5 font-mono text-[9.5px] font-bold ${
                              entry.isVerified
                                ? "border-emerald-400/35 bg-emerald-500/15 text-emerald-200"
                                : "border-amber-400/35 bg-amber-400/10 text-amber-200"
                            }`}
                          >
                            {entry.verificationStatus}
                          </span>
                          {!entry.provenanceLabel.startsWith("NASA PSI") && <p className="mt-1 text-[10px] text-[#8ea5c7]">{entry.provenanceLabel}</p>}
                        </td>}
                        <td className="px-3 py-3 text-[11px]">
                          {entry.sourceUrl ? (
                            <a
                              href={entry.sourceUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[#52b6ff] hover:underline"
                            >
                              Open <ExternalLink size={11} aria-hidden="true" />
                            </a>
                          ) : (
                            <span className="text-[#6a84a9]">Not available</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Data Ingestion Readiness Dry-Run Validator */}
          <Card
            id="ingestion"
            data-testid="ingestion-readiness-panel"
            className="border border-[#36a9ff]/30 bg-[#09152e]/90 p-5 backdrop-blur-md sm:p-6"
          >
            <div className="flex flex-col gap-3 border-b border-white/10 pb-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="font-mono text-[10px] font-bold tracking-[.16em] text-[#52b6ff] uppercase">
                  Dataset Validator
                </p>
                <h2 className="mt-1 flex items-center gap-2 text-lg font-extrabold text-[#f4f8ff]">
                  <Upload size={18} className="text-[#ff8a32]" aria-hidden="true" />
                  Check a Dataset Before Import
                </h2>
                <p className="mt-1 max-w-2xl text-xs leading-relaxed text-[#9cb2d2]">
                  Paste investigation JSON to check schema, units and duplicate IDs. Nothing is saved.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setJsonInput(examples.duplicate);
                    runDryRunValidation(examples.duplicate);
                  }}
                  className="rounded-xl border border-rose-400/35 bg-rose-500/10 px-3 py-1.5 font-mono text-[10px] font-semibold text-rose-200 hover:border-rose-300"
                >
                  Try a duplicate ID
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setJsonInput(validExample);
                    runDryRunValidation(validExample);
                  }}
                  className="rounded-xl border border-[#36a9ff]/35 bg-[#36a9ff]/10 px-3 py-1.5 font-mono text-[10px] font-semibold text-[#7bc5ff] hover:border-[#36a9ff]"
                >
                  Try a new ID
                </button>
              </div>
            </div>

            <div className="mt-4 grid gap-5 lg:grid-cols-2">
              <div>
                <label
                  htmlFor="ingestion-json-input"
                  className="block font-mono text-[10px] font-semibold tracking-wider text-[#52b6ff] uppercase"
                >
                  Investigation JSON (example: {examples.sourceId ?? "PSI"} record)
                </label>
                <textarea
                  id="ingestion-json-input"
                  value={jsonInput}
                  onChange={(e) => setJsonInput(e.target.value)}
                  rows={12}
                  spellCheck={false}
                  className="mt-2 w-full rounded-xl border border-white/15 bg-[#050b1b] p-3 font-mono text-[11px] leading-relaxed text-[#d7e5fb] focus:border-[#36a9ff] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => runDryRunValidation(jsonInput)}
                  className="mt-3 inline-flex items-center gap-2 rounded-xl bg-[linear-gradient(135deg,#0b3d91_0%,#ff5500_100%)] px-4 py-2 font-mono text-[11px] font-bold tracking-wider text-white uppercase"
                >
                  <FileJson size={14} aria-hidden="true" /> Run Validation
                </button>
              </div>

              <div>
                <p className="font-mono text-[10px] font-semibold tracking-wider text-[#52b6ff] uppercase">
                  Validation Report
                </p>
                {parseError ? (
                  <div className="mt-2 rounded-xl border border-rose-400/35 bg-rose-500/10 p-4 text-xs text-rose-200">
                    JSON syntax error: {parseError}
                  </div>
                ) : importReport ? (
                  <div
                    data-testid="ingestion-report-summary"
                    className="mt-2 space-y-3 rounded-xl border border-white/10 bg-[#050d21]/90 p-4 text-xs"
                  >
                    <div className="grid grid-cols-3 gap-2 font-mono text-center">
                      <div className="rounded-lg border border-emerald-400/25 bg-emerald-500/10 p-2">
                        <span className="block text-[10px] text-emerald-200">Accepted</span>
                        <b className="text-lg text-white">{importReport.acceptedCount}</b>
                      </div>
                      <div className="rounded-lg border border-amber-400/25 bg-amber-400/10 p-2">
                        <span className="block text-[10px] text-amber-200">Warnings</span>
                        <b className="text-lg text-white">{importReport.acceptedWithWarningsCount}</b>
                      </div>
                      <div className="rounded-lg border border-rose-400/25 bg-rose-500/10 p-2">
                        <span className="block text-[10px] text-rose-200">Rejected</span>
                        <b className="text-lg text-white">{importReport.rejectedCount}</b>
                      </div>
                    </div>

                    {importReport.rows.map((row) => (
                      <div
                        key={row.index}
                        className="rounded-lg border border-white/10 bg-[#09152e]/85 p-3"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono font-bold text-[#f4f8ff]">
                            Row #{row.index + 1} · {row.recordId ?? "Unknown ID"}
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 font-mono text-[9.5px] font-bold ${
                              row.status === "REJECTED"
                                ? "border-rose-400/40 bg-rose-500/15 text-rose-200"
                                : row.status === "ACCEPTED_WITH_WARNINGS"
                                  ? "border-amber-400/40 bg-amber-400/15 text-amber-200"
                                  : "border-emerald-400/40 bg-emerald-500/15 text-emerald-200"
                            }`}
                          >
                            {row.status === "REJECTED" ? (
                              <XCircle size={11} aria-hidden="true" />
                            ) : (
                              <CheckCircle2 size={11} aria-hidden="true" />
                            )}
                            {row.status === "REJECTED" ? "Rejected" : row.status === "ACCEPTED_WITH_WARNINGS" ? "Warnings" : "Accepted"}
                          </span>
                        </div>

                        {row.rejectionReasons.length > 0 && (
                          <ul className="mt-2 list-disc space-y-1 pl-4 text-[11px] text-rose-200">
                            {row.rejectionReasons.map((reason) => (
                              <li key={reason}>{reason}</li>
                            ))}
                          </ul>
                        )}

                        {row.warnings.length > 0 && (
                          <ul className="mt-2 list-disc space-y-1 pl-4 text-[11px] text-amber-200">
                            {row.warnings.map((w) => (
                              <li key={w}>{w}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
}
