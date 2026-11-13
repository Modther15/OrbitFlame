import { BENCHMARK_LABEL, type InvestigationMeta, type PsiRow } from "@/lib/api/backend-types";
import { DemoInvestigationSchema, type Condition, type DemoInvestigation, type Measurement, type SourceLocator, type TestRun } from "@/lib/api/schemas";
import { normalizeToKnownSi } from "@/lib/science/units";

type Meta = { family: string; domain: DemoInvestigation["safetyDomains"][number] };

/** Project taxonomy (family / safety pillar) per PSI id. Titles, objectives and hardware come from the PSI investigation records. */
const TAXONOMY: Record<string, Meta> = {
  "PSI-25": { family: "BASS", domain: "PREVENTION" },
  "PSI-26": { family: "BASS", domain: "PREVENTION" },
  "PSI-98": { family: "SAFFIRE", domain: "PREVENTION" },
  "PSI-99": { family: "SAFFIRE", domain: "PREVENTION" },
  "PSI-100": { family: "SAFFIRE", domain: "PREVENTION" },
  "PSI-159": { family: "ACME", domain: "PREVENTION" },
  "PSI-10": { family: "ACME", domain: "PREVENTION" },
  "PSI-60": { family: "ACME", domain: "PREVENTION" },
  "PSI-107": { family: "ACME", domain: "PREVENTION" },
  "PSI-20": { family: "ACME", domain: "PREVENTION" },
  "PSI-21": { family: "ACME", domain: "PREVENTION" },
  "PSI-22": { family: "ACME", domain: "PREVENTION" },
  "PSI-39": { family: "FLEX", domain: "SUPPRESSION" },
  "PSI-47": { family: "SAME", domain: "DETECTION" },
  "PSI-68": { family: "FLEX", domain: "SUPPRESSION" },
  "PSI-69": { family: "FLEX", domain: "SUPPRESSION" },
  "PSI-142": { family: "FLEX", domain: "SUPPRESSION" },
  "PSI-101": { family: "SAME", domain: "DETECTION" },
  "PSI-102": { family: "SAME", domain: "DETECTION" },
  "PSI-115": { family: "SAME", domain: "DETECTION" },
};

export const BENCHMARK_DOC_ID = "NASA-PSI-RAW";
const PSI_URL = "https://psi.nasa.gov";

function locatorFor(psiId: string, file: string, allFiles: string[]): SourceLocator {
  return {
    sourceDocumentId: file,
    sourceTitle: `NASA PSI ${psiId}: ${allFiles.join("; ")}`,
    sourceUrl: PSI_URL,
    pageNumber: null,
    sectionHeading: "Experimental table / test matrix downloaded from psi.nasa.gov",
    tableFigureLabel: null,
    rowOrRecordKey: null,
    verificationStatus: "VERIFIED",
  };
}

export function recordIdFromPsi(psiId: string): string {
  return psiId.trim().replace(/\s+/g, "-");
}
export function psiIdFromRecordId(id: string): string {
  return id.toUpperCase().startsWith("ACME-") ? id.replace(/-/g, " ").replace("E FIELD", "E-FIELD") : id;
}

export function gravityLabel(g: number | null | undefined): string {
  if (g === null || g === undefined || !Number.isFinite(g)) return "Not reported";
  if (g === 0) return "Microgravity (0 g)";
  if (Math.abs(g - 0.16) < 0.011) return "Lunar gravity (0.16 g)";
  if (Math.abs(g - 0.38) < 0.011) return "Mars gravity (0.38 g)";
  if (Math.abs(g - 1) < 0.011) return "Normal gravity (1 g)";
  return `Partial gravity (${g} g)`;
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}
function median(values: (number | null)[]): number | null {
  const v = values.filter((x): x is number => x !== null).sort((a, b) => a - b);
  if (!v.length) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}
function round(v: number | null, d = 3): number | null {
  return v === null ? null : Math.round(v * 10 ** d) / 10 ** d;
}
function mode<T>(items: T[]): T | null {
  const c = new Map<T, number>();
  for (const i of items) c.set(i, (c.get(i) ?? 0) + 1);
  let best: T | null = null;
  let n = 0;
  for (const [k, v] of c) if (v > n) { best = k; n = v; }
  return best;
}

