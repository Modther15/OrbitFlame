"use client";

import {
  ArrowRight,
  BookOpenText,
  Calculator,
  CheckCircle2,
  Database,
  FileSearch,
  Layers,
  Scale,
  ShieldAlert,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ExploreSpaceBackground } from "@/components/explorer/explore-space-background";
import { Sidebar } from "@/components/navigation/sidebar";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import type { DatasetScopeSummary } from "@/lib/science/provenance";
import { checkNumericUnitCompatibility, normalizeToKnownSi } from "@/lib/science/units";

const ANCHOR_PILLARS = [
  ["#ingestion", "01. Ingestion & Normalization"],
  ["#retrieval", "02. Retrieval & Citations"],
  ["#units", "03. Unit Compatibility"],
  ["#provenance", "04. Provenance Verification"],
  ["#missing-data", "05. Missing-Data Handling"],
  ["#limitations", "06. Limitations & Abstention"],
] as const;

const WORKFLOW_STAGES = [
  {
    step: "01",
    id: "ingestion",
    title: "Data Ingestion & Schema Validation",
    modulePath: "src/lib/ingestion/preview.ts",
    routeHref: "/sources#ingestion",
    routeLabel: "Inspect Dry-Run Validator",
    summary:
      "Proposed investigation batches are parsed strictly against Zod boundary contracts (InvestigationSchema, TestRunSchema, ConditionSchema, MeasurementSchema) with duplicate ID, unit-presence, and verified-source checks before acceptance.",
    guarantees: [
      "NASA_VERIFIED_DATA records without a VERIFIED SourceLocator are deterministically rejected.",
      "Missing values cannot hold non-null numeric or text payloads.",
      "No unverified upload persistence or automated schema guessing.",
    ],
  },
  {
    step: "02",
    id: "normalization",
    title: "Explicit Unit Normalization",
    modulePath: "src/lib/science/units.ts",
    routeHref: "#units",
    routeLabel: "Open SI Unit Verifier",
    summary:
      "Explicit source expressions and units (valueOriginal, unitOriginal) are preserved verbatim alongside optional deterministic SI normalization (Pa, m/s, m, K) via normalizeToKnownSi.",
    guarantees: [
      "Unrecognized or missing unit strings return unitKnown: false with null SI values.",
      "Non-SI percentages (%, % vol, % wt) keep distinct physical dimension labels so they never merge.",
      "Unknown units are never guessed or defaulted.",
    ],
  },
  {
    step: "03",
    id: "retrieval",
    title: "Deterministic Evidence Retrieval",
    modulePath: "src/lib/assistant/retrieval.ts",
    routeHref: "/assistant",
    routeLabel: "Open AI Research Assistant",
    summary:
      "AI queries resolve target investigations, program families, gravity labels, and safety domains exclusively against OrbitFlame's active repository interface. Follow-up queries inspect only prior USER turns.",
    guarantees: [
      "Prior assistant replies are excluded from evidence retrieval and context lookup.",
      "Unindexed Apollo/Skylab/off-repo queries return 0 records rather than model memory fallback.",
      "External web search tools remain disabled.",
    ],
  },
  {
    step: "04",
    id: "unit-compat",
    title: "Physical Unit Compatibility Gate",
    modulePath: "src/lib/science/units.ts",
    routeHref: "/compare",
    routeLabel: "Open Compare Lab",
    summary:
      "Before numeric values are plotted on a shared axis, compared in a matrix row, or compared in Mission Lab, checkNumericUnitCompatibility verifies identical physical dimensions and convertibility.",
    guarantees: [
      "Mixed or incompatible dimensions (% vol vs % wt, kPa vs %) fail explicitly.",
      "Separate charts are rendered for Oxygen, Pressure, and Airflow — never mixed on one axis.",
      "Unit-missing numbers are never silently cast into SI equivalents.",
    ],
  },
  {
    step: "05",
    id: "provenance",
    title: "Provenance Verification Gate",
    modulePath: "src/lib/science/provenance.ts",
    routeHref: "/sources",
    routeLabel: "Open Research Library",
    summary:
      "Verified NASA provenance requires BOTH provenanceStatus === 'NASA_VERIFIED_DATA' AND source.verificationStatus === 'VERIFIED'. Any non-NASA illustrative record would carry an explicit non-NASA label across every view; none are present in the current index.",
    guarantees: [
      "A record is never upgraded to VERIFIED by configuration alone; it needs a verified source locator.",
      "Citations without a connected source keep SOURCE LOCATOR NOT AVAILABLE.",
    ],
  },
  {
    step: "06",
    id: "comparison",
    title: "Multi-Record Comparison Engine",
    modulePath: "src/lib/science/compare.ts",
    routeHref: "/compare",
    routeLabel: "Launch Compare Lab",
    summary:
      "Evaluates 2–3 investigations across 11 scientific dimensions returning EXACT_MATCH, DIFFERENT, PARTIALLY_COMPARABLE, or UNKNOWN_NOT_REPORTED alongside CSV/JSON exports, animated Recharts charts, and a 6-axis Documentation Coverage Radar.",
    guarantees: [
      "Missing fields are never equated as matches.",
      "Microgravity and Partial Gravity remain strictly separate regimes.",
      "Measurement trend slots remain gated until real timestamped readings exist.",
    ],
  },
  {
    step: "07",
    id: "mission-matching",
    title: "Mission Evidence Matching",
    modulePath: "src/lib/science/mission-matcher.ts",
    routeHref: "/mission-lab",
    routeLabel: "Open Mission Lab",
    summary:
      "Matches user-entered hypothetical habitat assumptions against indexed records and assigns deterministic evidence classifications (DIRECT, ANALOGOUS, MECHANISM_ONLY, PLANNED, UNAVAILABLE) alongside explicit Evidence Stop walls.",
    guarantees: [
      "User scenario inputs stay visually marked as hypothetical assumptions.",
      "LLMs never override deterministic classification rules.",
      "Outputs zero flammability predictions or safety certifications.",
    ],
  },
  {
    step: "08",
    id: "abstention",
    title: "Pre-Flight Sufficiency & Citation Binding",
    modulePath: "src/lib/assistant/evidence-validator.ts & citation-builder.ts",
    routeHref: "/assistant",
    routeLabel: "Inspect Citation Drawer",
    summary:
      "Questions lacking records, requesting missing measurements, containing incompatible units, asking for causal proof, or demanding verified NASA data on demo records abstain deterministically before calling OpenAI. Every model claim must cite valid retrieved evidenceIds.",
    guarantees: [
      "OpenAiResponsesProvider enforces tools: [], tool_choice: 'none', and strict JSON schema.",
      "Ungrounded claims or invented citation IDs are stripped server-side or trigger abstention.",
      "Missing OPENAI_API_KEY returns honest 503 CONFIGURATION_REQUIRED.",
    ],
  },
];

