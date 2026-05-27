import type {
  AgreementTypeEstimate,
  ClassificationInput,
  ClassificationResult,
  QuoteCleanliness,
  RoutingOutcome,
} from "./types";
import { lookupSupplier } from "./suppliers";
import {
  SAP_SUPPLIER_REGISTRATION_URL,
  RASHI_GENERAL_TERMS_DOC_URL,
  GRANT_MASTER_DOC_URL,
} from "./links";

/**
 * Rules-based classifier for the POC.
 *
 * Designed to be swappable with an LLM later:
 *   - Pure function, no side effects.
 *   - Single input object, single output object.
 *   - All Hebrew copy lives here so prompts can mirror it later.
 *
 * Priority order (highest first):
 *   1. missing_info       — only when description is essentially empty
 *   2. legal_review       — high-confidence legal triggers, supplier terms,
 *                            amount ≥ 200,000 ₪, or grant + legal mix
 *   3. grant              — money flowing to nonprofit/NGO for *their* project
 *   4. supplier_registration — supplier unknown/not_registered and no stronger trigger
 *   5. insurance_required — ODT, outdoors, transport, catering, lodging
 *   6. general_terms      — fallback: ordering a service, clean quote
 */

// ---------------------------------------------------------------------------
// Keyword dictionaries
// ---------------------------------------------------------------------------

const LEGAL_KEYWORDS = [
  "משרד ממשלתי",
  "ג׳וינט",
  "ג'וינט",
  "JDC",
  "ביטוח לאומי",
  "מיזם משותף",
  "שיתוף פעולה",
  "שותף אסטרטגי",
  "יועץ",
  "ייעוץ",
  "ריטיינר",
  "מתמשך",
  "הארכת התקשרות",
  "זכויות יוצרים",
  "קניין רוחני",
  "פרטיות",
  "מידע אישי",
  "תעודת זהות",
  "תעודות זהות",
  "רשימות משתתפים",
  "צילום משתתפים",
  "סודיות",
  "אחריות מקצועית",
  "תנאים חריגים",
  "200000",
  "200,000",
  "200 אלף",
];

/**
 * Supplier "terms" — phrases that hint the supplier is bringing their own
 * agreement / payment / IP / liability clauses. Anything here pushes us to
 * legal_review even if the rest looks routine.
 */
const SUPPLIER_TERMS_KEYWORDS = [
  "הסכם של הספק",
  "חוזה של הספק",
  "ההסכם של הספק",
  "החוזה של הספק",
  "תנאי תשלום",
  "תנאי ביטול",
  "ביטול הזמנה",
  "פיצוי מוסכם",
  "מקדמה",
  "תשלום מראש",
  "זכויות פרסום",
  "קרדיט פרסום",
  "שמירת בעלות",
  "בעלות על תוצרים",
  "אחריות מקצועית",
  "שימוש חוזר",
  "תנאי שימוש",
  "סודיות",
  "NDA",
];

interface InsuranceTagRule {
  tag: string;
  keywords: string[];
}

const INSURANCE_TAG_RULES: InsuranceTagRule[] = [
  {
    tag: "פעילות אתגרית / ODT",
    keywords: ["ODT", "אודיטי", "פעילות אתגרית", "חבלים", "נגרות", "שטח"],
  },
  { tag: "הסעות", keywords: ["הסעות", "ג׳יפים", "ג'יפים", "טיול"] },
  { tag: "אוכל / כיבוד", keywords: ["אוכל", "כיבוד", "קייטרינג", "ארוחת"] },
  { tag: "לינה / אירוח", keywords: ["לינה", "אירוח", "מלון"] },
  {
    tag: "פעילות עם משתתפים",
    keywords: ["משתתפים", "בני נוער", "ילדים", "תלמידים", "סדנה", "סדנא"],
  },
];

