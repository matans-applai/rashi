import type {
  ClassificationInput,
  ClassificationResult,
  RoutingOutcome,
} from "./types";
import { lookupSupplier } from "./suppliers";

/**
 * Rules-based classifier for the POC.
 *
 * Designed to be swappable with an LLM later:
 *   - Pure function, no side effects.
 *   - Single input object, single output object.
 *   - All Hebrew copy lives here so prompts can mirror it later.
 *
 * To swap in an LLM later, implement `classifyWithLLM(input)` with the same
 * signature and route to it from `classifyRequest`.
 */

const LEGAL_KEYWORDS = [
  "משרד ממשלתי",
  "ג׳וינט",
  "ג'וינט",
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
  "פרטיות",
  "מידע אישי",
  "תעודת זהות",
  "תעודות זהות",
  "רשימות משתתפים",
  "צילום משתתפים",
  "סודיות",
  "אחריות מקצועית",
  "הסכם של הספק",
  "חוזה של הספק",
  "תנאים חריגים",
  "200000",
  "200,000",
  "200 אלף",
];

const SUPPLIER_REG_KEYWORDS = [
  "לא במאגר",
  "לא רשום",
  "ספק חדש",
  "לפתוח ספק",
  "לא יודע אם במאגר",
  "מאגר 2026",
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
  { tag: "אוכל / כיבוד", keywords: ["אוכל", "כיבוד", "קייטרינג"] },
  { tag: "לינה / אירוח", keywords: ["לינה", "אירוח", "מלון"] },
];

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

function isMissingInfo(input: ClassificationInput): boolean {
  const desc = input.description.trim();
  if (desc.length < 15) return true;
  // Need at least *some* signal: department or supplier or amount or file
  const wordCount = desc.split(/\s+/).filter(Boolean).length;
  if (wordCount < 4) return true;
  return false;
}

