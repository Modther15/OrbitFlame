import { CircleDot, ShieldCheck } from "lucide-react";

type Status = "verified" | "demo" | "unverified" | "not-reported" | "empty";
const labels: Record<Status, string> = {
  verified: "NASA VERIFIED DATA",
  demo: "DEMO FIXTURE — FICTIONAL DATA — NOT NASA MEASUREMENTS",
  unverified: "INFERRED / UNVERIFIED",
  "not-reported": "NOT REPORTED",
  empty: "COLLECTION NOT CONNECTED",
};

export function StatusBadge({ status }: { status: Status }) {
  const verified = status === "verified";
  return (
    <span
      className={`inline-flex min-h-8 items-center gap-2 rounded-full border px-3.5 py-1 font-mono text-[10px] font-semibold tracking-[.12em] ${
        verified
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700"
          : status === "demo"
            ? "border-amber-500/30 bg-amber-500/10 text-amber-800"
            : "border-slate-200 bg-white text-slate-600"
      }`}
    >
      {verified ? <ShieldCheck size={13} aria-hidden="true" /> : <CircleDot size={13} aria-hidden="true" />}
      {labels[status]}
    </span>
  );
}
