import type { NextRequest } from "next/server";
import { handleMissionExplainPost } from "@/lib/assistant/mission-explain-handler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  return handleMissionExplainPost(req);
}
