"use client";
/**
 * In-browser execution of the same engines the /api routes use. This is the last fallback when neither an external backend nor the
 * app's own /api routes are reachable (for example a purely static deployment): the predictor bundle and habitat profiles are fetched
 * from /data/*.json and evaluated locally, so the results are identical to the API's.
 */
import type { FlammabilityResponse, SmokeAnalyzerResponse, UploadPayload } from "@/lib/api/backend-types";
import { ingestAndScore, DIRECT_LABEL } from "./ingest";
import type { HabitatProfile } from "./physics";
import type { PredictorBundle } from "./predictor";
import { FlammabilityRequestSchema, SmokeRequestSchema } from "./schemas";
import { flammabilityBody, smokeBody, sourceInfoFrom, type SourceInfo } from "./service";

const memo = new Map<string, Promise<unknown>>();
function snapshot<T>(file: string): Promise<T> {
  let p = memo.get(file);
  if (!p) {
    p = fetch(`/data/${file}`, { cache: "force-cache" }).then((r) => {
      if (!r.ok) throw new Error(`Snapshot ${file} unavailable`);
      return r.json() as Promise<unknown>;
    });
    p.catch(() => memo.delete(file));
    memo.set(file, p);
  }
  return p as Promise<T>;
}
const info = async (): Promise<SourceInfo> => sourceInfoFrom(await snapshot<Record<string, unknown>>("meta.json"));

export async function flammabilityInBrowser(body: unknown): Promise<FlammabilityResponse> {
  const req = FlammabilityRequestSchema.parse(body);
  return flammabilityBody(req, await snapshot<PredictorBundle>("predictor_bundle.json"), await info()) as unknown as FlammabilityResponse;
}

export async function smokeInBrowser(body: unknown): Promise<SmokeAnalyzerResponse> {
  const req = SmokeRequestSchema.parse(body);
  return smokeBody(req, await snapshot<PredictorBundle>("predictor_bundle.json"), await info()) as unknown as SmokeAnalyzerResponse;
}

export async function uploadInBrowser(file: File): Promise<UploadPayload> {
  if (/\.(xlsx|xls)$/i.test(file.name)) {
    throw new Error("Excel workbooks cannot be parsed without the app's API or the optional Python backend. Export the sheet as CSV and try again.");
  }
  if (!/\.(csv|txt|tsv)$/i.test(file.name)) throw new Error("Supported formats: .csv, .txt / .tsv (ISA-Tab)");
  if (file.size > 10_000_000) throw new Error("File too large (10 MB limit)");
  const hab = await snapshot<{ habitats: Array<HabitatProfile & { key: string }> }>("habitats.json");
  const result = ingestAndScore(await file.text(), file.name, Object.fromEntries(hab.habitats.map((h) => [h.key, h])));
  if ("error" in result) throw new Error(result.error);
  return {
    ...(await info()),
    filename: result.filename,
    n_rows: result.n_rows,
    persisted: false,
    source: DIRECT_LABEL,
    rows: result.rows,
  } as UploadPayload;
}
