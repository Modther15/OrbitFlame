"use client";

import { useEffect, useRef } from "react";

/** Sparse, calm starfield for the Explore research environment.
 * Generates 38 realistic stars with soft twinkling and micro-parallax.
 */
const EXPLORE_STARS = Array.from({ length: 38 }, (_, i) => ({
  x: ((i * 7919 + 31873) % 1000) * 0.1, // percentage
  y: ((i * 5441 + 18919) % 1000) * 0.1,
  r: i % 4 === 0 ? 1.15 : i % 3 === 0 ? 0.9 : 0.65,
  hue: i % 5 === 0 ? "rgba(82, 182, 255, 0.85)" : i % 7 === 0 ? "rgba(255, 170, 76, 0.85)" : "rgba(244, 248, 255, 0.9)",
  delay: -((i * 1.37) % 7).toFixed(2),
  dur: (5.2 + ((i * 11) % 20) * 0.15).toFixed(2),
}));

export function ExploreSpaceBackground() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0;
    let target = 0;
    let current = 0;

    const onTick = () => {
      const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      target = Math.min(1, Math.max(0, window.scrollY / max));
      current += (target - current) * 0.14;
      if (Math.abs(target - current) < 0.0005) current = target;

      if (containerRef.current) {
        containerRef.current.style.setProperty("--exp-sp", current.toFixed(4));
        containerRef.current.style.setProperty("--exp-sy", `${(current * -32).toFixed(1)}px`);
      }

      if (current !== target) {
        raf = window.requestAnimationFrame(onTick);
      } else {
        raf = 0;
      }
    };

    const handleScroll = () => {
      if (!raf) raf = window.requestAnimationFrame(onTick);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="explore-space-bg pointer-events-none fixed inset-0 z-0 overflow-hidden select-none"
      aria-hidden="true"
    >
      {/* LAYER 1: Midnight Navy to Space Blue base gradient */}
      <div
        className="absolute inset-0 bg-[#050b1b]"
        style={{
          backgroundImage: `
            radial-gradient(90% 70% at 20% 15%, #0b1a38 0%, transparent 68%),
            radial-gradient(85% 65% at 85% 35%, rgb(16 43 80 / 46%) 0%, transparent 64%),
            radial-gradient(75% 55% at 50% 90%, rgb(255 138 50 / 5%) 0%, transparent 60%),
            linear-gradient(180deg, #050b1b 0%, #071329 52%, #050b1b 100%)
          `,
        }}
      />

      {/* LAYER 2: Calm Photorealistic Astrophotography Nebulae (Low opacity, soft blur) */}
      <div className="absolute inset-0 will-change-transform" style={{ transform: "translateY(var(--exp-sy, 0px))" }}>
        {/* Hubble Orion Nebula wash (ionized cyan/blue haze in top-left) */}
        <div
          className="absolute -inset-x-12 -top-24 h-[650px] bg-cover bg-center opacity-[0.11] mix-blend-screen"
          style={{
            backgroundImage: `url("/space/orion-nebula.webp")`,
            filter: "blur(14px) saturate(1.1)",
            maskImage: "radial-gradient(ellipse 65% 55% at 30% 40%, black 20%, transparent 75%)",
            WebkitMaskImage: "radial-gradient(ellipse 65% 55% at 30% 40%, black 20%, transparent 75%)",
          }}
        />

        {/* JWST Carina Nebula rim wash (faint warm orange/amber cosmic dusk in mid-right) */}
        <div
          className="absolute -right-20 top-1/3 h-[700px] w-[800px] bg-cover bg-center opacity-[0.08] mix-blend-screen"
          style={{
            backgroundImage: `url("/space/carina-nebula.webp")`,
            filter: "blur(12px) saturate(1.15)",
            maskImage: "radial-gradient(ellipse 60% 50% at 65% 50%, black 15%, transparent 75%)",
            WebkitMaskImage: "radial-gradient(ellipse 60% 50% at 65% 50%, black 15%, transparent 75%)",
          }}
        />
      </div>

      {/* LAYER 3: Sparse Realistic Starfield with slow twinkling */}
      <svg
        className="absolute inset-0 h-full w-full will-change-transform"
        style={{ transform: "translate3d(0, calc(var(--exp-sy, 0px) * 0.65), 0)" }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <radialGradient id="exp-star-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
            <stop offset="40%" stopColor="#52b6ff" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#52b6ff" stopOpacity="0" />
          </radialGradient>
        </defs>

        {EXPLORE_STARS.map((star, idx) => (
          <circle
            key={idx}
            cx={`${star.x}%`}
            cy={`${star.y}%`}
            r={star.r}
            fill={star.hue}
            className="explore-twinkle"
            style={{
              animationDelay: `${star.delay}s`,
              animationDuration: `${star.dur}s`,
            }}
          />
        ))}

        {/* Sparse 4-point diffraction spike on 2 bright reference stars */}
        <g transform="translate(180, 240)" opacity="0.65" className="explore-twinkle" style={{ animationDuration: "6.2s" }}>
          <circle cx="0" cy="0" r="1.4" fill="#ffffff" />
          <path d="M 0 -8 L 0 8 M -8 0 L 8 0" stroke="rgba(82, 182, 255, 0.45)" strokeWidth="0.75" />
        </g>
        <g transform="translate(860, 480)" opacity="0.55" className="explore-twinkle" style={{ animationDelay: "-3s", animationDuration: "7.1s" }}>
          <circle cx="0" cy="0" r="1.3" fill="#ffeedd" />
          <path d="M 0 -7 L 0 7 M -7 0 L 7 0" stroke="rgba(255, 170, 76, 0.4)" strokeWidth="0.75" />
        </g>
      </svg>

      {/* LAYER 4: Faint Restrained Telemetry Orbital Arc */}
      <svg
        className="absolute inset-0 h-full w-full opacity-[0.14]"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 1600 1000"
        preserveAspectRatio="none"
      >
        <path
          d="M -100 280 C 450 140, 1100 340, 1700 180"
          fill="none"
          stroke="url(#exp-arc-grad)"
          strokeWidth="1.2"
          strokeDasharray="4 8"
        />
        <defs>
          <linearGradient id="exp-arc-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#36a9ff" stopOpacity="0" />
            <stop offset="35%" stopColor="#36a9ff" stopOpacity="0.8" />
            <stop offset="70%" stopColor="#ff8a32" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#ff8a32" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}
