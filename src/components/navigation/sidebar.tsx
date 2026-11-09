"use client";

import { Activity, Archive, BookOpenText, CircleHelp, Compass, FlaskConical, GitCompareArrows, LayoutDashboard, Map, Search } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const primary = [
  ["Overview", "/", LayoutDashboard],
  ["Research Explorer", "/explore", Search],
  ["Compare Lab", "/explore#compare", GitCompareArrows],
  ["AI Assistant", "/#pipeline", Activity],
  ["Mission Lab", "/#mission", Compass],
] as const;

const research = [
  ["Evidence Gaps", "/#anatomy", Map],
  ["Technology Map", "/#programs", FlaskConical],
] as const;

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="border-b border-[#dfe6f2] bg-white/85 px-5 py-4 backdrop-blur-md lg:min-h-screen lg:border-b-0 lg:border-r lg:px-6 lg:py-7">
      <Link href="/" className="inline-flex items-center gap-2.5 text-[17px] font-bold tracking-[-0.02em] text-[#071126]">
        <span className="relative h-6 w-6 rounded-full bg-[conic-gradient(from_200deg,#0b3d91,#1785f2,#ff5500,#f59e0b,#0b3d91)] after:absolute after:inset-[6px] after:rounded-full after:bg-white" />
        <span>
          Orbit<b className="bg-[linear-gradient(90deg,#ff5500,#f59e0b)] bg-clip-text font-bold text-transparent">Flame</b>
        </span>
      </Link>
      <p className="mt-1 font-mono text-[9px] tracking-[.18em] text-[#5b6b88]">COMBUSTION INTELLIGENCE</p>

      <nav aria-label="Primary navigation" className="mt-7 flex gap-1.5 overflow-x-auto lg:flex-col">
        {primary.map(([label, href, Icon]) => {
          const active = href === "/explore" ? pathname.startsWith("/explore") || pathname.startsWith("/investigations") : pathname === href;
          return (
            <Link
              key={label}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`flex shrink-0 items-center gap-3 rounded-xl px-3.5 py-2.5 text-[13px] font-medium transition-all ${
                active
                  ? "bg-[linear-gradient(135deg,#071126_0%,#0b3d91_100%)] text-white shadow-[0_10px_24px_-12px_rgba(11,61,145,0.55)]"
                  : "text-[#5b6b88] hover:bg-[#edf2fa] hover:text-[#071126]"
              }`}
            >
              <Icon size={16} aria-hidden="true" className={active ? "text-[#ff8c38]" : ""} />
              {label}
            </Link>
          );
        })}

        <p className="hidden px-3.5 pb-1 pt-5 font-mono text-[9.5px] font-semibold tracking-[.18em] text-[#8c9bbd] lg:block">
          RESEARCH MODULES
        </p>
        {research.map(([label, href, Icon]) => (
          <Link
            key={label}
            href={href}
            className="flex shrink-0 items-center gap-3 rounded-xl px-3.5 py-2.5 text-[13px] font-medium text-[#5b6b88] transition-colors hover:bg-[#edf2fa] hover:text-[#071126]"
          >
            <Icon size={16} aria-hidden="true" />
            {label}
          </Link>
        ))}
      </nav>

      <div className="mt-8 hidden border-t border-[#dfe6f2] pt-5 lg:block">
        <Link href="/#programs" className="flex items-center gap-3 rounded-lg px-3.5 py-2 text-xs font-medium text-[#5b6b88] hover:text-[#071126]">
          <Archive size={15} /> Source Catalogue
        </Link>
        <Link href="/#pipeline" className="flex items-center gap-3 rounded-lg px-3.5 py-2 text-xs font-medium text-[#5b6b88] hover:text-[#071126]">
          <BookOpenText size={15} /> Methodology
        </Link>
        <Link href="/#anatomy" className="flex items-center gap-3 rounded-lg px-3.5 py-2 text-xs font-medium text-[#5b6b88] hover:text-[#071126]">
          <CircleHelp size={15} /> Evidence Rules
        </Link>
      </div>
    </aside>
  );
}
