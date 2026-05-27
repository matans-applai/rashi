import type {
  AgreementTypeEstimateLLM,
  LegalCase,
  YesNoUnknown,
} from "../../lib/aiTypes";

const AGREEMENT_LABEL: Record<AgreementTypeEstimateLLM, string> = {
  service_purchase: "רכישת שירות / מוצר",
  cooperation: "שיתוף פעולה",
  government_joint_venture: "מיזם עם גורם ציבורי / ממשלתי",
  grant: "מענק / תמיכה",
  sponsorship: "חסות / תרומה",
  other: "אחר",
  unclear: "לא ברור — נדרשת ולידציה משפטית",
};

function yn(v: YesNoUnknown): string {
  if (v === "yes") return "כן";
  if (v === "no") return "לא";
  return "לא ידוע";
}

export default function LegalSummaryCards({ legal }: { legal: LegalCase }) {
  return (
    <div className="space-y-5">
      <Section title="פרטי הפנייה">
        <Row label="מחלקה / מיזם" value={legal.department_or_project ?? "—"} />
      </Section>

      <Section title="מטרת ההתקשרות">
        <p className="text-slate-800 sm:col-span-2 leading-relaxed">
          {legal.purpose || "—"}
        </p>
        {legal.party_roles && (
          <Row label="תפקיד כל צד" value={legal.party_roles} wide />
        )}
      </Section>

      <Section title="הצד השני">
        <Row label="שם" value={legal.second_party ?? "—"} />
        <Row label="סטטוס ספק" value={legal.supplier_status ?? "—"} />
      </Section>

      <Section title="סוג ההתקשרות המשוער">
        <p className="text-slate-800 sm:col-span-2">
          {AGREEMENT_LABEL[legal.agreement_type_estimate]}
        </p>
      </Section>

      <Section title="פרטים מסחריים">
        <Row
          label="סכום"
          value={
            legal.amount != null
              ? `${legal.amount.toLocaleString("he-IL")} ₪`
              : "—"
          }
        />
        <Row label="לוח זמנים" value={legal.timeline ?? "—"} />
        <Row label="קיימת הצעת מחיר?" value={yn(legal.quote_exists)} />
      </Section>

      <Section title="תהליך בחירת ספק">
        <Row label="הספק נבחר?" value={yn(legal.supplier_selected)} />
        <Row label="הליך תחרותי?" value={yn(legal.competitive_process)} />
        <Row label="ספק יחיד?" value={yn(legal.single_supplier)} />
      </Section>

      <Section title="סיכונים וחריגים">
        <Row label="שותפים למיזם" value={yn(legal.partners)} />
        <Row label="פרטיות / מידע אישי" value={yn(legal.privacy_or_personal_data)} />
        <Row label="זכויות יוצרים / IP" value={yn(legal.copyrights_or_ip)} />
        <Row label="צילום משתתפים" value={yn(legal.participant_photography)} />
        <Row label="נדרש ביטוח" value={yn(legal.insurance_required)} />
        <Row label="ספקי משנה" value={yn(legal.subcontractors)} />
        {legal.supplier_terms.length > 0 && (
          <ListBlock title="תנאי ספק שזוהו" items={legal.supplier_terms} />
        )}
        {legal.risks_and_exceptions.length > 0 && (
          <ListBlock title="סיכונים נוספים" items={legal.risks_and_exceptions} />
        )}
      </Section>

      <Section title="מסמכים">
        {legal.documents.length === 0 ? (
          <p className="text-slate-500 sm:col-span-2 text-sm">לא הוזכרו מסמכים</p>
        ) : (
          <ul className="list-disc pr-5 text-sm text-slate-700 sm:col-span-2 space-y-1">
            {legal.documents.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ul>
        )}
      </Section>

      {legal.missing_info.length > 0 && (
        <Section title="מידע להשלמה">
          <ul className="list-disc pr-5 text-sm text-amber-800 sm:col-span-2 space-y-1">
            {legal.missing_info.slice(0, 5).map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="סיבת ההעברה למשפטית">
        <p className="text-slate-800 sm:col-span-2 leading-relaxed">
          {legal.reason_for_legal_review || "—"}
        </p>
      </Section>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="card">
      <h3 className="font-semibold mb-3">{title}</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
        {children}
      </div>
    </div>
  );
}

function Row({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <span className="text-slate-500">{label}: </span>
      <span className="text-slate-800 font-medium">{value}</span>
    </div>
  );
}

function ListBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="sm:col-span-2">
      <div className="text-slate-500 mb-1">{title}</div>
      <ul className="flex flex-wrap gap-2">
        {items.map((it, i) => (
          <li key={i} className="tag-red">
            {it}
          </li>
        ))}
      </ul>
    </div>
  );
}
