import { ArrowLeft, Database, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExploreSpaceBackground } from "@/components/explorer/explore-space-background";
import { TestRunEvidenceSection } from "@/components/investigations/test-run-evidence-drawer";
import { Sidebar } from "@/components/navigation/sidebar";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { investigationRepository } from "@/lib/data/repository";
import { isRecordVerified } from "@/lib/science/provenance";

export default async function InvestigationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const record = await investigationRepository.getById(id);
  if (!record) notFound();

  const conditionRows = [
    ["Fuel / material", record.fuelMaterial, false],
    ["Gravity environment", record.conditions.gravity, false],
    [
      "Oxygen concentration",
      record.conditions.oxygenPercent === null ? "NOT REPORTED / DEMO_MISSING" : `${record.conditions.oxygenPercent}% · illustrative`,
      record.conditions.oxygenPercent === null,
    ],
    [
      "Pressure",
      record.conditions.pressureKpa === null ? "NOT REPORTED / DEMO_MISSING" : `${record.conditions.pressureKpa} kPa · illustrative`,
      record.conditions.pressureKpa === null,
    ],
    [
      "Airflow",
      record.conditions.airflowMps === null ? "NOT REPORTED / DEMO_MISSING" : `${record.conditions.airflowMps} m/s · illustrative`,
      record.conditions.airflowMps === null,
    ],
  ] as const;

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
          <p className="font-mono text-[10px] font-bold tracking-[.14em] text-amber-300">{record.fixtureLabel}</p>
          <div className="mt-5 grid gap-6 lg:grid-cols-[1.35fr_.65fr]">
            <div>
              <p className="font-mono text-[10px] font-semibold tracking-[.18em] text-[#52b6ff] uppercase">FICTIONAL OBJECTIVE</p>
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
              <p className="font-mono text-[10px] tracking-[.16em] text-[#ffb067] uppercase">METADATA COMPLETENESS</p>
              <p className="mt-3 text-4xl font-extrabold tracking-tight text-white">{record.dataCompleteness}%</p>
              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,#0b3d91,#36a9ff,#ff5500,#f59e0b)]"
                  style={{ width: `${record.dataCompleteness}%` }}
                />
              </div>
              <p className="mt-3 text-xs text-[#9eb7e0]">Interface fixture completeness only. Unreported fields remain explicit.</p>
            </div>
          </div>
        </Card>

        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          <Card className="border border-white/10 bg-[#09152e]/80 p-6 backdrop-blur-md">
            <h2 className="text-lg font-extrabold tracking-tight text-[#f4f8ff]">Illustrative conditions</h2>
            <p className="mt-1 text-xs text-[#8ea5c7]">All present values are fictional and for UI testing only.</p>
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
          </Card>

          <Card className="border border-white/10 bg-[#09152e]/80 p-6 backdrop-blur-md">
            <h2 className="text-lg font-extrabold tracking-tight text-[#f4f8ff]">Findings summary</h2>
            <p className="mt-3 text-sm leading-6 text-[#c2d5ee]">{record.findingsSummary}</p>
            <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-amber-400/25 bg-amber-400/10 p-3.5 text-xs leading-5 text-amber-200">
              <ShieldAlert size={16} className="mt-0.5 shrink-0 text-amber-400" />
              <span>This fictional fixture does not describe scientific findings and must not be cited as experimental evidence.</span>
            </div>
            <div className="mt-5 border-t border-white/10 pt-4">
              <div className="flex items-center gap-2 text-sm font-bold text-[#f4f8ff]">
                <Database size={15} className="text-[#36a9ff]" /> Source references
              </div>
              <p className="mt-1.5 text-xs leading-5 text-[#8ea5c7]">
                No NASA source references or URLs are attached to fictional demo records.
              </p>
            </div>
          </Card>
        </div>

        <TestRunEvidenceSection
          investigationId={record.id}
          investigationName={record.name}
          investigationSource={record.source}
          fixtureLabel={record.fixtureLabel}
          testRuns={record.testRuns}
        />

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 bg-[#09152e]/75 px-5 py-4 backdrop-blur-md">
          <span className="font-mono text-[10.5px] font-semibold tracking-wider text-[#8ea5c7] uppercase">
            CONTINUE WORKFLOW ACROSS ORBITFLAME
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
              href="/evidence-gaps"
              className="rounded-lg border border-white/15 bg-white/[0.04] px-3 py-1.5 font-mono text-[10.5px] font-semibold text-[#c4d7f2] hover:border-[#36a9ff]"
            >
              Inspect Evidence Gaps
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
