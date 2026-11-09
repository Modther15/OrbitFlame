"use client";

import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

const CONTEXTS = [
  { key: "SPACECRAFT", name: "Spacecraft / transit", gravity: "Microgravity", node: { x: 330, y: 122 }, label: "TRANSIT // DEEP SPACE", text: "Crewed vehicles between destinations. Microgravity investigations can be close matches here — subject to atmosphere and material differences." },
  { key: "STATION", name: "ISS-like station", gravity: "Microgravity", node: { x: 226, y: 206 }, label: "LOW EARTH ORBIT", text: "The environment where most PSI combustion investigations were run. Matches are still checked condition by condition." },
  { key: "LUNAR", name: "Lunar habitat", gravity: "Partial — about 1/6 g", node: { x: 262, y: 318 }, label: "LUNAR SURFACE", text: "Partial gravity. Microgravity or analogue tests are labelled analogous — never direct evidence for lunar conditions." },
  { key: "MARS", name: "Mars habitat", gravity: "Partial — about 0.38 g", node: { x: 492, y: 176 }, label: "MARTIAN SURFACE", text: "Partial gravity. The matcher lists which conditions differ and where the indexed evidence stops." },
  { key: "ROVER", name: "Pressurized rover", gravity: "Partial (surface-dependent)", node: { x: 528, y: 236 }, label: "SURFACE MOBILITY", text: "A small confined cabin on the lunar or Martian surface. Treated as a hypothetical scenario, not a validated simulation." },
];

export function MissionContexts({ verified }: { verified: number }) {
  const [active, setActive] = useState(1);
  const c = CONTEXTS[active];

  return (
    <div className="lp-mission">
      <div className="lp-map">
        <div className="lp-map-top lp-mono"><span className="lp-live"><i /> {"MISSION LAB // CONCEPT"}</span><span>5 CONTEXTS</span></div>
        <svg viewBox="0 0 640 400" aria-hidden="true">
          <defs>
            <radialGradient id="earth" cx="40%" cy="35%"><stop offset="0" stopColor="#2b7fff" /><stop offset="1" stopColor="#0b3d91" /></radialGradient>
            <radialGradient id="mars" cx="40%" cy="35%"><stop offset="0" stopColor="#ff6b2b" /><stop offset="1" stopColor="#7c2108" /></radialGradient>
          </defs>
          {Array.from({ length: 70 }, (_, i) => <circle key={i} cx={(i * 97) % 640} cy={(i * 61) % 400} r={i % 4 === 0 ? 1.2 : 0.7} className="star" />)}
          <path d="M150 220 Q 330 40 492 176" className="lp-route" />
          <ellipse cx="150" cy="220" rx="80" ry="30" className="lp-orbit" />
          <ellipse cx="150" cy="220" rx="122" ry="104" className="lp-orbit lp-orbit--faint" />
          <circle cx="150" cy="220" r="44" fill="url(#earth)" />
          <circle cx="262" cy="318" r="13" className="lp-moon" />
          <circle cx="510" cy="206" r="30" fill="url(#mars)" />
          {CONTEXTS.map((ctx, i) => (
            <g key={ctx.key} className={`lp-node${i === active ? " is-active" : ""}`} onClick={() => setActive(i)}>
              <circle cx={ctx.node.x} cy={ctx.node.y} r="16" className="lp-node-halo" />
              <circle cx={ctx.node.x} cy={ctx.node.y} r="5" className="lp-node-dot" />
              {i === active && (
                <g>
                  <rect x={ctx.node.x + 12} y={ctx.node.y - 24} width={ctx.label.length * 6.4 + 18} height="18" rx="4" className="lp-node-tag" />
                  <text x={ctx.node.x + 21} y={ctx.node.y - 12} className="lp-node-text">{ctx.label}</text>
                </g>
              )}
            </g>
          ))}
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
          <Link href="/explore" className="lp-btn lp-btn--accent lp-btn--sm">Open Mission Lab <ArrowUpRight size={14} /></Link>
        </article>
        <div className="lp-tabs" role="tablist" aria-label="Mission contexts">
          {CONTEXTS.map((ctx, i) => (
            <button key={ctx.key} role="tab" aria-selected={i === active} className={i === active ? "is-active" : ""} onClick={() => setActive(i)}>{ctx.name.split(" ")[0]}</button>
          ))}
        </div>
      </div>
    </div>
  );
}
