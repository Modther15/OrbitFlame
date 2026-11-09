import { ArrowLeft, Database, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Sidebar } from "@/components/navigation/sidebar";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { investigationRepository } from "@/lib/data/repository";

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
    <div className="min-h-screen bg-[#f6f9fd] text-[#071126] lg:grid lg:grid-cols-[256px_1fr]">
      <Sidebar />
      <main className="min-w-0 px-5 pb-16 pt-6 sm:px-8 lg:px-12">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-[#dfe6f2] pb-6">
          <div>
            <Link
              href="/explore"
              className="inline-flex items-center gap-2 font-mono text-xs font-semibold tracking-wider text-[#0b3d91] uppercase hover:text-[#ff5500]"
            >
              <ArrowLeft size={14} /> Back to Explore
            </Link>
            <p className="mt-5 font-mono text-xs font-semibold tracking-[.18em] text-[#ff5500]">
              {`[ ${record.id} // ${record.family} ]`}
            </p>
            <h1 className="mt-2 text-3xl font-extrabold tracking-[-0.03em] text-[#071126] sm:text-4xl">{record.name}</h1>
          </div>
          <StatusBadge status="demo" />
        </header>

        <Card className="p-6 sm:p-8">
          <p className="font-mono text-[10px] font-bold tracking-[.14em] text-amber-700">{record.fixtureLabel}</p>
          <div className="mt-5 grid gap-6 lg:grid-cols-[1.35fr_.65fr]">
            <div>
              <p className="font-mono text-[10px] font-semibold tracking-[.18em] text-[#0b3d91] uppercase">FICTIONAL OBJECTIVE</p>
              <p className="mt-2 text-base leading-7 font-medium text-[#071126]">{record.objective}</p>
              <p className="mt-4 text-sm leading-6 text-[#5b6b88]">{record.summary}</p>
              <div className="mt-5 flex flex-wrap gap-2">
                {record.safetyDomains.map((domain) => (
                  <span
                    key={domain}
                    className="rounded-full border border-[#0b3d91]/25 bg-[#0b3d91]/8 px-3.5 py-1 font-mono text-[11px] font-semibold tracking-wider text-[#0b3d91]"
                  >
                    {domain}
                  </span>
                ))}
              </div>
            </div>

            <div className="rounded-2xl bg-[linear-gradient(165deg,#0b1936,#060e20)] p-6 text-white shadow-lg">
              <p className="font-mono text-[10px] tracking-[.16em] text-[#ffb067] uppercase">METADATA COMPLETENESS</p>
              <p className="mt-3 text-4xl font-extrabold tracking-tight text-white">{record.dataCompleteness}%</p>
              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,#0b3d91,#1785f2,#ff5500,#f59e0b)]"
                  style={{ width: `${record.dataCompleteness}%` }}
                />
              </div>
              <p className="mt-3 text-xs text-[#b5c7e6]">Interface fixture completeness only. Unreported fields remain explicit.</p>
            </div>
          </div>
        </Card>

        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          <Card className="p-6">
            <h2 className="text-lg font-extrabold tracking-tight text-[#071126]">Illustrative conditions</h2>
            <p className="mt-1 text-xs text-[#5b6b88]">All present values are fictional and for UI testing only.</p>
            <dl className="mt-5 divide-y divide-[#dfe6f2]">
              {conditionRows.map(([label, value, missing]) => (
                <div key={label} className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 py-3.5 text-sm">
                  <dt className="font-medium text-[#5b6b88]">{label}</dt>
                  <dd className={`text-right font-mono text-xs font-semibold ${missing ? "text-[#ff5500]" : "text-[#071126]"}`}>
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          </Card>

          <Card className="p-6">
            <h2 className="text-lg font-extrabold tracking-tight text-[#071126]">Findings summary</h2>
            <p className="mt-3 text-sm leading-6 text-[#162442]">{record.findingsSummary}</p>
            <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-amber-500/25 bg-amber-500/8 p-3.5 text-xs leading-5 text-amber-900">
              <ShieldAlert size={16} className="mt-0.5 shrink-0 text-amber-700" />
              <span>This fictional fixture does not describe scientific findings and must not be cited as experimental evidence.</span>
            </div>
            <div className="mt-5 border-t border-[#dfe6f2] pt-4">
              <div className="flex items-center gap-2 text-sm font-bold text-[#071126]">
                <Database size={15} className="text-[#0b3d91]" /> Source references
              </div>
              <p className="mt-1.5 text-xs leading-5 text-[#5b6b88]">
                No NASA source references or URLs are attached to fictional demo records.
              </p>
            </div>
          </Card>
        </div>

        <Card className="mt-6 p-6">
          <h2 className="text-lg font-extrabold tracking-tight text-[#071126]">Illustrative test run</h2>
          <p className="mt-2 font-mono text-xs text-[#5b6b88]">
            {`${record.testRuns[0]?.label} // DEMO FIXTURE — No measured values or source run identifiers are provided.`}
          </p>
        </Card>
      </main>
    </div>
  );
}
