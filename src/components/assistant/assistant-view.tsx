"use client";

import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Check,
  Copy,
  FileCheck2,
  FileSearch,
  FlaskConical,
  Loader2,
  RotateCcw,
  Send,
  ShieldAlert,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useState, useSyncExternalStore, type FormEvent } from "react";
import { CitationEvidenceDrawer } from "@/components/assistant/citation-evidence-drawer";
import { ExploreSpaceBackground } from "@/components/explorer/explore-space-background";
import { Sidebar } from "@/components/navigation/sidebar";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import type {
  AssistantApiResponse,
  AssistantCitation,
  AssistantTurnInput,
} from "@/lib/assistant/assistant-response-schema";
import { DEMO_WARNING } from "@/lib/demo/dataset";

export type AssistantSuggestion = {
  id: string;
  label: string;
  question: string;
  category: string;
};

export type FamilyShortcut = {
  family: string;
  count: number;
  question: string;
};

type AssistantConversationMessage =
  | {
      id: string;
      role: "user";
      content: string;
      createdAt: string;
    }
  | {
      id: string;
      role: "assistant";
      questionForRetry: string;
      response: AssistantApiResponse;
      createdAt: string;
    };

type AssistantViewProps = {
  dataScope: "DEMO DATA" | "VERIFIED NASA PSI EXPERIMENTAL DATA" | "EMPTY";
  indexedCount: number;
  isAiConfigured: boolean;
  suggestions: AssistantSuggestion[];
  familyShortcuts: FamilyShortcut[];
};

const SESSION_STORAGE_KEY = "orbitflame-assistant-session-v1";
const SESSION_CHANGE_EVENT = "orbitflame:assistant-session-change";
const EMPTY_MESSAGES: AssistantConversationMessage[] = [];
let cachedRawSession = "[]";
let cachedParsedSession: AssistantConversationMessage[] = EMPTY_MESSAGES;
let turnCounter = 0;

function nextTurnMetadata(prefix: "u" | "a"): { id: string; createdAt: string } {
  turnCounter += 1;
  return {
    id: `${prefix}-${turnCounter}`,
    createdAt: new Date().toISOString(),
  };
}

function getSessionSnapshot(): AssistantConversationMessage[] {
  if (typeof window === "undefined") return EMPTY_MESSAGES;
  try {
    const raw = window.sessionStorage.getItem(SESSION_STORAGE_KEY) ?? "[]";
    if (raw === cachedRawSession) return cachedParsedSession;
    cachedRawSession = raw;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      cachedParsedSession = parsed as AssistantConversationMessage[];
      return cachedParsedSession;
    }
  } catch {
    // Ignore malformed browser sessionStorage
  }
  cachedParsedSession = EMPTY_MESSAGES;
  return cachedParsedSession;
}

function getServerSessionSnapshot(): AssistantConversationMessage[] {
  return EMPTY_MESSAGES;
}

function subscribeSession(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const handler = () => callback();
  window.addEventListener(SESSION_CHANGE_EVENT, handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener(SESSION_CHANGE_EVENT, handler);
    window.removeEventListener("storage", handler);
  };
}

function writeSessionMessages(nextMessages: AssistantConversationMessage[]): void {
  const sliced = nextMessages.slice(-12);
  cachedRawSession = JSON.stringify(sliced);
  cachedParsedSession = sliced.length === 0 ? EMPTY_MESSAGES : sliced;
  if (typeof window !== "undefined") {
    try {
      if (sliced.length === 0) {
        window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
      } else {
        window.sessionStorage.setItem(SESSION_STORAGE_KEY, cachedRawSession);
      }
    } catch {
      // Ignore sessionStorage quota issues
    }
    window.dispatchEvent(new Event(SESSION_CHANGE_EVENT));
  }
}

