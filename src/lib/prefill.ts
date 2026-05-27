import type {
  AgreementTypeEstimate,
  GrantDocuments,
  LegalIntakePayload,
  QuoteCleanliness,
  RequestRecord,
} from "./types";

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

  // ---- Agreement type estimate ----
  const agreementTypeEstimate = detectAgreementTypeEstimate(desc);
  const isGrant = agreementTypeEstimate === "grant";

  // ---- Quote cleanliness + supplier-terms detection ----
  const { quoteCleanliness, supplierTermsDetected } =
    detectSupplierTerms(desc);

  // ---- Purchase order requirement ----
  // Default: yes for service_purchase route, "" otherwise.
  const purchaseOrderNeeded: "yes" | "no" | "" =
    agreementTypeEstimate === "service_purchase" ? "yes" : "";

  // ---- Party roles ----
  // Heuristic — only fill if we recognise a clear pattern. Otherwise leave
  // empty so the user describes it.
  const partyRoles = detectPartyRoles({
    desc,
    supplier,
    agreementTypeEstimate,
  });

  return {
    // ---- Card 1 ----
    purpose: extractPurpose(desc),
    agreementType: detectAgreementType(desc),
    agreementTypeEstimate,
    partyRoles,
    counterparty: supplier,
    amount: req.amount != null ? String(req.amount) : "",
    schedule: extractSchedule(desc),
    budgetLine: "",

    // ---- Card 2 ----
    supplierSelected: supplier ? "yes" : "",
    competitiveProcess: "",
    singleSupplier: "",
    hasQuote: /הצעת מחיר/.test(desc) ? "yes" : "",
    quoteCleanliness,
    supplierTermsDetected,
    purchaseOrderNeeded,

    // ---- Card 3 ----
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
    copyright: inDesc(["זכויות יוצרים", "קניין רוחני", "בעלות על תוצרים"])
      ? "yes"
      : "",
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
    subcontractors: inDesc(["קבלן משנה", "ספקי משנה", "ספק משנה"])
      ? "yes"
      : "",

    // ---- Grant route ----
    isGrant,
    grantDocuments: isGrant ? emptyGrantDocuments() : undefined,
    grantMissingDocuments: [],

    notes: "",
  };
}

function emptyGrantDocuments(): GrantDocuments {
  return {
    ceoApproval: "",
    grantRequest: "",
    grantForm: "",
    bylaws: "",
    managementApproval: "",
    section46: "",
    withholdingTax: "",
    cpaApproval: "",
  };
}

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
  return "";
}

function detectAgreementTypeEstimate(
  desc: string
): AgreementTypeEstimate | "" {
  if (!desc.trim()) return "";
  if (/מענק|תמיכה|עמותה|חל"צ|חלצ|מלכ"ר|מלכר|גוף נתמך/.test(desc))
    return "grant";
  if (/משרד ממשלתי|ג׳וינט|ג'וינט|JDC|ביטוח לאומי/.test(desc))
    return "government_joint";
  if (/שיתוף פעולה|מיזם משותף|שותף אסטרטגי/.test(desc)) return "cooperation";
  if (/חסות|ספונסר|תרומה/.test(desc)) return "sponsorship";
  return "service_purchase";
}

interface SupplierTermsResult {
  quoteCleanliness: QuoteCleanliness;
  supplierTermsDetected: string[];
}

function detectSupplierTerms(desc: string): SupplierTermsResult {
  const triggers: { keyword: RegExp; tag: string }[] = [
    { keyword: /הסכם של הספק|חוזה של הספק|ההסכם של הספק/, tag: "ההסכם של הספק" },
    { keyword: /תנאי תשלום|מקדמה|תשלום מראש/, tag: "תנאי תשלום חריגים" },
    { keyword: /תנאי ביטול|ביטול הזמנה|פיצוי מוסכם/, tag: "תנאי ביטול" },
    { keyword: /זכויות פרסום|קרדיט פרסום|פרסום/, tag: "זכויות פרסום" },
    { keyword: /שמירת בעלות|בעלות על תוצרים|זכויות יוצרים|קניין רוחני/, tag: "קניין רוחני / בעלות" },
    { keyword: /אחריות מקצועית/, tag: "אחריות מקצועית" },
    { keyword: /סודיות|NDA/i, tag: "סודיות" },
    { keyword: /פרטיות|מידע אישי/, tag: "פרטיות" },
    { keyword: /שימוש חוזר|תנאי שימוש/, tag: "תנאי שימוש בתוצרים" },
  ];
  const detected: string[] = [];
  for (const t of triggers) {
    if (t.keyword.test(desc) && !detected.includes(t.tag)) detected.push(t.tag);
  }
  if (detected.length === 0) {
    return { quoteCleanliness: "clean", supplierTermsDetected: [] };
  }
  return { quoteCleanliness: "supplier_terms", supplierTermsDetected: detected };
}

function detectPartyRoles(opts: {
  desc: string;
  supplier: string;
  agreementTypeEstimate: AgreementTypeEstimate | "";
}): string {
  if (!opts.agreementTypeEstimate) return "";
  const sup = opts.supplier || "הצד השני";
  switch (opts.agreementTypeEstimate) {
    case "service_purchase":
      return `קרן רש"י מזמינה שירות / מוצר מ-${sup}. תמורה כספית כנגד אספקה.`;
    case "cooperation":
      return `שיתוף פעולה בין קרן רש"י ל-${sup}. יש להגדיר מה כל צד מביא ומקבל.`;
    case "government_joint":
      return `מיזם משותף עם גורם ציבורי / ממשלתי (${sup}). נדרשת הגדרה ברורה של אחריות, מימון ובעלות.`;
    case "grant":
      return `קרן רש"י מעניקה מענק ל-${sup} לטובת פעילות שלהם. אין רכישת שירות עבור הקרן.`;
    case "sponsorship":
      return `חסות / תרומה של הקרן לפעילות של ${sup}.`;
    default:
      return "";
  }
}

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
export function prefilledKeys(
  prefill: LegalIntakePayload
): Set<keyof LegalIntakePayload> {
  const keys = new Set<keyof LegalIntakePayload>();
  (Object.keys(prefill) as (keyof LegalIntakePayload)[]).forEach((k) => {
    const v = prefill[k];
    if (v === undefined || v === null || v === "") return;
    if (Array.isArray(v) && v.length === 0) return;
    if (typeof v === "object") return; // grantDocuments etc. — not visible as a single field
    keys.add(k);
  });
  return keys;
}
