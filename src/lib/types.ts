export type RoutingOutcome =
  | "missing_info"
  | "legal_review"
  | "supplier_registration" // Legacy records only; new supplier setup is a link, not a route.
  | "insurance_required"
  | "general_terms";

export type RequestStatus =
  | "draft"
  | "classified"
  | "sent_to_legal"
  | "completed";

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
  supplierStatus?: "registered" | "not_registered" | "unknown";
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
  created_at: string;
}

export interface LegalIntakePayload {
  // Card 1
  purpose?: string;
  agreementType?: "new" | "extension" | "";
  counterparty?: string;
  amount?: string;
  schedule?: string;
  budgetLine?: string;
  // Card 2
  supplierSelected?: "yes" | "no" | "";
  competitiveProcess?: "yes" | "no" | "";
  singleSupplier?: "yes" | "no" | "";
  hasQuote?: "yes" | "no" | "";
  // Card 3
  partners?: "yes" | "no" | "";
  privacy?: "yes" | "no" | "";
  copyright?: "yes" | "no" | "";
  filmingParticipants?: "yes" | "no" | "";
  insuranceNeeded?: "yes" | "no" | "";
  subcontractors?: "yes" | "no" | "";
  notes?: string;
  extraFilePaths?: string[];
}
