import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { ChamberInspector } from "@/components/landing/chamber-inspector";
import { EvidencePipeline } from "@/components/landing/evidence-pipeline";
import { FamiliesCarousel, type FamilyCard } from "@/components/landing/families-carousel";
import { Hero } from "@/components/landing/hero";
import { LandingNav, RevealController } from "@/components/landing/landing-chrome";
import { MissionContexts } from "@/components/landing/mission-contexts";
import { investigationRepository } from "@/lib/data/repository";
import { DEMO_WARNING } from "@/lib/demo/dataset";
import "./landing.css";

// Program descriptions are general public context, not extracted findings.
const FAMILY_META: Omit<FamilyCard, "records">[] = [
  { key: "BASS", name: "BASS", full: "Burning and Suppression of Solids", description: "How solid materials ignite, spread flame and extinguish in low-speed flow aboard the ISS.", phase: "Solid", domain: "Prevention", platform: "ISS" },
  { key: "SAFFIRE", name: "Saffire", full: "Spacecraft Fire Safety Experiment", description: "Large-scale material burns inside uncrewed Cygnus cargo vehicles after they leave the station.", phase: "Solid", domain: "Prevention", platform: "Cygnus vehicle" },
  { key: "FLEX", name: "FLEX", full: "Flame Extinguishment Experiment", description: "Burning fuel droplets in microgravity, and the conditions under which those flames go out.", phase: "Liquid", domain: "Suppression", platform: "ISS" },
  { key: "ACME", name: "ACME", full: "Advanced Combustion via Microgravity Experiments", description: "A set of gaseous-flame studies run in the station's combustion facility.", phase: "Gas", domain: "Prevention", platform: "ISS" },
  { key: "SAME", name: "SAME", full: "Smoke Aerosol Measurement Experiment", description: "Smoke particle properties that spacecraft fire detectors depend on.", phase: "Aerosol", domain: "Detection", platform: "ISS" },
];

const SOURCES = ["NASA PSI Repository", "NASA Technical Reports Server", "NASA Task Book", "Peer-reviewed journals", "Space Apps resource package"];

function SectionHead({ code, top, bottom, text, align = "center" }: { code: string; top: string; bottom: string; text: string; align?: "center" | "left" }) {
  return (
    <div className={`lp-head lp-head--${align}`} data-reveal>
      <span className="lp-mono lp-code">[ {code} ]</span>
      <h2>{top}<br /><span className="lp-grad">{bottom}</span></h2>
      <p>{text}</p>
    </div>
  );
}

export default async function HomePage() {
  const investigations = await investigationRepository.list();
  const families: FamilyCard[] = FAMILY_META.map((f) => ({ ...f, records: investigations.filter((r) => r.family === f.key).length }));
  const verified = 0; // No NASA source package imported yet.
  const documents = 0;

  return (
    <div className="lp">
      <RevealController />
      <LandingNav />
      <main>
        <Hero />

        <section className="lp-stats" aria-label="Collection status" data-reveal>
          <div><b>{String(investigations.length).padStart(2, "0")}</b><span className="lp-mono">Demo investigations</span></div>
          <div><b>{String(families.length).padStart(2, "0")}</b><span className="lp-mono">Program families</span></div>
          <div><b>{String(documents).padStart(2, "0")}</b><span className="lp-mono">Source documents</span></div>
          <div><b>{String(verified).padStart(2, "0")}</b><span className="lp-mono">Verified evidence spans</span></div>
          <p className="lp-mono">{DEMO_WARNING}</p>
        </section>

        <section id="programs" className="lp-section">
          <SectionHead code="02 // INVESTIGATION FAMILIES" top="FIVE PROGRAMS." bottom="ONE EVIDENCE MAP." text="Browse the NASA combustion programs side by side — what each one studied, the fuel phase it used, and where it flew." />
          <div data-reveal style={{ ["--d" as string]: "120ms" }}><FamiliesCarousel families={families} /></div>
        </section>

        <section id="pipeline" className="lp-section">
          <SectionHead code="03 // EVIDENCE PIPELINE" top="SOURCE INGESTION TO" bottom="TRACEABLE EVIDENCE." text="One retrieval pipeline from NASA documents to answers: every claim cites a real source span, or it is not shown." />
          <div data-reveal style={{ ["--d" as string]: "120ms" }}><EvidencePipeline documents={documents} /></div>
        </section>

        <section id="anatomy" className="lp-section">
          <SectionHead code="04 // EXPERIMENT ANATOMY" top="BUILT FOR COMPARISON." bottom="ENGINEERED FOR TRUST." text="Every test run is broken down into the same attributes, so investigations can be compared without false zeros or mixed units." />
          <div data-reveal style={{ ["--d" as string]: "120ms" }}><ChamberInspector /></div>
        </section>

        <section id="mission" className="lp-section">
          <SectionHead code="05 // MISSION LAB" top="FIVE HABITATS." bottom="ONE EVIDENCE BOUNDARY." text="Match a crewed environment to existing experiments and see exactly which conditions are covered, which differ, and which are unknown." />
          <div data-reveal style={{ ["--d" as string]: "120ms" }}><MissionContexts verified={verified} /></div>
        </section>

        <section className="lp-section lp-section--tight">
          <SectionHead code="06 // SOURCE PRIORITY" top="NASA SOURCES FIRST." bottom="EVERYTHING TRACEABLE." text="Primary NASA records rank above secondary material. Third-party data is never labelled as NASA-provided." />
          <div className="lp-marquee" aria-label="Source priority list">
            <div className="lp-marquee-track">
              {[...SOURCES, ...SOURCES].map((s, i) => <span key={i} aria-hidden={i >= SOURCES.length}>{s}</span>)}
            </div>
          </div>
        </section>

        <section className="lp-cta" data-reveal>
          <div className="lp-cta-glow" aria-hidden="true" />
          <div className="lp-cta-copy">
            <span className="lp-mono lp-code lp-code--light">[ 07 // START ]</span>
            <h2>ASK THE<br />EVIDENCE.</h2>
            <p>Start from a program, a material or a mission question. FLAME shows what is known — and says so when it isn&apos;t.</p>
            <div className="lp-cta-meta lp-mono"><span><i /> {"AI assistant // demo mode"}</span><span>No fire-risk predictions</span></div>
          </div>
          <form className="lp-cta-form" action="/explore" method="get">
            <label>
              <span className="lp-mono">Investigation family</span>
              <select name="family" defaultValue="">
                <option value="">All programs</option>
                {families.map((f) => <option key={f.key} value={f.key}>{f.name} — {f.full}</option>)}
              </select>
            </label>
            <button type="submit" className="lp-btn lp-btn--light lp-btn--block">Open research explorer <ArrowUpRight size={15} /></button>
          </form>
        </section>
      </main>

      <footer className="lp-footer">
        <span className="lp-logo"><span className="lp-logo-mark" aria-hidden="true" /><span>Orbit<b>Flame</b></span></span>
        <span className="lp-mono">NASA Space Apps 2026 · Flame in Freefall · Cairo</span>
        <span className="lp-mono">{DEMO_WARNING}</span>
        <Link href="/explore" className="lp-mono">Explorer ↗</Link>
      </footer>
    </div>
  );
}
