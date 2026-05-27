// Frontend mirrors of the JSON schema in
// `supabase/functions/ai-request-router/schemas.ts`.

export type YesNoUnknown = "yes" | "no" | "unknown";

export type SecondPartyType =
  | "company"
  | "nonprofit"
  | "public_body"
  | "individual"
  | "unknown";

export type AgreementState = "new" | "existing" | "extension" | "unknown";

export type Currency = "ILS" | "unknown";

export type Topic =
  | "basic_details"
  | "commercial"
  | "supplier_selection"
  | "documents"
  | "risks"
  | "grant"
  | "privacy"
  | "other";

export type Importance = "high" | "medium" | "low";

export interface IntakeSummary {
  department_or_project: string | null;
  request_purpose: string | null;
  background: string | null;
  second_party_name: string | null;
  second_party_type: SecondPartyType;
  party_roles: string | null;
  amount: number | null;
  currency: Currency;
  timeline: string | null;
  is_new_or_existing: AgreementState;
  quote_exists: YesNoUnknown;
  quote_details: string | null;
  supplier_selected: YesNoUnknown;
  selection_process: string | null;
  partners_involved: string | null;
  documents_mentioned: string[];
  privacy_or_personal_data: YesNoUnknown;
  ip_or_copyrights: YesNoUnknown;
  participant_photography: YesNoUnknown;
  insurance_or_operational_risk: YesNoUnknown;
  subcontractors: YesNoUnknown;
  supplier_terms_or_contract: YesNoUnknown;
  grant_related: YesNoUnknown;
  special_notes: string[];
}

export interface MissingItem {
  field: string;
  question_he: string;
  importance: Importance;
  topic: Topic;
}

export interface IntakeResponse {
  intake_summary: IntakeSummary;
  known_information_he: string[];
  missing_information: MissingItem[];
  next_questions_he: string[];
  can_continue_with_partial_info: boolean;
  assistant_message_he: string;
  ready_for_final_summary: boolean;
}

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  ts: string;
}

export type IntakeStep =
  | "describe"
  | "chat"
  | "review"
  | "ready";
