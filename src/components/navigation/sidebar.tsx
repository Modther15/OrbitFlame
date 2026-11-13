"use client";

import { DataSourceBadge } from "@/components/ui/data-source-badge";
import { Activity, Archive, BookOpenText, Compass, FlaskConical, GitCompareArrows, LayoutDashboard, Menu, Search, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useCompareSelection } from "@/lib/state/compare-selection";

const primary = [
  ["Overview", "/", LayoutDashboard],
  ["Compare Lab", "/compare", GitCompareArrows],
  ["AI Assistant", "/assistant", Activity],
  ["Mission Lab", "/mission-lab", Compass],
  ["Research Explorer", "/explore", Search],
  ["Technology Map", "/technology-map", FlaskConical],
] as const;

const governance = [
  ["Research Library", "/sources", Archive],
  ["How It Works", "/how-it-works", BookOpenText],
] as const;

export function Sidebar() {
  const pathname = usePathname();
  const { selectedIds } = useCompareSelection();
  // Mobile / tablet drawer. Each page renders its own <Sidebar/>, so the open state resets on navigation.
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <aside className="explore-sidebar relative z-10 border-b border-white/10 bg-[#060e22]/85 px-5 pb-4 pt-5 text-[#f4f8ff] backdrop-blur-md lg:min-h-screen lg:border-b-0 lg:border-r lg:border-white/10 lg:px-6 lg:pb-7 lg:pt-8">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Link href="/" className="inline-flex items-center gap-2.5 text-[17px] font-bold tracking-[-0.02em] text-[#f4f8ff]">
            <span className="relative h-6 w-6 rounded-full bg-[conic-gradient(from_200deg,#0b3d91,#36a9ff,#ff5500,#f59e0b,#0b3d91)] after:absolute after:inset-[6px] after:rounded-full after:bg-[#060e22]" />
            <span>
              Orbit<b className="bg-[linear-gradient(90deg,#ff5500,#f59e0b)] bg-clip-text font-bold text-transparent">Flame</b>
            </span>
          </Link>
          <p className="mt-1 font-mono text-[9px] tracking-[.18em] text-[#7d95b8]">COMBUSTION INTELLIGENCE</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="primary-navigation"
          aria-label={open ? "Close navigation menu" : "Open navigation menu"}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/[0.05] text-[#e6effc] hover:border-white/30 lg:hidden"
        >
          {open ? <X size={18} aria-hidden="true" /> : <Menu size={18} aria-hidden="true" />}
        </button>
      </div>

      <nav id="primary-navigation" aria-label="Primary navigation" className={`mt-5 flex-col gap-1.5 lg:mt-7 lg:flex ${open ? "flex" : "hidden"}`}>
        {primary.map(([label, baseHref, Icon]) => {
          const isCompare = baseHref === "/compare";
          const href = isCompare && selectedIds.length > 0 ? `/compare?ids=${encodeURIComponent(selectedIds.join(","))}` : baseHref;
          const active =
            baseHref === "/explore"
              ? pathname.startsWith("/explore") || pathname.startsWith("/investigations")
              : baseHref === "/"
                ? pathname === "/"
                : pathname.startsWith(baseHref);
          return (
            <Link
              key={label}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex shrink-0 items-center justify-between gap-2 rounded-xl px-3.5 py-2.5 text-[13px] font-medium transition-all ${
                active
                  ? "border border-[#36a9ff]/35 bg-[linear-gradient(135deg,#0a1f46_0%,#13386e_100%)] !text-white shadow-[0_8px_20px_-6px_rgba(54,169,255,0.4)]"
                  : "text-[#9cb2d2] hover:bg-white/[0.06] hover:text-[#f4f8ff]"
              }`}
            >
              <span className="flex items-center gap-3">
                <Icon size={16} aria-hidden="true" className={active ? "text-[#ff8a32]" : "text-[#7d95b8]"} />
                {label}
              </span>
              {isCompare && selectedIds.length > 0 && (
                <span className="rounded-full bg-[linear-gradient(135deg,#0b3d91,#ff5500)] px-2 py-0.5 font-mono text-[10px] font-semibold text-white">
                  {selectedIds.length}
                </span>
              )}
            </Link>
          );
        })}

        {governance.map(([label, href, Icon]) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={label}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex shrink-0 items-center gap-3 rounded-xl px-3.5 py-2.5 text-[13px] font-medium transition-all lg:hidden ${
                active
                  ? "border border-[#36a9ff]/35 bg-[linear-gradient(135deg,#0a1f46_0%,#13386e_100%)] !text-white"
                  : "text-[#8ea5c7] hover:bg-white/[0.06] hover:text-[#f4f8ff]"
              }`}
            >
              <Icon size={15} aria-hidden="true" className={active ? "text-[#ff8a32]" : "text-[#7d95b8]"} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-8 hidden border-t border-white/10 pt-5 lg:block">
        {governance.map(([label, href, Icon]) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={label}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex items-center gap-3 rounded-lg px-3.5 py-2 text-xs font-medium transition-colors ${
                active ? "bg-white/[0.08] font-semibold text-white" : "text-[#8ea5c7] hover:text-white"
              }`}
            >
              <Icon size={15} aria-hidden="true" className={active ? "text-[#ff8a32]" : undefined} /> {label}
            </Link>
          );
        })}
      </div>
      <DataSourceBadge className={`mt-5 lg:block ${open ? "block" : "hidden"}`} />
    </aside>
  );
}