const EVIDENCE_LEVEL_SPECS = [
  [
    "DIRECT",
    "Source experiment directly covers target condition/domain with verified NASA provenance, matching gravity regime, compatible units, and populated measurements.",
  ],
  [
    "ANALOGOUS",
    "Related investigation overlaps condition(s) or domain, but differs in gravity regime, conditions, missingness, or carries demo provenance.",
  ],
  [
    "MECHANISM_ONLY",
    "Supplies background combustion/detection physics concepts without direct condition or habitat equivalence.",
  ],
  [
    "PLANNED",
    "Documented study planned or underway with zero published measurement outcomes in the index.",
  ],
  [
    "UNAVAILABLE",
    "No aligned investigation exists in OrbitFlame's current index for the requested constraints.",
  ],
] as const;

const PROVENANCE_SPECS = [
  [
    "NASA_VERIFIED_DATA",
    "Valid ONLY when accompanied by an explicit SourceLocator with verificationStatus === 'VERIFIED'. Never inferred from env vars.",
  ],
  [
    "DEMO_FIXTURE",
    "Reserved status for non-NASA interface examples (always labelled as such). No record in the current index carries it.",
  ],
  [
    "ILLUSTRATIVE_SIMULATION",
    "Visual/conceptual output only — never treated as empirical measurement.",
  ],
  [
    "NOT_REPORTED",
    "Source omitted or did not publish the field; preserved explicitly without zero-filling.",
  ],
  [
    "INFERRED_UNVERIFIED",
    "Pending source verification; never eligible for direct verified citation promotion.",
  ],
] as const;