/** Truncate at a sentence boundary (else a word boundary) and append "..."; never cuts mid-word. */
export function cleanTruncate(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;
  const head = t.slice(0, max);
  const sentence = Math.max(head.lastIndexOf(". "), head.lastIndexOf(".\n"), head.lastIndexOf("? "), head.lastIndexOf("; "));
  if (sentence >= max * 0.5) return `${head.slice(0, sentence + 1).trim()} ...`;
  const word = head.lastIndexOf(" ");
  return `${head.slice(0, word > 0 ? word : max).replace(/[,;:(\-\s]+$/, "")} ...`;
}

function cond(parameterKey: string, value: number | null, unit: string) {
  const norm = normalizeToKnownSi(value, value !== null ? unit : null);
  return {
    parameterKey,
    valueOriginal: value,
    textOriginal: null,
    unitOriginal: value !== null ? unit : null,
    valueSi: norm.valueSi,
    unitSi: norm.unitSi,
    missingStatus: value !== null ? ("PRESENT" as const) : ("NOT_REPORTED" as const),
    source: null,
  };
}

function meas(id: string, metricKey: string, label: string, value: number | null, unit: string, si?: { value: number; unit: string }): Measurement | null {
  if (value === null) return null;
  return {
    id: `${id}-${metricKey}`,
    metricKey,
    label,
    valueOriginal: value,
    textOriginal: null,
    unitOriginal: unit,
    valueSi: si ? si.value : value,
    unitSi: si ? si.unit : unit,
    measurementStatus: "REPORTED",
    missingStatus: "PRESENT",
    source: null,
  };
}

/** PSI-68 radiometer workbook: summary values parsed from the sheet header cells / frames (units only where the workbook states them). */
function radiometerSummaryMeasurements(id: string, row: PsiRow, loc: SourceLocator): Measurement[] {
  let extra: Record<string, unknown> = {};
  try {
    extra = typeof row.extra_metrics_json === "string" ? (JSON.parse(row.extra_metrics_json) as Record<string, unknown>) : {};
  } catch {
    extra = {};
  }
  const n = (k: string) => (typeof extra[k] === "number" && Number.isFinite(extra[k] as number) ? (extra[k] as number) : null);
  const t = (k: string) => (typeof extra[k] === "string" ? (extra[k] as string) : null);
  const out: Measurement[] = [];
  const push = (key: string, label: string, value: number | null, unit: string | null) => {
    if (value === null) return;
    out.push({ id: `${id}-${key}`, metricKey: key, label, valueOriginal: value, textOriginal: null, unitOriginal: unit, valueSi: unit === "ms" ? value / 1000 : value, unitSi: unit === "ms" ? "s" : unit, measurementStatus: "REPORTED", missingStatus: "PRESENT", source: loc });
  };
  push("igniter_on_time", "Igniter on time (sheet cell A2, unit written in the label)", n("igniter_on_time_ms"), "ms");
  push("igniter_wattage_value", "Igniter wattage value (sheet cell A2; unit symbol not written)", n("igniter_wattage_value"), null);
  push("radiometer_frames", "Radiometer frames in sheet", n("n_frames"), null);
  push("igniter_on_frames", "Frames with igniter status On", n("igniter_on_frames"), null);
  push("frame_span", "Frame span (last minus first PIP TimeStamp)", n("frame_span_s_from_pip_timestamps"), "s");
  push("max_nb_sample", `Max NB_SAMPLE value (row ${n("max_nb_sample_at_source_row") ?? "?"}; unit not stated)`, n("max_nb_sample_value"), null);
  push("max_wb_sample", "Max WB_SAMPLE value (unit not stated)", n("max_wb_sample_value"), null);
  for (const [k, label] of [["as_burn_to_completion_igniter_on", "AS burn to completion / igniter on (cell A3 timestamp)"], ["as_igniter_off_retract_start", "AS igniter off / retract start (cell A3 timestamp)"]] as const) {
    const v = t(k);
    if (v) out.push({ id: `${id}-${k}`, metricKey: k, label, valueOriginal: null, textOriginal: v, unitOriginal: null, valueSi: null, unitSi: null, measurementStatus: "REPORTED", missingStatus: "PRESENT", source: loc });
  }
  return out;
}

