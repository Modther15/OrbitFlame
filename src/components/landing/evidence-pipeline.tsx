"use client";

import { Cpu, Layers, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { ParticleMorph, type ShapeKey, useReducedMotion } from "./particle-morph";

const CORPUS: ShapeKey[] = ["corpus"];
const CYCLE_MS = 2800;

// `rules` describe how the pipeline is designed to behave (PRD requirements),
// not documents or results that are currently indexed.
const STAGES = [
  { code: "STAGE 01 // INGEST", title: "Source documents & data files", text: "Checksums, page and row locators, and original units are preserved on import.", rules: ["File checksum recorded", "Page & row locators", "Original units kept"], Icon: Cpu },
  { code: "STAGE 02 // RETRIEVE", title: "Hybrid search & explainable ranking", text: "Structured filters plus semantic retrieval. Every score shows its dimension-by-dimension breakdown.", rules: ["Structured filters", "Semantic retrieval", "Per-dimension score"], Icon: Layers },
  { code: "STAGE 03 // VERIFY", title: "Citation-checked answers", text: "Claims without a resolvable source span are removed or returned as unknown.", rules: ["Span-level citation check", "Unsupported claims removed", "Unknown is a valid answer"], Icon: ShieldCheck },
];

export function EvidencePipeline({ documents }: { documents: number }) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduced = useReducedMotion();
  const cycling = !paused && !reduced;

  // One timeout per step keeps the progress bar and the stage change in sync.
  useEffect(() => {
    if (!cycling) return;
    const id = window.setTimeout(() => setActive((v) => (v + 1) % STAGES.length), CYCLE_MS);
    return () => window.clearTimeout(id);
  }, [active, cycling]);

  return (
    <div className="lp-pipeline">
      <div className="lp-pipeline-source">
        <ParticleMorph className="lp-pipeline-stage" shapes={CORPUS} count={3600} pointSize={9} cameraZ={4.2} label="Conceptual particle sphere representing the indexed source corpus." />
        <span className="lp-mono lp-caption">{`Source corpus // ${String(documents).padStart(2, "0")} documents indexed`}</span>
      </div>

      <svg className="lp-pipeline-wires" viewBox="0 0 220 360" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="wire" x1="0" x2="1">
            <stop offset="0" stopColor="#0b3d91" />
            <stop offset="0.5" stopColor="#1785f2" />
            <stop offset="1" stopColor="#ff5500" />
          </linearGradient>
        </defs>
        {[60, 180, 300].map((y, i) => {
          const d = `M0 180 C 90 180, 110 ${y}, 220 ${y}`;
          return (
            <g key={y} className={i === active ? "is-active" : ""}>
              <path d={d} className="wire-base" />
              <path d={d} className="wire-pulse" stroke="url(#wire)" pathLength={100} />
              <circle cx="220" cy={y} r="4" className="wire-node" />
            </g>
          );
        })}
        <circle cx="0" cy="180" r="4" className="wire-node is-on" />
      </svg>

      <ol className="lp-stages" onPointerLeave={(e) => { if (e.pointerType === "mouse") setPaused(false); }}>
        {STAGES.map(({ code, title, text, rules, Icon }, i) => {
          const isActive = i === active;
          return (
            <li key={code} className={isActive ? "is-active" : ""} onPointerEnter={(e) => { if (e.pointerType === "mouse") { setPaused(true); setActive(i); } }}>
              <button
                type="button"
                onFocus={() => setActive(i)}
                onClick={() => { setActive(i); setPaused(true); }}
                aria-pressed={isActive}
                aria-expanded={isActive}
              >
                <span className="lp-stage-icon"><Icon size={17} /></span>
                <span className="lp-stage-body">
                  <span className="lp-mono lp-stage-code">{code}</span>
                  <b>{title}</b>
                  <span className="lp-stage-text">{text}</span>
                  <span className="lp-stage-more" aria-hidden={!isActive}>
                    <span>
                      <span className="lp-mono lp-stage-more-label">{"Design rules // demo mode"}</span>
                      <span className="lp-stage-rules">
                        {rules.map((r) => <span key={r} className="lp-mono">{r}</span>)}
                      </span>
                    </span>
                  </span>
                </span>
                {isActive && cycling && <span className="lp-stage-timer" key={`t-${active}`} aria-hidden="true" style={{ animationDuration: `${CYCLE_MS}ms` }} />}
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
