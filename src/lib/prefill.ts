import type { LegalIntakePayload, RequestRecord } from "./types";

/**
 * Build a partial LegalIntakePayload from what we already know about the
 * request. Goal: the user shouldn't have to retype anything the system has
 * already seen.
 *
 * Conservative on purpose — anything we are not confident about is left empty
 * so the user fills it in.
 */
export function buildLegalIntakePrefill(req: RequestRecord): LegalIntakePayload {
  const desc = req.description ?? "";
  const supplier = req.supplier_name ?? "";
  const tags = req.tags ?? [];

  const inDesc = (kw: string[]) =>
    kw.some((k) => desc.toLowerCase().includes(k.toLowerCase()));
  const hasTag = (kw: string[]) =>
    tags.some((t) => kw.some((k) => t.includes(k)));

  return {
    // ---- Card 1: engagement details ----
    purpose: extractPurpose(desc),
    agreementType: detectAgreementType(desc),
    counterparty: supplier,
    amount: req.amount != null ? String(req.amount) : "",
    schedule: extractSchedule(desc),
    budgetLine: "",

    // ---- Card 2: supplier & docs ----
    // If a supplier name was provided, treat it as "selected = yes".
    supplierSelected: supplier ? "yes" : "",
    competitiveProcess: "",
    singleSupplier: "",
    hasQuote: /הצעת מחיר/.test(desc) ? "yes" : "",

    // ---- Card 3: risks & exceptions ----
    partners: inDesc([
      "שותפים",
      "מיזם משותף",
      "שיתוף פעולה",
      "שותף אסטרטגי",
      "ג׳וינט",
      "ג'וינט",
      "משרד ממשלתי",
      "ביטוח לאומי",
    ])
      ? "yes"
      : "",
    privacy: inDesc([
      "פרטיות",
      "מידע אישי",
      "תעודת זהות",
      "תעודות זהות",
      "רשימות משתתפים",
      "אימייל",
      "טלפון",
    ])
      ? "yes"
      : "",
    copyright: inDesc(["זכויות יוצרים", "קניין רוחני"]) ? "yes" : "",
    filmingParticipants: inDesc([
      "צילום משתתפים",
      "מצלמים משתתפים",
      "נצלם",
      "תמונות משתתפים",
      "תיעוד מצולם",
    ])
      ? "yes"
      : "",
    insuranceNeeded:
      hasTag(["ביטוח", "פעילות אתגרית", "ODT", "הסעות", "אוכל", "לינה"]) ||
      inDesc([
        "ביטוח",
        "ODT",
        "אודיטי",
        "פעילות אתגרית",
        "חבלים",
        "טיול",
        "ג׳יפים",
        "ג'יפים",
        "הסעות",
        "קייטרינג",
        "מלון",
      ])
        ? "yes"
        : "",
    subcontractors: inDesc(["קבלן משנה", "ספקי משנה", "ספק משנה"]) ? "yes" : "",
    notes: "",
  };
}

/**
 * Take the first sentence (or first ~140 chars) of the description as a
 * starting point for "מטרת ההתקשרות". The user can edit.
 */
function extractPurpose(desc: string): string {
  if (!desc) return "";
  const trimmed = desc.trim();
  const m = trimmed.match(/^([^.!?\n]+)/);
  const first = (m?.[1] ?? trimmed).trim();
  if (first.length <= 140) return first;
  return first.slice(0, 140).trim() + "…";
}

function detectAgreementType(desc: string): "new" | "extension" | "" {
  if (!desc) return "";
  if (/הארכת התקשרות|המשך התקשרות|הארכה|חידוש הסכם/.test(desc))
    return "extension";
  if (/הסכם חדש|התקשרות חדשה|התקשרות ראשונה/.test(desc)) return "new";
  // "מתמשך" alone is ambiguous — could be either. Leave empty.
  return "";
}

/**
 * Light extraction of common Hebrew time-window phrases. If multiple matches
 * exist, return the first one. The user can always edit.
 */
function extractSchedule(desc: string): string {
  if (!desc) return "";
  const patterns: RegExp[] = [
    /חצי שנה/,
    /שנה(?:\s+ימים)?/,
    /(\d+)\s*(?:חודשים|חודש)/,
    /(\d+)\s*(?:שבועות|שבוע)/,
    /(\d+)\s*(?:ימים|יום)/,
    /(\d+)\s*מפגשים/,
    /(?:ינואר|פברואר|מרץ|אפריל|מאי|יוני|יולי|אוגוסט|ספטמבר|אוקטובר|נובמבר|דצמבר)(?:\s*[-–]\s*(?:ינואר|פברואר|מרץ|אפריל|מאי|יוני|יולי|אוגוסט|ספטמבר|אוקטובר|נובמבר|דצמבר))?(?:\s*\d{4})?/,
  ];
  for (const p of patterns) {
    const m = desc.match(p);
    if (m) return m[0].trim();
  }
  return "";
}

/**
 * Which keys of the prefill came from the request? Used to render a small
 * "filled in for you" hint next to each prefilled field.
 */
export function prefilledKeys(prefill: LegalIntakePayload): Set<keyof LegalIntakePayload> {
  const keys = new Set<keyof LegalIntakePayload>();
  (Object.keys(prefill) as (keyof LegalIntakePayload)[]).forEach((k) => {
    const v = prefill[k];
    if (v === undefined || v === null || v === "") return;
    if (Array.isArray(v) && v.length === 0) return;
    keys.add(k);
  });
  return keys;
}
