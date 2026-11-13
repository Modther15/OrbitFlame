import type { Condition, DemoInvestigation, Measurement, ProvenanceStatus, SourceLocator } from "@/lib/api/schemas";
import type { AssistantTurnInput, EvidenceRecordItem } from "@/lib/assistant/assistant-response-schema";
import { investigationRepository, type InvestigationRepository } from "@/lib/data/repository";
import { DEMO_WARNING } from "@/lib/demo/dataset";

export type RequestedParameterKey =
  | "oxygen_concentration"
  | "pressure"
  | "airflow"
  | "gravity"
  | "fuel_material"
  | "objective"
  | "findings"
  | "measurements"
  | "sensors"
  | "hardware"
  | "missing_metadata";

export type QueryIntent = {
  explicitRecordIds: string[];
  followUpRecordIds: string[];
  explicitFamilies: string[];
  followUpFamilies: string[];
  requestedDomains: ("PREVENTION" | "DETECTION" | "SUPPRESSION")[];
  requestedGravities: ("Microgravity" | "Partial" | "Normal")[];
  requestedParameters: RequestedParameterKey[];
  asksVerifiedNasaOnly: boolean;
  asksCausalOrSafety: boolean;
  asksMissingAudit: boolean;
  asksCatalogSummary: boolean;
  isFollowUp: boolean;
};

export type RetrievalResult = {
  intent: QueryIntent;
  mode: "DEMO_FIXTURE_ONLY" | "VERIFIED_INDEXED_DATA" | "EMPTY";
  records: DemoInvestigation[];
  evidenceItems: EvidenceRecordItem[];
  provenanceSummary: {
    allDemoFixtures: boolean;
    hasVerifiedRecords: boolean;
    verifiedRecordIds: string[];
    demoRecordIds: string[];
  };
};

const KNOWN_FAMILIES = ["BASS", "SAFFIRE", "SAME", "FLEX", "ACME"] as const;

const OUT_OF_SCOPE_PATTERNS =
  /\b(apollo\s*13|skylab|mir\b|challenger|columbia|candle\s+flames?|lithium[\s-]ion|battery\s+thermal\s+runaway|mars\s+regolith|lunar\s+dust|propellant\s+tank|rocket\s+engine|jet\s+fuel|diesel|gasoline|forest\s+fire|wildfire)\b/i;

const GENERIC_TOKENS = new Set([
  "what",
  "which",
  "where",
  "when",
  "compare",
  "between",
  "across",
  "investigations",
  "investigation",
  "study",
  "studies",
  "experiment",
  "experiments",
  "microgravity",
  "partial",
  "normal",
  "gravity",
  "combustion",
  "flame",
  "flames",
  "research",
  "nasa",
  "verified",
  "data",
  "record",
  "records",
  "oxygen",
  "pressure",
  "airflow",
  "condition",
  "conditions",
  "missing",
  "available",
  "reported",
  "show",
  "tell",
  "list",
  "summarize",
  "summary",
  "does",
  "have",
  "with",
  "from",
  "that",
  "this",
  "those",
  "these",
  "their",
  "about",
  "values",
  "value",
]);

function isEffectiveVerified(provenanceStatus: ProvenanceStatus, source: SourceLocator | null): boolean {
  return provenanceStatus === "NASA_VERIFIED_DATA" && source?.verificationStatus === "VERIFIED";
}

function getProvenanceLabel(provenanceStatus: ProvenanceStatus, verified: boolean): string {
  if (verified) return "VERIFIED";
  if (provenanceStatus === "DEMO_FIXTURE") return DEMO_WARNING;
  if (provenanceStatus === "NOT_REPORTED") return "NOT REPORTED";
  return "UNVERIFIED";
}

function extractRecordIds(text: string): string[] {
  const matches = text.match(/\b[A-Z]{1,4}-\d{1,4}\b/gi) ?? [];
  return Array.from(new Set(matches.map((m) => m.toUpperCase())));
}

function extractFamilies(text: string): string[] {
  const upper = text.toUpperCase();
  return KNOWN_FAMILIES.filter((fam) => new RegExp(`\\b${fam}\\b`).test(upper));
}

