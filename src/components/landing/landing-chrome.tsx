"use client";

import { ArrowUpRight, Menu, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

/** Adds `is-in` to every [data-reveal] element when it scrolls into view, and renders the photorealistic scroll-linked deep-space environment. */
const STARS_FAR = Array.from({ length: 90 }, (_, i) => ({
  x: ((i * 7919 + 104729) % 1000) * 1.6,
  y: ((i * 6271 + 54881) % 1000) * 1.0,
  r: i % 5 === 0 ? 0.82 : 0.52,
  hue: i % 7 === 0 ? "blue" : i % 11 === 0 ? "orange" : "white",
  delay: -((i * 1.19) % 8).toFixed(2),
  dur: (4.4 + ((i * 13) % 30) * 0.14).toFixed(2),
}));

const STARS_MID = Array.from({ length: 54 }, (_, i) => ({
  x: ((i * 4999 + 29311) % 1000) * 1.6,
  y: ((i * 8191 + 19457) % 1000) * 1.0,
  r: i % 4 === 0 ? 1.18 : 0.88,
  hue: i % 4 === 0 ? "blue" : i % 6 === 0 ? "orange" : "white",
  delay: -((i * 1.63) % 7).toFixed(2),
  dur: (3.2 + ((i * 17) % 28) * 0.12).toFixed(2),
}));

const STARS_NEAR = Array.from({ length: 24 }, (_, i) => ({
  x: ((i * 3571 + 71527) % 1000) * 1.6,
  y: ((i * 9109 + 41233) % 1000) * 1.0,
  r: i % 3 === 0 ? 1.68 : 1.32,
  hue: i % 3 === 0 ? "blue" : i % 4 === 0 ? "orange" : "white",
  spike: i % 5 === 0,
  delay: -((i * 2.11) % 6).toFixed(2),
  dur: (2.8 + ((i * 19) % 24) * 0.11).toFixed(2),
}));

export function RevealController() {
  const spaceRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Marks the page as hydrated: this cancels the CSS failsafe that would otherwise
    // reveal all content if client JavaScript never loads (see landing.css).
    document.querySelector(".lp")?.classList.add("lp--reveal-ready");
    const els = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      els.forEach((el) => el.classList.add("is-in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); } }),
      { threshold: 0.15, rootMargin: "0px 0px -6% 0px" },
    );
    els.forEach((el) => io.observe(el));

    // Scroll-linked environment controller: updates --sp (0..1) and --sy (px) smoothly via rAF.
    // Throttled, passive: one rAF per frame max, and the CSS variables only change when progress moves >= 0.25%
    // (each change re-styles the fixed backdrop, which is costly without a GPU).
    let raf = 0;
    let lastP = -1;
    const tick = () => {
      raf = 0;
      const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      const p = Math.min(1, Math.max(0, window.scrollY / max));
      if (Math.abs(p - lastP) < 0.0025 && p !== 0 && p !== 1) return;
      lastP = p;
      const el = spaceRef.current;
      if (el) {
        el.style.setProperty("--sp", p.toFixed(4));
        el.style.setProperty("--sy", `${(p * 1000).toFixed(1)}px`);
      }
    };
    const onScroll = () => {
      if (!raf) raf = window.requestAnimationFrame(tick);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });

    return () => {
      io.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div ref={spaceRef} className="lp-space-bg" aria-hidden="true">
      {/* LAYER A — Deep Space Base & Atmospheric Depth */}
      <div className="lp-space-base" />

      {/* LAYER B — Photorealistic Astrophotography Nebula Layers (Scroll-Linked Parallax & Cross-Fade) */}
      <div className="lp-space-nebulae">
        {/* B1: JWST Carina Nebula ("Cosmic Cliffs" — NASA/ESA/CSA/STScI) */}
        <div className="lp-nebula-photo lp-nebula-photo--carina" />
        {/* B2: Hubble Orion Nebula (M42 — NASA/STScI) soft ionized blue/orange gas wash */}
        <div className="lp-nebula-photo lp-nebula-photo--orion" />
        {/* B3: Hubble & Euclid Cat's Eye Nebula (NGC 6543 — ESA/NASA) deep field & planetary core */}
        <div className="lp-nebula-photo lp-nebula-photo--catseye" />
        {/* Ambient volumetric color grading wash */}
        <div className="lp-space-nebula" />
      </div>

      {/* LAYER C & E — Multi-Depth Parallax Starfield, Orbital Trajectories & Cosmic Dust */}
      <svg className="lp-space-svg" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id="lp-arc-blue" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#36A9FF" stopOpacity="0" />
            <stop offset="28%" stopColor="#36A9FF" stopOpacity="0.32" />
            <stop offset="68%" stopColor="#1785F2" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#36A9FF" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="lp-arc-orange" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#FF8A32" stopOpacity="0" />
            <stop offset="24%" stopColor="#FF8A32" stopOpacity="0.34" />
            <stop offset="66%" stopColor="#36A9FF" stopOpacity="0.16" />
            <stop offset="100%" stopColor="#36A9FF" stopOpacity="0" />
          </linearGradient>
          <radialGradient id="lp-flare-blue" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.92" />
            <stop offset="35%" stopColor="#36A9FF" stopOpacity="0.65" />
            <stop offset="100%" stopColor="#36A9FF" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="lp-flare-orange" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FFF4D9" stopOpacity="0.92" />
            <stop offset="35%" stopColor="#FF8A32" stopOpacity="0.68" />
            <stop offset="100%" stopColor="#FF8A32" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="lp-mesh-blue" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#36A9FF" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#102B50" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="lp-mesh-orange" x1="1" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FF8A32" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#FF5500" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Starfield Depth 1 — Far background stars */}
        <g className="lp-stars-layer lp-stars-layer--far">
          {STARS_FAR.map((s, idx) => (
            <circle
              key={idx}
              cx={s.x}
              cy={s.y}
              r={s.r}
              className={`lp-star lp-star--${s.hue}`}
              style={{ animationDelay: `${s.delay}s`, animationDuration: `${s.dur}s` }}
            />
          ))}
        </g>

        {/* Starfield Depth 2 — Mid-field stars */}
        <g className="lp-stars-layer lp-stars-layer--mid">
          {STARS_MID.map((s, idx) => (
            <circle
              key={idx}
              cx={s.x}
              cy={s.y}
              r={s.r}
              className={`lp-star lp-star--${s.hue}`}
              style={{ animationDelay: `${s.delay}s`, animationDuration: `${s.dur}s` }}
            />
          ))}
        </g>

        {/* Starfield Depth 3 — Near foreground stars with subtle JWST/Hubble diffraction spikes */}
        <g className="lp-stars-layer lp-stars-layer--near">
          {STARS_NEAR.map((s, idx) => (
            <g key={idx}>
              <circle
                cx={s.x}
                cy={s.y}
                r={s.r}
                className={`lp-star lp-star--${s.hue}`}
                style={{ animationDelay: `${s.delay}s`, animationDuration: `${s.dur}s` }}
              />
              {s.spike && (
                <g className="lp-star-spike" opacity="0.48">
                  <line x1={s.x - 7} y1={s.y} x2={s.x + 7} y2={s.y} stroke="#bfe3ff" strokeWidth="0.45" />
                  <line x1={s.x} y1={s.y - 7} x2={s.x} y2={s.y + 7} stroke="#bfe3ff" strokeWidth="0.45" />
                </g>
              )}
            </g>
          ))}
        </g>

        {/* Subtle telemetry horizon contours */}
        <g className="lp-space-mesh" opacity="0.38">
          <path d="M-40 760 Q 140 720, 290 830 T 640 960" fill="none" stroke="url(#lp-mesh-blue)" strokeWidth="1" />
          <path d="M-40 820 Q 160 780, 340 890 T 700 995" fill="none" stroke="url(#lp-mesh-blue)" strokeWidth="0.8" />
          <path d="M1640 730 Q 1420 690, 1260 820 T 940 975" fill="none" stroke="url(#lp-mesh-orange)" strokeWidth="1" />
          <path d="M1640 800 Q 1440 760, 1290 885 T 990 1000" fill="none" stroke="url(#lp-mesh-orange)" strokeWidth="0.8" />
        </g>

        {/* LAYER E — Curved Orbital Trajectories & Restrained Telemetry Nodes */}
        <g className="lp-space-orbits">
          <path
            d="M -120 560 C 120 470, 480 650, 960 720 C 1240 760, 1460 710, 1720 640"
            fill="none"
            stroke="url(#lp-arc-orange)"
            strokeWidth="1.15"
          />
          <path
            d="M 1700 290 C 1380 210, 1060 150, 720 110 C 420 75, 160 95, -120 150"
            fill="none"
            stroke="url(#lp-arc-blue)"
            strokeWidth="1"
            strokeDasharray="5 8"
          />
          <path
            d="M 520 820 C 820 760, 1140 680, 1680 555"
            fill="none"
            stroke="url(#lp-arc-orange)"
            strokeWidth="0.95"
          />
          <circle cx="52" cy="534" r="7.5" fill="url(#lp-flare-orange)" className="lp-orbit-flare" />
          <circle cx="318" cy="609" r="8.5" fill="url(#lp-flare-blue)" className="lp-orbit-flare lp-orbit-flare--b" />
          <circle cx="1220" cy="382" r="6" fill="url(#lp-flare-blue)" className="lp-orbit-flare" />
        </g>
      </svg>

      {/* LAYER D — Photorealistic NASA 3D Spacecraft Fleet (Scroll-Linked Curved Orbital Trajectories) */}
      <div className="lp-space-fleet">
        {/* 1. NASA TDRS-C Relay Satellite — Upper-right retrograde high-orbit trajectory (Right -> Left) */}
        <div className="lp-craft lp-craft--tdrs-c">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/space/craft-tdrs-c.webp" alt="" width={960} height={540} loading="eager" decoding="async" />
        </div>

        {/* 2. International Space Station (ISS High-Res) — Low-Earth Orbit prograde trajectory (Left -> Right) */}
        <div className="lp-craft lp-craft--iss">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/space/craft-iss.webp" alt="" width={1280} height={720} loading="eager" decoding="async" />
        </div>

        {/* 3. NASA Hubble Space Telescope — Mid-scroll orbital pass (Right -> Left) */}
        <div className="lp-craft lp-craft--hubble">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/space/craft-hubble.webp" alt="" width={900} height={506} loading="lazy" decoding="async" />
        </div>

        {/* 4. NASA TDRS-B Dual-Dish Relay — Mid/Lower-scroll deep-space trajectory (Left -> Right) */}
        <div className="lp-craft lp-craft--tdrs-b">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/space/craft-tdrs-b.webp" alt="" width={960} height={540} loading="lazy" decoding="async" />
        </div>

        {/* 5. NASA Mars Reconnaissance Orbiter (MRO) — Deep-space Mission Lab trajectory (Right -> Left) */}
        <div className="lp-craft lp-craft--mro">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/space/craft-mro.webp" alt="" width={900} height={506} loading="lazy" decoding="async" />
        </div>
      </div>

      {/* LAYER E — Fine Cosmic Dust & Atmospheric Vignette */}
      <div className="lp-space-dust" />
    </div>
  );
}

const LINKS = [
  ["Programs", "#programs"],
  ["Pipeline", "#pipeline"],
  ["Anatomy", "#anatomy"],
  ["Mission Lab", "#mission"],
] as const;

export function LandingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [current, setCurrent] = useState("");
  const [open, setOpen] = useState(false);
  const bar = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 12);
      const max = document.documentElement.scrollHeight - window.innerHeight;
      if (bar.current) bar.current.style.transform = `scaleX(${max > 0 ? window.scrollY / max : 0})`;
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Scroll-spy: the section crossing the middle band of the viewport is "current".
  useEffect(() => {
    const sections = LINKS.map(([, href]) => document.querySelector<HTMLElement>(href)).filter((s): s is HTMLElement => !!s);
    const visible = new Set<string>();
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => (e.isIntersecting ? visible.add(e.target.id) : visible.delete(e.target.id)));
        const first = sections.find((s) => visible.has(s.id));
        setCurrent(first ? `#${first.id}` : "");
      },
      { rootMargin: "-45% 0px -50% 0px" },
    );
    sections.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, []);

  // Mobile menu: close on Escape or when the viewport grows past the breakpoint.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    const mq = window.matchMedia("(min-width: 861px)");
    const onMq = () => { if (mq.matches) setOpen(false); };
    window.addEventListener("keydown", onKey);
    mq.addEventListener("change", onMq);
    return () => { window.removeEventListener("keydown", onKey); mq.removeEventListener("change", onMq); };
  }, [open]);

  const links = (onClick?: () => void) =>
    LINKS.map(([label, href]) => (
      <a key={href} href={href} onClick={onClick} className={current === href ? "is-active" : undefined} aria-current={current === href ? "location" : undefined}>
        {label}
      </a>
    ));

  return (
    <header className={`lp-nav${scrolled || open ? " is-scrolled" : ""}`}>
      <span className="lp-nav-progress" ref={bar} aria-hidden="true" />
      <Link href="/" className="lp-logo" aria-label="OrbitFlame home">
        <span className="lp-logo-mark" aria-hidden="true" />
        <span>Orbit<b>Flame</b></span>
      </Link>
      <nav aria-label="Main navigation">{links()}</nav>
      <div className="lp-nav-right">
        <span className="lp-mono lp-nav-demo"><i /> Real NASA PSI data</span>
        <Link href="/explore" className="lp-btn lp-btn--dark lp-btn--sm">Explore <ArrowUpRight size={13} /></Link>
        <button
          type="button"
          className="lp-nav-toggle"
          aria-expanded={open}
          aria-controls="lp-nav-sheet"
          aria-label={open ? "Close section menu" : "Open section menu"}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>
      <nav id="lp-nav-sheet" className={`lp-nav-sheet${open ? " is-open" : ""}`} aria-label="Section menu" hidden={!open}>
        {links(() => setOpen(false))}
        <span className="lp-mono lp-nav-sheet-note"><i /> {"Real NASA PSI data // not fixtures"}</span>
      </nav>
    </header>
  );
}
