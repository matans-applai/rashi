import { supabase, REQUESTS_TABLE, FILES_BUCKET } from "./supabase";
import type {
  RequestRecord,
  ClassificationResult,
  LegalIntakePayload,
  RequestStatus,
} from "./types";

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

export async function fileSignedUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(FILES_BUCKET)
    .createSignedUrl(path, 60 * 10);
  if (error) return null;
  return data.signedUrl;
}
