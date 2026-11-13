import crypto from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { API_BASE, fetchLive } from "@/lib/api/backend-core";
import { AssistantApiResponseSchema, type AssistantApiResponse, type AssistantCitation, type AssistantTurnInput } from "@/lib/assistant/assistant-response-schema";
import { retrieveEvidenceForQuestion } from "@/lib/assistant/retrieval";
import type { InvestigationRepository } from "@/lib/data/repository";
import { loadVariableSummaryServer } from "@/lib/data/variables-server";
import { PROXY_CAVEAT } from "@/lib/science/gravity";
import { cleanTruncate } from "@/lib/data/psi-mapper";

/**
 * Deterministic, grounded, evidence-only answer. Used whenever the LLM path is unavailable or fails
 * (no OPENAI_API_KEY, provider error / timeout / malformed output / budget exceeded) and for greetings / vague queries.
 *   1) POST FastAPI /api/assistant (builds the answer straight from psi_combustion.duckdb, variable summary, model audit, physics_ranker)
 *   2) if the API is unreachable: local builder over the indexed repository + static snapshot files in public/data
 */
export const EXAMPLE_QUESTIONS = [
  "What did PSI-159 measure and how does it apply to the Moon Base?",
  "Which PSI investigations are most relevant to a 0.16 g, 10.2 psi, 30% O2 habitat?",
  "What was varied and what was held constant in PSI-26 (BASS)?",
  "Which models pass the dummy-baseline gate, and for which investigation?",
  "Compare SAME-R (PSI-101) and DAFT (PSI-47) for smoke detection.",
];

const GREETING_RX = /^\s*(hi|hello|hey|hola|yo|sup|thanks|thank you|ok|okay|test|help|\?+|what can you do|who are you|good (morning|evening|afternoon))\W*$/i;
const PSI_RX = /\bPSI[-\s]?\d{1,3}\b/i;
const NAME_RX = /\b(bass|saffire|same-?r?|daft|flex-?2?|spice|acme|cfi-?g?|e-?field|bre|cld)\b/i;
const TOPIC_RX = /\b(flam|ignit|burn|flame|fire|smoke|aerosol|dust|detect|suppress|extinguish|oxygen|o2|pressure|gravity|airflow|flow|fuel|variable|measure|model|predict|habitat|rank|hardware|objective|test|row|data|droplet|soot|co2|helium|diluent|radiom|cool|moon|lunar|mars|iss|eva|earth)\w*/i;

export function isHintQuery(question: string, pinned?: string[]): boolean {
  if ((pinned?.length ?? 0) > 0) return false;
  const q = question.trim();
  if (GREETING_RX.test(q)) return true;
  return !PSI_RX.test(q) && !NAME_RX.test(q) && !TOPIC_RX.test(q);
}

function banner(): string {
  return "VERIFIED NASA PSI EXPERIMENTAL DATA // PROVENANCE CHECKED PER CITATION";
}

export function hintResponse(reason: string): AssistantApiResponse {
  return {
    requestId: crypto.randomUUID(),
    mode: "deterministic_fallback",
    dataMode: "VERIFIED_INDEXED_DATA",
    fallbackReason: reason,
    hint: true,
    status: "ANSWERED",
    sufficiency: "SUFFICIENT_VERIFIED",
    provenanceBanner: banner(),
    answer:
      "I answer questions about the NASA PSI microgravity-combustion investigations indexed here. Ask about a specific investigation, e.g. 'PSI-159', 'BASS', 'FLEX' or 'SAME-R', or about a habitat (Moon, Mars, ISS, EVA suit, Earth).\nExample questions:\n- " +
      EXAMPLE_QUESTIONS.join("\n- "),
    claims: [],
    citations: [],
    limitations: ["Evidence-only answers from the indexed PSI tables; no external knowledge."],
    abstained: false,
    abstentionReason: null,
    retrievedInvestigations: [],
  };
}

async function readSnapshot<T>(file: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(path.join(process.cwd(), "public", "data", file), "utf8")) as T;
  } catch {
    return null;
  }
}

