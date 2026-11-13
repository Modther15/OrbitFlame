import crypto from "node:crypto";
import OpenAI, { APIConnectionTimeoutError, APIError, AuthenticationError, RateLimitError } from "openai";
import { buildScopedEvidencePromptPayload, ASSISTANT_SYSTEM_PROMPT } from "@/lib/assistant/assistant-prompts";
import {
  AssistantRequestSchema,
  ModelAssistantOutputSchema,
  OPENAI_ASSISTANT_JSON_SCHEMA,
  type AssistantApiResponse,
  type AssistantCitation,
  type AssistantTurnInput,
  type ModelAssistantOutput,
} from "@/lib/assistant/assistant-response-schema";
import { toCitationRecord, validateAndBindModelOutput } from "@/lib/assistant/citation-builder";
import { validateEvidenceSufficiency } from "@/lib/assistant/evidence-validator";
import { retrieveEvidenceForQuestion } from "@/lib/assistant/retrieval";
import type { InvestigationRepository } from "@/lib/data/repository";
import { DEMO_WARNING } from "@/lib/demo/dataset";
import { buildDeterministicAnswer, detectMissionHabitat, habitatViewFor, isHintQuery, hintResponse, missionAnswer } from "@/lib/assistant/deterministic-answer";
import { budgetRemaining, recordUsage, resolveModel, BUDGET_USD } from "@/lib/assistant/spend-guard";

export type AssistantProviderErrorCode =
  | "CONFIGURATION_REQUIRED"
  | "RATE_LIMITED"
  | "TIMEOUT"
  | "MALFORMED_MODEL_OUTPUT"
  | "PROVIDER_ERROR";

export class AssistantProviderError extends Error {
  public readonly code: AssistantProviderErrorCode;
  public readonly httpStatus: number;

  constructor(message: string, code: AssistantProviderErrorCode, httpStatus: number) {
    super(message);
    this.name = "AssistantProviderError";
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

export interface AssistantLlmProvider {
  readonly name: string;
  isConfigured(): boolean;
  generateStructuredResponse(params: {
    systemPrompt: string;
    userPayload: string;
    history: AssistantTurnInput[];
    signal?: AbortSignal;
  }): Promise<ModelAssistantOutput>;
}

const DEFAULT_MODEL = "gpt-4o-mini";

export function isOpenAiConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY.trim().length > 0);
}

export class OpenAiResponsesProvider implements AssistantLlmProvider {
  public readonly name = "openai-responses";

  public isConfigured(): boolean {
    return isOpenAiConfigured();
  }

  public async generateStructuredResponse(params: {
    systemPrompt: string;
    userPayload: string;
    history: AssistantTurnInput[];
    signal?: AbortSignal;
  }): Promise<ModelAssistantOutput> {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      throw new AssistantProviderError(
        "OPENAI_API_KEY is not configured on the server. Add OPENAI_API_KEY in environment settings to enable AI synthesis.",
        "CONFIGURATION_REQUIRED",
        503,
      );
    }

    const model = resolveModel(process.env.OPENAI_MODEL || DEFAULT_MODEL);
    if (budgetRemaining() <= 0) {
      throw new AssistantProviderError(
        `Local OpenAI budget of $${BUDGET_USD.toFixed(2)} is used up. AI synthesis is disabled; deterministic database answers still work.`,
        "RATE_LIMITED",
        429,
      );
    }
    const client = new OpenAI({
      apiKey,
      timeout: 25_000,
      maxRetries: 0,
    });

