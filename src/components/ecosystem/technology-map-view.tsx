"use client";

import { ArrowRight, Compass, FlaskConical, GitCompareArrows, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ExploreSpaceBackground } from "@/components/explorer/explore-space-background";
import { Sidebar } from "@/components/navigation/sidebar";
import { EarthApplications, HardwareMap } from "@/components/science/science-context";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  type TechDomainKey,
  type TechnologyMapReport,
  type TechMapRecordNode,
} from "@/lib/science/technology-map";
import { setCompareIds } from "@/lib/state/compare-selection";

const DOMAIN_COLORS: Record<TechDomainKey, { stroke: string; badge: string }> = {
  PREVENTION: { stroke: "#36a9ff", badge: "border-[#36a9ff]/40 bg-[#36a9ff]/15 text-[#7bc5ff]" },
  DETECTION: { stroke: "#ff8a32", badge: "border-[#ff8a32]/40 bg-[#ff5500]/15 text-[#ffb067]" },
  SUPPRESSION: { stroke: "#34d399", badge: "border-emerald-400/40 bg-emerald-500/15 text-emerald-200" },
};

export function TechnologyMapView({ report }: { report: TechnologyMapReport }) {
  const [activeDomain, setActiveDomain] = useState<TechDomainKey>("PREVENTION");
  const [selectedRecordId, setSelectedRecordId] = useState<string>(report.allNodes[0]?.id ?? "");

  const currentCluster =
    report.clusters.find((c) => c.domain === activeDomain) ?? report.clusters[0];

  const activeNode: TechMapRecordNode | null =
    report.allNodes.find((n) => n.id === selectedRecordId) ?? currentCluster.records[0] ?? null;

  const scopeBadgeStatus =
    report.datasetScope.scope === "VERIFIED_INDEXED_DATA"
      ? "verified"
      : report.datasetScope.scope === "EMPTY"
        ? "empty"
        : "demo";

  const domainY: Record<TechDomainKey, number> = {
    PREVENTION: 66,
    DETECTION: 170,
    SUPPRESSION: 274,
  };

  return (
    <div className="relative min-h-screen overflow-x-clip bg-[#050b1b] text-[#f4f8ff] lg:grid lg:grid-cols-[260px_1fr]">
      <ExploreSpaceBackground />
      <Sidebar />

      <main className="explore-main-stage relative z-10 min-w-0 px-4 py-6 sm:px-8 sm:py-8 lg:px-10 lg:py-9">
        <div className="mx-auto max-w-[1220px] space-y-6">
          <Card className="border border-white/10 bg-[#09152e]/85 p-5 backdrop-blur-md sm:p-7">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="font-mono text-[10px] font-semibold tracking-[.18em] text-[#52b6ff] uppercase">
                  RESEARCH ECOSYSTEM // METADATA RELATIONSHIP MAP
                </p>
                <h1 className="mt-1.5 flex items-center gap-2.5 text-2xl font-extrabold tracking-tight text-[#f4f8ff] sm:text-3xl">
                  <FlaskConical size={26} className="text-[#36a9ff]" aria-hidden="true" />
                  Fire-Safety Technology Map
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#9cb2d2]">
                  Explore the relationships between indexed research domains, technologies, investigations, and recorded
                  experimental equipment.
                </p>
              </div>
              <div className="flex flex-col items-start gap-2 lg:items-end">
                <StatusBadge status={scopeBadgeStatus} />
                <span className="font-mono text-[11px] text-[#8ea5c7]">
                  {report.datasetScope.activeDatasetBanner}
                </span>
              </div>
            </div>

            <div
              data-testid="tech-map-noncausal-banner"
              className="mt-5 flex items-start gap-3 rounded-xl border border-amber-400/35 bg-amber-400/10 p-3.5 text-xs leading-5 text-amber-100"
            >
              <ShieldAlert size={17} className="mt-0.5 shrink-0 text-amber-300" aria-hidden="true" />
              <p className="font-medium text-[#fbe6b5]">{report.nonCausalNotice}</p>
            </div>
          </Card>

          {/* Interactive Constellation SVG + Domain Switcher */}
          <div className="grid gap-6 xl:grid-cols-[1.25fr_0.9fr]">
            <Card className="border border-white/10 bg-[#09152e]/85 p-5 backdrop-blur-md">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
                <span className="font-mono text-[10.5px] font-bold tracking-[.16em] text-[#52b6ff] uppercase">
                  DOMAIN-TO-INVESTIGATION CONSTELLATION (CLICK PILLAR OR RECORD NODE)
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {report.clusters.map((cluster) => (
                    <button
                      key={cluster.domain}
                      type="button"
                      onClick={() => {
                        setActiveDomain(cluster.domain);
                        if (cluster.records[0]) setSelectedRecordId(cluster.records[0].id);
                      }}
                      aria-pressed={activeDomain === cluster.domain}
                      className={`rounded-lg border px-2.5 py-1 font-mono text-[10px] font-bold ${
                        activeDomain === cluster.domain
                          ? DOMAIN_COLORS[cluster.domain].badge
                          : "border-white/10 bg-[#050b1b] text-[#8ea5c7] hover:text-white"
                      }`}
                    >
                      {cluster.domain} ({cluster.recordCount})
                    </button>
                  ))}
                </div>
              </div>

              <svg
                viewBox="0 0 680 340"
                className="h-auto w-full select-none rounded-xl border border-white/10 bg-[#050d21]/90"
                role="img"
                aria-label="Metadata grouping constellation connecting Prevention, Detection, and Suppression pillars to indexed investigations"
              >
                {/* Left Column: 3 Fire Safety Pillars */}
                {report.clusters.map((cluster) => {
                  const y = domainY[cluster.domain];
                  const isActive = activeDomain === cluster.domain;
                  const c = DOMAIN_COLORS[cluster.domain];
                  return (
                    <g
                      key={cluster.domain}
                      className="cursor-pointer"
                      onClick={() => {
                        setActiveDomain(cluster.domain);
                        if (cluster.records[0]) setSelectedRecordId(cluster.records[0].id);
                      }}
                    >
                      <rect
                        x="22"
                        y={y - 34}
                        width="174"
                        height="68"
                        rx="12"
                        fill={isActive ? "#0d254f" : "#08132b"}
                        stroke={c.stroke}
                        strokeWidth={isActive ? 2.2 : 1.1}
                        opacity={isActive ? 1 : 0.72}
                      />
                      <text x="36" y={y - 8} fill={c.stroke} fontSize="10" fontFamily="monospace" fontWeight="700">
                        {cluster.domain}
                      </text>
                      <text x="36" y={y + 12} fill="#f4f8ff" fontSize="12.5" fontWeight="700">
                        {cluster.recordCount} indexed record(s)
                      </text>
                      <text x="36" y={y + 26} fill="#8ea5c7" fontSize="9.5" fontFamily="monospace">
                        {cluster.familiesRepresented.join(" · ") || "0 families"}
                      </text>
                    </g>
                  );
                })}

                {/* Connecting Lines + Right Column Nodes for Active Cluster */}
                {currentCluster.records.map((node, idx) => {
                  const total = Math.max(1, currentCluster.records.length);
                  const spacing = Math.min(48, 280 / total);
                  const startY = 170 - ((total - 1) * spacing) / 2;
                  const ny = startY + idx * spacing;
                  const sy = domainY[currentCluster.domain];
                  const selected = activeNode?.id === node.id;
                  const stroke = DOMAIN_COLORS[currentCluster.domain].stroke;

                  return (
                    <g
                      key={node.id}
                      className="cursor-pointer"
                      onClick={() => setSelectedRecordId(node.id)}
                    >
                      <path
                        d={`M 196 ${sy} C 260 ${sy}, 270 ${ny}, 332 ${ny}`}
                        fill="none"
                        stroke={stroke}
                        strokeWidth={selected ? 2.2 : 1.2}
                        strokeDasharray={selected ? undefined : "4 4"}
                        opacity={selected ? 0.95 : 0.55}
                      />
                      <rect
                        x="332"
                        y={ny - 18}
                        width="326"
                        height="36"
                        rx="9"
                        fill={selected ? "#0f2754" : "#09152e"}
                        stroke={selected ? stroke : "rgba(255,255,255,0.14)"}
                        strokeWidth={selected ? 1.8 : 1}
                      />
                      <text x="346" y={ny - 2} fill="#ff8a32" fontSize="9.5" fontFamily="monospace" fontWeight="700">
                        {node.id} {node.family ? `// ${node.family}` : ""}
                      </text>
                      <text x="346" y={ny + 11} fill="#e5efff" fontSize="10.5" fontWeight="600">
                        {node.name.length > 42 ? `${node.name.slice(0, 42)}…` : node.name}
                      </text>
                    </g>
                  );
                })}
              </svg>

              <div className="mt-4 rounded-xl border border-white/10 bg-[#050d21]/85 p-3.5 text-xs">
                <p className="font-mono text-[10px] font-bold tracking-wider text-[#52b6ff] uppercase">
                  {currentCluster.title}
                </p>
                <p className="mt-1 leading-relaxed text-[#c9daf2]">{currentCluster.engineeringFocus}</p>
                <p className="mt-2 font-mono text-[10.5px] text-amber-200">{currentCluster.interpretationCaveat}</p>
              </div>
            </Card>

            {/* Right: Selected Node Relationship & Instrumentation Details */}
            <Card className="border border-white/10 bg-[#09152e]/85 p-5 backdrop-blur-md">
              <p className="font-mono text-[10.5px] font-bold tracking-[.16em] text-[#52b6ff] uppercase">
                SELECTED RECORD METADATA &amp; INSTRUMENTATION SLOT
              </p>

              {!activeNode ? (
                <p className="mt-4 text-xs text-[#8ea5c7]">No records are currently indexed under this pillar.</p>
              ) : (
                <div className="mt-4 space-y-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold text-[#ff8a32]">
                        {activeNode.id} {activeNode.family ? `// ${activeNode.family}` : ""}
                      </span>
                      <span
                        className={`rounded-full border px-2.5 py-0.5 font-mono text-[9.5px] font-bold ${
                          DOMAIN_COLORS[activeNode.domain].badge
                        }`}
                      >
                        {activeNode.domain}
                      </span>
                    </div>
                    <h2 className="mt-1.5 text-lg font-extrabold text-[#f4f8ff]">{activeNode.name}</h2>
                    <p className="mt-1 font-mono text-[10px] text-amber-200">{activeNode.provenanceLabel}</p>
                  </div>

                  <dl className="divide-y divide-white/10 rounded-xl border border-white/10 bg-[#050d21]/85 px-4 text-xs">
                    <div className="flex justify-between gap-3 py-2.5">
                      <dt className="text-[#8ea5c7]">Fuel / Material</dt>
                      <dd className="text-right font-medium text-[#f4f8ff]">{activeNode.fuelMaterial}</dd>
                    </div>
                    <div className="flex justify-between gap-3 py-2.5">
                      <dt className="text-[#8ea5c7]">Gravity Environment</dt>
                      <dd className="text-right font-mono text-[#f4f8ff]">{activeNode.gravity}</dd>
                    </div>
                    <div className="flex justify-between gap-3 py-2.5">
                      <dt className="text-[#8ea5c7]">Oxygen Concentration</dt>
                      <dd className="text-right font-mono text-[#f4f8ff]">{activeNode.oxygenDisplay}</dd>
                    </div>
                    <div className="flex justify-between gap-3 py-2.5">
                      <dt className="text-[#8ea5c7]">Pressure</dt>
                      <dd className="text-right font-mono text-[#f4f8ff]">{activeNode.pressureDisplay}</dd>
                    </div>
                    <div className="flex justify-between gap-3 py-2.5">
                      <dt className="text-[#8ea5c7]">Airflow</dt>
                      <dd className="text-right font-mono text-[#f4f8ff]">{activeNode.airflowDisplay}</dd>
                    </div>
                    <div className="flex justify-between gap-3 py-2.5">
                      <dt className="text-[#8ea5c7]">Mapped measurement values</dt>
                      <dd className="text-right font-mono text-amber-200">
                        {activeNode.measurementChannelCount > 0
                          ? `${activeNode.measurementChannelCount} measurement value(s) mapped`
                          : "NO PER-TEST ROWS (metadata & protocol only)"}
                      </dd>
                    </div>
                  </dl>

                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/investigations/${encodeURIComponent(activeNode.id)}`}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[linear-gradient(135deg,#0b3d91_0%,#ff5500_100%)] px-3.5 py-2 font-mono text-[10.5px] font-bold text-white uppercase"
                    >
                      Inspect Record <ArrowRight size={12} aria-hidden="true" />
                    </Link>
                    <Link
                      href={`/compare?ids=${encodeURIComponent(activeNode.id)}`}
                      onClick={() => setCompareIds([activeNode.id])}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2 font-mono text-[10.5px] font-semibold text-[#c4d7f2] hover:border-[#36a9ff]"
                    >
                      <GitCompareArrows size={12} aria-hidden="true" /> Compare
                    </Link>
                    <Link
                      href="/mission-lab"
                      className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.04] px-3 py-2 font-mono text-[10.5px] font-semibold text-[#7bc5ff] hover:border-[#36a9ff]"
                    >
                      <Compass size={12} aria-hidden="true" /> Mission Lab
                    </Link>
                  </div>
                </div>
              )}
            </Card>
          </div>
          <HardwareMap />
          <EarthApplications />
        </div>
      </main>
    </div>
  );
}
