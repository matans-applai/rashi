import {
  AlignmentType,
  Document,
  HeadingLevel,
  LevelFormat,
  Packer,
  Paragraph,
  TextRun,
} from "docx";
import { saveAs } from "file-saver";
import type {
  AgreementTypeEstimate,
  GrantDocuments,
  LegalIntakePayload,
  RequestRecord,
} from "./types";
import { OUTCOME_LABEL } from "../components/OutcomeBadge";
import { lookupSupplier } from "./suppliers";

const AGREEMENT_TYPE_LABEL: Record<AgreementTypeEstimate, string> = {
  service_purchase: "רכישת שירות / מוצר",
  cooperation: "שיתוף פעולה",
  government_joint: "מיזם משותף עם גוף ציבורי / ממשלתי",
  grant: "מענק / תמיכה",
  sponsorship: "חסות / תרומה",
  other: "אחר / לא ברור",
};

const GRANT_DOC_LABELS: Record<keyof GrantDocuments, string> = {
  ceoApproval: 'אישור חתום של מנכ"ל / מנהל כללי על המענק',
  grantRequest: "בקשה למענק מהעמותה",
  grantForm: "טופס מענק ממולא",
  bylaws: "תקנון העמותה",
  managementApproval: "אישור ניהול תקין בתוקף",
  section46: "אישור סעיף 46 (אם רלוונטי)",
  withholdingTax: "אישור ניכוי מס במקור",
  cpaApproval: 'אישור רו"ח (לסכומים מעל 50,000 ₪)',
};

interface BuildContext {
  req: RequestRecord;
  requesterName: string;
  requesterEmail: string;
}

/**
 * Build and download a Hebrew RTL Word document summarising the legal-review
 * request. Triggered from the LegalConfirmation screen.
 */
export async function downloadLegalReviewDocx(ctx: BuildContext): Promise<void> {
  const doc = buildDocument(ctx);
  const blob = await Packer.toBlob(doc);
  const supplier = ctx.req.supplier_name?.replace(/[^\w֐-׿ -]+/g, "_") || "פנייה";
  const date = new Date().toISOString().slice(0, 10);
  saveAs(blob, `פנייה_משפטית_${supplier}_${date}.docx`);
}

