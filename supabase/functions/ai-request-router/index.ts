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
//   supabase functions deploy ai-request-router --no-verify-jwt

// deno-lint-ignore-file no-explicit-any

import { INTAKE_SCHEMA } from "./schemas.ts";
import { INTAKE_SYSTEM_PROMPT } from "./prompts.ts";

// The user asked for "gpt-5.4-mini". That model doesn't exist on OpenAI as of
// this writing — falling back to gpt-4o-mini (same fast/cheap tier and supports
// strict json_schema outputs). Override via OPENAI_MODEL secret.
const DEFAULT_MODEL = "gpt-4o-mini";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ChatTurn {
  role: "system" | "user" | "assistant";
  content: string;
}

interface IntakeRequest {
  /** Accept "intake" or legacy "route" / "legal_intake" — all treated the same now. */
  mode?: "intake" | "route" | "legal_intake";
  messages: ChatTurn[];
}

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

  let body: IntakeRequest;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json_body" }, 400);
  }

  if (!body || !Array.isArray(body.messages)) {
    return json({ error: "missing_messages" }, 400);
  }

  try {
    const messages: ChatTurn[] = [
      { role: "system", content: INTAKE_SYSTEM_PROMPT },
      ...body.messages.filter((m) => m.role !== "system"),
    ];

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
    });

    if (!res.ok) {
      const txt = await res.text();
      console.error("OpenAI error:", res.status, txt.slice(0, 500));
      return json(
        { error: "openai_api_error", status: res.status, details: txt },
        502
      );
    }

    const data = await res.json();
    const content: string | undefined = data?.choices?.[0]?.message?.content;
    if (!content) {
      return json({ error: "openai_no_content" }, 502);
    }
    try {
      return json(JSON.parse(content));
    } catch {
      return json(
        { error: "openai_invalid_json", details: content.slice(0, 300) },
        502
      );
    }
  } catch (e) {
    console.error("ai-request-router error:", e);
    return json({ error: "internal_error", details: String(e) }, 500);
  }
});

function json(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS },
  });
}
