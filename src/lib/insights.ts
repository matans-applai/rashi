import type { RequestRecord, RoutingOutcome } from "./types";
import { lookupSupplier } from "./suppliers";

export interface RequestUnderstanding {
  facts: { label: string; value: string }[];
  observations: string[];
  missing: string[];
}

const OUTCOME_ACTION: Record<RoutingOutcome, string> = {
  general_terms:
    "אפשר להתקדם בתנאי ההתקשרות הכלליים של הקרן + הצעת מחיר נקייה + הזמנת רכש חתומה.",
  supplier_registration:
    "יש להשלים רישום ספק במאגר 2026 לפני המשך התקשרות (כולל חתימה על תנאי ההתקשרות הכלליים).",
  insurance_required:
    "ניתן להתקדם בתנאי ההתקשרות הכלליים, אך יש להשלים אישור ביטוח לפי סוג השירות.",
  legal_review: "יש להשלים פרטים קצרים ולהעביר לבדיקה משפטית.",
  grant: "מסלול מענק — שימוש במאסטר כתב התחייבות והשלמת חבילת מסמכי המענק.",
  missing_info: "נדרש מידע בסיסי כדי לסווג את הפנייה.",
};

export function buildRequestUnderstanding(req: RequestRecord): RequestUnderstanding {
  const desc = req.description.trim();
  const observations = buildObservations(req);
  const missing = buildMissing(req).slice(0, 3); // cap to 3 — don't overwhelm

  return {
    facts: [
      { label: "מיזם / מחלקה", value: req.department || "לא צויין" },
      { label: "מטרת ההתקשרות", value: extractPurpose(desc) || "לא זוהתה" },
      { label: "ספק / צד שני", value: req.supplier_name || "לא צויין" },
      { label: "סטטוס ספק במאגר", value: supplierStatusLabel(req) },
      {
        label: "סכום משוער",
        value:
          req.amount != null
            ? `${req.amount.toLocaleString("he-IL")} ₪`
            : "לא צויין",
      },
      { label: "אופי ההתקשרות", value: detectEngagementType(desc) },
      { label: "לוח זמנים", value: extractSchedule(desc) || "לא צויין" },
      {
        label: "מסמכים",
        value: req.file_paths.length
          ? `צורפו ${req.file_paths.length} קבצים`
          : "לא צורפו קבצים",
      },
      {
        label: "המשך מומלץ",
        value: req.outcome ? OUTCOME_ACTION[req.outcome] : "טרם סווג",
      },
    ],
    observations,
    missing,
  };
}

function supplierStatusLabel(req: RequestRecord): string {
  if (!req.supplier_name) return "לא צויין ספק";
  const s = lookupSupplier(req.supplier_name);
  if (!s) return "לא נמצא במאגר הדמו";
  if (s.status === "registered") return "רשום במאגר 2026";
  if (s.status === "not_registered") return "לא רשום במאגר 2026";
  return "סטטוס לא ברור";
}