export function classifyRequest(
  input: ClassificationInput
): ClassificationResult {
  const haystack = [
    input.description,
    input.department,
    input.supplierName,
  ]
    .filter(Boolean)
    .join(" \n ");

  // ---------- Priority 1: missing_info ----------
  if (isMissingInfo(input)) {
    return {
      outcome: "missing_info",
      message:
        "חסר מידע בסיסי כדי להמליץ על המשך פעולה. מומלץ להוסיף תיאור קצר של מטרת ההתקשרות, ספק אם ידוע, סכום ומסמכים קיימים.",
      reasoning:
        "תיאור הפנייה קצר מדי או חסר פרטים מינימליים. כדי לסווג את הפנייה נכון יש להוסיף פרטים על מטרת ההתקשרות.",
      tags: ["מידע חסר"],
      matchedKeywords: [],
      nextActions: [
        { label: "חזור והוסף פרטים", kind: "primary" },
      ],
    };
  }

  // ---------- Priority 2: legal_review ----------
  const legalHits = findMatches(haystack, LEGAL_KEYWORDS);
  const amountTriggers =
    input.amount !== null && input.amount >= 200000 ? ["סכום ≥ 200,000 ₪"] : [];
  if (legalHits.length > 0 || amountTriggers.length > 0) {
    return {
      outcome: "legal_review",
      message:
        "לפי המידע שהוזן, נראה שהפנייה כוללת רכיב שמצריך בדיקה משפטית. מומלץ להשלים פרטים נוספים כדי לקדם את הטיפול, או לשלוח את הפנייה עם המידע שהוזן עד כה.",
      reasoning: buildReasoning("legal_review", {
        legalHits,
        amountTriggers,
      }),
      tags: dedupe(["בדיקה משפטית", ...legalHits, ...amountTriggers]),
      matchedKeywords: dedupe([...legalHits, ...amountTriggers]),
      nextActions: [
        { label: "המשך להשלמת פרטים", kind: "primary" },
        { label: "שלח לבדיקה משפטית עם המידע הקיים", kind: "secondary" },
      ],
    };
  }

  // ---------- Priority 3: supplier_registration ----------
  const supplierHits = findMatches(haystack, SUPPLIER_REG_KEYWORDS);
  const supplier = lookupSupplier(input.supplierName);
  const dbSaysUnregistered = supplier?.status === "not_registered";
  if (supplierHits.length > 0 || dbSaysUnregistered) {
    return {
      outcome: "supplier_registration",
      message:
        "נראה שהספק אינו רשום במאגר 2026 או שסטטוס הרישום שלו אינו ברור. יש להשלים רישום ספק לפני המשך התקשרות.",
      reasoning: buildReasoning("supplier_registration", {
        supplierHits,
        supplierName: input.supplierName,
        supplierStatus: supplier?.status,
      }),
      tags: dedupe([
        "רישום ספק",
        ...(dbSaysUnregistered ? ["ספק לא רשום במאגר"] : []),
        ...supplierHits,
      ]),
      matchedKeywords: dedupe([
        ...supplierHits,
        ...(dbSaysUnregistered ? ["סטטוס מאגר: לא רשום"] : []),
      ]),
      supplierStatus: supplier?.status,
      nextActions: [
        {
          label: "פתח קישור רישום ספק",
          href: "https://example.com/supplier-registration",
          kind: "primary",
        },
        { label: "בכל זאת העבר לבדיקה משפטית", kind: "secondary" },
      ],
    };
  }

  // ---------- Priority 4: insurance_required ----------
  const insuranceTags: string[] = [];
  const insuranceHits: string[] = [];
  for (const rule of INSURANCE_TAG_RULES) {
    const hits = findMatches(haystack, rule.keywords);
    if (hits.length > 0) {
      insuranceTags.push(rule.tag);
      insuranceHits.push(...hits);
    }
  }
  if (insuranceTags.length > 0) {
    return {
      outcome: "insurance_required",
      message:
        "לפי תיאור הפעילות, נראה שנדרש אישור ביטוח מתאים לפני המשך התקשרות.",
      reasoning: buildReasoning("insurance_required", {
        insuranceHits,
        insuranceTags,
      }),
      tags: dedupe(["נדרש אישור ביטוח", ...insuranceTags]),
      matchedKeywords: dedupe(insuranceHits),
      nextActions: [
        { label: "הצג הנחיות ביטוח", kind: "primary" },
        { label: "בכל זאת העבר לבדיקה משפטית", kind: "secondary" },
      ],
    };
  }

  // ---------- Priority 5: general_terms ----------
  return {
    outcome: "general_terms",
    message:
      "לפי המידע שהוזן, נראה שניתן להתקדם במסלול תנאי התקשרות רגילים. יש לוודא שהספק רשום במאגר ושאין תנאים חריגים נוספים.",
    reasoning:
      "לא זוהו טריגרים משפטיים, רישומיים או ביטוחיים בתיאור הפנייה. הפנייה מתאימה למסלול תנאי התקשרות רגילים.",
    tags: ["תנאי התקשרות רגילים"],
    matchedKeywords: [],
    supplierStatus: supplier?.status,
    nextActions: [
      {
        label: "הורד מסמך תנאי התקשרות",
        href: "/files/general-terms-placeholder.txt",
        kind: "primary",
      },
      { label: "בכל זאת העבר לבדיקה משפטית", kind: "secondary" },
    ],
  };
}

function dedupe<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

function buildReasoning(
  outcome: RoutingOutcome,
  ctx: {
    legalHits?: string[];
    amountTriggers?: string[];
    supplierHits?: string[];
    supplierName?: string;
    supplierStatus?: "registered" | "not_registered" | "unknown";
    insuranceHits?: string[];
    insuranceTags?: string[];
  }
): string {
  const parts: string[] = [];
  if (outcome === "legal_review") {
    if (ctx.legalHits?.length) {
      parts.push(`זוהו מילות מפתח משפטיות: ${ctx.legalHits.join(", ")}.`);
    }
    if (ctx.amountTriggers?.length) {
      parts.push(
        "הסכום שהוזן עומד או עולה על סף של 200,000 ₪ ולכן מצריך בדיקה משפטית."
      );
    }
  }
  if (outcome === "supplier_registration") {
    if (ctx.supplierStatus === "not_registered") {
      parts.push(
        `הספק "${ctx.supplierName}" אינו רשום במאגר 2026 לפי הנתונים שבמערכת.`
      );
    }
    if (ctx.supplierHits?.length) {
      parts.push(
        `זוהו ביטויים המעידים על ספק שאינו רשום: ${ctx.supplierHits.join(", ")}.`
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

/**
 * Placeholder for the future LLM-based classifier.
 * Keep the signature identical to `classifyRequest` so the router can swap implementations.
 *
 * export async function classifyWithLLM(input: ClassificationInput): Promise<ClassificationResult> {
 *   // Call your Claude API endpoint here. Map response to ClassificationResult.
 * }
 */