export function analyzeQuestionIntent(
  question: string,
  history: AssistantTurnInput[] = [],
): QueryIntent {
  const q = question.trim();
  const explicitRecordIds = extractRecordIds(q);
  const explicitFamilies = extractFamilies(q);

  const isFollowUp =
    explicitRecordIds.length === 0 &&
    (/\b(its|their|that|those|these|same|what about|how about|and the|also check|them)\b/i.test(q) ||
      q.split(/\s+/).length <= 7);

  // Follow-up recovery inspects ONLY previous USER turns (never treats prior assistant output as evidence).
  const userTurns = history.filter((t) => t.role === "user");
  let followUpRecordIds: string[] = [];
  let followUpFamilies: string[] = [];
  if (isFollowUp && userTurns.length > 0) {
    for (let i = userTurns.length - 1; i >= 0; i--) {
      const ids = extractRecordIds(userTurns[i].content);
      const fams = extractFamilies(userTurns[i].content);
      if (ids.length > 0 || fams.length > 0) {
        followUpRecordIds = ids;
        followUpFamilies = fams;
        break;
      }
    }
  }

  const requestedDomains: ("PREVENTION" | "DETECTION" | "SUPPRESSION")[] = [];
  if (/\bprevention\b/i.test(q)) requestedDomains.push("PREVENTION");
  if (/\bdetection\b/i.test(q)) requestedDomains.push("DETECTION");
  if (/\bsuppression\b/i.test(q)) requestedDomains.push("SUPPRESSION");

  const requestedGravities: ("Microgravity" | "Partial" | "Normal")[] = [];
  if (/\bmicrogravity\b/i.test(q)) requestedGravities.push("Microgravity");
  if (/\bpartial\s+gravity\b/i.test(q)) requestedGravities.push("Partial");
  if (/\bnormal\s+gravity\b/i.test(q)) requestedGravities.push("Normal");

  const requestedParameters: RequestedParameterKey[] = [];
  if (/\b(oxygen|o2|o₂)\b/i.test(q)) requestedParameters.push("oxygen_concentration");
  if (/\b(pressure|kpa|pa\b|atm|psi)\b/i.test(q)) requestedParameters.push("pressure");
  if (/\b(airflow|flow|velocity|m\/s|cm\/s)\b/i.test(q)) requestedParameters.push("airflow");
  if (/\b(gravity|microgravity|partial gravity|normal gravity)\b/i.test(q)) requestedParameters.push("gravity");
  if (/\b(material|fuel|polymer|cellulose|surrogate|sample)\b/i.test(q)) requestedParameters.push("fuel_material");
  if (/\b(objective|goal|purpose)\b/i.test(q)) requestedParameters.push("objective");
  if (/\b(finding|result|observation)\b/i.test(q)) requestedParameters.push("findings");
  if (/\b(peak temperature|heat release|flame spread|soot|extinction time|burn rate|co2|co emission|measurements?|recorded readings?|telemetry)\b/i.test(q)) {
    requestedParameters.push("measurements");
  }
  if (/\b(sensors?|thermocouples?|radiometers?|cameras?|detector model)\b/i.test(q)) {
    requestedParameters.push("sensors");
  }
  if (/\b(hardware|apparatus|chamber|cir\b|rig\b|hardware model)\b/i.test(q)) {
    requestedParameters.push("hardware");
  }
  if (/\b(missing|not reported|incomplete|completeness|gaps?|unavailable)\b/i.test(q)) {
    requestedParameters.push("missing_metadata");
  }

  const asksMissingAudit =
    requestedParameters.includes("missing_metadata") &&
    /\b(which|list|show|identify|find|audit|have missing|are missing|missing fields)\b/i.test(q);

  const asksVerifiedNasaOnly =
    /\b(verified\s+nasa|real\s+nasa|actual\s+nasa|official\s+nasa|flight\s+verified|nasa\s+verified\s+measurements?)\b/i.test(
      q,
    );

  const asksCausalOrSafety =
    /\b(why\s+does|why\s+did|why\s+is|cause|causes|caused|prove|proves|proved|safe|safety|unsafe|fire\s+risk|suppression\s+effectiveness|extinguish(?:es|ed)?\s+(?:fires?|effectively)|certify|spacecraft\s+safety|flammability|which\s+is\s+safer|how\s+fast\s+does\s+fire\s+spread)\b/i.test(
      q,
    );

  const asksCatalogSummary =
    /\b(compare|across|which\s+investigations?|list\s+all|all\s+investigations?|lowest|highest|summary|overview)\b/i.test(q) &&
    explicitRecordIds.length === 0 &&
    followUpRecordIds.length === 0;

  return {
    explicitRecordIds,
    followUpRecordIds,
    explicitFamilies,
    followUpFamilies,
    requestedDomains,
    requestedGravities,
    requestedParameters,
    asksVerifiedNasaOnly,
    asksCausalOrSafety,
    asksMissingAudit,
    asksCatalogSummary,
    isFollowUp,
  };
}

