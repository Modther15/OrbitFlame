import { ok } from "@/lib/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Index of the built-in API (same shapes as the optional Python backend; served from the committed snapshots in public/data). */
export function GET() {
  return ok({
    name: "OrbitFlame built-in API",
    note: "Same-origin routes backed by the committed NASA PSI snapshots (public/data). Set NEXT_PUBLIC_API_BASE to prefer an external backend with the same routes.",
    get: [
      "/api/health", "/api/investigations", "/api/investigations/{id}", "/api/investigations/{id}/runs", "/api/tests", "/api/row?row_uid=",
      "/api/habitats", "/api/rank?habitat=", "/api/rank/all", "/api/effective-gravity", "/api/predict/grid", "/api/smoke-dust/examples",
      "/api/model-metrics", "/api/model-audit", "/api/variable-summary", "/api/conversions", "/api/provenance",
    ],
    post: [
      "/api/rank-habitat", "/api/predict/flammability", "/api/predict-flammability", "/api/predict/smoke-dust", "/api/classify-aerosol",
      "/api/ingest-psi", "/api/upload", "/api/assistant", "/api/mission-explain",
    ],
  });
}
