"use client";

import { Loader2, Upload } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { probeBackend, uploadDataset } from "@/lib/api/backend-client";
import type { UploadPayload } from "@/lib/api/backend-types";
import { fmtNum } from "@/lib/labels";

/** Drag-and-drop uploader: parses a PSI export on the live API and scores it against the habitat profiles. Nothing is persisted. */
export function UploadPanel() {
  const [live, setLive] = useState<boolean | null>(null);
  const [upload, setUpload] = useState<UploadPayload | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    probeBackend().then((r) => alive && setLive(r.source === "live")).catch(() => alive && setLive(false));
    return () => {
      alive = false;
    };
  }, []);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setErr(null);
    try {
      setUpload(await uploadDataset(file));
    } catch (e) {
      setUpload(null);
      setErr(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const disabled = live !== true || busy;
  return (
    <Card data-testid="upload-panel" className="w-full border border-white/10 bg-[#09152e]/85 p-5 backdrop-blur-md">
      <p className="font-mono text-[10px] font-bold tracking-[.16em] text-[#52b6ff] uppercase">Live PSI data upload</p>
      <p className="mt-1 text-xs leading-5 text-[#9cb2d2]">Drop your own PSI export (CSV, XLSX or ISA-Tab TXT) to score each test row against the ISS, Moon, and Mars habitat profiles. Files are parsed in memory and never stored.</p>
      <div
        onDragOver={(e) => { e.preventDefault(); if (!disabled) setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); if (!disabled) void onFile(e.dataTransfer.files?.[0]); }}
        className={`mt-3 flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors ${drag ? "border-[#36a9ff] bg-[#36a9ff]/10" : "border-white/15 bg-[#060e22]/70"} ${disabled ? "opacity-60" : ""}`}
      >
        {busy ? <Loader2 size={22} className="animate-spin text-[#52b6ff]" /> : <Upload size={22} className="text-[#52b6ff]" aria-hidden="true" />}
        <p className="text-sm font-semibold text-[#e5efff]">Drag &amp; drop a CSV / XLSX / ISA-Tab file here</p>
        <button type="button" disabled={disabled} onClick={() => fileRef.current?.click()} className="rounded-lg border border-white/15 bg-[#050b1b] px-3.5 py-1.5 text-xs font-semibold text-[#c4d7f2] hover:border-[#36a9ff] disabled:cursor-not-allowed">
          Browse files
        </button>
        <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls,.txt" disabled={disabled} onChange={(e) => void onFile(e.target.files?.[0])} className="sr-only" aria-label="Upload dataset" />
      </div>
      {live === false && <p className="mt-2 rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">Upload needs the live API (start with ./start_orbitflame.sh); it is disabled for static snapshots.</p>}
      {err && <p className="mt-2 rounded-lg border border-rose-400/35 bg-rose-500/10 px-3 py-2 text-xs text-rose-200">{err}</p>}
      {upload && (
        <div className="mt-3 overflow-x-auto rounded-xl border border-white/10 bg-[#050d21]/80">
          <p className="border-b border-white/10 px-3 py-2 text-xs text-[#8ea5c7]">{upload.filename}: {upload.n_rows} row(s) parsed · not stored</p>
          <table className="w-full text-left text-xs">
            <thead><tr className="text-[11px] font-semibold text-[#8ea5c7]"><th className="px-3 py-2">Test</th><th className="px-3 py-2">O₂ %</th><th className="px-3 py-2">Pressure (kPa)</th><th className="px-3 py-2">Gravity (g)</th><th className="px-3 py-2">Best Habitat Match</th><th className="px-3 py-2">ISS</th><th className="px-3 py-2">Moon</th><th className="px-3 py-2">Mars</th></tr></thead>
            <tbody className="divide-y divide-white/10 text-[#c4d7f2]">
              {upload.rows.slice(0, 6).map((r, i) => (
                <tr key={i}>
                  <td className="px-3 py-2">{String(r.test_id ?? r.psi_id ?? i + 1)}</td>
                  <td className="px-3 py-2">{fmtNum(r.o2_pct)}</td><td className="px-3 py-2">{fmtNum(r.pressure_kpa)}</td><td className="px-3 py-2">{fmtNum(r.gravity_g)}</td>
                  <td className="px-3 py-2 font-semibold text-[#ffb067]">{String(r.best_habitat ?? "—")}</td>
                  <td className="px-3 py-2">{fmtNum(r.score_iss)}</td><td className="px-3 py-2">{fmtNum(r.score_moon)}</td><td className="px-3 py-2">{fmtNum(r.score_mars)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