function buildConditionEvidenceItem(
  rec: DemoInvestigation,
  runId: string,
  condition: Condition,
): EvidenceRecordItem {
  const labelMap: Record<string, string> = {
    oxygen_concentration: "Oxygen concentration",
    pressure: "Pressure",
    airflow: "Airflow",
    gravity: "Gravity environment",
  };
  const verified = isEffectiveVerified(rec.provenanceStatus, condition.source ?? rec.source);
  const provLabel = getProvenanceLabel(rec.provenanceStatus, verified);
  const valueDisplay =
    condition.missingStatus !== "PRESENT"
      ? "NOT REPORTED"
      : condition.valueOriginal !== null
        ? condition.unitOriginal
          ? `${condition.valueOriginal} ${condition.unitOriginal}`
          : `${condition.valueOriginal}`
        : condition.textOriginal ?? "NOT REPORTED";

  return {
    evidenceId: `EV-${rec.id}-${runId}-${condition.parameterKey.toUpperCase()}`,
    investigationId: rec.id,
    investigationTitle: rec.name,
    family: rec.family,
    testRunId: runId,
    fieldKey: condition.parameterKey,
    fieldLabel: labelMap[condition.parameterKey] ?? condition.parameterKey,
    valueDisplay,
    numericValue: condition.missingStatus === "PRESENT" ? condition.valueOriginal : null,
    unitOriginal: condition.missingStatus === "PRESENT" ? condition.unitOriginal : null,
    valueSi: condition.missingStatus === "PRESENT" ? condition.valueSi : null,
    unitSi: condition.missingStatus === "PRESENT" ? condition.unitSi : null,
    missingStatus: condition.missingStatus,
    provenanceStatus: rec.provenanceStatus,
    provenanceLabel: provLabel,
    isDemoFixture: rec.provenanceStatus === "DEMO_FIXTURE",
    isVerified: verified,
    sourceLocator: condition.source ?? rec.source,
  };
}

function buildMeasurementEvidenceItem(
  rec: DemoInvestigation,
  runId: string,
  measurement: Measurement,
): EvidenceRecordItem {
  const verified = isEffectiveVerified(rec.provenanceStatus, measurement.source ?? rec.source);
  const provLabel = getProvenanceLabel(rec.provenanceStatus, verified);
  const valueDisplay =
    measurement.missingStatus !== "PRESENT"
      ? "NOT REPORTED"
      : measurement.valueOriginal !== null
        ? measurement.unitOriginal
          ? `${measurement.valueOriginal} ${measurement.unitOriginal}`
          : `${measurement.valueOriginal}`
        : measurement.textOriginal ?? "NOT REPORTED";

  return {
    evidenceId: `EV-${rec.id}-${runId}-MEAS-${measurement.id}`,
    investigationId: rec.id,
    investigationTitle: rec.name,
    family: rec.family,
    testRunId: runId,
    fieldKey: `measurement:${measurement.metricKey}`,
    fieldLabel: `Measurement: ${measurement.label}`,
    valueDisplay,
    numericValue: measurement.missingStatus === "PRESENT" ? measurement.valueOriginal : null,
    unitOriginal: measurement.missingStatus === "PRESENT" ? measurement.unitOriginal : null,
    valueSi: measurement.missingStatus === "PRESENT" ? measurement.valueSi : null,
    unitSi: measurement.missingStatus === "PRESENT" ? measurement.unitSi : null,
    missingStatus: measurement.missingStatus,
    provenanceStatus: rec.provenanceStatus,
    provenanceLabel: provLabel,
    isDemoFixture: rec.provenanceStatus === "DEMO_FIXTURE",
    isVerified: verified,
    sourceLocator: measurement.source ?? rec.source,
  };
}

