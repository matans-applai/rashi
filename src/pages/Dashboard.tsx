import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import { useAuth, getUserDisplayName } from "../lib/auth";
import { deleteRequest, listMyRequests } from "../lib/requests";
import type { RequestRecord } from "../lib/types";
import { OutcomeBadge, StatusBadge } from "../components/OutcomeBadge";

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
    const ok = window.confirm("למחוק את הפנייה הזו? לא ניתן לשחזר אותה לאחר המחיקה.");
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
            כאן מנוהלות הפניות שלך לבחינה מקדימה של התקשרויות.
          </p>
        </div>
        <button
          className="btn-primary"
          onClick={() => nav("/requests/new")}
        >
          + צור פנייה חדשה
        </button>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold mb-4">פניות קודמות</h2>

        {loading ? (
          <div className="text-slate-500 text-sm">טוען...</div>
        ) : error ? (
          <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-3 py-2 text-sm">
            {error}
          </div>
        ) : items.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-500 text-right">
                  <th className="font-medium py-2 pl-4">תאריך</th>
                  <th className="font-medium py-2 pl-4">תיאור</th>
                  <th className="font-medium py-2 pl-4">סטטוס</th>
                  <th className="font-medium py-2 pl-4">המלצה</th>
                  <th className="font-medium py-2"></th>
                </tr>
              </thead>
              <tbody>
                {visibleItems.map((r) => (
                  <tr key={r.id} className="border-t border-slate-100 align-top">
                    <td className="py-3 pl-4 text-slate-600 whitespace-nowrap">
                      {new Date(r.created_at).toLocaleDateString("he-IL")}
                    </td>
                    <td className="py-3 pl-4 max-w-md">
                      <div className="font-medium text-slate-800">
                        {r.department || "—"}
                      </div>
                      <div className="text-slate-500 line-clamp-2">
                        {r.description}
                      </div>
                    </td>
                    <td className="py-3 pl-4 whitespace-nowrap">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="py-3 pl-4 whitespace-nowrap">
                      <OutcomeBadge outcome={r.outcome} />
                    </td>
                    <td className="py-3">
                      <div className="flex items-center gap-2">
                        <Link
                          to={`/requests/${r.id}`}
                          className="btn-ghost"
                        >
                          פתח
                        </Link>
                        <button
                          type="button"
                          className="btn-ghost text-red-700 hover:bg-red-50 focus:ring-red-200"
                          onClick={() => handleDelete(r)}
                          disabled={deletingId === r.id}
                        >
                          {deletingId === r.id ? "מוחק..." : "מחק"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {items.length > 3 && (
              <div className="border-t border-slate-100 pt-4 mt-2 flex justify-center">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setShowAll((v) => !v)}
                >
                  {showAll ? "הצג רק 3 אחרונות" : `הצג עוד ${items.length - 3} פניות`}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-12">
      <div className="text-slate-700 font-medium">אין עדיין פניות</div>
      <div className="text-slate-500 text-sm mt-1">
        ניתן לפתוח פנייה חדשה כדי לקבל סיווג ראשוני להמשך טיפול.
      </div>
    </div>
  );
}
