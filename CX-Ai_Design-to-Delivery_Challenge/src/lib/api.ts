import type { BriefAnalysis } from "@/types/analysis";
import { invokeProtectedFunction } from "@/lib/protectedInvoke";

export async function analyzeBrief(brief: string): Promise<BriefAnalysis> {
  const { data, error } = await invokeProtectedFunction<{ brief: string }, BriefAnalysis | { error: string }>("analyze-brief", {
    brief,
  });

  if (error) {
    throw new Error(error.message || "Failed to analyze brief");
  }

  if (data && "error" in data && data.error) {
    throw new Error(data.error);
  }

  return data as BriefAnalysis;
}
