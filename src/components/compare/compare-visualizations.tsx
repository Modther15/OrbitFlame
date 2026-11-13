"use client";

import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  FileWarning,
  Grid3x3,
  Info,
  LineChart as LineChartIcon,
  Radar as RadarIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card } from "@/components/ui/card";
import type { DemoInvestigation } from "@/lib/api/schemas";
import {
  buildDocumentationRadarMetrics,
  buildEvidenceCoverageMetrics,
  inspectMeasurementTrends,
  prepareConditionChartSeries,
  type CompareRow,
  type ComparisonStatus,
  type ConditionChartPoint,
  type ConditionChartSeries,
  type DocumentationRadarDimension,
  type EvidenceCoverageItem,
} from "@/lib/science/compare";

type CompareVisualizationsProps = {
  records: DemoInvestigation[];
  matrixRows: CompareRow[];
};

const SERIES_COLORS = ["#36a9ff", "#ff8a32", "#a78bfa"] as const;
const CHART_ANIM_DURATION_MS = 1050;

const HEATMAP_STATUS_STYLES: Record<ComparisonStatus, { label: string; tileClass: string; dotClass: string }> = {
  EXACT_MATCH: {
    label: "EXACT MATCH",
    tileClass: "border-cyan-400/40 bg-cyan-400/15 text-cyan-200",
    dotClass: "bg-cyan-400",
  },
  DIFFERENT: {
    label: "DIFFERENT",
    tileClass: "border-[#ff8a32]/45 bg-[#ff8a32]/15 text-[#ffb067]",
    dotClass: "bg-[#ff8a32]",
  },
  PARTIALLY_COMPARABLE: {
    label: "PARTIALLY COMPARABLE",
    tileClass: "border-amber-300/40 bg-amber-400/12 text-amber-200",
    dotClass: "bg-amber-300",
  },
  UNKNOWN_NOT_REPORTED: {
    label: "UNKNOWN / NOT REPORTED",
    tileClass: "border-white/15 bg-white/[0.04] text-[#9cb2d2]",
    dotClass: "bg-[#6f88ad]",
  },
};

const emptySubscribe = () => () => {};

function useIsHydrated(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}

function subscribeReducedMotion(callback: () => void): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return () => {};
  }
  const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}

function getReducedMotionSnapshot(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    () => false,
  );
}

function subscribeCompactRadar(callback: () => void): () => void {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return () => {};
  }
  const mql = window.matchMedia("(max-width: 520px)");
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}

function getCompactRadarSnapshot(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia("(max-width: 520px)").matches;
}

function useIsCompactRadar(): boolean {
  return useSyncExternalStore(
    subscribeCompactRadar,
    getCompactRadarSnapshot,
    () => false,
  );
}

/**
 * Triggers once when an element enters the viewport for a given `resetKey`.
 * Disconnects immediately after intersection so minor scrolls never replay animations.
 */
function useViewportRevealOnce<T extends HTMLElement>(
  ref: React.RefObject<T | null>,
  resetKey: string,
): boolean {
  const [enteredState, setEnteredState] = useState<{ key: string; entered: boolean }>({
    key: "",
    entered: false,
  });

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    if (typeof IntersectionObserver === "undefined") {
      const raf = window.requestAnimationFrame(() => {
        setEnteredState({ key: resetKey, entered: true });
      });
      return () => window.cancelAnimationFrame(raf);
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setEnteredState({ key: resetKey, entered: true });
          observer.disconnect();
        }
      },
      { threshold: 0.01 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [ref, resetKey]);

  return enteredState.key === resetKey && enteredState.entered;
}

function countDecimalPlaces(num: number): number {
  const str = String(num);
  const dotIdx = str.indexOf(".");
  return dotIdx === -1 ? 0 : Math.min(4, str.length - dotIdx - 1);
}

function formatNumericDisplay(val: number, decimals: number): string {
  if (decimals === 0) return String(Math.round(val));
  return val.toFixed(decimals);
}

