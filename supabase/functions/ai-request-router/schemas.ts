// JSON Schema for OpenAI Structured Outputs.
//
// IMPORTANT — OpenAI strict mode rules:
//   - every property must appear in `required`
//   - no `additionalProperties: true` (we set false explicitly)
//   - optional values use a union with "null" instead of `optional`

export const INTAKE_SCHEMA = {
  name: "rashi_legal_intake",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      intake_summary: {
        type: "object",
        additionalProperties: false,
        properties: {
          department_or_project: { type: ["string", "null"] },
          request_purpose: { type: ["string", "null"] },
          background: { type: ["string", "null"] },
          second_party_name: { type: ["string", "null"] },
          second_party_type: {
            type: "string",
            enum: [
              "company",
              "nonprofit",
              "public_body",
              "individual",
              "unknown",
            ],
          },
          party_roles: { type: ["string", "null"] },
          amount: { type: ["number", "null"] },
          currency: { type: "string", enum: ["ILS", "unknown"] },
          timeline: { type: ["string", "null"] },
          is_new_or_existing: {
            type: "string",
            enum: ["new", "existing", "extension", "unknown"],
          },
          quote_exists: { type: "string", enum: ["yes", "no", "unknown"] },
          quote_details: { type: ["string", "null"] },
          supplier_selected: {
            type: "string",
            enum: ["yes", "no", "unknown"],
          },
          selection_process: { type: ["string", "null"] },
          partners_involved: { type: ["string", "null"] },
          documents_mentioned: { type: "array", items: { type: "string" } },
          privacy_or_personal_data: {
            type: "string",
            enum: ["yes", "no", "unknown"],
          },
          ip_or_copyrights: { type: "string", enum: ["yes", "no", "unknown"] },
          participant_photography: {
            type: "string",
            enum: ["yes", "no", "unknown"],
          },
          insurance_or_operational_risk: {
            type: "string",
            enum: ["yes", "no", "unknown"],
          },
          subcontractors: { type: "string", enum: ["yes", "no", "unknown"] },
          supplier_terms_or_contract: {
            type: "string",
            enum: ["yes", "no", "unknown"],
          },
          grant_related: { type: "string", enum: ["yes", "no", "unknown"] },
          urgency: {
            type: "string",
            enum: ["normal", "urgent", "critical", "unknown"],
          },
          special_notes: { type: "array", items: { type: "string" } },
        },
        required: [
          "department_or_project",
          "request_purpose",
          "background",
          "second_party_name",
          "second_party_type",
          "party_roles",
          "amount",
          "currency",
          "timeline",
          "is_new_or_existing",
          "quote_exists",
          "quote_details",
          "supplier_selected",
          "selection_process",
          "partners_involved",
          "documents_mentioned",
          "privacy_or_personal_data",
          "ip_or_copyrights",
          "participant_photography",
          "insurance_or_operational_risk",
          "subcontractors",
          "supplier_terms_or_contract",
          "grant_related",
          "urgency",
          "special_notes",
        ],
      },
      known_information_he: { type: "array", items: { type: "string" } },
      missing_information: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            field: { type: "string" },
            question_he: { type: "string" },
            importance: {
              type: "string",
              enum: ["high", "medium", "low"],
            },
            topic: {
              type: "string",
              enum: [
                "basic_details",
                "commercial",
                "supplier_selection",
                "documents",
                "risks",
                "grant",
                "privacy",
                "other",
              ],
            },
          },
          required: ["field", "question_he", "importance", "topic"],
        },
      },
      next_questions_he: { type: "array", items: { type: "string" } },
      can_continue_with_partial_info: { type: "boolean" },
      assistant_message_he: { type: "string" },
      ready_for_final_summary: { type: "boolean" },
      approval_summary_he: { type: "string" },
    },
    required: [
      "intake_summary",
      "known_information_he",
      "missing_information",
      "next_questions_he",
      "can_continue_with_partial_info",
      "assistant_message_he",
      "ready_for_final_summary",
      "approval_summary_he",
    ],
  },
};
