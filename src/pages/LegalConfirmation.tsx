import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Layout from "../components/Layout";
import StepIndicator from "../components/chat/StepIndicator";
import { getRequest } from "../lib/requests";
import type { RequestRecord } from "../lib/types";

/**
 * "Sent / Ready" confirmation screen. The actual edit + DOCX + send actions
 * live on RequestSummary now. This page is reached after the user clicks
 * "שלח לבדיקה משפטית".
 */
export default function LegalConfirmation() {
  const { id } = useParams();
  const nav = useNavigate();
  const [req, setReq] = useState<RequestRecord | null>(null);

  useEffect(() => {
    if (!id) return;
    getRequest(id).then(setReq);
  }, [id]);

  if (!req) {
    return (
      <Layout>
        <div className="text-slate-500">טוען...</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-xl mx-auto">
        <StepIndicator current="ready" />
        <div className="card mt-6 text-center">
          <div className="h-14 w-14 rounded-full bg-emerald-100 text-emerald-700 grid place-items-center text-2xl mx-auto mb-4">
            ✓
          </div>
          <h1 className="text-xl font-semibold">
            הפנייה סומנה כמיועדת לבדיקה משפטית
          </h1>
          <p className="text-slate-600 mt-2">
            בשלב ה-POC לא נשלח מייל בפועל. ניתן להמשיך לערוך את הסיכום ולהוריד
            מסמך Word בכל עת.
          </p>
          <div className="flex items-center gap-3 justify-center mt-6 flex-wrap">
            <button
              className="btn-secondary"
              onClick={() => nav("/dashboard")}
            >
              חזרה ללוח הבקרה
            </button>
            <button
              className="btn-primary"
              onClick={() => nav(`/requests/${req.id}`)}
            >
              הצג את הסיכום
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
