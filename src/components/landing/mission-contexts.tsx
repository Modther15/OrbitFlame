"use client";

import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { useState, type KeyboardEvent } from "react";

// `gravityMatch` is a rule-based comparison of gravity class only (PRD §4.8:
// partial gravity is never treated as directly tested by microgravity work).
// It is not a statement about how much evidence exists.
const CONTEXTS = [
  { key: "SPACECRAFT", name: "Spacecraft / transit", gravity: "Microgravity", gravityMatch: "Same gravity class as microgravity tests", node: { x: 330, y: 122 }, label: "TRANSIT // DEEP SPACE", text: "Crewed vehicles between destinations. Microgravity investigations can be close matches here — subject to atmosphere and material differences." },
  { key: "STATION", name: "ISS-like station", gravity: "Microgravity", gravityMatch: "Same gravity class as microgravity tests", node: { x: 226, y: 206 }, label: "LOW EARTH ORBIT", text: "The environment where most PSI combustion investigations were run. Matches are still checked condition by condition." },
  { key: "LUNAR", name: "Lunar habitat", gravity: "Partial — about 1/6 g", gravityMatch: "Differs — microgravity work is analogous at most", node: { x: 262, y: 318 }, label: "LUNAR SURFACE", text: "Partial gravity. Microgravity or analogue tests are labelled analogous — never direct evidence for lunar conditions." },
  { key: "MARS", name: "Mars habitat", gravity: "Partial — about 0.38 g", gravityMatch: "Differs — microgravity work is analogous at most", node: { x: 492, y: 176 }, label: "MARTIAN SURFACE", text: "Partial gravity. The matcher lists which conditions differ and where the indexed evidence stops." },
  { key: "ROVER", name: "Pressurized rover", gravity: "Partial (surface-dependent)", gravityMatch: "Differs — hypothetical scenario", node: { x: 528, y: 236 }, label: "SURFACE MOBILITY", text: "A small confined cabin on the lunar or Martian surface. Treated as a hypothetical scenario, not a validated simulation." },
];

// PRD evidence-level vocabulary (§4.9). Levels are assigned per matched record.
const LEVELS = ["Direct", "Analogous", "Mechanism-only", "Planned", "Unavailable"] as const;
const VIEW_W = 640;