const GRANT_KEYWORDS = [
  "מענק",
  "תמיכה",
  "תמיכת קרן",
  "עמותה",
  'חל"צ',
  "חלצ",
  'מלכ"ר',
  "מלכר",
  "גוף נתמך",
  "בקשה למענק",
  "בקשת מענק",
  "פרויקט של העמותה",
  "מטרות ציבוריות",
];

const SUPPLIER_REG_KEYWORDS = [
  "לא במאגר",
  "לא רשום",
  "ספק חדש",
  "לפתוח ספק",
  "לא יודע אם במאגר",
  "מאגר 2026",
  "אינו רשום",
  "טרם נרשם",
];

const COOPERATION_KEYWORDS = [
  "שיתוף פעולה",
  "מיזם משותף",
  "שותף אסטרטגי",
  "שותפות",
];

const GOV_KEYWORDS = [
  "משרד ממשלתי",
  "ג׳וינט",
  "ג'וינט",
  "JDC",
  "ביטוח לאומי",
  "רשות מקומית",
  "עירייה",
];

const SPONSORSHIP_KEYWORDS = ["חסות", "ספונסר", "תרומה", "מתורם"];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalize(s: string): string {
  return s.toLowerCase();
}

function findMatches(text: string, keywords: string[]): string[] {
  const t = normalize(text);
  const hits: string[] = [];
  for (const k of keywords) {
    if (t.includes(normalize(k))) hits.push(k);
  }
  return hits;
}

function dedupe<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

function isMissingInfo(input: ClassificationInput): boolean {
  const desc = input.description.trim();
  if (desc.length < 15) return true;
  const wordCount = desc.split(/\s+/).filter(Boolean).length;
  if (wordCount < 4) return true;
  return false;
}

/**
 * Infer the engagement type. Used for the "מה המערכת הבינה" summary and as
 * prefill for the legal intake. Not authoritative — user can override.
 */
function inferAgreementTypeEstimate(opts: {
  haystack: string;
  isGrant: boolean;
  hasGov: boolean;
  hasCooperation: boolean;
  hasSponsorship: boolean;
}): AgreementTypeEstimate {
  if (opts.isGrant) return "grant";
  if (opts.hasGov) return "government_joint";
  if (opts.hasCooperation) return "cooperation";
  if (opts.hasSponsorship) return "sponsorship";
  // default: ordering services / goods
  if (opts.haystack.trim().length > 0) return "service_purchase";
  return "other";
}

// ---------------------------------------------------------------------------
// Main classifier
// ---------------------------------------------------------------------------

