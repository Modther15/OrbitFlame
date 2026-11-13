/**
 * Isomorphic core of the backend client. Tries the live FlameGuard API first (short timeout) and
 * falls back to the static JSON snapshots in /public/data. The snapshot loader is injected so the
 * server build can read from disk while the browser build uses fetch("/data/*.json").
 */
import type { DataSourceMode } from "@/lib/api/backend-types";

export const API_BASE = (process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000").replace(/\/$/, "");
export const API_TIMEOUT_MS = 2500;
const COOLDOWN_MS = 15_000;
let liveDownUntil = 0;

export type Loaded<T> = { data: T; source: DataSourceMode };
export type SnapshotLoader = (file: string) => Promise<unknown>;

export async function fetchLive<T>(path: string, init?: RequestInit, timeoutMs = API_TIMEOUT_MS): Promise<T> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(`${API_BASE}${path}`, { ...init, signal: ctl.signal, cache: "no-store", headers: { Accept: "application/json", ...init?.headers } });
    if (!res.ok) throw new Error(`API ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

/** Live API first, then snapshot. `pick` extracts the right slice from the snapshot file. */
export async function loadWithFallback<T>(
  livePath: string,
  snapshotFile: string,
  loadSnapshot: SnapshotLoader,
  pick: (snapshot: unknown) => T = (s) => s as T,
): Promise<Loaded<T>> {
  if (Date.now() >= liveDownUntil) {
    try {
      return { data: await fetchLive<T>(livePath), source: "live" };
    } catch {
      liveDownUntil = Date.now() + COOLDOWN_MS;
    }
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
}
