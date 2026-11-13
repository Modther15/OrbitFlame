import type { DemoInvestigation } from "@/lib/api/schemas";
import type { InvestigationSummary } from "@/lib/data/summary";

/** Full record or slim list summary (counts precomputed); the matcher only needs measurement counts. */
type MatchableRecord = DemoInvestigation | InvestigationSummary;
import { DEMO_WARNING } from "@/lib/demo/dataset";
import {
  classifyGravityRegime,
  deriveDatasetScope,
  extractRecordNumericCondition,
  formatProvenanceTag,
  gravityRegimeLabel,
  isRecordVerified,
  type GravityRegimeClass,
} from "@/lib/science/provenance";
import { checkNumericUnitCompatibility } from "@/lib/science/units";

export type MissionHabitatId =
  | "SPACECRAFT"
  | "ISS"
  | "LUNAR_HABITAT"
  | "MARS_HABITAT"
  | "ROVER"
  | "CUSTOM";

export type EvidenceClassification =
  | "DIRECT"
  | "ANALOGOUS"
  | "MECHANISM_ONLY"
  | "PLANNED"
  | "UNAVAILABLE";

export type ParameterAlignmentStatus =
  | "AGREES"
  | "DIFFERS"
  | "MISSING_IN_RECORD"
  | "INCOMPATIBLE"
  | "NOT_SPECIFIED";

export type SafetyDomainOption = "ALL" | "PREVENTION" | "DETECTION" | "SUPPRESSION";

export type MissionScenarioInput = {
  habitat: MissionHabitatId;
  gravityRegime: GravityRegimeClass | "UNSPECIFIED";
  safetyDomain: SafetyDomainOption;
  oxygenValue: number | null;
  oxygenUnit: "%" | "% vol" | "% wt" | "";
  pressureValue: number | null;
  pressureUnit: "kPa" | "Pa" | "atm" | "psi" | "bar" | "";
  airflowValue: number | null;
  airflowUnit: "m/s" | "cm/s" | "mm/s" | "";
  materialQuery: string;
};

export type HabitatDefinition = {
  id: MissionHabitatId;
  code: string;
  name: string;
  shortName: string;
  defaultGravity: GravityRegimeClass | "UNSPECIFIED";
  environmentNote: string;
  telemetryContext: string;
};

export const MISSION_HABITATS: readonly HabitatDefinition[] = [
  {
    id: "SPACECRAFT",
    code: "CTX-01 // TRANSIT",
    name: "Deep-Space Spacecraft",
    shortName: "Spacecraft",
    defaultGravity: "MICROGRAVITY",
    environmentNote: "Sustained free-fall microgravity cabin during crew transit. Condition alignment still requires verification of O₂, pressure, airflow, and material.",
    telemetryContext: "Free-fall orbital / transit trajectory",
  },
  {
    id: "ISS",
    code: "CTX-02 // LEO",
    name: "ISS-like Station Habitat",
    shortName: "ISS Habitat",
    defaultGravity: "MICROGRAVITY",
    environmentNote: "Microgravity orbital laboratory module. Closest gravity regime to ISS PSI combustion campaigns, subject to specific run conditions.",
    telemetryContext: "Low Earth Orbit continuous microgravity",
  },
  {
    id: "LUNAR_HABITAT",
    code: "CTX-03 // LUNA",
    name: "Lunar Surface Habitat",
    shortName: "Lunar Habitat",
    defaultGravity: "LUNAR_GRAVITY",
    environmentNote: "Partial gravity (~1/6 g). Microgravity experiments are NEVER direct evidence for lunar buoyancy, flame spread, or convective cooling.",
    telemetryContext: "Lunar regolith surface (~1/6 g)",
  },
  {
    id: "MARS_HABITAT",
    code: "CTX-04 // MARS",
    name: "Mars Surface Habitat",
    shortName: "Mars Habitat",
    defaultGravity: "MARS_GRAVITY",
    environmentNote: "Partial gravity (~0.38 g). Indexed microgravity or Earth-normal records serve only as analogous or mechanism references.",
    telemetryContext: "Martian surface (~0.38 g)",
  },
  {
    id: "ROVER",
    code: "CTX-05 // MOBILITY",
    name: "Pressurized Surface Rover",
    shortName: "Rover",
    defaultGravity: "PARTIAL_GRAVITY",
    environmentNote: "Confined pressurized mobility cabin under surface-dependent partial gravity. Must not be evaluated using microgravity assumptions alone.",
    telemetryContext: "Surface mobility pressurized cabin",
  },
  {
    id: "CUSTOM",
    code: "CTX-06 // CUSTOM",
    name: "Custom Hypothetical Environment",
    shortName: "Custom",
    defaultGravity: "UNSPECIFIED",
    environmentNote: "User-defined hypothetical mission assumptions for sensitivity and evidence-boundary inspection.",
    telemetryContext: "User-defined custom bounds",
  },
];