/** Output columns that live in extra_metrics_json (same columns the variable panel lists as MEASURED); units only where the PSI header states one. */
const EXTRA_MEASURED: Record<string, { key: string; label: string; unit: string | null }> = {
  rt_r0: { key: "rt_r0", label: "Rt/R0 (ratio; no unit stated)", unit: null },
  weight_loss_rate_mg_min: { key: "weight_loss_rate", label: "Weight loss rate", unit: "mg/min" },
  final_o2_pct_by_vol: { key: "final_o2", label: "Final O2 (header: % by vol)", unit: "%" },
  final_co2_pct_by_vol: { key: "final_co2", label: "Final CO2 (header: % by vol)", unit: "%" },
  final_co_ppm: { key: "final_co", label: "Final CO", unit: "ppm" },
  mean_zst: { key: "mean_zst", label: "Mean Zst (unit not stated)", unit: null },
};

function extraMeasurements(id: string, row: PsiRow): Measurement[] {
  if (typeof row.extra_metrics_json !== "string" || row.row_kind === "radiometer_test_summary") return [];
  let extra: Record<string, unknown> = {};
  try {
    extra = JSON.parse(row.extra_metrics_json) as Record<string, unknown>;
  } catch {
    return [];
  }
  const out: Measurement[] = [];
  for (const [k, spec] of Object.entries(EXTRA_MEASURED)) {
    const v = extra[k];
    if (typeof v === "number" && Number.isFinite(v)) {
      const m = meas(id, spec.key, spec.label, v, spec.unit ?? "");
      if (m) out.push({ ...m, unitOriginal: spec.unit, unitSi: spec.unit, valueSi: v });
    }
  }
  return out;
}