export function classifyRequest(
  input: ClassificationInput
): ClassificationResult {
  const haystack = [input.description, input.department, input.supplierName]
    .filter(Boolean)
    .join(" \n ");

  // ----- Detect all signal groups up front -----
  const legalHits = findMatches(haystack, LEGAL_KEYWORDS);
  const supplierTermsHits = findMatches(haystack, SUPPLIER_TERMS_KEYWORDS);
  const grantHits = findMatches(haystack, GRANT_KEYWORDS);
  const supplierRegHits = findMatches(haystack, SUPPLIER_REG_KEYWORDS);
  const govHits = findMatches(haystack, GOV_KEYWORDS);
  const coopHits = findMatches(haystack, COOPERATION_KEYWORDS);
  const sponsorshipHits = findMatches(haystack, SPONSORSHIP_KEYWORDS);

  const insuranceTags: string[] = [];
  const insuranceHits: string[] = [];
  for (const rule of INSURANCE_TAG_RULES) {
    const hits = findMatches(haystack, rule.keywords);
    if (hits.length > 0) {
      insuranceTags.push(rule.tag);
      insuranceHits.push(...hits);
    }
  }

  const amountTriggers =
    input.amount !== null && input.amount >= 200000 ? ["סכום ≥ 200,000 ₪"] : [];

  const supplier = lookupSupplier(input.supplierName);
  const supplierUnregistered = supplier?.status === "not_registered";
  const supplierUnknown = !!input.supplierName && supplier == null;

  const isGrant = grantHits.length > 0;

  const agreementTypeEstimate = inferAgreementTypeEstimate({
    haystack,
    isGrant,
    hasGov: govHits.length > 0,
    hasCooperation: coopHits.length > 0,
    hasSponsorship: sponsorshipHits.length > 0,
  });

  const quoteCleanliness: QuoteCleanliness =
    supplierTermsHits.length > 0 ? "supplier_terms" : "clean";

  const base = {
    supplierStatus: supplier?.status,
    agreementTypeEstimate,
    quoteCleanliness,
    supplierTermsTriggers: dedupe(supplierTermsHits),
    grantTriggers: dedupe(grantHits),
    isGrant,
  };

  // ---------- Priority 1: missing_info ----------
  if (isMissingInfo(input)) {
    return {
      outcome: "missing_info",
      message:
        "חסר מידע בסיסי כדי להמליץ על המשך פעולה. אפשר להוסיף כמה משפטים על מטרת ההתקשרות, מי הצד השני, ומה הסכום המשוער — ואז להריץ שוב.",
      reasoning:
        "תיאור הפנייה קצר מדי או חסר פרטים מינימליים. כדי לסווג את הפנייה נכון יש להוסיף פרטים על מטרת ההתקשרות.",
      tags: ["מידע חסר"],
      matchedKeywords: [],
      clarifyingQuestions: [
        "מה המטרה של ההתקשרות?",
        "מי הספק או הצד השני?",
        "מה הסכום המשוער?",
      ],
      nextActions: [
        { label: "חזור והוסף פרטים", kind: "primary" },
      ],
      ...base,
    };
  }

  // ---------- Priority 2: legal_review ----------
  const triggeredByLegal = legalHits.length > 0;
  const triggeredByAmount = amountTriggers.length > 0;
  const triggeredBySupplierTerms = supplierTermsHits.length > 0;
  const triggeredByGrantPlusLegal =
    isGrant && (triggeredByLegal || triggeredBySupplierTerms || triggeredByAmount);

  if (
    triggeredByLegal ||
    triggeredByAmount ||
    triggeredBySupplierTerms ||
    triggeredByGrantPlusLegal
  ) {
    const grantNote = isGrant
      ? " פנייה זו כוללת גם רכיב מענק; הבדיקה המשפטית תכלול את שני ההיבטים."
      : "";
    return {
      outcome: "legal_review",
      message:
        "לפי המידע שהוזן, נראה שהפנייה כוללת רכיב שמצריך בדיקה משפטית." +
        grantNote +
        " מומלץ להשלים פרטים נוספים כדי לקדם את הטיפול, או לשלוח את הפנייה עם המידע שהוזן עד כה.",
      reasoning: buildReasoning("legal_review", {
        legalHits,
        amountTriggers,
        supplierTermsHits,
        isGrant,
      }),
      tags: dedupe([
        "בדיקה משפטית",
        ...(triggeredBySupplierTerms ? ["תנאי ספק"] : []),
        ...(isGrant ? ["מענק"] : []),
        ...legalHits,
        ...amountTriggers,
      ]),
      matchedKeywords: dedupe([
        ...legalHits,
        ...amountTriggers,
        ...supplierTermsHits,
      ]),
      nextActions: [
        { label: "המשך להשלמת פרטים", kind: "primary" },
        { label: "שלח לבדיקה משפטית עם המידע הקיים", kind: "secondary" },
      ],
      ...base,
    };
  }

  // ---------- Priority 3: grant ----------
  if (isGrant) {
    return {
      outcome: "grant",
      message:
        "לפי המידע שהוזן, נראה שהפנייה היא מסלול מענק — העברת כספים לעמותה / גוף נתמך לטובת פעילות שלהם. יש להשתמש במאסטר כתב התחייבות לקבלת מענק ולהשלים את חבילת המסמכים הנדרשת.",
      reasoning: buildReasoning("grant", { grantHits }),
      tags: dedupe(["מסלול מענק", ...grantHits]),
      matchedKeywords: dedupe(grantHits),
      nextActions: [
        {
          label: "פתח מאסטר כתב התחייבות למענק",
          href: GRANT_MASTER_DOC_URL,
          kind: "primary",
        },
        {
          label: "המשך לרשימת מסמכי מענק",
          kind: "secondary",
        },
      ],
      ...base,
    };
  }

  // ---------- Priority 4: supplier_registration ----------
  if (supplierUnregistered || supplierRegHits.length > 0) {
    return {
      outcome: "supplier_registration",
      message:
        "נראה שהספק אינו רשום במאגר 2026 או שסטטוס הרישום שלו אינו ברור. יש להשלים רישום ספק לפני המשך התקשרות. כחלק מהרישום הספק חותם על תנאי ההתקשרות הכלליים של הקרן.",
      reasoning: buildReasoning("supplier_registration", {
        supplierRegHits,
        supplierName: input.supplierName,
        supplierStatus: supplier?.status,
      }),
      tags: dedupe([
        "רישום ספק",
        ...(supplierUnregistered ? ["ספק לא רשום במאגר"] : []),
        ...supplierRegHits,
      ]),
      matchedKeywords: dedupe(supplierRegHits),
      nextActions: [
        {
          label: "פתח קישור רישום ספק (SAP)",
          href: SAP_SUPPLIER_REGISTRATION_URL,
          kind: "primary",
        },
        { label: "צור הודעה לספק עם הקישור", kind: "secondary" },
      ],
      ...base,
    };
  }

  // ---------- Priority 5: insurance_required ----------
  if (insuranceTags.length > 0) {
    return {
      outcome: "insurance_required",
      message:
        "לפי תיאור הפעילות, ניתן להתקדם במסלול תנאי ההתקשרות הכלליים בכפוף להשלמת אישור ביטוח מתאים לסוג השירות.",
      reasoning: buildReasoning("insurance_required", {
        insuranceHits,
        insuranceTags,
      }),
      tags: dedupe(["תנאי התקשרות + ביטוח", ...insuranceTags]),
      matchedKeywords: dedupe(insuranceHits),
      // The classifier hints the operational summary — we'll also offer up to
      // 3 clarifying questions in the summary screen if details are missing.
      clarifyingQuestions: buildInsuranceQuestions({
        haystack,
        amount: input.amount,
      }),
      nextActions: [
        { label: "הצג אישור ביטוח לפי סוג שירות", kind: "primary" },
        { label: "בכל זאת העבר לבדיקה משפטית", kind: "secondary" },
      ],
      ...base,
    };
  }

  // ---------- Priority 6: general_terms ----------
  const noteSupplierUnknown = supplierUnknown
    ? " הספק שהוזן לא מופיע במאגר הדמו — כדאי לוודא רישום ספק לפני שליחת הזמנת רכש."
    : "";

  return {
    outcome: "general_terms",
    message:
      "ניתן להתקדם על בסיס תנאי ההתקשרות הכלליים של קרן רש״י, בכפוף לכך שהספק במאגר, קיימת הצעת מחיר נקייה, ותונפק הזמנת רכש חתומה לפי נוהל הקרן." +
      noteSupplierUnknown,
    reasoning:
      "לא זוהו טריגרים משפטיים, מענקיים, רישומיים או ביטוחיים. ההצעה לא כוללת תנאי ספק חריגים.",
    tags: dedupe([
      "תנאי התקשרות כלליים",
      ...(supplier?.status === "registered" ? ["ספק במאגר"] : []),
    ]),
    matchedKeywords: [],
    nextActions: [
      {
        label: "הצג את תנאי ההתקשרות הכלליים",
        href: RASHI_GENERAL_TERMS_DOC_URL,
        kind: "primary",
      },
      { label: "בכל זאת העבר לבדיקה משפטית", kind: "secondary" },
    ],
    ...base,
  };
}

