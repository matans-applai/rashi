import { supabase, REQUESTS_TABLE, FILES_BUCKET } from "./supabase";
import type {
  RequestRecord,
  ClassificationResult,
  LegalIntakePayload,
  RequestStatus,
} from "./types";
import type {
  ChatMessage,
  LegalIntakeResponse,
  RoutingResponse,
} from "./aiTypes";

export interface NewRequestDraft {
  department: string;
  description: string;
  supplierName: string;
  amount: number | null;
  files: File[];
}

export async function uploadFiles(
  userId: string,
  requestId: string,
  files: File[]
): Promise<string[]> {
  const paths: string[] = [];
  for (const f of files) {
    const safeName = f.name.replace(/[^\w.\-א-ת ]/g, "_");
    const path = `${userId}/${requestId}/${Date.now()}-${safeName}`;
    const { error } = await supabase.storage
      .from(FILES_BUCKET)
      .upload(path, f, { upsert: false });
    if (error) throw error;
    paths.push(path);
  }
  return paths;
}

export async function createRequest(args: {
  userId: string;
  userEmail: string | null;
  draft: NewRequestDraft;
  classification: ClassificationResult;
  filePaths: string[];
}): Promise<RequestRecord> {
  const { userId, userEmail, draft, classification, filePaths } = args;
  const payload = {
    user_id: userId,
    user_email: userEmail,
    department: draft.department,
    description: draft.description,
    supplier_name: draft.supplierName || null,
    amount: draft.amount,
    file_paths: filePaths,
    outcome: classification.outcome,
    status: "classified" as RequestStatus,
    reasoning: classification.reasoning,
    tags: classification.tags,
    legal_intake: null,
  };
  const { data, error } = await supabase
    .from(REQUESTS_TABLE)
    .insert(payload)
    .select("*")
    .single();
  if (error) throw error;
  return data as RequestRecord;
}

export async function listMyRequests(userId: string): Promise<RequestRecord[]> {
  const { data, error } = await supabase
    .from(REQUESTS_TABLE)
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as RequestRecord[];
}

export async function deleteRequest(req: RequestRecord): Promise<void> {
  const paths = [
    ...req.file_paths,
    ...(req.legal_intake?.extraFilePaths ?? []),
  ];
  if (paths.length > 0) {
    const { error: storageError } = await supabase.storage
      .from(FILES_BUCKET)
      .remove(paths);
    if (storageError) {
      // Deleting the request is still useful even if old attachments remain.
      console.warn("Could not delete request files", storageError);
    }
  }

  const { error } = await supabase
    .from(REQUESTS_TABLE)
    .delete()
    .eq("id", req.id);
  if (error) throw error;
}

export async function getRequest(id: string): Promise<RequestRecord | null> {
  const { data, error } = await supabase
    .from(REQUESTS_TABLE)
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as RequestRecord | null;
}

export async function updateLegalIntake(
  id: string,
  payload: LegalIntakePayload
): Promise<RequestRecord> {
  const { data, error } = await supabase
    .from(REQUESTS_TABLE)
    .update({ legal_intake: payload })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as RequestRecord;
}

export async function updateRequestClassification(args: {
  id: string;
  description: string;
  classification: ClassificationResult;
}): Promise<RequestRecord> {
  const { id, description, classification } = args;
  const { data, error } = await supabase
    .from(REQUESTS_TABLE)
    .update({
      description,
      outcome: classification.outcome,
      reasoning: classification.reasoning,
      tags: classification.tags,
      legal_intake: null,
      status: "classified" as RequestStatus,
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as RequestRecord;
}

export async function markSentToLegal(id: string): Promise<RequestRecord> {
  const { data, error } = await supabase
    .from(REQUESTS_TABLE)
    .update({ status: "sent_to_legal" })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as RequestRecord;
}

// ---------------------------------------------------------------------------
// Chat-first persistence
// ---------------------------------------------------------------------------

/**
 * Create a new request from the chat-first flow. We persist the original free
 * text in `description` (so the existing UI keeps working), plus the full chat
 * history and the LLM routing output in the new columns added by migration
 * 0004_chat_columns.sql.
 */
export async function createChatRequest(args: {
  userId: string;
  userEmail: string | null;
  description: string;
  chatMessages: ChatMessage[];
  routing: RoutingResponse;
}): Promise<RequestRecord> {
  const { userId, userEmail, description, chatMessages, routing } = args;
  const payload = {
    user_id: userId,
    user_email: userEmail,
    department: routing.request_summary.department_or_project ?? "",
    description,
    supplier_name: routing.request_summary.second_party ?? null,
    amount: routing.request_summary.amount ?? null,
    file_paths: [],
    outcome: routing.route,
    status: "classified" as RequestStatus,
    reasoning: routing.reasoning_summary_he,
    tags: routing.detected_triggers.map((t) => t.label_he),
    legal_intake: null,
    chat_messages: chatMessages,
    llm_output: routing,
    selected_route: routing.route,
    route_confidence: routing.confidence,
  };
  const { data, error } = await supabase
    .from(REQUESTS_TABLE)
    .insert(payload)
    .select("*")
    .single();
  if (error) throw error;
  return data as RequestRecord;
}

/** Append a turn to the chat history and (optionally) update the LLM output. */
export async function appendChatTurns(args: {
  id: string;
  messages: ChatMessage[];
  routing?: RoutingResponse;
}): Promise<RequestRecord> {
  const update: Record<string, unknown> = { chat_messages: args.messages };
  if (args.routing) {
    update.llm_output = args.routing;
    update.outcome = args.routing.route;
    update.tags = args.routing.detected_triggers.map((t) => t.label_he);
    update.reasoning = args.routing.reasoning_summary_he;
    update.route_confidence = args.routing.confidence;
  }
  const { data, error } = await supabase
    .from(REQUESTS_TABLE)
    .update(update)
    .eq("id", args.id)
    .select("*")
    .single();
  if (error) throw error;
  return data as RequestRecord;
}

/** Mark which route the user approved (may differ from the LLM proposal). */
export async function approveRoute(
  id: string,
  route: RequestRecord["outcome"]
): Promise<RequestRecord> {
  const { data, error } = await supabase
    .from(REQUESTS_TABLE)
    .update({ selected_route: route, outcome: route })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as RequestRecord;
}

/** Persist the latest legal-intake structured output. */
export async function saveLegalCase(
  id: string,
  legal: LegalIntakeResponse
): Promise<RequestRecord> {
  const { data, error } = await supabase
    .from(REQUESTS_TABLE)
    .update({ legal_case: legal.legal_case })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as RequestRecord;
}

export async function fileSignedUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(FILES_BUCKET)
    .createSignedUrl(path, 60 * 10);
  if (error) return null;
  return data.signedUrl;
}
