import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { AssistantRequestSchema } from "@/lib/assistant/assistant-response-schema";
import { runAssistantPipeline, type AssistantLlmProvider } from "@/lib/assistant/assistant-provider";
import type { InvestigationRepository } from "@/lib/data/repository";

const MAX_REQUEST_BYTES = 16_384;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 20;

const ipBuckets = new Map<string, number[]>();

export function resetAssistantRateLimitForTests(): void {
  ipBuckets.clear();
}

function getClientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }
  return request.headers.get("x-real-ip")?.trim() || "local-client";
}

function checkRateLimit(clientKey: string, nowMs = Date.now()): { allowed: boolean; retryAfterSec: number } {
  const windowStart = nowMs - RATE_LIMIT_WINDOW_MS;
  const timestamps = (ipBuckets.get(clientKey) ?? []).filter((ts) => ts > windowStart);

  if (timestamps.length >= RATE_LIMIT_MAX_REQUESTS) {
    const oldest = timestamps[0] ?? nowMs;
    const retryAfterSec = Math.max(1, Math.ceil((oldest + RATE_LIMIT_WINDOW_MS - nowMs) / 1000));
    ipBuckets.set(clientKey, timestamps);
    return { allowed: false, retryAfterSec };
  }

  timestamps.push(nowMs);
  ipBuckets.set(clientKey, timestamps);
  return { allowed: true, retryAfterSec: 0 };
}

export async function handleAssistantPost(
  request: Request,
  options?: {
    repository?: InvestigationRepository;
    provider?: AssistantLlmProvider;
    maxRequestBytes?: number;
  },
): Promise<NextResponse> {
  const requestId = crypto.randomUUID();
  const maxBytes = options?.maxRequestBytes ?? MAX_REQUEST_BYTES;

  const clientKey = getClientKey(request);
  const limit = checkRateLimit(clientKey);
  if (!limit.allowed) {
    return NextResponse.json(
      {
        code: "RATE_LIMITED",
        message: "Too many assistant requests from this client. Wait briefly and retry.",
        requestId,
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(limit.retryAfterSec),
          "Cache-Control": "no-store",
        },
      },
    );
  }

  const contentLengthHeader = request.headers.get("content-length");
  if (contentLengthHeader) {
    const declaredBytes = Number(contentLengthHeader);
    if (Number.isFinite(declaredBytes) && declaredBytes > maxBytes) {
      return NextResponse.json(
        {
          code: "PAYLOAD_TOO_LARGE",
          message: `Request body exceeds the ${maxBytes}-byte limit.`,
          requestId,
        },
        { status: 413, headers: { "Cache-Control": "no-store" } },
      );
    }
  }

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json(
      {
        code: "INVALID_REQUEST",
        message: "Unable to read request body.",
        requestId,
      },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  if (Buffer.byteLength(rawBody, "utf8") > maxBytes) {
    return NextResponse.json(
      {
        code: "PAYLOAD_TOO_LARGE",
        message: `Request body exceeds the ${maxBytes}-byte limit.`,
        requestId,
      },
      { status: 413, headers: { "Cache-Control": "no-store" } },
    );
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawBody);
  } catch {
    return NextResponse.json(
      {
        code: "INVALID_JSON",
        message: "Request body must be valid JSON.",
        requestId,
      },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const validated = AssistantRequestSchema.safeParse(parsedJson);
  if (!validated.success) {
    const issueMessage = validated.error instanceof z.ZodError ? validated.error.issues[0]?.message : undefined;
    return NextResponse.json(
      {
        code: "INVALID_REQUEST",
        message: issueMessage || "Request payload failed schema validation.",
        requestId,
      },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const { httpStatus, body } = await runAssistantPipeline(validated.data, {
    repository: options?.repository,
    provider: options?.provider,
    signal: request.signal,
  });

  return NextResponse.json(body, {
    status: httpStatus,
    headers: { "Cache-Control": "no-store" },
  });
}
