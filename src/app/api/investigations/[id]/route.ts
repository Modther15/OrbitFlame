import { NextResponse } from "next/server";
import { investigationRepository } from "@/lib/data/repository";

export const runtime = "nodejs";

/** Full investigation (all test runs + measurements) for one id; used by Compare for the 2-3 selected records. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const record = await investigationRepository.getById(id);
  if (!record) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(record, { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } });
}
