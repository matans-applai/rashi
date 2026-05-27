// Supabase Edge Function — Rashi legal-intake assistant.
//
// Single mode: collect structured information for the legal department.
// Uses OpenAI Chat Completions with strict Structured Outputs (json_schema).
//
// Required secrets (set with `supabase secrets set ...`):
//   OPENAI_API_KEY   — secret OpenAI API key
//   OPENAI_MODEL     — optional override (default below)
//
// Deploy:
//   npx supabase functions deploy ai-request-router --no-verify-jwt

// deno-lint-ignore-file no-explicit-any

import { INTAKE_SCHEMA } from "./schemas.ts";
import { INTAKE_SYSTEM_PROMPT } from "./prompts.ts";

const DEFAULT_MODEL = "gpt-4o";
const OPENAI_TIMEOUT_MS = 30_000; // 30 seconds server-side timeout
const MAX_RETRIES = 1; // At most 1 retry for rate-limit / 5xx
const RETRY_DELAY_MS = 2_000;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ---------------------------------------------------------------------------
// Structured error codes
// ---------------------------------------------------------------------------
type ErrorCode =
  | "AI_TIMEOUT"
  | "AI_RATE_LIMIT"
  | "AI_TEMPORARY_UNAVAILABLE"
  | "AI_VALIDATION_ERROR"
  | "AI_UNKNOWN_ERROR"
  | "INVALID_REQUEST"
  | "MISSING_CONFIG";

interface StructuredError {
  error: ErrorCode;
  message_he: string;
  retryable: boolean;
  details?: string;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface ChatTurn {
  role: "system" | "user" | "assistant";
  content: string;
}

interface IntakeRequest {
  mode?: "intake" | "route" | "legal_intake";
  messages: ChatTurn[];
  /** Previous intake_summary for state preservation across turns */
  previous_intake?: Record<string, unknown> | null;
}

// ---------------------------------------------------------------------------
// Logging helper — safe, no secrets
// ---------------------------------------------------------------------------
function logRequest(entry: {
  request_id: string;
  action: string;
  model?: string;
  duration_ms?: number;
  success?: boolean;
  error_code?: string;
  http_status?: number;
  turn_count?: number;
  has_previous_intake?: boolean;
}) {
  // Structured log — Supabase captures console output
  console.log(JSON.stringify({
    ts: new Date().toISOString(),
    fn: "ai-request-router",
    ...entry,
  }));
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------
Deno.serve(async (req) => {
  const requestId = crypto.randomUUID().slice(0, 8);
  const startTime = Date.now();

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return errorResponse("INVALID_REQUEST", "method_not_allowed", 405, requestId, startTime);
  }

  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) {
    logRequest({ request_id: requestId, action: "missing_config", success: false, error_code: "MISSING_CONFIG" });
    return errorResponse("MISSING_CONFIG", "OpenAI API key not configured", 500, requestId, startTime);
  }
  const model = Deno.env.get("OPENAI_MODEL") ?? DEFAULT_MODEL;

  let body: IntakeRequest;
  try {
    body = await req.json();
  } catch {
    return errorResponse("INVALID_REQUEST", "Invalid JSON body", 400, requestId, startTime);
  }

  if (!body || !Array.isArray(body.messages)) {
    return errorResponse("INVALID_REQUEST", "Missing messages array", 400, requestId, startTime);
  }

  const turnCount = body.messages.filter((m) => m.role === "user").length;
  const hasPreviousIntake = body.previous_intake != null;

  logRequest({
    request_id: requestId,
    action: "start",
    model,
    turn_count: turnCount,
    has_previous_intake: hasPreviousIntake,
  });

  try {
    // Extract questions previously asked by the assistant
    const userMessages = body.messages.filter((m) => m.role !== "system");
    const askedQuestions = extractAskedQuestions(userMessages);

    // Build message array
    const systemContent = buildSystemMessage(body.previous_intake ?? null, askedQuestions);
    const messages: ChatTurn[] = [
      { role: "system", content: systemContent },
      ...userMessages,
    ];

    logRequest({
      request_id: requestId,
      action: "asked_questions_count",
      turn_count: askedQuestions.length,
    });

    // Call OpenAI with timeout and retry
    const result = await callOpenAIWithRetry(apiKey, model, messages, askedQuestions, requestId, startTime);
    return result;
  } catch (e) {
    const msg = String((e as Error)?.message ?? e);
    logRequest({
      request_id: requestId,
      action: "error",
      success: false,
      error_code: "AI_UNKNOWN_ERROR",
      duration_ms: Date.now() - startTime,
    });
    return errorResponse("AI_UNKNOWN_ERROR", msg.slice(0, 200), 500, requestId, startTime);
  }
});