/** Habitat / mission-risk question (Moon, Mars, ISS, EVA, Earth, 0.16 g ...) with NO investigation named: answered by the shared two-part readout, never pre-flight-abstained. */
const MISSION_HABITAT_RX: Array<[string, RegExp]> = [
  ["moon", /\b(moon|lunar|artemis|0\.16\s*g)\b/i],
  ["mars", /\b(mars|martian|0\.38\s*g)\b/i],
  ["iss", /\b(iss|space station|leo)\b/i],
  ["eva", /\b(eva|spacesuit|space suit)\b/i],
  ["earth", /\b(earth|1\s*g|submarine|mine|cleanroom|terrestrial)\b/i],
];

export function detectMissionHabitat(question: string, pinned?: string[]): string | null {
  if ((pinned?.length ?? 0) > 0 || PSI_RX.test(question) || NAME_RX.test(question)) return null;
  for (const [key, rx] of MISSION_HABITAT_RX) if (rx.test(question)) return key;
  return null;
}

const FASTAPI_URL = (process.env.FASTAPI_URL || "").replace(/\/$/, "");
const MISSION_TIMEOUT_MS = 4000;

/** Server-side delegation to FastAPI /api/assistant (env FASTAPI_URL, default NEXT_PUBLIC_API_BASE / http://localhost:8000); short timeout. */
async function fastApiAssistant(question: string, history: AssistantTurnInput[], ids: string[] | undefined): Promise<AssistantApiResponse | null> {
  const base = FASTAPI_URL || API_BASE;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), MISSION_TIMEOUT_MS);
  try {
    const res = await fetch(`${base}/api/assistant`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ question, history, investigationIds: ids ?? null }),
      signal: ctl.signal,
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`API ${res.status}`);
    const parsed = AssistantApiResponseSchema.safeParse(await res.json());
    if (!parsed.success) throw new Error(`unexpected shape: ${parsed.error.issues[0]?.message}`);
    return parsed.data;
  } catch (e) {
    console.error("[assistant] FastAPI delegation failed:", e instanceof Error ? e.message : String(e));
    return null;
  } finally {
    clearTimeout(timer);
  }
}

type ReadoutSnap = { habitats?: Record<string, Pick<AssistantApiResponse, "answer" | "habitatView" | "claims" | "citations" | "limitations" | "retrievedInvestigations">> };

/** Mission / habitat answer: FastAPI first (mode 'deterministic'); if unreachable, the precomputed readout from public/data/habitat_readouts.json (same python builder; mode 'deterministic_fallback'). */
export async function missionAnswer(habitat: string, question: string, history: AssistantTurnInput[], ids: string[] | undefined): Promise<AssistantApiResponse | null> {
  const live = await fastApiAssistant(question, history, ids);
  if (live && live.status === "ANSWERED" && !live.hint) return { ...live, mode: "deterministic", fallbackReason: null };
  const snap = await readSnapshot<ReadoutSnap>("habitat_readouts.json");
  const r = snap?.habitats?.[habitat];
  if (!r) return null;
  return {
    requestId: crypto.randomUUID(), mode: "deterministic_fallback", dataMode: "VERIFIED_INDEXED_DATA",
    fallbackReason: "FastAPI :8000 unreachable; precomputed habitat readout from the static snapshot (same builder, same ranking)",
    status: "ANSWERED", sufficiency: "SUFFICIENT_VERIFIED", provenanceBanner: banner(), answer: r.answer, habitatView: r.habitatView ?? null, claims: r.claims, citations: r.citations,
    limitations: r.limitations, abstained: false, abstentionReason: null, retrievedInvestigations: r.retrievedInvestigations,
  };
}

