import { DEMO_WARNING } from "@/lib/demo/dataset";
import {
  classifyGravityRegime,
  deriveDatasetScope,
  extractRecordNumericCondition,
  formatProvenanceTag,
  isRecordVerified,
  presentMeasurementTotal,
  type DatasetScopeSummary,
  type ScopeRecord,
} from "@/lib/science/provenance";

export type RadarGravityAxis = "MICROGRAVITY" | "LUNAR_GRAVITY" | "MARS_GRAVITY" | "NORMAL_GRAVITY";
export type RadarSafetyDomain = "PREVENTION" | "DETECTION" | "SUPPRESSION";

export type GapCoverageStatus = "DIRECT" | "ANALOGOUS" | "PLANNED" | "UNAVAILABLE";

export const RADAR_GRAVITY_AXES: readonly {
  id: RadarGravityAxis;
  label: string;
  shortLabel: string;
  missionContextLabel: string;
  suggestedHabitatId: "ISS" | "LUNAR_HABITAT" | "MARS_HABITAT" | "CUSTOM";
  physicalNote: string;
}[] = [
  {
    id: "MICROGRAVITY",
    label: "Microgravity (~0 g)",
    shortLabel: "Microgravity",
    missionContextLabel: "Spacecraft / ISS Orbital Habitat",
    suggestedHabitatId: "ISS",
    physicalNote: "Free-fall environment lacking natural buoyancy-driven convection.",
  },
  {
    id: "LUNAR_GRAVITY",
    label: "Lunar Gravity (~1/6 g)",
    shortLabel: "Lunar gravity",
    missionContextLabel: "Lunar Surface Habitat / Rover",
    suggestedHabitatId: "LUNAR_HABITAT",
    physicalNote: "Reduced buoyant flow (~0.165 g). Microgravity or 1 g tests are never equivalent to verified lunar combustion measurements.",
  },
  {
    id: "MARS_GRAVITY",
    label: "Mars Gravity (~0.38 g)",
    shortLabel: "Mars gravity",
    missionContextLabel: "Martian Surface Habitat / Rover",
    suggestedHabitatId: "MARS_HABITAT",
    physicalNote: "Partial gravity (~0.38 g). Fluid transport and flame extinction thresholds require regime-specific empirical validation.",
  },
  {
    id: "NORMAL_GRAVITY",
    label: "Normal Gravity (~1 g)",
    shortLabel: "Normal gravity",
    missionContextLabel: "Earth Baseline / Test Reference",
    suggestedHabitatId: "CUSTOM",
    physicalNote: "Full terrestrial buoyancy reference baseline.",
  },
];

export const RADAR_DOMAINS: readonly {
  id: RadarSafetyDomain;
  label: string;
  focusNote: string;
}[] = [
  {
    id: "PREVENTION",
    label: "Prevention",
    focusNote: "Material selection, ignition limits, and atmospheric flammability boundaries.",
  },
  {
    id: "DETECTION",
    label: "Detection",
    focusNote: "Aerosol/smoke particle characterization, optical sensor visibility, and alarm response.",
  },
  {
    id: "SUPPRESSION",
    label: "Suppression",
    focusNote: "Flame extinguishment thresholds, dilution atmospheres, and agent dispersion behavior.",
  },
];

export type GapRecordSummary = {
  id: string;
  name: string;
  family: string | null;
  provenanceLabel: string;
  isVerified: boolean;
  isDemoFixture: boolean;
  classifiedCellRole: Exclude<GapCoverageStatus, "UNAVAILABLE">;
  missingFields: string[];
  measurementCount: number;
  hasSourceLocator: boolean;
  gravityDisplay: string;
};

export type EvidenceGapCell = {
  cellId: string;
  gravity: RadarGravityAxis;
  gravityLabel: string;
  missionContextLabel: string;
  suggestedHabitatId: "ISS" | "LUNAR_HABITAT" | "MARS_HABITAT" | "CUSTOM";
  domain: RadarSafetyDomain;
  domainLabel: string;
  highestStatus: GapCoverageStatus;
  counts: {
    totalInCell: number;
    direct: number;
    analogous: number;
    planned: number;
    verified: number;
    demoOnly: number;
  };
  includedRecords: GapRecordSummary[];
  adjacentPartialContextRecords: GapRecordSummary[];
  missingEvidenceReasons: string[];
  proposedResearchQuestions: string[];
};

export type EvidenceGapRadarReport = {
  datasetScope: DatasetScopeSummary;
  unclassifiedPartialRecords: GapRecordSummary[];
  cells: EvidenceGapCell[];
  totalsByStatus: Record<GapCoverageStatus, number>;
};

function classifyRecordForCell(rec: ScopeRecord): Exclude<GapCoverageStatus, "UNAVAILABLE"> {
  if (rec.evidenceLevel === "PLANNED") return "PLANNED";
  const verified = isRecordVerified(rec);
  const measCount = presentMeasurementTotal(rec);
  if (verified && rec.evidenceLevel === "DIRECT" && measCount > 0) {
    return "DIRECT";
  }
  return "ANALOGOUS";
}