export type ParameterComparisonDetail = {
  key: "gravity" | "safety_domain" | "material" | "oxygen" | "pressure" | "airflow" | "measurements";
  label: string;
  scenarioAssumption: string;
  recordEvidence: string;
  status: ParameterAlignmentStatus;
  explanation: string;
};

export type MissionMatchResult = {
  recordId: string;
  recordName: string;
  family: string | null;
  classification: EvidenceClassification;
  classificationRuleTrace: string;
  provenanceLabel: string;
  isDemoFixture: boolean;
  isVerified: boolean;
  alignmentSummary: {
    agreeCount: number;
    differCount: number;
    missingCount: number;
    incompatibleCount: number;
    specifiedScenarioCount: number;
    conditionCoveragePercent: number;
  };
  whyMatched: string;
  parameters: ParameterComparisonDetail[];
  agreedParameters: string[];
  differingParameters: string[];
  missingParameters: string[];
  incompatibleComparisons: string[];
  cannotEstablish: string[];
};

export type MissionMatchReport = {
  disclaimer: string;
  scenario: MissionScenarioInput;
  habitat: HabitatDefinition;
  datasetScope: ReturnType<typeof deriveDatasetScope>;
  overallHighestEvidence: EvidenceClassification;
  ruleDefinitions: readonly {
    level: EvidenceClassification;
    rule: string;
  }[];
  matchedResults: MissionMatchResult[];
  unavailableRecords: {
    id: string;
    name: string;
    reason: string;
  }[];
};

export const MISSION_LAB_DISCLAIMER =
  "This tool matches mission scenarios against indexed scientific evidence. It is not a fire simulation, spacecraft safety certification, or validated physical prediction model." as const;

export const CLASSIFICATION_RULES: readonly { level: EvidenceClassification; rule: string }[] = [
  {
    level: "DIRECT",
    rule: "Requires NASA_VERIFIED_DATA with a VERIFIED source locator, record evidenceLevel = DIRECT, exact gravity regime agreement (no partial-g promotion from 0 g), zero differing or incompatible specified parameters, and populated run measurements.",
  },
  {
    level: "ANALOGOUS",
    rule: "Assigned when at least one domain, material, or compatible physical condition overlaps, but gravity regime differs (e.g., 0 g vs Lunar/Mars partial-g), one or more conditions differ/are missing, or measurements are empty.",
  },
  {
    level: "MECHANISM_ONLY",
    rule: "Assigned when primary habitat gravity and domain/material diverge, leaving only underlying combustion or sensor-concept relevance without scenario-equivalent parameters.",
  },
  {
    level: "PLANNED",
    rule: "Assigned when the indexed record explicitly carries evidenceLevel = PLANNED and holds no completed experimental results.",
  },
  {
    level: "UNAVAILABLE",
    rule: "Assigned when record evidenceLevel = UNAVAILABLE or zero scenario parameters, domains, gravities, or materials overlap the indexed record.",
  },
];