function buildDocument(ctx: BuildContext): Document {
  const { req } = ctx;
  const li = req.legal_intake ?? {};
  const dateStr = new Date().toLocaleDateString("he-IL");
  const supplier = lookupSupplier(req.supplier_name ?? "");

  const children: Paragraph[] = [];

  // Title
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      bidirectional: true,
      heading: HeadingLevel.TITLE,
      children: [new TextRun({ text: "פנייה לבדיקה משפטית", bold: true, rightToLeft: true, size: 40 })],
    })
  );
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      bidirectional: true,
      children: [
        new TextRun({
          text: `קרן רש״י — מסלול: ${req.outcome ? OUTCOME_LABEL[req.outcome] : "—"}`,
          rightToLeft: true,
          color: "666666",
        }),
      ],
    })
  );
  children.push(emptyLine());

  // Section 1 — פרטי הפנייה
  pushHeading(children, "1. פרטי הפנייה");
  pushKV(children, "מחלקה / מיזם", req.department || "—");
  pushKV(children, "שם הפונה", ctx.requesterName || "—");
  pushKV(children, "אימייל הפונה", ctx.requesterEmail || "—");
  pushKV(children, "תאריך הכנת הפנייה", dateStr);
  children.push(emptyLine());

  // Section 2 — מטרת ההתקשרות
  pushHeading(children, "2. מטרת ההתקשרות");
  pushParagraph(children, li.purpose || req.description || "—");
  if (li.partyRoles) {
    pushKV(children, "תפקיד כל צד", li.partyRoles);
  }
  children.push(emptyLine());

  // Section 3 — הצד השני / ספק
  pushHeading(children, "3. הצד השני / ספק");
  pushKV(children, "שם", li.counterparty || req.supplier_name || "—");
  pushKV(
    children,
    "סטטוס במאגר",
    supplier
      ? supplier.status === "registered"
        ? "רשום במאגר 2026"
        : supplier.status === "not_registered"
        ? "לא רשום במאגר 2026"
        : "סטטוס לא ברור"
      : req.supplier_name
      ? "לא נמצא במאגר הדמו"
      : "—"
  );
  children.push(emptyLine());

  // Section 4 — סוג ההתקשרות המשוער
  pushHeading(children, "4. סוג ההתקשרות המשוער");
  const ate =
    li.agreementTypeEstimate && li.agreementTypeEstimate in AGREEMENT_TYPE_LABEL
      ? AGREEMENT_TYPE_LABEL[li.agreementTypeEstimate as AgreementTypeEstimate]
      : "לא הוגדר — נדרשת ולידציה משפטית";
  pushParagraph(children, ate);
  if (li.agreementType) {
    pushKV(
      children,
      "חדש / המשך",
      li.agreementType === "new" ? "חדש" : li.agreementType === "extension" ? "המשך / הארכה" : "—"
    );
  }
  children.push(emptyLine());

  // Section 5 — פרטים מסחריים
  pushHeading(children, "5. פרטים מסחריים");
  pushKV(
    children,
    "סכום",
    li.amount ||
      (req.amount != null ? `${req.amount.toLocaleString("he-IL")} ₪` : "—")
  );
  pushKV(children, "לוח זמנים", li.schedule || "—");
  pushKV(children, "סעיף תקציבי", li.budgetLine || "—");
  pushKV(children, "קיימת הצעת מחיר?", yn(li.hasQuote));
  pushKV(
    children,
    "ניקיון ההצעה",
    li.quoteCleanliness === "clean"
      ? "נקייה (תכולה / סכום / לו״ז)"
      : li.quoteCleanliness === "supplier_terms"
      ? "כוללת תנאי ספק"
      : "לא ידוע"
  );
  if ((li.supplierTermsDetected ?? []).length > 0) {
    pushParagraph(children, "תנאי ספק שזוהו:");
    for (const t of li.supplierTermsDetected ?? []) {
      pushBullet(children, t);
    }
  }
  pushKV(children, "תידרש הזמנת רכש חתומה?", yn(li.purchaseOrderNeeded));
  children.push(emptyLine());

  // Section 6 — תהליך בחירת ספק
  pushHeading(children, "6. תהליך בחירת ספק");
  pushKV(children, "הספק נבחר?", yn(li.supplierSelected));
  pushKV(children, "בוצע הליך תחרותי?", yn(li.competitiveProcess));
  pushKV(children, "ספק יחיד?", yn(li.singleSupplier));
  children.push(emptyLine());

  // Section 7 — סיכונים וחריגים
  pushHeading(children, "7. סיכונים וחריגים");
  pushKV(children, "פרטיות / מידע אישי", yn(li.privacy));
  pushKV(children, "זכויות יוצרים / קניין רוחני", yn(li.copyright));
  pushKV(children, "צילום משתתפים", yn(li.filmingParticipants));
  pushKV(children, "נדרש ביטוח", yn(li.insuranceNeeded));
  pushKV(children, "שותפים למיזם", yn(li.partners));
  pushKV(children, "ספקי משנה", yn(li.subcontractors));
  children.push(emptyLine());

  // Section 8 — מסמכים שצורפו או הוזכרו
  pushHeading(children, "8. מסמכים שצורפו או הוזכרו");
  const allFiles = [
    ...req.file_paths,
    ...((li.extraFilePaths as string[]) ?? []),
  ];
  if (allFiles.length === 0) {
    pushParagraph(children, "—");
  } else {
    for (const f of allFiles) {
      pushBullet(children, f.split("/").pop() ?? f);
    }
  }
  if (req.outcome === "grant" || li.isGrant) {
    pushParagraph(children, "מסמכי מענק:");
    const docs = li.grantDocuments ?? ({} as GrantDocuments);
    for (const k of Object.keys(GRANT_DOC_LABELS) as (keyof GrantDocuments)[]) {
      const status = docs[k];
      const label =
        status === "yes"
          ? "✓ קיים"
          : status === "no"
          ? "✗ חסר"
          : "— לא ידוע";
      pushBullet(children, `${GRANT_DOC_LABELS[k]} — ${label}`);
    }
  }
  children.push(emptyLine());

  // Section 9 — מידע להשלמה בהמשך
  pushHeading(children, "9. מידע להשלמה בהמשך");
  const missing = collectMissingFor(req, li).slice(0, 5);
  if (missing.length === 0) {
    pushParagraph(children, "—");
  } else {
    for (const m of missing) pushBullet(children, m);
  }
  children.push(emptyLine());

  // Section 10 — סיבת ההעברה למשפטית
  pushHeading(children, "10. סיבת ההעברה למשפטית");
  pushParagraph(children, req.reasoning || "לא הוזן נימוק טכני נוסף.");
  if (li.notes?.trim()) {
    children.push(emptyLine());
    pushParagraph(children, "הערות נוספות מהפונה:");
    pushParagraph(children, li.notes);
  }

  return new Document({
    creator: "Rashi Bot",
    title: "פנייה לבדיקה משפטית",
    styles: {
      default: { document: { run: { font: "Arial", size: 22 } } },
    },
    numbering: {
      config: [
        {
          reference: "bullets",
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: "•",
              alignment: AlignmentType.RIGHT,
              style: { paragraph: { indent: { left: 360, hanging: 240 } } },
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 }, // A4
            margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 },
          },
        },
        children,
      },
    ],
  });
}