export function MissionContexts({ verified }: { verified: number }) {
  const [active, setActive] = useState(1);
  const c = CONTEXTS[active];
  // With nothing verified, no context can honestly be rated above "Unavailable".
  const level = verified === 0 ? "Unavailable" : null;

  const onNodeKey = (e: KeyboardEvent<SVGGElement>, i: number) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setActive(i); }
  };

  return (
    <div className="lp-mission">
      <div className="lp-map">
        <div className="lp-map-top lp-mono"><span className="lp-live"><i /> {"MISSION LAB // CONCEPT"}</span><span>5 CONTEXTS</span></div>
        <svg viewBox={`0 0 ${VIEW_W} 400`} role="group" aria-label="Conceptual map of mission contexts (not to scale)">
          <defs>
            <radialGradient id="earth" cx="40%" cy="35%"><stop offset="0" stopColor="#2b7fff" /><stop offset="1" stopColor="#0b3d91" /></radialGradient>
            <radialGradient id="mars" cx="40%" cy="35%"><stop offset="0" stopColor="#ff6b2b" /><stop offset="1" stopColor="#7c2108" /></radialGradient>
          </defs>
          <g aria-hidden="true">
            {Array.from({ length: 70 }, (_, i) => <circle key={i} cx={(i * 97) % VIEW_W} cy={(i * 61) % 400} r={i % 4 === 0 ? 1.2 : 0.7} className="star" />)}
            <path d="M150 220 Q 330 40 492 176" className="lp-route" />
            <ellipse cx="150" cy="220" rx="80" ry="30" className="lp-orbit" />
            <ellipse cx="150" cy="220" rx="122" ry="104" className="lp-orbit lp-orbit--faint" />
            <circle cx="150" cy="220" r="44" fill="url(#earth)" />
            <circle cx="262" cy="318" r="13" className="lp-moon" />
            <circle cx="510" cy="206" r="30" fill="url(#mars)" />
          </g>
          {CONTEXTS.map((ctx, i) => {
            const isActive = i === active;
            const w = ctx.label.length * 6.4 + 18;
            // Flip the tag to the left of the node if it would leave the frame.
            const flip = ctx.node.x + 12 + w > VIEW_W - 8;
            const tx = flip ? ctx.node.x - 12 - w : ctx.node.x + 12;
            return (
              <g
                key={ctx.key}
                className={`lp-node${isActive ? " is-active" : ""}`}
                role="button"
                tabIndex={0}
                aria-label={`${ctx.name} — ${ctx.gravity}`}
                aria-pressed={isActive}
                onClick={() => setActive(i)}
                onKeyDown={(e) => onNodeKey(e, i)}
              >
                <circle cx={ctx.node.x} cy={ctx.node.y} r="22" className="lp-node-hit" />
                <circle cx={ctx.node.x} cy={ctx.node.y} r="16" className="lp-node-halo" />
                <circle cx={ctx.node.x} cy={ctx.node.y} r="5" className="lp-node-dot" />
                {isActive && (
                  <g className="lp-node-label" aria-hidden="true">
                    <rect x={tx} y={ctx.node.y - 24} width={w} height="18" rx="4" className="lp-node-tag" />
                    <text x={tx + 9} y={ctx.node.y - 12} className="lp-node-text">{ctx.label}</text>
                  </g>
                )}
              </g>
            );
          })}
        </svg>
        <div className="lp-map-bottom lp-mono"><span>{`${c.key} // GRAVITY: ${c.gravity.toUpperCase()}`}</span><span>NOT TO SCALE</span></div>
      </div>

      <div className="lp-mission-side">
        <span className="lp-mono lp-tag">{`Context ${String(active + 1).padStart(2, "0")} // 05`}</span>
        <article className="lp-mission-card" key={c.key}>
          <div className="lp-mission-card-head">
            <span className="lp-mono">{c.label}</span>
            <span className="lp-chip lp-mono">{verified ? `${verified} verified sources` : "No verified evidence indexed yet"}</span>
          </div>
          <h3>{c.name}</h3>
          <p>{c.text}</p>
          <dl className="lp-specs lp-specs--two">
            <div><dt className="lp-mono">Gravity class</dt><dd>{c.gravity}</dd></div>
            <div><dt className="lp-mono">Output</dt><dd>Evidence match — no fire prediction</dd></div>
          </dl>

          <div className="lp-evidence">
            <div className="lp-evidence-head lp-mono">
              <span>Evidence level</span>
              <b>{level ?? "Assigned per record"}</b>
            </div>
            <ol className="lp-evidence-scale" aria-label={`Evidence level: ${level ?? "assigned per matched record"}`}>
              {LEVELS.map((l) => (
                <li key={l} className={l === level ? "is-current" : ""} aria-current={l === level ? "true" : undefined}>
                  <i aria-hidden="true" />
                  <span className="lp-mono">{l}</span>
                </li>
              ))}
            </ol>
            <p className="lp-evidence-note">
              <span className="lp-mono">{"Gravity // "}</span>{c.gravityMatch}.{" "}
              {level ? "No verified sources are indexed yet, so no context is rated above Unavailable." : "Each matched record carries its own level."}
            </p>
          </div>

          <Link href="/mission-lab" className="lp-btn lp-btn--accent lp-btn--sm">Open Mission Lab <ArrowUpRight size={14} /></Link>
        </article>
        <div className="lp-tabs" role="tablist" aria-label="Mission contexts">
          {CONTEXTS.map((ctx, i) => (
            <button key={ctx.key} type="button" role="tab" aria-selected={i === active} className={i === active ? "is-active" : ""} onClick={() => setActive(i)}>{ctx.name.split(" ")[0]}</button>
          ))}
        </div>
      </div>
    </div>
  );
}
