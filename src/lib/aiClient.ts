import { supabase } from "./supabase";
import type { ChatMessage, IntakeResponse } from "./aiTypes";

const FN_NAME = "ai-request-router";

export class AIError extends Error {
  status?: number;
  retryable: boolean;
  constructor(message: string, status?: number, retryable = true) {
    super(message);
    this.name = "AIError";
    this.status = status;
    this.retryable = retryable;
  }
}

/**
 * Call the intake assistant. Backend → OpenAI Structured Outputs → strict
 * IntakeResponse. Throws AIError on any failure (network, openai, invalid
 * JSON, etc.) so the UI can show a friendly Hebrew fallback.
 */
export async function callIntake(args: {
  messages: ChatMessage[];
}): Promise<IntakeResponse> {
  let data: unknown;
  let error: unknown;
  try {
    const res = await supabase.functions.invoke(FN_NAME, {
      body: {
        mode: "intake",
        messages: args.messages.map(stripTs),
      },
    });
    data = res.data;
    error = res.error;
  } catch (e) {
    throw new AIError(String((e as Error)?.message ?? e), undefined, true);
  }

  if (error) {
    const msg = (error as { message?: string })?.message ?? "AI request failed";
    throw new AIError(msg, undefined, true);
  }
  if (!data || typeof data !== "object") {
    throw new AIError("AI returned no data", undefined, true);
  }
  // Server-side errors come back as { error: "..." } with HTTP 5xx — invoke
  // already throws for those, but be defensive in case the body comes through.
  const maybeErr = (data as { error?: string }).error;
  if (maybeErr) {
    throw new AIError(maybeErr, undefined, true);
  }
  return data as IntakeResponse;
}

function stripTs(m: ChatMessage): { role: string; content: string } {
  return { role: m.role, content: m.content };
}
