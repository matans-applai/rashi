import EditableField from "./EditableField";
import type {
  AgreementState,
  Currency,
  IntakeSummary,
  SecondPartyType,
  YesNoUnknown,
} from "../../lib/aiTypes";

const YN_OPTIONS = [
  { value: "yes", label: "כן" },
  { value: "no", label: "לא" },
  { value: "unknown", label: "לא ידוע" },
];

const SECOND_PARTY_OPTIONS = [
  { value: "company", label: "חברה" },
  { value: "nonprofit", label: "עמותה / מלכ״ר" },
  { value: "public_body", label: "גוף ציבורי / ממשלתי" },
  { value: "individual", label: "אדם פרטי" },
  { value: "unknown", label: "לא ידוע" },
];

const AGREEMENT_STATE_OPTIONS = [
  { value: "new", label: "חדש" },
  { value: "existing", label: "קיים" },
  { value: "extension", label: "הארכה" },
  { value: "unknown", label: "לא ידוע" },
];

const CURRENCY_OPTIONS = [
  { value: "ILS", label: "₪ (שקל)" },
  { value: "unknown", label: "לא ידוע" },
];

interface Props {
  intake: IntakeSummary;
  onChange: (next: IntakeSummary) => void;
  /** Optional list of missing items to surface in card 9. */
  missing?: string[];
}

/**
 * The 10 editable review cards. The user can edit any field with the inline
 * pencil. `onChange` fires every time a field is saved.
 */
