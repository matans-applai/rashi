export type RoutingOutcome =
  | "missing_info"
  | "legal_review"
  | "grant"
  | "supplier_registration"
  | "insurance_required"
  | "general_terms";

export type RequestStatus =
  | "draft"
  | "classified"        // legacy
  | "ready_for_legal"
  | "sent_to_legal"
  | "completed";

/**
 * High-level inferred engagement type. Used by the classifier and surfaced in
 * the request summary + legal intake.
 */
export type AgreementTypeEstimate =
  | "service_purchase"
  | "cooperation"
  | "government_joint"
  | "grant"
  | "sponsorship"
  | "other";

/**
 * Whether the quote / supplier description contains terms beyond price /
 * scope / timeline (which would push the case toward legal review).
 *
 *  "clean"                 — only price, scope, timeline.
 *  "supplier_terms"        — payment terms, IP, liability, privacy, etc.
 *  "unknown"               — not enough info.
 */
export type QuoteCleanliness = "clean" | "supplier_terms" | "unknown";

export interface ClassificationInput {
  department: string;
  description: string;
  supplierName: string;
  amount: number | null;
  fileCount: number;
}

export interface ClassificationResult {
  outcome: RoutingOutcome;
  message: string;
  reasoning: string;
  tags: string[];
  matchedKeywords: string[];

  /** Supplier registry status if we recognized the supplier name. */
  supplierStatus?: "registered" | "not_registered" | "unknown";

  /** What kind of engagement does this look like overall? */
  agreementTypeEstimate?: AgreementTypeEstimate;

  /** Was the quote / description "clean" or did it include supplier terms? */
  quoteCleanliness?: QuoteCleanliness;

  /** Specific supplier-terms triggers found in text (IP, liability, ...). */
  supplierTermsTriggers?: string[];

  /** Grant-related triggers found in text. */
  grantTriggers?: string[];

  /** Whether the classifier sees this as a grant scenario overall. */
  isGrant?: boolean;

  /** Up to N short questions to ask the user to improve confidence. */
  clarifyingQuestions?: string[];

  nextActions: { label: string; href?: string; kind: "primary" | "secondary" }[];
}

export interface RequestRecord {
  id: string;
  user_id: string;
  user_email?: string | null;
  department: string;
  description: string;
  supplier_name: string | null;
  amount: number | null;
  file_paths: string[];
  outcome: RoutingOutcome | null;
  status: RequestStatus;
  reasoning: string | null;
  tags: string[] | null;
  legal_intake: LegalIntakePayload | null;
  // Chat-first / LLM columns (migration 0004). Optional so old rows still type.
  chat_messages?: unknown | null;
  llm_output?: unknown | null;
  legal_case?: unknown | null;
  selected_route?: RoutingOutcome | null;
  route_confidence?: "low" | "medium" | "high" | null;
  created_at: string;
  deleted_at?: string | null;
  sent_at?: string | null;
}

/**
 * Grant required documents — each is yes/no/missing.
 * Stored inside legal_intake.grantDocuments so we don't need a DB migration.
 */
export interface GrantDocuments {
  ceoApproval?: "yes" | "no" | "";       // אישור חתום של מנכ"ל / מנהל כללי
  grantRequest?: "yes" | "no" | "";      // בקשת מענק
  grantForm?: "yes" | "no" | "";         // טופס מענק ממולא
  bylaws?: "yes" | "no" | "";            // תקנון העמותה
  managementApproval?: "yes" | "no" | ""; // אישור ניהול תקין
  section46?: "yes" | "no" | "";         // אישור 46
  withholdingTax?: "yes" | "no" | "";    // ניכוי מס במקור
  cpaApproval?: "yes" | "no" | "";       // אישור רו"ח (אם > 50K)
}

export interface RequestFile {
  id: string;
  request_id: string | null;
  user_id: string;
  file_name: string;
  storage_path: string;
  file_type: string | null;
  file_size: number | null;
  uploaded_at: string;
}

export interface LegalIntakePayload {
  // ---- Card 1 — engagement details ----
  purpose?: string;
  agreementType?: "new" | "extension" | "";
  /** Free-text estimate / category of engagement (service / cooperation / grant ...). */
  agreementTypeEstimate?: AgreementTypeEstimate | "";
  /** Who is giving what to whom. Free-text, optional. */
  partyRoles?: string;
  counterparty?: string;
  amount?: string;
  schedule?: string;
  budgetLine?: string;

  // ---- Card 2 — supplier & docs ----
  supplierSelected?: "yes" | "no" | "";
  competitiveProcess?: "yes" | "no" | "";
  singleSupplier?: "yes" | "no" | "";
  hasQuote?: "yes" | "no" | "";
  /** "clean" quote vs "supplier_terms" detected. */
  quoteCleanliness?: QuoteCleanliness | "";
  /** Detected supplier-terms triggers as Hebrew bullets. */
  supplierTermsDetected?: string[];
  /** Should a signed PO be issued by Rashi? */
  purchaseOrderNeeded?: "yes" | "no" | "";

  // ---- Card 3 — risks & exceptions ----
  partners?: "yes" | "no" | "";
  privacy?: "yes" | "no" | "";
  copyright?: "yes" | "no" | "";
  filmingParticipants?: "yes" | "no" | "";
  insuranceNeeded?: "yes" | "no" | "";
  subcontractors?: "yes" | "no" | "";

  // ---- Grant route ----
  isGrant?: boolean;
  grantDocuments?: GrantDocuments;
  grantMissingDocuments?: string[];

  // ---- General ----
  notes?: string;
  extraFilePaths?: string[];
}
