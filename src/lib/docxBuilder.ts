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
  AgreementState,
  Currency,
  IntakeSummary,
  IntakeResponse,
  SecondPartyType,
  YesNoUnknown,
} from "./aiTypes";
import type { RequestRecord } from "./types";

const SECOND_PARTY_LABEL: Record<SecondPartyType, string> = {
  company: "חברה",
  nonprofit: "עמותה / מלכ״ר",
  public_body: "גוף ציבורי / ממשלתי",
  individual: "אדם פרטי",
  unknown: "לא ידוע",
};

const AGREEMENT_LABEL: Record<AgreementState, string> = {
  new: "חדש",
  existing: "קיים",
  extension: "הארכה",
  unknown: "לא ידוע",
};

const CURRENCY_LABEL: Record<Currency, string> = {
  ILS: "₪",
  unknown: "—",
};

interface BuildContext {
  req: RequestRecord;
  intake: IntakeSummary;
  requesterName: string;
  requesterEmail: string;
  uploadedFileNames?: string[];
}

/**
 * Build and download a Hebrew RTL Word document — "סיכום פנייה למחלקה
 * המשפטית". No routing/recommendation language anywhere.
 */
export async function downloadLegalReviewDocx(ctx: BuildContext): Promise<void> {
  const doc = buildDocument(ctx);
  const blob = await Packer.toBlob(doc);
  const supplier =
    (ctx.intake.second_party_name || ctx.req.supplier_name || "פנייה").replace(
      /[^\w֐-׿ -]+/g,
      "_"
    );
  const date = new Date().toISOString().slice(0, 10);
  saveAs(blob, `סיכום_פנייה_${supplier}_${date}.docx`);
}

function buildDocument(ctx: BuildContext): Document {
  const { req, intake } = ctx;
  const dateStr = new Date().toLocaleDateString("he-IL");
  const llm = req.llm_output as IntakeResponse | null;

  const children: Paragraph[] = [];

  // Title
  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      bidirectional: true,
      heading: HeadingLevel.TITLE,
      children: [
        new TextRun({
          text: "סיכום פנייה למחלקה המשפטית",
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
          text: `קרן רש״י • הוכן בתאריך ${dateStr}`,
          rightToLeft: true,
          color: "666666",
        }),
      ],
    })
  );
  children.push(emptyLine());

  // 1. פרטי הפנייה
  pushHeading(children, "1. פרטי הפנייה");
  pushKV(children, "מחלקה / מיזם", intake.department_or_project || req.department || "—");
  pushKV(children, "שם הפונה", ctx.requesterName || "—");
  pushKV(children, "אימייל הפונה", ctx.requesterEmail || "—");
  children.push(emptyLine());

  // 2. מטרת הפנייה והרקע
  pushHeading(children, "2. מטרת הפנייה והרקע");
  pushParagraph(children, intake.request_purpose || req.description || "—");
  if (intake.background) {
    pushParagraph(children, intake.background);
  }
  children.push(emptyLine());

  // 3. הצד השני / הגורם המעורב
  pushHeading(children, "3. הצד השני / הגורם המעורב");
  pushKV(children, "שם", intake.second_party_name || "—");
  pushKV(children, "סוג", SECOND_PARTY_LABEL[intake.second_party_type]);
  children.push(emptyLine());

  // 4. חלקו של כל צד בהתקשרות
  pushHeading(children, "4. חלקו של כל צד בהתקשרות");
  pushParagraph(children, intake.party_roles || "—");
  if (intake.partners_involved) {
    pushKV(children, "שותפים נוספים", intake.partners_involved);
  }
  children.push(emptyLine());

  // 5. פרטים מסחריים
  pushHeading(children, "5. פרטים מסחריים");
  pushKV(
    children,
    "סכום",
    intake.amount != null
      ? `${intake.amount.toLocaleString("he-IL")} ${CURRENCY_LABEL[intake.currency]}`
      : "—"
  );
  pushKV(children, "לוח זמנים", intake.timeline || "—");
  pushKV(children, "חדש / קיים / הארכה", AGREEMENT_LABEL[intake.is_new_or_existing]);
  pushKV(children, "קיימת הצעת מחיר?", yn(intake.quote_exists));
  if (intake.quote_details) {
    pushParagraph(children, `פרטי הצעת המחיר: ${intake.quote_details}`);
  }
  children.push(emptyLine());

  // 6. מסמכים שצורפו או הוזכרו
  pushHeading(children, "6. מסמכים שצורפו או הוזכרו");
  if (intake.documents_mentioned.length === 0 && (!ctx.uploadedFileNames || ctx.uploadedFileNames.length === 0)) {
    pushParagraph(children, "—");
  } else {
    for (const d of intake.documents_mentioned) pushBullet(children, d);
    if (ctx.uploadedFileNames && ctx.uploadedFileNames.length > 0) {
      pushParagraph(children, "קבצים שהועלו:");
      for (const name of ctx.uploadedFileNames) pushBullet(children, name);
    }
  }
  children.push(emptyLine());

  // 7. תהליך בחירת ספק / גורם
  pushHeading(children, "7. תהליך בחירת ספק / גורם");
  pushKV(children, "הספק / הגורם נבחר?", yn(intake.supplier_selected));
  pushParagraph(children, intake.selection_process || "—");
  children.push(emptyLine());

  // 8. נושאים שדורשים תשומת לב משפטית
  pushHeading(children, "8. נושאים שדורשים תשומת לב משפטית");
  pushKV(children, "פרטיות / מידע אישי", yn(intake.privacy_or_personal_data));
  pushKV(children, "זכויות יוצרים / IP", yn(intake.ip_or_copyrights));
  pushKV(children, "צילום משתתפים", yn(intake.participant_photography));
  pushKV(children, "ביטוח / סיכון תפעולי", yn(intake.insurance_or_operational_risk));
  pushKV(children, "ספקי משנה", yn(intake.subcontractors));
  pushKV(children, "תנאי ספק / חוזה של הספק", yn(intake.supplier_terms_or_contract));
  pushKV(children, "רכיב מענק", yn(intake.grant_related));
  children.push(emptyLine());

  // 9. מידע חסר להשלמה
  pushHeading(children, "9. מידע חסר להשלמה");
  const missing = llm?.missing_information ?? [];
  if (missing.length === 0) {
    pushParagraph(children, "—");
  } else {
    for (const m of missing.slice(0, 8)) pushBullet(children, m.question_he);
  }
  children.push(emptyLine());

  // 10. הערות נוספות
  pushHeading(children, "10. הערות נוספות");
  if (intake.special_notes.length === 0) {
    pushParagraph(children, "—");
  } else {
    for (const n of intake.special_notes) pushBullet(children, n);
  }

  return new Document({
    creator: "Rashi Legal Intake Bot",
    title: "סיכום פנייה למחלקה המשפטית",
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
      children: [
        new TextRun({ text, bold: true, rightToLeft: true, size: 28 }),
      ],
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