// ---------------------------------------------------------------------------
// Reasoning builder
// ---------------------------------------------------------------------------

function buildReasoning(
  outcome: RoutingOutcome,
  ctx: {
    legalHits?: string[];
    amountTriggers?: string[];
    supplierTermsHits?: string[];
    supplierRegHits?: string[];
    supplierName?: string;
    supplierStatus?: "registered" | "not_registered" | "unknown";
    insuranceHits?: string[];
    insuranceTags?: string[];
    grantHits?: string[];
    isGrant?: boolean;
  }
): string {
  const parts: string[] = [];
  if (outcome === "legal_review") {
    if (ctx.legalHits?.length) {
      parts.push(`זוהו מילות מפתח משפטיות: ${ctx.legalHits.join(", ")}.`);
    }
    if (ctx.amountTriggers?.length) {
      parts.push("הסכום שעל הפרק עומד או עולה על 200,000 ₪.");
    }
    if (ctx.supplierTermsHits?.length) {
      parts.push(
        `ההצעה / התיאור כוללים תנאי ספק חריגים (${ctx.supplierTermsHits.join(", ")}), ולכן ההצעה אינה "נקייה" וההסכם דורש בדיקה משפטית.`
      );
    }
    if (ctx.isGrant) {
      parts.push("בנוסף, הפנייה כוללת רכיב של מענק לעמותה / גוף נתמך.");
    }
  }
  if (outcome === "grant") {
    if (ctx.grantHits?.length) {
      parts.push(`זוהו מילות מפתח של מסלול מענק: ${ctx.grantHits.join(", ")}.`);
    }
    parts.push("מדובר ככל הנראה בהעברת כספים לפעילות של הצד השני, ולא ברכישת שירות עבור הקרן.");
  }
  if (outcome === "supplier_registration") {
    if (ctx.supplierStatus === "not_registered") {
      parts.push(
        `הספק "${ctx.supplierName}" אינו רשום במאגר 2026 לפי הנתונים שבמערכת.`
      );
    }
    if (ctx.supplierRegHits?.length) {
      parts.push(
        `זוהו ביטויים המעידים על ספק שאינו רשום: ${ctx.supplierRegHits.join(", ")}.`
      );
    }
  }
  if (outcome === "insurance_required") {
    if (ctx.insuranceTags?.length) {
      parts.push(
        `זוהו קטגוריות פעילות המצריכות אישור ביטוח: ${ctx.insuranceTags.join(", ")}.`
      );
    }
    if (ctx.insuranceHits?.length) {
      parts.push(`מילות מפתח: ${ctx.insuranceHits.join(", ")}.`);
    }
  }
  return parts.join(" ");
}

// ---------------------------------------------------------------------------
// Insurance clarifying questions
// ---------------------------------------------------------------------------

function buildInsuranceQuestions(opts: {
  haystack: string;
  amount: number | null;
}): string[] {
  const qs: string[] = [];
  const t = normalize(opts.haystack);
  if (!/\d+\s*(?:משתתפים|אנשים|עובדים)/.test(t)) {
    qs.push("כמה משתתפים צפויים בפעילות?");
  }
  if (!/(?:יום|תאריך|חודש|שבוע)/.test(t)) {
    qs.push("מתי הפעילות מתוכננת?");
  }
  if (opts.amount == null) {
    qs.push("מה הסכום המשוער של ההתקשרות?");
  }
  return qs.slice(0, 3);
}

/**
 * Placeholder for the future LLM-based classifier.
 * Keep the signature identical to `classifyRequest` so the router can swap implementations.
 *
 * export async function classifyWithLLM(input: ClassificationInput): Promise<ClassificationResult> {
 *   // Call your Claude API endpoint here. Map response to ClassificationResult.
 * }
 */