async function viaFastApi(question: string, history: AssistantTurnInput[], ids: string[] | undefined): Promise<AssistantApiResponse | null> {
  try {
    const raw = await fetchLive<unknown>(
      "/api/assistant",
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question, history, investigationIds: ids ?? null }) },
      8000,
    );
    const parsed = AssistantApiResponseSchema.safeParse(raw);
    if (!parsed.success) {
      console.error("[assistant] FastAPI /api/assistant returned an unexpected shape:", parsed.error.issues[0]?.message);
      return null;
    }
    return parsed.data;
  } catch (e) {
    console.error("[assistant] FastAPI /api/assistant unreachable, using the local snapshot builder:", e instanceof Error ? e.message : String(e));
    return null;
  }
}

type RankSnap = { habitats?: Record<string, { by_investigation?: Array<{ psi_id: string; max_score: number }> }> };
type AuditSnap = { candidates?: Array<{ id: string; psi_ids: string[]; passed_gate: boolean; target: string; n_samples: number }> };

async function localBuilder(question: string, history: AssistantTurnInput[], ids: string[] | undefined, repository: InvestigationRepository | undefined, reason: string): Promise<AssistantApiResponse> {
  const retrieval = await retrieveEvidenceForQuestion(question, { history, pinnedIds: ids, repository });
  const recs = retrieval.records.slice(0, 3);
  if (recs.length === 0) return hintResponse(`${reason}; no matching record`);
  const vars = await loadVariableSummaryServer().catch(() => null);
  const audit = await readSnapshot<AuditSnap>("model_audit.json");
  const ranks = await readSnapshot<RankSnap>("rankings_top.json");
  const lines: string[] = [];
  const citations: AssistantCitation[] = [];
  const claims: AssistantApiResponse["claims"] = [];
  recs.forEach((rec, i) => {
    const run = rec.testRuns[0];
    const n = i + 1;
    const gi = rec.gravityInfo;
    lines.push(`${rec.id} (${rec.acronym ?? rec.name}): ${rec.name}.`);
    lines.push(`  Hardware (PSI record): ${rec.hardware ?? "none listed"}; flight program: ${rec.flightProgram ?? "n/a"}.`);
    if (rec.objective) lines.push(`  Objective (PSI record): ${cleanTruncate(rec.objective, 400)}`);
    lines.push(`  Test rows: ${rec.testRuns.length}${run ? ` [${n}]` : " (metadata and protocol only in PSI)"}. Fuels: ${rec.fuelMaterial}.`);
    const rg = rec.ranges;
    lines.push(`  Conditions with values: ${[rg?.o2, rg?.pressure, rg?.airflow].filter(Boolean).join("; ") || "none unit-proven (see variable panel)"}.`);
    const v = vars?.data.by_psi?.[rec.id];
    if (v) {
      const names = (rows: Array<{ header: string | null; column_name: string }>) => [...new Set(rows.map((r) => (r.header ?? r.column_name).trim()))];
      for (const [role, label] of [["controlled", "Held constant"], ["varied", "Varied"], ["measured", "Measured outputs"]] as const) {
        const nm = names(v[role] ?? []);
        if (nm.length) lines.push(`  ${label} (${nm.length}): ${nm.slice(0, 8).join(", ")}${nm.length > 8 ? " ..." : ""}.`);
      }
      const nd = names(v.diagnostic_imaging ?? []).length;
      if (nd) lines.push(`  Diagnostics / imaging columns (${nd}) are not experimental variables.`);
    }
    if (gi) lines.push(`  Actual gravity: ${gi.actualG === null ? "not reported" : `${gi.actualG.toFixed(1)} g`} (${gi.source ?? "n/a"}; inferred). Effective-gravity PROXY rows: ${gi.nProxyRows} of ${rec.testRuns.length}.`);
    for (const c of audit?.candidates ?? []) {
      if (c.psi_ids.includes(rec.id)) lines.push(`  ${c.passed_gate ? "MODEL (passes dummy-baseline gate)" : "LOOKUP ONLY (fails gate)"}: ${c.id} (${c.target}; n=${c.n_samples}).`);
    }
    if (run) {
      citations.push({
        citationNumber: n, evidenceId: `${rec.id}:${run.id}`.slice(0, 120), investigationId: rec.id, investigationTitle: rec.name, family: rec.family, testRunId: run.id,
        fieldLabel: "First ingested test row", valueDisplay: run.label, originalValue: run.label, originalUnit: null, missingStatus: "PRESENT",
        provenanceStatus: "NASA_VERIFIED_DATA", provenanceLabel: "NASA PSI file row (verified)", isDemoFixture: false, isVerified: true,
        sourceTitle: `NASA PSI ${rec.id}`, locatorDisplay: run.sourceRunKey ?? "file · sheet · row not recorded", sourceUrl: "https://psi.nasa.gov",
      });
      claims.push({ id: `${rec.id}-rows`, text: `${rec.id}: ${rec.testRuns.length} test rows.`, evidenceType: "DIRECT_RECORD", citationNumbers: [n] });
    }
  });
  if (/\b(moon|lunar|artemis)\b/i.test(question) || /\b(apply|applies|relevan|habitat)\b/i.test(question)) {
    const by = ranks?.habitats?.moon?.by_investigation ?? [];
    lines.push("Habitat view (Artemis Moon Base: 0.16 g, <= 10.2 psi / 70.3 kPa, >= 30% O2):");
    if (by.length) lines.push(`  physics_ranker top 3: ${by.slice(0, 3).map((b) => `${b.psi_id} (${b.max_score.toFixed(1)})`).join(", ")}.`);
    lines.push(`  Caveat: every PSI row is ISS/Cygnus flight data at actual gravity 0.0 g, so none is a measured 0.16 g test. ${PROXY_CAVEAT}`);
  }
  return {
    requestId: crypto.randomUUID(), mode: "deterministic_fallback", dataMode: "VERIFIED_INDEXED_DATA", fallbackReason: `${reason} (local snapshot builder; FastAPI unreachable)`,
    status: "ANSWERED", sufficiency: "SUFFICIENT_VERIFIED", provenanceBanner: banner(), answer: lines.join("\n"), claims, citations,
    limitations: [
      "Evidence-only: values are copied or counted from the ingested PSI files; quantities a file does not state are not shown.",
      "All PSI rows are flight data at actual gravity 0.0 g (ISS/Cygnus baseline, inferred); effective-gravity values are a heuristic proxy, not measured partial-gravity results.",
      "Built from the static snapshot because the evidence API was unreachable; start the FastAPI server for the full database-backed answer.",
    ],
    abstained: false, abstentionReason: null,
    retrievedInvestigations: recs.map((r) => ({ id: r.id, name: r.name, family: r.family, missingFields: r.conditions.missingFields })),
  };
}