function summarizeRecord(rec: ScopeRecord): GapRecordSummary {
  const verified = isRecordVerified(rec);
  const measCount = presentMeasurementTotal(rec);
  const missing: string[] = [];
  if (extractRecordNumericCondition(rec, "oxygen_concentration").missing) missing.push("Oxygen concentration");
  if (extractRecordNumericCondition(rec, "pressure").missing) missing.push("Pressure");
  if (extractRecordNumericCondition(rec, "airflow").missing) missing.push("Airflow");
  if (measCount === 0) missing.push("Recorded outcome measurements");
  if (!rec.source) missing.push("Source locator document");

  return {
    id: rec.id,
    name: rec.name,
    family: rec.family,
    provenanceLabel: formatProvenanceTag(rec.provenanceStatus, rec.source),
    isVerified: verified,
    isDemoFixture: rec.provenanceStatus === "DEMO_FIXTURE",
    classifiedCellRole: classifyRecordForCell(rec),
    missingFields: Array.from(new Set([...rec.conditions.missingFields, ...missing])),
    measurementCount: measCount,
    hasSourceLocator: Boolean(rec.source),
    gravityDisplay: rec.conditions.gravity || rec.gravityEnvironments[0] || "NOT REPORTED",
  };
}

function generateProposedQuestions(
  gravityAxis: (typeof RADAR_GRAVITY_AXES)[number],
  domain: RadarSafetyDomain,
  included: GapRecordSummary[],
  adjacentPartial: GapRecordSummary[],
  datasetScope: DatasetScopeSummary,
): string[] {
  const domainLower = domain.toLocaleLowerCase();
  const questions: string[] = [];

  if (included.length === 0) {
    questions.push(
      `Proposal: In the currently indexed OrbitFlame dataset (${datasetScope.totalRecords} records), 0 records directly document ${gravityAxis.shortLabel.toLocaleLowerCase()} ${domainLower} testing. Are primary PSI/NTRS reports available externally for ${gravityAxis.missionContextLabel.toLocaleLowerCase()} conditions?`,
    );
    if ((gravityAxis.id === "LUNAR_GRAVITY" || gravityAxis.id === "MARS_GRAVITY") && adjacentPartial.length > 0) {
      questions.push(
        `Proposal: How do unspecified partial-gravity surrogate records (${adjacentPartial.map((r) => r.id).join(", ")}) compare against dedicated ${gravityAxis.label} ${domainLower} measurements once curated?`,
      );
    }
    questions.push(
      `Proposal: What minimum O₂ concentration, ambient pressure, and forced-ventilation bands would need to be documented before evaluating ${domainLower} hardware for ${gravityAxis.missionContextLabel.toLocaleLowerCase()}?`,
    );
    return questions;
  }

  const missingO2 = included.filter((r) => r.missingFields.includes("Oxygen concentration")).map((r) => r.id);
  const missingP = included.filter((r) => r.missingFields.includes("Pressure")).map((r) => r.id);
  const missingAir = included.filter((r) => r.missingFields.includes("Airflow")).map((r) => r.id);
  const missingMeas = included.filter((r) => r.measurementCount === 0).map((r) => r.id);

  if (missingMeas.length > 0) {
    questions.push(
      `Proposal: Which primary NASA tables or PSI datasets supply scalar/time-series outcome measurements (currently absent on ${missingMeas.join(", ")}) for ${gravityAxis.shortLabel.toLocaleLowerCase()} ${domainLower}?`,
    );
  }
  if (missingAir.length > 0 || missingP.length > 0 || missingO2.length > 0) {
    const missingDims = [
      missingO2.length > 0 ? `oxygen (${missingO2.join(", ")})` : null,
      missingP.length > 0 ? `pressure (${missingP.join(", ")})` : null,
      missingAir.length > 0 ? `airflow (${missingAir.join(", ")})` : null,
    ]
      .filter(Boolean)
      .join("; ");
    questions.push(
      `Proposal: Can omitted environmental boundary parameters — specifically ${missingDims} — be recovered from source experimental logs without interpolation?`,
    );
  }
  if (included.every((r) => !r.isVerified)) {
    questions.push(
      `Proposal: Replacing demo fixtures (${included.map((r) => r.id).join(", ")}) with source-verified NASA records carrying page/table locators would elevate traceability for ${gravityAxis.shortLabel.toLocaleLowerCase()} ${domainLower}.`,
    );
  }

  return questions;
}

