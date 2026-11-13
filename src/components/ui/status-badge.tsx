import { CircleDot, ShieldCheck } from "lucide-react";

type Status = "verified" | "demo" | "benchmark" | "direct" | "unverified" | "not-reported" | "empty";
const labels: Record<Status, string> = {
  verified: "VERIFIED NASA PSI EXPERIMENTAL DATA",
  demo: "DEMO FIXTURE — FICTIONAL DATA — NOT NASA MEASUREMENTS",
  benchmark: "VERIFIED NASA PSI EXPERIMENTAL DATA",
  direct: "VERIFIED NASA PSI EXPERIMENTAL DATA",
  unverified: "INFERRED / UNVERIFIED",
  "not-reported": "NOT REPORTED",
  empty: "COLLECTION NOT CONNECTED",
};

export function StatusBadge({ status }: { status: Status }) {
  const verified = status === "verified" || status === "direct" || status === "benchmark";
  if (verified) return null; // verified provenance is the default; only exceptions are called out
  return (
    <span
      className={`inline-flex min-h-8 items-center gap-2 rounded-full border px-3.5 py-1 font-mono text-[10px] font-semibold tracking-[.12em] ${
        verified
          ? "border-emerald-400/35 bg-emerald-400/15 text-emerald-300"
          : status === "demo"
            ? "border-amber-400/35 bg-amber-400/15 text-amber-300"
            : "border-white/15 bg-white/10 text-[#d8e6fa]"
      }`}
    >
      {verified ? <ShieldCheck size={13} aria-hidden="true" /> : <CircleDot size={13} aria-hidden="true" />}
      {labels[status]}
    </span>
  );
}