function buildObservations(req: RequestRecord): string[] {
  const desc = req.description;
  const observations: string[] = [];
  const supplier = lookupSupplier(req.supplier_name ?? "");
  const add = (text: string) => {
    if (!observations.includes(text)) observations.push(text);
  };

  // Grant triggers
  if (
    hasAny(desc, ["מענק", "תמיכה", "עמותה", 'חל"צ', "חלצ", 'מלכ"ר', "מלכר", "גוף נתמך"])
  ) {
    add("זוהו רכיבי מסלול מענק — העברת כספים לפעילות של הצד השני, ולא רכישת שירות עבור הקרן.");
  }

  // Supplier-terms triggers (legal_review pressure)
  if (
    hasAny(desc, [
      "הסכם של הספק",
      "חוזה של הספק",
      "תנאי תשלום",
      "תנאי ביטול",
      "פיצוי מוסכם",
      "מקדמה",
      "תשלום מראש",
      "זכויות פרסום",
      "שמירת בעלות",
      "בעלות על תוצרים",
      "שימוש חוזר",
      "אחריות מקצועית",
      "סודיות",
      "NDA",
    ])
  ) {
    add(
      "ההצעה / התיאור כוללים תנאי ספק חריגים (תנאי תשלום, ביטול, IP, אחריות וכו') ולכן ההצעה אינה נחשבת 'נקייה' — נדרשת בדיקה משפטית."
    );
  }

  if (hasAny(desc, ["התקנה", "הרכבה", "חיבור לרשת", "העברת קבצים"])) {
    add("מדובר בעבודת התקנה / תפעול טכנית, עם רכיבים כמו הרכבה, חיבור לרשת או העברת קבצים.");
  }
  if (hasAny(desc, ["חד-פעמית", "חד פעמית", "פעם אחת"])) {
    add("הפעילות נראית חד-פעמית, ולכן אין כרגע סימן להתקשרות מתמשכת.");
  }
  if (hasAny(desc, ["יועץ", "ייעוץ", "ליווי", "ריטיינר", "מתמשך"])) {
    add("זוהה רכיב ייעוץ או ליווי מתמשך — כדאי להגדיר תכולה, אחריות מקצועית ולוחות זמנים.");
  }
  if (hasAny(desc, ["הצעת מחיר", "הצעות מחיר"])) {
    add("יש אינדיקציה להצעת מחיר. כדאי לצרף אותה או לוודא שהיא זמינה.");
  }
  if (hasAny(desc, ["לא במאגר", "לא רשום", "ספק חדש", "מאגר 2026"])) {
    add("סטטוס הספק במאגר אינו מוסדר או אינו ודאי. נדרש רישום במאגר 2026.");
  }
  if (supplier?.status === "not_registered") {
    add("לפי נתוני המאגר, הספק אינו מאושר. יש להפנותו לרישום ב-SAP.");
  }
  if (
    hasAny(desc, [
      "ODT",
      "אודיטי",
      "חבלים",
      "ג'יפים",
      "ג׳יפים",
      "הסעות",
      "מלון",
      "קייטרינג",
      "כיבוד",
      "ארוחת",
    ])
  ) {
    add("זוהו רכיבי פעילות שיכולים להצריך בדיקת ביטוח, כמו פעילות שטח, הסעות, אירוח או מזון.");
  }
  if (
    hasAny(desc, [
      "פרטיות",
      "מידע אישי",
      "תעודת זהות",
      "תעודות זהות",
      "טלפון",
      "אימייל",
      "רשימות משתתפים",
    ])
  ) {
    add("זוהה שימוש אפשרי במידע אישי של משתתפים, ולכן נדרשת תשומת לב לפרטיות ואבטחת מידע.");
  }
  if (hasAny(desc, ["צילום", "נצלם", "מצלמים", "תיעוד מצולם", "סרטון"])) {
    add("זוהה צילום או תיעוד משתתפים — כדאי לבדוק הסכמות ושימוש בתוצרים.");
  }
  if (
    hasAny(desc, [
      "שותפים",
      "מיזם משותף",
      "ג'וינט",
      "ג׳וינט",
      "JDC",
      "משרד ממשלתי",
      "ביטוח לאומי",
    ])
  ) {
    add("זוהה רכיב של שותפות או גורם חיצוני נוסף, שיכול להשפיע על נוסח ההתקשרות.");
  }
  if (req.amount != null && req.amount >= 200000) {
    add("הסכום עומד על 200,000 ₪ ומעלה, ולכן הוא טריגר לבדיקה משפטית.");
  }
  if (req.file_paths.length > 0) {
    add("צורפו מסמכים לפנייה. בשלב ה-POC הם נשמרים ונפתחים, אך התוכן שלהם עדיין לא מנותח אוטומטית.");
  }
  if (observations.length === 0) {
    add("לא זוהו סימנים חריגים מעבר לפרטים שהוזנו. ההצעה נראית נקייה ומתאימה לתנאי ההתקשרות הכלליים.");
  }
  return observations;
}

function buildMissing(req: RequestRecord): string[] {
  const missing: string[] = [];
  if (!req.supplier_name) missing.push("שם ספק / צד שני");
  if (req.amount == null) missing.push("סכום משוער");
  if (!extractSchedule(req.description)) missing.push("לוח זמנים / מועד ביצוע");
  if (req.file_paths.length === 0) missing.push("הצעת מחיר או מסמך תומך");
  return missing;
}

function extractPurpose(desc: string): string {
  if (!desc) return "";
  const first = desc.match(/^([^.!?\n]+)/)?.[1]?.trim() ?? desc;
  return first.length > 160 ? `${first.slice(0, 160).trim()}...` : first;
}

function detectEngagementType(desc: string): string {
  if (hasAny(desc, ["מענק", "תמיכה", "עמותה", "גוף נתמך"])) return "מסלול מענק";
  if (hasAny(desc, ["הארכת התקשרות", "המשך התקשרות", "חידוש הסכם", "הארכה"]))
    return "המשך / הארכת התקשרות";
  if (hasAny(desc, ["הסכם חדש", "התקשרות חדשה", "התקשרות ראשונה"]))
    return "התקשרות חדשה";
  if (hasAny(desc, ["חד-פעמית", "חד פעמית", "פעם אחת"])) return "עבודה חד-פעמית";
  if (hasAny(desc, ["מתמשך", "ריטיינר", "ליווי"])) return "התקשרות מתמשכת";
  if (hasAny(desc, ["שיתוף פעולה", "מיזם משותף"])) return "שיתוף פעולה / מיזם משותף";
  return "לא זוהה בבירור";
}

function extractSchedule(desc: string): string {
  const patterns: RegExp[] = [
    /חצי שנה/,
    /שנה(?:\s+ימים)?/,
    /(?:בשבוע הבא|בחודש הבא|מחר|היום)/,
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

function hasAny(text: string, keywords: string[]): boolean {
  const normalized = text.toLowerCase();
  return keywords.some((keyword) => normalized.includes(keyword.toLowerCase()));
}
