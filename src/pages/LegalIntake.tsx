import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Layout from "../components/Layout";
import { getRequest, updateLegalIntake, uploadFiles } from "../lib/requests";
import { useAuth } from "../lib/auth";
import { buildLegalIntakePrefill, prefilledKeys } from "../lib/prefill";
import type { LegalIntakePayload, RequestRecord } from "../lib/types";

export default function LegalIntake() {
  const { id } = useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const [req, setReq] = useState<RequestRecord | null>(null);
  const [data, setData] = useState<LegalIntakePayload>({});
  const [prefilled, setPrefilled] = useState<Set<keyof LegalIntakePayload>>(
    new Set()
  );
  const [extraFiles, setExtraFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    getRequest(id).then((r) => {
      setReq(r);
      if (!r) return;
      if (r.legal_intake) {
        // Returning visit — show what was saved last time, as-is.
        setData(r.legal_intake);
        setPrefilled(new Set());
      } else {
        // First entry — prefill from the request so the user doesn't retype.
        const initial = buildLegalIntakePrefill(r);
        setData(initial);
        setPrefilled(prefilledKeys(initial));
      }
    });
  }, [id]);

  const prefilledCount = prefilled.size;

  function set<K extends keyof LegalIntakePayload>(key: K, value: LegalIntakePayload[K]) {
    setData((d) => ({ ...d, [key]: value }));
  }

  async function handleContinue() {
    if (!req || !user) return;
    setSaving(true);
    setError(null);
    try {
      let extra: string[] = [];
      if (extraFiles.length) {
        extra = await uploadFiles(user.id, req.id, extraFiles);
      }
      const payload: LegalIntakePayload = {
        ...data,
        extraFilePaths: [
          ...(data.extraFilePaths ?? []),
          ...extra,
        ],
      };
      await updateLegalIntake(req.id, payload);
      nav(`/requests/${req.id}/confirm`);
    } catch (e: any) {
      setError(e?.message ?? "שגיאה בשמירה");
    } finally {
      setSaving(false);
    }
  }

  if (!req) return <Layout><div className="text-slate-500">טוען...</div></Layout>;

  return (
    <Layout>
      <div className="mb-6">
        <div className="text-sm text-slate-500">פנייה › השלמת פרטים</div>
        <h1 className="text-2xl font-semibold mt-1">פרטים לבדיקה משפטית</h1>
        <p className="text-slate-500 mt-1">
          אפשר להשלים גם חלק מהפרטים. ככל שיש מידע ספציפי יותר — קל יותר למחלקה המשפטית לקדם את הבקשה.
        </p>
      </div>

      {/* Card 1 */}
      <section className="card mb-5">
        <h2 className="font-semibold mb-4">פרטי התקשרות</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Textarea
            label="מטרת ההתקשרות"
            value={data.purpose ?? ""}
            onChange={(v) => set("purpose", v)}
            placeholder="לדוגמה: ייעוץ אסטרטגי לתוכנית X"
            full
          />
          <Select
            label="האם מדובר בהסכם חדש או המשך"
            value={data.agreementType ?? ""}
            onChange={(v) => set("agreementType", v as any)}
            options={[
              { v: "", l: "בחר..." },
              { v: "new", l: "חדש" },
              { v: "extension", l: "המשך / הארכה" },
            ]}
          />
          <Input
            label="שם הצד השני"
            value={data.counterparty ?? ""}
            onChange={(v) => set("counterparty", v)}
          />
          <Input
            label="סכום (₪)"
            value={data.amount ?? ""}
            onChange={(v) => set("amount", v)}
            dir="ltr"
            inputMode="numeric"
          />
          <Input
            label="לוח זמנים"
            value={data.schedule ?? ""}
            onChange={(v) => set("schedule", v)}
            placeholder="לדוגמה: יוני - אוקטובר 2026"
          />
          <Input
            label="סעיף תקציבי"
            value={data.budgetLine ?? ""}
            onChange={(v) => set("budgetLine", v)}
          />
        </div>
      </section>

      {/* Card 2 */}
      <section className="card mb-5">
        <h2 className="font-semibold mb-4">בחירת ספק ומסמכים</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <YesNo
            label="האם הספק כבר נבחר?"
            value={data.supplierSelected ?? ""}
            onChange={(v) => set("supplierSelected", v)}
          />
          <YesNo
            label="האם בוצע הליך תחרותי?"
            value={data.competitiveProcess ?? ""}
            onChange={(v) => set("competitiveProcess", v)}
          />
          <YesNo
            label="האם מדובר בספק יחיד?"
            value={data.singleSupplier ?? ""}
            onChange={(v) => set("singleSupplier", v)}
          />
          <YesNo
            label="האם קיימת הצעת מחיר?"
            value={data.hasQuote ?? ""}
            onChange={(v) => set("hasQuote", v)}
          />
          <div className="sm:col-span-2">
            <label className="label">העלאת מסמכים נוספים</label>
            <input
              type="file"
              multiple
              className="block w-full text-sm text-slate-600 file:ml-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100"
              onChange={(e) =>
                setExtraFiles(e.target.files ? Array.from(e.target.files) : [])
              }
            />
            {extraFiles.length > 0 && (
              <div className="text-xs text-slate-500 mt-2">
                נבחרו {extraFiles.length} קבצים נוספים
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Card 3 */}
      <section className="card mb-5">
        <h2 className="font-semibold mb-4">סיכונים וחריגים</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <YesNo
            label="האם יש שותפים לתוכנית או למיזם?"
            value={data.partners ?? ""}
            onChange={(v) => set("partners", v)}
          />
          <YesNo
            label="האם יש פרטיות / מידע אישי?"
            value={data.privacy ?? ""}
            onChange={(v) => set("privacy", v)}
          />
          <YesNo
            label="האם יש זכויות יוצרים?"
            value={data.copyright ?? ""}
            onChange={(v) => set("copyright", v)}
          />
          <YesNo
            label="האם מצלמים משתתפים?"
            value={data.filmingParticipants ?? ""}
            onChange={(v) => set("filmingParticipants", v)}
          />
          <YesNo
            label="האם נדרש ביטוח?"
            value={data.insuranceNeeded ?? ""}
            onChange={(v) => set("insuranceNeeded", v)}
          />
          <YesNo
            label="האם יש ספקי משנה?"
            value={data.subcontractors ?? ""}
            onChange={(v) => set("subcontractors", v)}
          />
          <Textarea
            label="הערות חופשיות"
            value={data.notes ?? ""}
            onChange={(v) => set("notes", v)}
            placeholder="כל מידע נוסף שיכול לעזור"
            full
          />
        </div>
      </section>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-3 py-2 text-sm mb-4">
          {error}
        </div>
      )}

      {prefilledCount > 0 && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 p-4 text-sm mb-3">
          <span className="font-semibold">{prefilledCount} שדות מולאו אוטומטית</span>{" "}
          לפי תיאור הפנייה והפרטים שמסרת. ניתן לערוך כל שדה לפני שליחה.
        </div>
      )}
      <div className="rounded-xl bg-blue-50 border border-blue-200 text-blue-900 p-4 text-sm mb-5">
        אפשר לשלוח גם עם מידע חלקי. ככל שיש יותר פרטים — קל יותר למחלקה המשפטית להתקדם מהר.
      </div>

      <div className="flex items-center gap-3 justify-end">
        <button
          className="btn-secondary"
          onClick={() => nav(`/requests/${req.id}`)}
        >
          חזור
        </button>
        <button
          className="btn-primary"
          onClick={handleContinue}
          disabled={saving}
        >
          {saving ? "שומר..." : "שלח לבדיקה משפטית עם המידע הקיים"}
        </button>
      </div>
    </Layout>
  );
}