    try {
      const response = await client.responses.create(
        {
          model,
          instructions: params.systemPrompt,
          input: [
            {
              role: "user",
              content: params.userPayload,
            },
          ],
          text: {
            format: {
              type: "json_schema",
              name: "orbitflame_evidence_response",
              strict: true,
              schema: OPENAI_ASSISTANT_JSON_SCHEMA,
            },
          },
          max_output_tokens: 2500,
          tools: [],
          tool_choice: "none",
          store: false,
        },
        { signal: params.signal },
      );

      recordUsage(model, response.usage?.input_tokens ?? 0, response.usage?.output_tokens ?? 0);
      if (response.status === "incomplete") {
        console.error("[assistant] model output truncated:", JSON.stringify(response.incomplete_details));
        throw new AssistantProviderError(
          "Model output was truncated before the JSON completed (token limit). Try a narrower question.",
          "MALFORMED_MODEL_OUTPUT",
          502,
        );
      }
      const rawText = response.output_text?.trim();
      if (!rawText) {
        throw new AssistantProviderError(
          "Model returned an empty response payload.",
          "MALFORMED_MODEL_OUTPUT",
          502,
        );
      }

      let jsonValue: unknown;
      try {
        jsonValue = JSON.parse(rawText);
      } catch {
        console.error("[assistant] non-JSON output head:", rawText.slice(0, 200));
        throw new AssistantProviderError(
          "Model returned non-JSON structured output.",
          "MALFORMED_MODEL_OUTPUT",
          502,
        );
      }

      const parsed = ModelAssistantOutputSchema.safeParse(jsonValue);
      if (!parsed.success) {
        throw new AssistantProviderError(
          "Model output did not conform to the required evidence schema.",
          "MALFORMED_MODEL_OUTPUT",
          502,
        );
      }

      return parsed.data;
    } catch (err) {
      if (err instanceof AssistantProviderError) {
        throw err;
      }
      if (err instanceof RateLimitError) {
        throw new AssistantProviderError(
          "OpenAI API rate limit reached. Wait briefly and retry your query.",
          "RATE_LIMITED",
          429,
        );
      }
      if (
        err instanceof APIConnectionTimeoutError ||
        (err instanceof Error && (err.name === "AbortError" || /timed?\s*out/i.test(err.message)))
      ) {
        throw new AssistantProviderError(
          "Assistant request timed out waiting for OpenAI Responses API.",
          "TIMEOUT",
          504,
        );
      }
      if (err instanceof AuthenticationError) {
        throw new AssistantProviderError(
          "OpenAI API authentication failed. Verify the server OPENAI_API_KEY configuration.",
          "CONFIGURATION_REQUIRED",
          503,
        );
      }
      if (err instanceof APIError) {
        throw new AssistantProviderError(
          `OpenAI provider error (HTTP ${err.status ?? "unknown"}).`,
          "PROVIDER_ERROR",
          502,
        );
      }
      throw new AssistantProviderError(
        "Unexpected error communicating with the AI provider.",
        "PROVIDER_ERROR",
        502,
      );
    }
  }
}