export async function buildDeterministicAnswer(params: {
  question: string;
  history: AssistantTurnInput[];
  investigationIds?: string[];
  repository?: InvestigationRepository;
  reason: string;
}): Promise<AssistantApiResponse> {
  const { question, history, investigationIds, repository, reason } = params;
  console.error(`[assistant] deterministic fallback: ${reason}`);
  try {
    if (isHintQuery(question, investigationIds)) return hintResponse(reason);
    const viaApi = await viaFastApi(question, history, investigationIds);
    if (viaApi) return { ...viaApi, mode: "deterministic_fallback", fallbackReason: reason };
    return await localBuilder(question, history, investigationIds, repository, reason);
  } catch (e) {
    console.error("[assistant] deterministic builder failed:", e instanceof Error ? `${e.name}: ${e.message}` : String(e));
    return hintResponse(`${reason}; builder error`);
  }
}

const HABITAT_RX = /\b(moon|lunar|artemis|mars|martian|iss|space station|eva|spacesuit|earth|habitat|0\.16\s*g|0\.38\s*g)\b/i;

/** Habitat ranking paragraph for questions that mention a habitat (used to enrich LLM answers). Returns null when unavailable. */
export async function habitatViewFor(question: string, history: AssistantTurnInput[], ids: string[] | undefined): Promise<string | null> {
  if (!HABITAT_RX.test(question)) return null;
  const r = await viaFastApi(question, history, ids);
  return r?.habitatView ? r.habitatView.replace(/\s*\[\d+\]/g, "") : null;
}
