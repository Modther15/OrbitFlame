import { handleSmoke } from "@/lib/server/predict";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** SAME / SAME-R smoke-aging analyzer: fitted model when it passed the baseline gate, else nearest real tests (never an error). */
export const POST = handleSmoke;
