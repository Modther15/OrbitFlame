"use client";

import { ArrowUpRight, CheckCircle2, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useState, type KeyboardEvent } from "react";
import { ParticleMorph, type ShapeKey } from "./particle-morph";

const CHAMBER: ShapeKey[] = ["chamber"];

const PINS = [
  { id: "01", title: "Fuel & sample", angle: 0.0, pos: { left: "24%", top: "30%" }, text: "Material, phase, geometry and dimensions are stored exactly as the source writes them.", rule: "Original wording kept beside normalized values" },
  { id: "02", title: "Oxidizer", angle: 1.2, pos: { left: "70%", top: "22%" }, text: "Oxygen concentration, total pressure and oxygen partial pressure are separate fields — never merged into one \"oxygen\" number.", rule: "Different units are never compared silently" },
  { id: "03", title: "Airflow", angle: 2.6, pos: { left: "78%", top: "66%" }, text: "Flow speed and direction are recorded when reported. Missing flow stays \"Not reported\" — never zero.", rule: "Unknown is a valid value" },
  { id: "04", title: "Sensors", angle: 4.2, pos: { left: "30%", top: "74%" }, text: "Each measurement carries its channel, method and status: measured, reported, derived or qualitative.", rule: "LLM-inferred values are never treated as measurements" },
];

export function ChamberInspector() {
  const [active, setActive] = useState(0);
  const pin = PINS[active];
  const go = (i: number) => setActive((i + PINS.length) % PINS.length);
  const px = parseFloat(pin.pos.left);
  const py = parseFloat(pin.pos.top);

  // Arrow keys move between attributes inside the list (roving focus).
  const onListKey = (e: KeyboardEvent<HTMLUListElement>) => {
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp" && e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const n = (active + (e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : -1) + PINS.length) % PINS.length;
    setActive(n);
    e.currentTarget.querySelectorAll("button")[n]?.focus();
  };

  return (
    <div className="lp-inspector">
      <ul className="lp-inspector-list" aria-label="Experiment attributes" onKeyDown={onListKey}>
        {PINS.map((p, i) => (
          <li key={p.id}>
            <button type="button" className={i === active ? "is-active" : ""} aria-pressed={i === active} onClick={() => setActive(i)}>
              <span className="lp-mono">{p.id}</span>
              {p.title}
            </button>
          </li>
        ))}
      </ul>

      <div className="lp-inspector-stage">
        <ParticleMorph className="lp-inspector-canvas" shapes={CHAMBER} count={5200} pointSize={8} autoRotate={false} rotationY={pin.angle} cameraZ={5.0} label="Conceptual cylindrical chamber made of particles. Not a NASA hardware model." />
        {/* Leader line: ties the selected hotspot to the spec card on the right (decorative). */}
        <svg className="lp-leader" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <path key={pin.id} d={`M${px} ${py} C ${Math.max(px + 10, 86)} ${py}, 90 50, 100 50`} pathLength={100} />
        </svg>
        <span className="lp-leader-end" aria-hidden="true" />
        {PINS.map((p, i) => (
          <button
            key={p.id}
            type="button"
            className={`lp-pin${i === active ? " is-active" : ""}`}
            style={p.pos}
            onClick={() => setActive(i)}
            aria-label={`${p.id} ${p.title}`}
            aria-pressed={i === active}
            data-label={p.title}
          >
            {p.id}
          </button>
        ))}
        <span className="lp-mono lp-caption lp-inspector-caption">Conceptual chamber — not a NASA hardware model</span>
      </div>

      <article className="lp-spec-card">
        <div className="lp-spec-top">
          <span className="lp-mono lp-spec-code" aria-live="polite">{`PIN ${pin.id} // ${pin.title.toUpperCase()}`}</span>
          <span className="lp-spec-step">
            <button type="button" onClick={() => go(active - 1)} aria-label="Previous attribute"><ChevronLeft size={14} /></button>
            <span className="lp-mono">{`${pin.id} / ${String(PINS.length).padStart(2, "0")}`}</span>
            <button type="button" onClick={() => go(active + 1)} aria-label="Next attribute"><ChevronRight size={14} /></button>
          </span>
        </div>
        <div className="lp-spec-body" key={pin.id}>
          <h3>{pin.title}</h3>
          <p>{pin.text}</p>
          <div className="lp-spec-rule lp-mono"><CheckCircle2 size={15} /> {pin.rule}</div>
        </div>
        <Link href="/explore" className="lp-btn lp-btn--light lp-btn--block">Filter investigations <ArrowUpRight size={14} /></Link>
      </article>
    </div>
  );
}
