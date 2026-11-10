"use client";

import { ArrowUpRight, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

export type FamilyCard = {
  key: string;
  name: string;
  full: string;
  description: string;
  phase: string;
  domain: string;
  platform: string;
  records: number;
};

function InstrumentVisual({ index, family }: { index: number; family: string }) {
  // Pure CSS/SVG instrument motif — decorative, carries no data values.
  const variants = [
    <g key="a"><ellipse cx="160" cy="100" rx="96" ry="34" className="ring" /><ellipse cx="160" cy="100" rx="62" ry="22" className="ring ring--b" /><circle cx="160" cy="100" r="7" className="core" /></g>,
    <g key="b"><rect x="70" y="112" width="180" height="6" rx="3" className="plate" /><path d="M86 112 C120 40, 180 46, 236 112" className="sheet" /><path d="M104 112 C132 64, 176 66, 214 112" className="sheet sheet--b" /></g>,
    <g key="c"><rect x="78" y="52" width="164" height="96" rx="10" className="ring" /><rect x="120" y="86" width="80" height="28" rx="3" className="plate" /><circle cx="160" cy="100" r="5" className="core" /></g>,
    <g key="d"><circle cx="160" cy="100" r="40" className="ring" /><circle cx="160" cy="100" r="64" className="ring ring--b" /><circle cx="160" cy="100" r="88" className="ring ring--c" /><circle cx="160" cy="100" r="6" className="core" /></g>,
    <g key="e">{Array.from({ length: 26 }, (_, i) => <circle key={i} cx={100 + ((i * 37) % 120)} cy={58 + ((i * 53) % 86)} r={2 + (i % 3)} className="dot" style={{ animationDelay: `${-i * 0.23}s` }} />)}</g>,
  ];
  return (
    <div className="lp-instrument">
      <div className="lp-instrument-top lp-mono"><span><i /> {`PROGRAM // ${family}`}</span><span className="lp-pill-dark">CONCEPT VIEW</span></div>
      <svg viewBox="0 0 320 200" aria-hidden="true">{variants[index % variants.length]}</svg>
      <div className="lp-instrument-bottom lp-mono"><span>ILLUSTRATIVE</span><span>NO DATA PLOTTED</span></div>
    </div>
  );
}

export function FamiliesCarousel({ families }: { families: FamilyCard[] }) {
  const [active, setActive] = useState(0);
  const [dir, setDir] = useState<1 | -1>(1);
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const go = (next: number) => {
    setDir(next > active || (active === families.length - 1 && next === 0) ? 1 : -1);
    setActive((next + families.length) % families.length);
  };
  const f = families[active];
  const next = families[(active + 1) % families.length];

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowRight") { e.preventDefault(); go(active + 1); }
    if (e.key === "ArrowLeft") { e.preventDefault(); go(active - 1); }
  };
  // Touch / pen swipe. Vertical page scrolling is preserved via `touch-action: pan-y`.
  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse") swipe.current = { x: e.clientX, y: e.clientY };
  };
  const onPointerUp = (e: PointerEvent<HTMLDivElement>) => {
    const s = swipe.current;
    swipe.current = null;
    if (!s) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.3) go(active + (dx < 0 ? 1 : -1));
  };

  return (
    <div
      className="lp-carousel"
      role="region"
      aria-roledescription="carousel"
      aria-label="NASA combustion investigation families"
      tabIndex={0}
      onKeyDown={onKeyDown}
    >
      <div
        className={`lp-carousel-track ${dir === 1 ? "from-right" : "from-left"}`}
        key={f.key}
        data-phase={f.phase.toLowerCase()}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => { swipe.current = null; }}
      >
        <div className="lp-carousel-info" aria-live="polite">
          <span className="lp-mono lp-tag lp-family-tag">{`${f.domain} // ${f.phase}`}</span>
          <h3>{f.name}</h3>
          <p className="lp-carousel-full">{f.full}</p>
          <p>{f.description}</p>
          <dl className="lp-specs">
            <div><dt className="lp-mono">Fuel phase</dt><dd><i className="lp-phase-dot" aria-hidden="true" />{f.phase}</dd></div>
            <div><dt className="lp-mono">Platform</dt><dd>{f.platform}</dd></div>
            <div><dt className="lp-mono">Demo records</dt><dd>{String(f.records).padStart(2, "0")}</dd></div>
          </dl>
          <Link href={`/explore?family=${f.key}`} className="lp-btn lp-btn--dark lp-btn--sm">Explore program <ArrowUpRight size={14} /></Link>
        </div>
        <InstrumentVisual index={active} family={f.key} />
        <button type="button" className="lp-carousel-next" onClick={() => go(active + 1)} aria-label={`Next: ${next.name}`}>
          <span className="lp-mono lp-tag">Next</span>
          <b>{next.name}</b>
          <small>{next.full}</small>
        </button>
      </div>

      <div className="lp-carousel-foot">
        <span className="lp-mono lp-carousel-index">{String(active + 1).padStart(2, "0")}<small>{` / ${String(families.length).padStart(2, "0")}`}</small></span>
        <span className="lp-mono lp-carousel-label">{`${f.key} // ${f.full}`}</span>
        <div className="lp-carousel-progress" role="tablist" aria-label="Investigation families">
          {families.map((item, i) => (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={i === active}
              aria-label={item.name}
              data-label={item.name}
              data-phase={item.phase.toLowerCase()}
              className={i === active ? "is-active" : ""}
              onClick={() => go(i)}
            />
          ))}
        </div>
        <div className="lp-carousel-arrows">
          <button type="button" onClick={() => go(active - 1)} aria-label="Previous program"><ChevronLeft size={16} /></button>
          <button type="button" onClick={() => go(active + 1)} aria-label="Next program"><ChevronRight size={16} /></button>
        </div>
      </div>
    </div>
  );
}
