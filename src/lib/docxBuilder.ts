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
  AgreementTypeEstimateLLM,
  LegalCase,
  YesNoUnknown,
} from "./aiTypes";
import type { RequestRecord } from "./types";
import { OUTCOME_LABEL } from "../components/OutcomeBadge";

const AGREEMENT_LABEL: Record<AgreementTypeEstimateLLM, string> = {
  service_purchase: "רכישת שירות / מוצר",
  cooperation: "שיתוף פעולה",
  government_joint_venture: "מיזם משותף עם גוף ציבורי / ממשלתי",
  grant: "מענק / תמיכה",
  sponsorship: "חסות / תרומה",
  other: "אחר",
  unclear: "לא ברור — נדרשת ולידציה משפטית",
};

interface BuildContext {
  req: RequestRecord;
  legal: LegalCase;
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
  const supplier =
    (ctx.legal.second_party || ctx.req.supplier_name || "פנייה").replace(
      /[^\w֐-׿ -]+/g,
      "_"
    );
  const date = new Date().toISOString().slice(0, 10);
  saveAs(blob, `פנייה_משפטית_${supplier}_${date}.docx`);
}

function buildDocument(ctx: BuildContext): Document {
  const { req, legal } = ctx;
  const dateStr = new Date().toLocaleDateString("he-IL");

  const children: Paragraph[] = [];

  // Title
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      bidirectional: true,
      heading: HeadingLevel.TITLE,
      children: [
        new TextRun({
          text: "פנייה לבדיקה משפטית",
          bold: true,
          rightToLeft: true,
          size: 40,
        }),
      ],
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

  // 1. פרטי הפנייה
  pushHeading(children, "1. פרטי הפנייה");
  pushKV(children, "מחלקה / מיזם", legal.department_or_project || req.department || "—");
  pushKV(children, "שם הפונה", ctx.requesterName || "—");
  pushKV(children, "אימייל הפונה", ctx.requesterEmail || "—");
  pushKV(children, "תאריך הכנת הפנייה", dateStr);
  children.push(emptyLine());

  // 2. מטרת ההתקשרות
  pushHeading(children, "2. מטרת ההתקשרות");
  pushParagraph(children, legal.purpose || req.description || "—");
  if (legal.party_roles) {
    pushKV(children, "תפקיד כל צד", legal.party_roles);
  }
  children.push(emptyLine());

  // 3. הצד השני / ספק
  pushHeading(children, "3. הצד השני / ספק");
  pushKV(children, "שם", legal.second_party || req.supplier_name || "—");
  pushKV(children, "סטטוס", legal.supplier_status || "—");
  children.push(emptyLine());

  // 4. סוג ההתקשרות המשוער
  pushHeading(children, "4. סוג ההתקשרות המשוער");
  pushParagraph(children, AGREEMENT_LABEL[legal.agreement_type_estimate]);
  children.push(emptyLine());

  // 5. פרטים מסחריים
  pushHeading(children, "5. פרטים מסחריים");
  pushKV(
    children,
    "סכום",
    legal.amount != null ? `${legal.amount.toLocaleString("he-IL")} ₪` : "—"
  );
  pushKV(children, "לוח זמנים", legal.timeline || "—");
  pushKV(children, "קיימת הצעת מחיר?", yn(legal.quote_exists));
  if (legal.supplier_terms.length > 0) {
    pushParagraph(children, "תנאי ספק שזוהו:");
    for (const t of legal.supplier_terms) {
      pushBullet(children, t);
    }
  }
  children.push(emptyLine());

  // 6. תהליך בחירת ספק
  pushHeading(children, "6. תהליך בחירת ספק");
  pushKV(children, "הספק נבחר?", yn(legal.supplier_selected));
  pushKV(children, "בוצע הליך תחרותי?", yn(legal.competitive_process));
  pushKV(children, "ספק יחיד?", yn(legal.single_supplier));
  children.push(emptyLine());

  // 7. סיכונים וחריגים
  pushHeading(children, "7. סיכונים וחריגים");
  pushKV(children, "פרטיות / מידע אישי", yn(legal.privacy_or_personal_data));
  pushKV(children, "זכויות יוצרים / קניין רוחני", yn(legal.copyrights_or_ip));
  pushKV(children, "צילום משתתפים", yn(legal.participant_photography));
  pushKV(children, "נדרש ביטוח", yn(legal.insurance_required));
  pushKV(children, "שותפים למיזם", yn(legal.partners));
  pushKV(children, "ספקי משנה", yn(legal.subcontractors));
  if (legal.risks_and_exceptions.length > 0) {
    pushParagraph(children, "סיכונים נוספים:");
    for (const r of legal.risks_and_exceptions) pushBullet(children, r);
  }
  children.push(emptyLine());

  // 8. מסמכים
  pushHeading(children, "8. מסמכים שצורפו או הוזכרו");
  if (legal.documents.length === 0) {
    pushParagraph(children, "—");
  } else {
    for (const d of legal.documents) pushBullet(children, d);
  }
  children.push(emptyLine());

  // 9. מידע להשלמה
  pushHeading(children, "9. מידע להשלמה בהמשך");
  const missing = legal.missing_info.slice(0, 5);
  if (missing.length === 0) {
    pushParagraph(children, "—");
  } else {
    for (const m of missing) pushBullet(children, m);
  }
  children.push(emptyLine());

  // 10. סיבת ההעברה למשפטית
  pushHeading(children, "10. סיבת ההעברה למשפטית");
  pushParagraph(children, legal.reason_for_legal_review || req.reasoning || "—");

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

function emptyLine(): Paragraph {
  return new Paragraph({
    bidirectional: true,
    children: [new TextRun({ text: "", rightToLeft: true })],
  });
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

function yn(v: YesNoUnknown): string {
  if (v === "yes") return "כן";
  if (v === "no") return "לא";
  return "לא ידוע";
}
