import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Layout from "../components/Layout";
import {
  fileSignedUrl,
  getRequest,
  markSentToLegal,
  updateRequestClassification,
} from "../lib/requests";
import type { RequestRecord } from "../lib/types";
import { OutcomeBadge, StatusBadge } from "../components/OutcomeBadge";
import { classifyRequest } from "../lib/classifier";
import { buildRequestUnderstanding } from "../lib/insights";
import { SUPPLIER_REGISTRATION_URL } from "../lib/links";

export default function RequestSummary() {
  const { id } = useParams();
  const nav = useNavigate();
  const [req, setReq] = useState<RequestRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingDescription, setEditingDescription] = useState(false);
  const [descriptionDraft, setDescriptionDraft] = useState("");
  const [savingDescription, setSavingDescription] = useState(false);

  useEffect(() => {
    if (!id) return;
    getRequest(id)
      .then((r) => {
        setReq(r);
        setDescriptionDraft(r?.description ?? "");
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <Layout><div className="text-slate-500">טוען...</div></Layout>;
  if (error) return <Layout><ErrorBox msg={error} /></Layout>;
  if (!req) return <Layout><ErrorBox msg="לא נמצאה פנייה" /></Layout>;

  async function sendDirectlyToLegal() {
    if (!req) return;
    await markSentToLegal(req.id);
    nav(`/requests/${req.id}/sent`);
  }

  async function saveDescription() {
    if (!req) return;
    setSavingDescription(true);
    setError(null);
    try {
      const classification = classifyRequest({
        department: req.department,
        description: descriptionDraft,
        supplierName: req.supplier_name ?? "",
        amount: req.amount,
        fileCount: req.file_paths.length,
      });
      const updated = await updateRequestClassification({
        id: req.id,
        description: descriptionDraft,
        classification,
      });
      setReq(updated);
      setDescriptionDraft(updated.description);
      setEditingDescription(false);
    } catch (e: any) {
      setError(e?.message ?? "שגיאה בעדכון התיאור");
    } finally {
      setSavingDescription(false);
    }
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

          <UnderstandingCard
            req={req}
            editingDescription={editingDescription}
            descriptionDraft={descriptionDraft}
            savingDescription={savingDescription}
            onEdit={() => setEditingDescription(true)}
            onCancel={() => {
              setDescriptionDraft(req.description);
              setEditingDescription(false);
            }}
            onDescriptionChange={setDescriptionDraft}
            onSave={saveDescription}
          />

          {req.file_paths.length > 0 && (
            <FilesCard paths={req.file_paths} />
          )}
        </div>

        <div className="space-y-6">
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

function UnderstandingCard({
  req,
  editingDescription,
  descriptionDraft,
  savingDescription,
  onEdit,
  onCancel,
  onDescriptionChange,
  onSave,
}: {
  req: RequestRecord;
  editingDescription: boolean;
  descriptionDraft: string;
  savingDescription: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onDescriptionChange: (value: string) => void;
  onSave: () => void;
}) {
  const understanding = buildRequestUnderstanding(req);

  return (
    <div className="card">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 className="font-semibold">מה המערכת הבינה</h2>
        {!editingDescription && (
          <button type="button" className="btn-ghost" onClick={onEdit}>
            ערוך תיאור
          </button>
        )}
      </div>

      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm mb-5">
        {understanding.facts.map((item) => (
          <Field key={item.label} label={item.label} value={item.value} />
        ))}
      </dl>

      <div className="rounded-xl bg-slate-50 border border-slate-100 p-4 mb-4">
        <div className="text-sm font-medium text-slate-700 mb-2">
          תובנות מתוך המלל החופשי
        </div>
        <ul className="list-disc pr-5 text-sm text-slate-700 space-y-1">
          {understanding.observations.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </div>

      {understanding.missing.length > 0 && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 mb-4">
          <div className="text-sm font-medium text-amber-900 mb-2">
            פרטים שכדאי להשלים בהמשך
          </div>
          <div className="flex flex-wrap gap-2">
            {understanding.missing.map((item) => (
              <span key={item} className="tag-amber">
                {item}
              </span>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="text-sm font-medium text-slate-700 mb-2">
          התיאור המקורי
        </div>
        {editingDescription ? (
          <div className="space-y-3">
            <textarea
              className="input min-h-[150px]"
              value={descriptionDraft}
              onChange={(e) => onDescriptionChange(e.target.value)}
              autoComplete="off"
            />
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-secondary" onClick={onCancel}>
                ביטול
              </button>
              <button
                type="button"
                className="btn-primary"
                onClick={onSave}
                disabled={savingDescription || !descriptionDraft.trim()}
              >
                {savingDescription ? "שומר ומנתח..." : "שמור ונתח מחדש"}
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-slate-200 p-3 text-sm text-slate-800 whitespace-pre-wrap">
            {req.description}
          </div>
        )}
      </div>
    </div>
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
      return "רשומת עבר: פתיחת ספק חדש מתבצעת כיום דרך הקישור ליד שדה הספק בטופס הפנייה.";
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
          href={SUPPLIER_REGISTRATION_URL}
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
        href="/files/rashi-supplier-selection-protocol.docx"
        target="_blank"
        rel="noreferrer"
      >
        הורד פרוטוקול בחירת ספק
      </a>
      <p className="text-xs text-slate-400">
        טופס רכש כללי מתוך מסמכי הקרן. לא נמצא בקבצים שצורפו טופס ביטוח ייעודי.
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
