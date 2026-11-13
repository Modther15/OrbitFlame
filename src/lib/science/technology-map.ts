import type { DemoInvestigation } from "@/lib/api/schemas";
import {
  deriveDatasetScope,
  extractRecordNumericCondition,
  formatProvenanceTag,
  isRecordVerified,
  type DatasetScopeSummary,
} from "@/lib/science/provenance";

export type TechDomainKey = "PREVENTION" | "DETECTION" | "SUPPRESSION";

export type TechMapRecordNode = {
  id: string;
  name: string;
  family: string | null;
  domain: TechDomainKey;
  fuelMaterial: string;
  gravity: string;
  oxygenDisplay: string;
  pressureDisplay: string;
  airflowDisplay: string;
  measurementChannelCount: number;
  provenanceLabel: string;
  isVerified: boolean;
  isDemoFixture: boolean;
};

export type TechDomainCluster = {
  domain: TechDomainKey;
  title: string;
  engineeringFocus: string;
  recordCount: number;
  familiesRepresented: string[];
  records: TechMapRecordNode[];
  populatedMeasurementCount: number;
  interpretationCaveat: string;
};

export type TechnologyMapReport = {
  datasetScope: DatasetScopeSummary;
  clusters: TechDomainCluster[];
  allNodes: TechMapRecordNode[];
  nonCausalNotice: string;
};

const DOMAIN_DESCRIPTORS: Record<
  TechDomainKey,
  { title: string; focus: string; caveat: string }
> = {
  PREVENTION: {
    title: "Fire Prevention & Material Screening",
    focus: "Ignition limits, flame-spread observations across polymers/textiles/gaseous mixtures, and barrier material trials indexed under PREVENTION.",
    caveat:
      "Design relevance (e.g., liner or polymer selection) is interpretive only. Indexed prevention fixtures establish no flight material qualification or safety rating.",
  },
  DETECTION: {
    title: "Smoke & Aerosol Detection",
    focus: "Particle transport, optical sensor visibility, and smoke surrogate characterization indexed under DETECTION.",
    caveat:
      "Detector channel curves and particle size spectra are unpopulated in current fixtures. Visual links indicate domain grouping only, not alarm certification.",
  },
  SUPPRESSION: {
    title: "Suppression & Atmospheric Dilution",
    focus: "Droplet extinction observation concepts and suppressant agent dispersion studies indexed under SUPPRESSION.",
    caveat:
      "Indexed suppression fixtures contain no measured extinction thresholds or concentration knockdown curves; never infer extinguishant efficacy from metadata.",
  },
};

export function buildTechnologyMap(records: DemoInvestigation[]): TechnologyMapReport {
  const datasetScope = deriveDatasetScope(records);
  const allNodes: TechMapRecordNode[] = [];

  const clusters: TechDomainCluster[] = (["PREVENTION", "DETECTION", "SUPPRESSION"] as const).map((domain) => {
    const matching = records.filter((rec) => rec.safetyDomains.includes(domain));
    const nodes: TechMapRecordNode[] = matching.map((rec) => {
      const o2 = extractRecordNumericCondition(rec, "oxygen_concentration");
      const p = extractRecordNumericCondition(rec, "pressure");
      const air = extractRecordNumericCondition(rec, "airflow");
      const measCount = rec.testRuns.reduce(
        (sum, run) => sum + run.measurements.filter((m) => m.missingStatus === "PRESENT").length,
        0,
      );
      const node: TechMapRecordNode = {
        id: rec.id,
        name: rec.name,
        family: rec.family,
        domain,
        fuelMaterial: rec.fuelMaterial,
        gravity: rec.conditions.gravity,
        oxygenDisplay: o2.displayOriginal,
        pressureDisplay: p.displayOriginal,
        airflowDisplay: air.displayOriginal,
        measurementChannelCount: measCount,
        provenanceLabel: formatProvenanceTag(rec.provenanceStatus, rec.source),
        isVerified: isRecordVerified(rec),
        isDemoFixture: rec.provenanceStatus === "DEMO_FIXTURE",
      };
      allNodes.push(node);
      return node;
    });

    const familiesRepresented = Array.from(
      new Set(nodes.map((n) => n.family).filter((f): f is string => Boolean(f))),
    ).sort();

    const populatedMeasurementCount = nodes.reduce((sum, n) => sum + n.measurementChannelCount, 0);
    const meta = DOMAIN_DESCRIPTORS[domain];

    return {
      domain,
      title: meta.title,
      engineeringFocus: meta.focus,
      recordCount: nodes.length,
      familiesRepresented,
      records: nodes,
      populatedMeasurementCount,
      interpretationCaveat: meta.caveat,
    };
  });

  return {
    datasetScope,
    clusters,
    allNodes,
    nonCausalNotice:
      "ASSOCIATION MAP ONLY — Connections below represent shared safety-domain and family metadata in the active index. They NEVER imply scientific causation, shared flammability physics, or spacecraft hardware qualification.",
  };
}