export function AssistantView({
  dataScope,
  indexedCount,
  isAiConfigured,
  suggestions,
  familyShortcuts,
}: AssistantViewProps) {
  const [question, setQuestion] = useState("");
  const messages = useSyncExternalStore(subscribeSession, getSessionSnapshot, getServerSessionSnapshot);
  const [isLoading, setIsLoading] = useState(false);
  const [networkError, setNetworkError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [activeCitation, setActiveCitation] = useState<AssistantCitation | null>(null);

  async function submitQuestion(rawQuestion: string, appendUserMessage = true) {
    const trimmed = rawQuestion.trim();
    if (!trimmed || isLoading) return;

    setNetworkError(null);
    const historyForRequest: AssistantTurnInput[] = messages
      .slice(-8)
      .map((msg) => ({
        role: msg.role,
        content: msg.role === "user" ? msg.content : msg.response.answer,
      }));

    let updatedMessages = messages;
    if (appendUserMessage) {
      const meta = nextTurnMetadata("u");
      const userTurn: AssistantConversationMessage = {
        id: meta.id,
        role: "user",
        content: trimmed,
        createdAt: meta.createdAt,
      };
      updatedMessages = [...messages, userTurn];
      writeSessionMessages(updatedMessages);
      setQuestion("");
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: trimmed,
          history: historyForRequest,
        }),
      });

      const payload = (await res.json().catch(() => null)) as
        | AssistantApiResponse
        | { message?: string; code?: string }
        | null;

      if (!payload || !("status" in payload)) {
        const errMsg =
          payload && "message" in payload && typeof payload.message === "string"
            ? payload.message
            : `Assistant request failed (HTTP ${res.status}).`;
        setNetworkError(errMsg);
        return;
      }

      const meta = nextTurnMetadata("a");
      const assistantTurn: AssistantConversationMessage = {
        id: meta.id,
        role: "assistant",
        questionForRetry: trimmed,
        response: payload,
        createdAt: meta.createdAt,
      };
      writeSessionMessages([...updatedMessages, assistantTurn]);
    } catch {
      setNetworkError("Unable to reach /api/assistant. Verify server connectivity and retry.");
    } finally {
      setIsLoading(false);
    }
  }

  function handleFormSubmit(e: FormEvent) {
    e.preventDefault();
    void submitQuestion(question, true);
  }

  async function handleCopyAnswer(msgId: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(msgId);
      setTimeout(() => {
        setCopiedId((prev) => (prev === msgId ? null : prev));
      }, 1800);
    } catch {
      // Fallback noop if clipboard denied
    }
  }

  function handleClearConversation() {
    writeSessionMessages([]);
    setNetworkError(null);
    setActiveCitation(null);
  }

  const scopeBadgeStatus = dataScope === "VERIFIED NASA PSI EXPERIMENTAL DATA" ? "verified" : dataScope === "EMPTY" ? "empty" : "demo";

  return (
    <div className="relative min-h-screen overflow-x-clip bg-[#050b1b] text-[#f4f8ff] lg:grid lg:grid-cols-[260px_1fr]">
      <ExploreSpaceBackground />
      <Sidebar />

      <main className="explore-main-stage relative z-10 min-w-0 px-4 py-6 sm:px-8 sm:py-8 lg:px-10 lg:py-9">
        <div className="mx-auto max-w-[1140px] space-y-6">
          {/* Header Instrument Bar */}
          <Card className="border border-white/10 bg-[#09152e]/85 p-5 backdrop-blur-md sm:p-7">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="font-mono text-[10px] font-semibold tracking-[.18em] text-[#52b6ff] uppercase">
                  PHASE 3 INSTRUMENTATION // EVIDENCE-ONLY SYNTHESIS
                </p>
                <h1 className="mt-1.5 text-2xl font-extrabold tracking-tight text-[#f4f8ff] sm:text-3xl">
                  OrbitFlame AI Research Assistant
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#9cb2d2]">
                  Evidence-only answers from indexed combustion investigations. Every factual claim must bind directly to a
                  retrieved repository record, preserve original units and missing states, and abstain when evidence is
                  insufficient.
                </p>
              </div>

              <div className="flex flex-col items-start gap-2 md:items-end">
                <StatusBadge status={scopeBadgeStatus} />
                <span className="font-mono text-[11px] text-[#8ea5c7]">
                  ACTIVE SCOPE: <strong className="text-[#f4f8ff]">{dataScope}</strong> ({indexedCount} indexed records)
                </span>
              </div>
            </div>

            {dataScope === "DEMO DATA" && (
              <div className="mt-5 flex items-start gap-3 rounded-xl border border-amber-400/30 bg-amber-400/10 p-3.5 text-xs leading-5 text-amber-100">
                <ShieldAlert size={16} className="mt-0.5 shrink-0 text-amber-300" aria-hidden="true" />
                <div>
                  <span className="font-mono text-[10.5px] font-bold tracking-wider text-amber-300 uppercase">
                    {DEMO_WARNING}
                  </span>
                  <p className="mt-0.5 text-[#fbe6b5]">
                    Answers generated from demo fixtures illustrate citation grounding and abstention rules only. They are
                    never presented as verified NASA experimental findings.
                  </p>
                </div>
              </div>
            )}

            {!isAiConfigured && (
              <div
                data-testid="openai-config-notice"
                className="mt-4 flex items-start gap-3 rounded-xl border border-[#36a9ff]/35 bg-[#0a1f46]/80 p-3.5 text-xs leading-5 text-[#d8e9ff]"
              >
                <AlertTriangle size={16} className="mt-0.5 shrink-0 text-[#ff8a32]" aria-hidden="true" />
                <div>
                  <p className="font-mono text-[10.5px] font-bold tracking-wider text-[#ff8a32] uppercase">
                    SERVER CONFIGURATION REQUIRED // OPENAI_API_KEY NOT SET
                  </p>
                  <p className="mt-0.5 text-[#b5c9e8]">
                    Server environment variable <code className="font-mono text-white">OPENAI_API_KEY</code> is not
                    configured. Submitting a query will return a configuration notice rather than fabricating AI answers.
                  </p>
                </div>
              </div>
            )}
          </Card>

          {/* Suggested Prompts + Investigation Family Shortcuts */}
          {messages.length === 0 && (
            <div className="grid gap-5 lg:grid-cols-[1.35fr_0.85fr]">
              <Card className="border border-white/10 bg-[#09152e]/80 p-5 backdrop-blur-md">
                <div className="flex items-center gap-2">
                  <FileSearch size={15} className="text-[#36a9ff]" aria-hidden="true" />
                  <h2 className="font-mono text-[11px] font-bold tracking-[.16em] text-[#52b6ff] uppercase">
                    Evidence-Supported Research Questions
                  </h2>
                </div>
                <p className="mt-1.5 text-xs text-[#8ea5c7]">
                  Verified against the active repository index so each prompt resolves to matching records.
                </p>

                <div className="mt-4 grid gap-2.5">
                  {suggestions.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      disabled={isLoading}
                      onClick={() => void submitQuestion(s.question, true)}
                      className="group flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#060e22]/75 px-4 py-3 text-left transition-all hover:border-[#36a9ff]/45 hover:bg-[#0d1f44]/90 disabled:opacity-50"
                    >
                      <div className="min-w-0">
                        <span className="font-mono text-[10px] font-semibold tracking-wider text-[#ff8a32] uppercase">
                          {s.category}
                        </span>
                        <p className="mt-0.5 text-xs font-medium text-[#e5efff] group-hover:text-white">{s.question}</p>
                      </div>
                      <ArrowRight
                        size={15}
                        className="shrink-0 text-[#7d95b8] transition-transform group-hover:translate-x-0.5 group-hover:text-[#52b6ff]"
                        aria-hidden="true"
                      />
                    </button>
                  ))}
                </div>
              </Card>

              <Card className="border border-white/10 bg-[#09152e]/80 p-5 backdrop-blur-md">
                <div className="flex items-center gap-2">
                  <FlaskConical size={15} className="text-[#36a9ff]" aria-hidden="true" />
                  <h2 className="font-mono text-[11px] font-bold tracking-[.16em] text-[#52b6ff] uppercase">
                    Investigation-Family Shortcuts
                  </h2>
                </div>
                <p className="mt-1.5 text-xs text-[#8ea5c7]">
                  Families currently indexed in the active repository dataset.
                </p>

                {familyShortcuts.length === 0 ? (
                  <div className="mt-4 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-xs text-[#8ea5c7]">
                    No investigation families are currently indexed.
                  </div>
                ) : (
                  <div className="mt-4 grid gap-2">
                    {familyShortcuts.map((shortcut) => (
                      <button
                        key={shortcut.family}
                        type="button"
                        disabled={isLoading}
                        onClick={() => void submitQuestion(shortcut.question, true)}
                        className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-[#060e22]/75 px-3.5 py-2.5 text-left transition-colors hover:border-[#36a9ff]/45 hover:bg-[#0d1f44]/90 disabled:opacity-50"
                      >
                        <span className="font-mono text-xs font-bold tracking-wider text-[#f4f8ff]">{shortcut.family}</span>
                        <span className="rounded-full border border-[#36a9ff]/30 bg-[#36a9ff]/10 px-2.5 py-0.5 font-mono text-[10px] font-semibold text-[#52b6ff]">
                          {shortcut.count} {shortcut.count === 1 ? "RECORD" : "RECORDS"}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          )}

          {/* Conversation Stream */}
          {messages.length > 0 && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="font-mono text-[11px] font-semibold tracking-[.14em] text-[#8ea5c7] uppercase">
                  ACTIVE SESSION // {messages.length} {messages.length === 1 ? "TURN" : "TURNS"}
                </span>
                <button
                  type="button"
                  onClick={handleClearConversation}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.04] px-3 py-1.5 font-mono text-[11px] font-semibold text-[#c4d7f2] transition-colors hover:border-amber-400/45 hover:text-amber-200"
                >
                  <Trash2 size={13} aria-hidden="true" /> Clear conversation
                </button>
              </div>

              <div className="space-y-4" aria-live="polite">
                {messages.map((msg) => {
                  if (msg.role === "user") {
                    return (
                      <div key={msg.id} className="flex justify-end">
                        <div className="max-w-2xl rounded-2xl border border-[#36a9ff]/30 bg-[linear-gradient(135deg,#0d254f_0%,#113063_100%)] px-4 py-3 text-sm text-[#f4f8ff] shadow-lg">
                          <span className="block font-mono text-[9.5px] font-semibold tracking-[.16em] text-[#7bc5ff] uppercase">
                            RESEARCH QUERY
                          </span>
                          <p className="mt-1 whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                        </div>
                      </div>
                    );
                  }

                  const { response } = msg;
                  const isAbstained = response.status === "ABSTAINED" || response.abstained;
                  const isConfigError = response.status === "CONFIGURATION_REQUIRED";
                  const isProviderError = response.status === "PROVIDER_ERROR";

                  return (
                    <Card
                      key={msg.id}
                      data-testid="assistant-response-card"
                      className={`border p-5 backdrop-blur-md ${
                        isConfigError || isProviderError
                          ? "border-rose-400/35 bg-[#1b0d18]/80"
                          : isAbstained
                            ? "border-amber-400/35 bg-[#15120a]/85"
                            : "border-[#36a9ff]/25 bg-[#09152e]/90"
                      }`}
                    >
                      {/* Response Header Badges & Actions */}
                      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-semibold tracking-wider uppercase ${
                              isConfigError || isProviderError
                                ? "border-rose-400/40 bg-rose-400/15 text-rose-200"
                                : isAbstained
                                  ? "border-amber-400/40 bg-amber-400/15 text-amber-200"
                                  : "border-sky-400/40 bg-sky-400/15 text-sky-200"
                            }`}
                          >
                            <Activity size={11} aria-hidden="true" />
                            {response.status}
                          </span>
                          <span className="rounded-full border border-white/15 bg-white/[0.05] px-2.5 py-0.5 font-mono text-[10px] text-[#9cb2d2]">
                            {response.sufficiency}
                          </span>
                          <span
                            className={`rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-semibold ${
                              response.dataMode === "VERIFIED_INDEXED_DATA"
                                ? "border-emerald-400/35 bg-emerald-400/10 text-emerald-300"
                                : "border-amber-400/35 bg-amber-400/10 text-amber-300"
                            }`}
                          >
                            {response.dataMode === "VERIFIED_INDEXED_DATA" ? "VERIFIED NASA PSI EXPERIMENTAL DATA" : "DEMO FIXTURE SCOPE"}
                          </span>
                          <span
                            data-testid="assistant-mode"
                            title={response.fallbackReason ?? (response.mode === "llm" ? "Answer synthesised by the language model over retrieved PSI evidence" : "Evidence-only answer built from the PSI database")}
                            className={`rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-semibold ${
                              response.mode === "llm" ? "border-sky-400/35 bg-sky-400/10 text-sky-200" : "border-white/20 bg-white/[0.05] text-[#c4d7f2]"
                            }`}
                          >
                            mode: {response.mode}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => void handleCopyAnswer(msg.id, response.answer)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/[0.04] px-2.5 py-1 font-mono text-[10.5px] font-semibold text-[#c4d7f2] hover:border-[#36a9ff]/45 hover:text-white"
                          >
                            {copiedId === msg.id ? <Check size={12} /> : <Copy size={12} />}
                            {copiedId === msg.id ? "Copied" : "Copy answer"}
                          </button>
                          <button
                            type="button"
                            disabled={isLoading}
                            onClick={() => void submitQuestion(msg.questionForRetry, false)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/[0.04] px-2.5 py-1 font-mono text-[10.5px] font-semibold text-[#c4d7f2] hover:border-[#36a9ff]/45 hover:text-white disabled:opacity-50"
                          >
                            <RotateCcw size={12} /> Retry
                          </button>
                        </div>
                      </div>

                      {response.habitatView && (
                        <div data-testid="assistant-habitat-view" className="mt-4 rounded-xl border border-amber-400/25 bg-amber-400/[0.06] p-3.5">
                          <p className="font-mono text-[10px] font-semibold tracking-[.16em] text-amber-300 uppercase">Habitat ranking &amp; gravity caveat (deterministic, physics_ranker)</p>
                          <p className="mt-1.5 whitespace-pre-wrap text-xs leading-relaxed text-[#fff1d0]">{response.habitatView}</p>
                        </div>
                      )}

                      {/* Main Answer / Abstention / Config Notice */}
                      {isAbstained ? (
                        <div className="mt-4 space-y-3">
                          <div className="flex items-start gap-2.5 rounded-xl border border-amber-400/30 bg-amber-400/10 p-3.5 text-xs leading-relaxed text-amber-100">
                            <ShieldAlert size={16} className="mt-0.5 shrink-0 text-amber-300" aria-hidden="true" />
                            <div>
                              <p className="font-mono text-[10.5px] font-bold tracking-wider text-amber-300 uppercase">
                                ABSTAINED — INSUFFICIENT VERIFIED EVIDENCE
                              </p>
                              <p className="mt-1 text-sm text-[#fff1d0]">
                                {response.abstentionReason || response.answer}
                              </p>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-4 space-y-4">
                          <div>
                            <p className="font-mono text-[10px] font-semibold tracking-[.16em] text-[#52b6ff] uppercase">
                              Direct Evidence-Grounded Response
                            </p>
                            <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-[#f4f8ff]">
                              {response.claims.length > 0
                                ? response.answer.split("\n\nSupporting Evidence:")[0].replace(/^Direct Answer:\s*/i, "")
                                : response.answer}
                            </p>
                          </div>

                          {response.claims.length > 0 && (
                            <div className="space-y-2.5 rounded-xl border border-white/10 bg-[#060e22]/75 p-4">
                              <p className="font-mono text-[10px] font-semibold tracking-[.16em] text-[#52b6ff] uppercase">
                                Grounded Factual Claims &amp; Interactive Citations
                              </p>
                              <ul className="space-y-2.5">
                                {response.claims.map((claim) => (
                                  <li
                                    key={claim.id}
                                    className="rounded-lg border border-white/5 bg-white/[0.02] p-3 text-xs leading-relaxed text-[#dce9fb]"
                                  >
                                    <div className="mb-1 flex flex-wrap items-center gap-2">
                                      <span
                                        className={`rounded px-1.5 py-0.5 font-mono text-[9.5px] font-bold uppercase ${
                                          claim.evidenceType === "DERIVED_CALCULATION"
                                            ? "bg-purple-400/15 text-purple-200"
                                            : "bg-sky-400/15 text-sky-200"
                                        }`}
                                      >
                                        {claim.evidenceType === "DERIVED_CALCULATION"
                                          ? "Derived from recorded evidence"
                                          : "Directly recorded evidence"}
                                      </span>
                                    </div>
                                    <span>{claim.text} </span>
                                    <span className="inline-flex flex-wrap items-center gap-1 align-baseline">
                                      {claim.citationNumbers.map((num) => {
                                        const cit = response.citations.find((c) => c.citationNumber === num);
                                        if (!cit) return null;
                                        return (
                                          <button
                                            key={`${claim.id}-cit-${num}`}
                                            type="button"
                                            data-testid={`citation-chip-${num}`}
                                            onClick={() => setActiveCitation(cit)}
                                            className="inline-flex items-center rounded border border-[#36a9ff]/45 bg-[#36a9ff]/15 px-1.5 py-0.5 font-mono text-[10px] font-bold text-[#7bc5ff] transition-colors hover:border-[#ff8a32] hover:bg-[#ff5500]/20 hover:text-white"
                                          >
                                            [{num}]
                                          </button>
                                        );
                                      })}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Referenced Citations Strip */}
                      {response.citations.length > 0 && (
                        <div className="mt-4 border-t border-white/10 pt-3.5">
                          <p className="font-mono text-[10px] font-semibold tracking-[.15em] text-[#7d95b8] uppercase">
                            Retrieved Evidence Citations (Click to inspect source locator &amp; provenance)
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {response.citations.map((cit) => (
                              <button
                                key={cit.evidenceId}
                                type="button"
                                onClick={() => setActiveCitation(cit)}
                                className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-[#060e22]/85 px-2.5 py-1.5 text-left font-mono text-[10.5px] text-[#d8e9ff] transition-colors hover:border-[#36a9ff]/60 hover:text-white"
                              >
                                <span className="font-bold text-[#52b6ff]">[{cit.citationNumber}]</span>
                                <span>
                                  {cit.investigationId} · {cit.fieldLabel}
                                </span>
                                <FileCheck2 size={12} className="text-[#7d95b8]" aria-hidden="true" />
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Retrieved Investigation Summary + Limitations */}
                      <div className="mt-4 grid gap-3 border-t border-white/10 pt-3.5 text-xs sm:grid-cols-2">
                        <div>
                          <p className="font-mono text-[10px] font-semibold tracking-[.15em] text-[#7d95b8] uppercase">
                            Limitations &amp; Missing Information
                          </p>
                          <ul className="mt-1.5 list-disc space-y-1 pl-4 text-[#9cb2d2]">
                            {response.limitations.length > 0 ? (
                              response.limitations.map((lim, idx) => <li key={idx}>{lim}</li>)
                            ) : (
                              <li>No additional limitations flagged for the scoped query.</li>
                            )}
                          </ul>
                        </div>
                        <div>
                          <p className="font-mono text-[10px] font-semibold tracking-[.15em] text-[#7d95b8] uppercase">
                            Indexed Records Evaluated
                          </p>
                          {response.retrievedInvestigations.length === 0 ? (
                            <p className="mt-1.5 font-mono text-[11px] text-amber-300">0 matching investigations found</p>
                          ) : (
                            <div className="mt-1.5 flex flex-wrap gap-1.5">
                              {response.retrievedInvestigations.map((inv) => (
                                <Link
                                  key={inv.id}
                                  href={`/investigations/${encodeURIComponent(inv.id)}`}
                                  className="rounded border border-white/15 bg-white/[0.04] px-2 py-0.5 font-mono text-[10.5px] text-[#7bc5ff] hover:border-[#36a9ff]"
                                >
                                  {inv.id}
                                </Link>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      <p className="mt-3.5 rounded-lg border border-white/10 bg-black/25 px-3 py-2 font-mono text-[10px] text-amber-200/90">
                        PROVENANCE NOTICE: {response.provenanceBanner}
                      </p>
                    </Card>
                  );
                })}

                {isLoading && (
                  <Card className="border border-[#36a9ff]/30 bg-[#09152e]/85 p-4 backdrop-blur-md">
                    <div className="flex items-center gap-3 text-xs font-mono text-[#7bc5ff]">
                      <Loader2 size={15} className="animate-spin text-[#ff8a32]" aria-hidden="true" />
                      Retrieving indexed records, checking physical unit compatibility, and validating citations...
                    </div>
                  </Card>
                )}
              </div>
            </div>
          )}

          {networkError && (
            <div
              role="alert"
              className="rounded-xl border border-rose-400/35 bg-rose-500/10 px-4 py-3 text-xs text-rose-200"
            >
              {networkError}
            </div>
          )}

          {/* Question Input Dock */}
          <Card className="border border-[#36a9ff]/25 bg-[#09152e]/90 p-4 backdrop-blur-md sm:p-5">
            <form onSubmit={handleFormSubmit} className="space-y-3">
              {/* Permanent Non-Interactive Strict Evidence Policy Indicator */}
              <div
                data-testid="strict-evidence-policy"
                className="rounded-xl border border-[#36a9ff]/25 bg-[#061026]/90 px-3.5 py-2.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <ShieldCheck size={15} className="shrink-0 text-[#52b6ff]" aria-hidden="true" />
                    <span className="font-mono text-[10.5px] font-bold tracking-[.15em] text-[#e5f1ff] uppercase">
                      STRICT EVIDENCE MODE
                    </span>
                  </div>
                  <span className="rounded-full border border-emerald-400/35 bg-emerald-500/15 px-2.5 py-0.5 font-mono text-[9.5px] font-bold tracking-wider text-emerald-300 uppercase">
                    ALWAYS ENABLED
                  </span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-[#9cb2d2]">
                  OrbitFlame AI uses only evidence retrieved from the indexed repository. External knowledge, web
                  search, and unsupported claims are never used as evidence.
                </p>
              </div>

              {/* Dynamic Validated Repository Dataset Status */}
              <div
                data-testid="active-dataset-status"
                className={
                  dataScope === "VERIFIED NASA PSI EXPERIMENTAL DATA"
                    ? "rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3.5 py-2 font-mono text-[10.5px] font-semibold tracking-wider text-emerald-200 uppercase"
                    : dataScope === "EMPTY"
                      ? "rounded-lg border border-rose-400/30 bg-rose-500/10 px-3.5 py-2 font-mono text-[10.5px] font-semibold tracking-wider text-rose-200 uppercase"
                      : "rounded-lg border border-amber-400/30 bg-amber-400/10 px-3.5 py-2 font-mono text-[10.5px] font-semibold tracking-wider text-amber-200 uppercase"
                }
              >
                {dataScope === "VERIFIED NASA PSI EXPERIMENTAL DATA"
                  ? "ACTIVE DATASET: VERIFIED NASA PSI EXPERIMENTAL DATA"
                  : dataScope === "EMPTY"
                    ? "ACTIVE DATASET: NO INDEXED RECORDS CONNECTED — ABSTENTION ACTIVE"
                    : "ACTIVE DATASET: DEMO FIXTURES — FICTIONAL DATA — NOT NASA MEASUREMENTS"}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <label
                  htmlFor="assistant-question-input"
                  className="font-mono text-[10.5px] font-semibold tracking-[.16em] text-[#52b6ff] uppercase"
                >
                  Ask Indexed Investigation Repository
                </label>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                <textarea
                  id="assistant-question-input"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      void submitQuestion(question, true);
                    }
                  }}
                  rows={2}
                  maxLength={1000}
                  placeholder="Ask about indexed investigations (e.g., Compare oxygen, pressure, and airflow of D-001 and D-004)..."
                  className="min-h-[58px] w-full flex-1 resize-y rounded-xl border border-white/15 bg-[#050b1b]/90 px-4 py-3 text-sm text-[#f4f8ff] placeholder:text-[#6a84a9] focus:border-[#36a9ff] focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={isLoading || question.trim().length === 0}
                  className="inline-flex h-[54px] shrink-0 items-center justify-center gap-2 rounded-xl bg-[linear-gradient(135deg,#0b3d91_0%,#ff5500_100%)] px-6 font-mono text-xs font-bold tracking-wider text-white uppercase shadow-[0_8px_24px_-6px_rgba(255,85,0,0.45)] transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {isLoading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  Ask Assistant
                </button>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[10px] text-[#7d95b8]">
                <span>Follow-up queries retrieve fresh repository evidence cleanly without turning prior chat answers into evidence.</span>
                <span>{question.length}/1000</span>
              </div>
            </form>
          </Card>
        </div>
      </main>

      <CitationEvidenceDrawer citation={activeCitation} onClose={() => setActiveCitation(null)} />
    </div>
  );
}