export function buildEvidenceGapRadar(records: ScopeRecord[]): EvidenceGapRadarReport {
  const datasetScope = deriveDatasetScope(records);

  const partialUnspecified = records
    .filter((rec) => {
      const reg = classifyGravityRegime(rec.conditions.gravity || rec.gravityEnvironments[0]);
      return reg === "PARTIAL_GRAVITY";
    })
    .map(summarizeRecord);

  const cells: EvidenceGapCell[] = [];
  const totalsByStatus: Record<GapCoverageStatus, number> = {
    DIRECT: 0,
    ANALOGOUS: 0,
    PLANNED: 0,
    UNAVAILABLE: 0,
  };

  for (const domainObj of RADAR_DOMAINS) {
    for (const gravAxis of RADAR_GRAVITY_AXES) {
      const matching = records.filter((rec) => {
        const reg = classifyGravityRegime(rec.conditions.gravity || rec.gravityEnvironments[0]);
        return reg === gravAxis.id && rec.safetyDomains.includes(domainObj.id);
      });

      const includedRecords = matching.map(summarizeRecord);
      const adjacentPartialContextRecords =
        gravAxis.id === "LUNAR_GRAVITY" || gravAxis.id === "MARS_GRAVITY"
          ? records
              .filter((rec) => {
                const reg = classifyGravityRegime(rec.conditions.gravity || rec.gravityEnvironments[0]);
                return reg === "PARTIAL_GRAVITY" && rec.safetyDomains.includes(domainObj.id);
              })
              .map(summarizeRecord)
          : [];

      const directCount = includedRecords.filter((r) => r.classifiedCellRole === "DIRECT").length;
      const analogousCount = includedRecords.filter((r) => r.classifiedCellRole === "ANALOGOUS").length;
      const plannedCount = includedRecords.filter((r) => r.classifiedCellRole === "PLANNED").length;
      const verifiedCount = includedRecords.filter((r) => r.isVerified).length;
      const demoOnlyCount = includedRecords.filter((r) => r.isDemoFixture).length;

      let highestStatus: GapCoverageStatus = "UNAVAILABLE";
      if (directCount > 0) highestStatus = "DIRECT";
      else if (analogousCount > 0) highestStatus = "ANALOGOUS";
      else if (plannedCount > 0) highestStatus = "PLANNED";

      totalsByStatus[highestStatus] += 1;

      const missingEvidenceReasons: string[] = [];
      if (includedRecords.length === 0) {
        missingEvidenceReasons.push(
          `Zero indexed records exist in OrbitFlame for ${gravAxis.label} under the ${domainObj.label} domain.`,
        );
        missingEvidenceReasons.push(
          "Indexed dataset gap ONLY — does not establish whether external NASA PSI/NTRS reports exist outside this index.",
        );
        if (adjacentPartialContextRecords.length > 0) {
          missingEvidenceReasons.push(
            `${adjacentPartialContextRecords.length} generic partial-gravity record(s) (${adjacentPartialContextRecords
              .map((r) => r.id)
              .join(", ")}) exist in ${domainObj.label}, but unspecified partial gravity is NOT treated as direct ${gravAxis.shortLabel} data.`,
          );
        }
      } else {
        if (demoOnlyCount === includedRecords.length) {
          missingEvidenceReasons.push(
            `All ${includedRecords.length} record(s) carry ${DEMO_WARNING} provenance with zero verified NASA source locators.`,
          );
        }
        const noMeas = includedRecords.filter((r) => r.measurementCount === 0);
        if (noMeas.length > 0) {
          missingEvidenceReasons.push(
            `Recorded outcome measurements array is empty on ${noMeas.length}/${includedRecords.length} record(s) (${noMeas.map((r) => r.id).join(", ")}).`,
          );
        }
        const condGaps = includedRecords.filter((r) =>
          r.missingFields.some((f) => f === "Oxygen concentration" || f === "Pressure" || f === "Airflow"),
        );
        if (condGaps.length > 0) {
          missingEvidenceReasons.push(
            `Condition fields are explicitly NOT REPORTED on: ${condGaps
              .map((r) => `${r.id} [${r.missingFields.filter((f) => f !== "Recorded outcome measurements" && f !== "Source locator document").join(", ")}]`)
              .join("; ")}.`,
          );
        }
      }

      const proposedResearchQuestions = generateProposedQuestions(
        gravAxis,
        domainObj.id,
        includedRecords,
        adjacentPartialContextRecords,
        datasetScope,
      );

      cells.push({
        cellId: `${gravAxis.id}__${domainObj.id}`,
        gravity: gravAxis.id,
        gravityLabel: gravAxis.label,
        missionContextLabel: gravAxis.missionContextLabel,
        suggestedHabitatId: gravAxis.suggestedHabitatId,
        domain: domainObj.id,
        domainLabel: domainObj.label,
        highestStatus,
        counts: {
          totalInCell: includedRecords.length,
          direct: directCount,
          analogous: analogousCount,
          planned: plannedCount,
          verified: verifiedCount,
          demoOnly: demoOnlyCount,
        },
        includedRecords,
        adjacentPartialContextRecords,
        missingEvidenceReasons,
        proposedResearchQuestions,
      });
    }
  }

  return {
    datasetScope,
    unclassifiedPartialRecords: partialUnspecified,
    cells,
    totalsByStatus,
  };
}
