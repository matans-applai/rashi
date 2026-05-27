import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Layout from "../components/Layout";
import LegalSummaryCards from "../components/chat/LegalSummaryCards";
import StepIndicator from "../components/chat/StepIndicator";
import { OutcomeBadge } from "../components/OutcomeBadge";
import { getRequest, markSentToLegal } from "../lib/requests";
import { useAuth, getUserDisplayName } from "../lib/auth";
import type { RequestRecord } from "../lib/types";
import type { LegalCase } from "../lib/aiTypes";
import { downloadLegalReviewDocx } from "../lib/docxBuilder";

/**
 * Final summary screen for a legal_review request. Reads the structured
 * legal_case produced by the LegalIntake chat, shows it in beautiful cards,
 * and offers the Word export + "send to legal" action.
 */
export default function LegalConfirmation() {
  const { id } = useParams();
  const { user } = useAuth();
  const nav = useNavigate();
  const [req, setReq] = useState<RequestRecord | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    getRequest(id).then(setReq).catch((e) => setError(e.message));
  }, [id]);

  if (!req) {
    return (
      <Layout>
        <div className="text-slate-500">{error ?? "טוען..."}</div>
      </Layout>
    );
  }

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
      const fresh = await getRequest(req.id);
      setReq(fresh);
    } catch (e: any) {
      setError(e?.message ?? "שגיאה");
    } finally {
      setSending(false);
    }
  }

  const legal = (req.legal_case as LegalCase | null) ?? null;

  return (
    <Layout>
      <div className="max-w-3xl mx-auto">
        <StepIndicator current="final_summary" legalActive />
        <div className="mb-6">
          <div className="text-sm text-slate-500">פנייה › סיכום משפטי</div>
          <h1 className="text-2xl font-semibold mt-1 flex items-center gap-3 flex-wrap">
            סיכום לפני שליחה למחלקה המשפטית
            <OutcomeBadge outcome={req.outcome} />
          </h1>
          <p className="text-slate-500 mt-1">
            בדקו שהפרטים נכונים. אפשר להוריד מסמך Word, לחזור לעריכה, או לשלוח.
          </p>
        </div>

        {legal ? (
          <LegalSummaryCards legal={legal} />
        ) : (
          <div className="card text-slate-500">
            עוד אין סיכום משפטי מובנה. חזור ל-
            <button
              className="btn-ghost"
              onClick={() => nav(`/requests/${req.id}/legal`)}
            >
              צ'אט ההשלמה
            </button>
            כדי להתחיל.
          </div>
        )}

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-3 py-2 text-sm mt-6">
            {error}
          </div>
        )}

        <div className="flex items-center gap-3 justify-end mt-6 flex-wrap">
          <button
            type="button"
            className="btn-secondary"
            disabled={!legal}
            onClick={() =>
              downloadLegalReviewDocx({
                req,
                legal: legal!,
                requesterName: getUserDisplayName(user),
                requesterEmail: user?.email ?? "",
              })
            }
          >
            📄 הורד מסמך Word לבדיקה משפטית
          </button>
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
      <p className="text-slate-600 mt-2">בשלב ה-POC לא נשלח מייל בפועל.</p>
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