// Documented deterministic matching tolerances (SI & explicit percentage scales).
const OXYGEN_TOLERANCE_PCT = 2.0; // percentage points on compatible % scales
const PRESSURE_TOLERANCE_PA = 5_000; // 5 kPa in SI Pascals
const AIRFLOW_TOLERANCE_MPS = 0.03; // 3 cm/s in SI m/s

function tokenize(text: string): string[] {
  return text
    .toLocaleLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !["fictional", "surrogate", "blend", "material", "sample"].includes(t));
}

function classifySingleRecord(
  record: MatchableRecord,
  scenario: MissionScenarioInput,
): { matched: MissionMatchResult | null; unavailableReason: string | null } {
  const verified = isRecordVerified(record);
  const isDemo = record.provenanceStatus === "DEMO_FIXTURE";
  const provenanceLabel = formatProvenanceTag(record.provenanceStatus, record.source);

  const parameters: ParameterComparisonDetail[] = [];

  // 1. Gravity regime comparison (strictly separate Microgravity vs Lunar vs Mars vs Partial vs Normal)
  const recordGravityText = record.conditions.gravity || record.gravityEnvironments[0] || "NOT REPORTED";
  const recordGravityClass = classifyGravityRegime(recordGravityText);
  let gravityStatus: ParameterAlignmentStatus = "NOT_SPECIFIED";
  let gravityExplanation = "Scenario did not specify a target gravity constraint.";

  if (scenario.gravityRegime !== "UNSPECIFIED") {
    if (recordGravityClass === "OTHER") {
      gravityStatus = "MISSING_IN_RECORD";
      gravityExplanation = `Record gravity label ("${recordGravityText}") is unmapped or unreported.`;
    } else if (scenario.gravityRegime === recordGravityClass) {
      gravityStatus = "AGREES";
      gravityExplanation = `Exact gravity regime class match (${gravityRegimeLabel(recordGravityClass)}).`;
    } else {
      gravityStatus = "DIFFERS";
      gravityExplanation = `Gravity mismatch: scenario assumes ${gravityRegimeLabel(scenario.gravityRegime)}, while record documents ${recordGravityText}. Microgravity never substitutes directly for Lunar or Mars partial gravity.`;
    }
  }

  // effective-gravity HEURISTIC PROXY (flow-equivalent): reported separately; never changes the actual-gravity status above
  const gi = record.gravityInfo;
  const proxyBinFor: Record<string, string> = { LUNAR_GRAVITY: "lunar_eq", MARS_GRAVITY: "mars_eq", NORMAL_GRAVITY: "earth_eq" };
  const wantBin = proxyBinFor[scenario.gravityRegime];
  if (gi && wantBin && (gi.proxyBins[wantBin] ?? 0) > 0) {
    gravityExplanation += ` Separately, ${gi.proxyBins[wantBin]} of this record's rows have an effective-gravity PROXY near ${gravityRegimeLabel(scenario.gravityRegime as GravityRegimeClass)} (0 g rows with a forced-flow speed mapped to a buoyancy-equivalent g; HEURISTIC, not measured partial gravity; status above is unchanged).`;
  }
  parameters.push({
    key: "gravity",
    label: "Gravity Environment",
    scenarioAssumption:
      scenario.gravityRegime === "UNSPECIFIED" ? "NOT SPECIFIED (USER INPUT)" : `${gravityRegimeLabel(scenario.gravityRegime)} (HYPOTHETICAL)`,
    recordEvidence: recordGravityText,
    status: gravityStatus,
    explanation: gravityExplanation,
  });

  // 2. Safety domain comparison
  let domainStatus: ParameterAlignmentStatus = "NOT_SPECIFIED";
  let domainExplanation = "Scenario includes all safety domains.";
  if (scenario.safetyDomain !== "ALL") {
    if (record.safetyDomains.length === 0) {
      domainStatus = "MISSING_IN_RECORD";
      domainExplanation = "Record safety domain is not classified in index.";
    } else if (record.safetyDomains.includes(scenario.safetyDomain)) {
      domainStatus = "AGREES";
      domainExplanation = `Record targets the requested ${scenario.safetyDomain} domain.`;
    } else {
      domainStatus = "DIFFERS";
      domainExplanation = `Scenario requests ${scenario.safetyDomain}; record targets ${record.safetyDomains.join(", ")}.`;
    }
  }
  parameters.push({
    key: "safety_domain",
    label: "Safety Domain",
    scenarioAssumption: scenario.safetyDomain === "ALL" ? "ALL DOMAINS (USER INPUT)" : `${scenario.safetyDomain} (HYPOTHETICAL)`,
    recordEvidence: record.safetyDomains.join(", ") || "NOT REPORTED",
    status: domainStatus,
    explanation: domainExplanation,
  });

  // 3. Combustion material / sample keyword comparison
  const trimmedMat = scenario.materialQuery.trim();
  let materialStatus: ParameterAlignmentStatus = "NOT_SPECIFIED";
  let materialExplanation = "No material keyword specified in scenario.";
  if (trimmedMat.length > 0) {
    const queryTokens = tokenize(trimmedMat);
    const haystack = `${record.fuelMaterial} ${record.name} ${record.summary ?? ""}`.toLocaleLowerCase();
    const hits = queryTokens.filter((t) => haystack.includes(t));
    if (!record.fuelMaterial.trim()) {
      materialStatus = "MISSING_IN_RECORD";
      materialExplanation = "Combustion material is missing in record.";
    } else if (hits.length > 0 || haystack.includes(trimmedMat.toLocaleLowerCase())) {
      materialStatus = "AGREES";
      materialExplanation = `Matched material term (${hits.join(", ") || trimmedMat}) against "${record.fuelMaterial}".`;
    } else {
      materialStatus = "DIFFERS";
      materialExplanation = `Scenario specifies "${trimmedMat}", whereas record documents "${record.fuelMaterial}".`;
    }
  }
  parameters.push({
    key: "material",
    label: "Combustion Material / Sample",
    scenarioAssumption: trimmedMat ? `${trimmedMat} (HYPOTHETICAL)` : "NOT SPECIFIED (USER INPUT)",
    recordEvidence: record.fuelMaterial || "NOT REPORTED",
    status: materialStatus,
    explanation: materialExplanation,
  });

  // 4. Oxygen concentration (via checkNumericUnitCompatibility)
  const recO2 = extractRecordNumericCondition(record, "oxygen_concentration");
  let o2Status: ParameterAlignmentStatus = "NOT_SPECIFIED";
  let o2Explanation = "Scenario did not specify hypothetical oxygen concentration.";
  if (scenario.oxygenValue !== null) {
    if (!scenario.oxygenUnit) {
      o2Status = "INCOMPATIBLE";
      o2Explanation = "Scenario oxygen value has no explicit unit; OrbitFlame refuses to assume units.";
    } else if (recO2.missing || recO2.valueOriginal === null) {
      o2Status = "MISSING_IN_RECORD";
      o2Explanation = `Record oxygen concentration is ${recO2.displayOriginal}; cannot compare without fabricating missing data.`;
    } else {
      const compat = checkNumericUnitCompatibility(
        { value: scenario.oxygenValue, unit: scenario.oxygenUnit },
        { value: recO2.valueOriginal, unit: recO2.unitOriginal },
      );
      if (!compat.compatible) {
        o2Status = "INCOMPATIBLE";
        o2Explanation = compat.reason;
      } else {
        const diff = Math.abs(compat.comparableValueA - compat.comparableValueB);
        if (diff <= OXYGEN_TOLERANCE_PCT) {
          o2Status = "AGREES";
          o2Explanation = `Compatible units (${compat.sharedUnit}) within ±${OXYGEN_TOLERANCE_PCT} ${compat.sharedUnit} tolerance (Δ = ${diff.toFixed(2)} ${compat.sharedUnit}).`;
        } else {
          o2Status = "DIFFERS";
          o2Explanation = `Scenario (${scenario.oxygenValue} ${scenario.oxygenUnit}) differs from record (${recO2.displayOriginal}) by Δ = ${diff.toFixed(2)} ${compat.sharedUnit}.`;
        }
      }
    }
  }
  parameters.push({
    key: "oxygen",
    label: "Oxygen Concentration",
    scenarioAssumption:
      scenario.oxygenValue !== null
        ? `${scenario.oxygenValue} ${scenario.oxygenUnit || "(NO UNIT)"} (HYPOTHETICAL)`
        : "NOT SPECIFIED (USER INPUT)",
    recordEvidence: recO2.displayOriginal,
    status: o2Status,
    explanation: o2Explanation,
  });

  // 5. Pressure (via checkNumericUnitCompatibility -> SI Pa)
  const recPressure = extractRecordNumericCondition(record, "pressure");
  let pStatus: ParameterAlignmentStatus = "NOT_SPECIFIED";
  let pExplanation = "Scenario did not specify hypothetical ambient pressure.";
  if (scenario.pressureValue !== null) {
    if (!scenario.pressureUnit) {
      pStatus = "INCOMPATIBLE";
      pExplanation = "Scenario pressure value lacks an explicit unit; cannot convert to SI Pascals safely.";
    } else if (recPressure.missing || recPressure.valueOriginal === null) {
      pStatus = "MISSING_IN_RECORD";
      pExplanation = `Record pressure is ${recPressure.displayOriginal}; missing value is never coerced to zero.`;
    } else {
      const compat = checkNumericUnitCompatibility(
        { value: scenario.pressureValue, unit: scenario.pressureUnit },
        { value: recPressure.valueOriginal, unit: recPressure.unitOriginal },
      );
      if (!compat.compatible) {
        pStatus = "INCOMPATIBLE";
        pExplanation = compat.reason;
      } else {
        const diffPa = Math.abs(compat.comparableValueA - compat.comparableValueB);
        if (diffPa <= PRESSURE_TOLERANCE_PA) {
          pStatus = "AGREES";
          pExplanation = `Normalized pressure agrees within ±5 kPa tolerance (Δ = ${(diffPa / 1000).toFixed(2)} kPa).`;
        } else {
          pStatus = "DIFFERS";
          pExplanation = `Scenario (${scenario.pressureValue} ${scenario.pressureUnit}) differs from record (${recPressure.displayOriginal}) by ${(diffPa / 1000).toFixed(2)} kPa (${diffPa.toFixed(0)} Pa).`;
        }
      }
    }
  }
  parameters.push({
    key: "pressure",
    label: "Ambient Pressure",
    scenarioAssumption:
      scenario.pressureValue !== null
        ? `${scenario.pressureValue} ${scenario.pressureUnit || "(NO UNIT)"} (HYPOTHETICAL)`
        : "NOT SPECIFIED (USER INPUT)",
    recordEvidence: recPressure.displayOriginal,
    status: pStatus,
    explanation: pExplanation,
  });

  // 6. Airflow (via checkNumericUnitCompatibility -> SI m/s)
  const recAir = extractRecordNumericCondition(record, "airflow");
  let airStatus: ParameterAlignmentStatus = "NOT_SPECIFIED";
  let airExplanation = "Scenario did not specify hypothetical forced airflow velocity.";
  if (scenario.airflowValue !== null) {
    if (!scenario.airflowUnit) {
      airStatus = "INCOMPATIBLE";
      airExplanation = "Scenario airflow lacks an explicit velocity unit; cannot normalize safely.";
    } else if (recAir.missing || recAir.valueOriginal === null) {
      airStatus = "MISSING_IN_RECORD";
      airExplanation = `Record airflow is ${recAir.displayOriginal}; quiescent vs forced-flow cannot be assumed from missing metadata.`;
    } else {
      const compat = checkNumericUnitCompatibility(
        { value: scenario.airflowValue, unit: scenario.airflowUnit },
        { value: recAir.valueOriginal, unit: recAir.unitOriginal },
      );
      if (!compat.compatible) {
        airStatus = "INCOMPATIBLE";
        airExplanation = compat.reason;
      } else {
        const diffMps = Math.abs(compat.comparableValueA - compat.comparableValueB);
        if (diffMps <= AIRFLOW_TOLERANCE_MPS) {
          airStatus = "AGREES";
          airExplanation = `Normalized airflow agrees within ±0.03 m/s tolerance (Δ = ${diffMps.toFixed(3)} m/s).`;
        } else {
          airStatus = "DIFFERS";
          airExplanation = `Scenario (${scenario.airflowValue} ${scenario.airflowUnit}) differs from record (${recAir.displayOriginal}) by ${diffMps.toFixed(3)} m/s.`;
        }
      }
    }
  }
  parameters.push({
    key: "airflow",
    label: "Forced Airflow Velocity",
    scenarioAssumption:
      scenario.airflowValue !== null
        ? `${scenario.airflowValue} ${scenario.airflowUnit || "(NO UNIT)"} (HYPOTHETICAL)`
        : "NOT SPECIFIED (USER INPUT)",
    recordEvidence: recAir.displayOriginal,
    status: airStatus,
    explanation: airExplanation,
  });

  // 7. Experimental measurements availability check
  const totalMeasurements =
    "presentMeasurementCount" in record
      ? record.presentMeasurementCount
      : record.testRuns.reduce((sum, run) => sum + run.measurements.filter((m) => m.missingStatus === "PRESENT").length, 0);
  const hasMeasurements = totalMeasurements > 0;
  parameters.push({
    key: "measurements",
    label: "Recorded Outcome Measurements",
    scenarioAssumption: "Empirical combustion outcome telemetry",
    recordEvidence: hasMeasurements ? `${totalMeasurements} measurement row(s)` : "0 RECORDED MEASUREMENTS (EMPTY)",
    status: hasMeasurements ? "AGREES" : "MISSING_IN_RECORD",
    explanation: hasMeasurements
      ? `${totalMeasurements} scalar/series measurement(s) documented in attached test runs.`
      : "Test run holds condition metadata only; burn rate, heat release, soot yield, and extinction time are NOT PRESENT.",
  });

  // Compute deterministic statistics
  const conditionParams = parameters.filter((p) => p.key !== "measurements");
  const specified = conditionParams.filter((p) => p.status !== "NOT_SPECIFIED");
  const agreedParams = conditionParams.filter((p) => p.status === "AGREES");
  const differingParams = parameters.filter((p) => p.status === "DIFFERS");
  const missingParams = parameters.filter((p) => p.status === "MISSING_IN_RECORD");
  const incompatibleParams = parameters.filter((p) => p.status === "INCOMPATIBLE");

  const conditionCoveragePercent =
    specified.length === 0
      ? Math.round((conditionParams.filter((p) => p.status !== "MISSING_IN_RECORD").length / conditionParams.length) * 100)
      : Math.round(((agreedParams.length + differingParams.length) / specified.length) * 100);

  // Deterministic Evidence Classification (NEVER assigned by LLM)
  let classification: EvidenceClassification;
  let classificationRuleTrace: string;

  const partialSurfaceAnalogBridge =
    agreedParams.length === 0 &&
    recordGravityClass === "PARTIAL_GRAVITY" &&
    (scenario.gravityRegime === "LUNAR_GRAVITY" || scenario.gravityRegime === "MARS_GRAVITY");

  if (record.evidenceLevel === "PLANNED") {
    classification = "PLANNED";
    classificationRuleTrace = "Record evidenceLevel = PLANNED; no completed experimental results are available in the index.";
  } else if (record.evidenceLevel === "UNAVAILABLE") {
    classification = "UNAVAILABLE";
    classificationRuleTrace = "Record evidenceLevel = UNAVAILABLE in indexed metadata.";
  } else if (partialSurfaceAnalogBridge && domainStatus !== "DIFFERS") {
    classification = "MECHANISM_ONLY";
    classificationRuleTrace =
      "Unspecified partial-gravity record surfaced solely for partial-g context; target Lunar/Mars gravity acceleration is NOT directly represented.";
  } else if (specified.length > 0 && agreedParams.length === 0) {
    return {
      matched: null,
      unavailableReason: `No scenario inputs agreed with ${record.id} (${agreedParams.length}/${specified.length} aligned; ${differingParams.length} differing, ${missingParams.length} missing).`,
    };
  } else if (
    verified &&
    record.evidenceLevel === "DIRECT" &&
    (scenario.gravityRegime === "UNSPECIFIED" || gravityStatus === "AGREES") &&
    differingParams.length === 0 &&
    incompatibleParams.length === 0 &&
    missingParams.filter((m) => specified.some((s) => s.key === m.key)).length === 0 &&
    hasMeasurements
  ) {
    classification = "DIRECT";
    classificationRuleTrace =
      "All specified physical conditions, gravity regime, safety domain, verified NASA provenance, and run measurements align cleanly.";
  } else if (
    record.evidenceLevel === "MECHANISM_ONLY" ||
    (agreedParams.length >= 1 &&
      gravityStatus === "DIFFERS" &&
      (domainStatus === "DIFFERS" || (scenario.safetyDomain === "ALL" && agreedParams.every((p) => p.key !== "material"))))
  ) {
    classification = "MECHANISM_ONLY";
    classificationRuleTrace =
      "Differs in primary gravity regime (and/or target safety domain); only isolated physical condition mechanism parameter(s) align.";
  } else if (agreedParams.length > 0 || specified.length === 0) {
    classification = "ANALOGOUS";
    const blockReasons: string[] = [];
    if (!verified) blockReasons.push(`provenance is ${provenanceLabel}`);
    if (record.evidenceLevel !== "DIRECT") blockReasons.push(`record evidenceLevel is ${record.evidenceLevel}`);
    if (gravityStatus === "DIFFERS") blockReasons.push(`gravity regime differs (${gravityRegimeLabel(scenario.gravityRegime as GravityRegimeClass)} vs ${recordGravityText})`);
    if (differingParams.length > 0) blockReasons.push(`${differingParams.length} condition(s) differ`);
    if (!hasMeasurements) blockReasons.push("0 recorded run measurements");
    classificationRuleTrace = `Classified ANALOGOUS (${blockReasons.join("; ")}); cannot be promoted to DIRECT.`;
  } else {
    return {
      matched: null,
      unavailableReason: `Insufficient alignment (${record.id}).`,
    };
  }

  // Construct transparent explanation of why matched & where evidence stops
  const whyMatched =
    agreedParams.length > 0
      ? `Matched via ${agreedParams.map((p) => p.label.toLocaleLowerCase()).join(", ")} (${record.family ?? "indexed study"} · ${record.id}).`
      : `Surfaced for inspection from indexed ${record.family ?? "research"} catalog under unconstrained scenario scope.`;

  const cannotEstablish: string[] = [];
  if (isDemo) {
    cannotEstablish.push(`Record is ${DEMO_WARNING} — illustrates matching logic only and establishes zero real physical facts.`);
  }
  if (!verified) {
    cannotEstablish.push("Lacks verified primary NASA source document locator; cannot support engineering design decisions.");
  }
  if (gravityStatus === "DIFFERS") {
    cannotEstablish.push(
      `Does NOT validate flame spread, buoyant plume behavior, or ignition thresholds in ${gravityRegimeLabel(
        scenario.gravityRegime as GravityRegimeClass,
      )}.`,
    );
  }
  if (!hasMeasurements) {
    cannotEstablish.push("Holds zero measured combustion outcomes (no temperature, heat release, soot yield, or extinction time).");
  }
  if (incompatibleParams.length > 0) {
    cannotEstablish.push("Contains unit-incompatible parameter(s) that cannot be equated or thresholded.");
  }
  cannotEstablish.push("Does not predict fire probability, spacecraft habitability certification, or material pass/fail margins.");

  return {
    matched: {
      recordId: record.id,
      recordName: record.name,
      family: record.family,
      classification,
      classificationRuleTrace,
      provenanceLabel,
      isDemoFixture: isDemo,
      isVerified: verified,
      alignmentSummary: {
        agreeCount: agreedParams.length,
        differCount: differingParams.length,
        missingCount: missingParams.length,
        incompatibleCount: incompatibleParams.length,
        specifiedScenarioCount: specified.length,
        conditionCoveragePercent,
      },
      whyMatched,
      parameters,
      agreedParameters: agreedParams.map((p) => `${p.label}: ${p.recordEvidence}`),
      differingParameters: differingParams.map((p) => `${p.label}: scenario ${p.scenarioAssumption.replace(" (HYPOTHETICAL)", "")} vs ${p.recordEvidence}`),
      missingParameters: missingParams.map((p) => `${p.label}: ${p.recordEvidence}`),
      incompatibleComparisons: incompatibleParams.map((p) => `${p.label}: ${p.explanation}`),
      cannotEstablish,
    },
    unavailableReason: null,
  };
}

