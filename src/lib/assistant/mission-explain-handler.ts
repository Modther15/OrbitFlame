import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { runAssistantPipeline, type AssistantLlmProvider } from "@/lib/assistant/assistant-provider";
import type { InvestigationRepository } from "@/lib/data/repository";

const MissionExplainRequestSchema = z.object({
  habitatName: z.string().trim().min(1).max(80),
  highestClassification: z.enum(["DIRECT", "ANALOGOUS", "MECHANISM_ONLY", "PLANNED", "UNAVAILABLE"]),
  matchedRecordIds: z.array(z.string().trim().min(1).max(32)).min(1).max(5),
});

export async function handleMissionExplainPost(
  req: NextRequest,
  options?: { repository?: InvestigationRepository; provider?: AssistantLlmProvider },
): Promise<NextResponse> {
  let rawJson: unknown;
  try {
    rawJson = await req.json();
  } catch {
    return NextResponse.json({ message: "Malformed JSON request." }, { status: 400 });
  }

  const parsed = MissionExplainRequestSchema.safeParse(rawJson);
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid mission explanation parameters." }, { status: 400 });
  }

  const question = `Summarize ONLY the recorded experimental conditions and provenance for ${parsed.data.matchedRecordIds.join(", ")} in relation to hypothetical ${parsed.data.habitatName} scenario inputs. Note deterministic classification (${parsed.data.highestClassification}) and state missing fields without predicting fire safety or extrapolating beyond records.`;

  const result = await runAssistantPipeline(
    {
      question,
      history: [],
      investigationIds: parsed.data.matchedRecordIds,
    },
    {
      repository: options?.repository,
      provider: options?.provider,
    },
  );

  return NextResponse.json(result.body, { status: result.httpStatus });
}
