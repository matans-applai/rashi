import { supabase } from "./supabase";
import type { ChatMessage, IntakeResponse, IntakeSummary } from "./aiTypes";

const FN_NAME = "ai-request-router";
const CLIENT_TIMEOUT_MS = 35_000; // 35s — slightly longer than server's 30s

// ---------------------------------------------------------------------------
// Error types
// ---------------------------------------------------------------------------
export type AIErrorCode =
  | "AI_TIMEOUT"
  | "AI_RATE_LIMIT"
  | "AI_TEMPORARY_UNAVAILABLE"
  | "AI_VALIDATION_ERROR"
  | "AI_UNKNOWN_ERROR"
  | "CLIENT_TIMEOUT"
  | "NETWORK_ERROR";

export class AIError extends Error {
  code: AIErrorCode;
  retryable: boolean;
  messageHe: string;

  constructor(
    message: string,
    code: AIErrorCode = "AI_UNKNOWN_ERROR",
    retryable = true,
    messageHe?: string,
  ) {
    super(message);
    this.name = "AIError";
    this.code = code;
    this.retryable = retryable;
    this.messageHe = messageHe ?? heDefaultMessage(code);
  }
}

function heDefaultMessage(code: AIErrorCode): string {
  const map: Record<AIErrorCode, string> = {
    AI_TIMEOUT: "הבקשה לקחה יותר מדי זמן. נסו שוב בעוד רגע.",
    AI_RATE_LIMIT: "כרגע יש עומס זמני על מנגנון ה-AI. נסו שוב בעוד רגע.",
    AI_TEMPORARY_UNAVAILABLE: "שירות ה-AI אינו זמין כרגע. נסו שוב בעוד מספר דקות.",
    AI_VALIDATION_ERROR: "התקבלה תשובה לא תקינה מה-AI. נסו שוב.",
    AI_UNKNOWN_ERROR: "אירעה שגיאה בלתי צפויה. נסו שוב בעוד רגע.",
    CLIENT_TIMEOUT:
      "כרגע לוקח למנגנון ה-AI יותר זמן מהרגיל. אפשר לנסות שוב בעוד רגע, או להמשיך לסיכום ידני עם המידע שכבר הוזן.",
    NETWORK_ERROR: "בעיית תקשורת. בדקו את החיבור לאינטרנט ונסו שוב.",
  };
  return map[code];
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Call the intake assistant. Backend → OpenAI Structured Outputs → strict
 * IntakeResponse. Throws AIError on any failure so the UI can show a
 * friendly Hebrew fallback.
 */
export async function callIntake(args: {
  messages: ChatMessage[];
  previousIntake?: IntakeSummary | null;
  signal?: AbortSignal;
}): Promise<IntakeResponse> {
  // Create timeout abort controller
  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), CLIENT_TIMEOUT_MS);

  // Combine external signal with timeout
  const combinedSignal = args.signal
    ? combineSignals(args.signal, timeoutController.signal)
    : timeoutController.signal;

  try {
    const res = await supabase.functions.invoke(FN_NAME, {
      body: {
        mode: "intake",
        messages: args.messages.map(stripTs),
        previous_intake: args.previousIntake ?? null,
      },
    });

    clearTimeout(timeoutId);

    const { data, error } = res;

    if (error) {
      const msg = (error as { message?: string })?.message ?? "AI request failed";
      throw new AIError(msg, "AI_UNKNOWN_ERROR", true);
    }

    if (!data || typeof data !== "object") {
      throw new AIError("AI returned no data", "AI_VALIDATION_ERROR", true);
    }

    // Check for structured error from Edge Function
    const maybeError = data as {
      error?: string;
      message_he?: string;
      retryable?: boolean;
    };
    if (maybeError.error && typeof maybeError.error === "string") {
      const code = isKnownCode(maybeError.error) ? maybeError.error : "AI_UNKNOWN_ERROR";
      throw new AIError(
        maybeError.error,
        code,
        maybeError.retryable ?? true,
        maybeError.message_he,
      );
    }

    // Validate response has required fields
    const response = data as IntakeResponse;
    if (!response.intake_summary || typeof response.assistant_message_he !== "string") {
      throw new AIError("Response missing required fields", "AI_VALIDATION_ERROR", true);
    }

    // Ensure urgency field has a default
    if (!response.intake_summary.urgency) {
      response.intake_summary.urgency = "unknown";
    }

    return response;
  } catch (e) {
    clearTimeout(timeoutId);

    if (e instanceof AIError) throw e;

    // AbortError = timeout
    if ((e as Error).name === "AbortError") {
      throw new AIError("Request timed out", "CLIENT_TIMEOUT", true);
    }

    // Network / fetch errors
    const msg = String((e as Error)?.message ?? e);
    if (msg.includes("fetch") || msg.includes("network") || msg.includes("Failed")) {
      throw new AIError(msg, "NETWORK_ERROR", true);
    }

    throw new AIError(msg, "AI_UNKNOWN_ERROR", true);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function stripTs(m: ChatMessage): { role: string; content: string } {
  return { role: m.role, content: m.content };
}

function isKnownCode(code: string): code is AIErrorCode {
  return [
    "AI_TIMEOUT",
    "AI_RATE_LIMIT",
    "AI_TEMPORARY_UNAVAILABLE",
    "AI_VALIDATION_ERROR",
    "AI_UNKNOWN_ERROR",
  ].includes(code);
}

function combineSignals(...signals: AbortSignal[]): AbortSignal {
  const controller = new AbortController();
  for (const signal of signals) {
    if (signal.aborted) {
      controller.abort(signal.reason);
      return controller.signal;
    }
    signal.addEventListener("abort", () => controller.abort(signal.reason), {
      once: true,
    });
  }
  return controller.signal;
}