function extractEvidenceItemsForRecord(rec: DemoInvestigation, intent: QueryIntent): EvidenceRecordItem[] {
  const items: EvidenceRecordItem[] = [];
  const verified = isEffectiveVerified(rec.provenanceStatus, rec.source);
  const provLabel = getProvenanceLabel(rec.provenanceStatus, verified);

  items.push({
    evidenceId: `EV-${rec.id}-OVERVIEW`,
    investigationId: rec.id,
    investigationTitle: rec.name,
    family: rec.family,
    testRunId: rec.testRuns[0]?.id ?? null,
    fieldKey: "overview",
    fieldLabel: "Investigation Overview, Fuel Sample & Domain",
    valueDisplay: `${rec.name} | Family: ${rec.family ?? "NOT REPORTED"} | Domains: ${rec.safetyDomains.join(", ")} | Material/Sample: ${rec.fuelMaterial} | Gravity: ${rec.conditions.gravity} | Objective: ${rec.objective ?? "NOT REPORTED"}`,
    numericValue: null,
    unitOriginal: null,
    valueSi: null,
    unitSi: null,
    missingStatus: "PRESENT",
    provenanceStatus: rec.provenanceStatus,
    provenanceLabel: provLabel,
    isDemoFixture: rec.provenanceStatus === "DEMO_FIXTURE",
    isVerified: verified,
    sourceLocator: rec.source,
  });

  const wantsAllConditions =
    intent.requestedParameters.length === 0 ||
    intent.requestedParameters.includes("findings") ||
    intent.requestedParameters.includes("missing_metadata");

  // Real PSI tables can hold hundreds of rows per investigation: send whole-table aggregates plus a bounded sample of rows.
  const MAX_EVIDENCE_RUNS = 6;
  const present = (run: (typeof rec.testRuns)[number]) => run.conditions.filter((c) => c.missingStatus === "PRESENT").length + run.measurements.length;
  const sampleRuns = rec.testRuns.length > MAX_EVIDENCE_RUNS ? [...rec.testRuns].sort((x, y) => present(y) - present(x)).slice(0, MAX_EVIDENCE_RUNS) : rec.testRuns;
  if (rec.testRuns.length > 0) {
    const rng = (key: string, unit: string) => {
      const v = rec.testRuns.flatMap((r) => r.conditions.filter((c) => c.parameterKey === key && c.missingStatus === "PRESENT" && c.valueOriginal !== null).map((c) => c.valueOriginal as number));
      const r2 = (x: number) => Math.round(x * 100) / 100;
      return v.length ? `${key}: ${r2(Math.min(...v))}–${r2(Math.max(...v))} ${unit} (stated in ${v.length}/${rec.testRuns.length} rows)` : `${key}: not stated in any of ${rec.testRuns.length} rows`;
    };
    items.push({
      evidenceId: `EV-${rec.id}-AGGREGATE`,
      investigationId: rec.id,
      investigationTitle: rec.name,
      family: rec.family,
      testRunId: null,
      fieldKey: "dataset_aggregate",
      fieldLabel: "Whole-table aggregate (all rows in the PSI database)",
      valueDisplay: `${rec.testRuns.length} rows from ${rec.source?.sourceTitle ?? "NASA PSI"} | ${rng("oxygen_concentration", "%")} | ${rng("pressure", "kPa")} | ${rng("airflow", "cm/s")} | gravity: not stated in tables`,
      numericValue: rec.testRuns.length,
      unitOriginal: "rows",
      valueSi: null,
      unitSi: null,
      missingStatus: "PRESENT",
      provenanceStatus: rec.provenanceStatus,
      provenanceLabel: provLabel,
      isDemoFixture: rec.provenanceStatus === "DEMO_FIXTURE",
      isVerified: verified,
      sourceLocator: rec.source,
    });
  }

  for (const run of sampleRuns) {
    for (const cond of run.conditions) {
      const include =
        wantsAllConditions ||
        intent.requestedParameters.includes(cond.parameterKey as RequestedParameterKey) ||
        (intent.requestedGravities.length > 0 && cond.parameterKey === "gravity");
      if (include) {
        items.push(buildConditionEvidenceItem(rec, run.id, cond));
      }
    }

    if (run.measurements.length > 0 && (wantsAllConditions || intent.requestedParameters.includes("measurements"))) {
      for (const meas of run.measurements) {
        items.push(buildMeasurementEvidenceItem(rec, run.id, meas));
      }
    }
  }

  items.push({
    evidenceId: `EV-${rec.id}-COMPLETENESS`,
    investigationId: rec.id,
    investigationTitle: rec.name,
    family: rec.family,
    testRunId: rec.testRuns[0]?.id ?? null,
    fieldKey: "completeness_and_limitations",
    fieldLabel: "Data Completeness & Missing Fields",
    valueDisplay: `Completeness: ${rec.dataCompleteness}% | Missing fields: ${
      rec.conditions.missingFields.length > 0 ? rec.conditions.missingFields.join(", ") : "None among indexed condition slots"
    } | Recorded measurements: ${rec.testRuns.reduce((sum, r) => sum + r.measurements.length, 0)}`,
    numericValue: rec.dataCompleteness,
    unitOriginal: "%",
    valueSi: null,
    unitSi: null,
    missingStatus: "PRESENT",
    provenanceStatus: rec.provenanceStatus,
    provenanceLabel: provLabel,
    isDemoFixture: rec.provenanceStatus === "DEMO_FIXTURE",
    isVerified: verified,
    sourceLocator: rec.source,
  });

  return items;
}

