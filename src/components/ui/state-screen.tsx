import Link from "next/link";
import type { ReactNode } from "react";
import { ExploreSpaceBackground } from "@/components/explorer/explore-space-background";
import { Sidebar } from "@/components/navigation/sidebar";
import { Card } from "@/components/ui/card";

/** Full-shell screen (sidebar + space background) used for not-found and error states so they match the rest of the app. */
export function StateScreen({ code, title, children, actions }: { code: string; title: string; children: ReactNode; actions: ReactNode }) {
  return (
    <div className="relative min-h-screen overflow-x-clip bg-[#050b1b] text-[#f4f8ff] lg:grid lg:grid-cols-[260px_1fr]">
      <ExploreSpaceBackground />
      <Sidebar />
      <main id="main-content" tabIndex={-1} className="explore-main-stage relative z-10 min-w-0 px-4 py-10 sm:px-8 lg:px-10 lg:py-16">
        <Card className="mx-auto max-w-[760px] border border-white/10 bg-[#09152e]/85 p-8 sm:p-10">
          <p className="font-mono text-[11px] font-semibold tracking-[.18em] text-[#ff8a32]">{code}</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-[#f4f8ff] sm:text-4xl">{title}</h1>
          <div className="mt-3 max-w-xl text-sm leading-6 text-[#9cb2d2]">{children}</div>
          <div className="mt-7 flex flex-wrap gap-3">{actions}</div>
        </Card>
      </main>
    </div>
  );
}

export const primaryAction =
  "inline-flex min-h-10 items-center gap-1.5 rounded-full bg-[linear-gradient(110deg,#0a1b3a_0%,#174585_45%,#2563eb_72%,#ff5500_100%)] px-5 py-2 text-xs font-semibold tracking-wider !text-white uppercase focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#52b6ff]";
export const secondaryAction =
  "inline-flex min-h-10 items-center gap-1.5 rounded-full border border-white/15 bg-white/[0.06] px-5 py-2 text-xs font-semibold tracking-wider text-[#e6effc] uppercase hover:border-white/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#52b6ff]";

export function QuickLinks() {
  return (
    <>
      <Link href="/mission-lab" className={primaryAction}>Mission Lab</Link>
      <Link href="/assistant" className={secondaryAction}>AI Assistant</Link>
      <Link href="/explore" className={secondaryAction}>Research Explorer</Link>
    </>
  );
}
