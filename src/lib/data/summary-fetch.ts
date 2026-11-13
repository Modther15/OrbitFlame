"use client";
import type { DemoInvestigation } from "@/lib/api/schemas";

const cache = new Map<string, Promise<DemoInvestigation | null>>();

/** Full record (with testRuns/measurements) for one id; the same-origin route handles live-API -> static fallback. Cached per id. */
export function fetchFullInvestigation(id: string): Promise<DemoInvestigation | null> {
  let p = cache.get(id);
  if (!p) {
    p = fetch(`/api/investigations/${encodeURIComponent(id)}`)
      .then((r) => (r.ok ? (r.json() as Promise<DemoInvestigation>) : null))
      .catch(() => null);
    p.then((v) => { if (!v) cache.delete(id); });
    cache.set(id, p);
  }
  return p;
}
