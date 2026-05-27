// Client-side fallback formatter for the short approval summary shown in chat.
// Used when the LLM's approval_summary_he is empty (e.g., post-dedup force-ready)
// or after the user edits fields locally and the LLM string becomes stale.

import type { IntakeSummary, MissingItem } from "./aiTypes";

const SECOND_PARTY_LABEL: Record<string, string> = {
  company: "חברה",
  nonprofit: "עמותה",
  public_body: "גוף ציבורי",
  individual: "אדם פרטי",
  unknown: "",
};

const URGENCY_LABEL: Record<string, string> = {
  urgent: "דחוף",
  critical: "קריטי",
  normal: "",
  unknown: "",
};

/** Build a short bullet-list approval summary from structured data. */
export function buildShortApprovalSummary(
  intake: IntakeSummary,
  missing: MissingItem[],
): string {
  const bullets: string[] = [];

  // 1. Purpose / mahut
  if (intake.request_purpose) {
    bullets.push(`• ${intake.request_purpose}`);
  } else if (intake.background) {
    bullets.push(`• ${truncate(intake.background, 120)}`);
  }

  // 2. Second party
  if (intake.second_party_name) {
    const type = SECOND_PARTY_LABEL[intake.second_party_type] ?? "";
    bullets.push(
      `• הצד השני: ${intake.second_party_name}${type ? ` (${type})` : ""}`,
    );
  }

  // 3. Amount + timeline
  const moneyParts: string[] = [];
  if (intake.amount != null) {
    moneyParts.push(`${intake.amount.toLocaleString("he-IL")} ₪`);
  }
  if (intake.timeline) {
    moneyParts.push(intake.timeline);
  }
  const urgencyLabel = URGENCY_LABEL[intake.urgency] ?? "";
  if (urgencyLabel) {
    moneyParts.push(urgencyLabel);
  }
  if (moneyParts.length > 0) {
    bullets.push(`• סכום ולו״ז: ${moneyParts.join(" • ")}`);
  }

  // 4. Documents
  const docParts: string[] = [];
  if (intake.quote_exists === "yes") docParts.push("הצעת מחיר");
  if (intake.documents_mentioned && intake.documents_mentioned.length > 0) {
    for (const d of intake.documents_mentioned.slice(0, 2)) {
      if (!docParts.includes(d)) docParts.push(d);
    }
  }
  if (docParts.length > 0) {
    bullets.push(`• מסמכים קיימים: ${docParts.join(", ")}`);
  }

  // 5. Legal attention points
  const attention: string[] = [];
  if (intake.privacy_or_personal_data === "yes") attention.push("מידע אישי");
  if (intake.ip_or_copyrights === "yes") attention.push("זכויות יוצרים / IP");
  if (intake.participant_photography === "yes") attention.push("צילום משתתפים");
  if (intake.insurance_or_operational_risk === "yes") attention.push("ביטוח / סיכון תפעולי");
  if (intake.subcontractors === "yes") attention.push("ספקי משנה");
  if (intake.supplier_terms_or_contract === "yes") attention.push("תנאי ספק");
  if (intake.grant_related === "yes") attention.push("רכיב מענק");
  if (intake.partners_involved) attention.push("שותפים נוספים");
  if (attention.length > 0) {
    bullets.push(`• נקודות שחשוב למשפטית: ${attention.slice(0, 3).join(", ")}`);
  }

  // 6. Missing info (top 3)
  if (missing && missing.length > 0) {
    const top = missing
      .slice()
      .sort((a, b) => importanceRank(a.importance) - importanceRank(b.importance))
      .slice(0, 3)
      .map((m) => m.question_he.replace(/\?$/, ""));
    if (top.length > 0) {
      bullets.push(`• מידע שחסר כרגע: ${top.join("; ")}`);
    }
  }

  // Cap at 6 bullets
  const finalBullets = bullets.slice(0, 6).join("\n");

  return [
    "יש לי מספיק מידע להכין את הפנייה. זה מה שקלטתי:",
    "",
    finalBullets,
    "",
    "האם זה מדויק ואפשר להעביר למשפטית?",
  ].join("\n");
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + "…";
}

function importanceRank(i: "high" | "medium" | "low"): number {
  return i === "high" ? 0 : i === "medium" ? 1 : 2;
}
