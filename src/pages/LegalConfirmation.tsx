import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Layout from "../components/Layout";
import { getRequest, markSentToLegal } from "../lib/requests";
import { useAuth, getUserDisplayName } from "../lib/auth";
import type { RequestRecord } from "../lib/types";
import { OutcomeBadge } from "../components/OutcomeBadge";

export default function LegalConfirmation() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const [req, setReq] = useState<RequestRecord | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    getRequest(id).then(setReq);
  }, [id]);

  if (!req) return <Layout><div className="text-slate-500">טוען...</div></Layout>;

  if (req.status === "sent_to_legal") {
    return (
      <Layout>
        <SentConfirmation reqId={req.id} />
      </Layout>
    );
  }

  async function send() {
    if (!req) return;
    setSending(true);
    setError(null);
    try {
      await markSentToLegal(req.id);
      // reload so we see sent state
      const fresh = await getRequest(req.id);
      setReq(fresh);
    } catch (e: any) {
      setError(e?.message ?? "שגיאה");
    } finally {
      setSending(false);
    }
  }

  const li = req.legal_intake ?? {};
  const missing = collectMissing(req);
  const risks = collectRisks(req);

  return (
    <Layout>
      <div className="mb-6">
        <div className="text-sm text-slate-500">פנייה › אישור שליחה</div>
        <h1 className="text-2xl font-semibold mt-1">סיכום לפני שליחה למחלקה המשפטית</h1>
        <p className="text-slate-500 mt-1">
          בדקו שהפרטים נכונים. ניתן לערוך פרטים נוספים לפני שליחה.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card lg:col-span-2 space-y-4">
          <Section title="פרטי הפונה">
            <Row label="שם" value={getUserDisplayName(user)} />
            <Row label="אימייל" value={user?.email ?? "—"} />
          </Section>

          <Section title="פרטי הפנייה">
            <Row label="מיזם / מחלקה" value={req.department} />
            <Row label="מטרת ההתקשרות" value={li.purpose ?? req.description} />
            <Row label="ספק" value={li.counterparty || req.supplier_name || "—"} />
            <Row
              label="סכום"
              value={
                li.amount ||
                (req.amount != null
                  ? `${req.amount.toLocaleString("he-IL")} ₪`
                  : "—")
              }
            />
            <Row label="לוח זמנים" value={li.schedule ?? "—"} />
            <Row label="סעיף תקציבי" value={li.budgetLine ?? "—"} />
            <Row label="סוג ההסכם" value={agreementLabel(li.agreementType)} />
          </Section>

          <Section title="ספק ומסמכים">
            <Row label="האם הספק נבחר?" value={ynLabel(li.supplierSelected)} />
            <Row label="הליך תחרותי?" value={ynLabel(li.competitiveProcess)} />
            <Row label="ספק יחיד?" value={ynLabel(li.singleSupplier)} />
            <Row label="קיימת הצעת מחיר?" value={ynLabel(li.hasQuote)} />
            <Row
              label="קבצים שצורפו"
              value={String(
                req.file_paths.length + (li.extraFilePaths?.length ?? 0)
              )}
            />
          </Section>
        </div>

        <div className="space-y-6">
          <div className="card">
            <h2 className="font-semibold mb-2">המלצה</h2>
            <OutcomeBadge outcome={req.outcome} />
            {req.reasoning && (
              <p className="text-sm text-slate-600 mt-3 border-r-2 border-slate-200 pr-3">
                {req.reasoning}
              </p>
            )}
          </div>

          <div className="card">
            <h2 className="font-semibold mb-2">סיכונים שזוהו</h2>
            {risks.length === 0 ? (
              <span className="text-slate-400 text-sm">לא זוהו סיכונים מיוחדים</span>
            ) : (
              <ul className="flex flex-wrap gap-2">
                {risks.map((r) => (
                  <li key={r} className="tag-red">{r}</li>
                ))}
              </ul>
            )}
          </div>

          <div className="card">
            <h2 className="font-semibold mb-2">מידע חסר</h2>
            {missing.length === 0 ? (
              <span className="text-slate-400 text-sm">לא חסרים פרטים מהותיים</span>
            ) : (
              <ul className="list-disc pr-5 text-sm text-slate-600 space-y-1">
                {missing.map((m) => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-3 py-2 text-sm mt-6">
          {error}
        </div>
      )}

      <div className="flex items-center gap-3 justify-end mt-6">
        <button
          className="btn-secondary"
          onClick={() => nav(`/requests/${req.id}/legal`)}
        >
          ערוך פרטים
        </button>
        <button className="btn-primary" onClick={send} disabled={sending}>
          {sending ? "שולח..." : "שלח לבדיקה משפטית"}
        </button>
      </div>
    </Layout>
  );
}

function SentConfirmation({ reqId }: { reqId: string }) {
  const nav = useNavigate();
  return (
    <div className="max-w-xl mx-auto card mt-12 text-center">
      <div className="h-14 w-14 rounded-full bg-emerald-100 text-emerald-700 grid place-items-center text-2xl mx-auto mb-4">
        ✓
      </div>
      <h1 className="text-xl font-semibold">הפנייה סומנה כמיועדת לבדיקה משפטית</h1>
      <p className="text-slate-600 mt-2">
        בשלב ה-POC לא נשלח מייל בפועל.
      </p>
      <div className="flex items-center gap-3 justify-center mt-6">
        <button className="btn-secondary" onClick={() => nav("/dashboard")}>
          חזרה ללוח הבקרה
        </button>
        <button className="btn-primary" onClick={() => nav(`/requests/${reqId}`)}>
          הצג את הפנייה
        </button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="font-medium text-slate-800 mb-2">{title}</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
        {children}
      </div>
      <div className="border-t border-slate-100 mt-4 pt-2" />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-800 font-medium text-end">{value || "—"}</span>
    </div>
  );
}

function ynLabel(v?: string) {
  if (v === "yes") return "כן";
  if (v === "no") return "לא";
  return "לא ידוע";
}
function agreementLabel(v?: string) {
  if (v === "new") return "חדש";
  if (v === "extension") return "המשך / הארכה";
  return "—";
}

function collectMissing(req: RequestRecord): string[] {
  const li = req.legal_intake ?? {};
  const missing: string[] = [];
  if (!li.purpose && !req.description) missing.push("מטרת ההתקשרות");
  if (!li.counterparty && !req.supplier_name) missing.push("שם הצד השני / ספק");
  if (!li.amount && req.amount == null) missing.push("סכום");
  if (!li.schedule) missing.push("לוח זמנים");
  if (!li.budgetLine) missing.push("סעיף תקציבי");
  if (!li.supplierSelected) missing.push("האם הספק נבחר");
  if (!li.competitiveProcess) missing.push("האם בוצע הליך תחרותי");
  if (!li.hasQuote) missing.push("האם קיימת הצעת מחיר");
  return missing;
}

function collectRisks(req: RequestRecord): string[] {
  const li = req.legal_intake ?? {};
  const risks: string[] = [];
  if (li.privacy === "yes") risks.push("פרטיות / מידע אישי");
  if (li.copyright === "yes") risks.push("זכויות יוצרים");
  if (li.filmingParticipants === "yes") risks.push("צילום משתתפים");
  if (li.partners === "yes") risks.push("שותפים למיזם");
  if (li.subcontractors === "yes") risks.push("ספקי משנה");
  if (li.insuranceNeeded === "yes") risks.push("נדרש ביטוח");
  if (li.singleSupplier === "yes") risks.push("ספק יחיד");
  // Surface classifier tags as risks too
  for (const t of req.tags ?? []) {
    if (!risks.includes(t) && t !== "תנאי התקשרות רגילים") risks.push(t);
  }
  return risks;
}
