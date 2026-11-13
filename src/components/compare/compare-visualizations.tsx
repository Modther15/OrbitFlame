"use client";

import {
  AlertTriangle,
  BarChart3,
  FileWarning,
  Info,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card } from "@/components/ui/card";
import type { DemoInvestigation } from "@/lib/api/schemas";
import {
  prepareConditionChartSeries,
  type CompareRow,
  type ConditionChartPoint,
  type ConditionChartSeries,
} from "@/lib/science/compare";

type CompareVisualizationsProps = {
  records: DemoInvestigation[];
  matrixRows: CompareRow[];
};

const SERIES_COLORS = ["#36a9ff", "#ff8a32", "#a78bfa"] as const;
const CHART_ANIM_DURATION_MS = 1050;

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
        <p className="mt-1 font-mono font-semibold text-amber-300">Not reported</p>
      ) : (
        <>
          <p className="mt-1 font-mono text-sm font-bold text-white">
            {point.originalDisplay}
            {point.unit ? ` ${point.unit}` : plottedUnit ? ` ${plottedUnit}` : ""}
          </p>
          {point.siDisplay && <p className="mt-0.5 font-mono text-[10px] text-[#8ea5c7]">SI: {point.siDisplay}</p>}
        </>
      )}
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
  const showTargetValues = reducedMotion || revealActive;
  // Fixed axis domain from the TARGET values so the ticks do not collapse to "0" while the bars are still animating from 0.
  const yMax = useMemo(() => {
    const m = Math.max(0, ...series.points.map((p) => (p.missing || p.plottedValue === null ? 0 : p.plottedValue)));
    if (m <= 0) return 1;
    const mag = 10 ** Math.floor(Math.log10(m));
    const f = m / mag;
    return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * mag;
  }, [series.points]);

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
                    domain={[0, yMax]}
                    tickCount={5}
                    tickFormatter={(v: number) => String(Number(v.toFixed(2)))}
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
  const selectionKey = useMemo(() => records.map((r) => r.id).join(","), [records]);

  const conditionsRef = useRef<HTMLDivElement>(null);

  const conditionsEntered = useViewportRevealOnce(conditionsRef, selectionKey);

  const colorByRecordId = useMemo(
    () => new Map(records.map((rec, idx) => [rec.id, SERIES_COLORS[idx % SERIES_COLORS.length]])),
    [records],
  );

  const conditionSeries = useMemo(() => {
    const keys: Array<"oxygen" | "pressure" | "airflow"> = ["oxygen", "pressure", "airflow"];
    return keys
      .map((k) => matrixRows.find((r) => r.key === k))
      .filter((r): r is CompareRow => Boolean(r))
      .map((row) => prepareConditionChartSeries(row))
      // A chart with no reported value for any selected investigation carries no information; the comparison table already shows "—".
      .filter((series) => !(series.compatible && series.allMissing));
  }, [matrixRows]);


  const hasDemoFixtures = records.some((r) => r.provenanceStatus === "DEMO_FIXTURE");

  if (conditionSeries.length === 0) return null;
  return (
    <section aria-label="Scientific comparison visualizations" className="mt-6 space-y-6">
      {/* 1. Quantitative Experimental Conditions */}
      <div ref={conditionsRef}>
        <Card className="border border-white/10 bg-[#09152e]/85 p-6 backdrop-blur-md">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-4">
            <div>
              <h2 className="mt-1 flex items-center gap-2 text-lg font-extrabold tracking-tight text-[#f4f8ff]">
                <BarChart3 size={18} className="text-[#36a9ff]" aria-hidden="true" />
                Experimental Conditions Comparison
              </h2>
              <p className="mt-1 text-xs text-[#8ea5c7]">Oxygen, pressure and airflow ranges reported by each selected investigation.</p>
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

          <div className={`mt-5 grid gap-5 md:grid-cols-2 ${conditionSeries.length >= 3 ? "xl:grid-cols-3" : ""}`}>
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
    </section>
  );
}
