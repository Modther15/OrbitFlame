import { handleFlammability } from "@/lib/server/predict";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Gated empirical predictors + analytical ventilation / LOC physics for one operating point. */
export const POST = handleFlammability;