function Input({
  label,
  value,
  onChange,
  placeholder,
  dir,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  dir?: "ltr" | "rtl";
  inputMode?: "numeric" | "text";
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <input
        className="input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        dir={dir}
        inputMode={inputMode}
      />
    </div>
  );
}

function Textarea({
  label,
  value,
  onChange,
  placeholder,
  full,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  full?: boolean;
}) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <label className="label">{label}</label>
      <textarea
        className="input min-h-[80px]"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { v: string; l: string }[];
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <select
        className="input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option key={o.v} value={o.v}>
            {o.l}
          </option>
        ))}
      </select>
    </div>
  );
}

function YesNo({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: "yes" | "no" | "") => void;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <div className="inline-flex rounded-lg border border-slate-300 bg-white overflow-hidden">
        {[
          { v: "yes", l: "כן" },
          { v: "no", l: "לא" },
          { v: "", l: "לא ידוע" },
        ].map((o, i) => (
          <button
            key={o.v || "unknown"}
            type="button"
            className={
              "px-3 py-1.5 text-sm transition " +
              (value === o.v
                ? "bg-brand-600 text-white"
                : "bg-white text-slate-700 hover:bg-slate-50") +
              (i > 0 ? " border-r border-slate-300" : "")
            }
            onClick={() => onChange(o.v as any)}
          >
            {o.l}
          </button>
        ))}
      </div>
    </div>
  );
}
