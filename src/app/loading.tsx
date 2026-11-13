export default function Loading() {
  return (
    <div className="min-h-screen bg-[#050b1b] px-6 py-10 text-[#9cb2d2] lg:pl-[300px]" role="status" aria-live="polite">
      <span className="sr-only">Loading</span>
      <div className="mx-auto max-w-[1100px] space-y-4" aria-hidden="true">
        <div className="h-36 animate-pulse rounded-2xl border border-white/10 bg-[#09152e]/70" />
        <div className="grid gap-4 md:grid-cols-3">
          {[0, 1, 2].map((i) => <div key={i} className="h-40 animate-pulse rounded-2xl border border-white/10 bg-[#09152e]/60" />)}
        </div>
        <div className="h-64 animate-pulse rounded-2xl border border-white/10 bg-[#09152e]/50" />
      </div>
    </div>
  );
}
