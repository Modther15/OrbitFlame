"use client";

import {
  AlertTriangle,
  ArrowLeft,
  ArrowUpRight,
  Check,
  CheckCircle2,
  Copy,
  FileJson,
  FileSpreadsheet,
  GitCompareArrows,
  Info,
  Plus,
  ShieldAlert,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { CompareVisualizations } from "@/components/compare/compare-visualizations";
import { ExploreSpaceBackground } from "@/components/explorer/explore-space-background";
import { Sidebar } from "@/components/navigation/sidebar";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import type { DemoInvestigation } from "@/lib/api/schemas";
import {
  buildCompareCsvExport,
  buildCompareJsonExport,
  buildComparisonMatrix,
  buildComparisonSummary,
  type ComparisonStatus,
} from "@/lib/science/compare";
import { setCompareIds, useCompareSelection } from "@/lib/state/compare-selection";

type CompareViewProps = {
  records: DemoInvestigation[];
  initialIdsParam: string | null;
};

const STATUS_META: Record<ComparisonStatus, { label: string; badgeClass: string }> = {
  EXACT_MATCH: {
    label: "EXACT MATCH",
    badgeClass: "border-cyan-400/35 bg-cyan-400/12 text-cyan-200",
  },
  DIFFERENT: {
    label: "DIFFERENT",
    badgeClass: "border-[#ff8a32]/40 bg-[#ff8a32]/15 text-[#ffb067]",
  },
  PARTIALLY_COMPARABLE: {
    label: "PARTIALLY COMPARABLE",
    badgeClass: "border-amber-300/35 bg-amber-400/12 text-amber-200",
  },
  UNKNOWN_NOT_REPORTED: {
    label: "UNKNOWN / NOT REPORTED",
    badgeClass: "border-white/20 bg-white/[0.06] text-[#9cb2d2]",
  },
};

function triggerDownload(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function CompareView({ records, initialIdsParam }: CompareViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { selectedIds: storedIds, replaceIds, clearIds, maxItems } = useCompareSelection();

  const [pickerValue, setPickerValue] = useState("");
  const [copiedLink, setCopiedLink] = useState(false);

  const liveIdsParam = searchParams.get("ids");
  const effectiveIdsParam = liveIdsParam !== null ? liveIdsParam : initialIdsParam;

  const parsedUrl = useMemo(() => {
    if (effectiveIdsParam === null) {
      return { hasUrlParam: false, validIds: [] as string[], invalidTokens: [] as string[], overflowCount: 0 };
    }
    const tokens = effectiveIdsParam
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const recordMap = new Map(records.map((r) => [r.id.toLocaleLowerCase(), r.id]));
    const validIds: string[] = [];
    const invalidTokens: string[] = [];

    for (const token of tokens) {
      const canonical = recordMap.get(token.toLocaleLowerCase());
      if (!canonical) {
        invalidTokens.push(token);
      } else if (!validIds.includes(canonical)) {
        validIds.push(canonical);
      }
    }

    const overflowCount = Math.max(0, validIds.length - maxItems);
    return {
      hasUrlParam: true,
      validIds: validIds.slice(0, maxItems),
      invalidTokens,
      overflowCount,
    };
  }, [effectiveIdsParam, records, maxItems]);

  const activeIds = parsedUrl.hasUrlParam ? parsedUrl.validIds : storedIds;

  // Keep shared selection storage synchronized with valid URL IDs (without triggering state loops).
  useEffect(() => {
    if (!parsedUrl.hasUrlParam) return;
    const target = parsedUrl.validIds;
    const isSame = target.length === storedIds.length && target.every((id, idx) => id === storedIds[idx]);
    if (!isSame) {
      setCompareIds(target);
    }
  }, [parsedUrl.hasUrlParam, parsedUrl.validIds, storedIds]);

  const selectedRecords = useMemo(() => {
    const byId = new Map(records.map((r) => [r.id, r]));
    return activeIds.map((id) => byId.get(id)).filter((r): r is DemoInvestigation => Boolean(r));
  }, [records, activeIds]);

  const availableToAdd = useMemo(
    () => records.filter((r) => !activeIds.includes(r.id)).sort((a, b) => a.id.localeCompare(b.id)),
    [records, activeIds],
  );

  const matrixRows = useMemo(
    () => (selectedRecords.length >= 2 ? buildComparisonMatrix(selectedRecords) : []),
    [selectedRecords],
  );
  const summary = useMemo(
    () => (selectedRecords.length >= 2 ? buildComparisonSummary(selectedRecords, matrixRows) : null),
    [selectedRecords, matrixRows],
  );

  const allVerified =
    selectedRecords.length > 0 &&
    selectedRecords.every((r) => r.provenanceStatus === "NASA_VERIFIED_DATA" && r.source?.verificationStatus === "VERIFIED");
  const hasDemoFixtures = selectedRecords.length === 0 || selectedRecords.some((r) => r.provenanceStatus === "DEMO_FIXTURE");
  const badgeStatus = allVerified ? "verified" : hasDemoFixtures ? "demo" : "unverified";

  function applySelection(nextIds: string[]) {
    const clean = replaceIds(nextIds);
    const nextUrl = clean.length > 0 ? `/compare?ids=${encodeURIComponent(clean.join(","))}` : "/compare";
    router.push(nextUrl, { scroll: false });
  }

  function handleAddRecord(idToAdd: string) {
    if (!idToAdd || activeIds.includes(idToAdd) || activeIds.length >= maxItems) return;
    applySelection([...activeIds, idToAdd]);
    setPickerValue("");
  }

  function handleRemoveRecord(idToRemove: string) {
    applySelection(activeIds.filter((id) => id !== idToRemove));
  }

  function handleClearAll() {
    clearIds();
    router.push("/compare", { scroll: false });
  }

  async function handleCopyShareLink() {
    if (typeof window === "undefined") return;
    const shareUrl = `${window.location.origin}/compare?ids=${encodeURIComponent(activeIds.join(","))}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);
      window.setTimeout(() => setCopiedLink(false), 1800);
    } catch {
      // Fallback: focus URL bar or fail quietly
    }
  }

  function handleExportJson() {
    if (!summary || selectedRecords.length < 2) return;
    const content = buildCompareJsonExport(selectedRecords, matrixRows, summary);
    triggerDownload(`orbitflame-compare-${selectedRecords.map((r) => r.id).join("-")}.json`, content, "application/json;charset=utf-8");
  }

  function handleExportCsv() {
    if (selectedRecords.length < 2) return;
    const content = buildCompareCsvExport(selectedRecords, matrixRows);
    triggerDownload(`orbitflame-compare-${selectedRecords.map((r) => r.id).join("-")}.csv`, content, "text/csv;charset=utf-8");
  }

  return (
    <div className="explore-page-shell relative min-h-screen bg-transparent text-[#f4f8ff] lg:grid lg:grid-cols-[256px_1fr]">
      <ExploreSpaceBackground />
      <Sidebar />

      <main className="explore-main-stage relative z-10 min-w-0 px-4 pb-16 pt-6 sm:px-8 lg:px-10">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-6">
          <div>
            <Link
              href="/explore"
              className="inline-flex items-center gap-2 font-mono text-xs font-semibold tracking-wider text-[#52b6ff] uppercase transition-colors hover:text-[#ff8a32]"
            >
              <ArrowLeft size={14} /> Back to Explore
            </Link>
            <div className="mt-4">
              <span className="inline-block rounded-full border border-[#36a9ff]/25 bg-[linear-gradient(90deg,rgba(54,169,255,0.12),rgba(255,138,50,0.1))] px-3 py-1 font-mono text-[10px] font-semibold tracking-[.2em] text-[#52b6ff]">
                [ 02 // COMPARE LAB ]
              </span>
            </div>
            <h1 className="mt-3 text-3xl font-extrabold tracking-[-0.035em] text-[#f4f8ff] sm:text-4xl">
              COMPARE{" "}
              <span className="bg-[linear-gradient(95deg,#36a9ff_0%,#58b8ff_42%,#ff8a32_78%,#ffaa4c_100%)] bg-clip-text text-transparent">
                INVESTIGATIONS.
              </span>
            </h1>
          </div>
          <StatusBadge status={badgeStatus} />
        </header>

        {(parsedUrl.invalidTokens.length > 0 || parsedUrl.overflowCount > 0) && (
          <div
            role="alert"
            className="mb-6 flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-amber-400/35 bg-amber-400/10 p-4 text-xs text-amber-200 backdrop-blur-md"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-400" aria-hidden="true" />
              <div className="space-y-1">
                {parsedUrl.invalidTokens.length > 0 && (
                  <p>
                    <strong className="font-mono text-amber-300 uppercase">Invalid URL investigation ID(s):</strong>{" "}
                    <span className="font-mono">{parsedUrl.invalidTokens.join(", ")}</span> could not be resolved and were omitted.
                  </p>
                )}
                {parsedUrl.overflowCount > 0 && (
                  <p>Compare Lab supports up to {maxItems} investigations side-by-side. Extra URL IDs were truncated.</p>
                )}
              </div>
            </div>
            {parsedUrl.validIds.length > 0 && (
              <button
                type="button"
                onClick={() => applySelection(parsedUrl.validIds)}
                className="rounded-full border border-amber-300/30 bg-amber-400/10 px-3 py-1 font-mono text-[10px] font-semibold tracking-wider text-amber-200 uppercase hover:bg-amber-400/20"
              >
                Clean URL
              </button>
            )}
          </div>
        )}

        {/* Selection Bar */}
        <Card className="border border-white/10 bg-[#09152e]/80 p-5 backdrop-blur-md">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
            <div className="flex items-center gap-2.5">
              <GitCompareArrows size={17} className="text-[#ff8a32]" aria-hidden="true" />
              <span className="font-mono text-xs font-semibold tracking-[.16em] text-[#ffb067] uppercase">
                {`SELECTED RECORDS // ${selectedRecords.length} OF ${maxItems}`}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {selectedRecords.length >= 2 && (
                <>
                  <button
                    type="button"
                    onClick={handleCopyShareLink}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.05] px-3.5 py-1.5 text-xs font-semibold tracking-wider text-[#e6effc] uppercase transition-colors hover:border-[#36a9ff]/40 hover:bg-white/10"
                  >
                    {copiedLink ? <Check size={13} className="text-cyan-300" /> : <Copy size={13} />}
                    {copiedLink ? "Copied link" : "Share URL"}
                  </button>
                  <button
                    type="button"
                    onClick={handleExportJson}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-[#36a9ff]/35 bg-[#36a9ff]/12 px-3.5 py-1.5 text-xs font-semibold tracking-wider text-[#8fd1ff] uppercase transition-colors hover:border-[#36a9ff]/60 hover:bg-[#36a9ff]/20 hover:text-white"
                  >
                    <FileJson size={13} /> Export JSON
                  </button>
                  <button
                    type="button"
                    onClick={handleExportCsv}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-[#ff8a32]/35 bg-[#ff8a32]/12 px-3.5 py-1.5 text-xs font-semibold tracking-wider text-[#ffb067] uppercase transition-colors hover:border-[#ff8a32]/60 hover:bg-[#ff8a32]/20 hover:text-white"
                  >
                    <FileSpreadsheet size={13} /> Export CSV
                  </button>
                </>
              )}
              {selectedRecords.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-white/15 px-3.5 py-1.5 text-xs font-semibold tracking-wider text-[#9eb7e0] uppercase transition-colors hover:border-white/30 hover:bg-white/[0.08] hover:text-white"
                >
                  <Trash2 size={13} /> Clear all
                </button>
              )}
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {selectedRecords.map((rec) => (
              <div
                key={rec.id}
                className="flex flex-col justify-between rounded-xl border border-white/12 bg-[#060e22]/80 p-4"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] font-bold tracking-[.14em] text-[#ff8a32]">
                      {`${rec.id} // ${rec.family ?? "UNCLASSIFIED"}`}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveRecord(rec.id)}
                      aria-label={`Remove ${rec.id} from comparison`}
                      className="rounded-lg p-1 text-[#8ea5c7] transition-colors hover:bg-white/10 hover:text-white"
                    >
                      <X size={14} />
                    </button>
                  </div>
                  <h2 className="mt-1.5 text-sm font-bold text-[#f4f8ff]">{rec.name}</h2>
                  <p className="mt-1 text-xs text-[#8ea5c7]">
                    {rec.fuelMaterial} · {rec.conditions.gravity}
                  </p>
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-2.5">
                  <span className="font-mono text-[10px] text-amber-300">
                    {rec.provenanceStatus === "DEMO_FIXTURE" ? "DEMO FIXTURE" : rec.provenanceStatus}
                  </span>
                  <Link
                    href={`/investigations/${rec.id}`}
                    className="inline-flex items-center gap-1 font-mono text-[10px] font-semibold tracking-wider text-[#52b6ff] uppercase hover:text-[#ff8a32]"
                  >
                    Details <ArrowUpRight size={11} />
                  </Link>
                </div>
              </div>
            ))}

            {selectedRecords.length < maxItems && (
              <div className="flex flex-col justify-between rounded-xl border border-dashed border-white/20 bg-white/[0.02] p-4">
                <div>
                  <span className="font-mono text-[10px] font-semibold tracking-[.16em] text-[#52b6ff] uppercase">
                    {`ADD INVESTIGATION (${selectedRecords.length}/${maxItems})`}
                  </span>
                  <label className="mt-2 block text-xs text-[#9cb2d2]">
                    <span className="sr-only">Select an investigation to compare</span>
                    <select
                      value={pickerValue}
                      onChange={(event) => handleAddRecord(event.target.value)}
                      className="mt-1 min-h-10 w-full rounded-xl border border-white/15 bg-[#060e22] px-3 text-xs font-medium text-[#f0f5fc] outline-none focus:border-[#36a9ff]"
                    >
                      <option value="">Choose record to add…</option>
                      {availableToAdd.map((opt) => (
                        <option key={opt.id} value={opt.id} className="bg-[#060e22] text-[#f0f5fc]">
                          {`${opt.id} — ${opt.name} (${opt.family ?? "Other"})`}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <p className="mt-3 font-mono text-[10px] text-[#7d95b8]">
                  Or select from{" "}
                  <Link href="/explore" className="text-[#52b6ff] underline hover:text-[#ff8a32]">
                    Research Explorer
                  </Link>
                </p>
              </div>
            )}
          </div>
        </Card>

        {/* Empty / Single-Record State */}
        {selectedRecords.length < 2 && (
          <Card className="mt-6 border border-white/10 bg-[#09152e]/80 p-8 text-center backdrop-blur-md">
            <span className="inline-block rounded-full border border-[#36a9ff]/30 bg-[#36a9ff]/10 px-3 py-1 font-mono text-[10px] font-semibold tracking-[.16em] text-[#52b6ff] uppercase">
              {selectedRecords.length === 0 ? "NO INVESTIGATIONS SELECTED" : "SELECT AT LEAST ONE MORE INVESTIGATION"}
            </span>
            <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-[#f4f8ff]">
              {selectedRecords.length === 0
                ? "Select 2 to 3 investigations to compare"
                : "Add a second investigation to unlock the comparison matrix"}
            </h2>
            <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[#9cb2d2]">
              Compare experimental conditions, gravity regimes, units, missing fields, and provenance side-by-side without
              conflating incompatible metrics or unverified values.
            </p>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              {selectedRecords.length === 0 ? (
                <>
                  <button
                    type="button"
                    onClick={() => applySelection(["D-001", "D-004"])}
                    className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-[linear-gradient(110deg,#0a1b3a_0%,#174585_45%,#2563eb_72%,#ff5500_100%)] bg-[length:240%_100%] bg-[position:0%_50%] px-5 py-2 text-xs font-semibold tracking-wider !text-white uppercase shadow-[0_8px_22px_-10px_rgba(37,99,235,0.45)] transition-all duration-500 ease-[cubic-bezier(0.2,0.75,0.2,1)] hover:-translate-y-0.5 hover:bg-[position:100%_50%]"
                  >
                    <Plus size={14} /> Compare D-001 &amp; D-004
                  </button>
                  <button
                    type="button"
                    onClick={() => applySelection(["D-001", "D-006", "D-009"])}
                    className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.06] px-4 py-2 text-xs font-semibold tracking-wider text-[#e6effc] uppercase transition-colors hover:border-[#ff8a32]/50 hover:bg-white/[0.12] hover:text-white"
                  >
                    <Plus size={14} /> Compare D-001, D-006 &amp; D-009
                  </button>
                </>
              ) : (
                availableToAdd[0] && (
                  <button
                    type="button"
                    onClick={() => handleAddRecord(availableToAdd[0].id)}
                    className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-[linear-gradient(110deg,#0a1b3a_0%,#174585_45%,#2563eb_72%,#ff5500_100%)] bg-[length:240%_100%] bg-[position:0%_50%] px-5 py-2 text-xs font-semibold tracking-wider !text-white uppercase shadow-[0_8px_22px_-10px_rgba(37,99,235,0.45)] transition-all duration-500 ease-[cubic-bezier(0.2,0.75,0.2,1)] hover:-translate-y-0.5 hover:bg-[position:100%_50%]"
                  >
                    <Plus size={14} /> Add {availableToAdd[0].id} to compare
                  </button>
                )
              )}
              <Link
                href="/explore"
                className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-white/15 px-4 py-2 text-xs font-semibold tracking-wider text-[#d8e6fa] uppercase transition-colors hover:border-[#36a9ff]/40 hover:bg-white/[0.08] hover:text-white"
              >
                Browse Research Explorer <ArrowUpRight size={13} />
              </Link>
            </div>
          </Card>
        )}

        {/* Comparison Matrix & Summary */}
        {selectedRecords.length >= 2 && summary && (
          <>
            {/* Provenance Banner */}
            {hasDemoFixtures && (
              <div className="mt-6 flex items-start gap-3 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4 text-xs leading-5 text-amber-200 backdrop-blur-md">
                <ShieldAlert size={16} className="mt-0.5 shrink-0 text-amber-400" aria-hidden="true" />
                <div>
                  <p className="font-mono text-[11px] font-bold tracking-wider text-amber-300 uppercase">
                    DEMO FIXTURE PROVENANCE NOTICE
                  </p>
                  <p className="mt-1">
                    Demo fixtures carry illustrative UI test data and are <strong className="text-amber-100">never labelled VERIFIED</strong>.
                    Missing fields are never equated or coerced to zero, and unit conversions occur only on explicitly known source units.
                  </p>
                </div>
              </div>
            )}

            <CompareVisualizations records={selectedRecords} matrixRows={matrixRows} />

            {/* Desktop Matrix Table (xl and up) */}
            <Card className="mt-6 hidden overflow-hidden border border-white/10 bg-[#09152e]/85 p-0 backdrop-blur-md xl:block">
              <div className="border-b border-white/10 px-6 py-4">
                <span className="font-mono text-[10px] font-semibold tracking-[.16em] text-[#52b6ff] uppercase">
                  COMPATIBLE-DIMENSION MATRIX
                </span>
                <h2 className="mt-1 text-lg font-extrabold tracking-tight text-[#f4f8ff]">Side-by-Side Comparison Matrix</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-white/10 bg-[#060e22]/85 font-mono text-[10px] tracking-[.14em] text-[#8ea5c7] uppercase">
                      <th className="w-[180px] px-5 py-3.5 font-semibold">Dimension</th>
                      <th className="w-[175px] px-4 py-3.5 font-semibold">Relationship</th>
                      {selectedRecords.map((rec) => (
                        <th key={rec.id} className="min-w-[180px] px-5 py-3.5 font-semibold text-[#f4f8ff]">
                          <span className="text-[#ff8a32]">{rec.id}</span> · {rec.family ?? "Other"}
                          <span className="mt-0.5 block font-sans text-xs font-semibold normal-case tracking-normal text-[#c2d5ee]">
                            {rec.name}
                          </span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {matrixRows.map((row) => {
                      const meta = STATUS_META[row.status];
                      return (
                        <tr key={row.key} className="align-top transition-colors hover:bg-white/[0.02]">
                          <td className="px-5 py-4">
                            <p className="font-semibold text-[#f4f8ff]">{row.label}</p>
                            <p className="mt-1 text-[11px] leading-4 text-[#7d95b8]">{row.note}</p>
                          </td>
                          <td className="px-4 py-4">
                            <span
                              className={`inline-block rounded-full border px-2.5 py-1 font-mono text-[10px] font-semibold tracking-wider ${meta.badgeClass}`}
                            >
                              {meta.label}
                            </span>
                          </td>
                          {row.cells.map((cell) => (
                            <td key={`${row.key}-${cell.recordId}`} className="px-5 py-4">
                              <p
                                className={`text-sm font-semibold ${
                                  cell.missingStatus === "NOT_REPORTED"
                                    ? "font-mono text-xs text-amber-300"
                                    : cell.rawNumericValue !== null
                                      ? "font-mono text-[#f4f8ff]"
                                      : "text-[#e6effc]"
                                }`}
                              >
                                {cell.displayValue}
                                {cell.unit ? ` ${cell.unit}` : ""}
                              </p>
                              {cell.siDisplay && (
                                <p className="mt-1 font-mono text-[11px] text-[#8ea5c7]">SI: {cell.siDisplay}</p>
                              )}
                              <div className="mt-2">
                                {cell.isVerified ? (
                                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/35 bg-emerald-400/15 px-2 py-0.5 font-mono text-[9px] font-semibold tracking-wider text-emerald-300">
                                    <CheckCircle2 size={10} /> VERIFIED
                                  </span>
                                ) : cell.isDemoFixture ? (
                                  <span className="inline-block rounded-full border border-sky-400/25 bg-sky-400/10 px-2 py-0.5 font-mono text-[9px] font-semibold tracking-wider text-sky-300">
                                    DEMO ONLY
                                  </span>
                                ) : (
                                  <span className="inline-block rounded-full border border-white/15 bg-white/[0.05] px-2 py-0.5 font-mono text-[9px] font-semibold tracking-wider text-[#9cb2d2]">
                                    {cell.provenanceLabel}
                                  </span>
                                )}
                              </div>
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Tablet / Mobile Responsive Comparison Cards (< xl) */}
            <div className="mt-6 space-y-4 xl:hidden">
              {matrixRows.map((row) => {
                const meta = STATUS_META[row.status];
                return (
                  <Card key={row.key} className="border border-white/10 bg-[#09152e]/85 p-4 backdrop-blur-md">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
                      <h3 className="text-sm font-bold text-[#f4f8ff]">{row.label}</h3>
                      <span
                        className={`inline-block rounded-full border px-2.5 py-0.5 font-mono text-[9.5px] font-semibold tracking-wider ${meta.badgeClass}`}
                      >
                        {meta.label}
                      </span>
                    </div>
                    <p className="mt-2.5 text-xs leading-5 text-[#8ea5c7]">{row.note}</p>
                    <div className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                      {row.cells.map((cell) => (
                        <div
                          key={`${row.key}-m-${cell.recordId}`}
                          className="rounded-xl border border-white/10 bg-[#060e22]/80 p-3"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono text-[11px] font-bold text-[#ff8a32]">{cell.recordId}</span>
                            {cell.isVerified ? (
                              <span className="font-mono text-[9px] font-semibold text-emerald-300">VERIFIED</span>
                            ) : cell.isDemoFixture ? (
                              <span className="font-mono text-[9px] font-semibold text-sky-300">DEMO ONLY</span>
                            ) : (
                              <span className="font-mono text-[9px] font-semibold text-[#9cb2d2]">{cell.provenanceLabel}</span>
                            )}
                          </div>
                          <p
                            className={`mt-1 text-xs font-semibold ${
                              cell.missingStatus === "NOT_REPORTED" ? "font-mono text-amber-300" : "text-[#f4f8ff]"
                            }`}
                          >
                            {cell.displayValue}
                            {cell.unit ? ` ${cell.unit}` : ""}
                          </p>
                          {cell.siDisplay && <p className="mt-0.5 font-mono text-[10px] text-[#8ea5c7]">SI: {cell.siDisplay}</p>}
                        </div>
                      ))}
                    </div>
                  </Card>
                );
              })}
            </div>

            {/* Evidence-Based Deterministic Comparison Summary */}
            <Card className="mt-6 border border-white/10 bg-[#09152e]/85 p-6 backdrop-blur-md">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-4">
                <div>
                  <span className="font-mono text-[10px] font-semibold tracking-[.16em] text-[#ff8a32] uppercase">
                    RULE-BASED DETERMINISTIC SYNTHESIS
                  </span>
                  <h2 className="mt-1 text-lg font-extrabold tracking-tight text-[#f4f8ff]">
                    Evidence-Based Comparison Summary
                  </h2>
                </div>
                <span className="rounded-full border border-white/15 bg-white/[0.05] px-3 py-1 font-mono text-[10px] tracking-wider text-[#9eb7e0] uppercase">
                  NO LLM INFERENCE
                </span>
              </div>

              <div className="mt-5 grid gap-5 lg:grid-cols-2">
                <div className="rounded-xl border border-cyan-400/20 bg-cyan-400/[0.04] p-4">
                  <h3 className="font-mono text-xs font-bold tracking-wider text-cyan-300 uppercase">
                    Genuinely Shared Dimensions ({summary.shared.length})
                  </h3>
                  {summary.shared.length > 0 ? (
                    <ul className="mt-2.5 list-disc space-y-1.5 pl-4 text-xs leading-5 text-[#d8e6fa]">
                      {summary.shared.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-xs text-[#8ea5c7]">No non-missing dimensions are an exact match across all selected records.</p>
                  )}
                </div>

                <div className="rounded-xl border border-[#ff8a32]/25 bg-[#ff8a32]/[0.05] p-4">
                  <h3 className="font-mono text-xs font-bold tracking-wider text-[#ffb067] uppercase">
                    Documented Differences ({summary.differences.length})
                  </h3>
                  {summary.differences.length > 0 ? (
                    <ul className="mt-2.5 list-disc space-y-1.5 pl-4 text-xs leading-5 text-[#e6effc]">
                      {summary.differences.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-xs text-[#8ea5c7]">No directly comparable fields showed differing reported values.</p>
                  )}
                </div>

                <div className="rounded-xl border border-amber-400/25 bg-amber-400/[0.05] p-4">
                  <h3 className="font-mono text-xs font-bold tracking-wider text-amber-300 uppercase">
                    Cannot Compare Directly ({summary.cannotCompare.length})
                  </h3>
                  {summary.cannotCompare.length > 0 ? (
                    <ul className="mt-2.5 list-disc space-y-1.5 pl-4 text-xs leading-5 text-amber-100/90">
                      {summary.cannotCompare.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-xs text-[#8ea5c7]">All evaluated dimensions had directly comparable inputs.</p>
                  )}
                </div>

                <div className="rounded-xl border border-white/15 bg-white/[0.03] p-4">
                  <h3 className="font-mono text-xs font-bold tracking-wider text-[#9cb2d2] uppercase">
                    Missing Evidence &amp; Gaps ({summary.missingEvidence.length})
                  </h3>
                  {summary.missingEvidence.length > 0 ? (
                    <ul className="mt-2.5 list-disc space-y-1.5 pl-4 text-xs leading-5 text-[#c2d5ee]">
                      {summary.missingEvidence.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-xs text-[#8ea5c7]">No unreported dimensions detected among evaluated rows.</p>
                  )}
                </div>
              </div>

              <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-white/10 bg-[#060e22]/80 p-4 text-xs leading-5 text-[#9eb7e0]">
                <Info size={15} className="mt-0.5 shrink-0 text-[#36a9ff]" aria-hidden="true" />
                <ul className="space-y-1">
                  {summary.provenanceNotes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              </div>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