const ABSTENTION_CODES = [
  [
    "INSUFFICIENT_NO_RECORDS",
    "Retrieval matched zero indexed records for target IDs/families/domains, or blocked out-of-repo topics.",
  ],
  [
    "INSUFFICIENT_PROVENANCE_MISMATCH",
    "User requested verified NASA data, but the matched records are not verified NASA data.",
  ],
  [
    "INSUFFICIENT_CAUSAL_UNSUPPORTED",
    "Prompt asked why combustion behaves a way, or asked for safety/certification/suppression effectiveness claims.",
  ],
  [
    "INSUFFICIENT_MISSING_DATA",
    "Target records contain missing requested conditions or zero recorded measurement rows.",
  ],
  [
    "INSUFFICIENT_INCOMPATIBLE_UNITS",
    "Records contain unconvertible physical scales (e.g., % vol vs % wt or null units).",
  ],
] as const;

export function HowItWorksView({ datasetScope }: { datasetScope: DatasetScopeSummary }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const current = WORKFLOW_STAGES[activeIndex];

  const [valA, setValA] = useState("100");
  const [unitA, setUnitA] = useState("kPa");
  const [valB, setValB] = useState("14.5");
  const [unitB, setUnitB] = useState("psi");

  const compatResult = useMemo(() => {
    const aNum = Number(valA);
    const bNum = Number(valB);
    if (!Number.isFinite(aNum) || !Number.isFinite(bNum)) {
      return { compatible: false as const, reason: "Enter finite numeric values for both quantities." };
    }
    return checkNumericUnitCompatibility(
      { value: aNum, unit: unitA || null },
      { value: bNum, unit: unitB || null },
    );
  }, [valA, unitA, valB, unitB]);

  const normA = useMemo(
    () => normalizeToKnownSi(Number.isFinite(Number(valA)) ? Number(valA) : null, unitA || null),
    [valA, unitA],
  );
  const normB = useMemo(
    () => normalizeToKnownSi(Number.isFinite(Number(valB)) ? Number(valB) : null, unitB || null),
    [valB, unitB],
  );

  return (
    <div className="relative min-h-screen overflow-x-clip bg-[#050b1b] text-[#f4f8ff] lg:grid lg:grid-cols-[260px_1fr]">
      <ExploreSpaceBackground />
      <Sidebar />

      <main className="explore-main-stage relative z-10 min-w-0 px-4 py-6 sm:px-8 sm:py-8 lg:px-10 lg:py-9">
        <div className="mx-auto max-w-[1180px] space-y-6">
          {/* Header */}
          <Card className="border border-white/10 bg-[#09152e]/85 p-5 backdrop-blur-md sm:p-7">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="font-mono text-[10px] font-semibold tracking-[.18em] text-[#52b6ff] uppercase">
                  SYSTEM METHODOLOGY &amp; SCIENTIFIC GOVERNANCE
                </p>
                <h1 className="mt-1.5 flex items-center gap-2.5 text-2xl font-extrabold tracking-tight text-[#f4f8ff] sm:text-3xl">
                  <BookOpenText size={26} className="text-[#36a9ff]" aria-hidden="true" />
                  How OrbitFlame Works
                </h1>
                <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[#9cb2d2]">
                  Unified specification of OrbitFlame&apos;s end-to-end engineering pipeline and scientific evidence rules —
                  covering data ingestion, SI normalization, citation retrieval, unit compatibility, provenance gates,
                  missingness, and AI abstention.
                </p>
              </div>
              <StatusBadge
                status={
                  datasetScope.scope === "VERIFIED_INDEXED_DATA"
                    ? "verified"
                    : datasetScope.scope === "EMPTY"
                      ? "empty"
                      : "demo"
                }
              />
            </div>

            <nav aria-label="How it works section index" className="mt-5 flex flex-wrap gap-2 border-t border-white/10 pt-4">
              {ANCHOR_PILLARS.map(([href, label]) => (
                <a
                  key={href}
                  href={href}
                  className="rounded-lg border border-white/12 bg-[#050d21]/85 px-3 py-1.5 font-mono text-[10.5px] font-semibold text-[#c4d7f2] transition-colors hover:border-[#36a9ff]/50 hover:text-white"
                >
                  {label}
                </a>
              ))}
            </nav>
          </Card>

          {/* 01. Data Ingestion and Normalization + Interactive 8-Stage Pipeline */}
          <section id="ingestion" className="scroll-mt-6 space-y-6">
            <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
              <Card className="border border-white/10 bg-[#09152e]/80 p-4 backdrop-blur-md">
                <p className="mb-1 flex items-center gap-1.5 font-mono text-[10px] font-bold tracking-[.16em] text-[#52b6ff] uppercase">
                  <Database size={13} aria-hidden="true" /> 01 // DATA INGESTION &amp; NORMALIZATION
                </p>
                <p className="mb-3 text-[11px] text-[#8ea5c7]">
                  Select any of the 8 implemented pipeline stages to inspect its source module and guarantees.
                </p>
                <div className="space-y-1.5">
                  {WORKFLOW_STAGES.map((stage, idx) => {
                    const active = idx === activeIndex;
                    return (
                      <button
                        key={stage.id}
                        type="button"
                        onClick={() => setActiveIndex(idx)}
                        aria-pressed={active}
                        className={`flex w-full items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left transition-all ${
                          active
                            ? "border-[#36a9ff]/55 bg-[linear-gradient(135deg,#0d254f_0%,#13386e_100%)] text-white"
                            : "border-white/10 bg-[#050d21]/75 text-[#9cb2d2] hover:border-white/25 hover:text-white"
                        }`}
                      >
                        <span className="font-mono text-xs font-bold text-[#ff8a32]">{stage.step}</span>
                        <span className="text-xs font-semibold">{stage.title}</span>
                      </button>
                    );
                  })}
                </div>
              </Card>

              <Card className="border border-[#36a9ff]/25 bg-[#09152e]/90 p-5 backdrop-blur-md sm:p-7">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-4">
                  <div>
                    <span className="font-mono text-[10.5px] font-bold tracking-[.16em] text-[#ff8a32] uppercase">
                      {`STAGE ${current.step} // IMPLEMENTED BEHAVIOR`}
                    </span>
                    <h2 className="mt-1 text-xl font-extrabold text-[#f4f8ff]">{current.title}</h2>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-[#050b1b] px-3 py-1 font-mono text-[10.5px] text-[#7bc5ff]">
                    <Layers size={12} aria-hidden="true" /> {current.modulePath}
                  </span>
                </div>

                <p className="mt-4 text-sm leading-relaxed text-[#d7e5fb]">{current.summary}</p>

                <div className="mt-5 rounded-xl border border-white/10 bg-[#050d21]/85 p-4">
                  <p className="font-mono text-[10px] font-bold tracking-[.15em] text-[#52b6ff] uppercase">
                    VERIFIABLE RUNTIME GUARANTEES
                  </p>
                  <ul className="mt-3 space-y-2.5">
                    {current.guarantees.map((g) => (
                      <li key={g} className="flex items-start gap-2.5 text-xs leading-relaxed text-[#e5efff]">
                        <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-emerald-300" aria-hidden="true" />
                        <span>{g}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                  <Link
                    href={current.routeHref}
                    className="inline-flex items-center gap-2 rounded-xl bg-[linear-gradient(135deg,#0b3d91_0%,#ff5500_100%)] px-4 py-2 font-mono text-[11px] font-bold tracking-wider text-white uppercase"
                  >
                    {current.routeLabel} <ArrowRight size={13} aria-hidden="true" />
                  </Link>
                  <span className="font-mono text-[10px] text-[#7d95b8]">
                    Only documents behavior present in active repository code.
                  </span>
                </div>
              </Card>
            </div>
          </section>

          {/* 02. Evidence Retrieval and Citations */}
          <Card id="retrieval" className="scroll-mt-6 border border-white/10 bg-[#09152e]/85 p-5 backdrop-blur-md sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-4">
              <div>
                <p className="font-mono text-[10px] font-bold tracking-[.16em] text-[#52b6ff] uppercase">
                  02 // EVIDENCE RETRIEVAL &amp; CITATIONS
                </p>
                <h2 className="mt-1 flex items-center gap-2 text-lg font-extrabold text-[#f4f8ff]">
                  <FileSearch size={18} className="text-[#36a9ff]" aria-hidden="true" />
                  Strict Repository-Only Evidence Binding
                </h2>
              </div>
              <Link
                href="/assistant"
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#36a9ff]/35 bg-[#36a9ff]/10 px-3 py-1.5 font-mono text-[10.5px] font-semibold text-[#7bc5ff] hover:border-[#36a9ff]"
              >
                Open AI Research Assistant <ArrowRight size={12} aria-hidden="true" />
              </Link>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-white/10 bg-[#050d21]/85 p-4 text-xs leading-relaxed text-[#d7e5fb]">
                <p className="font-mono text-[10.5px] font-bold text-[#ff8a32] uppercase">Deterministic Index Lookup</p>
                <p className="mt-1.5 text-[#9cb2d2]">
                  Questions resolve investigation IDs, program families, gravity regimes, and safety domains solely
                  through <code className="font-mono text-[#7bc5ff]">retrieval.ts</code> against the active repository.
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-[#050d21]/85 p-4 text-xs leading-relaxed text-[#d7e5fb]">
                <p className="font-mono text-[10.5px] font-bold text-[#ff8a32] uppercase">Citation Binding Contract</p>
                <p className="mt-1.5 text-[#9cb2d2]">
                  Every assistant statement must bind to verified <code className="font-mono text-[#7bc5ff]">evidenceIds</code>{" "}
                  from the retrieved packet via <code className="font-mono text-[#7bc5ff]">citation-builder.ts</code>;
                  ungrounded sentences are stripped server-side.
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-[#050d21]/85 p-4 text-xs leading-relaxed text-[#d7e5fb]">
                <p className="font-mono text-[10.5px] font-bold text-[#ff8a32] uppercase">No External Memory</p>
                <p className="mt-1.5 text-[#9cb2d2]">
                  Web search, general model memory, and prior assistant turns are excluded from evidence context.
                  Out-of-repository programs abstained rather than fabricated.
                </p>
              </div>
            </div>
          </Card>

          {/* 03. Unit Compatibility (Live Interactive Verifier) */}
          <Card
            id="units"
            data-testid="unit-compatibility-tester"
            className="scroll-mt-6 border border-[#36a9ff]/30 bg-[#09152e]/90 p-5 backdrop-blur-md sm:p-6"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
              <div>
                <p className="font-mono text-[10px] font-bold tracking-[.16em] text-[#52b6ff] uppercase">
                  03 // UNIT COMPATIBILITY &amp; SI NORMALIZATION (src/lib/science/units.ts)
                </p>
                <h2 className="mt-1 flex items-center gap-2 text-lg font-extrabold text-[#f4f8ff]">
                  <Calculator size={18} className="text-[#ff8a32]" aria-hidden="true" />
                  Unit Compatibility &amp; SI Normalization Verifier
                </h2>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setValA("100");
                    setUnitA("kPa");
                    setValB("14.5");
                    setUnitB("psi");
                  }}
                  className="rounded-lg border border-white/15 bg-white/[0.04] px-2.5 py-1 font-mono text-[10px] text-[#7bc5ff] hover:border-[#36a9ff]"
                >
                  kPa vs psi (Compatible)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setValA("21");
                    setUnitA("% vol");
                    setValB("21");
                    setUnitB("% wt");
                  }}
                  className="rounded-lg border border-white/15 bg-white/[0.04] px-2.5 py-1 font-mono text-[10px] text-[#ffb067] hover:border-[#ff8a32]"
                >
                  % vol vs % wt (Incompatible)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setValA("98");
                    setUnitA("");
                    setValB("101");
                    setUnitB("kPa");
                  }}
                  className="rounded-lg border border-white/15 bg-white/[0.04] px-2.5 py-1 font-mono text-[10px] text-rose-200 hover:border-rose-400"
                >
                  Null Unit vs kPa (Rejected)
                </button>
              </div>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1.4fr]">
              <div className="space-y-2 rounded-xl border border-white/10 bg-[#050d21]/85 p-3.5">
                <span className="font-mono text-[10px] font-bold text-[#7bc5ff] uppercase">Quantity A</span>
                <div className="flex gap-2">
                  <input
                    aria-label="Quantity A numeric value"
                    type="number"
                    value={valA}
                    onChange={(e) => setValA(e.target.value)}
                    className="min-w-0 flex-1 rounded-lg border border-white/15 bg-[#050b1b] px-2.5 py-1.5 text-xs text-white"
                  />
                  <select
                    aria-label="Quantity A unit"
                    value={unitA}
                    onChange={(e) => setUnitA(e.target.value)}
                    className="w-24 rounded-lg border border-white/15 bg-[#050b1b] px-2 py-1.5 font-mono text-xs text-white"
                  >
                    <option value="kPa">kPa</option>
                    <option value="Pa">Pa</option>
                    <option value="psi">psi</option>
                    <option value="atm">atm</option>
                    <option value="bar">bar</option>
                    <option value="m/s">m/s</option>
                    <option value="cm/s">cm/s</option>
                    <option value="%">%</option>
                    <option value="% vol">% vol</option>
                    <option value="% wt">% wt</option>
                    <option value="">(missing)</option>
                  </select>
                </div>
                <p className="font-mono text-[10.5px] text-[#8ea5c7]">
                  SI: {normA.valueSi !== null ? `${normA.valueSi} ${normA.unitSi}` : "Unconverted / Preserved"} (
                  {normA.dimension ?? "unknown"})
                </p>
              </div>

              <div className="space-y-2 rounded-xl border border-white/10 bg-[#050d21]/85 p-3.5">
                <span className="font-mono text-[10px] font-bold text-[#7bc5ff] uppercase">Quantity B</span>
                <div className="flex gap-2">
                  <input
                    aria-label="Quantity B numeric value"
                    type="number"
                    value={valB}
                    onChange={(e) => setValB(e.target.value)}
                    className="min-w-0 flex-1 rounded-lg border border-white/15 bg-[#050b1b] px-2.5 py-1.5 text-xs text-white"
                  />
                  <select
                    aria-label="Quantity B unit"
                    value={unitB}
                    onChange={(e) => setUnitB(e.target.value)}
                    className="w-24 rounded-lg border border-white/15 bg-[#050b1b] px-2 py-1.5 font-mono text-xs text-white"
                  >
                    <option value="psi">psi</option>
                    <option value="kPa">kPa</option>
                    <option value="Pa">Pa</option>
                    <option value="atm">atm</option>
                    <option value="bar">bar</option>
                    <option value="cm/s">cm/s</option>
                    <option value="m/s">m/s</option>
                    <option value="% wt">% wt</option>
                    <option value="% vol">% vol</option>
                    <option value="%">%</option>
                    <option value="">(missing)</option>
                  </select>
                </div>
                <p className="font-mono text-[10.5px] text-[#8ea5c7]">
                  SI: {normB.valueSi !== null ? `${normB.valueSi} ${normB.unitSi}` : "Unconverted / Preserved"} (
                  {normB.dimension ?? "unknown"})
                </p>
              </div>

              <div
                data-testid="unit-compat-output"
                className={`rounded-xl border p-3.5 text-xs ${
                  compatResult.compatible
                    ? "border-emerald-400/35 bg-emerald-500/10 text-emerald-100"
                    : "border-rose-400/35 bg-rose-500/10 text-rose-100"
                }`}
              >
                <div className="flex items-center gap-2 font-mono text-[11px] font-bold uppercase">
                  {compatResult.compatible ? (
                    <CheckCircle2 size={15} className="text-emerald-300" aria-hidden="true" />
                  ) : (
                    <XCircle size={15} className="text-rose-300" aria-hidden="true" />
                  )}
                  {compatResult.compatible ? "COMPATIBLE COMPARISON ALLOWED" : "COMPARISON BLOCKED"}
                </div>
                {compatResult.compatible ? (
                  <p className="mt-2 font-mono text-[11px]">
                    Normalized on {compatResult.sharedUnit}: A = {compatResult.comparableValueA} vs B ={" "}
                    {compatResult.comparableValueB}
                  </p>
                ) : (
                  <p className="mt-2 leading-relaxed">{compatResult.reason}</p>
                )}
              </div>
            </div>
          </Card>

          {/* 04. Provenance Verification */}
          <div id="provenance" className="scroll-mt-6 grid gap-6 lg:grid-cols-2">
            <Card className="border border-white/10 bg-[#09152e]/85 p-5 backdrop-blur-md">
              <div className="flex items-center gap-2">
                <ShieldCheck size={16} className="text-[#36a9ff]" aria-hidden="true" />
                <h2 className="font-mono text-[11px] font-bold tracking-[.16em] text-[#52b6ff] uppercase">
                  04 // PROVENANCE VERIFICATION (ProvenanceStatusSchema)
                </h2>
              </div>
              <dl className="mt-4 space-y-2.5 text-xs">
                {PROVENANCE_SPECS.map(([code, desc]) => (
                  <div key={code} className="rounded-xl border border-white/10 bg-[#050d21]/85 p-3">
                    <dt className="font-mono font-bold text-[#7bc5ff]">{code}</dt>
                    <dd className="mt-1 leading-relaxed text-[#9cb2d2]">{desc}</dd>
                  </div>
                ))}
              </dl>
            </Card>

            <Card className="border border-white/10 bg-[#09152e]/85 p-5 backdrop-blur-md">
              <div className="flex items-center gap-2">
                <Scale size={16} className="text-[#ff8a32]" aria-hidden="true" />
                <h2 className="font-mono text-[11px] font-bold tracking-[.16em] text-[#52b6ff] uppercase">
                  04B // EVIDENCE LEVEL VOCABULARY (EvidenceLevelSchema)
                </h2>
              </div>
              <dl className="mt-4 space-y-2.5 text-xs">
                {EVIDENCE_LEVEL_SPECS.map(([code, desc]) => (
                  <div key={code} className="rounded-xl border border-white/10 bg-[#050d21]/85 p-3">
                    <dt className="font-mono font-bold text-[#ffb067]">{code}</dt>
                    <dd className="mt-1 leading-relaxed text-[#9cb2d2]">{desc}</dd>
                  </div>
                ))}
              </dl>
            </Card>
          </div>

          {/* 05. Missing-Data Handling & 06. Scientific Limitations and Abstention */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Card id="missing-data" className="scroll-mt-6 border border-white/10 bg-[#09152e]/85 p-5 backdrop-blur-md">
              <h2 className="font-mono text-[11px] font-bold tracking-[.16em] text-[#52b6ff] uppercase">
                05 // MISSING-DATA HANDLING &amp; GRAVITY BOUNDARIES
              </h2>
              <ul className="mt-4 space-y-2.5 text-xs leading-relaxed text-[#d7e5fb]">
                <li className="rounded-xl border border-white/10 bg-[#050d21]/85 p-3">
                  <strong className="font-mono text-[#ff8a32]">MissingStatusSchema:</strong> Tracks{" "}
                  <code className="font-mono text-[#7bc5ff]">PRESENT</code>,{" "}
                  <code className="font-mono text-[#7bc5ff]">NOT_REPORTED</code>,{" "}
                  <code className="font-mono text-[#7bc5ff]">NOT_APPLICABLE</code>,{" "}
                  <code className="font-mono text-[#7bc5ff]">UNKNOWN</code>, and{" "}
                  <code className="font-mono text-[#7bc5ff]">AMBIGUOUS</code>. Non-present fields are barred by Zod from
                  holding numeric or text values, and are never plotted as zero or treated as matches.
                </li>
                <li className="rounded-xl border border-white/10 bg-[#050d21]/85 p-3">
                  <strong className="font-mono text-[#ff8a32]">Direct vs Analogous Gravity:</strong>{" "}
                  <code className="font-mono text-[#7bc5ff]">classifyGravityRegime</code> strictly isolates Microgravity,
                  Lunar (~1/6 g), Mars (~0.38 g), unspecified Partial gravity, and Normal gravity. Microgravity is never
                  promoted to DIRECT evidence for surface partial gravity.
                </li>
                <li className="rounded-xl border border-white/10 bg-[#050d21]/85 p-3">
                  <strong className="font-mono text-[#ff8a32]">No Synthetic Curves or Gap Fabrication:</strong>{" "}
                  Time-series trend charts remain explicitly disabled when measurements lack verified timestamps, and
                  Documentation Coverage Radar displays availability only — never experimental quality.
                </li>
              </ul>
            </Card>

            <Card id="limitations" className="scroll-mt-6 border border-white/10 bg-[#09152e]/85 p-5 backdrop-blur-md">
              <div className="flex items-center gap-2">
                <ShieldAlert size={15} className="text-[#ff8a32]" aria-hidden="true" />
                <h2 className="font-mono text-[11px] font-bold tracking-[.16em] text-[#52b6ff] uppercase">
                  06 // SCIENTIFIC LIMITATIONS &amp; AI ABSTENTION GATES
                </h2>
              </div>
              <p className="mt-3 rounded-xl border border-amber-400/25 bg-amber-400/[0.06] p-3 text-xs leading-relaxed text-[#fbe6b5]">
                OrbitFlame never claims scientific causation, material flammability ratings, fire suppression
                effectiveness, or spacecraft safety certification. Empty cells indicate gaps in OrbitFlame&apos;s connected
                dataset — never proof that no NASA research exists.
              </p>
              <dl className="mt-3 space-y-2.5 text-xs">
                {ABSTENTION_CODES.map(([code, desc]) => (
                  <div key={code} className="rounded-xl border border-white/10 bg-[#050d21]/85 p-3">
                    <dt className="font-mono font-bold text-rose-300">{code}</dt>
                    <dd className="mt-1 leading-relaxed text-[#9cb2d2]">{desc}</dd>
                  </div>
                ))}
              </dl>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