export default function IntakeReviewCards({ intake, onChange, missing }: Props) {
  const set = <K extends keyof IntakeSummary>(key: K, value: IntakeSummary[K]) =>
    onChange({ ...intake, [key]: value });

  return (
    <div className="space-y-5">
      <Card title="1. פרטי הפנייה">
        <Grid>
          <EditableField
            label="מיזם / מחלקה"
            value={intake.department_or_project}
            onChange={(v) =>
              set("department_or_project", (v as string | null) ?? null)
            }
          />
        </Grid>
      </Card>

      <Card title="2. מטרת ההתקשרות והרקע">
        <Grid>
          <EditableField
            label="מטרת ההתקשרות"
            mode="textarea"
            value={intake.request_purpose}
            onChange={(v) => set("request_purpose", (v as string | null) ?? null)}
            className="sm:col-span-2"
          />
          <EditableField
            label="רקע נוסף"
            mode="textarea"
            value={intake.background}
            onChange={(v) => set("background", (v as string | null) ?? null)}
            className="sm:col-span-2"
          />
        </Grid>
      </Card>

      <Card title="3. הצד השני / הגורם המעורב">
        <Grid>
          <EditableField
            label="שם"
            value={intake.second_party_name}
            onChange={(v) =>
              set("second_party_name", (v as string | null) ?? null)
            }
          />
          <EditableField
            label="סוג"
            mode="select"
            options={SECOND_PARTY_OPTIONS}
            value={intake.second_party_type}
            onChange={(v) =>
              set("second_party_type", (v as SecondPartyType) ?? "unknown")
            }
          />
        </Grid>
      </Card>

      <Card title="4. חלקו של כל צד בהתקשרות">
        <Grid>
          <EditableField
            label="תפקיד כל צד"
            mode="textarea"
            value={intake.party_roles}
            onChange={(v) => set("party_roles", (v as string | null) ?? null)}
            className="sm:col-span-2"
          />
          <EditableField
            label="שותפים נוספים"
            mode="textarea"
            value={intake.partners_involved}
            onChange={(v) =>
              set("partners_involved", (v as string | null) ?? null)
            }
            className="sm:col-span-2"
          />
        </Grid>
      </Card>

      <Card title="5. פרטים מסחריים">
        <Grid>
          <EditableField
            label="סכום"
            mode="number"
            value={intake.amount}
            onChange={(v) =>
              set("amount", typeof v === "number" ? v : v == null ? null : Number(v))
            }
          />
          <EditableField
            label="מטבע"
            mode="select"
            options={CURRENCY_OPTIONS}
            value={intake.currency}
            onChange={(v) => set("currency", (v as Currency) ?? "unknown")}
          />
          <EditableField
            label="לוח זמנים"
            value={intake.timeline}
            onChange={(v) => set("timeline", (v as string | null) ?? null)}
          />
          <EditableField
            label="חדש / קיים / הארכה"
            mode="select"
            options={AGREEMENT_STATE_OPTIONS}
            value={intake.is_new_or_existing}
            onChange={(v) =>
              set("is_new_or_existing", (v as AgreementState) ?? "unknown")
            }
          />
          <EditableField
            label="קיימת הצעת מחיר?"
            mode="select"
            options={YN_OPTIONS}
            value={intake.quote_exists}
            onChange={(v) => set("quote_exists", (v as YesNoUnknown) ?? "unknown")}
          />
          <EditableField
            label="פרטי הצעת המחיר"
            mode="textarea"
            value={intake.quote_details}
            onChange={(v) => set("quote_details", (v as string | null) ?? null)}
            className="sm:col-span-2"
          />
        </Grid>
      </Card>

      <Card title="6. מסמכים קיימים">
        <EditableField
          label="מסמכים שצורפו או הוזכרו"
          mode="list"
          value={intake.documents_mentioned}
          onChange={(v) =>
            set("documents_mentioned", Array.isArray(v) ? v : [])
          }
          placeholder="הקלידו פריט אחד בכל שורה"
        />
      </Card>

      <Card title="7. תהליך בחירת ספק / צד שני">
        <Grid>
          <EditableField
            label="הספק נבחר?"
            mode="select"
            options={YN_OPTIONS}
            value={intake.supplier_selected}
            onChange={(v) =>
              set("supplier_selected", (v as YesNoUnknown) ?? "unknown")
            }
          />
          <EditableField
            label="תהליך הבחירה"
            mode="textarea"
            value={intake.selection_process}
            onChange={(v) =>
              set("selection_process", (v as string | null) ?? null)
            }
            className="sm:col-span-2"
          />
        </Grid>
      </Card>

      <Card title="8. נושאים שדורשים תשומת לב משפטית">
        <Grid>
          <EditableField
            label="פרטיות / מידע אישי"
            mode="select"
            options={YN_OPTIONS}
            value={intake.privacy_or_personal_data}
            onChange={(v) =>
              set("privacy_or_personal_data", (v as YesNoUnknown) ?? "unknown")
            }
          />
          <EditableField
            label="זכויות יוצרים / IP"
            mode="select"
            options={YN_OPTIONS}
            value={intake.ip_or_copyrights}
            onChange={(v) =>
              set("ip_or_copyrights", (v as YesNoUnknown) ?? "unknown")
            }
          />
          <EditableField
            label="צילום משתתפים"
            mode="select"
            options={YN_OPTIONS}
            value={intake.participant_photography}
            onChange={(v) =>
              set("participant_photography", (v as YesNoUnknown) ?? "unknown")
            }
          />
          <EditableField
            label="ביטוח / סיכון תפעולי"
            mode="select"
            options={YN_OPTIONS}
            value={intake.insurance_or_operational_risk}
            onChange={(v) =>
              set("insurance_or_operational_risk", (v as YesNoUnknown) ?? "unknown")
            }
          />
          <EditableField
            label="ספקי משנה"
            mode="select"
            options={YN_OPTIONS}
            value={intake.subcontractors}
            onChange={(v) =>
              set("subcontractors", (v as YesNoUnknown) ?? "unknown")
            }
          />
          <EditableField
            label="תנאי ספק / חוזה של הספק"
            mode="select"
            options={YN_OPTIONS}
            value={intake.supplier_terms_or_contract}
            onChange={(v) =>
              set("supplier_terms_or_contract", (v as YesNoUnknown) ?? "unknown")
            }
          />
          <EditableField
            label="רכיב מענק"
            mode="select"
            options={YN_OPTIONS}
            value={intake.grant_related}
            onChange={(v) =>
              set("grant_related", (v as YesNoUnknown) ?? "unknown")
            }
          />
        </Grid>
      </Card>

      <Card title="9. מידע חסר להשלמה">
        {missing && missing.length > 0 ? (
          <ul className="list-disc pr-5 text-sm text-amber-800 space-y-1">
            {missing.slice(0, 8).map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">אין כרגע פריטי מידע חסר.</p>
        )}
      </Card>

      <Card title="10. הערות נוספות">
        <EditableField
          label="הערות / נקודות מיוחדות"
          mode="list"
          value={intake.special_notes}
          onChange={(v) => set("special_notes", Array.isArray(v) ? v : [])}
          placeholder="הקלידו פריט אחד בכל שורה"
        />
      </Card>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card">
      <h3 className="font-semibold mb-4">{title}</h3>
      {children}
    </div>
  );
}

function Grid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
      {children}
    </div>
  );
}
