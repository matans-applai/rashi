import { supabase } from "./supabase";
import type {
  ChatMessage,
  LegalIntakeResponse,
  RoutingResponse,
} from "./aiTypes";
import { DEMO_SUPPLIERS, lookupSupplier } from "./suppliers";

const FN_NAME = "ai-request-router";

/**
 * Call the routing mode. Backend → OpenAI Structured Outputs → returns
 * RoutingResponse. We also attach deterministic supplier-lookup context if
 * the user mentioned a supplier name in the description — supplier lookup
 * is *not* keyword routing, it's a lookup against our own table.
 */
export async function callRouting(args: {
  messages: ChatMessage[];
  inferredSupplierName?: string | null;
}): Promise<RoutingResponse> {
  const lookup = args.inferredSupplierName
    ? lookupSupplier(args.inferredSupplierName)
    : null;

  const { data, error } = await supabase.functions.invoke(FN_NAME, {
    body: {
      mode: "route",
      messages: args.messages.map(stripTs),
      context: {
        supplier_lookup: lookup
          ? {
              name: lookup.name,
              status: lookup.status,
              category: lookup.category,
            }
          : null,
      },
    },
  });
  if (error) throw normaliseError(error);
  return data as RoutingResponse;
}

/**
 * Call the legal-intake mode. Backend → OpenAI → LegalIntakeResponse.
 * We pass the routing-stage summary so the model doesn't re-ask the same
 * questions.
 */
export async function callLegalIntake(args: {
  messages: ChatMessage[];
  initialSummary?: unknown;
}): Promise<LegalIntakeResponse> {
  const { data, error } = await supabase.functions.invoke(FN_NAME, {
    body: {
      mode: "legal_intake",
      messages: args.messages.map(stripTs),
      context: { initial_summary: args.initialSummary ?? null },
    },
  });
  if (error) throw normaliseError(error);
  return data as LegalIntakeResponse;
}

function stripTs(m: ChatMessage): { role: string; content: string } {
  return { role: m.role, content: m.content };
}

function normaliseError(err: unknown): Error {
  if (err instanceof Error) return err;
  if (typeof err === "object" && err !== null) {
    const e = err as { message?: string };
    return new Error(e.message || JSON.stringify(err));
  }
  return new Error(String(err));
}

/**
 * Heuristic supplier-name extraction: scan the user's free text for any
 * supplier name from the demo registry. Pure substring match against names
 * we actually know about — not a routing rule, just a hint to the backend.
 *
 * We do this on the client so we can attach deterministic supplier status
 * to the routing call without round-tripping.
 */
export function guessSupplierName(text: string): string | null {
  const t = text.toLowerCase();
  for (const s of DEMO_SUPPLIERS) {
    if (t.includes(s.name.toLowerCase())) return s.name;
  }
  return null;
}