function CountUpNumber({
  target,
  active,
  reducedMotion,
  suffix = "",
  durationMs = CHART_ANIM_DURATION_MS,
}: {
  target: number;
  active: boolean;
  reducedMotion: boolean;
  suffix?: string;
  durationMs?: number;
}) {
  const decimals = useMemo(() => countDecimalPlaces(target), [target]);
  const [animated, setAnimated] = useState<{ target: number; value: number }>({
    target,
    value: 0,
  });

  useEffect(() => {
    if (!active || reducedMotion) return;

    let rafId = 0;
    let startTime: number | null = null;

    const tick = (now: number) => {
      if (startTime === null) startTime = now;
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      setAnimated({ target, value: progress >= 1 ? target : target * eased });
      if (progress < 1) {
        rafId = window.requestAnimationFrame(tick);
      }
    };

    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  }, [active, reducedMotion, target, durationMs]);

  if (reducedMotion) {
    return (
      <span>
        {formatNumericDisplay(target, decimals)}
        {suffix}
      </span>
    );
  }

  const currentVal = active && animated.target === target ? animated.value : 0;
  return (
    <span>
      {formatNumericDisplay(currentVal, decimals)}
      {suffix}
    </span>
  );
}

type ConditionTooltipProps = {
  active?: boolean;
  payload?: ReadonlyArray<{ payload: ConditionChartPoint }>;
  plottedUnit: string | null;
};

function ConditionChartTooltip({ active, payload, plottedUnit }: ConditionTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-xl border border-white/15 bg-[#040a1a]/95 p-3 text-xs text-[#f4f8ff] shadow-2xl backdrop-blur-md">
      <p className="font-mono text-[11px] font-bold text-[#ff8a32]">{point.recordId}</p>
      {point.missing ? (
        <p className="mt-1 font-mono font-semibold text-amber-300">NOT REPORTED (never coerced to 0)</p>
      ) : (
        <>
          <p className="mt-1 font-mono text-sm font-bold text-white">
            {point.originalDisplay}
            {point.unit ? ` ${point.unit}` : plottedUnit ? ` ${plottedUnit}` : ""}
          </p>
          {point.siDisplay && <p className="mt-0.5 font-mono text-[10px] text-[#8ea5c7]">SI: {point.siDisplay}</p>}
        </>
      )}
      <p className="mt-1.5 border-t border-white/10 pt-1 font-mono text-[9.5px] tracking-wider text-sky-300 uppercase">
        {point.isVerified ? "NASA VERIFIED DATA" : point.provenanceLabel}
      </p>
    </div>
  );
}

type CoverageTooltipProps = {
  active?: boolean;
  payload?: ReadonlyArray<{ payload: EvidenceCoverageItem }>;
};

function CoverageChartTooltip({ active, payload }: CoverageTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const item = payload[0].payload;
  return (
    <div className="rounded-xl border border-white/15 bg-[#040a1a]/95 p-3 text-xs text-[#f4f8ff] shadow-2xl backdrop-blur-md">
      <p className="font-semibold text-white">{item.label}</p>
      <p className="mt-1 font-mono text-sm font-bold text-[#36a9ff]">{item.availabilityPercent}% available</p>
      <p className="mt-0.5 font-mono text-[10px] text-[#9cb2d2]">{item.detail}</p>
      <p className="mt-1.5 border-t border-white/10 pt-1 text-[10px] text-[#7d95b8]">
        Documentation availability only — not quality or safety.
      </p>
    </div>
  );
}

type RadarTooltipProps = {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: DocumentationRadarDimension }>;
  colorByRecordId: Map<string, string>;
};

function RadarCoverageTooltip({ active, payload, colorByRecordId }: RadarTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  const dimension = payload[0]?.payload;
  if (!dimension) return null;

  return (
    <div className="max-w-[300px] rounded-xl border border-white/15 bg-[#040a1a]/95 p-3 text-xs text-[#f4f8ff] shadow-2xl backdrop-blur-md">
      <p className="font-mono text-[11px] font-bold tracking-wider text-[#52b6ff] uppercase">
        {dimension.label}
      </p>
      <div className="mt-2 space-y-2">
        {dimension.records.map((rec) => (
          <div key={rec.recordId} className="rounded-lg border border-white/10 bg-white/[0.03] p-2">
            <div className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-bold text-white">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: colorByRecordId.get(rec.recordId) ?? SERIES_COLORS[0] }}
                  aria-hidden="true"
                />
                {rec.recordId}
              </span>
              <span className="font-mono text-[11px] font-bold text-cyan-300">
                {rec.numerator}/{rec.denominator} ({rec.percentage}%)
              </span>
            </div>
            {rec.missingFields.length > 0 ? (
              <p className="mt-1 text-[10.5px] leading-snug text-amber-200">
                Missing: {rec.missingFields.join(", ")}
              </p>
            ) : (
              <p className="mt-1 text-[10.5px] text-emerald-300">All indexed fields populated</p>
            )}
          </div>
        ))}
      </div>
      <p className="mt-2 border-t border-white/10 pt-1.5 font-mono text-[9.5px] tracking-wider text-[#7d95b8] uppercase">
        DOCUMENTATION COVERAGE — NOT EXPERIMENTAL PERFORMANCE
      </p>
    </div>
  );
}

