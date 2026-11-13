"use client";

import type {
  EvidenceClassification,
  HabitatDefinition,
  MissionMatchResult,
  ParameterAlignmentStatus,
} from "@/lib/science/mission-matcher";

const STATUS_STROKE: Record<ParameterAlignmentStatus, { color: string; dash?: string; badge: string }> = {
  AGREES: { color: "#36a9ff", badge: "AGREES" },
  DIFFERS: { color: "#ff8a32", dash: "5 4", badge: "DIFFERS" },
  MISSING_IN_RECORD: { color: "#6a84a9", dash: "2 4", badge: "MISSING" },
  INCOMPATIBLE: { color: "#fb7185", dash: "4 2", badge: "INCOMPAT" },
  NOT_SPECIFIED: { color: "#334766", dash: "3 5", badge: "UNSET" },
};

const CLASS_STYLE: Record<EvidenceClassification, { stroke: string; fill: string; text: string }> = {
  DIRECT: { stroke: "#34d399", fill: "rgba(16, 185, 129, 0.16)", text: "#6ee7b7" },
  ANALOGOUS: { stroke: "#f59e0b", fill: "rgba(245, 158, 11, 0.16)", text: "#fcd34d" },
  MECHANISM_ONLY: { stroke: "#38bdf8", fill: "rgba(56, 189, 248, 0.14)", text: "#7dd3fc" },
  PLANNED: { stroke: "#818cf8", fill: "rgba(129, 140, 248, 0.14)", text: "#c7d2fe" },
  UNAVAILABLE: { stroke: "#94a3b8", fill: "rgba(148, 163, 184, 0.12)", text: "#cbd5e1" },
};

