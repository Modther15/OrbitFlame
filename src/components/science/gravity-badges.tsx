import { actualGravityText, actualGravityTitle, effectiveGravityText, effectiveGravityTitle, isProxyMethod, type GravityParts } from "@/lib/science/gravity";

/** Two small badges: ACTUAL gravity (flight 0 g / ground 1 g) and EFFECTIVE gravity (direct or heuristic proxy). Tooltips carry method + caveat. */
export function GravityBadges({ parts, compact = false, short = false, className = "" }: { parts: GravityParts; compact?: boolean; short?: boolean; className?: string }) {
  if (parts.actualG === null && parts.effG === null) return null;
  const proxy = isProxyMethod(parts.method);
  const aTxt = actualGravityText(parts.actualG, parts.source);
  const eTxt = effectiveGravityText(parts.effG, parts.method);
  return (
    <span className={`inline-flex flex-wrap items-center gap-1.5 ${className}`} data-testid="gravity-badges">
      <span
        title={short ? "Actual gravity: ISS/Cygnus flight baseline (0.0 g, inferred) or ground tag (1.0 g)" : actualGravityTitle(parts.actualG, parts.source)}
        className="inline-flex items-center rounded-full border border-[#36a9ff]/35 bg-[#36a9ff]/10 px-2 py-0.5 font-mono text-[10px] font-semibold tracking-wide text-[#7bc5ff]"
      >
        {compact ? aTxt.replace("Actual gravity: ", "Actual: ") : aTxt}
      </span>
      {parts.effG !== null && (
        <span
          title={short ? (proxy ? `Method: ${parts.method} (HEURISTIC PROXY, not measured gravity; caveat on the investigation page)` : "direct = actual gravity") : effectiveGravityTitle(parts.method)}
          className={`inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-[10px] font-semibold tracking-wide ${
            proxy ? "border-amber-400/40 bg-amber-400/10 text-amber-300" : "border-white/20 bg-white/[0.05] text-[#c4d7f2]"
          }`}
        >
          {compact ? eTxt.replace("Effective gravity: ", "Effective: ") : eTxt}
          {proxy ? " · heuristic" : ""}
        </span>
      )}
    </span>
  );
}

type Info = { actualG: number | null; source: string | null; conflict?: string | null; note?: string | null; nProxyRows: number; proxyBins: Record<string, number> };

/** Investigation-level variant (cards, detail header): actual gravity + how many rows carry the effective-gravity proxy. */
export function InvestigationGravityBadges({ info, totalRows, className = "" }: { info: Info | undefined; totalRows: number; className?: string }) {
  if (!info) return null;
  const bins = Object.entries(info.proxyBins).map(([b, n]) => `${b.replace("_eq", "")} ${n}`).join(", ");
  return (
    <span className={`inline-flex flex-wrap items-center gap-1.5 ${className}`} data-testid="investigation-gravity-badges">
      {info.conflict === "conflict" ? (
        <span
          title={`${info.note ?? ""} The 0.0 g value is the user-stated ISS/Cygnus baseline, not a statement in this PSI record.`}
          className="inline-flex items-center rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 font-mono text-[10px] font-semibold tracking-wide text-amber-300"
        >
          Actual gravity: 0.0 g baseline (user-stated; PSI record = ground investigation)
        </span>
      ) : (
        <span
          title={actualGravityTitle(info.actualG, info.source)}
          className="inline-flex items-center rounded-full border border-[#36a9ff]/35 bg-[#36a9ff]/10 px-2 py-0.5 font-mono text-[10px] font-semibold tracking-wide text-[#7bc5ff]"
        >
          {actualGravityText(info.actualG, info.source)}
        </span>
      )}
      {info.nProxyRows > 0 ? (
        <span title={effectiveGravityTitle("convective_velocity_equivalence")} className="inline-flex items-center rounded-full border border-amber-400/40 bg-amber-400/10 px-2 py-0.5 font-mono text-[10px] font-semibold tracking-wide text-amber-300">
          Effective gravity proxy: {info.nProxyRows}/{totalRows} rows ({bins}) · heuristic
        </span>
      ) : (
        totalRows > 0 && (
          <span title={effectiveGravityTitle("direct")} className="inline-flex items-center rounded-full border border-white/20 bg-white/[0.05] px-2 py-0.5 font-mono text-[10px] font-semibold tracking-wide text-[#c4d7f2]">
            Effective gravity: direct (= actual)
          </span>
        )
      )}
    </span>
  );
}
