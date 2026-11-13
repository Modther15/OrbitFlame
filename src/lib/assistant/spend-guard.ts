import fs from "node:fs";
import path from "node:path";

/**
 * Local soft budget for OpenAI spend. Estimates cost from response.usage and
 * refuses new calls once the cap is reached. This is a safety net only: also set a
 * hard limit in the OpenAI dashboard (Settings -> Billing -> Limits).
 */
export const BUDGET_USD = Number(process.env.OPENAI_BUDGET_USD) > 0 ? Number(process.env.OPENAI_BUDGET_USD) : 1;

// USD per 1M tokens (input, output). Only allowlisted models are used.
export const ALLOWED_MODELS: Record<string, { in: number; out: number }> = {
  "gpt-4o-mini": { in: 0.15, out: 0.6 },
  "gpt-4.1-nano": { in: 0.1, out: 0.4 },
  "gpt-4.1-mini": { in: 0.4, out: 1.6 },
  // Price unknown to this code: conservative placeholder so the $ cap trips early.
  // Override with OPENAI_PRICE_IN_PER_M / OPENAI_PRICE_OUT_PER_M from the real pricing page.
  "gpt-6-luna": {
    in: Number(process.env.OPENAI_PRICE_IN_PER_M) || 5,
    out: Number(process.env.OPENAI_PRICE_OUT_PER_M) || 20,
  },
};
export const SAFE_DEFAULT_MODEL = "gpt-4o-mini";

const LEDGER = path.join(process.cwd(), ".openai_spend.json");

function readSpent(): number {
  try {
    return Number(JSON.parse(fs.readFileSync(LEDGER, "utf8")).spent_usd) || 0;
  } catch {
    return 0;
  }
}

export function resolveModel(requested?: string): string {
  const m = requested?.trim();
  return m && m in ALLOWED_MODELS ? m : SAFE_DEFAULT_MODEL;
}

export function budgetRemaining(): number {
  return BUDGET_USD - readSpent();
}

export function recordUsage(model: string, inputTokens: number, outputTokens: number): void {
  const p = ALLOWED_MODELS[model] ?? ALLOWED_MODELS[SAFE_DEFAULT_MODEL];
  const cost = (inputTokens * p.in + outputTokens * p.out) / 1_000_000;
  try {
    fs.writeFileSync(LEDGER, JSON.stringify({ spent_usd: readSpent() + cost, updated: new Date().toISOString() }));
  } catch {
    /* ledger write failure must not break the response */
  }
}
