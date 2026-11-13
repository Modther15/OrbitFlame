"use client";

import { Radio, DatabaseZap } from "lucide-react";
import { useEffect, useState } from "react";
import { probeBackend } from "@/lib/api/backend-client";
import { BENCHMARK_NOTE, BENCHMARK_SOURCE_LABEL, type DataSourceMode } from "@/lib/api/backend-types";

/** Small badge: live FlameGuard API vs. static snapshot, plus the dataset provenance label. */
export function DataSourceBadge({ className = "" }: { className?: string }) {
  const [state, setState] = useState<{ mode: DataSourceMode | "checking"; label: string; generated?: string; rows?: number; files?: string[] }>({ mode: "checking", label: BENCHMARK_SOURCE_LABEL });

  useEffect(() => {
    let alive = true;
    probeBackend()
      .then(({ data, source }) => alive && setState({ mode: source, label: data.source_label || BENCHMARK_SOURCE_LABEL, generated: data.generated, rows: data.row_count, files: data.source_files }))
      .catch(() => alive && setState({ mode: "fixture", label: "Snapshot unavailable" }));
    return () => {
      alive = false;
    };
  }, []);

  const live = state.mode === "live";
  const text = state.mode === "checking" ? "CHECKING DATA SOURCE" : live ? "LIVE API" : state.mode === "static" ? "STATIC SNAPSHOT" : "OFFLINE FIXTURES";
  return (
    <div className={`rounded-xl border border-white/10 bg-[#060e22]/80 p-3 ${className}`} title={BENCHMARK_NOTE} data-testid="data-source-badge">
      <span
        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[9.5px] font-bold tracking-[.12em] ${
          live ? "border-emerald-400/35 bg-emerald-400/15 text-emerald-300" : "border-amber-400/35 bg-amber-400/10 text-amber-300"
        }`}
      >
        {live ? <Radio size={11} aria-hidden="true" /> : <DatabaseZap size={11} aria-hidden="true" />}
        {text}
      </span>
      <p className="mt-1.5 text-[10px] leading-4 text-[#8ea5c7]">{state.label}</p>
      <p className="font-mono text-[9px] leading-4 text-[#6a84a9]">
        {state.rows !== undefined ? `${state.rows.toLocaleString("en-US")} real rows · ${state.files?.length ?? 0} source files` : BENCHMARK_SOURCE_LABEL}
      </p>
      {state.files && state.files.length > 0 && (
        <details className="mt-1">
          <summary className="cursor-pointer font-mono text-[9px] text-[#52b6ff]">Source files</summary>
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
