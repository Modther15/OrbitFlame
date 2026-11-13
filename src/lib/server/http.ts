import { NextResponse } from "next/server";
import type { ZodType } from "zod";

export const NO_STORE = { "Cache-Control": "no-store" };
export const SHORT_CACHE = { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" };

export function ok(data: unknown, headers: Record<string, string> = SHORT_CACHE) {
  return NextResponse.json(data, { headers });
}
/** FastAPI-style error body: { detail }. */
export function fail(status: number, detail: unknown) {
  return NextResponse.json({ detail }, { status, headers: NO_STORE });
}

export async function parseBody<T>(req: Request, schema: ZodType<T>): Promise<{ data: T } | { response: NextResponse }> {
  let json: unknown = {};
  const text = await req.text();
  if (text.trim()) {
    try {
      json = JSON.parse(text);
    } catch {
      return { response: fail(400, "Malformed JSON request body.") };
    }
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return { response: fail(422, parsed.error.issues.map((i) => ({ loc: ["body", ...i.path], msg: i.message, type: i.code }))) };
  }
  return { data: parsed.data };
}

export function intParam(url: URL, name: string, def: number, min: number, max: number): number | NextResponse {
  const raw = url.searchParams.get(name);
  if (raw === null || raw === "") return def;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < min || n > max) return fail(422, [{ loc: ["query", name], msg: `must be an integer between ${min} and ${max}`, type: "value_error" }]);
  return n;
}
export function floatParam(url: URL, name: string, def: number, min: number, max: number): number | NextResponse {
  const raw = url.searchParams.get(name);
  if (raw === null || raw === "") return def;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < min || n > max) return fail(422, [{ loc: ["query", name], msg: `must be a number between ${min} and ${max}`, type: "value_error" }]);
  return n;
}
