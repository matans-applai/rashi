import type { RequestRecord, RoutingOutcome } from "./types";
import { lookupSupplier } from "./suppliers";

export interface RequestUnderstanding {
  facts: { label: string; value: string }[];
  observations: string[];
  missing: string[];
}

const OUTCOME_ACTION: Record<RoutingOutcome, string> = {
  general_terms: "אפשר להתקדם עם טופס רכש / פרוטוקול בחירת ספק רגיל.",
  supplier_registration: "רשומת עבר: פתיחת ספק חדש מתבצעת כיום דרך הקישור ליד שדה הספק.",
  insurance_required: "יש להשלים בדיקת ביטוח לפני המשך ההתקשרות.",
  legal_review: "יש להשלים פרטים ולהעביר לבדיקה משפטית.",
  missing_info: "צריך להשלים פרטים בסיסיים לפני שניתן להחליט על מסלול.",
};

export function buildRequestUnderstanding(req: RequestRecord): RequestUnderstanding {
  const desc = req.description.trim();
  const observations = buildObservations(req);
  const missing = buildMissing(req);

  return {
    facts: [
      { label: "מיזם / מחלקה", value: req.department || "לא צויין" },
      { label: "מטרת ההתקשרות", value: extractPurpose(desc) || "לא זוהתה" },
      { label: "ספק", value: req.supplier_name || "לא צויין" },
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

function buildObservations(req: RequestRecord): string[] {
  const desc = req.description;
  const observations: string[] = [];
  const supplier = lookupSupplier(req.supplier_name ?? "");
  const add = (text: string) => {
    if (!observations.includes(text)) observations.push(text);
  };

  if (hasAny(desc, ["התקנה", "הרכבה", "חיבור לרשת", "העברת קבצים"])) {
    add("מדובר בעבודת התקנה / תפעול טכנית, עם רכיבים כמו הרכבה, חיבור לרשת או העברת קבצים.");
  }
  if (hasAny(desc, ["חד-פעמית", "חד פעמית", "פעם אחת"])) {
    add("הפעילות נראית חד-פעמית, ולכן אין כרגע סימן להתקשרות מתמשכת.");
  }
  if (hasAny(desc, ["יועץ", "ייעוץ", "ליווי", "ריטיינר", "מתמשך"])) {
    add("זוהה רכיב ייעוץ או ליווי מתמשך, ולכן כדאי לוודא אחריות מקצועית, תכולה ולוחות זמנים.");
  }
  if (hasAny(desc, ["הצעת מחיר", "הצעות מחיר"])) {
    add("קיימת אינדיקציה להצעת מחיר, ולכן כדאי לצרף אותה או לוודא שהיא זמינה.");
  }
  if (hasAny(desc, ["לא במאגר", "לא רשום", "ספק חדש", "מאגר 2026"])) {
    add("יש סימן לכך שסטטוס הספק במאגר אינו מוסדר או אינו ודאי.");
  }
  if (supplier?.status === "not_registered") {
    add("לפי נתוני הדמו, הספק אינו מופיע כמאושר במאגר. פתיחת ספק חדש מתבצעת דרך הקישור ליד שדה הספק בטופס הפנייה.");
  }
  if (hasAny(desc, ["ODT", "אודיטי", "חבלים", "ג'יפים", "ג׳יפים", "הסעות", "מלון", "קייטרינג"])) {
    add("זוהו רכיבי פעילות שיכולים להצריך בדיקת ביטוח, כמו פעילות שטח, הסעות, אירוח או מזון.");
  }
  if (hasAny(desc, ["פרטיות", "מידע אישי", "תעודת זהות", "תעודות זהות", "טלפון", "אימייל", "רשימות משתתפים"])) {
    add("זוהה שימוש אפשרי במידע אישי של משתתפים, ולכן נדרשת תשומת לב לפרטיות ואבטחת מידע.");
  }
  if (hasAny(desc, ["צילום", "נצלם", "מצלמים", "תיעוד מצולם", "סרטון"])) {
    add("זוהה צילום או תיעוד משתתפים, ולכן כדאי לבדוק הסכמות ושימוש בתוצרים.");
  }
  if (hasAny(desc, ["שותפים", "מיזם משותף", "ג'וינט", "ג׳וינט", "משרד ממשלתי", "ביטוח לאומי"])) {
    add("זוהה רכיב של שותפות או גורם חיצוני נוסף, שיכול להשפיע על נוסח ההתקשרות.");
  }
  if (req.amount != null && req.amount >= 200000) {
    add("הסכום עומד על 200,000 ₪ ומעלה, ולכן הוא טריגר לבדיקה משפטית.");
  }
  if (req.file_paths.length > 0) {
    add("צורפו מסמכים לפנייה. בשלב ה-POC הם נשמרים ונפתחים, אך התוכן שלהם עדיין לא מנותח אוטומטית.");
  }
  if (observations.length === 0) {
    add("לא זוהו סימנים חריגים מעבר לפרטים שהוזנו. כדאי לוודא שהספק רשום ושיש מסמכי רכש מתאימים.");
  }

  return observations;
}

function buildMissing(req: RequestRecord): string[] {
  const missing: string[] = [];
  if (!req.supplier_name) missing.push("שם ספק");
  if (req.amount == null) missing.push("סכום משוער");
  if (!extractSchedule(req.description)) missing.push("לוח זמנים / מועד ביצוע");
  if (req.file_paths.length === 0) missing.push("מסמכים תומכים, אם קיימים");
  return missing;
}

function extractPurpose(desc: string): string {
  if (!desc) return "";
  const first = desc.match(/^([^.!?\n]+)/)?.[1]?.trim() ?? desc;
  return first.length > 160 ? `${first.slice(0, 160).trim()}...` : first;
}

function detectEngagementType(desc: string): string {
  if (hasAny(desc, ["הארכת התקשרות", "המשך התקשרות", "חידוש הסכם", "הארכה"])) {
    return "המשך / הארכת התקשרות";
  }
  if (hasAny(desc, ["הסכם חדש", "התקשרות חדשה", "התקשרות ראשונה"])) {
    return "התקשרות חדשה";
  }
  if (hasAny(desc, ["חד-פעמית", "חד פעמית", "פעם אחת"])) {
    return "עבודה חד-פעמית";
  }
  if (hasAny(desc, ["מתמשך", "ריטיינר", "ליווי"])) {
    return "התקשרות מתמשכת";
  }
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