async function runAssistantPipelineCore(
  rawInput: unknown,
  options?: {
    repository?: InvestigationRepository;
    provider?: AssistantLlmProvider;
    signal?: AbortSignal;
  },
): Promise<{ httpStatus: number; body: AssistantApiResponse }> {
  const requestId = crypto.randomUUID();
  const parsedRequest = AssistantRequestSchema.parse(rawInput);
  const provider = options?.provider ?? new OpenAiResponsesProvider();

  const retrieval = await retrieveEvidenceForQuestion(parsedRequest.question, {
    history: parsedRequest.history,
    pinnedIds: parsedRequest.investigationIds,
    repository: options?.repository,
  });

  const validation = validateEvidenceSufficiency(retrieval);
  const retrievedInvestigations = retrieval.records.map((rec) => ({
    id: rec.id,
    name: rec.name,
    family: rec.family,
    missingFields: rec.conditions.missingFields,
  }));
  const provenanceBanner =
    retrieval.mode === "VERIFIED_INDEXED_DATA"
      ? "VERIFIED NASA PSI EXPERIMENTAL DATA // PROVENANCE CHECKED PER CITATION"
      : DEMO_WARNING;

  // Deterministic pre-flight abstention: skips LLM call when evidence is absent, missing, incompatible, causal, or unverified-only.
  if (!validation.canProceedToModel) {
    const contextCitations: AssistantCitation[] = retrieval.records
      .map((rec) => {
        const overview = retrieval.evidenceItems.find(
          (item) => item.investigationId === rec.id && item.fieldKey === "overview",
        );
        return overview ? toCitationRecord(overview, 1) : null;
      })
      .filter((c): c is AssistantCitation => c !== null)
      .map((c, idx) => ({ ...c, citationNumber: idx + 1 }));

    const answerLines = [
      `Abstained — Insufficient Evidence (${validation.sufficiency}): ${validation.abstentionReason}`,
      "",
      `Limitations & Missing Information: ${validation.limitations.join(" ") || "No additional limitations."}`,
      "",
      `Provenance Notice: ${provenanceBanner}`,
    ];

    return {
      httpStatus: 200,
      body: {
        requestId,
        mode: "deterministic_fallback",
        dataMode: retrieval.mode,
        fallbackReason: `pre-flight abstention: ${validation.sufficiency}`,
        status: "ABSTAINED",
        sufficiency: validation.sufficiency,
        provenanceBanner,
        answer: answerLines.join("\n"),
        claims: [],
        citations: contextCitations,
        limitations: validation.limitations,
        abstained: true,
        abstentionReason: validation.abstentionReason,
        retrievedInvestigations,
      },
    };
  }

  // No LLM configured: the wrapper (runAssistantPipeline) converts this into the deterministic evidence answer.
  if (!provider.isConfigured()) {
    return {
      httpStatus: 503,
      body: {
        requestId,
        mode: "deterministic_fallback",
        dataMode: retrieval.mode,
        fallbackReason: "OPENAI_API_KEY is not configured",
        status: "CONFIGURATION_REQUIRED",
        sufficiency: "PROVIDER_UNAVAILABLE",
        provenanceBanner,
        answer: "OPENAI_API_KEY is not configured on the server.",
        claims: [],
        citations: [],
        limitations: validation.limitations,
        abstained: true,
        abstentionReason: "OPENAI_API_KEY is not configured on the server.",
        retrievedInvestigations,
        configStatus: { configured: false, message: "OPENAI_API_KEY is not configured on the server." },
      },
    };
  }

  const userPayload = buildScopedEvidencePromptPayload(parsedRequest.question, parsedRequest.history, retrieval, validation);

  try {
    const modelOutput = await provider.generateStructuredResponse({
      systemPrompt: ASSISTANT_SYSTEM_PROMPT,
      userPayload,
      history: parsedRequest.history,
      signal: options?.signal,
    });

    const bound = validateAndBindModelOutput(modelOutput, retrieval.evidenceItems, validation.limitations);
    const allLimitations = [...validation.limitations, ...modelOutput.limitations];
    if (bound.rejectedCitationIds.length > 0) {
      allLimitations.push(
        `Rejected ${bound.rejectedCitationIds.length} ungrounded citation reference(s) not present in retrieved evidence.`,
      );
    }
    if (bound.droppedUngroundedClaims > 0) {
      allLimitations.push(
        `Removed ${bound.droppedUngroundedClaims} claim(s) that lacked verified retrieved evidence IDs.`,
      );
    }

    return {
      httpStatus: 200,
      body: {
        requestId,
        mode: "llm",
        dataMode: retrieval.mode,
        fallbackReason: null,
        status: bound.abstained ? "ABSTAINED" : "ANSWERED",
        sufficiency: validation.sufficiency,
        provenanceBanner,
        answer: bound.answer,
        claims: bound.claims,
        citations: bound.citations,
        limitations: Array.from(new Set(allLimitations.filter(Boolean))),
        abstained: bound.abstained,
        abstentionReason: bound.abstentionReason,
        retrievedInvestigations,
      },
    };
  } catch (err) {
    if (err instanceof AssistantProviderError) {
      return {
        httpStatus: err.httpStatus,
        body: {
          requestId,
          mode: "deterministic_fallback",
          dataMode: retrieval.mode,
          fallbackReason: `${err.code}: ${err.message}`,
          status: err.code === "CONFIGURATION_REQUIRED" ? "CONFIGURATION_REQUIRED" : "PROVIDER_ERROR",
          sufficiency: "PROVIDER_UNAVAILABLE",
          provenanceBanner,
          answer: err.message,
          claims: [],
          citations: [],
          limitations: validation.limitations,
          abstained: true,
          abstentionReason: err.message,
          retrievedInvestigations,
          configStatus:
            err.code === "CONFIGURATION_REQUIRED"
              ? { configured: false, message: err.message }
              : undefined,
        },
      };
    }
    throw err;
  }
}


