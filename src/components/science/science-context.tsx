import Link from "next/link";
import { Card } from "@/components/ui/card";

/** Short, source-attributed science callouts. Every statement is taken from the PSI investigation records (investigation_meta / *_investigation.json) or the project reference notes. */

const kicker = "font-mono text-[10px] font-bold tracking-[.16em] uppercase";
const idLink = (id: string) => (
  <Link key={id} href={`/investigations/${id}`} className="font-mono text-[11px] font-semibold text-[#7bc5ff] hover:underline">
    {id}
  </Link>
);
const ids = (list: string[]) =>
  list.map((i, n) => (
    <span key={i} className="whitespace-nowrap">
      {idLink(i)}
      {n < list.length - 1 ? <span className="text-[#6a84a9]">,</span> : null}
    </span>
  ));

const HARDWARE: { title: string; hw: string; psi: string[]; note: string }[] = [
  { title: "CIR + ACME", hw: "Combustion Integrated Rack with the ACME gaseous-flame experiment", psi: ["PSI-10", "PSI-20", "PSI-21", "PSI-22", "PSI-159"], note: "Gaseous fuels: spherical / coflow / burner flames (Flame Design, BRE, CLD, E-FIELD, CFI-G)." },
  { title: "CIR + MDCA", hw: "Multi-user Droplet Combustion Apparatus inside the CIR", psi: ["PSI-39", "PSI-68", "PSI-69"], note: "Liquid fuel droplets with O2 / CO2 / He dilution (CFI, FLEX-2, FLEX)." },
  { title: "MSG flow tunnel / duct", hw: "Microgravity Science Glovebox", psi: ["PSI-25", "PSI-26", "PSI-107"], note: "BASS-II record: wind tunnel installed in the MSG; SPICE record: flow duct with integrated nozzles. SAME / SAME-R (PSI-101, PSI-102) also ran in the Glovebox with the Comparative Soot Diagnostic hardware. SLICE appears only as attached engineering documents in the PSI-26 / PSI-107 file lists, not as an investigation." },
  { title: "Cygnus enclosure", hw: "Saffire enclosure on the Cygnus vehicle", psi: ["PSI-98", "PSI-99", "PSI-100"], note: "Large solid samples (SIBAL cotton-fiberglass and others) burned after Cygnus left the ISS." },
  { title: "Instrument / ground work", hw: "No flight burn hardware", psi: ["PSI-47", "PSI-60", "PSI-115", "PSI-142"], note: "DAFT: modified TSI P-Trak vs DustTrak. PSI-60, PSI-115, PSI-142: ground, computational or simulation investigations (metadata & protocol only in PSI)." },
];