// ------ helpers ------

function emptyLine(): Paragraph {
  return new Paragraph({ bidirectional: true, children: [new TextRun({ text: "", rightToLeft: true })] });
}

function pushHeading(out: Paragraph[], text: string) {
  out.push(
    new Paragraph({
      bidirectional: true,
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 200, after: 100 },
      children: [new TextRun({ text, bold: true, rightToLeft: true, size: 28 })],
    })
  );
}

function pushKV(out: Paragraph[], label: string, value: string) {
  out.push(
    new Paragraph({
      bidirectional: true,
      spacing: { after: 60 },
      children: [
        new TextRun({ text: `${label}: `, bold: true, rightToLeft: true }),
        new TextRun({ text: value || "—", rightToLeft: true }),
      ],
    })
  );
}

function pushParagraph(out: Paragraph[], text: string) {
  out.push(
    new Paragraph({
      bidirectional: true,
      spacing: { after: 80 },
      children: [new TextRun({ text, rightToLeft: true })],
    })
  );
}

function pushBullet(out: Paragraph[], text: string) {
  out.push(
    new Paragraph({
      bidirectional: true,
      numbering: { reference: "bullets", level: 0 },
      children: [new TextRun({ text, rightToLeft: true })],
    })
  );
}

function yn(v?: string): string {
  if (v === "yes") return "כן";
  if (v === "no") return "לא";
  return "לא ידוע";
}

function collectMissingFor(req: RequestRecord, li: LegalIntakePayload): string[] {
  const m: string[] = [];
  if (!li.purpose && !req.description) m.push("מטרת ההתקשרות");
  if (!li.counterparty && !req.supplier_name) m.push("שם הצד השני / ספק");
  if (!li.amount && req.amount == null) m.push("סכום");
  if (!li.schedule) m.push("לוח זמנים");
  if (!li.budgetLine) m.push("סעיף תקציבי");
  if (!li.supplierSelected) m.push("האם הספק נבחר");
  if (!li.competitiveProcess) m.push("האם בוצע הליך תחרותי");
  if (!li.hasQuote) m.push("האם קיימת הצעת מחיר");
  if (!li.quoteCleanliness) m.push("ניקיון ההצעה");
  return m;
}