const CLASSIFICATION_RANK: Record<EvidenceClassification, number> = {
  DIRECT: 5,
  ANALOGOUS: 4,
  MECHANISM_ONLY: 3,
  PLANNED: 2,
  UNAVAILABLE: 1,
};

export function matchMissionScenario(
  records: MatchableRecord[],
  scenario: MissionScenarioInput,
): MissionMatchReport {
  const habitat = MISSION_HABITATS.find((h) => h.id === scenario.habitat) ?? MISSION_HABITATS[0];
  const datasetScope = deriveDatasetScope(records);

  const matchedResults: MissionMatchResult[] = [];
  const unavailableRecords: { id: string; name: string; reason: string }[] = [];

  for (const rec of records) {
    const { matched, unavailableReason } = classifySingleRecord(rec, scenario);
    if (matched) {
      matchedResults.push(matched);
    } else {
      unavailableRecords.push({
        id: rec.id,
        name: rec.name,
        reason: unavailableReason ?? "No scenario alignment.",
      });
    }
  }

  matchedResults.sort((a, b) => {
    const classDiff = CLASSIFICATION_RANK[b.classification] - CLASSIFICATION_RANK[a.classification];
    if (classDiff !== 0) return classDiff;
    if (b.alignmentSummary.agreeCount !== a.alignmentSummary.agreeCount) {
      return b.alignmentSummary.agreeCount - a.alignmentSummary.agreeCount;
    }
    if (a.alignmentSummary.differCount !== b.alignmentSummary.differCount) {
      return a.alignmentSummary.differCount - b.alignmentSummary.differCount;
    }
    return a.recordId.localeCompare(b.recordId);
  });

  const overallHighestEvidence: EvidenceClassification =
    matchedResults.length > 0 ? matchedResults[0].classification : "UNAVAILABLE";

  return {
    disclaimer: MISSION_LAB_DISCLAIMER,
    scenario,
    habitat,
    datasetScope,
    overallHighestEvidence,
    ruleDefinitions: CLASSIFICATION_RULES,
    matchedResults,
    unavailableRecords,
  };
}
