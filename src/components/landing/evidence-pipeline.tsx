"use client";

import { Cpu, Layers, ShieldCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { ParticleMorph, type ShapeKey, useReducedMotion } from "./particle-morph";

const CORPUS: ShapeKey[] = ["corpus"];

const STAGES = [
  { code: "STAGE 01 // INGEST", title: "Source documents & data files", text: "Checksums, page and row locators, and original units are preserved on import.", Icon: Cpu },
  { code: "STAGE 02 // RETRIEVE", title: "Hybrid search & explainable ranking", text: "Structured filters plus semantic retrieval. Every score shows its dimension-by-dimension breakdown.", Icon: Layers },
  { code: "STAGE 03 // VERIFY", title: "Citation-checked answers", text: "Claims without a resolvable source span are removed or returned as unknown.", Icon: ShieldCheck },
];

export function EvidencePipeline({ documents }: { documents: number }) {
  const [active, setActive] = useState(0);
  const [hover, setHover] = useState(false);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (hover || reduced) return;
    const id = window.setInterval(() => setActive((v) => (v + 1) % STAGES.length), 2800);
    return () => window.clearInterval(id);
  }, [hover, reduced]);

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

      <ol className="lp-stages" onMouseLeave={() => setHover(false)}>
        {STAGES.map(({ code, title, text, Icon }, i) => (
          <li key={code} className={i === active ? "is-active" : ""} onMouseEnter={() => { setHover(true); setActive(i); }}>
            <button type="button" onFocus={() => setActive(i)} aria-pressed={i === active}>
              <span className="lp-stage-icon"><Icon size={17} /></span>
              <span className="lp-stage-body">
                <span className="lp-mono lp-stage-code">{code}</span>
                <b>{title}</b>
                <span className="lp-stage-text">{text}</span>
              </span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
