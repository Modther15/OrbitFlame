"use client";

import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

/** Adds `is-in` to every [data-reveal] element when it scrolls into view. */
export function RevealController() {
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      els.forEach((el) => el.classList.add("is-in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("is-in"); io.unobserve(e.target); } }),
      { threshold: 0.15, rootMargin: "0px 0px -6% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  return null;
}

const LINKS = [
  ["Programs", "#programs"],
  ["Pipeline", "#pipeline"],
  ["Anatomy", "#anatomy"],
  ["Mission Lab", "#mission"],
] as const;

export function LandingNav() {
  const [scrolled, setScrolled] = useState(false);
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

  return (
    <header className={`lp-nav${scrolled ? " is-scrolled" : ""}`}>
      <span className="lp-nav-progress" ref={bar} aria-hidden="true" />
      <Link href="/" className="lp-logo" aria-label="OrbitFlame home">
        <span className="lp-logo-mark" aria-hidden="true" />
        <span>Orbit<b>Flame</b></span>
      </Link>
      <nav aria-label="Main navigation">
        {LINKS.map(([label, href]) => <a key={href} href={href}>{label}</a>)}
      </nav>
      <div className="lp-nav-right">
        <span className="lp-mono lp-nav-demo"><i /> Demo mode</span>
        <Link href="/explore" className="lp-btn lp-btn--dark lp-btn--sm">Explore <ArrowUpRight size={13} /></Link>
      </div>
    </header>
  );
}
