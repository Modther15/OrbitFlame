import { demoInvestigations } from "@/lib/demo/dataset";
import type { DemoInvestigation } from "@/lib/api/schemas";

export type InvestigationQuery = { search?: string; family?: string; domain?: string; gravity?: string; sort?: "name-asc" | "name-desc" | "completeness" };
export interface InvestigationRepository {
  readonly mode: "demo" | "api";
  list(query?: InvestigationQuery): Promise<DemoInvestigation[]>;
  getById(id: string): Promise<DemoInvestigation | null>;
}

const demoRepository: InvestigationRepository = {
  mode: "demo",
  async list(query = {}) {
    const term = query.search?.trim().toLocaleLowerCase();
    const results = demoInvestigations.filter((record) => {
      const searchable = [record.id, record.name, record.family, record.fuelMaterial, record.objective, record.findingsSummary].join(" ").toLocaleLowerCase();
      return (!term || searchable.includes(term))
        && (!query.family || record.family === query.family)
        && (!query.domain || record.safetyDomains.includes(query.domain as typeof record.safetyDomains[number]))
        && (!query.gravity || record.conditions.gravity === query.gravity || record.gravityEnvironments.includes(query.gravity));
    });
    if (query.sort === "name-desc") results.sort((a, b) => b.name.localeCompare(a.name));
    else if (query.sort === "completeness") results.sort((a, b) => b.dataCompleteness - a.dataCompleteness);
    else results.sort((a, b) => a.name.localeCompare(b.name));
    return results;
  },
  async getById(id) {
    return demoInvestigations.find((record) => record.id.toLocaleLowerCase() === id.toLocaleLowerCase()) ?? null;
  },
};

const apiRepository: InvestigationRepository = {
  mode: "api",
  async list() { throw new Error("Production investigation API contract is not configured."); },
  async getById() { throw new Error("Production investigation API contract is not configured."); },
};

export const DEMO_MODE = process.env.DEMO_MODE !== "false";
export const investigationRepository = DEMO_MODE ? demoRepository : apiRepository;