function toRun(row: PsiRow, loc: SourceLocator): TestRun {
  const id = `${row.psi_id}-${row.source_row ?? ""}-${row.test_id}`.replace(/\s+/g, "_");
  const g = num(row.gravity_g);
  const flow = num(row.flow_velocity_cm_s);
  const ext = num(row.extinction_flag);
  const ign = num(row.ignited);
  const present = (v: number | null) => (v !== null ? loc : null);
  const withSrc = <T extends { missingStatus: string; source: SourceLocator | null }>(c: T): T => (c.missingStatus === "PRESENT" ? { ...c, source: loc } : c);
  const measurements: Measurement[] = [
    meas(id, "flame_spread_rate", "Flame spread rate", num(row.flame_spread_rate_mm_s), "mm/s", num(row.flame_spread_rate_mm_s) !== null ? { value: (row.flame_spread_rate_mm_s as number) / 1000, unit: "m/s" } : undefined),
    meas(id, "burn_time", "Burn time", num(row.burn_time_s), "s"),
    meas(id, "droplet_burning_rate_constant", "Droplet burning-rate constant K", num(row.droplet_burn_rate_k_mm2_s), "mm²/s"),
    meas(id, "droplet_initial_diameter", "Droplet initial diameter", num(row.droplet_diameter_mm), "mm"),
    meas(id, "adiabatic_flame_temperature", "Tabulated adiabatic flame temperature", num(row.t_ad_k), "K"),
    meas(id, "sample_thickness", "Sample thickness / nozzle diameter", num(row.sample_thickness_mm), "mm"),
  ].filter((m): m is Measurement => m !== null).map((m) => ({ ...m, source: loc }));
  const text = (key: string, label: string, t: string): Measurement => ({
    id: `${id}-${key}`, metricKey: key, label, valueOriginal: null, textOriginal: t, unitOriginal: null, valueSi: null, unitSi: null,
    measurementStatus: "QUALITATIVE", missingStatus: "PRESENT", source: loc,
  });
  if (ign !== null) measurements.push(text("ignition_outcome", "Hot ignition (as recorded)", row.outcome_raw ?? (ign >= 0.5 ? "Yes" : "No")));
  else if (row.outcome_raw) measurements.push(text("test_outcome", "Test outcome (as recorded)", String(row.outcome_raw)));
  if (ext !== null && row.psi_id !== "PSI-159") measurements.push(text("extinction_outcome", "Extinction outcome", ext >= 0.5 ? "Extinction" : "Burned to completion"));
  else if (ext !== null) measurements.push(text("self_extinction", "Flame end mode", ext >= 0.5 ? "Self-extinguished (SE)" : "Flow terminated (FT)"));
  if (row.row_kind === "radiometer_test_summary") measurements.push(...radiometerSummaryMeasurements(id, row, loc));
  measurements.push(...extraMeasurements(id, row).map((m) => ({ ...m, source: loc })));
  const nfl = num(row.n_flames_ignited);
  if (nfl !== null) measurements.push({ id: `${id}-flames_ignited`, metricKey: "flames_ignited", label: "Flames ignited (count per test day)", valueOriginal: nfl, textOriginal: null, unitOriginal: null, valueSi: nfl, unitSi: null, measurementStatus: "REPORTED", missingStatus: "PRESENT", source: loc });
  const effG = num(row.effective_gravity_g);
  const conditions: Condition[] = [
    withSrc(cond("oxygen_concentration", num(row.o2_pct), "%")),
    withSrc(cond("pressure", num(row.pressure_kpa), "kPa")),
    withSrc(cond("airflow", flow, "cm/s")),
    { parameterKey: "gravity", valueOriginal: null, textOriginal: gravityLabel(g), unitOriginal: null, valueSi: null, unitSi: null, missingStatus: g === null ? ("NOT_REPORTED" as const) : ("PRESENT" as const), source: present(g) },
  ];
  // actual gravity (numeric, for badges) + effective-gravity HEURISTIC PROXY + provenance of both
  if (g !== null) conditions.push({ parameterKey: "gravity_value", valueOriginal: g, textOriginal: null, unitOriginal: "g", valueSi: null, unitSi: null, missingStatus: "PRESENT" as const, source: loc });
  if (effG !== null) {
    conditions.push({ parameterKey: "effective_gravity", valueOriginal: Math.round(effG * 1000) / 1000, textOriginal: null, unitOriginal: "g (proxy)", valueSi: null, unitSi: null, missingStatus: "PRESENT" as const, source: loc });
    conditions.push({ parameterKey: "effective_gravity_method", valueOriginal: null, textOriginal: row.effective_gravity_method ?? "direct", unitOriginal: null, valueSi: null, unitSi: null, missingStatus: "PRESENT" as const, source: loc });
  }
  if (typeof row.gravity_source === "string") conditions.push({ parameterKey: "gravity_source", valueOriginal: null, textOriginal: row.gravity_source, unitOriginal: null, valueSi: null, unitSi: null, missingStatus: "PRESENT" as const, source: loc });
  if (num(row.o2_pct) !== null && typeof row.o2_basis === "string" && /XO2 column/.test(row.o2_basis)) {
    conditions.push({ parameterKey: "oxygen_basis", valueOriginal: null, textOriginal: "XO2 x 100; XO2 unit = user-confirmed mol/mol convention, NOT stated in the PSI file", unitOriginal: null, valueSi: null, unitSi: null, missingStatus: "PRESENT" as const, source: loc });
  }
  for (const [key, v] of [["co2_mole_fraction", num(row.co2_mole_pct)], ["he_mole_fraction", num(row.he_mole_pct)]] as const) {
    if (v !== null && v > 0) conditions.push(withSrc(cond(key, v, "%")));
  }
  return {
    id,
    sourceRunKey: `${row.source_file ?? "PSI"} · ${row.source_sheet ?? "table"} · row ${row.source_row ?? "?"}`,
    label: `${row.test_id}${row.sample_name && row.sample_name !== row.test_id ? ` (sample ${row.sample_name})` : ""} · ${row.fuel ?? row.material_raw ?? "fuel not stated"}`,
    objectiveVariant: [row.material_raw && row.material_raw !== row.fuel ? row.material_raw : null, row.flame_type, row.sample_geometry, row.flow_direction, row.diluent && (num(row.co2_mole_pct) || num(row.he_mole_pct)) ? `${row.diluent} diluent` : null, row.row_kind === "radiometer_test_summary" ? "radiometer test-point summary (no fuel / droplet parameters stated in the workbook)" : null].filter(Boolean).join(", ") || null,
    provenanceStatus: "NASA_VERIFIED_DATA" as const,
    conditions,
    measurements,
  };
}

