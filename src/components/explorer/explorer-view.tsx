"use client";

import { ArrowUpRight, Filter, GitCompareArrows, Search, SlidersHorizontal, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ExploreSpaceBackground } from "@/components/explorer/explore-space-background";
import { Sidebar } from "@/components/navigation/sidebar";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import type { DemoInvestigation } from "@/lib/api/schemas";
import { useCompareSelection } from "@/lib/state/compare-selection";

const GRAVITY_ORDER: Record<string, number> = {
  microgravity: 0,
  partial: 1,
  normal: 2,
};

function gravityRank(value: string): number {
  const lower = value.toLocaleLowerCase();
  if (lower.includes("microgravity")) return GRAVITY_ORDER.microgravity;
  if (lower.includes("partial")) return GRAVITY_ORDER.partial;
  if (lower.includes("normal")) return GRAVITY_ORDER.normal;
  return 99;
}

export function ExplorerView({ records, initialFamily = "" }: { records: DemoInvestigation[]; initialFamily?: string }) {
  const [query, setQuery] = useState("");
  const [family, setFamily] = useState(initialFamily);
  const [domain, setDomain] = useState("");
  const [gravity, setGravity] = useState("");
  const [showFilters, setShowFilters] = useState(true);
  const [sort, setSort] = useState("name-asc");
  const { selectedIds, toggleId, clearIds } = useCompareSelection();

  const activeFilters = useMemo(() => [family, domain, gravity].filter(Boolean).length, [family, domain, gravity]);
  const families = useMemo(
    () => [...new Set(records.map((record) => record.family).filter((value): value is string => Boolean(value)))].sort(),
    [records],
  );
  const domains = useMemo(() => [...new Set(records.flatMap((record) => record.safetyDomains))].sort(), [records]);
  const gravities = useMemo(
    () =>
      [
        ...new Set(
          records
            .flatMap((record) =>
              record.gravityEnvironments.length > 0 ? record.gravityEnvironments : [record.conditions.gravity],
            )
            .filter(Boolean),
        ),
      ].sort((a, b) => gravityRank(a) - gravityRank(b) || a.localeCompare(b)),
    [records],
  );

  const filteredRecords = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    const results = records.filter((record) => {
      const searchable = [
        record.id,
        record.name,
        record.family,
        record.fuelMaterial,
        record.objective,
        record.findingsSummary,
        record.conditions.gravity,
      ]
        .join(" ")
        .toLocaleLowerCase();
      return (
        (!term || searchable.includes(term)) &&
        (!family || record.family === family) &&
        (!domain || record.safetyDomains.includes(domain as typeof record.safetyDomains[number])) &&
        (!gravity || record.conditions.gravity === gravity || record.gravityEnvironments.includes(gravity))
      );
    });
    if (sort === "name-desc") results.sort((a, b) => b.name.localeCompare(a.name));
    else if (sort === "completeness") results.sort((a, b) => b.dataCompleteness - a.dataCompleteness || a.name.localeCompare(b.name));
    else results.sort((a, b) => a.name.localeCompare(b.name));
    return results;
  }, [records, query, family, domain, gravity, sort]);

  const comparedRecords = useMemo(() => records.filter((r) => selectedIds.includes(r.id)), [records, selectedIds]);

  function toggleCompare(id: string) {
    toggleId(id);
  }

  function clearOnlyFilters() {
    setFamily("");
    setDomain("");
    setGravity("");
  }

  function clearFilters() {
    clearOnlyFilters();
    setQuery("");
  }

  return (
    <div className="explore-page-shell relative min-h-screen bg-transparent text-[#f4f8ff] lg:grid lg:grid-cols-[256px_1fr]">
      {/* Calm Photorealistic Deep-Space Background */}
      <ExploreSpaceBackground />

      <Sidebar />

      <main className="explore-main-stage relative z-10 min-w-0 px-5 pb-16 pt-6 sm:px-8 lg:px-12">
        <header className="explore-header mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-6">
          <div>
            <span className="inline-block rounded-full border border-[#36a9ff]/25 bg-[linear-gradient(90deg,rgba(54,169,255,0.12),rgba(255,138,50,0.1))] px-3 py-1 font-mono text-[10px] font-semibold tracking-[.2em] text-[#52b6ff]">
              [ 01 // RESEARCH CATALOGUE ]
            </span>
            <h1 className="mt-3 text-3xl font-extrabold tracking-[-0.035em] text-[#f4f8ff] sm:text-4xl">
              EXPLORE{" "}
              <span className="bg-[linear-gradient(95deg,#36a9ff_0%,#58b8ff_42%,#ff8a32_78%,#ffaa4c_100%)] bg-clip-text text-transparent">
                INVESTIGATIONS.
              </span>
            </h1>
          </div>
          <StatusBadge status="demo" />
        </header>

        <div className="explore-controls flex flex-wrap gap-3">
          <label className="flex min-h-12 min-w-64 flex-1 items-center gap-3 rounded-2xl border border-white/12 bg-[#09152e]/80 px-4 text-sm text-[#d8e6fa] shadow-xs backdrop-blur-md transition-all focus-within:border-[#36a9ff]/60 focus-within:bg-[#0c1d3e]/90">
            <Search size={17} aria-hidden="true" className="text-[#36a9ff]" />
            <span className="sr-only">Search indexed investigations</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="min-w-0 flex-1 bg-transparent text-[#f4f8ff] outline-none placeholder:text-[#6f88ad]"
              placeholder="Search titles, objectives, materials (e.g. BASS, polymer, droplet)…"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="rounded-lg p-1 text-[#8ea5c7] hover:bg-white/10 hover:text-white"
              >
                <X size={15} />
              </button>
            )}
          </label>
          <button
            type="button"
            onClick={() => setShowFilters((value) => !value)}
            aria-expanded={showFilters}
            className="inline-flex min-h-12 items-center gap-2 rounded-2xl border border-white/12 bg-[#09152e]/80 px-4 text-xs font-semibold tracking-wider text-[#e6effc] uppercase shadow-xs backdrop-blur-md transition-colors hover:border-[#36a9ff]/40 hover:bg-[#0c1d3e]"
          >
            <SlidersHorizontal size={15} className="text-[#ff8a32]" /> Filters{" "}
            {activeFilters > 0 && (
              <span className="rounded-full bg-[linear-gradient(135deg,#0b3d91,#ff5500)] px-2 py-0.5 font-mono text-[10px] text-white">
                {activeFilters}
              </span>
            )}
          </button>
        </div>

        {comparedRecords.length > 0 && (
          <section id="compare" className="mt-6 overflow-hidden rounded-2xl border border-white/10 bg-[linear-gradient(160deg,#0b1936,#060e20)] p-6 text-white shadow-xl backdrop-blur-md">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
              <div className="flex items-center gap-2.5">
                <GitCompareArrows size={18} className="text-[#ff8a32]" />
                <span className="font-mono text-xs tracking-[.16em] text-[#ffb067] uppercase">
                  {`COMPARE MATRIX // ${comparedRecords.length} OF 3 SELECTED`}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href={`/compare?ids=${encodeURIComponent(comparedRecords.map((r) => r.id).join(","))}`}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[linear-gradient(110deg,#0a1b3a_0%,#174585_45%,#2563eb_72%,#ff5500_100%)] bg-[length:240%_100%] bg-[position:0%_50%] px-4 py-1.5 font-mono text-[11px] font-semibold tracking-wider !text-white uppercase shadow-[0_8px_22px_-10px_rgba(37,99,235,0.45)] transition-all duration-500 ease-[cubic-bezier(0.2,0.75,0.2,1)] hover:-translate-y-0.5 hover:bg-[position:100%_50%]"
                >
                  Open full Compare Lab <ArrowUpRight size={13} />
                </Link>
                <button
                  type="button"
                  onClick={clearIds}
                  className="font-mono text-[11px] tracking-wider text-[#9eb7e0] uppercase hover:text-white"
                >
                  Clear comparison
                </button>
              </div>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              {comparedRecords.map((rec) => (
                <div key={rec.id} className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[11px] text-[#ffb067]">{`${rec.id} // ${rec.family}`}</span>
                    <button
                      type="button"
                      onClick={() => toggleCompare(rec.id)}
                      aria-label={`Remove ${rec.id}`}
                      className="text-[#9eb7e0] hover:text-white"
                    >
                      <X size={14} />
                    </button>
                  </div>
                  <h3 className="mt-1.5 text-sm font-bold text-white">{rec.name}</h3>
                  <dl className="mt-3 space-y-1.5 border-t border-white/10 pt-2.5 font-mono text-[11px]">
                    <div className="flex justify-between gap-2">
                      <dt className="text-[#8fb1e8]">Material</dt>
                      <dd className="text-right text-white">{rec.fuelMaterial}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-[#8fb1e8]">O₂ (%)</dt>
                      <dd className={rec.conditions.oxygenPercent === null ? "text-amber-300" : "text-white"}>
                        {rec.conditions.oxygenPercent === null ? "NOT REPORTED" : `${rec.conditions.oxygenPercent}%`}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-[#8fb1e8]">Pressure</dt>
                      <dd className={rec.conditions.pressureKpa === null ? "text-amber-300" : "text-white"}>
                        {rec.conditions.pressureKpa === null ? "NOT REPORTED" : `${rec.conditions.pressureKpa} kPa`}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-[#8fb1e8]">Airflow</dt>
                      <dd className={rec.conditions.airflowMps === null ? "text-amber-300" : "text-white"}>
                        {rec.conditions.airflowMps === null ? "NOT REPORTED" : `${rec.conditions.airflowMps} m/s`}
                      </dd>
                    </div>
                  </dl>
                </div>
              ))}
            </div>
          </section>
        )}

        <div className={`mt-6 grid gap-6 ${showFilters ? "xl:grid-cols-[270px_1fr]" : "grid-cols-1"}`}>
          {showFilters && (
            <Card className="h-fit border border-white/10 bg-[#09152e]/80 p-5 text-[#e6effc] shadow-lg backdrop-blur-md">
              <div className="flex items-center justify-between border-b border-white/10 pb-3">
                <h2 className="text-sm font-bold tracking-tight text-[#f4f8ff]">Refine catalogue</h2>
                <Filter size={15} className="text-[#ff8a32]" />
              </div>
              <label className="mt-4 block font-mono text-[10px] font-semibold tracking-[.14em] text-[#8ea5c7] uppercase">
                Investigation family
                <select
                  value={family}
                  onChange={(event) => setFamily(event.target.value)}
                  className="mt-2 min-h-11 w-full rounded-xl border border-white/12 bg-[#060e22]/90 px-3 font-sans text-sm font-medium text-[#f0f5fc] outline-none transition-colors focus:border-[#36a9ff]"
                >
                  <option value="">All families</option>
                  {families.map((option) => (
                    <option key={option} value={option} className="bg-[#060e22] text-[#f0f5fc]">
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <label className="mt-4 block font-mono text-[10px] font-semibold tracking-[.14em] text-[#8ea5c7] uppercase">
                Safety domain
                <select
                  value={domain}
                  onChange={(event) => setDomain(event.target.value)}
                  className="mt-2 min-h-11 w-full rounded-xl border border-white/12 bg-[#060e22]/90 px-3 font-sans text-sm font-medium text-[#f0f5fc] outline-none transition-colors focus:border-[#36a9ff]"
                >
                  <option value="">All domains</option>
                  {domains.map((option) => (
                    <option key={option} value={option} className="bg-[#060e22] text-[#f0f5fc]">
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <label className="mt-4 block font-mono text-[10px] font-semibold tracking-[.14em] text-[#8ea5c7] uppercase">
                Gravity environment
                <select
                  value={gravity}
                  onChange={(event) => setGravity(event.target.value)}
                  className="mt-2 min-h-11 w-full rounded-xl border border-white/12 bg-[#060e22]/90 px-3 font-sans text-sm font-medium text-[#f0f5fc] outline-none transition-colors focus:border-[#36a9ff]"
                >
                  <option value="" className="bg-[#060e22] text-[#f0f5fc]">All environments</option>
                  {gravities.map((option) => (
                    <option key={option} value={option} className="bg-[#060e22] text-[#f0f5fc]">
                      {option}
                    </option>
                  ))}
                </select>
              </label>
              <p className="mt-4 rounded-xl border border-amber-400/25 bg-amber-400/10 p-3 text-xs leading-5 text-amber-200">
                Fictional fixture values for interface testing only. Missing parameters are never coerced to zero.
              </p>
              <button
                type="button"
                onClick={clearFilters}
                className="mt-4 min-h-10 w-full rounded-full border border-white/15 text-xs font-semibold tracking-wider text-[#e6effc] uppercase transition-colors hover:border-[#36a9ff]/40 hover:bg-white/10 hover:text-white"
              >
                Reset filters
              </button>
            </Card>
          )}

          <div>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <p className="font-mono text-xs tracking-wider text-[#8ea5c7] uppercase" aria-live="polite">
                {`${filteredRecords.length} FICTIONAL DEMO ${filteredRecords.length === 1 ? "RECORD" : "RECORDS"}`}
              </p>
              <label className="flex items-center gap-2 font-mono text-[11px] text-[#8ea5c7] uppercase">
                Sort
                <select
                  value={sort}
                  onChange={(event) => setSort(event.target.value)}
                  className="min-h-10 rounded-xl border border-white/12 bg-[#060e22]/90 px-3 font-sans text-xs font-semibold text-[#f0f5fc] outline-none focus:border-[#36a9ff]"
                >
                  <option value="name-asc" className="bg-[#060e22] text-[#f0f5fc]">Name A–Z</option>
                  <option value="name-desc" className="bg-[#060e22] text-[#f0f5fc]">Name Z–A</option>
                  <option value="completeness" className="bg-[#060e22] text-[#f0f5fc]">Data completeness</option>
                </select>
              </label>
            </div>

            {filteredRecords.length ? (
              <div className="grid gap-4">
                {filteredRecords.map((record) => {
                  const isCompared = selectedIds.includes(record.id);
                  return (
                    <Card
                      key={record.id}
                      className="explore-card-item border border-white/10 bg-[#09152e]/80 p-6 backdrop-blur-md transition-all hover:border-[#36a9ff]/40 hover:bg-[#0b1b3b]/85 hover:shadow-[0_16px_36px_-12px_rgba(54,169,255,0.18)]"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <span className="font-mono text-[11px] font-semibold tracking-[.16em] text-[#ff8a32]">
                            {`${record.id} // ${record.family}`}
                          </span>
                          <h2 className="mt-1.5 text-xl font-bold tracking-tight text-[#f4f8ff]">{record.name}</h2>
                        </div>
                        <StatusBadge status="demo" />
                      </div>
                      <p className="mt-2.5 text-sm text-[#9cb2d2]">
                        {record.fuelMaterial} · {record.conditions.gravity} ·{" "}
                        <span className="font-semibold text-[#52b6ff]">{record.safetyDomains.join(", ")}</span>
                      </p>
                      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
                        <span className="font-mono text-[11px] tracking-wider text-[#7d95b8] uppercase">
                          {`Completeness ${record.dataCompleteness}% · ${record.testRuns.length} illustrative run`}
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => toggleCompare(record.id)}
                            className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-semibold tracking-wider uppercase transition-all duration-500 ease-[cubic-bezier(0.2,0.75,0.2,1)] ${
                              isCompared
                                ? "border-transparent bg-[linear-gradient(135deg,#ff5500,#f59e0b)] !text-white shadow-[0_10px_22px_-8px_rgba(255,85,0,0.5)]"
                                : "border-white/15 bg-white/[0.05] text-[#d8e6fa] hover:-translate-y-0.5 hover:border-[#ff5500]/50 hover:bg-white/[0.1] hover:text-white"
                            }`}
                          >
                            <GitCompareArrows size={13} /> {isCompared ? "Comparing" : "Compare"}
                          </button>
                          <Link
                            href={`/investigations/${record.id}`}
                            className="inline-flex items-center gap-1.5 rounded-full bg-[linear-gradient(110deg,#0a1b3a_0%,#174585_45%,#2563eb_72%,#ff5500_100%)] bg-[length:240%_100%] bg-[position:0%_50%] px-4 py-2 text-xs font-semibold tracking-wider !text-white uppercase shadow-[0_8px_22px_-10px_rgba(37,99,235,0.45)] transition-all duration-500 ease-[cubic-bezier(0.2,0.75,0.2,1)] hover:-translate-y-0.5 hover:bg-[position:100%_50%] hover:shadow-[0_14px_28px_-10px_rgba(255,85,0,0.5)]"
                          >
                            Open details <ArrowUpRight size={13} />
                          </Link>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <Card className="flex min-h-[280px] flex-col items-center justify-center border border-white/10 bg-[#09152e]/80 p-8 text-center backdrop-blur-md">
                <span className="inline-block rounded-full border border-[#ff8a32]/30 bg-[#ff8a32]/10 px-3 py-1 font-mono text-[10px] font-semibold tracking-[.16em] text-[#ffb067] uppercase">
                  0 MATCHES FOUND
                </span>
                <h2 className="mt-3 text-xl font-bold text-[#f4f8ff]">No matching demo records</h2>
                <p className="mt-2 max-w-md text-sm text-[#8ea5c7]">
                  {query && activeFilters > 0
                    ? `No investigations match "${query.trim()}" with the ${activeFilters} active filter${activeFilters === 1 ? "" : "s"}.`
                    : query
                      ? `No investigations match "${query.trim()}".`
                      : "No investigations match the selected filter combination."}
                </p>
                <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                  {query && (
                    <button
                      type="button"
                      onClick={() => setQuery("")}
                      className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.06] px-4 py-2 text-xs font-semibold tracking-wider text-[#e6effc] uppercase transition-colors hover:border-[#36a9ff]/40 hover:bg-white/[0.12] hover:text-white"
                    >
                      <X size={13} /> Clear search
                    </button>
                  )}
                  {activeFilters > 0 && (
                    <button
                      type="button"
                      onClick={clearOnlyFilters}
                      className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.06] px-4 py-2 text-xs font-semibold tracking-wider text-[#e6effc] uppercase transition-colors hover:border-[#ff8a32]/40 hover:bg-white/[0.12] hover:text-white"
                    >
                      <Filter size={13} /> Reset filters
                    </button>
                  )}
                  {(query || activeFilters > 0) && (
                    <button
                      type="button"
                      onClick={clearFilters}
                      className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-[linear-gradient(110deg,#0a1b3a_0%,#174585_45%,#2563eb_72%,#ff5500_100%)] bg-[length:240%_100%] bg-[position:0%_50%] px-5 py-2 text-xs font-semibold tracking-wider !text-white uppercase shadow-[0_8px_22px_-10px_rgba(37,99,235,0.45)] transition-all duration-500 ease-[cubic-bezier(0.2,0.75,0.2,1)] hover:-translate-y-0.5 hover:bg-[position:100%_50%]"
                    >
                      Show all {records.length} records
                    </button>
                  )}
                </div>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
