import { DemoInvestigationSchema, type DemoInvestigation } from "@/lib/api/schemas";

export const DEMO_WARNING = "DEMO FIXTURE — FICTIONAL DATA — NOT NASA MEASUREMENTS" as const;

const definitions = [
  ["D-001", "Polymer strip response under low-flow conditions", "BASS", "Fictional polymer composite", "Microgravity (illustrative)", "PREVENTION", 20, 98, 0.04],
  ["D-002", "Textile ignition observation series", "BASS", "Fictional woven cellulose blend", "Normal gravity (illustrative)", "PREVENTION", 21, 101, 0.12],
  ["D-003", "Barrier material comparison trial", "BASS", "Fictional coated polymer sheet", "Microgravity (illustrative)", "PREVENTION", 18, 90, null],
  ["D-004", "Enclosure flame response study", "SAFFIRE", "Fictional cabin liner sample", "Microgravity (illustrative)", "PREVENTION", 23, 100, 0.08],
  ["D-005", "Smoke sensor response characterization", "SAME", "Fictional aerosol surrogate", "Microgravity (illustrative)", "DETECTION", 20, 95, null],
  ["D-006", "Particle transport and detector timing", "SAME", "Fictional particulate blend", "Partial gravity (hypothetical)", "DETECTION", null, 80, 0.03],
  ["D-007", "Optical sensor visibility assessment", "SAME", "Fictional smoke surrogate", "Normal gravity (illustrative)", "DETECTION", 19, null, 0.06],
  ["D-008", "Droplet extinction observation series", "FLEX", "Fictional liquid surrogate", "Microgravity (illustrative)", "SUPPRESSION", 17, 92, 0.02],
  ["D-009", "Suppression agent dispersion concept test", "FLEX", "Fictional suppressant surrogate", "Microgravity (illustrative)", "SUPPRESSION", null, null, null],
  ["D-010", "Premixed burner geometry comparison", "ACME", "Fictional gaseous fuel blend", "Normal gravity (illustrative)", "PREVENTION", 15, 100, 0.18],
  ["D-011", "Flame stability with varied dilution", "ACME", "Fictional methane-like blend", "Microgravity (illustrative)", "PREVENTION", 16, 85, 0.05],
  ["D-012", "Sensor cross-check in chamber mockup", "SAME", "Fictional aerosol surrogate", "Microgravity (illustrative)", "DETECTION", 20, null, 0.01],
] as const;

function makeRecord(row: typeof definitions[number]): DemoInvestigation {
  const [id, name, family, fuelMaterial, gravity, domain, oxygenPercent, pressureKpa, airflowMps] = row;
  const missingFields = [
    oxygenPercent === null ? "Oxygen concentration" : null,
    pressureKpa === null ? "Pressure" : null,
    airflowMps === null ? "Airflow" : null,
  ].filter((field): field is string => field !== null);
  return DemoInvestigationSchema.parse({
    id, name, acronym: family, family,
    objective: `Fictional demo objective for exploring ${domain.toLowerCase()} research workflows and evidence presentation.`,
    summary: "Illustrative interface fixture only. This record describes no real experiment.",
    safetyDomains: [domain], gravityEnvironments: [gravity], provenanceStatus: "DEMO_FIXTURE",
    evidenceLevel: "ANALOGOUS", source: null,
    testRuns: [{ id: `${id}-R1`, sourceRunKey: null, label: "Illustrative run 1", objectiveVariant: "Fictional test variation", provenanceStatus: "DEMO_FIXTURE", conditions: [], measurements: [] }],
    fuelMaterial,
    conditions: { oxygenPercent, pressureKpa, airflowMps, gravity, missingFields },
    findingsSummary: "Fictional findings summary supplied to exercise cards and detail layouts; not a scientific result.",
    dataCompleteness: Math.round(((3 - missingFields.length) / 3) * 100),
    fixtureLabel: DEMO_WARNING,
  });
}

export const demoInvestigations: DemoInvestigation[] = definitions.map(makeRecord);
