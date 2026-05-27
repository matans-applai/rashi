// JSON Schemas for OpenAI Structured Outputs.
//
// IMPORTANT — OpenAI strict mode rules:
//   - every property must appear in `required`
//   - no `additionalProperties: true` (we set false explicitly)
//   - optional values use a union with "null" instead of `optional`

export const ROUTING_SCHEMA = {
  name: "rashi_routing",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      request_summary: {
        type: "object",
        additionalProperties: false,
        properties: {
          purpose: { type: "string" },
          department_or_project: { type: ["string", "null"] },
          second_party: { type: ["string", "null"] },
          supplier_status: {
            type: "string",
            enum: ["registered", "not_registered", "unknown", "not_checked"],
          },
          amount: { type: ["number", "null"] },
          timeline: { type: ["string", "null"] },
          party_roles: { type: ["string", "null"] },
          documents_mentioned: {
            type: "array",
            items: { type: "string" },
          },
        },
        required: [
          "purpose",
          "department_or_project",
          "second_party",
          "supplier_status",
          "amount",
          "timeline",
          "party_roles",
          "documents_mentioned",
        ],
      },
      route: {
        type: "string",
        enum: [
          "general_terms",
          "supplier_registration",
          "insurance_required",
          "legal_review",
          "grant",
          "missing_info",
        ],
      },
      route_label_he: { type: "string" },
      confidence: { type: "string", enum: ["low", "medium", "high"] },
      reasoning_summary_he: { type: "string" },
      detected_triggers: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            type: {
              type: "string",
              enum: [
                "legal",
                "insurance",
                "grant",
                "supplier",
                "missing",
                "general",
              ],
            },
            label_he: { type: "string" },
            explanation_he: { type: "string" },
          },
          required: ["type", "label_he", "explanation_he"],
        },
      },
      quote_assessment: {
        type: "object",
        additionalProperties: false,
        properties: {
          quote_exists: { type: "string", enum: ["yes", "no", "unknown"] },
          quote_cleanliness: {
            type: "string",
            enum: ["clean", "contains_supplier_terms", "unknown"],
          },
          supplier_terms_detected: {
            type: "array",
            items: { type: "string" },
          },
        },
        required: [
          "quote_exists",
          "quote_cleanliness",
          "supplier_terms_detected",
        ],
      },
      missing_for_routing: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            field: { type: "string" },
            question_he: { type: "string" },
            importance: { type: "string", enum: ["low", "medium", "high"] },
          },
          required: ["field", "question_he", "importance"],
        },
      },
      next_questions_he: {
        type: "array",
        items: { type: "string" },
      },
      can_continue_with_partial_info: { type: "boolean" },
      user_facing_message_he: { type: "string" },
    },
    required: [
      "request_summary",
      "route",
      "route_label_he",
      "confidence",
      "reasoning_summary_he",
      "detected_triggers",
      "quote_assessment",
      "missing_for_routing",
      "next_questions_he",
      "can_continue_with_partial_info",
      "user_facing_message_he",
    ],
  },
};

export const LEGAL_INTAKE_SCHEMA = {
  name: "rashi_legal_intake",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      legal_case: {
        type: "object",
        additionalProperties: false,
        properties: {
          department_or_project: { type: ["string", "null"] },
          purpose: { type: "string" },
          second_party: { type: ["string", "null"] },
          supplier_status: { type: ["string", "null"] },
          agreement_type_estimate: {
            type: "string",
            enum: [
              "service_purchase",
              "cooperation",
              "government_joint_venture",
              "grant",
              "sponsorship",
              "other",
              "unclear",
            ],
          },
          party_roles: { type: ["string", "null"] },
          amount: { type: ["number", "null"] },
          timeline: { type: ["string", "null"] },
          quote_exists: { type: "string", enum: ["yes", "no", "unknown"] },
          supplier_selected: {
            type: "string",
            enum: ["yes", "no", "unknown"],
          },
          competitive_process: {
            type: "string",
            enum: ["yes", "no", "unknown"],
          },
          single_supplier: {
            type: "string",
            enum: ["yes", "no", "unknown"],
          },
          partners: { type: "string", enum: ["yes", "no", "unknown"] },
          privacy_or_personal_data: {
            type: "string",
            enum: ["yes", "no", "unknown"],
          },
          copyrights_or_ip: {
            type: "string",
            enum: ["yes", "no", "unknown"],
          },
          participant_photography: {
            type: "string",
            enum: ["yes", "no", "unknown"],
          },
          insurance_required: {
            type: "string",
            enum: ["yes", "no", "unknown"],
          },
          subcontractors: {
            type: "string",
            enum: ["yes", "no", "unknown"],
          },
          supplier_terms: { type: "array", items: { type: "string" } },
          documents: { type: "array", items: { type: "string" } },
          risks_and_exceptions: { type: "array", items: { type: "string" } },
          missing_info: { type: "array", items: { type: "string" } },
          reason_for_legal_review: { type: "string" },
        },
        required: [
          "department_or_project",
          "purpose",
          "second_party",
          "supplier_status",
          "agreement_type_estimate",
          "party_roles",
          "amount",
          "timeline",
          "quote_exists",
          "supplier_selected",
          "competitive_process",
          "single_supplier",
          "partners",
          "privacy_or_personal_data",
          "copyrights_or_ip",
          "participant_photography",
          "insurance_required",
          "subcontractors",
          "supplier_terms",
          "documents",
          "risks_and_exceptions",
          "missing_info",
          "reason_for_legal_review",
        ],
      },
      questions_to_complete_he: {
        type: "array",
        items: { type: "string" },
      },
      ready_for_summary: { type: "boolean" },
      assistant_message_he: { type: "string" },
    },
    required: [
      "legal_case",
      "questions_to_complete_he",
      "ready_for_summary",
      "assistant_message_he",
    ],
  },
};