export function MissionPathwaySvg({
  habitat,
  activeMatch,
  overallHighestEvidence,
}: {
  habitat: HabitatDefinition;
  activeMatch: MissionMatchResult | null;
  overallHighestEvidence: EvidenceClassification;
}) {
  const displayParams = activeMatch
    ? activeMatch.parameters.slice(0, 6)
    : [
        { key: "gravity", label: "Gravity Environment", status: "MISSING_IN_RECORD" as const },
        { key: "safety_domain", label: "Safety Domain", status: "NOT_SPECIFIED" as const },
        { key: "material", label: "Combustion Material", status: "NOT_SPECIFIED" as const },
        { key: "oxygen", label: "Oxygen Concentration", status: "NOT_SPECIFIED" as const },
        { key: "pressure", label: "Ambient Pressure", status: "NOT_SPECIFIED" as const },
        { key: "airflow", label: "Forced Airflow", status: "NOT_SPECIFIED" as const },
      ];

  const cls: EvidenceClassification = activeMatch?.classification ?? overallHighestEvidence;
  const clsStyle = CLASS_STYLE[cls];
  const nodeYs = [46, 86, 126, 166, 206, 246];

  return (
    <div className="rounded-2xl border border-white/10 bg-[#050d21]/90 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2.5">
        <span className="font-mono text-[10px] font-semibold tracking-[.16em] text-[#52b6ff] uppercase">
          MISSION-TO-EVIDENCE PATHWAY //{" "}
          {activeMatch ? `${activeMatch.recordId} (${activeMatch.classification})` : "UNMATCHED SCENARIO"}
        </span>
        <span className="font-mono text-[10px] text-[#8ea5c7]">
          HYPOTHETICAL INPUT -&gt; DETERMINISTIC BRIDGE -&gt; BOUNDARY WALL
        </span>
      </div>

      <svg
        viewBox="0 0 860 292"
        className="h-auto w-full select-none"
        role="img"
        aria-label={`Mission to evidence pathway diagram for ${habitat.name}${activeMatch ? ` inspecting ${activeMatch.recordId}` : ""}`}
      >
        <defs>
          <pattern id="boundary-hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
            <line x1="0" y1="0" x2="0" y2="8" stroke="rgba(255, 85, 0, 0.32)" strokeWidth="2" />
          </pattern>
        </defs>

        {/* Stage 1: Hypothetical Habitat Node */}
        <rect
          x="16"
          y="88"
          width="166"
          height="116"
          rx="14"
          fill="#0a1c42"
          stroke="rgba(54, 169, 255, 0.45)"
          strokeWidth="1.5"
        />
        <text x="30" y="114" fill="#52b6ff" fontSize="9.5" fontFamily="monospace" fontWeight="700" letterSpacing="1.2">
          USER SCENARIO
        </text>
        <text x="30" y="138" fill="#f4f8ff" fontSize="13.5" fontWeight="700">
          {habitat.shortName}
        </text>
        <text x="30" y="158" fill="#9cb2d2" fontSize="10" fontFamily="monospace">
          {habitat.code}
        </text>
        <rect x="30" y="172" width="138" height="20" rx="5" fill="rgba(255, 138, 50, 0.12)" stroke="rgba(255, 138, 50, 0.35)" />
        <text x="99" y="185" textAnchor="middle" fill="#ffb067" fontSize="9" fontFamily="monospace" fontWeight="700">
          ASSUMPTION ONLY
        </text>

        {/* Stage 2: 6 Parameter Conduits */}
        {displayParams.map((param, idx) => {
          const cy = nodeYs[idx] ?? 146;
          const style = STATUS_STROKE[param.status];
          const shortLabel = param.label
            .replace(" / Sample", "")
            .replace("Concentration", "")
            .replace("Velocity", "")
            .trim();
          return (
            <g key={param.key}>
              <path
                d={`M 182 146 C 222 146, 226 ${cy}, 266 ${cy}`}
                fill="none"
                stroke={style.color}
                strokeWidth={param.status === "AGREES" ? 2.2 : 1.5}
                strokeDasharray={style.dash}
                opacity={param.status === "NOT_SPECIFIED" ? 0.55 : 0.92}
              />
              <rect
                x="266"
                y={cy - 15}
                width="212"
                height="30"
                rx="8"
                fill="#09152e"
                stroke={style.color}
                strokeOpacity="0.55"
                strokeWidth="1"
              />
              <text x="278" y={cy + 3.5} fill="#e6f0ff" fontSize="10.5" fontWeight="600">
                {shortLabel}
              </text>
              <text
                x="467"
                y={cy + 3.5}
                textAnchor="end"
                fill={style.color}
                fontSize="9"
                fontFamily="monospace"
                fontWeight="700"
              >
                {style.badge}
              </text>
              <path
                d={`M 478 ${cy} C 512 ${cy}, 516 146, 548 146`}
                fill="none"
                stroke={style.color}
                strokeWidth={param.status === "AGREES" ? 2.1 : 1.3}
                strokeDasharray={style.dash}
                opacity={param.status === "NOT_SPECIFIED" ? 0.45 : 0.85}
              />
            </g>
          );
        })}

        {/* Stage 3: Deterministic Classification Node */}
        <rect
          x="548"
          y="92"
          width="156"
          height="108"
          rx="14"
          fill={clsStyle.fill}
          stroke={clsStyle.stroke}
          strokeWidth="1.6"
        />
        <text x="562" y="116" fill={clsStyle.text} fontSize="9.5" fontFamily="monospace" fontWeight="700">
          {activeMatch ? activeMatch.recordId : "NO MATCH"}
        </text>
        <text x="562" y="140" fill="#ffffff" fontSize="14" fontWeight="800">
          {cls.replace("_", " ")}
        </text>
        <text x="562" y="160" fill="#c7d8f0" fontSize="9.5" fontFamily="monospace">
          {activeMatch
            ? `${activeMatch.alignmentSummary.agreeCount} agree · ${activeMatch.alignmentSummary.differCount} differ`
            : "0 aligned records"}
        </text>
        <text x="562" y="179" fill={activeMatch?.isDemoFixture ? "#fcd34d" : "#9cb2d2"} fontSize="9" fontFamily="monospace">
          {activeMatch?.isDemoFixture ? "DEMO FIXTURE ONLY" : "INDEX BOUNDARY"}
        </text>

        {/* Evidence Boundary Wall (No Extrapolation Beyond Here) */}
        <rect x="720" y="32" width="12" height="228" rx="4" fill="url(#boundary-hatch)" stroke="#ff5500" strokeOpacity="0.65" />
        <rect
          x="744"
          y="58"
          width="102"
          height="176"
          rx="12"
          fill="rgba(255, 85, 0, 0.08)"
          stroke="rgba(255, 85, 0, 0.38)"
          strokeDasharray="4 4"
        />
        <text x="795" y="84" textAnchor="middle" fill="#ffb067" fontSize="9.5" fontFamily="monospace" fontWeight="700">
          EVIDENCE STOPS
        </text>
        <text x="795" y="112" textAnchor="middle" fill="#b7c9e6" fontSize="9.5">
          No Fire Simulation
        </text>
        <text x="795" y="138" textAnchor="middle" fill="#b7c9e6" fontSize="9.5">
          No Safety Rating
        </text>
        <text x="795" y="164" textAnchor="middle" fill="#b7c9e6" fontSize="9.5">
          No Burn Prediction
        </text>
        <text x="795" y="190" textAnchor="middle" fill="#b7c9e6" fontSize="9.5">
          No Missing Fill
        </text>
        <text x="795" y="216" textAnchor="middle" fill="#9cb2d2" fontSize="8.5" fontFamily="monospace">
          OUT OF SCOPE
        </text>
      </svg>
    </div>
  );
}
