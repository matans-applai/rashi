// Mirror of the JSON schemas in `supabase/functions/ai-request-router/schemas.ts`.
// Keep these two files in sync. The edge function returns these exact shapes.

import type { RoutingOutcome } from "./types";

export type Confidence = "low" | "medium" | "high";

export type YesNoUnknown = "yes" | "no" | "unknown";

export type AgreementTypeEstimateLLM =
  | "service_purchase"
  | "cooperation"
  | "government_joint_venture"
  | "grant"
  | "sponsorship"
  | "other"
  | "unclear";

export type SupplierStatusLLM =
  | "registered"
  | "not_registered"
  | "unknown"
  | "not_checked";

export type QuoteCleanlinessLLM =
  | "clean"
  | "contains_supplier_terms"
  | "unknown";

export type TriggerType =
  | "legal"
  | "insurance"
  | "grant"
  | "supplier"
  | "missing"
  | "general";

export interface DetectedTrigger {
  type: TriggerType;
  label_he: string;
  explanation_he: string;
}

export interface MissingField {
  field: string;
  question_he: string;
  importance: "low" | "medium" | "high";
}

export interface RoutingRequestSummary {
  purpose: string;
  department_or_project: string | null;
  second_party: string | null;
  supplier_status: SupplierStatusLLM;
  amount: number | null;
  timeline: string | null;
  party_roles: string | null;
  documents_mentioned: string[];
}

export interface RoutingResponse {
  request_summary: RoutingRequestSummary;
  route: RoutingOutcome;
  route_label_he: string;
  confidence: Confidence;
  reasoning_summary_he: string;
  detected_triggers: DetectedTrigger[];
  quote_assessment: {
    quote_exists: YesNoUnknown;
    quote_cleanliness: QuoteCleanlinessLLM;
    supplier_terms_detected: string[];
  };
  missing_for_routing: MissingField[];
  next_questions_he: string[];
  can_continue_with_partial_info: boolean;
  user_facing_message_he: string;
}

export interface LegalCase {
  department_or_project: string | null;
  purpose: string;
  second_party: string | null;
  supplier_status: string | null;
  agreement_type_estimate: AgreementTypeEstimateLLM;
  party_roles: string | null;
  amount: number | null;
  timeline: string | null;
  quote_exists: YesNoUnknown;
  supplier_selected: YesNoUnknown;
  competitive_process: YesNoUnknown;
  single_supplier: YesNoUnknown;
  partners: YesNoUnknown;
  privacy_or_personal_data: YesNoUnknown;
  copyrights_or_ip: YesNoUnknown;
  participant_photography: YesNoUnknown;
  insurance_required: YesNoUnknown;
  subcontractors: YesNoUnknown;
  supplier_terms: string[];
  documents: string[];
  risks_and_exceptions: string[];
  missing_info: string[];
  reason_for_legal_review: string;
}

export interface LegalIntakeResponse {
  legal_case: LegalCase;
  questions_to_complete_he: string[];
  ready_for_summary: boolean;
  assistant_message_he: string;
}

export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
  ts: string; // ISO timestamp
}

export type ChatStep =
  | "describe"        // user typing original description
  | "clarify"         // assistant asking 1-3 follow-up questions
  | "review_route"    // user reviewing proposed route
  | "legal_chat"      // legal-intake chat (only for legal_review)
  | "final_summary";  // final cards + DOCX

export interface ChatRequestState {
  step: ChatStep;
  messages: ChatMessage[];
  routing?: RoutingResponse;
  legal?: LegalIntakeResponse;
  selectedRoute?: RoutingOutcome;
}
