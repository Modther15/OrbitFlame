import { ArrowLeft, Database, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExploreSpaceBackground } from "@/components/explorer/explore-space-background";
import { TestRunEvidenceSection } from "@/components/investigations/test-run-evidence-drawer";
import { Sidebar } from "@/components/navigation/sidebar";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { investigationRepository } from "@/lib/data/repository";
import { VariablePanel } from "@/components/science/variable-panel";
import { varsFor } from "@/lib/data/variables";
import { loadVariableSummaryServer } from "@/lib/data/variables-server";
import { isRecordVerified } from "@/lib/science/provenance";

export default async function InvestigationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const record = await investigationRepository.getById(id);
  if (!record) notFound();

  const isBenchmark = isRecordVerified(record); // real NASA PSI rows
  const metaOnly = record.rowStatus === "metadata_only";
  const vars = await loadVariableSummaryServer().then((v) => varsFor(v.data, record.id)).catch(() => varsFor(null, record.id));
  const gi = record.gravityInfo;
  const xo2 = record.testRuns.some((r) => r.conditions.some((c) => c.parameterKey === "oxygen_basis"));
  const notStated = "Not reported";
  const gravityText = gi
    ? gi.actualG === null
      ? "Not reported"
      : `${gi.actualG.toFixed(gi.actualG === 0 ? 0 : 2)} g${gi.actualG < 0.05 ? " (microgravity, ISS / Cygnus flight)" : " (ground)"}`
    : record.conditions.gravity;
  const conditionRows: (readonly [string, string, boolean])[] = [
    ["Fuel / Material", record.fuelMaterial, false],
    ["Gravity", gravityText, false],
    ...(gi && gi.nProxyRows > 0
      ? ([["Airflow-Equivalent Gravity", `${gi.nProxyRows} of ${record.testRuns.length} runs, ${Object.entries(gi.proxyBins).map(([b, n]) => `~${{ lunar: "0.16", mars: "0.38", earth: "1" }[b.replace("_eq", "")] ?? b} g (${n})`).join(", ")}`, false]] as const)
      : []),
    [
      "Oxygen Concentration",
      record.conditions.oxygenPercent === null ? notStated : xo2 ? `${record.conditions.oxygenPercent}% (mole fraction ${(record.conditions.oxygenPercent / 100).toFixed(2)})` : `${record.conditions.oxygenPercent}%`,
      record.conditions.oxygenPercent === null,
    ],
    ["Ambient Pressure", record.conditions.pressureKpa === null ? notStated : `${record.conditions.pressureKpa} kPa`, record.conditions.pressureKpa === null],
    ["Airflow Velocity", record.conditions.airflowMps === null ? notStated : `${record.conditions.airflowMps} m/s`, record.conditions.airflowMps === null],
  ];

  return (
    <div className="explore-page-shell relative min-h-screen bg-transparent text-[#f4f8ff] lg:grid lg:grid-cols-[256px_1fr]">
      {/* Calm Photorealistic Deep-Space Background */}
      <ExploreSpaceBackground />

      <Sidebar />

      <main className="explore-main-stage relative z-10 min-w-0 px-5 pb-16 pt-6 sm:px-8 lg:px-12">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-6">
          <div>
            <Link
              href="/explore"
              className="inline-flex items-center gap-2 font-mono text-xs font-semibold tracking-wider text-[#52b6ff] uppercase transition-colors hover:text-[#ff8a32]"
            >
              <ArrowLeft size={14} /> Back to Explore
            </Link>
            <p className="mt-5 font-mono text-xs font-semibold tracking-[.18em] text-[#ff8a32]">
              {`[ ${record.id} // ${record.family} ]`}
            </p>
            <h1 className="mt-2 text-3xl font-extrabold tracking-[-0.03em] text-[#f4f8ff] sm:text-4xl">{record.name}</h1>
          </div>
          <StatusBadge status={isRecordVerified(record) ? "verified" : "demo"} />
        </header>

        <Card className="border border-white/10 bg-[#09152e]/80 p-6 backdrop-blur-md sm:p-8">
          {!isBenchmark && <p className="font-mono text-[10px] font-bold tracking-[.14em] text-amber-300">{record.fixtureLabel}</p>}
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-white/15 bg-white/[0.05] px-3 py-1 text-[11px] font-semibold text-[#c4d7f2]">
              {metaOnly ? "Metadata Only" : `${record.testRuns.length.toLocaleString("en-US")} Test Runs`}
            </span>
          </div>
          <p className="mt-3 text-xs leading-5 text-[#8ea5c7]">
            {[record.hardware ? `Hardware: ${record.hardware}` : "Hardware: none listed in PSI record", record.flightProgram ? `Program: ${record.flightProgram}` : null, record.fuelPhase ? `Fuel phase: ${record.fuelPhase}` : null, record.doi ? `DOI ${record.doi}` : null].filter(Boolean).join(" · ")}
          </p>
          <div className="mt-5 grid gap-6 lg:grid-cols-[1.35fr_.65fr]">
            <div>
              <p className="font-mono text-[10px] font-semibold tracking-[.18em] text-[#52b6ff] uppercase">{isBenchmark ? "Objective" : "FICTIONAL OBJECTIVE"}</p>
              <p className="mt-2 text-base leading-7 font-medium text-[#f4f8ff]">{record.objective}</p>
              <p className="mt-4 text-sm leading-6 text-[#9cb2d2]">{record.summary}</p>
              <div className="mt-5 flex flex-wrap gap-2">
                {record.safetyDomains.map((domain) => (
                  <span
                    key={domain}
                    className="rounded-full border border-[#36a9ff]/25 bg-[#36a9ff]/10 px-3.5 py-1 font-mono text-[11px] font-semibold tracking-wider text-[#52b6ff]"
                  >
                    {domain}
                  </span>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-[linear-gradient(165deg,#0b1936,#060e20)] p-6 text-white shadow-lg">
              <p className="font-mono text-[10px] tracking-[.16em] text-[#ffb067] uppercase">Metadata Completeness</p>
              <p className="mt-3 text-4xl font-extrabold tracking-tight text-white">{record.dataCompleteness}%</p>
              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,#0b3d91,#36a9ff,#ff5500,#f59e0b)]"
                  style={{ width: `${record.dataCompleteness}%` }}
                />
              </div>
              <p className="mt-3 text-xs text-[#9eb7e0]">{isBenchmark ? "Share of key conditions (oxygen, pressure, airflow) reported in the source tables." : "Interface fixture completeness only."}</p>
            </div>
          </div>
        </Card>

        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          <Card className="border border-white/10 bg-[#09152e]/80 p-6 backdrop-blur-md">
            <h2 className="text-lg font-extrabold tracking-tight text-[#f4f8ff]">{isBenchmark ? "Representative Conditions" : "Illustrative conditions"}</h2>
            <p className="mt-1 text-xs text-[#8ea5c7]">{isBenchmark ? "Median of the values reported across this investigation's test runs." : "All present values are fictional and for UI testing only."}</p>
            <dl className="mt-5 divide-y divide-white/10">
              {conditionRows.map(([label, value, missing]) => (
                <div key={label} className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 py-3.5 text-sm">
                  <dt className="font-medium text-[#8ea5c7]">{label}</dt>
                  <dd className={`text-right font-mono text-xs font-semibold ${missing ? "text-[#ff8a32]" : "text-[#f4f8ff]"}`}>
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
            {gi?.note && gi.conflict !== "none" && (
              <p className="mt-4 text-xs leading-5 text-[#9cb2d2]" data-testid="gravity-note">
                The PSI record mentions both flight and ground work; 0 g reflects its ISS / Cygnus flight metadata.
              </p>
            )}
          </Card>

          <Card className="border border-white/10 bg-[#09152e]/80 p-6 backdrop-blur-md">
            <h2 className="text-lg font-extrabold tracking-tight text-[#f4f8ff]">Findings summary</h2>
            <p className="mt-3 text-sm leading-6 text-[#c2d5ee]">{record.findingsSummary}</p>
            {!isBenchmark && (
              <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-amber-400/25 bg-amber-400/10 p-3.5 text-xs leading-5 text-amber-200">
                <ShieldAlert size={16} className="mt-0.5 shrink-0 text-amber-400" />
                <span>This fictional fixture does not describe scientific findings and must not be cited as experimental evidence.</span>
              </div>
            )}
            <div className="mt-5 border-t border-white/10 pt-4">
              <div className="flex items-center gap-2 text-sm font-bold text-[#f4f8ff]">
                <Database size={15} className="text-[#36a9ff]" /> Source references
              </div>
              <p className="mt-1.5 text-xs leading-5 text-[#8ea5c7]">
                {isBenchmark ? `Source: ${record.source?.sourceTitle ?? "NASA PSI"} (psi.nasa.gov). File, sheet and row are listed per test run below.` : "No NASA source references or URLs are attached to fictional demo records."}
              </p>
            </div>
          </Card>
        </div>

        <VariablePanel vars={vars} psiId={record.id} auxiliaryOnly={metaOnly} />

        <TestRunEvidenceSection
          investigationId={record.id}
          investigationName={record.name}
          investigationSource={record.source}
          fixtureLabel={record.fixtureLabel}
          totalRuns={record.testRuns.length}
          initialRuns={[]}
        />

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#09152e]/75 px-5 py-4 backdrop-blur-md">
          <span className="font-mono text-[10.5px] font-semibold tracking-wider text-[#8ea5c7] uppercase">
            Continue in OrbitFlame
          </span>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/compare?ids=${encodeURIComponent(record.id)}`}
              className="rounded-lg border border-[#36a9ff]/35 bg-[#36a9ff]/10 px-3 py-1.5 font-mono text-[10.5px] font-semibold text-[#7bc5ff] hover:border-[#36a9ff]"
            >
              Compare {record.id}
            </Link>
            <Link
              href="/mission-lab"
              className="rounded-lg border border-[#ff8a32]/35 bg-[#ff5500]/10 px-3 py-1.5 font-mono text-[10.5px] font-semibold text-[#ffb067] hover:border-[#ff8a32]"
            >
              Open Mission Lab
            </Link>
            <Link
              href="/technology-map?tab=gaps"
              className="rounded-lg border border-white/15 bg-white/[0.04] px-3 py-1.5 font-mono text-[10.5px] font-semibold text-[#c4d7f2] hover:border-[#36a9ff]"
            >
              View Coverage Gaps
            </Link>
            <Link
              href="/sources"
              className="rounded-lg border border-white/15 bg-white/[0.04] px-3 py-1.5 font-mono text-[10.5px] font-semibold text-[#c4d7f2] hover:border-[#36a9ff]"
            >
              Research Library
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
