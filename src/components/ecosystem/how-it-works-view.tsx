"use client";

import { Calculator, CheckCircle2, Database, FileSearch, Layers, MessageSquare, Scale, XCircle } from "lucide-react";
import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { ExploreSpaceBackground } from "@/components/explorer/explore-space-background";
import { Sidebar } from "@/components/navigation/sidebar";
import { Card } from "@/components/ui/card";
import type { DatasetScopeSummary } from "@/lib/science/provenance";
import { checkNumericUnitCompatibility, normalizeToKnownSi } from "@/lib/science/units";

const SECTIONS = [
  ["#data", "Data"],
  ["#units", "Units"],
  ["#ranking", "Habitat Ranking"],
  ["#predictions", "Predictions"],
  ["#assistant", "Assistant"],
  ["#limits", "Limits"],
] as const;

const UNIT_OPTIONS = ["kPa", "Pa", "psi", "atm", "bar", "m/s", "cm/s", "%", "% vol", "% wt", ""] as const;

function Section({ id, icon, title, children }: { id: string; icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <Card id={id} className="scroll-mt-6 border border-white/10 bg-[#09152e]/85 p-5 backdrop-blur-md sm:p-6">
      <h2 className="flex items-center gap-2.5 text-xl font-extrabold tracking-tight text-[#f4f8ff]">
        <span className="text-[#36a9ff]" aria-hidden="true">{icon}</span>
        {title}
      </h2>
      <div className="mt-3 space-y-3 text-sm leading-6 text-[#c2d5ee]">{children}</div>
    </Card>
  );
}

const tile = "rounded-xl border border-white/10 bg-[#050d21]/85 p-4";

