import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Layout from "../components/Layout";
import StepIndicator from "../components/chat/StepIndicator";
import RouteRecommendationCard from "../components/chat/RouteRecommendationCard";
import ExtractedFactsCard from "../components/chat/ExtractedFactsCard";
import { OutcomeBadge, StatusBadge } from "../components/OutcomeBadge";
import { getRequest, markSentToLegal } from "../lib/requests";
import {
  GRANT_MASTER_DOC_URL,
  RASHI_GENERAL_TERMS_DOC_URL,
  SAP_SUPPLIER_REGISTRATION_URL,
  buildSupplierRegistrationMessage,
} from "../lib/links";
import type { RequestRecord } from "../lib/types";
import type { RoutingResponse } from "../lib/aiTypes";

/**
 * Read-only summary page for a saved request. For chat-first requests this
 * shows: route badge, AI-extracted facts, route reasoning, and route-specific
 * next actions. For legal_review requests, the user normally lands here only
 * after the legal intake is finished.
 */
export default function RequestSummary() {
  const { id } = useParams();
  const nav = useNavigate();
  const [req, setReq] = useState<RequestRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    getRequest(id)
      .then(setReq)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <Layout>
        <div className="text-slate-500">טוען...</div>
      </Layout>
    );
  }
  if (error || !req) {
    return (
      <Layout>
        <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-3 py-2 text-sm">
          {error ?? "לא נמצאה פנייה"}
        </div>
      </Layout>
    );
  }

  const routing = (req.llm_output as RoutingResponse | null) ?? null;

  async function sendDirectlyToLegal() {
    if (!req) return;
    await markSentToLegal(req.id);
    nav(`/requests/${req.id}/confirm`);
  }

  return (
    <Layout>
      <div className="max-w-3xl mx-auto">
        <StepIndicator current="final_summary" />

        <div className="mb-4 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="text-sm text-slate-500">פנייה</div>
            <h1 className="text-2xl font-semibold flex items-center gap-3 flex-wrap">
              {req.department || "—"}
              <StatusBadge status={req.status} />
              <OutcomeBadge outcome={req.outcome} />
            </h1>
          </div>
          <button className="btn-secondary" onClick={() => nav("/dashboard")}>
            ← חזרה לפניות
          </button>
        </div>

        <div className="space-y-6">
          {routing ? (
            <RouteRecommendationCard routing={routing} showActions={false} />
          ) : (
            <LegacyRecommendationCard req={req} />
          )}

          {routing && <ExtractedFactsCard routing={routing} />}

          <NextActionsCard req={req} onSendToLegal={sendDirectlyToLegal} />

          {req.status === "sent_to_legal" && (
            <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4">
              <div className="font-semibold text-emerald-800">
                הפנייה סומנה כמיועדת לבדיקה משפטית
              </div>
              <div className="text-sm text-emerald-700 mt-1">
                בשלב ה-POC לא נשלח מייל בפועל.
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

/** Fallback recommendation card for legacy rows without llm_output. */
function LegacyRecommendationCard({ req }: { req: RequestRecord }) {
  return (
    <div className="card">
      <div className="flex items-center gap-3 mb-3">
        <h2 className="font-semibold">המלצת המערכת</h2>
        <OutcomeBadge outcome={req.outcome} />
      </div>
      <p className="text-slate-800 leading-relaxed">{req.description}</p>
      {req.reasoning && (
        <div className="mt-4 text-sm text-slate-500 border-r-2 border-slate-200 pr-3">
          {req.reasoning}
        </div>
      )}
    </div>
  );
}

function NextActionsCard({
  req,
  onSendToLegal,
}: {
  req: RequestRecord;
  onSendToLegal: () => void;
}) {
  const nav = useNavigate();
  const o = req.outcome;

  if (o === "missing_info") {
    return (
      <div className="card">
        <h3 className="font-semibold mb-3">הפעולות הבאות</h3>
        <button
          className="btn-primary w-full"
          onClick={() => nav("/requests/new")}
        >
          פתח/י פנייה חדשה עם תיאור מפורט יותר
        </button>
      </div>
    );
  }
  if (o === "legal_review") {
    return (
      <div className="card">
        <h3 className="font-semibold mb-3">הפעולות הבאות</h3>
        <div className="space-y-2">
          <button
            className="btn-primary w-full"
            onClick={() => nav(`/requests/${req.id}/legal`)}
          >
            המשך להשלמת פרטים משפטיים
          </button>
          <button className="btn-secondary w-full" onClick={onSendToLegal}>
            שלח לבדיקה משפטית עם המידע הקיים
          </button>
        </div>
      </div>
    );
  }
  if (o === "grant") {
    return (
      <div className="card">
        <h3 className="font-semibold mb-3">הפעולות הבאות</h3>
        <div className="space-y-2">
          <a
            className="btn-primary w-full"
            href={GRANT_MASTER_DOC_URL}
            target="_blank"
            rel="noreferrer"
          >
            פתח מאסטר כתב התחייבות למענק
          </a>
          <button
            className="btn-secondary w-full"
            onClick={() => nav(`/requests/${req.id}/legal`)}
          >
            המשך לרשימת מסמכי מענק
          </button>
        </div>
      </div>
    );
  }
  if (o === "supplier_registration") {
    return <SupplierRegistrationActions req={req} />;
  }
  if (o === "insurance_required") {
    return (
      <div className="card">
        <h3 className="font-semibold mb-3">הפעולות הבאות</h3>
        <div className="space-y-2">
          <div className="rounded-lg bg-amber-50 border border-amber-200 text-amber-900 p-3 text-sm">
            ניתן להתקדם בתנאי ההתקשרות הכלליים, ובמקביל יש להשלים אישור ביטוח
            לפי סוג השירות.
          </div>
          <a
            className="btn-primary w-full"
            href={RASHI_GENERAL_TERMS_DOC_URL}
            target="_blank"
            rel="noreferrer"
          >
            הצג תנאי התקשרות כלליים
          </a>
          <button
            className="btn-secondary w-full"
            onClick={() => nav(`/requests/${req.id}/legal`)}
          >
            בכל זאת העבר לבדיקה משפטית
          </button>
        </div>
      </div>
    );
  }
  // general_terms
  return (
    <div className="card">
      <h3 className="font-semibold mb-3">הפעולות הבאות</h3>
      <div className="space-y-2">
        <a
          className="btn-primary w-full"
          href={RASHI_GENERAL_TERMS_DOC_URL}
          target="_blank"
          rel="noreferrer"
        >
          הצג תנאי התקשרות כלליים
        </a>
        <p className="text-xs text-slate-500">
          ספק במאגר + הצעת מחיר נקייה + הזמנת רכש חתומה לפי נוהל הקרן.
        </p>
        <button
          className="btn-secondary w-full"
          onClick={() => nav(`/requests/${req.id}/legal`)}
        >
          בכל זאת העבר לבדיקה משפטית
        </button>
      </div>
    </div>
  );
}

function SupplierRegistrationActions({ req }: { req: RequestRecord }) {
  const nav = useNavigate();
  const [showMessage, setShowMessage] = useState(false);
  const [copied, setCopied] = useState(false);
  const message = buildSupplierRegistrationMessage(req.supplier_name);

  async function copyMessage() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked */
    }
  }

  return (
    <div className="card">
      <h3 className="font-semibold mb-3">הפעולות הבאות</h3>
      <div className="space-y-2">
        <a
          className="btn-primary w-full"
          href={SAP_SUPPLIER_REGISTRATION_URL}
          target="_blank"
          rel="noreferrer"
        >
          פתח קישור רישום ספק (SAP)
        </a>
        <button
          type="button"
          className="btn-secondary w-full"
          onClick={() => setShowMessage((s) => !s)}
        >
          {showMessage ? "הסתר הודעה לספק" : "צור הודעה לספק"}
        </button>
        {showMessage && (
          <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 space-y-2">
            <pre className="whitespace-pre-wrap text-xs text-slate-700 font-sans">
              {message}
            </pre>
            <button type="button" className="btn-ghost text-xs" onClick={copyMessage}>
              {copied ? "✓ הועתק" : "העתק הודעה"}
            </button>
          </div>
        )}
        <p className="text-xs text-slate-500">
          כחלק מהרישום הספק חותם על תנאי ההתקשרות הכלליים של הקרן.
        </p>
        <button
          className="btn-secondary w-full"
          onClick={() => nav(`/requests/${req.id}/legal`)}
        >
          בכל זאת העבר לבדיקה משפטית
        </button>
      </div>
    </div>
  );
}
