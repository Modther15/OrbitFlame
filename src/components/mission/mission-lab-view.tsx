"use client";

import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Compass,
  FileCheck2,
  GitCompareArrows,
  Info,
  Loader2,
  RotateCcw,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { CitationEvidenceDrawer } from "@/components/assistant/citation-evidence-drawer";
import { ExploreSpaceBackground } from "@/components/explorer/explore-space-background";
import { habitatKeyFromParam } from "@/components/mission/habitat-keys";
import { MissionPredictorLazy } from "@/components/mission/mission-predictor-lazy";
import { Connections, GravityLadder } from "@/components/science/science-context";
import { MissionPathwaySvg } from "@/components/mission/mission-pathway-svg";
import { Sidebar } from "@/components/navigation/sidebar";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import type { DataSourceMode } from "@/lib/api/backend-types";
import type { AssistantApiResponse, AssistantCitation } from "@/lib/assistant/assistant-response-schema";
import {
  matchMissionScenario,
  MISSION_HABITATS,
  type EvidenceClassification,
  type MissionHabitatId,
  type MissionScenarioInput,
  type ParameterAlignmentStatus,
  type SafetyDomainOption,
} from "@/lib/science/mission-matcher";
import type { GravityRegimeClass } from "@/lib/science/provenance";
import type { InvestigationSummary } from "@/lib/data/summary";
import { setCompareIds } from "@/lib/state/compare-selection";

type MissionLabViewProps = {
  records: InvestigationSummary[];
  isAiConfigured: boolean;
  initialHabitat?: string;
  dataSource?: DataSourceMode;
};

const CLASSIFICATION_STYLES: Record<EvidenceClassification, string> = {
  DIRECT: "border-emerald-400/40 bg-emerald-500/15 text-emerald-200",
  ANALOGOUS: "border-amber-400/40 bg-amber-400/15 text-amber-200",
  MECHANISM_ONLY: "border-sky-400/40 bg-sky-500/15 text-sky-200",
  PLANNED: "border-indigo-400/40 bg-indigo-500/15 text-indigo-200",
  UNAVAILABLE: "border-white/20 bg-white/10 text-[#9cb2d2]",
};

const ALIGN_BADGES: Record<ParameterAlignmentStatus, string> = {
  AGREES: "border-[#36a9ff]/40 bg-[#36a9ff]/15 text-[#7bc5ff]",
  DIFFERS: "border-[#ff8a32]/40 bg-[#ff8a32]/15 text-[#ffb067]",
  MISSING_IN_RECORD: "border-white/20 bg-white/10 text-[#9cb2d2]",
  INCOMPATIBLE: "border-rose-400/40 bg-rose-500/15 text-rose-200",
  NOT_SPECIFIED: "border-white/10 bg-white/[0.03] text-[#6a84a9]",
};

function createBlankScenario(habitatId: MissionHabitatId = "ISS"): MissionScenarioInput {
  const hab = MISSION_HABITATS.find((h) => h.id === habitatId) ?? MISSION_HABITATS[1];
  return {
    habitat: hab.id,
    gravityRegime: hab.defaultGravity,
    safetyDomain: "ALL",
    oxygenValue: null,
    oxygenUnit: "%",
    pressureValue: null,
    pressureUnit: "kPa",
    airflowValue: null,
    airflowUnit: "m/s",
    materialQuery: "",
  };
}

function parseNullableNumber(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const num = Number(trimmed);
  return Number.isFinite(num) ? num : null;
}

const TEST_ASSUMPTION_PRESETS: readonly {
  id: string;
  label: string;
  scenario: MissionScenarioInput;
}[] = [
  {
    id: "iss-polymer",
    label: "ISS Microgravity Polymer (Hypothetical)",
    scenario: {
      habitat: "ISS",
      gravityRegime: "MICROGRAVITY",
      safetyDomain: "PREVENTION",
      oxygenValue: 20,
      oxygenUnit: "%",
      pressureValue: 98,
      pressureUnit: "kPa",
      airflowValue: 0.04,
      airflowUnit: "m/s",
      materialQuery: "polymer",
    },
  },
  {
    id: "lunar-habitat",
    label: "Lunar 1/6 g Habitat (Hypothetical)",
    scenario: {
      habitat: "LUNAR_HABITAT",
      gravityRegime: "LUNAR_GRAVITY",
      safetyDomain: "PREVENTION",
      oxygenValue: 23,
      oxygenUnit: "%",
      pressureValue: 100,
      pressureUnit: "kPa",
      airflowValue: 0.08,
      airflowUnit: "m/s",
      materialQuery: "liner",
    },
  },
  {
    id: "mars-suppression",
    label: "Mars 0.38 g Suppression (Hypothetical)",
    scenario: {
      habitat: "MARS_HABITAT",
      gravityRegime: "MARS_GRAVITY",
      safetyDomain: "SUPPRESSION",
      oxygenValue: 17,
      oxygenUnit: "%",
      pressureValue: 92,
      pressureUnit: "kPa",
      airflowValue: 0.02,
      airflowUnit: "m/s",
      materialQuery: "liquid",
    },
  },
  {
    id: "unit-mismatch",
    label: "Unit Conflict Test (% wt vs %)",
    scenario: {
      habitat: "SPACECRAFT",
      gravityRegime: "MICROGRAVITY",
      safetyDomain: "PREVENTION",
      oxygenValue: 21,
      oxygenUnit: "% wt",
      pressureValue: 98,
      pressureUnit: "kPa",
      airflowValue: 0.04,
      airflowUnit: "m/s",
      materialQuery: "",
    },
  },
];

