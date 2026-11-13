import { floatParam, intParam, ok } from "@/lib/server/http";
import { gridBody } from "@/lib/engine/service";
import { sourceInfo } from "@/lib/server/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const gravity = floatParam(url, "gravity", 0.16, 0, 2);
  const pressure = floatParam(url, "pressure_kpa", 101.3, Number.MIN_VALUE, 500);
  const o2Min = floatParam(url, "o2_min", 15, 0, 100);
  const o2Max = floatParam(url, "o2_max", 85, 0, 100);
  const o2Steps = intParam(url, "o2_steps", 11, 2, 40);
  const flowMax = floatParam(url, "flow_max", 40, 0, 500);
  const flowSteps = intParam(url, "flow_steps", 9, 2, 40);
  for (const v of [gravity, pressure, o2Min, o2Max, o2Steps, flowMax, flowSteps]) if (typeof v !== "number") return v;
  return ok(
    gridBody(
      { gravity: gravity as number, pressure_kpa: pressure as number, fuel: url.searchParams.get("fuel") || "Propane", o2_min: o2Min as number, o2_max: o2Max as number, o2_steps: o2Steps as number, flow_max: flowMax as number, flow_steps: flowSteps as number },
      await sourceInfo(),
    ),
  );
}
