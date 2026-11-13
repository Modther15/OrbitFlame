import { serverBackend } from "@/lib/api/backend-server";
import type { DataSourceMode } from "@/lib/api/backend-types";
import type { DemoInvestigation } from "@/lib/api/schemas";
import { demoInvestigations } from "@/lib/demo/dataset";
import { toSummary, type InvestigationSummary } from "@/lib/data/summary";
import { mapRowsToInvestigations, psiIdFromRecordId } from "@/lib/data/psi-mapper";

export type InvestigationQuery = { search?: string; family?: string; domain?: string; gravity?: string; sort?: "name-asc" | "name-desc" | "completeness" };
export interface InvestigationRepository {
  readonly mode: "backend" | "demo" | "api";
  list(query?: InvestigationQuery): Promise<DemoInvestigation[]>;
  getById(id: string): Promise<DemoInvestigation | null>;
}

/** Slim list-view records (no testRuns/measurements arrays). */
export async function listSummaries(query?: InvestigationQuery): Promise<InvestigationSummary[]> {
  return (await investigationRepository.list(query)).map(toSummary);
}

function filterAndSort(all: DemoInvestigation[], query: InvestigationQuery): DemoInvestigation[] {
  const term = query.search?.trim().toLocaleLowerCase();
  const results = all.filter((record) => {
    const searchable = [record.id, record.name, record.family, record.fuelMaterial, record.objective, record.findingsSummary].join(" ").toLocaleLowerCase();
    return (!term || searchable.includes(term))
      && (!query.family || record.family === query.family)
      && (!query.domain || record.safetyDomains.includes(query.domain as typeof record.safetyDomains[number]))
      && (!query.gravity || record.conditions.gravity === query.gravity || record.gravityEnvironments.includes(query.gravity));
  });
  if (query.sort === "name-desc") results.sort((a, b) => b.name.localeCompare(a.name));
  else if (query.sort === "completeness") results.sort((a, b) => b.dataCompleteness - a.dataCompleteness);
  else if (query.sort === "name-asc") results.sort((a, b) => a.name.localeCompare(b.name));
  return results;
}

/** Cached mapped dataset (2 min) so one page render does not re-fetch/re-map repeatedly. */
let cache: { at: number; records: DemoInvestigation[]; source: DataSourceMode } | null = null;
async function loadAll(): Promise<{ records: DemoInvestigation[]; source: DataSourceMode }> {
  if (cache && Date.now() - cache.at < 120_000) return cache;
  try {
    const { data, source } = await serverBackend.investigations();
    const records = mapRowsToInvestigations(data.rows, data.investigation_meta);
    if (records.length > 0) {
      cache = { at: Date.now(), records, source };
      return cache;
    }
  } catch {
    // fall through to the last-resort fictional fixtures
  }
  return { records: demoInvestigations, source: "fixture" };
}

const backendRepository: InvestigationRepository = {
  mode: "backend",
  async list(query = {}) {
    return filterAndSort((await loadAll()).records, query);
  },
  async getById(id) {
    const { records } = await loadAll();
    const key = id.toLocaleLowerCase();
    const psiKey = psiIdFromRecordId(id).toLocaleLowerCase();
    return records.find((r) => r.id.toLocaleLowerCase() === key || r.id.toLocaleLowerCase() === psiKey.replace(/\s+/g, "-")) ?? null;
  },
};

const demoRepository: InvestigationRepository = {
  mode: "demo",
  async list(query = {}) {
    const r = filterAndSort(demoInvestigations, query);
    return query.sort ? r : r.sort((a, b) => a.name.localeCompare(b.name));
  },
  async getById(id) {
    return demoInvestigations.find((record) => record.id.toLocaleLowerCase() === id.toLocaleLowerCase()) ?? null;
  },
};

/** DEMO_MODE=true forces the legacy fictional fixtures; default uses live API / static snapshot data. */
export const DEMO_MODE = process.env.DEMO_MODE === "true";
export const investigationRepository: InvestigationRepository = DEMO_MODE ? demoRepository : backendRepository;

/** Where the current dataset came from (for the data-source badge). */
export async function getDatasetSource(): Promise<DataSourceMode> {
  return DEMO_MODE ? "fixture" : (await loadAll()).source;
}
