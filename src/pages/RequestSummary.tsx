import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Layout from "../components/Layout";
import StepIndicator from "../components/chat/StepIndicator";
import IntakeReviewCards from "../components/chat/IntakeReviewCards";
import { StatusBadge } from "../components/OutcomeBadge";
import {
  getRequest,
  markReadyForLegal,
  markSentToLegal,
  saveEditedIntake,
} from "../lib/requests";
import { downloadLegalReviewDocx } from "../lib/docxBuilder";
import { useAuth, getUserDisplayName } from "../lib/auth";
import type { RequestRecord } from "../lib/types";
import type { IntakeResponse, IntakeSummary } from "../lib/aiTypes";

/**
 * Editable review screen. The user can edit any field, download a Word doc,
 * mark as ready for legal, or send to legal (POC stub).
 *
 * Replaces the old "route recommendation" page entirely.
 */
export default function RequestSummary() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();

  const [req, setReq] = useState<RequestRecord | null>(null);
  const [intake, setIntake] = useState<IntakeSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingField, setSavingField] = useState(false);
  const [action, setAction] = useState<"ready" | "send" | "download" | null>(null);

  useEffect(() => {
    if (!id) return;
    getRequest(id)
      .then((r) => {
        if (!r) {
          setError("פנייה לא נמצאה");
          return;
        }
        setReq(r);
        const stored =
          (r.legal_case as IntakeSummary | null) ??
          ((r.llm_output as IntakeResponse | null)?.intake_summary ?? null);
        setIntake(stored);
      })
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

  async function handleIntakeChange(next: IntakeSummary) {
    if (!req) return;
    setIntake(next);
    setSavingField(true);
    try {
      const updated = await saveEditedIntake(req.id, next);
      setReq(updated);
    } catch (e: any) {
      setError(e?.message ?? "שגיאה בשמירה");
    } finally {
      setSavingField(false);
    }
  }

  async function handleReady() {
    if (!req) return;
    setAction("ready");
    try {
      const updated = await markReadyForLegal(req.id);
      setReq(updated);
    } catch (e: any) {
      setError(e?.message ?? "שגיאה");
    } finally {
      setAction(null);
    }
  }

  async function handleSend() {
    if (!req) return;
    setAction("send");
    try {
      const updated = await markSentToLegal(req.id);
      setReq(updated);
      nav(`/requests/${req.id}/confirm`);
    } catch (e: any) {
      setError(e?.message ?? "שגיאה");
    } finally {
      setAction(null);
    }
  }

  async function handleDownload() {
    if (!req || !intake) return;
    setAction("download");
    try {
      await downloadLegalReviewDocx({
        req,
        intake,
        requesterName: getUserDisplayName(user),
        requesterEmail: user?.email ?? "",
      });
    } catch (e: any) {
      setError(e?.message ?? "שגיאה ביצירת מסמך");
    } finally {
      setAction(null);
    }
  }

  const llm = req.llm_output as IntakeResponse | null;
  const missing = llm?.missing_information.map((m) => m.question_he) ?? [];

  return (
    <Layout>
      <div className="max-w-4xl mx-auto">
        <StepIndicator
          current={req.status === "ready_for_legal" || req.status === "sent_to_legal" ? "ready" : "review"}
        />

        <div className="mb-6 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="text-sm text-slate-500">סיכום פנייה</div>
            <h1 className="text-2xl font-semibold flex items-center gap-3 flex-wrap mt-1">
              {intake?.request_purpose?.slice(0, 80) ||
                intake?.department_or_project ||
                "פנייה ללא כותרת"}
              <StatusBadge status={req.status} />
              {savingField && (
                <span className="text-xs text-slate-400">שומר...</span>
              )}
            </h1>
          </div>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => nav("/dashboard")}
          >
            ← חזרה לפניות
          </button>
        </div>

        {intake ? (
          <IntakeReviewCards
            intake={intake}
            onChange={handleIntakeChange}
            missing={missing}
          />
        ) : (
          <div className="card text-slate-500">
            עוד אין סיכום מובנה לפנייה הזו.
          </div>
        )}

        <div className="flex items-center gap-3 justify-end mt-8 flex-wrap pb-4">
          <button
            type="button"
            className="btn-secondary"
            onClick={() => nav("/requests/new")}
          >
            חזור לעריכת תיאור חופשי
          </button>
          <button
            type="button"
            className="btn-secondary"
            disabled={!intake || action === "download"}
            onClick={handleDownload}
          >
            {action === "download" ? "מכין מסמך..." : "📄 הורד מסמך Word"}
          </button>
          {req.status !== "ready_for_legal" && req.status !== "sent_to_legal" && (
            <button
              type="button"
              className="btn-secondary"
              disabled={!intake || action === "ready"}
              onClick={handleReady}
            >
              {action === "ready" ? "מסמן..." : "סמן כמוכן להעברה למשפטית"}
            </button>
          )}
          {req.status !== "sent_to_legal" && (
            <button
              type="button"
              className="btn-primary"
              disabled={!intake || action === "send"}
              onClick={handleSend}
            >
              {action === "send" ? "שולח..." : "שלח לבדיקה משפטית"}
            </button>
          )}
        </div>
      </div>
    </Layout>
  );
}