// ---------------------------------------------------------------------------
// Build system message with optional previous intake state + asked questions
// ---------------------------------------------------------------------------
function buildSystemMessage(
  previousIntake: Record<string, unknown> | null,
  askedQuestions: string[],
): string {
  let msg = INTAKE_SYSTEM_PROMPT;
  if (previousIntake) {
    msg += `\n\n--- PREVIOUS INTAKE STATE ---
The following is the current known intake_summary from the previous turn.
Your task is to UPDATE it with any new information from the latest user message, not recreate it from scratch.
Preserve all existing non-null fields unless the user explicitly corrects them or gives more specific information.
If the latest message does not mention a field, keep the previous value.
If the user contradicts a previous value, update it and add a note in special_notes explaining what changed.

Previous intake_summary:
${JSON.stringify(previousIntake, null, 2)}
--- END PREVIOUS INTAKE STATE ---`;
  }
  if (askedQuestions.length > 0) {
    msg += `\n\n--- QUESTIONS ALREADY ASKED ---
The following questions were already asked in previous assistant turns.
You MUST NOT ask any of these again, even paraphrased.
If the user answered with "לא יודע" / "לא ידוע" / "לא בטוח" / similar non-knowledge phrases — the answer is VALID. Set the field to "unknown" and move the topic to missing_information. DO NOT re-ask.

Asked questions:
${askedQuestions.map((q, i) => `${i + 1}. ${q}`).join("\n")}
--- END QUESTIONS ALREADY ASKED ---`;
  }
  return msg;
}

// ---------------------------------------------------------------------------
// Extract questions that the assistant has already asked from chat history
// ---------------------------------------------------------------------------
function extractAskedQuestions(messages: ChatTurn[]): string[] {
  const asked: string[] = [];
  for (const m of messages) {
    if (m.role !== "assistant") continue;
    // Numbered list lines: "1. ...", "2) ...", etc.
    const lines = m.content.split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      const numberedMatch = trimmed.match(/^\d+[.)]\s*(.+\?)\s*$/);
      if (numberedMatch) {
        asked.push(numberedMatch[1].trim());
        continue;
      }
      // Also catch standalone question lines ending with ?
      if (trimmed.endsWith("?") && trimmed.length > 8 && trimmed.length < 250) {
        asked.push(trimmed);
      }
    }
  }
  // De-dup
  return Array.from(new Set(asked));
}

