import {
  deriveDatasetScope,
  extractRecordNumericCondition,
  formatProvenanceTag,
  isRecordVerified,
  presentMeasurementTotal,
  type DatasetScopeSummary,
  type ScopeRecord,
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
    focus: "Ignition, flame spread and extinction of solids (BASS, BASS-II, Saffire), gaseous flames (ACME: Flame Design, BRE, CLD, E-FIELD, CFI-G) and smoke-point behaviour (SPICE) in the indexed PSI tables.",
    caveat:
      "Design relevance (e.g., liner or material selection) is interpretive only. The indexed prevention records establish no flight material qualification or safety rating.",
  },
  DETECTION: {
    title: "Smoke & Aerosol Detection",
    focus: "Smoke aerosol generation and aging (SAME, SAME-R) and aerosol-counter qualification against a dust standard (DAFT).",
    caveat:
      "The ingested tables hold Rt/R0 and weight-loss-rate outcomes only; no detector-response or particle-size columns exist. Visual links indicate domain grouping only, not alarm certification.",
  },
  SUPPRESSION: {
    title: "Suppression & Atmospheric Dilution",
    focus: "Droplet-flame burning and extinction with O2, CO2, He and N dilution (FLEX, FLEX-2, CFI; liquid fuels in the CIR droplet apparatus).",
    caveat:
      "Extinction diameters and burning rates are measured per test; no extinguishant-efficiency curve is derived here. Never infer extinguishant efficacy from metadata.",
  },
};

export function buildTechnologyMap(records: ScopeRecord[]): TechnologyMapReport {
  const datasetScope = deriveDatasetScope(records);
  const allNodes: TechMapRecordNode[] = [];

  const clusters: TechDomainCluster[] = (["PREVENTION", "DETECTION", "SUPPRESSION"] as const).map((domain) => {
    const matching = records.filter((rec) => rec.safetyDomains.includes(domain));
    const nodes: TechMapRecordNode[] = matching.map((rec) => {
      const o2 = extractRecordNumericCondition(rec, "oxygen_concentration");
      const p = extractRecordNumericCondition(rec, "pressure");
      const air = extractRecordNumericCondition(rec, "airflow");
      const measCount = presentMeasurementTotal(rec);
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