export async function retrieveEvidenceForQuestion(
  question: string,
  options?: {
    history?: AssistantTurnInput[];
    pinnedIds?: string[];
    repository?: InvestigationRepository;
    recordsOverride?: DemoInvestigation[];
  },
): Promise<RetrievalResult> {
  const history = options?.history ?? [];
  const intent = analyzeQuestionIntent(question, history);

  const allRecords = options?.recordsOverride ?? (await (options?.repository ?? investigationRepository).list());

  if (allRecords.length === 0) {
    return {
      intent,
      mode: "EMPTY",
      records: [],
      evidenceItems: [],
      provenanceSummary: {
        allDemoFixtures: false,
        hasVerifiedRecords: false,
        verifiedRecordIds: [],
        demoRecordIds: [],
      },
    };
  }

  const verifiedRecordIds = allRecords.filter((r) => isEffectiveVerified(r.provenanceStatus, r.source)).map((r) => r.id);
  const demoRecordIds = allRecords.filter((r) => r.provenanceStatus === "DEMO_FIXTURE").map((r) => r.id);
  const mode: RetrievalResult["mode"] = verifiedRecordIds.length > 0 ? "VERIFIED_INDEXED_DATA" : "DEMO_FIXTURE_ONLY";

  // Hard block on known out-of-scope real missions/scenarios when no indexed ID/family was requested.
  const targetIds = intent.explicitRecordIds.length > 0 ? intent.explicitRecordIds : intent.followUpRecordIds;
  const targetFamilies = intent.explicitFamilies.length > 0 ? intent.explicitFamilies : intent.followUpFamilies;
  const pinnedIds = (options?.pinnedIds ?? []).map((id) => id.toUpperCase());
  const effectiveIds = targetIds.length > 0 ? targetIds : pinnedIds;

  if (OUT_OF_SCOPE_PATTERNS.test(question) && effectiveIds.length === 0 && targetFamilies.length === 0) {
    return {
      intent,
      mode,
      records: [],
      evidenceItems: [],
      provenanceSummary: {
        allDemoFixtures: demoRecordIds.length === allRecords.length,
        hasVerifiedRecords: verifiedRecordIds.length > 0,
        verifiedRecordIds,
        demoRecordIds,
      },
    };
  }

  let matched: DemoInvestigation[] = [];

  if (effectiveIds.length > 0) {
    matched = allRecords
      .filter((r) => effectiveIds.includes(r.id.toUpperCase()))
      .sort((a, b) => a.id.localeCompare(b.id));
  } else if (targetFamilies.length > 0) {
    matched = allRecords
      .filter((r) => r.family && targetFamilies.includes(r.family.toUpperCase()))
      .sort((a, b) => a.id.localeCompare(b.id));
    if (intent.requestedGravities.length > 0) {
      matched = matched.filter((r) =>
        intent.requestedGravities.some((g) => r.conditions.gravity.toLowerCase().includes(g.toLowerCase())),
      );
    }
  } else {
    // Score records using specific tokens, domains, gravity filters, or catalog comparison cues.
    const tokens = question
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length >= 3 && !GENERIC_TOKENS.has(t));

    const scored = allRecords
      .map((rec) => {
        let score = 0;
        const text = `${rec.id} ${rec.name} ${rec.family ?? ""} ${rec.fuelMaterial} ${rec.objective ?? ""}`.toLowerCase();

        for (const tok of tokens) {
          if (text.includes(tok)) score += 3;
        }
        if (intent.requestedDomains.some((d) => rec.safetyDomains.includes(d))) score += 4;
        if (
          intent.requestedGravities.some((g) => rec.conditions.gravity.toLowerCase().includes(g.toLowerCase()))
        ) {
          score += 3;
        }
        if (intent.asksMissingAudit && rec.conditions.missingFields.length > 0) score += 3;
        if (
          intent.asksCatalogSummary &&
          (intent.requestedParameters.length > 0 || intent.requestedDomains.length > 0 || intent.requestedGravities.length > 0)
        ) {
          score += 1;
        }
        return { rec, score };
      })
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score || a.rec.id.localeCompare(b.rec.id));

    matched = scored.slice(0, intent.asksCatalogSummary ? 12 : 6).map((s) => s.rec);
  }

  const evidenceItems = matched.flatMap((rec) => extractEvidenceItemsForRecord(rec, intent));

  return {
    intent,
    mode,
    records: matched,
    evidenceItems,
    provenanceSummary: {
      allDemoFixtures: matched.length > 0 && matched.every((r) => r.provenanceStatus === "DEMO_FIXTURE"),
      hasVerifiedRecords: verifiedRecordIds.length > 0,
      verifiedRecordIds,
      demoRecordIds,
    },
  };
}
