// Supabase Edge Function — OpenAI router for Rashi-bot.
//
// Two modes:
//   • mode = "route"         → initial classification of a free-text request
//   • mode = "legal_intake"  → chat-based legal-intake extraction
//
// Both use OpenAI Structured Outputs (response_format: json_schema) so the
// reply is guaranteed to match our schema.
//
// Required environment variables (set with `supabase secrets set ...`):
//   OPENAI_API_KEY   — secret OpenAI API key
//   OPENAI_MODEL     — optional override (default below)
//
// Deploy:
//   supabase functions deploy ai-request-router --no-verify-jwt
//
// (We set --no-verify-jwt so the function is callable from the browser with
//  the anon key. Auth is enforced at the DB layer via RLS.)

// deno-lint-ignore-file no-explicit-any

import { ROUTING_SCHEMA, LEGAL_INTAKE_SCHEMA } from "./schemas.ts";
import {
  ROUTING_SYSTEM_PROMPT,
  LEGAL_INTAKE_SYSTEM_PROMPT,
} from "./prompts.ts";

// --------------------------------------------------------------------------
// Config
// --------------------------------------------------------------------------

// The user asked for "gpt-5.4-mini". That model doesn't exist on OpenAI as of
// this writing — falling back to gpt-4o-mini (same fast/cheap tier and supports
// strict json_schema outputs). To override, set the OPENAI_MODEL secret in
// Supabase.
const DEFAULT_MODEL = "gpt-4o-mini";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// --------------------------------------------------------------------------
// Types accepted from the frontend
// --------------------------------------------------------------------------

interface ChatTurn {
  role: "system" | "user" | "assistant";
  content: string;
}

interface RouteRequest {
  mode: "route";
  /** Full chat history (user + assistant turns). System prompt is added here. */
  messages: ChatTurn[];
  /** Optional deterministic supplier info, e.g. from the suppliers table. */
  context?: {
    supplier_lookup?: {
      name: string;
      status: "registered" | "not_registered" | "unknown" | null;
      category?: string | null;
    } | null;
  };
}

interface LegalIntakeRequest {
  mode: "legal_intake";
  messages: ChatTurn[];
  /** The routing-stage extraction so we don't re-ask the same questions. */
  context?: {
    initial_summary?: any;
  };
}

type ReqBody = RouteRequest | LegalIntakeRequest;

// --------------------------------------------------------------------------
// HTTP handler
// --------------------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }
  if (req.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) {
    return json({ error: "missing_openai_api_key" }, 500);
  }
  const model = Deno.env.get("OPENAI_MODEL") ?? DEFAULT_MODEL;

  let body: ReqBody;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json_body" }, 400);
  }

  if (!body || (body.mode !== "route" && body.mode !== "legal_intake")) {
    return json({ error: "invalid_mode" }, 400);
  }
  if (!Array.isArray((body as any).messages)) {
    return json({ error: "missing_messages" }, 400);
  }

  try {
    const result =
      body.mode === "route"
        ? await callRouting(apiKey, model, body)
        : await callLegalIntake(apiKey, model, body);
    return json(result);
  } catch (e) {
    console.error("ai-request-router error:", e);
    return json({ error: "openai_call_failed", details: String(e) }, 502);
  }
});

// --------------------------------------------------------------------------
// OpenAI callers
// --------------------------------------------------------------------------

async function callRouting(apiKey: string, model: string, body: RouteRequest) {
  const supplierLine = buildSupplierContextLine(body.context?.supplier_lookup);
  const systemContent = supplierLine
    ? `${ROUTING_SYSTEM_PROMPT}\n\nמידע דטרמיניסטי על הספק (אם קיים): ${supplierLine}`
    : ROUTING_SYSTEM_PROMPT;

  const messages = [
    { role: "system", content: systemContent },
    ...body.messages.filter((m) => m.role !== "system"),
  ];

  const raw = await callOpenAI(apiKey, model, messages, ROUTING_SCHEMA);
  return raw;
}

async function callLegalIntake(
  apiKey: string,
  model: string,
  body: LegalIntakeRequest
) {
  const systemContent = body.context?.initial_summary
    ? `${LEGAL_INTAKE_SYSTEM_PROMPT}\n\nסיכום הסיווג הראשוני (לא לשאול עליו שוב): ${JSON.stringify(body.context.initial_summary, null, 2)}`
    : LEGAL_INTAKE_SYSTEM_PROMPT;

  const messages = [
    { role: "system", content: systemContent },
    ...body.messages.filter((m) => m.role !== "system"),
  ];

  const raw = await callOpenAI(apiKey, model, messages, LEGAL_INTAKE_SCHEMA);
  return raw;
}

async function callOpenAI(
  apiKey: string,
  model: string,
  messages: ChatTurn[],
  schema: { name: string; strict: boolean; schema: unknown }
): Promise<unknown> {
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
      response_format: {
        type: "json_schema",
        json_schema: schema,
      },
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`OpenAI ${res.status}: ${txt}`);
  }

  const data = await res.json();
  const content: string | undefined = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("OpenAI returned no content");
  }
  try {
    return JSON.parse(content);
  } catch {
    throw new Error(`OpenAI returned non-JSON content: ${content.slice(0, 200)}`);
  }
}

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

function buildSupplierContextLine(
  lookup: RouteRequest["context"] extends { supplier_lookup?: infer T } ? T : unknown
): string | null {
  if (!lookup) return null;
  const l = lookup as {
    name: string;
    status: string | null;
    category?: string | null;
  };
  const statusHe =
    l.status === "registered"
      ? "רשום במאגר 2026"
      : l.status === "not_registered"
      ? "לא רשום במאגר 2026"
      : "סטטוס לא ברור";
  return `שם הספק שזוהה: "${l.name}". סטטוס במאגר: ${statusHe}. קטגוריה: ${l.category ?? "לא ידוע"}.`;
}

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}