/**
 * Public entry point: NEVER fails. With a working OPENAI key the answer is LLM-synthesised over retrieved evidence (mode 'llm');
 * in every other case (key missing, provider error / timeout / malformed output / budget exceeded, retrieval error, vague query) it
 * returns HTTP 200 with a deterministic evidence-only answer (mode 'deterministic_fallback') and logs the cause server-side.
 */
export async function runAssistantPipeline(
  rawInput: unknown,
  options?: { repository?: InvestigationRepository; provider?: AssistantLlmProvider; signal?: AbortSignal },
): Promise<{ httpStatus: number; body: AssistantApiResponse }> {
  let question = "";
  let history: AssistantTurnInput[] = [];
  let ids: string[] | undefined;
  try {
    const parsed = AssistantRequestSchema.parse(rawInput);
    question = parsed.question;
    history = parsed.history;
    ids = parsed.investigationIds;
    if (isHintQuery(question, ids)) {
      return { httpStatus: 200, body: hintResponse("greeting or vague query: no LLM call needed") };
    }
    // Habitat / mission-risk questions (why dangerous, which PSI experiments bound it, Moon / Mars / ISS / EVA ...) are never pre-flight-abstained: they are delegated to the
    // shared FastAPI readout (physics + ranked PSI list with row citations) and fall back to the precomputed snapshot readout. The LLM path / spend guard is not used for them.
    const missionHabitat = detectMissionHabitat(question, ids);
    if (missionHabitat) {
      const mission = await missionAnswer(missionHabitat, question, history, ids).catch(() => null);
      if (mission) return { httpStatus: 200, body: mission };
    }
    const out = await runAssistantPipelineCore(parsed, options);
    const b = out.body;
    const unavailable = b.status === "PROVIDER_ERROR" || b.status === "CONFIGURATION_REQUIRED" || b.sufficiency === "PROVIDER_UNAVAILABLE";
    if (unavailable || b.sufficiency === "INSUFFICIENT_NO_RECORDS") {
      const why = unavailable ? (b.fallbackReason ?? b.abstentionReason ?? "provider unavailable") : "no retrieved records for the question";
      console.error(`[assistant] provider unavailable -> fallback (${why})`);
      return { httpStatus: 200, body: await buildDeterministicAnswer({ question, history, investigationIds: ids, repository: options?.repository, reason: why }) };
    }
    // An LLM abstention on a habitat question (e.g. "how does PSI-159 apply to the Moon Base?") must not block the user: answer from the deterministic evidence builder instead.
    if (out.body.mode === "llm" && out.body.status === "ABSTAINED" && /\b(moon|lunar|artemis|mars|martian|iss|eva|spacesuit|earth|habitat|0\.16\s*g|0\.38\s*g)\b/i.test(question)) {
      return { httpStatus: 200, body: await buildDeterministicAnswer({ question, history, investigationIds: ids, repository: options?.repository, reason: "LLM abstained on a habitat question; evidence-only answer used" }) };
    }
    if (out.body.mode === "llm") {
      const hv = await habitatViewFor(question, history, ids).catch(() => null);
      if (hv) out.body.habitatView = hv;
    }
    return out;
  } catch (e) {
    const why = `${e instanceof Error ? e.name : "error"}: ${e instanceof Error ? e.message : String(e)}`.slice(0, 300);
    console.error(`[assistant] pipeline error -> deterministic fallback (${why})`);
    return { httpStatus: 200, body: await buildDeterministicAnswer({ question, history, investigationIds: ids, repository: options?.repository, reason: why }) };
  }
}
