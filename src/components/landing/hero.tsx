"use client";

import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ParticleMorph, type ShapeKey, useReducedMotion } from "./particle-morph";

const HERO_SHAPES: ShapeKey[] = ["droplet", "solidFuel", "enclosure", "aerosol"];

const STATES = [
  { code: "DROPLET_FLAME", program: "FLEX", text: "A spherical flame is the textbook picture of droplet burning once buoyancy is removed." },
  { code: "SOLID_FUEL", program: "BASS", text: "Flame spread over thin solid samples in slow, controlled airflow." },
  { code: "ENCLOSURE_BURN", program: "SAFFIRE", text: "Larger-scale material burns inside an uncrewed spacecraft module." },
  { code: "SMOKE_AEROSOL", program: "SAME", text: "The smoke particles that spacecraft fire detectors have to sense." },
];

export function Hero() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduced = useReducedMotion();

  useEffect(() => {
    if (paused || reduced) return;
    const id = window.setInterval(() => setActive((v) => (v + 1) % STATES.length), 5200);
    return () => window.clearInterval(id);
  }, [paused, reduced]);

  const state = STATES[active];

  return (
    <section className="lp-hero" aria-label="OrbitFlame introduction" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div className="lp-hero-wash" aria-hidden="true" />
      <div className="lp-hero-word lp-hero-word--a" data-reveal>
        <h1>
          <span className="sr-only">OrbitFlame — </span>ORBIT
        </h1>
        <p className="lp-mono lp-hero-kicker">{"Microgravity combustion // research intelligence"}</p>
        <p className="lp-hero-sub">Search, compare and cite NASA combustion investigations — with every claim traced back to its source.</p>
        <div className="lp-hero-actions">
          <Link href="/explore" className="lp-btn lp-btn--dark">Explore evidence <ArrowUpRight size={15} /></Link>
          <a href="#pipeline" className="lp-btn lp-btn--ghost">How it works</a>
        </div>
      </div>

      <ParticleMorph
        className="lp-hero-stage"
        shapes={HERO_SHAPES}
        active={active}
        count={7000}
        pointSize={8.5}
        label={`Conceptual particle illustration: ${state.code.replace("_", " ").toLowerCase()}. Not measurement data.`}
      />

      <div className="lp-hero-word lp-hero-word--b" aria-hidden="true" data-reveal style={{ ["--d" as string]: "120ms" }}>FLAME</div>

      <div className="lp-hero-dots" role="tablist" aria-label="Particle illustration">
        {STATES.map((s, i) => (
          <button key={s.code} role="tab" aria-selected={i === active} aria-label={`${s.program} illustration`} className={i === active ? "is-active" : ""} onClick={() => setActive(i)}>
            {String(i + 1).padStart(2, "0")}
          </button>
        ))}
      </div>

      <div className="lp-hero-caption" aria-live="polite" key={state.code}>
        <span className="lp-mono lp-tag">{`0${active + 1} // ${state.program}`}</span>
        <b className="lp-mono">{state.code}</b>
        <p>{state.text}</p>
        <small className="lp-mono">Conceptual geometry · not measurement data</small>
      </div>
    </section>
  );
}
