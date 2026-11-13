import { flammabilityBody, smokeBody } from "@/lib/engine/service";
import { FlammabilityRequestSchema, SmokeRequestSchema } from "@/lib/engine/schemas";
import { NO_STORE, ok, parseBody } from "@/lib/server/http";
import { predictorBundle, sourceInfo } from "@/lib/server/data";

export async function handleFlammability(req: Request) {
  const body = await parseBody(req, FlammabilityRequestSchema);
  if ("response" in body) return body.response;
  return ok(flammabilityBody(body.data, await predictorBundle(), await sourceInfo()), NO_STORE);
}

export async function handleSmoke(req: Request) {
  const body = await parseBody(req, SmokeRequestSchema);
  if ("response" in body) return body.response;
  return ok(smokeBody(body.data, await predictorBundle(), await sourceInfo()), NO_STORE);
}
