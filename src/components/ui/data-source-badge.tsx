"use client";

import { Radio, DatabaseZap } from "lucide-react";
import { useEffect, useState } from "react";
import { probeBackend } from "@/lib/api/backend-client";
import { BENCHMARK_NOTE, type DataSourceMode } from "@/lib/api/backend-types";

/** One compact status badge: live FlameGuard API vs. static snapshot, with real row / investigation counts from the API. */
export function DataSourceBadge({ className = "" }: { className?: string }) {
  const [state, setState] = useState<{ mode: DataSourceMode | "checking"; rows?: number; investigations?: number; files?: string[] }>({ mode: "checking" });

  useEffect(() => {
    let alive = true;
    probeBackend()
      .then(async ({ data, source }) => {
        let inv = data.investigation_count;
        try {
          const meta = (await (await fetch("/data/meta.json", { cache: "force-cache" })).json()) as { investigations_with_metadata?: number };
          if (typeof meta.investigations_with_metadata === "number") inv = meta.investigations_with_metadata;
        } catch {
          /* keep API count */
        }
        if (alive) setState({ mode: source, rows: data.row_count, investigations: inv, files: data.source_files });
      })
      .catch(() => alive && setState({ mode: "fixture" }));
    return () => {
      alive = false;
    };
  }, []);

  const live = state.mode === "live";
  const prefix = state.mode === "checking" ? "CHECKING DATA SOURCE" : live ? "LIVE API" : state.mode === "static" ? "STATIC SNAPSHOT" : "OFFLINE";
  const counts = state.rows !== undefined ? ` · ${state.rows.toLocaleString("en-US")} NASA PSI Rows` : "";
  return (
    <div className={`rounded-xl border border-white/10 bg-[#060e22]/80 p-3 ${className}`} title={BENCHMARK_NOTE} data-testid="data-source-badge">
      <span
        className={`inline-flex items-start gap-1.5 rounded-lg border px-2.5 py-1 font-mono text-[10px] leading-4 font-bold tracking-[.06em] ${
          live ? "border-emerald-400/35 bg-emerald-400/15 text-emerald-300" : "border-amber-400/35 bg-amber-400/10 text-amber-300"
        }`}
      >
        {live ? <Radio size={11} className="mt-0.5 shrink-0" aria-hidden="true" /> : <DatabaseZap size={11} className="mt-0.5 shrink-0" aria-hidden="true" />}
        <span>{prefix}{counts}</span>
      </span>
      {state.files && state.files.length > 0 && (
        <details className="mt-1.5">
          <summary className="cursor-pointer font-mono text-[9px] text-[#52b6ff]">Source files ({state.files.length})</summary>
          <ul className="mt-1 max-h-40 overflow-auto font-mono text-[8.5px] leading-3.5 text-[#6a84a9]">
            {state.files.map((f) => (
              <li key={f} className="break-all">{f}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