// ---------------------------------------------------------------------------
// Normalize a Hebrew question for similarity comparison
// ---------------------------------------------------------------------------
function normalizeQ(q: string): string {
  return q
    .replace(/[?!.,:;״"'״׳`()\[\]{}]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

// Topic keyword groups — questions hitting the same group are considered duplicates.
const TOPIC_GROUPS: Record<string, string[]> = {
  insurance: ["ביטוח", "פוליסה"],
  comparison: ["השוואת הצעות", "השוואה", "מכרז", "הצעות נוספות", "ספקים נוספים מועמדים"],
  signer: ["חותם", "מי חותם", "מורשה חתימה"],
  amount: ["סכום", "מחיר", "תשלום", "תקציב"],
  quote: ["הצעת מחיר", "הצעה במייל"],
  supplier_name: ["מי הצד השני", "שם הספק", "שם הצד השני"],
  timeline: ["לוח זמנים", "מתי", "תאריך"],
  privacy: ["מידע אישי", "פרטיות", "מידע רגיש"],
  subcontractors: ["ספקי משנה", "ספק משנה"],
  partners: ["שותפים", "גופים נוספים"],
};

function questionTopic(q: string): string | null {
  const n = normalizeQ(q);
  for (const [topic, kws] of Object.entries(TOPIC_GROUPS)) {
    for (const kw of kws) {
      if (n.includes(kw.toLowerCase())) return topic;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Deduplicate next_questions_he against previously asked questions
// ---------------------------------------------------------------------------
function dedupNextQuestions(
  nextQuestions: string[],
  askedQuestions: string[],
): string[] {
  if (nextQuestions.length === 0) return [];
  const askedTopics = new Set(
    askedQuestions.map(questionTopic).filter((t): t is string => t !== null),
  );
  const askedNormalized = new Set(askedQuestions.map(normalizeQ));

  const filtered: string[] = [];
  for (const q of nextQuestions) {
    const topic = questionTopic(q);
    if (topic && askedTopics.has(topic)) continue; // same topic → skip
    if (askedNormalized.has(normalizeQ(q))) continue; // exact dup → skip
    filtered.push(q);
  }
  return filtered;
}

// ---------------------------------------------------------------------------
// OpenAI call with timeout + retry for rate limits / 5xx
// ---------------------------------------------------------------------------
async function callOpenAIWithRetry(
  apiKey: string,
  model: string,
  messages: ChatTurn[],
  askedQuestions: string[],
  requestId: string,
  globalStart: number,
): Promise<Response> {
  let lastError: { status: number; text: string } | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      // Wait before retry
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * attempt));
      logRequest({
        request_id: requestId,
        action: `retry_${attempt}`,
        duration_ms: Date.now() - globalStart,
      });
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);

      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.2,
          response_format: { type: "json_schema", json_schema: INTAKE_SCHEMA },
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (res.status === 429) {
        lastError = { status: 429, text: "rate_limit" };
        if (attempt < MAX_RETRIES) continue; // retry
        logRequest({
          request_id: requestId,
          action: "rate_limit",
          success: false,
          error_code: "AI_RATE_LIMIT",
          http_status: 429,
          duration_ms: Date.now() - globalStart,
        });
        return errorResponse("AI_RATE_LIMIT", "OpenAI rate limit", 429, requestId, globalStart);
      }

      if (res.status >= 500) {
        const txt = await res.text();
        lastError = { status: res.status, text: txt.slice(0, 200) };
        if (attempt < MAX_RETRIES) continue; // retry
        logRequest({
          request_id: requestId,
          action: "openai_5xx",
          success: false,
          error_code: "AI_TEMPORARY_UNAVAILABLE",
          http_status: res.status,
          duration_ms: Date.now() - globalStart,
        });
        return errorResponse("AI_TEMPORARY_UNAVAILABLE", "OpenAI server error", 502, requestId, globalStart);
      }

      if (!res.ok) {
        const txt = await res.text();
        logRequest({
          request_id: requestId,
          action: "openai_error",
          success: false,
          error_code: "AI_UNKNOWN_ERROR",
          http_status: res.status,
          duration_ms: Date.now() - globalStart,
        });
        return errorResponse("AI_UNKNOWN_ERROR", `OpenAI error ${res.status}`, res.status, requestId, globalStart);
      }

      // Parse successful response
      const data = await res.json();
      const content: string | undefined = data?.choices?.[0]?.message?.content;
      if (!content) {
        logRequest({
          request_id: requestId,
          action: "no_content",
          success: false,
          error_code: "AI_VALIDATION_ERROR",
          duration_ms: Date.now() - globalStart,
        });
        return errorResponse("AI_VALIDATION_ERROR", "OpenAI returned empty content", 502, requestId, globalStart);
      }

      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(content);
      } catch {
        logRequest({
          request_id: requestId,
          action: "invalid_json",
          success: false,
          error_code: "AI_VALIDATION_ERROR",
          duration_ms: Date.now() - globalStart,
        });
        return errorResponse("AI_VALIDATION_ERROR", "Invalid JSON from OpenAI", 502, requestId, globalStart);
      }

      // Validate required fields exist
      if (!parsed.intake_summary || typeof parsed.assistant_message_he !== "string") {
        logRequest({
          request_id: requestId,
          action: "missing_fields",
          success: false,
          error_code: "AI_VALIDATION_ERROR",
          duration_ms: Date.now() - globalStart,
        });
        return errorResponse("AI_VALIDATION_ERROR", "Response missing required fields", 502, requestId, globalStart);
      }

      // ─── Post-processing: deduplicate next_questions_he ───
      // Drop any question that hits a topic the assistant already asked about
      // (e.g. insurance/comparison/signer). If everything was a duplicate, flip
      // ready_for_final_summary so the UI moves to the approval phase instead
      // of getting stuck in a question loop.
      const rawNextQuestions = (parsed.next_questions_he as string[] | undefined) ?? [];
      const dedupedQuestions = dedupNextQuestions(rawNextQuestions, askedQuestions);
      const droppedCount = rawNextQuestions.length - dedupedQuestions.length;
      if (droppedCount > 0) {
        logRequest({
          request_id: requestId,
          action: "dedup_questions",
          turn_count: droppedCount,
        });
      }
      parsed.next_questions_he = dedupedQuestions;

      // If we dropped EVERY question (all duplicates), force ready_for_final_summary=true
      // and replace the assistant message with the short approval handoff.
      if (
        rawNextQuestions.length > 0 &&
        dedupedQuestions.length === 0 &&
        !parsed.ready_for_final_summary
      ) {
        parsed.ready_for_final_summary = true;
        parsed.assistant_message_he =
          "יש לי מספיק מידע להכין את הפנייה. אפשר להעביר למשפטית, או לערוך פרטים.";
        logRequest({
          request_id: requestId,
          action: "forced_ready_after_dedup",
        });
      }

      // Default approval_summary_he if model omitted it
      if (typeof parsed.approval_summary_he !== "string") {
        parsed.approval_summary_he = "";
      }

      // Ensure assistant_message_he includes questions if next_questions_he is non-empty
      const nextQuestions = parsed.next_questions_he as string[] | undefined;
      let assistantMsg = parsed.assistant_message_he as string;
      if (
        nextQuestions &&
        nextQuestions.length > 0 &&
        !parsed.ready_for_final_summary
      ) {
        // Check if the message already contains numbered items
        const hasNumberedList = /\d+[.)]\s/.test(assistantMsg);
        if (!hasNumberedList) {
          // Append questions to the message as a fallback
          const questionLines = nextQuestions
            .map((q, i) => `${i + 1}. ${q}`)
            .join("\n");
          assistantMsg = assistantMsg.replace(/:\s*$/, "") + "\n\n" + questionLines;
          parsed.assistant_message_he = assistantMsg;
        }
      }

      const durationMs = Date.now() - globalStart;
      logRequest({
        request_id: requestId,
        action: "success",
        model,
        success: true,
        duration_ms: durationMs,
      });

      return json(parsed);
    } catch (e) {
      if ((e as Error).name === "AbortError") {
        logRequest({
          request_id: requestId,
          action: "timeout",
          success: false,
          error_code: "AI_TIMEOUT",
          duration_ms: Date.now() - globalStart,
        });
        if (attempt < MAX_RETRIES) continue;
        return errorResponse("AI_TIMEOUT", "OpenAI request timed out", 504, requestId, globalStart);
      }
      throw e; // re-throw unexpected errors
    }
  }

  // Should not reach here, but safety net
  return errorResponse(
    "AI_UNKNOWN_ERROR",
    lastError?.text ?? "Unknown error after retries",
    502,
    requestId,
    globalStart,
  );
}

