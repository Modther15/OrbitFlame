"use client";

import { CheckCircle2, ExternalLink, FileSearch, ShieldAlert, X } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { StatusBadge } from "@/components/ui/status-badge";
import type { AssistantCitation } from "@/lib/assistant/assistant-response-schema";

type CitationEvidenceDrawerProps = {
  citation: AssistantCitation | null;
  onClose: () => void;
};

export function CitationEvidenceDrawer({ citation, onClose }: CitationEvidenceDrawerProps) {
  useEffect(() => {
    if (!citation) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [citation, onClose]);

  if (!citation) return null;

  const badgeStatus = citation.isVerified
    ? "verified"
    : citation.isDemoFixture
      ? "demo"
      : citation.missingStatus === "NOT_REPORTED"
        ? "not-reported"
        : "unverified";

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-[#020612]/75 backdrop-blur-sm"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="citation-drawer-title"
        className="flex h-full w-full max-w-xl flex-col border-l border-white/15 bg-[#060e22] text-[#f4f8ff] shadow-2xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-white/10 px-6 py-5">
          <div className="min-w-0">
            <span className="font-mono text-[10px] font-semibold tracking-[.18em] text-[#52b6ff] uppercase">
              {`CITATION [${citation.citationNumber}] // ${citation.evidenceId}`}
            </span>
            <h2 id="citation-drawer-title" className="mt-1.5 text-lg font-extrabold tracking-tight text-[#f4f8ff]">
              {citation.fieldLabel}
            </h2>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <StatusBadge status={badgeStatus} />
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close citation evidence drawer"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/[0.05] text-[#c4d7f2] transition-colors hover:border-[#36a9ff]/50 hover:bg-white/10 hover:text-white"
          >
            <X size={16} />
          </button>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-6">
          {citation.isDemoFixture && (
            <div className="flex items-start gap-3 rounded-xl border border-amber-400/30 bg-amber-400/10 p-4 text-xs leading-5 text-amber-200">
              <ShieldAlert size={16} className="mt-0.5 shrink-0 text-amber-400" aria-hidden="true" />
              <div>
                <p className="font-mono text-[11px] font-bold tracking-wider text-amber-300 uppercase">
                  DEMO FIXTURE — FICTIONAL DATA — NOT NASA MEASUREMENTS
                </p>
                <p className="mt-1">
                  This citation points to an illustrative demonstration fixture in OrbitFlame&apos;s repository. It is not a
                  verified NASA flight experiment or certified physical finding.
                </p>
              </div>
            </div>
          )}

          <div className="rounded-xl border border-white/10 bg-[#09152e]/75 p-4">
            <p className="font-mono text-[10px] font-semibold tracking-[.16em] text-[#52b6ff] uppercase">
              Retrieved Evidence Record
            </p>
            <dl className="mt-3 grid gap-3.5 text-xs sm:grid-cols-2">
              <div className="sm:col-span-2">
                <dt className="font-mono text-[10px] text-[#7d95b8] uppercase">Investigation ID &amp; Title</dt>
                <dd className="mt-0.5 font-semibold text-[#f4f8ff]">
                  <Link
                    href={`/investigations/${encodeURIComponent(citation.investigationId)}`}
                    className="inline-flex items-center gap-1.5 text-[#52b6ff] underline decoration-[#52b6ff]/40 underline-offset-4 hover:text-white"
                  >
                    {citation.investigationId} — {citation.investigationTitle}
                  </Link>
                </dd>
              </div>

              <div>
                <dt className="font-mono text-[10px] text-[#7d95b8] uppercase">Investigation Family</dt>
                <dd className="mt-0.5 font-mono text-[#e5efff]">{citation.family ?? "NOT REPORTED"}</dd>
              </div>

              <div>
                <dt className="font-mono text-[10px] text-[#7d95b8] uppercase">Test Run ID</dt>
                <dd className={`mt-0.5 font-mono font-semibold ${citation.testRunId ? "text-[#f4f8ff]" : "text-amber-300"}`}>
                  {citation.testRunId ?? "NOT REPORTED"}
                </dd>
              </div>

              <div>
                <dt className="font-mono text-[10px] text-[#7d95b8] uppercase">Evidence Field</dt>
                <dd className="mt-0.5 text-[#dce9fb]">{citation.fieldLabel}</dd>
              </div>

              <div>
                <dt className="font-mono text-[10px] text-[#7d95b8] uppercase">Original Recorded Value &amp; Unit</dt>
                <dd
                  className={`mt-0.5 font-mono font-bold ${
                    citation.missingStatus === "PRESENT" ? "text-[#f4f8ff]" : "text-amber-300"
                  }`}
                >
                  {citation.valueDisplay}
                </dd>
              </div>

              <div className="sm:col-span-2">
                <dt className="font-mono text-[10px] text-[#7d95b8] uppercase">Provenance Status</dt>
                <dd className="mt-1 flex items-center gap-2 font-mono text-[11px]">
                  {citation.isVerified ? (
                    <span className="inline-flex items-center gap-1 text-emerald-300">
                      <CheckCircle2 size={13} aria-hidden="true" />
                      {citation.provenanceStatus} ({citation.provenanceLabel})
                    </span>
                  ) : (
                    <span className="text-amber-300">
                      {citation.provenanceStatus} — {citation.provenanceLabel}
                    </span>
                  )}
                </dd>
              </div>
            </dl>
          </div>

          <div className="rounded-xl border border-white/10 bg-[#09152e]/75 p-4">
            <div className="flex items-center gap-2">
              <FileSearch size={15} className="text-[#36a9ff]" aria-hidden="true" />
              <p className="font-mono text-[10px] font-semibold tracking-[.16em] text-[#52b6ff] uppercase">
                Source Document &amp; Locator
              </p>
            </div>
            <dl className="mt-3 space-y-3 text-xs">
              <div>
                <dt className="font-mono text-[10px] text-[#7d95b8] uppercase">Source Document Title</dt>
                <dd className={`mt-0.5 ${citation.sourceTitle ? "text-[#f4f8ff]" : "font-mono text-amber-300"}`}>
                  {citation.sourceTitle ?? "SOURCE LOCATOR NOT AVAILABLE"}
                </dd>
              </div>

              <div>
                <dt className="font-mono text-[10px] text-[#7d95b8] uppercase">Page / Table / Section Locator</dt>
                <dd
                  className={`mt-0.5 font-mono ${
                    citation.locatorDisplay === "SOURCE LOCATOR NOT AVAILABLE" ? "text-amber-300" : "text-[#dce9fb]"
                  }`}
                >
                  {citation.locatorDisplay}
                </dd>
              </div>

              {citation.sourceUrl ? (
                <div>
                  <dt className="font-mono text-[10px] text-[#7d95b8] uppercase">Source URL</dt>
                  <dd className="mt-1">
                    <a
                      href={citation.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 break-all font-mono text-[11px] text-[#52b6ff] underline underline-offset-4 hover:text-white"
                    >
                      {citation.sourceUrl} <ExternalLink size={12} aria-hidden="true" />
                    </a>
                  </dd>
                </div>
              ) : (
                <div>
                  <dt className="font-mono text-[10px] text-[#7d95b8] uppercase">Source URL</dt>
                  <dd className="mt-0.5 font-mono text-[#7d95b8]">No external source URL attached in repository.</dd>
                </div>
              )}
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}
