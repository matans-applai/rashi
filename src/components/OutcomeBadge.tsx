import type { RoutingOutcome, RequestStatus } from "../lib/types";

const OUTCOME_LABEL: Record<RoutingOutcome, string> = {
  general_terms: "תנאי התקשרות רגילים",
  supplier_registration: "רישום ספק נדרש",
  insurance_required: "נדרש אישור ביטוח",
  legal_review: "בדיקה משפטית",
  missing_info: "חסר מידע",
};

const OUTCOME_CLASS: Record<RoutingOutcome, string> = {
  general_terms: "tag-green",
  supplier_registration: "tag-violet",
  insurance_required: "tag-amber",
  legal_review: "tag-red",
  missing_info: "tag-blue",
};

export function OutcomeBadge({ outcome }: { outcome: RoutingOutcome | null }) {
  if (!outcome) return <span className="tag">לא מסווג</span>;
  return <span className={OUTCOME_CLASS[outcome]}>{OUTCOME_LABEL[outcome]}</span>;
}

const STATUS_LABEL: Record<RequestStatus, string> = {
  draft: "טיוטה",
  classified: "סווג",
  sent_to_legal: "נשלח לבדיקה משפטית",
  completed: "הושלם",
};

const STATUS_CLASS: Record<RequestStatus, string> = {
  draft: "tag",
  classified: "tag-blue",
  sent_to_legal: "tag-red",
  completed: "tag-green",
};

export function StatusBadge({ status }: { status: RequestStatus }) {
  return <span className={STATUS_CLASS[status]}>{STATUS_LABEL[status]}</span>;
}

export { OUTCOME_LABEL };