type PlottedConditionPoint = ConditionChartPoint & {
  barLabel: string | null;
  animatedValue: number | null;
};

function ConditionChartPanel({
  series,
  colorByRecordId,
  hydrated,
  revealActive,
  reducedMotion,
}: {
  series: ConditionChartSeries;
  colorByRecordId: Map<string, string>;
  hydrated: boolean;
  revealActive: boolean;
  reducedMotion: boolean;
}) {
  const missingPoints = series.points.filter((p) => p.missing);
  const allDemo = series.points.every((p) => p.isDemoFixture);
  const showTargetValues = reducedMotion || revealActive;

  const chartData = useMemo<PlottedConditionPoint[]>(
    () =>
      series.points.map((point) => ({
        ...point,
        // Never animate missing values as zero — keep them strictly null.
        animatedValue: point.missing ? null : showTargetValues ? point.plottedValue : 0,
        barLabel:
          point.missing || point.plottedValue === null
            ? null
            : showTargetValues
              ? `${point.plottedValue}`
              : null,
      })),
    [series.points, showTargetValues],
  );

  return (
    <div className="flex flex-col justify-between rounded-2xl border border-white/10 bg-[#060e22]/80 p-5">
      <div>
        <div className="flex flex-wrap items-start justify-between gap-2 border-b border-white/10 pb-3">
          <div>
            <h3 className="text-sm font-bold text-[#f4f8ff]">{series.label}</h3>
            <p className="mt-0.5 font-mono text-[10px] tracking-wider text-[#8ea5c7] uppercase">
              {!series.compatible
                ? "INCOMPATIBLE UNITS"
                : series.allMissing
                  ? "NO VALUES REPORTED"
                  : `UNIT: ${series.plottedUnit ?? "UNSPECIFIED"}`}
            </p>
          </div>
          <span className="rounded-full border border-sky-400/25 bg-sky-400/10 px-2.5 py-0.5 font-mono text-[9.5px] font-semibold tracking-wider text-sky-300">
            {allDemo ? "ILLUSTRATIVE DEMO" : "MIXED PROVENANCE"}
          </span>
        </div>

        {!series.compatible ? (
          <div className="mt-4 rounded-xl border border-amber-400/30 bg-amber-400/10 p-4 text-xs text-amber-100">
            <div className="flex items-center gap-2 font-mono text-[11px] font-bold text-amber-300 uppercase">
              <AlertTriangle size={14} aria-hidden="true" />
              Incompatible units — chart suppressed
            </div>
            <p className="mt-1.5 leading-5 text-amber-100/90">{series.incompatibilityReason}</p>
            <ul className="mt-3 space-y-1.5 border-t border-amber-300/20 pt-2.5 font-mono text-[11px]">
              {series.points.map((p) => (
                <li key={p.recordId} className="flex justify-between gap-2">
                  <span className="text-amber-200">{p.recordId}</span>
                  <span className="font-semibold text-white">
                    {p.missing ? "NOT REPORTED" : `${p.originalDisplay}${p.unit ? ` ${p.unit}` : " (no unit)"}`}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : series.allMissing ? (
          <div className="mt-4 flex min-h-[200px] flex-col items-center justify-center rounded-xl border border-white/10 bg-white/[0.02] p-4 text-center">
            <FileWarning size={20} className="text-amber-400" aria-hidden="true" />
            <p className="mt-2 font-mono text-xs font-bold tracking-wider text-amber-300 uppercase">NOT REPORTED</p>
            <p className="mt-1 max-w-[240px] text-xs text-[#8ea5c7]">
              No selected investigations report {series.label.toLocaleLowerCase()}. Missing values are never plotted as zero.
            </p>
          </div>
        ) : (
          <div className="mt-4 h-[215px] w-full">
            {hydrated ? (
              <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 300, height: 215 }}>
                <BarChart data={chartData} margin={{ top: 22, right: 12, left: -8, bottom: 4 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                  <XAxis
                    dataKey="recordId"
                    interval={0}
                    stroke="#8ea5c7"
                    tick={{ fill: "#d8e6fa", fontSize: 10.5, fontFamily: "var(--font-mono), monospace" }}
                    axisLine={{ stroke: "rgba(255,255,255,0.12)" }}
                    tickLine={false}
                  />
                  <YAxis
                    stroke="#8ea5c7"
                    tick={{ fill: "#8ea5c7", fontSize: 10, fontFamily: "var(--font-mono), monospace" }}
                    axisLine={false}
                    tickLine={false}
                    width={46}
                    unit={series.plottedUnit ? ` ${series.plottedUnit}` : ""}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(54,169,255,0.08)" }}
                    content={({ active, payload }) => (
                      <ConditionChartTooltip
                        active={active}
                        payload={payload as ReadonlyArray<{ payload: ConditionChartPoint }> | undefined}
                        plottedUnit={series.plottedUnit}
                      />
                    )}
                  />
                  <Bar
                    dataKey="animatedValue"
                    radius={[6, 6, 0, 0]}
                    maxBarSize={54}
                    isAnimationActive={!reducedMotion}
                    animationDuration={CHART_ANIM_DURATION_MS}
                    animationEasing="ease-out"
                  >
                    {chartData.map((point) => (
                      <Cell
                        key={point.recordId}
                        fill={colorByRecordId.get(point.recordId) ?? SERIES_COLORS[0]}
                        fillOpacity={point.missing ? 0 : 0.9}
                      />
                    ))}
                    <LabelList
                      dataKey="barLabel"
                      position="top"
                      fill="#dbeafe"
                      fontSize={10}
                      fontFamily="var(--font-mono), monospace"
                    />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full w-full rounded-xl bg-white/[0.02]" aria-hidden="true" />
            )}
          </div>
        )}
      </div>

      {/* Explicit missing & summary footer with synchronized count-up for real numeric values */}
      <div className="mt-3 border-t border-white/10 pt-3 text-[11px]">
        {missingPoints.length > 0 && !series.allMissing && (
          <p className="mb-1.5 font-mono text-amber-300">
            Not reported (omitted from axis): {missingPoints.map((p) => p.recordId).join(", ")}
          </p>
        )}
        <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] text-[#9cb2d2]">
          {series.points.map((p) => {
            const parsedNum = Number(p.originalDisplay);
            const isNumericPresent = !p.missing && Number.isFinite(parsedNum);
            return (
              <span key={p.recordId}>
                <strong style={{ color: colorByRecordId.get(p.recordId) }}>{p.recordId}:</strong>{" "}
                <span className={p.missing ? "text-amber-300" : "text-[#e6effc]"}>
                  {p.missing ? (
                    "NOT REPORTED"
                  ) : isNumericPresent ? (
                    <>
                      <CountUpNumber
                        target={parsedNum}
                        active={revealActive}
                        reducedMotion={reducedMotion}
                        suffix={p.unit ? ` ${p.unit}` : ""}
                      />
                    </>
                  ) : (
                    `${p.originalDisplay}${p.unit ? ` ${p.unit}` : ""}`
                  )}
                </span>
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function CompareVisualizations({ records, matrixRows }: CompareVisualizationsProps) {
  const hydrated = useIsHydrated();
  const reducedMotion = usePrefersReducedMotion();
  const compactRadar = useIsCompactRadar();
  const selectionKey = useMemo(() => records.map((r) => r.id).join(","), [records]);

  const conditionsRef = useRef<HTMLDivElement>(null);
  const radarRef = useRef<HTMLDivElement>(null);
  const coverageRef = useRef<HTMLDivElement>(null);

  const conditionsEntered = useViewportRevealOnce(conditionsRef, selectionKey);
  const radarEntered = useViewportRevealOnce(radarRef, selectionKey);
  const coverageEntered = useViewportRevealOnce(coverageRef, selectionKey);

  const colorByRecordId = useMemo(
    () => new Map(records.map((rec, idx) => [rec.id, SERIES_COLORS[idx % SERIES_COLORS.length]])),
    [records],
  );

  const conditionSeries = useMemo(() => {
    const keys: Array<"oxygen" | "pressure" | "airflow"> = ["oxygen", "pressure", "airflow"];
    return keys
      .map((k) => matrixRows.find((r) => r.key === k))
      .filter((r): r is CompareRow => Boolean(r))
      .map((row) => prepareConditionChartSeries(row));
  }, [matrixRows]);

  const coverageMetrics = useMemo(() => buildEvidenceCoverageMetrics(records, matrixRows), [records, matrixRows]);
  const radarMetrics = useMemo(() => buildDocumentationRadarMetrics(records, matrixRows), [records, matrixRows]);
  const trendsInspection = useMemo(() => inspectMeasurementTrends(records), [records]);

  const animatedCoverageData = useMemo(
    () =>
      coverageMetrics.map((item) => ({
        ...item,
        animatedPercent: reducedMotion || coverageEntered ? item.availabilityPercent : 0,
      })),
    [coverageMetrics, coverageEntered, reducedMotion],
  );

  const animatedRadarData = useMemo(
    () =>
      radarMetrics.map((dim) => ({
        ...dim,
        slotScores:
          reducedMotion || radarEntered
            ? dim.slotScores
            : Object.fromEntries(Object.keys(dim.slotScores).map((slotKey) => [slotKey, 0])),
      })),
    [radarMetrics, radarEntered, reducedMotion],
  );

  const heatmapCounts = useMemo(() => {
    const counts: Record<ComparisonStatus, number> = {
      EXACT_MATCH: 0,
      DIFFERENT: 0,
      PARTIALLY_COMPARABLE: 0,
      UNKNOWN_NOT_REPORTED: 0,
    };
    for (const row of matrixRows) {
      counts[row.status] += 1;
    }
    return counts;
  }, [matrixRows]);

  const hasDemoFixtures = records.some((r) => r.provenanceStatus === "DEMO_FIXTURE");

  return (
    <section aria-label="Scientific comparison visualizations" className="mt-6 space-y-6">
      {/* 1. Quantitative Experimental Conditions */}
      <div ref={conditionsRef}>
        <Card className="border border-white/10 bg-[#09152e]/85 p-6 backdrop-blur-md">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-4">
            <div>
              <span className="font-mono text-[10px] font-semibold tracking-[.16em] text-[#52b6ff] uppercase">
                VISUALIZATION 01 // QUANTITATIVE CONDITIONS
              </span>
              <h2 className="mt-1 flex items-center gap-2 text-lg font-extrabold tracking-tight text-[#f4f8ff]">
                <BarChart3 size={18} className="text-[#36a9ff]" aria-hidden="true" />
                Experimental Conditions Comparison
              </h2>
              <p className="mt-1 text-xs text-[#8ea5c7]">
                Separate physical scales for Oxygen, Pressure, and Airflow using verified unit rules only. Missing values
                are never plotted as zero.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {records.map((rec, idx) => (
                <span
                  key={rec.id}
                  className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-[#060e22]/90 px-3 py-1 font-mono text-[11px] font-semibold text-[#f4f8ff]"
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: SERIES_COLORS[idx % SERIES_COLORS.length] }}
                    aria-hidden="true"
                  />
                  {rec.id}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {conditionSeries.map((series) => (
              <ConditionChartPanel
                key={series.key}
                series={series}
                colorByRecordId={colorByRecordId}
                hydrated={hydrated}
                revealActive={conditionsEntered}
                reducedMotion={reducedMotion}
              />
            ))}
          </div>

          {hasDemoFixtures && (
            <p className="mt-4 flex items-center gap-2 font-mono text-[10.5px] text-amber-300">
              <Info size={13} className="shrink-0" aria-hidden="true" />
              Plotted condition bars represent fictional demo fixtures for interface testing — not NASA flight measurements.
            </p>
          )}
        </Card>
      </div>

      {/* 2. Documentation Coverage Radar (6 Deterministic Dimensions) */}
      <div>
        <Card
          data-testid="documentation-coverage-radar"
          className="border border-[#36a9ff]/25 bg-[#09152e]/85 p-6 backdrop-blur-md"
        >
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-4">
            <div>
              <span className="font-mono text-[10px] font-semibold tracking-[.16em] text-[#52b6ff] uppercase">
                VISUALIZATION 02 // SIX-DIMENSION DOCUMENTATION RADAR
              </span>
              <h2 className="mt-1 flex items-center gap-2 text-lg font-extrabold tracking-tight text-[#f4f8ff]">
                <RadarIcon size={18} className="text-[#ff8a32]" aria-hidden="true" />
                Documentation Coverage Radar
              </h2>
              <p className="mt-1 text-xs text-[#8ea5c7]">
                Compares normalized 0–100% repository documentation completeness across six schema dimensions for each
                selected investigation.
              </p>
            </div>
            <span className="rounded-full border border-amber-400/40 bg-amber-400/12 px-3 py-1 font-mono text-[10px] font-bold tracking-wider text-amber-200 uppercase">
              DOCUMENTATION COVERAGE — NOT EXPERIMENTAL PERFORMANCE
            </span>
          </div>

          <div ref={radarRef} className="mt-5 grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div className="h-[300px] w-full min-w-0 sm:h-[360px]">
              {hydrated ? (
                <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 420, height: 340 }}>
                  <RadarChart
                    cx="50%"
                    cy="48%"
                    outerRadius={compactRadar ? "48%" : "64%"}
                    margin={compactRadar ? { top: 14, right: 32, bottom: 14, left: 32 } : { top: 12, right: 24, bottom: 12, left: 24 }}
                    data={animatedRadarData}
                  >
                    <PolarGrid stroke="rgba(255,255,255,0.14)" />
                    <PolarAngleAxis
                      dataKey="shortLabel"
                      tick={{
                        fill: "#d8e6fa",
                        fontSize: compactRadar ? 9.5 : 11,
                        fontFamily: "var(--font-mono), monospace",
                      }}
                    />
                    <PolarRadiusAxis
                      angle={30}
                      domain={[0, 100]}
                      tickCount={5}
                      tick={{ fill: "#8ea5c7", fontSize: 9, fontFamily: "var(--font-mono), monospace" }}
                      stroke="rgba(255,255,255,0.12)"
                      tickFormatter={(v) => `${v}%`}
                    />
                    {records.map((rec, idx) => {
                      const color = SERIES_COLORS[idx % SERIES_COLORS.length];
                      return (
                        <Radar
                          key={rec.id}
                          name={rec.id}
                          dataKey={`slotScores.s${idx}`}
                          stroke={color}
                          fill={color}
                          fillOpacity={0.18}
                          strokeWidth={2}
                          dot={{ r: 3.5, fill: color, strokeWidth: 1.5, stroke: "#050b1b" }}
                          activeDot={{ r: 5, fill: color, stroke: "#ffffff", strokeWidth: 1.5 }}
                          isAnimationActive={!reducedMotion}
                          animationDuration={CHART_ANIM_DURATION_MS}
                          animationEasing="ease-out"
                        />
                      );
                    })}
                    <Legend
                      wrapperStyle={{
                        fontSize: "11px",
                        fontFamily: "var(--font-mono), monospace",
                        paddingTop: "6px",
                      }}
                    />
                    <Tooltip
                      content={({ active, payload }) => (
                        <RadarCoverageTooltip
                          active={active}
                          payload={payload as ReadonlyArray<{ payload?: DocumentationRadarDimension }> | undefined}
                          colorByRecordId={colorByRecordId}
                        />
                      )}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full w-full rounded-xl bg-white/[0.02]" aria-hidden="true" />
              )}
            </div>

            <div className="space-y-2.5 rounded-xl border border-white/10 bg-[#060e22]/80 p-4 text-xs">
              <p className="font-mono text-[10px] font-bold tracking-[.15em] text-[#52b6ff] uppercase">
                DIMENSION-BY-RECORD COVERAGE AUDIT
              </p>
              {radarMetrics.map((dim) => (
                <div
                  key={dim.key}
                  className="rounded-lg border border-white/8 bg-white/[0.02] p-2.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold text-[#f4f8ff]">{dim.label}</span>
                    <div className="flex flex-wrap items-center gap-2 font-mono text-[10.5px]">
                      {dim.records.map((rec, idx) => (
                        <span
                          key={rec.recordId}
                          className="inline-flex items-center gap-1 rounded border border-white/10 bg-[#040a1a] px-2 py-0.5"
                        >
                          <span
                            className="h-1.5 w-1.5 rounded-full"
                            style={{ backgroundColor: SERIES_COLORS[idx % SERIES_COLORS.length] }}
                            aria-hidden="true"
                          />
                          <span className="text-[#c2d5ee]">{rec.recordId}:</span>
                          <span className={rec.percentage === 100 ? "font-bold text-cyan-300" : "font-bold text-[#ffb067]"}>
                            {rec.numerator}/{rec.denominator} (
                            <CountUpNumber
                              target={rec.percentage}
                              active={radarEntered}
                              reducedMotion={reducedMotion}
                              suffix="%"
                            />
                            )
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      {/* 3. Aggregate Evidence Coverage & 4. Measurement Trends */}
      <div className="grid gap-6 xl:grid-cols-[1.25fr_.75fr]">
        <div ref={coverageRef}>
          <Card className="h-full border border-white/10 bg-[#09152e]/85 p-6 backdrop-blur-md">
            <div className="border-b border-white/10 pb-4">
              <span className="font-mono text-[10px] font-semibold tracking-[.16em] text-[#ff8a32] uppercase">
                VISUALIZATION 03 // DOCUMENTATION COMPLETENESS
              </span>
              <h2 className="mt-1 text-lg font-extrabold tracking-tight text-[#f4f8ff]">Evidence Coverage Breakdown</h2>
              <p className="mt-1 text-xs text-[#8ea5c7]">
                Percentage of indexed fields populated across the selected records. Reflects data availability only — NOT
                experimental success, quality, or fire safety.
              </p>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-[1.15fr_.85fr] md:items-center">
              <div className="h-[250px] w-full">
                {hydrated ? (
                  <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 360, height: 250 }}>
                    <BarChart
                      data={animatedCoverageData}
                      layout="vertical"
                      margin={{ top: 6, right: 20, left: 6, bottom: 6 }}
                    >
                      <CartesianGrid stroke="rgba(255,255,255,0.08)" horizontal={false} />
                      <XAxis
                        type="number"
                        domain={[0, 100]}
                        unit="%"
                        stroke="#8ea5c7"
                        tick={{ fill: "#8ea5c7", fontSize: 10, fontFamily: "var(--font-mono), monospace" }}
                        axisLine={{ stroke: "rgba(255,255,255,0.12)" }}
                        tickLine={false}
                      />
                      <YAxis
                        type="category"
                        dataKey="label"
                        width={142}
                        stroke="#8ea5c7"
                        tick={{ fill: "#e6effc", fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        cursor={{ fill: "rgba(54,169,255,0.08)" }}
                        content={({ active, payload }) => (
                          <CoverageChartTooltip
                            active={active}
                            payload={payload as ReadonlyArray<{ payload: EvidenceCoverageItem }> | undefined}
                          />
                        )}
                      />
                      <Bar
                        dataKey="animatedPercent"
                        radius={[0, 6, 6, 0]}
                        maxBarSize={20}
                        isAnimationActive={!reducedMotion}
                        animationDuration={CHART_ANIM_DURATION_MS}
                        animationEasing="ease-out"
                      >
                        {animatedCoverageData.map((item) => (
                          <Cell
                            key={item.key}
                            fill={
                              item.availabilityPercent === 100
                                ? "#36a9ff"
                                : item.availabilityPercent > 0
                                  ? "#ff8a32"
                                  : "#334155"
                            }
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full w-full rounded-xl bg-white/[0.02]" aria-hidden="true" />
                )}
              </div>

              <dl className="space-y-2.5 rounded-xl border border-white/10 bg-[#060e22]/80 p-4 text-xs">
                {coverageMetrics.map((item) => (
                  <div
                    key={item.key}
                    className="flex items-center justify-between gap-2 border-b border-white/5 pb-2 last:border-b-0 last:pb-0"
                  >
                    <dt className="text-[#c2d5ee]">{item.label}</dt>
                    <dd className="text-right font-mono text-[11px]">
                      <span
                        className={
                          item.availabilityPercent === 100
                            ? "font-bold text-cyan-300"
                            : item.availabilityPercent > 0
                              ? "font-bold text-[#ffb067]"
                              : "text-[#7d95b8]"
                        }
                      >
                        <CountUpNumber
                          target={item.availabilityPercent}
                          active={coverageEntered}
                          reducedMotion={reducedMotion}
                          suffix="%"
                        />
                      </span>
                      <span className="ml-1.5 text-[10px] text-[#7d95b8]">
                        ({item.availableCount}/{item.totalCount})
                      </span>
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </Card>
        </div>

        {/* 4. Measurement Trends */}
        <Card className="flex flex-col justify-between border border-white/10 bg-[#09152e]/85 p-6 backdrop-blur-md">
          <div>
            <div className="border-b border-white/10 pb-4">
              <span className="font-mono text-[10px] font-semibold tracking-[.16em] text-[#52b6ff] uppercase">
                VISUALIZATION 04 // TIME-SERIES TRENDS
              </span>
              <h2 className="mt-1 flex items-center gap-2 text-lg font-extrabold tracking-tight text-[#f4f8ff]">
                <LineChartIcon size={18} className="text-[#ff8a32]" aria-hidden="true" />
                Measurement Trends
              </h2>
            </div>

            {!trendsInspection.available ? (
              <div className="mt-5 flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/15 bg-[#060e22]/75 p-6 text-center">
                <Activity size={24} className="text-amber-400" aria-hidden="true" />
                <p className="mt-3 font-mono text-xs font-bold tracking-wider text-amber-300 uppercase">
                  TREND VISUALIZATION UNAVAILABLE
                </p>
                <p className="mt-2 text-xs leading-5 text-[#9cb2d2]">{trendsInspection.reason}</p>
                <div className="mt-4 flex flex-wrap justify-center gap-2 font-mono text-[10px] text-[#7d95b8]">
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">
                    {trendsInspection.totalMeasurements} recorded measurements
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1">
                    {trendsInspection.timestampedSeriesCount} timestamped series
                  </span>
                </div>
              </div>
            ) : (
              <div className="mt-5 rounded-xl border border-white/10 bg-[#060e22]/75 p-4 text-xs text-[#d8e6fa]">
                {trendsInspection.reason}
              </div>
            )}
          </div>

          <p className="mt-4 border-t border-white/10 pt-3 font-mono text-[10px] text-[#7d95b8]">
            Strict rule: time-series plots require real timestamped telemetry and explicitly known physical units.
          </p>
        </Card>
      </div>

      {/* 5. Comparison Status Heatmap (11 Dimensions from Deterministic Matrix) */}
      <Card className="border border-white/10 bg-[#09152e]/85 p-6 backdrop-blur-md">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <span className="font-mono text-[10px] font-semibold tracking-[.16em] text-[#52b6ff] uppercase">
              VISUALIZATION 05 // 11-DIMENSION STATUS HEATMAP
            </span>
            <h2 className="mt-1 flex items-center gap-2 text-lg font-extrabold tracking-tight text-[#f4f8ff]">
              <Grid3x3 size={18} className="text-[#36a9ff]" aria-hidden="true" />
              Comparison Status Heatmap
            </h2>
            <p className="mt-1 text-xs text-[#8ea5c7]">
              Visualizes all 11 deterministic comparison relationships directly from the active comparison matrix.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(HEATMAP_STATUS_STYLES) as ComparisonStatus[]).map((statusKey) => {
              const style = HEATMAP_STATUS_STYLES[statusKey];
              return (
                <span
                  key={statusKey}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[9.5px] font-semibold tracking-wider ${style.tileClass}`}
                >
                  <span className={`h-1.5 w-1.5 rounded-full ${style.dotClass}`} aria-hidden="true" />
                  {`${style.label} (${heatmapCounts[statusKey]})`}
                </span>
              );
            })}
          </div>
        </div>

        <div className="mt-5 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {matrixRows.map((row) => {
            const style = HEATMAP_STATUS_STYLES[row.status];
            return (
              <div
                key={`hm-${row.key}`}
                data-heatmap-dimension={row.key}
                className="flex flex-col justify-between rounded-xl border border-white/10 bg-[#060e22]/85 p-3.5 transition-colors hover:border-white/20"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-xs font-bold text-[#f4f8ff]">{row.label}</span>
                    <span className={`mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full ${style.dotClass}`} aria-hidden="true" />
                  </div>
                  <span
                    className={`mt-2 inline-block rounded-md border px-2 py-0.5 font-mono text-[9.5px] font-semibold tracking-wider ${style.tileClass}`}
                  >
                    {style.label}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5 border-t border-white/8 pt-2.5">
                  {row.cells.map((cell) => {
                    const cellClass =
                      cell.missingStatus === "NOT_REPORTED"
                        ? "border-amber-400/25 bg-amber-400/8 text-amber-300"
                        : cell.isVerified
                          ? "border-emerald-400/30 bg-emerald-400/12 text-emerald-300"
                          : "border-white/12 bg-white/[0.04] text-[#d8e6fa]";
                    return (
                      <span
                        key={`hm-cell-${row.key}-${cell.recordId}`}
                        title={`${cell.recordId}: ${cell.displayValue}${cell.unit ? ` ${cell.unit}` : ""} (${cell.provenanceLabel})`}
                        className={`inline-flex items-center gap-1 rounded px-2 py-0.5 font-mono text-[10px] border ${cellClass}`}
                      >
                        {cell.isVerified && <CheckCircle2 size={9} aria-hidden="true" />}
                        {cell.recordId}:{" "}
                        {cell.missingStatus === "NOT_REPORTED"
                          ? "N/R"
                          : cell.missingStatus === "PARTIAL"
                            ? "PARTIAL"
                            : "PRESENT"}
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </section>
  );
}
