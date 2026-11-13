/**
 * Isomorphic core of the backend client. Data is resolved in this order:
 *   1. an external backend, only when NEXT_PUBLIC_API_BASE is set (short timeout, cooldown after a failure);
 *   2. the app's own same-origin /api routes (browser only; they ship with the app, no extra process needed);
 *   3. the static JSON snapshots in /public/data (on the server these are read from disk).
 * The snapshot loader is injected so the server build can read from disk while the browser build uses fetch("/data/*.json").
 */
import type { DataSourceMode } from "@/lib/api/backend-types";

/** Optional external backend (same routes as /api). Empty by default: the built-in API is used. */
export const API_BASE = (process.env.NEXT_PUBLIC_API_BASE ?? "").trim().replace(/\/$/, "");
export const HAS_EXTERNAL_API = API_BASE.length > 0;
export const API_TIMEOUT_MS = 2500;
const LOCAL_TIMEOUT_MS = 10_000;
const COOLDOWN_MS = 15_000;
let liveDownUntil = 0;
let localDownUntil = 0;
const IS_BROWSER = typeof window !== "undefined";

export type Loaded<T> = { data: T; source: DataSourceMode };
export type SnapshotLoader = (file: string) => Promise<unknown>;

/** A definitive HTTP answer from an API (for example a 422 for invalid input); callers must not silently fall back from it. */
export class ApiHttpError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "ApiHttpError";
  }
}

async function request<T>(url: string, init: RequestInit | undefined, timeoutMs: number): Promise<T> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: ctl.signal, cache: "no-store", headers: { Accept: "application/json", ...init?.headers } });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { detail?: unknown } | null;
      const detail = typeof body?.detail === "string" ? body.detail : `API ${res.status}`;
      throw new ApiHttpError(res.status, detail);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

/** Call the external backend (NEXT_PUBLIC_API_BASE). Throws immediately when none is configured. */
export async function fetchLive<T>(path: string, init?: RequestInit, timeoutMs = API_TIMEOUT_MS): Promise<T> {
  if (!HAS_EXTERNAL_API) throw new Error("No external API configured (NEXT_PUBLIC_API_BASE is empty)");
  return request<T>(`${API_BASE}${path}`, init, timeoutMs);
}

/** Call the app's own /api routes (browser only). */
export async function fetchLocal<T>(path: string, init?: RequestInit, timeoutMs = LOCAL_TIMEOUT_MS): Promise<T> {
  if (!IS_BROWSER) throw new Error("same-origin API is only reachable from the browser");
  return request<T>(path, init, timeoutMs);
}

const isHardHttpError = (e: unknown) => e instanceof ApiHttpError && e.status >= 400 && e.status < 500 && e.status !== 404 && e.status !== 405;

/** External backend first (if configured), then the same-origin API. Throws when neither answers; definitive 4xx answers are rethrown. */
export async function fetchApi<T>(path: string, init?: RequestInit, timeoutMs = API_TIMEOUT_MS): Promise<Loaded<T>> {
  if (HAS_EXTERNAL_API && Date.now() >= liveDownUntil) {
    try {
      return { data: await fetchLive<T>(path, init, timeoutMs), source: "live" };
    } catch (e) {
      if (isHardHttpError(e)) throw e;
      liveDownUntil = Date.now() + COOLDOWN_MS;
    }
  }
  if (IS_BROWSER && Date.now() >= localDownUntil) {
    try {
      return { data: await fetchLocal<T>(path, init, Math.max(timeoutMs, LOCAL_TIMEOUT_MS)), source: "local" };
    } catch (e) {
      if (isHardHttpError(e)) throw e;
      localDownUntil = Date.now() + COOLDOWN_MS;
    }
  }
  throw new Error("No API answered");
}

/** External backend (if configured) -> optionally the same-origin API -> snapshot. `pick` extracts the right slice from the snapshot file. */
export async function loadWithFallback<T>(
  livePath: string,
  snapshotFile: string,
  loadSnapshot: SnapshotLoader,
  pick: (snapshot: unknown) => T = (s) => s as T,
  opts: { sameOrigin?: boolean } = {},
): Promise<Loaded<T>> {
  try {
    if (opts.sameOrigin) return await fetchApi<T>(livePath);
    if (HAS_EXTERNAL_API && Date.now() >= liveDownUntil) return { data: await fetchLive<T>(livePath), source: "live" };
  } catch {
    // fall through to the snapshot
    if (HAS_EXTERNAL_API && !opts.sameOrigin) liveDownUntil = Date.now() + COOLDOWN_MS;
  }
  const snap = await loadSnapshot(snapshotFile);
  return { data: pick(snap), source: "static" };
}

export function markLiveDown() {
  liveDownUntil = Date.now() + COOLDOWN_MS;
}
export function isLiveCoolingDown() {
  return Date.now() < liveDownUntil;
}
export function resetLiveCooldown() {
  liveDownUntil = 0;
  localDownUntil = 0;
}