export function HowItWorksView({ datasetScope }: { datasetScope: DatasetScopeSummary }) {
  const [valA, setValA] = useState("100");
  const [unitA, setUnitA] = useState("kPa");
  const [valB, setValB] = useState("14.5");
  const [unitB, setUnitB] = useState("psi");

  const compat = useMemo(() => {
    const a = Number(valA);
    const b = Number(valB);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return { compatible: false as const, reason: "Enter a number for both quantities." };
    return checkNumericUnitCompatibility({ value: a, unit: unitA || null }, { value: b, unit: unitB || null });
  }, [valA, unitA, valB, unitB]);
  const normA = useMemo(() => normalizeToKnownSi(Number.isFinite(Number(valA)) ? Number(valA) : null, unitA || null), [valA, unitA]);
  const normB = useMemo(() => normalizeToKnownSi(Number.isFinite(Number(valB)) ? Number(valB) : null, unitB || null), [valB, unitB]);

  const field = "rounded-lg border border-white/15 bg-[#050b1b] px-2.5 py-2 text-sm text-white focus:border-[#36a9ff] focus:outline-none";

  return (
    <div className="relative min-h-screen overflow-x-clip bg-[#050b1b] text-[#f4f8ff] lg:grid lg:grid-cols-[260px_1fr]">
      <ExploreSpaceBackground />
      <Sidebar />

      <main className="explore-main-stage relative z-10 min-w-0 px-4 py-6 sm:px-8 sm:py-8 lg:px-10 lg:py-9">
        <div className="mx-auto max-w-[1180px] space-y-6">
          <Card className="border border-white/10 bg-[#09152e]/85 p-5 backdrop-blur-md sm:p-7">
            <p className="font-mono text-[10px] font-semibold tracking-[.18em] text-[#52b6ff] uppercase">Methodology</p>
            <h1 className="mt-1.5 text-2xl font-extrabold tracking-tight text-[#f4f8ff] sm:text-3xl">How OrbitFlame Works</h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[#9cb2d2]">
              OrbitFlame reads real test tables from NASA&apos;s Physical Science Informatics repository and turns them into rankings, comparisons and predictions for
              spacecraft and habitat fire safety. This page explains what each tool does with the data.
            </p>
            <nav aria-label="On this page" className="mt-5 flex flex-wrap gap-2 border-t border-white/10 pt-4">
              {SECTIONS.map(([href, label]) => (
                <a key={href} href={href} className="rounded-full border border-white/12 bg-[#060e22]/80 px-3.5 py-1.5 text-xs font-semibold text-[#c4d7f2] hover:border-[#36a9ff]/60 hover:text-white">
                  {label}
                </a>
              ))}
            </nav>
          </Card>

          <Section id="data" icon={<Database size={20} />} title="Where the data comes from">
            <p>
              Every number comes from a file published on psi.nasa.gov: experimental tables, test matrices and investigation records for {datasetScope.totalRecords} flight and ground
              combustion investigations (BASS, Saffire, ACME, FLEX, SAME and others). Rows are used exactly as published. When a file does not report a value, it stays empty
              and is never estimated.
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className={tile}><p className="font-semibold text-[#f4f8ff]">Experiment tables</p><p className="mt-1 text-xs text-[#9cb2d2]">One row per test run: fuel, pressure, oxygen, flow and measured outcomes.</p></div>
              <div className={tile}><p className="font-semibold text-[#f4f8ff]">Investigation records</p><p className="mt-1 text-xs text-[#9cb2d2]">Objectives, hardware and flight program for each experiment.</p></div>
              <div className={tile}><p className="font-semibold text-[#f4f8ff]">Metadata-only records</p><p className="mt-1 text-xs text-[#9cb2d2]">Investigations without a published test table appear in the explorer but not in rankings or predictions.</p></div>
            </div>
            <p>
              Browse the individual source files in the <Link href="/sources" className="font-semibold text-[#7bc5ff] hover:underline">Research Library</Link>.
            </p>
          </Section>

          <Card id="units" data-testid="unit-compatibility-tester" className="scroll-mt-6 border border-[#36a9ff]/30 bg-[#09152e]/90 p-5 backdrop-blur-md sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2.5 text-xl font-extrabold tracking-tight text-[#f4f8ff]">
                  <Calculator size={20} className="text-[#ff8a32]" aria-hidden="true" />
                  Units and conversion
                </h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-[#c2d5ee]">
                  Original units are always kept. Values are converted to SI only when the units are of the same kind, so a pressure is never compared with a
                  concentration. Try two quantities below.
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {([
                  ["kPa vs psi", "100", "kPa", "14.5", "psi"],
                  ["% vol vs % wt", "21", "% vol", "21", "% wt"],
                  ["Missing unit", "98", "", "101", "kPa"],
                ] as const).map(([label, a, ua, b, ub]) => (
                  <button key={label} type="button" onClick={() => { setValA(a); setUnitA(ua); setValB(b); setUnitB(ub); }} className="rounded-lg border border-white/15 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-[#c4d7f2] hover:border-[#36a9ff]">
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1.4fr]">
              {([
                ["Quantity A", valA, setValA, unitA, setUnitA, normA],
                ["Quantity B", valB, setValB, unitB, setUnitB, normB],
              ] as const).map(([label, val, setVal, unit, setUnit, norm]) => (
                <div key={label} className={`${tile} space-y-2`}>
                  <span className="text-xs font-bold text-[#7bc5ff]">{label}</span>
                  <div className="flex gap-2">
                    <input aria-label={`${label} value`} type="number" value={val} onChange={(e) => setVal(e.target.value)} className={`${field} min-w-0 flex-1`} />
                    <select aria-label={`${label} unit`} value={unit} onChange={(e) => setUnit(e.target.value)} className={`${field} w-28`}>
                      {UNIT_OPTIONS.map((u) => <option key={u} value={u}>{u || "(no unit)"}</option>)}
                    </select>
                  </div>
                  <p className="text-xs text-[#8ea5c7]">{norm.valueSi !== null ? `${norm.valueSi} ${norm.unitSi} (${norm.dimension ?? "unknown"})` : "Kept as entered"}</p>
                </div>
              ))}

              <div data-testid="unit-compat-output" className={`rounded-xl border p-4 text-sm ${compat.compatible ? "border-emerald-400/35 bg-emerald-500/10 text-emerald-100" : "border-rose-400/35 bg-rose-500/10 text-rose-100"}`}>
                <div className="flex items-center gap-2 font-bold">
                  {compat.compatible ? <CheckCircle2 size={16} className="text-emerald-300" aria-hidden="true" /> : <XCircle size={16} className="text-rose-300" aria-hidden="true" />}
                  {compat.compatible ? "These can be compared" : "These cannot be compared"}
                </div>
                {compat.compatible ? (
                  <p className="mt-2 text-xs">In {compat.sharedUnit}: A = {compat.comparableValueA}, B = {compat.comparableValueB}</p>
                ) : (
                  <p className="mt-2 text-xs leading-5">{compat.reason}</p>
                )}
              </div>
            </div>
            <p className="mt-4 text-xs leading-5 text-[#9cb2d2]">
              Oxygen is reported as a mole fraction (shown as % or &quot;mol frac&quot;). Where a table does not state the unit for XO₂ or Xf, the standard combustion convention is used.
              Oxygen partial pressure is total pressure times mole fraction.
            </p>
          </Card>

          <Section id="ranking" icon={<Layers size={20} />} title="Habitat ranking">
            <p>
              Mission Lab scores each investigation from 0 to 100 by how closely its best test matches a habitat: the International Space Station, a lunar base, a Mars habitat, a
              spacesuit or an Earth analog. Four match bars show where it fits.
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className={tile}><p className="font-semibold text-[#f4f8ff]">Atmosphere</p><p className="mt-1 text-xs text-[#9cb2d2]">Closeness of oxygen partial pressure and total pressure.</p></div>
              <div className={tile}><p className="font-semibold text-[#f4f8ff]">Airflow</p><p className="mt-1 text-xs text-[#9cb2d2]">Overlap with the habitat ventilation range from NASA-STD-3001.</p></div>
              <div className={tile}><p className="font-semibold text-[#f4f8ff]">Gravity</p><p className="mt-1 text-xs text-[#9cb2d2]">Flown or ground gravity, with airflow-equivalent runs counted at half weight.</p></div>
              <div className={tile}><p className="font-semibold text-[#f4f8ff]">Fuel</p><p className="mt-1 text-xs text-[#9cb2d2]">Relevance of the fuel or material to what burns in that habitat.</p></div>
            </div>
            <p>
              No PSI test was flown at 0.16 g or 0.38 g. Moon and Mars scores therefore rely on microgravity runs whose airflow produces buoyancy comparable to partial gravity, and
              are best read as indicative.
            </p>
          </Section>

          <Section id="predictions" icon={<Scale size={20} />} title="Predictions">
            <p>
              The Flammability &amp; Extinction Lab fits statistical models to the real test rows. A prediction appears only if the model beats a naive baseline when whole
              experiments are held out; otherwise only the nearest real NASA tests are listed. Each output shows the model fit next to its estimate, and the table of nearest tests
              always shows measured values for comparison.
            </p>
            <p>Estimates describe the range that NASA tested. They support research triage and are not a safety certification.</p>
          </Section>

          <Section id="assistant" icon={<MessageSquare size={20} />} title="AI assistant">
            <p>
              The assistant answers only from the indexed investigations. Each claim cites the record it came from, original units are preserved, and it declines to answer when the
              records do not contain the information. It does not use web search or earlier answers as evidence.
            </p>
            <p>
              <Link href="/assistant" className="font-semibold text-[#7bc5ff] hover:underline">Open the assistant</Link>
            </p>
          </Section>

          <Section id="limits" icon={<FileSearch size={20} />} title="Limits to keep in mind">
            <ul className="grid gap-3 lg:grid-cols-2">
              <li className={tile}><strong className="text-[#ff8a32]">Gravity is inferred.</strong> PSI tables have no gravity column. Zero gravity comes from each investigation&apos;s ISS or Cygnus flight record, and only ground-tagged rows count as 1 g.</li>
              <li className={tile}><strong className="text-[#ff8a32]">Gaps are not absence.</strong> An empty cell in the Technology Map coverage gaps means no indexed test, not that no research exists.</li>
              <li className={tile}><strong className="text-[#ff8a32]">Matches are comparisons.</strong> Scenario matching shows which investigations used similar conditions. It does not show that a material is safe or that a suppressant works.</li>
              <li className={tile}><strong className="text-[#ff8a32]">Blank means not reported.</strong> A value a file does not state is left empty and shown as not reported, never filled in.</li>
            </ul>
          </Section>
        </div>
      </main>
    </div>
  );
}
