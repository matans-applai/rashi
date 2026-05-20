import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Layout from "../components/Layout";
import { fileSignedUrl, getRequest, markSentToLegal } from "../lib/requests";
import type { RequestRecord } from "../lib/types";
import { OutcomeBadge, StatusBadge } from "../components/OutcomeBadge";

export default function RequestSummary() {
  const { id } = useParams();
  const nav = useNavigate();
  const [req, setReq] = useState<RequestRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    getRequest(id)
      .then((r) => setReq(r))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <Layout><div className="text-slate-500">טוען...</div></Layout>;
  if (error) return <Layout><ErrorBox msg={error} /></Layout>;
  if (!req) return <Layout><ErrorBox msg="לא נמצאה פנייה" /></Layout>;

  const outcome = req.outcome;
  const showLegalCta =
    outcome === "legal_review" ||
    outcome === "supplier_registration" ||
    outcome === "insurance_required" ||
    outcome === "general_terms";

  async function sendDirectlyToLegal() {
    if (!req) return;
    await markSentToLegal(req.id);
    nav(`/requests/${req.id}/sent`);
  }

  return (
    <Layout>
      <div className="mb-4 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="text-sm text-slate-500">פנייה</div>
          <h1 className="text-2xl font-semibold flex items-center gap-3">
            {req.department || "—"}
            <StatusBadge status={req.status} />
          </h1>
        </div>
        <button className="btn-secondary" onClick={() => nav("/dashboard")}>
          ← חזרה לפניות
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <RecommendationCard req={req} />

          <div className="card">
            <h2 className="font-semibold mb-3">מה המערכת הבינה</h2>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <Field label="מיזם / מחלקה" value={req.department} />
              <Field label="ספק" value={req.supplier_name || "לא צויין"} />
              <Field
                label="סכום משוער"
                value={
                  req.amount != null
                    ? `${req.amount.toLocaleString("he-IL")} ₪`
                    : "לא צויין"
                }
              />
              <Field
                label="קבצים מצורפים"
                value={req.file_paths.length ? `${req.file_paths.length}` : "אין"}
              />
              <div className="sm:col-span-2">
                <div className="text-slate-500 mb-1">תיאור</div>
                <div className="bg-slate-50 rounded-lg p-3 text-slate-800 whitespace-pre-wrap">
                  {req.description}
                </div>
              </div>
            </dl>
          </div>

          {req.file_paths.length > 0 && (
            <FilesCard paths={req.file_paths} />
          )}
        </div>

        <div className="space-y-6">
          <div className="card">
            <h2 className="font-semibold mb-3">תגיות שזוהו</h2>
            <div className="flex flex-wrap gap-2">
              {(req.tags ?? []).length === 0 && (
                <span className="text-slate-400 text-sm">אין תגיות</span>
              )}
              {(req.tags ?? []).map((t) => (
                <span key={t} className="tag-blue">{t}</span>
              ))}
            </div>
          </div>

          <div className="card">
            <h2 className="font-semibold mb-3">הפעולות הבאות</h2>
            <NextActions req={req} onSendToLegal={sendDirectlyToLegal} />
          </div>

          {req.status === "sent_to_legal" && (
            <div className="card bg-emerald-50 border-emerald-200">
              <div className="font-semibold text-emerald-800">נשלח לבדיקה משפטית</div>
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

function RecommendationCard({ req }: { req: RequestRecord }) {
  return (
    <div className="card">
      <div className="flex items-center gap-3 mb-3">
        <h2 className="font-semibold">המלצת המערכת</h2>
        <OutcomeBadge outcome={req.outcome} />
      </div>
      <p className="text-slate-800 leading-relaxed">{outcomeMessage(req)}</p>
      {req.reasoning && (
        <div className="mt-4 text-sm text-slate-500 border-r-2 border-slate-200 pr-3">
          <div className="font-medium text-slate-600 mb-1">נימוק קצר</div>
          {req.reasoning}
        </div>
      )}
    </div>
  );
}

function outcomeMessage(req: RequestRecord): string {
  switch (req.outcome) {
    case "missing_info":
      return "חסר מידע בסיסי כדי להמליץ על המשך פעולה. מומלץ להוסיף תיאור קצר של מטרת ההתקשרות, ספק אם ידוע, סכום ומסמכים קיימים.";
    case "legal_review":
      return "לפי המידע שהוזן, נראה שהפנייה כוללת רכיב שמצריך בדיקה משפטית. מומלץ להשלים פרטים נוספים כדי לקדם את הטיפול, או לשלוח את הפנייה עם המידע שהוזן עד כה.";
    case "supplier_registration":
      return "נראה שהספק אינו רשום במאגר 2026 או שסטטוס הרישום שלו אינו ברור. יש להשלים רישום ספק לפני המשך התקשרות.";
    case "insurance_required":
      return "לפי תיאור הפעילות, נראה שנדרש אישור ביטוח מתאים לפני המשך התקשרות.";
    case "general_terms":
      return "לפי המידע שהוזן, נראה שניתן להתקדם במסלול תנאי התקשרות רגילים. יש לוודא שהספק רשום במאגר ושאין תנאים חריגים נוספים.";
    default:
      return "—";
  }
}

function NextActions({
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
      <div className="space-y-2">
        <button className="btn-primary w-full" onClick={() => nav("/requests/new")}>
          חזור והוסף פרטים
        </button>
      </div>
    );
  }
  if (o === "legal_review") {
    return (
      <div className="space-y-2">
        <button
          className="btn-primary w-full"
          onClick={() => nav(`/requests/${req.id}/legal`)}
        >
          המשך להשלמת פרטים
        </button>
        <button className="btn-secondary w-full" onClick={onSendToLegal}>
          שלח לבדיקה משפטית עם המידע הקיים
        </button>
      </div>
    );
  }
  if (o === "supplier_registration") {
    return (
      <div className="space-y-2">
        <a
          className="btn-primary w-full"
          href="https://example.com/supplier-registration"
          target="_blank"
          rel="noreferrer"
        >
          פתח קישור רישום ספק
        </a>
        <button
          className="btn-secondary w-full"
          onClick={() => nav(`/requests/${req.id}/legal`)}
        >
          בכל זאת העבר לבדיקה משפטית
        </button>
      </div>
    );
  }
  if (o === "insurance_required") {
    return (
      <div className="space-y-2">
        <div className="rounded-lg bg-amber-50 border border-amber-200 text-amber-900 p-3 text-sm">
          יש לפנות לרפרנט הביטוח של הקרן לפני המשך התקשרות והעלאת אישור ביטוח מתאים.
        </div>
        <button
          className="btn-secondary w-full"
          onClick={() => nav(`/requests/${req.id}/legal`)}
        >
          בכל זאת העבר לבדיקה משפטית
        </button>
      </div>
    );
  }
  // general_terms
  return (
    <div className="space-y-2">
      <a
        className="btn-primary w-full"
        href="/files/general-terms-placeholder.txt"
        target="_blank"
        rel="noreferrer"
      >
        הורד מסמך תנאי התקשרות
      </a>
      <p className="text-xs text-slate-400">
        בשלב POC זה קובץ פלייסהולדר. ניתן להחליפו במסמך התנאים הרשמי.
      </p>
      <button
        className="btn-secondary w-full"
        onClick={() => nav(`/requests/${req.id}/legal`)}
      >
        בכל זאת העבר לבדיקה משפטית
      </button>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | number | null }) {
  return (
    <div>
      <div className="text-slate-500">{label}</div>
      <div className="text-slate-800">{value ?? "—"}</div>
    </div>
  );
}

function FilesCard({ paths }: { paths: string[] }) {
  return (
    <div className="card">
      <h2 className="font-semibold mb-3">קבצים שצורפו</h2>
      <ul className="text-sm space-y-2">
        {paths.map((p) => (
          <li key={p} className="flex items-center justify-between gap-3">
            <span className="text-slate-700 truncate">{p.split("/").pop()}</span>
            <button
              className="btn-ghost"
              onClick={async () => {
                const u = await fileSignedUrl(p);
                if (u) window.open(u, "_blank");
              }}
            >
              פתח
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ErrorBox({ msg }: { msg: string }) {
  return (
    <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-3 py-2 text-sm">
      {msg}
    </div>
  );
}