// ---------------------------------------------------------------------------
// Response helpers
// ---------------------------------------------------------------------------
function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}

function errorResponse(
  code: ErrorCode,
  details: string,
  httpStatus: number,
  requestId: string,
  startTime: number,
): Response {
  const heMessages: Record<ErrorCode, string> = {
    AI_TIMEOUT: "הבקשה ל-AI לקחה יותר מדי זמן. נסו שוב בעוד רגע.",
    AI_RATE_LIMIT: "כרגע יש עומס זמני על מנגנון ה-AI. נסו שוב בעוד רגע.",
    AI_TEMPORARY_UNAVAILABLE: "שירות ה-AI אינו זמין כרגע. נסו שוב בעוד מספר דקות.",
    AI_VALIDATION_ERROR: "התקבלה תשובה לא תקינה מה-AI. נסו שוב.",
    AI_UNKNOWN_ERROR: "אירעה שגיאה בלתי צפויה. נסו שוב בעוד רגע.",
    INVALID_REQUEST: "בקשה לא תקינה.",
    MISSING_CONFIG: "המערכת אינה מוגדרת כראוי. פנו למנהל המערכת.",
  };

  const retryable = ["AI_TIMEOUT", "AI_RATE_LIMIT", "AI_TEMPORARY_UNAVAILABLE", "AI_UNKNOWN_ERROR"].includes(code);

  const body: StructuredError = {
    error: code,
    message_he: heMessages[code],
    retryable,
    details: details.slice(0, 200),
  };

  return json(body, httpStatus);
}
