"use client";

import { ArrowUpRight, Filter, GitCompareArrows, Search, SlidersHorizontal, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Sidebar } from "@/components/navigation/sidebar";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import type { DemoInvestigation } from "@/lib/api/schemas";

export function ExplorerView({ records, initialFamily = "" }: { records: DemoInvestigation[]; initialFamily?: string }) {
  const [query, setQuery] = useState("");
  const [family, setFamily] = useState(initialFamily);
  const [domain, setDomain] = useState("");
  const [showFilters, setShowFilters] = useState(true);
  const [sort, setSort] = useState("name-asc");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const activeFilters = useMemo(() => [family, domain].filter(Boolean).length, [family, domain]);
  const families = [...new Set(records.map((record) => record.family).filter((value): value is string => Boolean(value)))].sort();
  const domains = [...new Set(records.flatMap((record) => record.safetyDomains))].sort();

  const filteredRecords = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    const results = records.filter((record) => {
      const searchable = [record.id, record.name, record.family, record.fuelMaterial, record.objective, record.findingsSummary]
        .join(" ")
        .toLocaleLowerCase();
      return (
        (!term || searchable.includes(term)) &&
        (!family || record.family === family) &&
        (!domain || record.safetyDomains.includes(domain as typeof record.safetyDomains[number]))
      );
    });
    if (sort === "name-desc") results.sort((a, b) => b.name.localeCompare(a.name));
    else if (sort === "completeness") results.sort((a, b) => b.dataCompleteness - a.dataCompleteness);
    else results.sort((a, b) => a.name.localeCompare(b.name));
    return results;
  }, [records, query, family, domain, sort]);

  const comparedRecords = useMemo(() => records.filter((r) => selectedIds.includes(r.id)), [records, selectedIds]);

  function toggleCompare(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : prev.length < 3 ? [...prev, id] : prev));
  }

  function clearFilters() {
    setFamily("");
    setDomain("");
    setQuery("");
  }

  return (
    <div className="min-h-screen bg-[#f6f9fd] text-[#071126] lg:grid lg:grid-cols-[256px_1fr]">
      <Sidebar />
      <main className="min-w-0 px-5 pb-16 pt-6 sm:px-8 lg:px-12">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-[#dfe6f2] pb-6">
          <div>
            <span className="inline-block rounded-full border border-[#0b3d91]/20 bg-[linear-gradient(90deg,rgba(11,61,145,0.06),rgba(255,85,0,0.06))] px-3 py-1 font-mono text-[10px] font-semibold tracking-[.2em] text-[#0b3d91]">
              [ 01 // RESEARCH CATALOGUE ]
            </span>
            <h1 className="mt-3 text-3xl font-extrabold tracking-[-0.035em] text-[#071126] sm:text-4xl">
              EXPLORE{" "}
              <span className="bg-[linear-gradient(95deg,#0b3d91_0%,#1785f2_42%,#ff5500_78%,#f59e0b_100%)] bg-clip-text text-transparent">
                INVESTIGATIONS.
              </span>
            </h1>
          </div>
          <StatusBadge status="demo" />
        </header>

        <div className="flex flex-wrap gap-3">
          <label className="flex min-h-12 min-w-64 flex-1 items-center gap-3 rounded-2xl border border-[#dfe6f2] bg-white px-4 text-sm text-[#5b6b88] shadow-xs transition-all focus-within:border-[#ff5500]/50">
            <Search size={17} aria-hidden="true" className="text-[#0b3d91]" />
            <span className="sr-only">Search indexed investigations</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="min-w-0 flex-1 bg-transparent text-[#071126] outline-none placeholder:text-[#8c9bbd]"
              placeholder="Search titles, objectives, materials (e.g. BASS, polymer, droplet)…"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="rounded-lg p-1 text-[#5b6b88] hover:bg-[#edf2fa] hover:text-[#071126]"
              >
                <X size={15} />
              </button>
            )}
          </label>
          <button
            type="button"
            onClick={() => setShowFilters((value) => !value)}
            aria-expanded={showFilters}
            className="inline-flex min-h-12 items-center gap-2 rounded-2xl border border-[#dfe6f2] bg-white px-4 text-xs font-semibold tracking-wider text-[#071126] uppercase shadow-xs hover:border-[#b8c7e0]"
          >
            <SlidersHorizontal size={15} className="text-[#ff5500]" /> Filters{" "}
            {activeFilters > 0 && (
              <span className="rounded-full bg-[linear-gradient(135deg,#0b3d91,#ff5500)] px-2 py-0.5 font-mono text-[10px] text-white">
                {activeFilters}
              </span>
            )}
          </button>
        </div>

        {comparedRecords.length > 0 && (
          <section id="compare" className="mt-6 overflow-hidden rounded-2xl bg-[linear-gradient(160deg,#0b1936,#060e20)] p-6 text-white shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-4">
              <div className="flex items-center gap-2.5">
                <GitCompareArrows size={18} className="text-[#ff6b1a]" />
                <span className="font-mono text-xs tracking-[.16em] text-[#ffb067] uppercase">
                  {`COMPARE MATRIX // ${comparedRecords.length} OF 3 SELECTED`}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedIds([])}
                className="font-mono text-[11px] tracking-wider text-[#9eb7e0] uppercase hover:text-white"
              >
                Clear comparison
              </button>
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
            <Card className="h-fit p-5">
              <div className="flex items-center justify-between border-b border-[#dfe6f2] pb-3">
                <h2 className="text-sm font-bold tracking-tight text-[#071126]">Refine catalogue</h2>
                <Filter size={15} className="text-[#ff5500]" />
              </div>
              <label className="mt-4 block font-mono text-[10px] font-semibold tracking-[.14em] text-[#5b6b88] uppercase">
                Investigation family
                <select
                  value={family}
                  onChange={(event) => setFamily(event.target.value)}
                  className="mt-2 min-h-11 w-full rounded-xl border border-[#dfe6f2] bg-[#f6f9fd] px-3 font-sans text-sm font-medium text-[#071126] outline-none focus:border-[#0b3d91]"
                >
                  <option value="">All families</option>
                  {families.map((option) => (
                    <option key={option}>{option}</option>
                  ))}
                </select>
              </label>
              <label className="mt-4 block font-mono text-[10px] font-semibold tracking-[.14em] text-[#5b6b88] uppercase">
                Safety domain
                <select
                  value={domain}
                  onChange={(event) => setDomain(event.target.value)}
                  className="mt-2 min-h-11 w-full rounded-xl border border-[#dfe6f2] bg-[#f6f9fd] px-3 font-sans text-sm font-medium text-[#071126] outline-none focus:border-[#0b3d91]"
                >
                  <option value="">All domains</option>
                  {domains.map((option) => (
                    <option key={option}>{option}</option>
                  ))}
                </select>
              </label>
              <label className="mt-4 block font-mono text-[10px] font-semibold tracking-[.14em] text-[#5b6b88] uppercase">
                Gravity environment
                <select
                  value=""
                  disabled
                  className="mt-2 min-h-11 w-full rounded-xl border border-[#dfe6f2] bg-[#edf2fa] px-3 font-sans text-sm text-[#8c9bbd]"
                >
                  <option>All environments</option>
                </select>
              </label>
              <p className="mt-4 rounded-xl bg-amber-500/8 p-3 text-xs leading-5 text-amber-900">
                Fictional fixture values for interface testing only. Missing parameters are never coerced to zero.
              </p>
              <button
                type="button"
                onClick={clearFilters}
                className="mt-4 min-h-10 w-full rounded-full border border-[#dfe6f2] text-xs font-semibold tracking-wider text-[#071126] uppercase transition-colors hover:bg-[#071126] hover:text-white"
              >
                Reset filters
              </button>
            </Card>
          )}

          <div>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <p className="font-mono text-xs tracking-wider text-[#5b6b88] uppercase" aria-live="polite">
                {`${filteredRecords.length} FICTIONAL DEMO ${filteredRecords.length === 1 ? "RECORD" : "RECORDS"}`}
              </p>
              <label className="flex items-center gap-2 font-mono text-[11px] text-[#5b6b88] uppercase">
                Sort
                <select
                  value={sort}
                  onChange={(event) => setSort(event.target.value)}
                  className="min-h-10 rounded-xl border border-[#dfe6f2] bg-white px-3 font-sans text-xs font-semibold text-[#071126]"
                >
                  <option value="name-asc">Name A–Z</option>
                  <option value="name-desc">Name Z–A</option>
                  <option value="completeness">Data completeness</option>
                </select>
              </label>
            </div>

            {filteredRecords.length ? (
              <div className="grid gap-4">
                {filteredRecords.map((record) => {
                  const isCompared = selectedIds.includes(record.id);
                  return (
                    <Card key={record.id} className="p-6 transition-all hover:border-[#ff5500]/35 hover:shadow-md">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <span className="font-mono text-[11px] font-semibold tracking-[.16em] text-[#ff5500]">
                            {`${record.id} // ${record.family}`}
                          </span>
                          <h2 className="mt-1.5 text-xl font-bold tracking-tight text-[#071126]">{record.name}</h2>
                        </div>
                        <StatusBadge status="demo" />
                      </div>
                      <p className="mt-2.5 text-sm text-[#5b6b88]">
                        {record.fuelMaterial} · {record.conditions.gravity} ·{" "}
                        <span className="font-semibold text-[#0b3d91]">{record.safetyDomains.join(", ")}</span>
                      </p>
                      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[#dfe6f2] pt-4">
                        <span className="font-mono text-[11px] tracking-wider text-[#5b6b88] uppercase">
                          {`Completeness ${record.dataCompleteness}% · ${record.testRuns.length} illustrative run`}
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => toggleCompare(record.id)}
                            className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-xs font-semibold tracking-wider uppercase transition-all ${
                              isCompared
                                ? "border-transparent bg-[linear-gradient(135deg,#ff5500,#f59e0b)] !text-white"
                                : "border-[#dfe6f2] bg-white text-[#071126] hover:border-[#ff5500]"
                            }`}
                          >
                            <GitCompareArrows size={13} /> {isCompared ? "Comparing" : "Compare"}
                          </button>
                          <Link
                            href={`/investigations/${record.id}`}
                            className="inline-flex items-center gap-1.5 rounded-full bg-[linear-gradient(135deg,#071126_0%,#0b3d91_100%)] px-4 py-2 text-xs font-semibold tracking-wider !text-white uppercase transition-transform hover:-translate-y-0.5 hover:bg-[linear-gradient(135deg,#0b3d91_0%,#ff5500_100%)]"
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
              <Card className="flex min-h-[280px] flex-col items-center justify-center p-8 text-center">
                <h2 className="text-xl font-bold text-[#071126]">No matching demo records</h2>
                <p className="mt-2 text-sm text-[#5b6b88]">Try a different search keyword or reset the active filters.</p>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
