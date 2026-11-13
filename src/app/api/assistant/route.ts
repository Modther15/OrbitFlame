import type { NextResponse } from "next/server";
import { handleAssistantPost } from "@/lib/assistant/assistant-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<NextResponse> {
  return handleAssistantPost(request);
}
