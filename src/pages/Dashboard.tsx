import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import { useAuth, getUserDisplayName } from "../lib/auth";
import { deleteRequest, listMyRequests } from "../lib/requests";
import type { RequestRecord } from "../lib/types";
import { StatusBadge } from "../components/OutcomeBadge";
import type { IntakeResponse, IntakeSummary } from "../lib/aiTypes";

export default function Dashboard() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [items, setItems] = useState<RequestRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    listMyRequests(user.id)
      .then(setItems)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [user]);

  const visibleItems = showAll ? items : items.slice(0, 3);

  async function handleDelete(req: RequestRecord) {
    const ok = window.confirm(
      "למחוק את הפנייה הזו? לא ניתן לשחזר אותה לאחר המחיקה."
    );
    if (!ok) return;
    setDeletingId(req.id);
    setError(null);
    try {
      await deleteRequest(req);
      setItems((current) => current.filter((item) => item.id !== req.id));
    } catch (e: any) {
      setError(e?.message ?? "שגיאה במחיקת הפנייה");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <Layout>
      <div className="flex items-end justify-between mb-6 gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">
            שלום, {getUserDisplayName(user)}
          </h1>
          <p className="text-slate-500 mt-1">
            סיכומי פניות שהוכנו עבור המחלקה המשפטית.
          </p>
        </div>
        <button className="btn-primary" onClick={() => nav("/requests/new")}>
          + צור פנייה חדשה
        </button>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold mb-4">פניות למחלקה המשפטית</h2>

        {loading ? (
          <div className="text-slate-500 text-sm">טוען...</div>
        ) : error ? (
          <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-3 py-2 text-sm">
            {error}
          </div>
        ) : items.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {visibleItems.map((r) => (
                <RequestCard
                  key={r.id}
                  req={r}
                  onDelete={() => handleDelete(r)}
                  deleting={deletingId === r.id}
                />
              ))}
            </div>
            {items.length > 3 && (
              <div className="border-t border-slate-100 pt-4 mt-5 flex justify-center">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowAll((v) => !v)}
                >
                  {showAll
                    ? "הצג רק 3 אחרונות"
                    : `הצג עוד ${items.length - 3} פניות`}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}

function RequestCard({
  req,
  onDelete,
  deleting,
}: {
  req: RequestRecord;
  onDelete: () => void;
  deleting: boolean;
}) {
  const intake =
    (req.legal_case as IntakeSummary | null) ??
    ((req.llm_output as IntakeResponse | null)?.intake_summary ?? null);

  const title =
    intake?.request_purpose?.slice(0, 80) ||
    intake?.department_or_project ||
    req.department ||
    req.description.slice(0, 80) ||
    "פנייה ללא כותרת";

  const secondParty =
    intake?.second_party_name || req.supplier_name || "—";

  const llm = req.llm_output as IntakeResponse | null;
  const missingCount = llm?.missing_information.length ?? 0;
  const isReady =
    req.status === "ready_for_legal" || req.status === "sent_to_legal";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 hover:shadow-sm transition flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <Link
          to={`/requests/${req.id}`}
          className="text-slate-800 font-medium leading-snug hover:underline line-clamp-2"
        >
          {title}
        </Link>
        <StatusBadge status={req.status} />
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs text-slate-500">
        <Row label="צד שני" value={secondParty} />
        <Row
          label="עודכן"
          value={new Date(req.created_at).toLocaleDateString("he-IL")}
        />
        <Row
          label="חסר מידע"
          value={missingCount === 0 ? "—" : `${missingCount} פריטים`}
        />
        <Row
          label="מוכן למשפטית"
          value={isReady ? "כן" : "לא"}
        />
      </div>

      <div className="flex items-center justify-between gap-2 mt-1">
        <Link to={`/requests/${req.id}`} className="btn-ghost text-xs">
          פתח סיכום
        </Link>
        <button
          type="button"
          className="btn-ghost text-xs text-red-700 hover:bg-red-50"
          onClick={onDelete}
          disabled={deleting}
        >
          {deleting ? "מוחק..." : "מחק"}
        </button>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-slate-400">{label}</div>
      <div className="text-slate-700 truncate">{value}</div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-12">
      <div className="text-slate-700 font-medium">אין עדיין פניות</div>
      <div className="text-slate-500 text-sm mt-1">
        פתחו פנייה חדשה ותארו אותה בחופשי — נדאג לאסוף ולסכם את המידע למחלקה
        המשפטית.
      </div>
    </div>
  );
}
