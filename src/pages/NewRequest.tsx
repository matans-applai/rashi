import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import { useAuth } from "../lib/auth";
import { classifyRequest } from "../lib/classifier";
import { createRequest, uploadFiles } from "../lib/requests";
import { SUPPLIER_REGISTRATION_URL } from "../lib/links";
import SupplierTypeahead from "../components/SupplierTypeahead";

export default function NewRequest() {
  const { user } = useAuth();
  const nav = useNavigate();
  const [department, setDepartment] = useState("");
  const [description, setDescription] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [amountStr, setAmountStr] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function parseAmount(s: string): number | null {
    if (!s.trim()) return null;
    const clean = s.replace(/[,\s₪]/g, "");
    const n = Number(clean);
    return Number.isFinite(n) ? n : null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);
    setError(null);
    try {
      const amount = parseAmount(amountStr);

      const classification = classifyRequest({
        department,
        description,
        supplierName,
        amount,
        fileCount: files.length,
      });

      // Pre-create an id-less record so storage path is stable.
      // Approach: insert first (no files), then upload, then update file_paths.
      // For POC simplicity we just upload using a temp uuid then attach.
      const tempId = crypto.randomUUID();
      const paths = files.length
        ? await uploadFiles(user.id, tempId, files)
        : [];

      const record = await createRequest({
        userId: user.id,
        userEmail: user.email ?? null,
        draft: {
          department,
          description,
          supplierName,
          amount,
          files,
        },
        classification,
        filePaths: paths,
      });

      nav(`/requests/${record.id}`);
    } catch (e: any) {
      setError(e?.message ?? "שגיאה בשליחת הפנייה");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">פנייה חדשה</h1>
        <p className="text-slate-500 mt-1">
          תארו בקצרה את ההתקשרות. המערכת תציע סיווג ראשוני להמשך טיפול.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="card space-y-5" autoComplete="off">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label className="label" htmlFor="dep">
              מיזם / מחלקה
            </label>
            <input
              id="dep"
              className="input"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              placeholder="לדוגמה: יום גיבוש לעובדים, שותפויות"
              autoComplete="off"
              required
            />
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between gap-3">
              <label className="label mb-0" htmlFor="supplier">
                שם ספק, אם ידוע
              </label>
              <a
                className="text-xs font-medium text-brand-700 hover:text-brand-800 hover:underline"
                href={SUPPLIER_REGISTRATION_URL}
                target="_blank"
                rel="noreferrer"
              >
                לא מוצאים את הספק? פתחו ספק חדש
              </a>
            </div>
            <SupplierTypeahead
              id="supplier"
              value={supplierName}
              onChange={setSupplierName}
              placeholder="התחילו להקליד שם או קטגוריה (לדוגמה: ODT, קייטרינג)"
            />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="desc">
            תיאור הפנייה
          </label>
          <textarea
            id="desc"
            className="input min-h-[140px]"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="ספרו בקצרה: מה מטרת ההתקשרות, מי הספק, מה תוכן הפעילות..."
            autoComplete="off"
            required
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label className="label" htmlFor="amount">
              סכום משוער, אם ידוע (₪)
            </label>
            <input
              id="amount"
              className="input"
              dir="ltr"
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
              placeholder="50,000"
              inputMode="numeric"
              autoComplete="off"
            />
          </div>
          <div>
            <label className="label" htmlFor="files">
              העלאת מסמכים
            </label>
            <input
              id="files"
              type="file"
              multiple
              className="block w-full text-sm text-slate-600 file:ml-3 file:mr-0 file:py-2 file:px-3 file:rounded-lg file:border-0 file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100"
              onChange={(e) =>
                setFiles(e.target.files ? Array.from(e.target.files) : [])
              }
            />
            {files.length > 0 && (
              <div className="text-xs text-slate-500 mt-2">
                נבחרו {files.length} קבצים: {files.map((f) => f.name).join(", ")}
              </div>
            )}
          </div>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-3 py-2 text-sm">
            {error}
          </div>
        )}

        <div className="flex items-center gap-3 justify-end pt-2 border-t border-slate-100">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => nav(-1)}
          >
            ביטול
          </button>
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? "מנתח..." : "נתח פנייה"}
          </button>
        </div>
      </form>
    </Layout>
  );
}