export function MissionLabView({ records, isAiConfigured, initialHabitat, dataSource = "fixture" }: MissionLabViewProps) {
  const initialHabId = MISSION_HABITATS.some((h) => h.id === initialHabitat)
    ? (initialHabitat as MissionHabitatId)
    : "ISS";

  const [scenario, setScenario] = useState<MissionScenarioInput>(() => createBlankScenario(initialHabId));
  const [o2Text, setO2Text] = useState("");
  const [pText, setPText] = useState("");
  const [airText, setAirText] = useState("");
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [showUnavailable, setShowUnavailable] = useState(false);

  const [aiLoading, setAiLoading] = useState(false);
  const [aiResponse, setAiResponse] = useState<AssistantApiResponse | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [activeCitation, setActiveCitation] = useState<AssistantCitation | null>(null);

  const report = useMemo(() => matchMissionScenario(records, scenario), [records, scenario]);

  const activeMatch = useMemo(() => {
    if (report.matchedResults.length === 0) return null;
    if (selectedMatchId) {
      const found = report.matchedResults.find((m) => m.recordId === selectedMatchId);
      if (found) return found;
    }
    return report.matchedResults[0];
  }, [report.matchedResults, selectedMatchId]);

  const scopeBadgeStatus =
    report.datasetScope.scope === "VERIFIED_INDEXED_DATA"
      ? "verified"
      : report.datasetScope.scope === "EMPTY"
        ? "empty"
        : "demo";

  function selectHabitat(habId: MissionHabitatId) {
    const def = MISSION_HABITATS.find((h) => h.id === habId) ?? MISSION_HABITATS[0];
    setScenario((prev) => ({
      ...prev,
      habitat: def.id,
      gravityRegime: def.defaultGravity,
    }));
    setAiResponse(null);
  }

  function applyPreset(presetScenario: MissionScenarioInput) {
    setScenario(presetScenario);
    setO2Text(presetScenario.oxygenValue !== null ? String(presetScenario.oxygenValue) : "");
    setPText(presetScenario.pressureValue !== null ? String(presetScenario.pressureValue) : "");
    setAirText(presetScenario.airflowValue !== null ? String(presetScenario.airflowValue) : "");
    setSelectedMatchId(null);
    setAiResponse(null);
    setAiError(null);
  }

  function handleReset() {
    applyPreset(createBlankScenario(scenario.habitat));
  }

  async function handleGenerateExplanation() {
    if (report.matchedResults.length === 0 || aiLoading) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const res = await fetch("/api/mission-explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          habitatName: report.habitat.name,
          highestClassification: report.overallHighestEvidence,
          matchedRecordIds: report.matchedResults.slice(0, 4).map((m) => m.recordId),
        }),
      });
      const json = (await res.json()) as AssistantApiResponse;
      setAiResponse(json);
    } catch {
      setAiError("Unable to reach /api/mission-explain. Deterministic evidence matching above remains valid.");
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-x-clip bg-[#050b1b] text-[#f4f8ff] lg:grid lg:grid-cols-[260px_1fr]">
      <ExploreSpaceBackground />
      <Sidebar />

      <main className="explore-main-stage relative z-10 min-w-0 px-4 py-6 sm:px-8 sm:py-8 lg:px-10 lg:py-9">
        <div className="mx-auto max-w-[1220px] space-y-6">
          {/* Header & Non-Negotiable Scientific Boundary Disclaimer */}
          <Card className="border border-white/10 bg-[#09152e]/85 p-5 backdrop-blur-md sm:p-7">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="font-mono text-[10px] font-semibold tracking-[.18em] text-[#52b6ff] uppercase">
                  PHASE 4 INSTRUMENTATION // DETERMINISTIC SCENARIO MATCHER
                </p>
                <h1 className="mt-1.5 flex items-center gap-2.5 text-2xl font-extrabold tracking-tight text-[#f4f8ff] sm:text-3xl">
                  <Compass size={26} className="text-[#ff8a32]" aria-hidden="true" />
                  OrbitFlame Mission Lab
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#9cb2d2]">
                  Explore how a hypothetical mission scenario relates to existing indexed combustion research.
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
              data-testid="mission-lab-disclaimer"
              className="mt-5 flex items-start gap-3 rounded-xl border border-[#ff8a32]/40 bg-[#ff5500]/10 p-3.5 text-xs leading-5 text-amber-100"
            >
              <ShieldAlert size={17} className="mt-0.5 shrink-0 text-[#ff8a32]" aria-hidden="true" />
              <div>
                <span className="font-mono text-[10.5px] font-bold tracking-wider text-[#ffb067] uppercase">
                  SCIENTIFIC BOUNDARY DISCLAIMER
                </span>
                <p className="mt-0.5 font-medium text-[#fff2e2]">{report.disclaimer}</p>
              </div>
            </div>
          </Card>

          <div className="grid gap-6 xl:grid-cols-[410px_minmax(0,1fr)]">
            {/* LEFT: Hypothetical Mission Scenario Builder */}
            <div className="space-y-5">
              <Card className="border border-white/10 bg-[#09152e]/85 p-5 backdrop-blur-md">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3">
                  <div>
                    <p className="font-mono text-[10px] font-bold tracking-[.16em] text-[#ff8a32] uppercase">
                      HYPOTHETICAL MISSION SCENARIO BUILDER
                    </p>
                    <p className="mt-0.5 text-[11px] text-[#8ea5c7]">
                      All inputs below represent user-entered assumptions — never NASA specifications or measurements.
                    </p>
                    <p className="mt-0.5 font-mono text-[10px] text-[#6f88ad]">
                      Matcher dimensions: gravity regime, pillar, O2 %, total pressure, airflow, material keyword. Each is compared, unit-checked, with the investigation-level median conditions of the PSI tables.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleReset}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/[0.04] px-2.5 py-1.5 font-mono text-[10px] font-semibold text-[#c4d7f2] hover:border-[#36a9ff]"
                  >
                    <RotateCcw size={12} aria-hidden="true" /> Reset inputs
                  </button>
                </div>

                {/* Habitat Selector */}
                <div className="mt-4">
                  <span className="font-mono text-[10px] font-semibold tracking-[.14em] text-[#52b6ff] uppercase">
                    1. Select Mission Context
                  </span>
                  <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-2">
                    {MISSION_HABITATS.map((hab) => {
                      const active = scenario.habitat === hab.id;
                      return (
                        <button
                          key={hab.id}
                          type="button"
                          onClick={() => selectHabitat(hab.id)}
                          aria-pressed={active}
                          className={`rounded-xl border px-3 py-2.5 text-left transition-all ${
                            active
                              ? "border-[#36a9ff]/60 bg-[linear-gradient(135deg,#0d254f_0%,#13386e_100%)] text-white shadow-[0_6px_18px_-6px_rgba(54,169,255,0.45)]"
                              : "border-white/10 bg-[#060e22]/80 text-[#9cb2d2] hover:border-white/25 hover:text-white"
                          }`}
                        >
                          <span className="block font-mono text-[9px] font-semibold tracking-wider text-[#52b6ff]">
                            {hab.code}
                          </span>
                          <span className="mt-0.5 block text-xs font-bold">{hab.shortName}</span>
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-2.5 rounded-lg border border-white/10 bg-[#060e22]/70 p-2.5 text-[11px] leading-relaxed text-[#a8bedf]">
                    {report.habitat.environmentNote}
                  </p>
                </div>

                {/* Scenario Parameters */}
                <div className="mt-4 space-y-3.5">
                  <div>
                    <label
                      htmlFor="mission-gravity-select"
                      className="block font-mono text-[10px] font-semibold tracking-[.14em] text-[#52b6ff] uppercase"
                    >
                      2. Gravity Environment Assumption
                    </label>
                    <select
                      id="mission-gravity-select"
                      value={scenario.gravityRegime}
                      onChange={(e) =>
                        setScenario((prev) => ({
                          ...prev,
                          gravityRegime: e.target.value as GravityRegimeClass | "UNSPECIFIED",
                        }))
                      }
                      className="mt-1.5 w-full rounded-xl border border-white/15 bg-[#050b1b] px-3 py-2 text-xs text-[#f4f8ff] focus:border-[#36a9ff] focus:outline-none"
                    >
                      <option value="MICROGRAVITY">Microgravity (~0 g)</option>
                      <option value="LUNAR_GRAVITY">Lunar gravity (~1/6 g — partial)</option>
                      <option value="MARS_GRAVITY">Mars gravity (~0.38 g — partial)</option>
                      <option value="PARTIAL_GRAVITY">Partial gravity (surface-dependent / unspecified)</option>
                      <option value="NORMAL_GRAVITY">Normal gravity (~1 g Earth baseline)</option>
                      <option value="UNSPECIFIED">Unspecified (compare without gravity constraint)</option>
                    </select>
                  </div>

                  <div>
                    <span className="block font-mono text-[10px] font-semibold tracking-[.14em] text-[#52b6ff] uppercase">
                      3. Fire-Safety Domain Focus
                    </span>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {(["ALL", "PREVENTION", "DETECTION", "SUPPRESSION"] as const).map((dom) => (
                        <button
                          key={dom}
                          type="button"
                          onClick={() => setScenario((prev) => ({ ...prev, safetyDomain: dom as SafetyDomainOption }))}
                          aria-pressed={scenario.safetyDomain === dom}
                          className={`rounded-lg border px-2.5 py-1.5 font-mono text-[10px] font-semibold tracking-wider uppercase ${
                            scenario.safetyDomain === dom
                              ? "border-[#ff8a32]/50 bg-[#ff5500]/20 text-[#ffb067]"
                              : "border-white/10 bg-[#050b1b] text-[#8ea5c7] hover:text-white"
                          }`}
                        >
                          {dom}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-1">
                    {/* Oxygen Concentration */}
                    <div>
                      <label
                        htmlFor="mission-o2-input"
                        className="block font-mono text-[10px] font-semibold tracking-[.14em] text-[#52b6ff] uppercase"
                      >
                        4. Oxygen Concentration (Optional Assumption)
                      </label>
                      <div className="mt-1.5 flex gap-2">
                        <input
                          id="mission-o2-input"
                          type="number"
                          step="any"
                          min="0"
                          max="100"
                          value={o2Text}
                          onChange={(e) => {
                            const val = e.target.value;
                            setO2Text(val);
                            setScenario((prev) => ({ ...prev, oxygenValue: parseNullableNumber(val) }));
                          }}
                          placeholder="Unset (e.g. 21)"
                          className="min-w-0 flex-1 rounded-xl border border-white/15 bg-[#050b1b] px-3 py-2 text-xs text-[#f4f8ff] placeholder:text-[#6a84a9] focus:border-[#36a9ff] focus:outline-none"
                        />
                        <select
                          aria-label="Oxygen unit"
                          value={scenario.oxygenUnit}
                          onChange={(e) =>
                            setScenario((prev) => ({
                              ...prev,
                              oxygenUnit: e.target.value as MissionScenarioInput["oxygenUnit"],
                            }))
                          }
                          className="w-24 rounded-xl border border-white/15 bg-[#050b1b] px-2 py-2 font-mono text-xs text-[#f4f8ff]"
                        >
                          <option value="%">%</option>
                          <option value="% vol">% vol</option>
                          <option value="% wt">% wt</option>
                          <option value="">No unit</option>
                        </select>
                      </div>
                    </div>

                    {/* Pressure */}
                    <div>
                      <label
                        htmlFor="mission-pressure-input"
                        className="block font-mono text-[10px] font-semibold tracking-[.14em] text-[#52b6ff] uppercase"
                      >
                        5. Total Pressure (Optional Assumption)
                      </label>
                      <div className="mt-1.5 flex gap-2">
                        <input
                          id="mission-pressure-input"
                          type="number"
                          step="any"
                          min="0"
                          value={pText}
                          onChange={(e) => {
                            const val = e.target.value;
                            setPText(val);
                            setScenario((prev) => ({ ...prev, pressureValue: parseNullableNumber(val) }));
                          }}
                          placeholder="Unset (e.g. 98)"
                          className="min-w-0 flex-1 rounded-xl border border-white/15 bg-[#050b1b] px-3 py-2 text-xs text-[#f4f8ff] placeholder:text-[#6a84a9] focus:border-[#36a9ff] focus:outline-none"
                        />
                        <select
                          aria-label="Pressure unit"
                          value={scenario.pressureUnit}
                          onChange={(e) =>
                            setScenario((prev) => ({
                              ...prev,
                              pressureUnit: e.target.value as MissionScenarioInput["pressureUnit"],
                            }))
                          }
                          className="w-24 rounded-xl border border-white/15 bg-[#050b1b] px-2 py-2 font-mono text-xs text-[#f4f8ff]"
                        >
                          <option value="kPa">kPa</option>
                          <option value="Pa">Pa</option>
                          <option value="atm">atm</option>
                          <option value="psi">psi</option>
                          <option value="bar">bar</option>
                          <option value="">No unit</option>
                        </select>
                      </div>
                    </div>

                    {/* Airflow */}
                    <div>
                      <label
                        htmlFor="mission-airflow-input"
                        className="block font-mono text-[10px] font-semibold tracking-[.14em] text-[#52b6ff] uppercase"
                      >
                        6. Forced Airflow (Optional Assumption)
                      </label>
                      <div className="mt-1.5 flex gap-2">
                        <input
                          id="mission-airflow-input"
                          type="number"
                          step="any"
                          min="0"
                          value={airText}
                          onChange={(e) => {
                            const val = e.target.value;
                            setAirText(val);
                            setScenario((prev) => ({ ...prev, airflowValue: parseNullableNumber(val) }));
                          }}
                          placeholder="Unset (e.g. 0.04)"
                          className="min-w-0 flex-1 rounded-xl border border-white/15 bg-[#050b1b] px-3 py-2 text-xs text-[#f4f8ff] placeholder:text-[#6a84a9] focus:border-[#36a9ff] focus:outline-none"
                        />
                        <select
                          aria-label="Airflow unit"
                          value={scenario.airflowUnit}
                          onChange={(e) =>
                            setScenario((prev) => ({
                              ...prev,
                              airflowUnit: e.target.value as MissionScenarioInput["airflowUnit"],
                            }))
                          }
                          className="w-24 rounded-xl border border-white/15 bg-[#050b1b] px-2 py-2 font-mono text-xs text-[#f4f8ff]"
                        >
                          <option value="m/s">m/s</option>
                          <option value="cm/s">cm/s</option>
                          <option value="mm/s">mm/s</option>
                          <option value="">No unit</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Material Query */}
                  <div>
                    <label
                      htmlFor="mission-material-input"
                      className="block font-mono text-[10px] font-semibold tracking-[.14em] text-[#52b6ff] uppercase"
                    >
                      7. Combustion Material Keyword (Optional Assumption)
                    </label>
                    <input
                      id="mission-material-input"
                      type="text"
                      value={scenario.materialQuery}
                      onChange={(e) => setScenario((prev) => ({ ...prev, materialQuery: e.target.value }))}
                      placeholder="e.g. polymer, cellulose, aerosol, liquid, liner..."
                      className="mt-1.5 w-full rounded-xl border border-white/15 bg-[#050b1b] px-3 py-2 text-xs text-[#f4f8ff] placeholder:text-[#6a84a9] focus:border-[#36a9ff] focus:outline-none"
                    />
                  </div>
                </div>

                {/* Illustrative Test Input Presets */}
                <div className="mt-5 border-t border-white/10 pt-4">
                  <p className="font-mono text-[9.5px] font-semibold tracking-[.15em] text-[#ffb067] uppercase">
                    USER HYPOTHESIS TEST PRESETS (NOT NASA STANDARDS)
                  </p>
                  <div className="mt-2 grid gap-1.5">
                    {TEST_ASSUMPTION_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => applyPreset(preset.scenario)}
                        className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-[#050b1b]/80 px-3 py-2 text-left text-[11px] font-medium text-[#c4d7f2] transition-colors hover:border-[#36a9ff]/45 hover:text-white"
                      >
                        <span>{preset.label}</span>
                        <ArrowRight size={13} className="shrink-0 text-[#52b6ff]" aria-hidden="true" />
                      </button>
                    ))}
                  </div>
                </div>
              </Card>

              {/* Documented Classification Rules */}
              <Card className="border border-white/10 bg-[#09152e]/80 p-5 backdrop-blur-md">
                <div className="flex items-center gap-2">
                  <Info size={15} className="text-[#52b6ff]" aria-hidden="true" />
                  <h2 className="font-mono text-[10.5px] font-bold tracking-[.16em] text-[#52b6ff] uppercase">
                    DETERMINISTIC CLASSIFICATION RULES
                  </h2>
                </div>
                <dl className="mt-3 space-y-2.5 text-xs">
                  {report.ruleDefinitions.map((rule) => (
                    <div key={rule.level} className="rounded-lg border border-white/10 bg-[#050d21]/80 p-2.5">
                      <dt className="font-mono text-[10px] font-bold text-[#f4f8ff]">{rule.level}</dt>
                      <dd className="mt-1 leading-relaxed text-[#9cb2d2]">{rule.rule}</dd>
                    </div>
                  ))}
                </dl>
              </Card>
            </div>

            {/* RIGHT: Pathway Diagram, Matched Results, Evidence Stop Boundaries, Optional AI Explain */}
            <div className="min-w-0 space-y-5">
              <MissionPathwaySvg
                habitat={report.habitat}
                activeMatch={activeMatch}
                overallHighestEvidence={report.overallHighestEvidence}
              />

              {/* Summary Telemetry Bar */}
              <div className="grid gap-3 sm:grid-cols-3">
                <Card className="border border-white/10 bg-[#09152e]/80 p-4 backdrop-blur-md">
                  <p className="font-mono text-[10px] tracking-[.14em] text-[#8ea5c7] uppercase">
                    HIGHEST EVIDENCE LEVEL
                  </p>
                  <div className="mt-2">
                    <span
                      data-testid="mission-highest-classification"
                      className={`inline-block rounded-full border px-3 py-1 font-mono text-xs font-bold ${
                        CLASSIFICATION_STYLES[report.overallHighestEvidence]
                      }`}
                    >
                      {report.overallHighestEvidence}
                    </span>
                  </div>
                </Card>

                <Card className="border border-white/10 bg-[#09152e]/80 p-4 backdrop-blur-md">
                  <p className="font-mono text-[10px] tracking-[.14em] text-[#8ea5c7] uppercase">
                    INDEXED MATCHES FOUND
                  </p>
                  <p className="mt-1.5 text-2xl font-extrabold text-[#f4f8ff]">
                    {report.matchedResults.length}{" "}
                    <span className="text-xs font-normal text-[#8ea5c7]">/ {records.length} indexed</span>
                  </p>
                </Card>

                <Card className="border border-white/10 bg-[#09152e]/80 p-4 backdrop-blur-md">
                  <p className="font-mono text-[10px] tracking-[.14em] text-[#8ea5c7] uppercase">
                    EXCLUDED / UNAVAILABLE
                  </p>
                  <p className="mt-1.5 text-2xl font-extrabold text-[#f4f8ff]">
                    {report.unavailableRecords.length}{" "}
                    <span className="text-xs font-normal text-[#8ea5c7]">zero alignment</span>
                  </p>
                </Card>
              </div>

              <MissionPredictorLazy
                key={habitatKeyFromParam(initialHabitat, scenario.habitat)}
                initialHabitat={habitatKeyFromParam(initialHabitat, scenario.habitat)}
                dataSource={dataSource}
                metadataOnly={records.filter((r) => r.rowStatus === "metadata_only").map((r) => ({ id: r.id, name: r.name }))}
                totalInvestigations={records.length}
              />

              <GravityLadder records={records} />
              <Connections />

              {/* Optional Evidence-Only AI Summary of Matched Scope */}
              <Card className="border border-[#36a9ff]/25 bg-[#09152e]/85 p-5 backdrop-blur-md">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <Sparkles size={15} className="text-[#52b6ff]" aria-hidden="true" />
                      <h2 className="font-mono text-[11px] font-bold tracking-[.16em] text-[#52b6ff] uppercase">
                        OPTIONAL AI EVIDENCE EXPLANATION (STRICT MODE)
                      </h2>
                    </div>
                    <p className="mt-1 text-xs text-[#9cb2d2]">
                      Reuses the server-side evidence-only pipeline strictly scoped to matched records. Never alters
                      deterministic classifications.
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={aiLoading || report.matchedResults.length === 0}
                    onClick={() => void handleGenerateExplanation()}
                    className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[linear-gradient(135deg,#0b3d91_0%,#ff5500_100%)] px-4 py-2.5 font-mono text-[11px] font-bold tracking-wider text-white uppercase disabled:opacity-45"
                  >
                    {aiLoading ? <Loader2 size={14} className="animate-spin" /> : <Activity size={14} />}
                    Summarize Matched Evidence
                  </button>
                </div>

                {!isAiConfigured && !aiResponse && (
                  <p className="mt-3 rounded-lg border border-[#36a9ff]/30 bg-[#06122c] px-3 py-2 font-mono text-[10.5px] text-[#8fd0ff]">
                    OPENAI_API_KEY is not configured in server environment variables; deterministic matching above operates
                    without LLM synthesis.
                  </p>
                )}

                {aiError && (
                  <p className="mt-3 rounded-lg border border-rose-400/35 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">
                    {aiError}
                  </p>
                )}

                {aiResponse && (
                  <div
                    data-testid="mission-ai-explanation"
                    className="mt-4 space-y-3 rounded-xl border border-white/10 bg-[#050d21]/90 p-4"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-[#36a9ff]/35 bg-[#36a9ff]/15 px-2.5 py-0.5 font-mono text-[10px] font-bold text-[#7bc5ff]">
                        {aiResponse.status}
                      </span>
                      <span className="rounded-full border border-white/15 bg-white/5 px-2.5 py-0.5 font-mono text-[10px] text-[#9cb2d2]">
                        {aiResponse.sufficiency}
                      </span>
                    </div>
                    <p className="text-xs leading-relaxed text-[#e5efff]">{aiResponse.answer}</p>
                    {aiResponse.citations.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {aiResponse.citations.map((cit) => (
                          <button
                            key={cit.evidenceId}
                            type="button"
                            onClick={() => setActiveCitation(cit)}
                            className="inline-flex items-center gap-1 rounded-lg border border-[#36a9ff]/30 bg-[#0a1d42] px-2.5 py-1 font-mono text-[10.5px] text-[#7bc5ff] hover:border-[#36a9ff]"
                          >
                            <FileCheck2 size={11} aria-hidden="true" />[{cit.citationNumber}] {cit.investigationId} ·{" "}
                            {cit.fieldLabel}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </Card>

              {/* Matched Results */}
              {report.matchedResults.length === 0 ? (
                <Card
                  data-testid="mission-no-match"
                  className="border border-amber-400/30 bg-[#09152e]/85 p-6 text-center backdrop-blur-md"
                >
                  <AlertTriangle size={24} className="mx-auto text-amber-300" aria-hidden="true" />
                  <h2 className="mt-2 text-base font-bold text-[#f4f8ff]">
                    UNAVAILABLE — Zero Compatible Indexed Records
                  </h2>
                  <p className="mx-auto mt-1.5 max-w-xl text-xs leading-relaxed text-[#9cb2d2]">
                    No indexed investigations agreed with the supplied scenario constraints without violating unit
                    compatibility or gravity-regime boundaries. Relax optional inputs or reset scenario assumptions to
                    inspect analogous context.
                  </p>
                </Card>
              ) : (
                <div className="space-y-4">
                  {report.matchedResults.map((match) => {
                    const isSelectedPathway = activeMatch?.recordId === match.recordId;
                    return (
                      <Card
                        key={match.recordId}
                        data-testid={`mission-match-${match.recordId}`}
                        className={`border p-5 backdrop-blur-md transition-colors ${
                          isSelectedPathway
                            ? "border-[#36a9ff]/55 bg-[#091938]/90"
                            : "border-white/10 bg-[#09152e]/80"
                        }`}
                      >
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono text-xs font-bold text-[#ff8a32]">
                                {match.recordId} {match.family ? `// ${match.family}` : ""}
                              </span>
                              <span
                                className={`rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-bold ${
                                  CLASSIFICATION_STYLES[match.classification]
                                }`}
                              >
                                {match.classification}
                              </span>
                              <span
                                className={`rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-semibold ${
                                  match.isVerified
                                    ? "border-emerald-400/35 bg-emerald-500/15 text-emerald-200"
                                    : "border-amber-400/35 bg-amber-400/10 text-amber-200"
                                }`}
                              >
                                {match.provenanceLabel}
                              </span>
                            </div>
                            <h3 className="mt-1.5 text-lg font-extrabold text-[#f4f8ff]">{match.recordName}</h3>
                            <p className="mt-1 text-xs leading-relaxed text-[#c9daf2]">{match.whyMatched}</p>
                            <p className="mt-1 font-mono text-[10.5px] text-[#7d95b8]">
                              RULE TRACE: {match.classificationRuleTrace}
                            </p>
                          </div>

                          <div className="flex shrink-0 flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => setSelectedMatchId(match.recordId)}
                              className={`rounded-xl border px-3 py-1.5 font-mono text-[10.5px] font-semibold transition-colors ${
                                isSelectedPathway
                                  ? "border-[#36a9ff] bg-[#36a9ff]/20 text-white"
                                  : "border-white/15 bg-white/[0.04] text-[#c4d7f2] hover:border-[#36a9ff]"
                              }`}
                            >
                              {isSelectedPathway ? "Viewing in Pathway" : "Inspect Pathway"}
                            </button>
                            <Link
                              href={`/investigations/${encodeURIComponent(match.recordId)}`}
                              className="rounded-xl border border-white/15 bg-white/[0.04] px-3 py-1.5 font-mono text-[10.5px] font-semibold text-[#7bc5ff] hover:border-[#36a9ff]"
                            >
                              Record Detail
                            </Link>
                            <Link
                              href={`/compare?ids=${encodeURIComponent(match.recordId)}`}
                              onClick={() => setCompareIds([match.recordId])}
                              className="inline-flex items-center gap-1 rounded-xl border border-[#ff8a32]/35 bg-[#ff5500]/10 px-3 py-1.5 font-mono text-[10.5px] font-semibold text-[#ffb067] hover:border-[#ff8a32]"
                            >
                              <GitCompareArrows size={12} aria-hidden="true" /> Compare
                            </Link>
                          </div>
                        </div>

                        {/* Parameter Bridge Table */}
                        <div className="mt-4 overflow-x-auto rounded-xl border border-white/10 bg-[#050d21]/80">
                          <table className="w-full min-w-[540px] text-left text-xs">
                            <thead>
                              <tr className="border-b border-white/10 font-mono text-[10px] tracking-wider text-[#7d95b8] uppercase">
                                <th className="px-3.5 py-2.5">Parameter</th>
                                <th className="px-3.5 py-2.5">Scenario Assumption</th>
                                <th className="px-3.5 py-2.5">Indexed Record Evidence</th>
                                <th className="px-3.5 py-2.5">Alignment</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-white/10">
                              {match.parameters.map((p) => (
                                <tr key={p.key} className="align-top">
                                  <td className="px-3.5 py-2.5 font-semibold text-[#e5efff]">{p.label}</td>
                                  <td className="px-3.5 py-2.5 font-mono text-[11px] text-[#9cb2d2]">
                                    {p.scenarioAssumption}
                                  </td>
                                  <td className="px-3.5 py-2.5 font-mono text-[11px] text-[#f4f8ff]">
                                    {p.recordEvidence}
                                    <span className="mt-0.5 block font-sans text-[11px] text-[#7d95b8]">
                                      {p.explanation}
                                    </span>
                                  </td>
                                  <td className="px-3.5 py-2.5">
                                    <span
                                      className={`inline-block rounded-full border px-2 py-0.5 font-mono text-[9.5px] font-bold ${
                                        ALIGN_BADGES[p.status]
                                      }`}
                                    >
                                      {p.status}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        {/* What Evidence Cannot Establish */}
                        <div className="mt-3.5 rounded-xl border border-rose-400/25 bg-rose-500/[0.07] p-3">
                          <p className="font-mono text-[10px] font-bold tracking-[.14em] text-rose-200 uppercase">
                            WHAT THIS EVIDENCE CANNOT ESTABLISH
                          </p>
                          <ul className="mt-1.5 list-disc space-y-1 pl-4 text-xs text-rose-100/90">
                            {match.cannotEstablish.map((lim) => (
                              <li key={lim}>{lim}</li>
                            ))}
                          </ul>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}

              {/* Excluded / Unavailable Records Inspector */}
              {report.unavailableRecords.length > 0 && (
                <Card className="border border-white/10 bg-[#09152e]/75 p-4 backdrop-blur-md">
                  <button
                    type="button"
                    onClick={() => setShowUnavailable((v) => !v)}
                    className="flex w-full items-center justify-between text-left font-mono text-[11px] font-semibold tracking-wider text-[#9cb2d2] uppercase hover:text-white"
                  >
                    <span>
                      EXCLUDED INDEXED RECORDS ({report.unavailableRecords.length} classified UNAVAILABLE for this
                      scenario)
                    </span>
                    <span>{showUnavailable ? "Hide" : "Inspect reasons"}</span>
                  </button>
                  {showUnavailable && (
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {report.unavailableRecords.map((u) => (
                        <div key={u.id} className="rounded-lg border border-white/10 bg-[#050d21]/80 p-3 text-xs">
                          <Link
                            href={`/investigations/${encodeURIComponent(u.id)}`}
                            className="font-mono font-bold text-[#7bc5ff] hover:underline"
                          >
                            {u.id} — {u.name}
                          </Link>
                          <p className="mt-1 text-[11px] text-[#8ea5c7]">{u.reason}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              )}
            </div>
          </div>
        </div>
      </main>

      <CitationEvidenceDrawer citation={activeCitation} onClose={() => setActiveCitation(null)} />
    </div>
  );
}
