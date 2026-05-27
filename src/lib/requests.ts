import { supabase, REQUESTS_TABLE, FILES_BUCKET } from "./supabase";
import type {
  RequestRecord,
  RequestFile,
  LegalIntakePayload,
  RequestStatus,
} from "./types";
import type { ChatMessage, IntakeResponse, IntakeSummary } from "./aiTypes";

export interface NewRequestDraft {
  department: string;
  description: string;
  supplierName: string;
  amount: number | null;
  files: File[];
}

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

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

export async function fileSignedUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(FILES_BUCKET)
    .createSignedUrl(path, 60 * 10);
  if (error) return null;
  return data.signedUrl;
}

// ---------------------------------------------------------------------------
// Intake persistence
// ---------------------------------------------------------------------------

/**
 * Create a new intake request after the first AI turn. The product is no longer
 * about routing, so we don't store `outcome` as a routing decision — it's just
 * a "primary topic" tag for organising the dashboard.
 *
 * Original free text → `description`.
 * Full chat history  → `chat_messages`.
 * Latest LLM response → `llm_output`.
 * Latest structured intake summary → `legal_case` (re-used column).
 */
export async function createIntakeRequest(args: {
  userId: string;
  userEmail: string | null;
  description: string;
  chatMessages: ChatMessage[];
  intake: IntakeResponse;
}): Promise<RequestRecord> {
  const s = args.intake.intake_summary;
  const payload = {
    user_id: args.userId,
    user_email: args.userEmail,
    department: s.department_or_project ?? "",
    description: args.description,
    supplier_name: s.second_party_name ?? null,
    amount: s.amount ?? null,
    file_paths: [],
    outcome: null, // No routing decision anymore.
    status: "draft" as RequestStatus,
    reasoning: null,
    tags: deriveTopicTags(args.intake),
    legal_intake: null,
    chat_messages: args.chatMessages,
    llm_output: args.intake,
    legal_case: s, // The current intake_summary (editable).
    selected_route: null,
    route_confidence: null,
  };
  const { data, error } = await supabase
    .from(REQUESTS_TABLE)
    .insert(payload)
    .select("*")
    .single();
  if (error) throw error;
  return data as RequestRecord;
}

/** Append turns to the chat and update the latest intake snapshot. */
export async function updateIntake(args: {
  id: string;
  chatMessages: ChatMessage[];
  intake: IntakeResponse;
}): Promise<RequestRecord> {
  const s = args.intake.intake_summary;
  const { data, error } = await supabase
    .from(REQUESTS_TABLE)
    .update({
      chat_messages: args.chatMessages,
      llm_output: args.intake,
      legal_case: s,
      department: s.department_or_project ?? "",
      supplier_name: s.second_party_name ?? null,
      amount: s.amount ?? null,
      tags: deriveTopicTags(args.intake),
    })
    .eq("id", args.id)
    .select("*")
    .single();
  if (error) throw error;
  return data as RequestRecord;
}

/**
 * Save the user's edits to the intake summary. This is the screen where the
 * user can override anything the LLM extracted.
 */
export async function saveEditedIntake(
  id: string,
  edited: IntakeSummary
): Promise<RequestRecord> {
  const { data, error } = await supabase
    .from(REQUESTS_TABLE)
    .update({
      legal_case: edited,
      department: edited.department_or_project ?? "",
      supplier_name: edited.second_party_name ?? null,
      amount: edited.amount ?? null,
    })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as RequestRecord;
}

/** Mark the request as ready for legal review (button on review screen). */
export async function markReadyForLegal(id: string): Promise<RequestRecord> {
  const { data, error } = await supabase
    .from(REQUESTS_TABLE)
    .update({ status: "ready_for_legal" })
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data as RequestRecord;
}

/** Mark the request as sent to legal (POC stub — no real email). */
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
// Reads
// ---------------------------------------------------------------------------

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

export async function deleteRequest(req: RequestRecord): Promise<void> {
  const paths = [
    ...req.file_paths,
    ...((req.legal_intake?.extraFilePaths as string[] | undefined) ?? []),
  ];
  if (paths.length > 0) {
    const { error: storageError } = await supabase.storage
      .from(FILES_BUCKET)
      .remove(paths);
    if (storageError) {
      console.warn("Could not delete request files", storageError);
    }
  }
  const { error } = await supabase
    .from(REQUESTS_TABLE)
    .delete()
    .eq("id", req.id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// File metadata (request_files table)
// ---------------------------------------------------------------------------

const FILES_TABLE = "request_files";

const ACCEPTED_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "image/png",
  "image/jpeg",
];

export function isAcceptedFileType(file: File): boolean {
  return ACCEPTED_TYPES.includes(file.type);
}

export const ACCEPTED_EXTENSIONS = ".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg";

export async function uploadFileWithMetadata(args: {
  userId: string;
  requestId: string | null;
  file: File;
}): Promise<RequestFile> {
  const safeName = args.file.name.replace(/[^\w.\-א-ת ]/g, "_");
  const folder = args.requestId ?? "unlinked";
  const storagePath = `${args.userId}/${folder}/${Date.now()}-${safeName}`;

  const { error: uploadErr } = await supabase.storage
    .from(FILES_BUCKET)
    .upload(storagePath, args.file, { upsert: false });
  if (uploadErr) throw uploadErr;

  const { data, error: insertErr } = await supabase
    .from(FILES_TABLE)
    .insert({
      request_id: args.requestId,
      user_id: args.userId,
      file_name: args.file.name,
      storage_path: storagePath,
      file_type: args.file.type || null,
      file_size: args.file.size,
    })
    .select("*")
    .single();
  if (insertErr) throw insertErr;
  return data as RequestFile;
}

export async function listRequestFiles(requestId: string): Promise<RequestFile[]> {
  const { data, error } = await supabase
    .from(FILES_TABLE)
    .select("*")
    .eq("request_id", requestId)
    .order("uploaded_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as RequestFile[];
}

export async function listUserUnlinkedFiles(userId: string): Promise<RequestFile[]> {
  const { data, error } = await supabase
    .from(FILES_TABLE)
    .select("*")
    .eq("user_id", userId)
    .is("request_id", null)
    .order("uploaded_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as RequestFile[];
}

export async function linkFilesToRequest(
  fileIds: string[],
  requestId: string
): Promise<void> {
  if (fileIds.length === 0) return;
  const { error } = await supabase
    .from(FILES_TABLE)
    .update({ request_id: requestId })
    .in("id", fileIds);
  if (error) throw error;
}

export async function deleteFileWithMetadata(file: RequestFile): Promise<void> {
  await supabase.storage.from(FILES_BUCKET).remove([file.storage_path]);
  const { error } = await supabase.from(FILES_TABLE).delete().eq("id", file.id);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Legacy compatibility — used only by old code paths
// ---------------------------------------------------------------------------

/**
 * @deprecated Old API used by the previous routing/intake forms.
 * Kept as a thin shim so existing code paths don't fail typecheck.
 */
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function deriveTopicTags(intake: IntakeResponse): string[] {
  const tags: string[] = [];
  const s = intake.intake_summary;
  if (s.grant_related === "yes") tags.push("מענק");
  if (s.supplier_terms_or_contract === "yes") tags.push("תנאי ספק");
  if (s.privacy_or_personal_data === "yes") tags.push("פרטיות");
  if (s.ip_or_copyrights === "yes") tags.push("זכויות יוצרים");
  if (s.participant_photography === "yes") tags.push("צילום משתתפים");
  if (s.insurance_or_operational_risk === "yes") tags.push("ביטוח");
  if (s.partners_involved) tags.push("שותפים");
  return tags;
}