export function HardwareMap() {
  return (
    <Card data-testid="hardware-map" className="border border-white/10 bg-[#09152e]/80 p-5 backdrop-blur-md">
      <p className={`${kicker} text-[#52b6ff]`}>Hardware mapping (from each PSI investigation record)</p>
      <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {HARDWARE.map((h) => (
          <div key={h.title} className="rounded-xl border border-white/10 bg-[#060e22]/70 p-3.5">
            <p className="text-sm font-bold text-[#f4f8ff]">{h.title}</p>
            <p className="text-[11px] text-[#8ea5c7]">{h.hw}</p>
            <p className="mt-1.5 text-[11px] leading-4 text-[#c2d5ee]">{h.note}</p>
            <p className="mt-2 flex flex-wrap gap-x-1.5">{ids(h.psi)}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

const CONNECTIONS: { title: string; body: string; psi: string[] }[] = [
  { title: "DAFT qualified the SAME smoke counter", body: "DAFT / DAFT-2 was run to mitigate risk for SAME: a TSI P-Trak modified for microgravity (capillary alcohol recycling) was compared with a DustTrak using Arizona Red Dust as the aerosol standard. SAME / SAME-R then relied on that P-Trak to count smoke aerosols.", psi: ["PSI-47", "PSI-102", "PSI-101"] },
  { title: "BRE: gaseous fuels standing in for solids in still air", body: "ACME BRE burns CH4/N2 and C2H4/N2 on 25 and 50 mm porous burners to establish burning conditions in a quiescent microgravity ambient in terms of condensed-fuel material properties; the record lists the 14.7 psia / 21 %, 10.2 psia / 26.5 % and 8.2 psia / 34 % O2 habitat atmospheres as planned test atmospheres.", psi: ["PSI-20"] },
  { title: "CFI-G: inside-out (inverse) spherical flames, high O2", body: "Normal and inverse spherical diffusion flames of propane, butane and ethane blends. The CFI-G table lists XO2 from 0.12 to 0.85 (O2 mole fraction XO2, mol/mol, dimensionless: standard combustion-symbol convention, user-confirmed and not stated in the PSI file; 0.85 matches the 85 % O2 in the investigation text).", psi: ["PSI-159"] },
  { title: "E-FIELD: electric field isolated from buoyancy", body: "Up to 10 kV between burner and mesh; ion current and flame response are measured. Whether the ionic body force can emulate partial gravity is a research hypothesis, not a result in the ingested PSI files. No lunar-gravity (LUCI / FM2) data are present in the ingested files.", psi: ["PSI-22"] },
  { title: "0 g and 1 g bound intermediate gravity (concept only)", body: "BASS-II tests whether materials burn as well in microgravity with adequate ventilation as in normal gravity, bridging NASA-STD-6001 Test #1 (1 g) and microgravity. The PSI tables hold 0 g rows only (inferred from flight metadata); there are no 0.16 g, 0.38 g or 1 g rows.", psi: ["PSI-25", "PSI-26"] },
];

export function Connections() {
  return (
    <Card data-testid="connections" className="border border-white/10 bg-[#09152e]/80 p-5 backdrop-blur-md">
      <p className={`${kicker} text-[#ff8a32]`}>Cross-investigation connections (per PSI records)</p>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {CONNECTIONS.map((c) => (
          <div key={c.title} className="rounded-xl border border-white/10 bg-[#060e22]/70 p-3.5">
            <p className="text-sm font-bold text-[#f4f8ff]">{c.title}</p>
            <p className="mt-1 text-[11px] leading-4 text-[#c2d5ee]">{c.body}</p>
            <p className="mt-2 flex flex-wrap gap-x-1.5">{ids(c.psi)}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

type GravRec = {
  id: string;
  gravityEnvironments: string[];
  testRunCount: number;
  gravityInfo?: { actualG: number | null; nActual0g: number; nActual1g: number; nProxyRows: number; proxyBins: Record<string, number> };
};
const RUNGS: { g: string; label: string; bin: string | null; actual: (i: NonNullable<GravRec["gravityInfo"]>) => number }[] = [
  { g: "0 g", label: "Microgravity", bin: null, actual: (i) => i.nActual0g },
  { g: "0.16 g", label: "Lunar", bin: "lunar_eq", actual: () => 0 },
  { g: "0.38 g", label: "Mars", bin: "mars_eq", actual: () => 0 },
  { g: "1 g", label: "Ground / Earth", bin: "earth_eq", actual: (i) => i.nActual1g },
];

/** Gravity ladder: how much real NASA test data sits at each gravity level (flight-measured vs estimated from airflow). */
export function GravityLadder({ records }: { records: GravRec[] }) {
  const withInfo = records.filter((r) => r.gravityInfo);
  const plural = (n: number, w: string) => `${n.toLocaleString("en-US")} ${w}${n === 1 ? "" : "s"}`;
  return (
    <Card data-testid="gravity-ladder" className="border border-white/10 bg-[#09152e]/80 p-5 backdrop-blur-md">
      <h3 className="text-base font-bold text-[#f4f8ff]">Gravity Coverage Ladder</h3>
      <p className="mt-0.5 text-xs text-[#8ea5c7]">Real NASA test runs available at each gravity level, from microgravity to Earth.</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {RUNGS.map((r) => {
          const actualRows = withInfo.reduce((n, x) => n + r.actual(x.gravityInfo!), 0);
          const actualInv = withInfo.filter((x) => r.actual(x.gravityInfo!) > 0).map((x) => x.id);
          const proxy = r.bin ? withInfo.filter((x) => (x.gravityInfo!.proxyBins[r.bin!] ?? 0) > 0) : [];
          const proxyRows = proxy.reduce((n, x) => n + (x.gravityInfo!.proxyBins[r.bin!] ?? 0), 0);
          return (
            <div key={r.g} className={`rounded-xl border p-3.5 ${actualRows || proxyRows ? "border-[#36a9ff]/30 bg-[#36a9ff]/[0.05]" : "border-white/10 bg-[#060e22]/70"}`}>
              <p className="text-lg font-extrabold text-[#f4f8ff]">{r.g} <span className="text-xs font-semibold text-[#8ea5c7]">{r.label}</span></p>
              <p className="mt-1.5 text-[11px] font-semibold text-[#7bc5ff]">Measured in flight or on the ground</p>
              {actualRows ? (
                <>
                  <p className="text-[12px] text-[#e6effc]">{plural(actualRows, "test run")} across {plural(actualInv.length, "investigation")}{r.g === "0 g" ? " (ISS and Cygnus flights)" : " (ground-tagged)"}</p>
                  <p className="mt-0.5 flex flex-wrap gap-x-1.5">{ids(actualInv)}</p>
                </>
              ) : (
                <p className="text-[12px] leading-4 text-[#9cb2d2]">No test runs recorded at {r.g}{r.g === "1 g" ? "; the 1 g level appears only as a reference limit in the BASS records" : ""}.</p>
              )}
              {r.bin && (
                <>
                  <p className="mt-2 text-[11px] font-semibold text-[#ffb067]">Estimated from airflow</p>
                  {proxyRows ? (
                    <>
                      <p className="text-[12px] text-[#e6effc]">{plural(proxyRows, "microgravity run")} with airflow comparable to ~{r.g} buoyancy, across {plural(proxy.length, "investigation")}</p>
                      <p className="mt-0.5 flex flex-wrap gap-x-1.5">{ids(proxy.map((x) => x.id))}</p>
                    </>
                  ) : (
                    <p className="text-[12px] leading-4 text-[#9cb2d2]">No runs have airflow comparable to ~{r.g}.</p>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export function EarthApplications() {
  const items = [
    { t: "Suppression research", rel: "Fine-water-mist and clean-agent fire suppression (including the extinguisher developed for ISS use).", src: "FLEX / FLEX-2 / CFI map droplet-flame extinction against O2, CO2 and He dilution.", gap: "The ingested tables contain no water-mist data.", psi: ["PSI-69", "PSI-68", "PSI-39"] },
    { t: "Detection research", rel: "Terrestrial smoke detection, including aerosol counters used where dust and smoke must be told apart (e.g. mines, submarines, cleanrooms).", src: "SAME / SAME-R study smoke aerosol aging; DAFT qualified the particle counter against a dust standard.", gap: "The ingested tables contain no detector-response or particle-size columns.", psi: ["PSI-102", "PSI-101", "PSI-47"] },
    { t: "Materials and breathing-air safety", rel: "Firefighter protective clothing (e.g. Nomex) and high-oxygen breathing-air equipment fire safety.", src: "BASS / BASS-II / Saffire burn Nomex, cotton-fiberglass and PMMA at varied O2 and flow.", gap: "The ingested tables contain no garment or air-tank tests.", psi: ["PSI-25", "PSI-26", "PSI-98"] },
  ];
  return (
    <Card data-testid="earth-applications" className="border border-white/10 bg-[#09152e]/85 p-5 backdrop-blur-md">
      <p className={`${kicker} text-[#ff8a32]`}>Earth applications: research relevance, not results</p>
      <p className="mt-1 text-[11px] text-[#8ea5c7]">These are areas the investigations are relevant to. None of the numbers on this site is a result for these products.</p>
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        {items.map((i) => (
          <div key={i.t} className="rounded-xl border border-white/10 bg-[#060e22]/70 p-3.5">
            <p className="text-sm font-bold text-[#f4f8ff]">{i.t}</p>
            <p className="mt-1 text-[11px] leading-4 text-[#c2d5ee]"><span className="text-[#ffb067]">Relevant to: </span>{i.rel}</p>
            <p className="mt-1 text-[11px] leading-4 text-[#9cb2d2]">{i.src}</p>
            <p className="mt-1 text-[11px] leading-4 text-amber-300">{i.gap}</p>
            <p className="mt-2 flex flex-wrap gap-x-1.5">{ids(i.psi)}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}