function fmtRange(vals: number[], unit: string, d = 1): string | null {
  if (!vals.length) return null;
  return `${Math.min(...vals).toFixed(d)}–${Math.max(...vals).toFixed(d)} ${unit} (n=${vals.length})`;
}

/** Group backend test-point rows into one DemoInvestigation per PSI investigation (metadata-only record if an id has no rows). */
export function mapRowsToInvestigations(rows: PsiRow[], metas: InvestigationMeta[] = []): DemoInvestigation[] {
  const groups = new Map<string, PsiRow[]>();
  for (const r of rows) {
    const list = groups.get(r.psi_id) ?? [];
    list.push(r);
    groups.set(r.psi_id, list);
  }
  for (const m of metas) if (!groups.has(m.psi_id)) groups.set(m.psi_id, []);
  const metaById = new Map(metas.map((m) => [m.psi_id, m]));
  const out: DemoInvestigation[] = [];
  for (const [psiId, list] of groups) {
    const m = metaById.get(psiId);
    const tax = TAXONOMY[psiId] ?? { family: "ACME", domain: "OTHER" as const };
    const first = list[0];
    const acronym = m?.investigation ?? first?.investigation ?? psiId;
    const title = m?.title ?? acronym;
    const files = Array.from(new Set(list.map((r) => r.source_file).filter((f): f is string => !!f)));
    const loc = locatorFor(psiId, files[0] ?? `${psiId}_investigation.json`, files.length ? files : [`${psiId}_investigation.json`]);
    const fuels = Array.from(new Set(list.map((r) => r.fuel).filter((f): f is string => !!f)));
    const o2 = round(median(list.map((r) => num(r.o2_pct))), 1);
    const p = round(median(list.map((r) => num(r.pressure_kpa))), 1);
    const flowCm = median(list.map((r) => num(r.flow_velocity_cm_s)));
    const airflowMps = flowCm === null ? null : round(flowCm / 100, 4);
    const gravities = Array.from(new Set(list.map((r) => num(r.gravity_g)).filter((g): g is number => g !== null))).sort((a, b) => a - b);
    const domGrav = mode(list.map((r) => num(r.gravity_g)).filter((g): g is number => g !== null));
    const missingFields = [o2 === null ? "Oxygen concentration" : null, p === null ? "Pressure" : null, airflowMps === null ? "Airflow" : null].filter((x): x is string => x !== null);
    const o2Vals = list.map((r) => num(r.o2_pct)).filter((x): x is number => x !== null);
    const pVals = list.map((r) => num(r.pressure_kpa)).filter((x): x is number => x !== null);
    const fVals = list.map((r) => num(r.flow_velocity_cm_s)).filter((x): x is number => x !== null);
    const ignVals = list.map((r) => num(r.ignited)).filter((x): x is number => x !== null);
    const kVals = list.map((r) => num(r.droplet_burn_rate_k_mm2_s)).filter((x): x is number => x !== null);
    const flight = m?.flight_program ?? first?.flight_program ?? null;
    const actualG = num(m?.gravity_g) ?? domGrav;
    const proxyBins: Record<string, number> = {};
    let nProxy = 0;
    for (const r of list) {
      if (r.effective_gravity_method && r.effective_gravity_method !== "direct") {
        nProxy += 1;
        const b = r.effective_gravity_bin ?? "between";
        proxyBins[b] = (proxyBins[b] ?? 0) + 1;
      }
    }
    const gravityInfo = {
      actualG,
      source: m?.gravity_source ?? list.find((r) => r.gravity_source)?.gravity_source ?? null,
      conflict: m?.gravity_conflict ?? null,
      note: m?.gravity_note ?? null,
      nActual0g: list.filter((r) => (num(r.gravity_g) ?? -1) >= 0 && (num(r.gravity_g) as number) < 0.05).length,
      nActual1g: list.filter((r) => Math.abs((num(r.gravity_g) ?? -9) - 1) < 0.05).length,
      nProxyRows: nProxy,
      proxyBins,
    };
    const findings = [
      list.length && list.every((r) => r.row_kind === "radiometer_test_summary") ? `${list.length} radiometer test-point summary rows (${list.map((r) => r.test_id).join(", ")}) parsed from ${files.join("; ")}; the workbook states no fuel, droplet, pressure or O2 values`
        : list.length ? `${list.length.toLocaleString("en-US")} test runs recorded` : "No per-run test table in PSI (investigation record only)",
      fmtRange(o2Vals, "% O2"),
      fmtRange(pVals, "kPa", 1),
      fmtRange(fVals, "cm/s", 1),
      ignVals.length ? `hot ignition in ${ignVals.filter((v) => v >= 0.5).length} of ${ignVals.length} recorded tests` : null,
      kVals.length ? `droplet K ${Math.min(...kVals).toFixed(2)}–${Math.max(...kVals).toFixed(2)} mm²/s (n=${kVals.length})` : null,
      gravityInfo.actualG === null ? null : `${gravityInfo.actualG < 0.05 ? "microgravity (0 g, ISS / Cygnus flight)" : `${gravityInfo.actualG.toFixed(2)} g`}${gravityInfo.nProxyRows ? `; ${gravityInfo.nProxyRows} runs have airflow comparable to partial-gravity buoyancy` : ""}`,
    ].filter(Boolean).join("; ");
    const objective = (m?.objective || m?.approach || "").trim();
    const record = DemoInvestigationSchema.parse({
      id: recordIdFromPsi(psiId),
      name: acronym && title && acronym !== title ? `${acronym} — ${title}` : title,
      acronym,
      family: tax.family,
      objective: objective ? cleanTruncate(objective, 1400) : null,
      summary: `${acronym} (${psiId}${m?.experiment_hardware ? `, ${m.experiment_hardware}` : ""}${flight ? `, ${flight}` : ""}). ${list.length ? `${list.length.toLocaleString("en-US")} test runs from NASA PSI` : "Investigation record only; no per-run test table in PSI"}${m?.doi ? ` (DOI ${m.doi})` : ""}.`,
      safetyDomains: [tax.domain],
      gravityEnvironments: gravities.map(gravityLabel),
      provenanceStatus: "NASA_VERIFIED_DATA",
      evidenceLevel: list.length ? "DIRECT" : "UNAVAILABLE",
      source: loc,
      testRuns: list.map((r) => toRun(r, r.source_file && r.source_file !== loc.sourceDocumentId ? { ...loc, sourceDocumentId: r.source_file } : loc)),
      fuelMaterial: fuels.join(", ") || "Not reported",
      conditions: { oxygenPercent: o2, pressureKpa: p, airflowMps, gravity: gravityLabel(actualG ?? domGrav), missingFields },
      findingsSummary: `${findings}.`,
      dataCompleteness: Math.round(((3 - missingFields.length) / 3) * 100),
      fixtureLabel: list.length
        ? `${BENCHMARK_LABEL} · ${list.length.toLocaleString("en-US")} rows${files.length ? ` · ${files.join("; ")}` : ""}`
        : `${BENCHMARK_LABEL} · INVESTIGATION RECORD (metadata & protocol only; no per-test rows)`,
      hardware: m?.experiment_hardware ?? first?.hardware ?? null,
      flightProgram: flight,
      doi: m?.doi ?? null,
      fuelPhase: Array.from(new Set(list.map((r) => r.fuel_phase).filter((f): f is string => !!f))).join(", ") || null,
      rowStatus: list.length ? "rows" : "metadata_only",
      gravityInfo,
      conditionRanges: {
        o2: o2Vals.length ? [Math.min(...o2Vals), Math.max(...o2Vals)] : null,
        pressureKpa: pVals.length ? [Math.min(...pVals), Math.max(...pVals)] : null,
        airflowCmS: fVals.length ? [Math.min(...fVals), Math.max(...fVals)] : null,
      },
      ranges: {
        o2: fmtRange(o2Vals, "% O2"),
        pressure: fmtRange(pVals, "kPa", 1),
        airflow: fmtRange(fVals, "cm/s", 1),
      },
    });
    out.push(record);
  }
  const order = ["BASS", "SAFFIRE", "ACME", "FLEX", "SAME"];
  return out.sort((a, b) => order.indexOf(a.family ?? "") - order.indexOf(b.family ?? "") || a.id.localeCompare(b.id, undefined, { numeric: true }));
}
