import { useState } from "react";
import type { RequestRecord } from "../lib/types";
import type { IntakeResponse, IntakeSummary } from "../lib/aiTypes";

interface Props {
  requests: RequestRecord[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  open: boolean;
  onClose: () => void;
}

export default function RequestSidebar({
  requests,
  activeId,
  onSelect,
  onNew,
  onDelete,
  open,
}: Props) {
  return (
    <aside
      className={
        "flex-shrink-0 w-72 bg-white border-l border-slate-200 flex flex-col overflow-hidden " +
        "fixed top-14 bottom-0 right-0 z-40 transition-transform duration-200 " +
        "lg:static lg:translate-x-0 " +
        (open ? "translate-x-0" : "translate-x-full")
      }
    >
      <div className="px-4 py-4 flex-shrink-0">
        <button
          type="button"
          onClick={onNew}
          className="w-full btn-primary text-sm rounded-xl"
        >
          + פנייה חדשה
        </button>
      </div>

      <div className="px-4 pb-2 flex-shrink-0">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          פניות אחרונות
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-4">
        {requests.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-8 px-4">
            עדיין אין פניות קודמות
          </p>
        ) : (
          <ul className="space-y-0.5">
            {requests.map((r) => (
              <SidebarItem
                key={r.id}
                req={r}
                active={r.id === activeId}
                onClick={() => onSelect(r.id)}
                onDelete={() => onDelete(r.id)}
              />
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}

function SidebarItem({
  req,
  active,
  onClick,
  onDelete,
}: {
  req: RequestRecord;
  active: boolean;
  onClick: () => void;
  onDelete: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  const intake =
    (req.legal_case as IntakeSummary | null) ??
    ((req.llm_output as IntakeResponse | null)?.intake_summary ?? null);

  const title = deriveTitle(req, intake);
  const sent =
    req.status === "sent_to_legal" ||
    req.status === "ready_for_legal" ||
    req.status === "completed";

  const dateStr = new Date(req.created_at).toLocaleDateString("he-IL", {
    day: "numeric",
    month: "short",
  });

  if (confirmDelete) {
    return (
      <li className="rounded-xl bg-red-50 border border-red-200 px-3 py-2.5">
        <p className="text-xs text-red-800 mb-2">למחוק את הפנייה?</p>
        <div className="flex gap-2 justify-end">
          <button
            type="button"
            className="text-xs px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
            onClick={() => setConfirmDelete(false)}
          >
            ביטול
          </button>
          <button
            type="button"
            className="text-xs px-2.5 py-1 rounded-lg bg-red-600 text-white hover:bg-red-700"
            onClick={() => {
              setConfirmDelete(false);
              onDelete();
            }}
          >
            מחק
          </button>
        </div>
      </li>
    );
  }

  return (
    <li className="group relative">
      <button
        type="button"
        onClick={onClick}
        className={
          "w-full text-right rounded-xl px-3 py-2.5 transition-colors " +
          (active
            ? "bg-brand-50 text-brand-700"
            : "text-slate-700 hover:bg-slate-50")
        }
      >
        <div className="flex items-start gap-2">
          <span className="text-sm font-medium leading-snug line-clamp-2 flex-1">
            {title}
          </span>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span
            className={
              "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium " +
              (sent
                ? "bg-emerald-50 text-emerald-700"
                : "bg-slate-100 text-slate-500")
            }
          >
            {sent ? "נשלח" : "טיוטה"}
          </span>
          <span className="text-[10px] text-slate-400">{dateStr}</span>
        </div>
      </button>

      {/* Delete button — appears on hover */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setConfirmDelete(true);
        }}
        className="absolute left-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500"
        aria-label="מחק פנייה"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    </li>
  );
}

function deriveTitle(
  req: RequestRecord,
  intake: IntakeSummary | null
): string {
  if (intake?.request_purpose) {
    return intake.request_purpose.length > 60
      ? intake.request_purpose.slice(0, 57) + "..."
      : intake.request_purpose;
  }
  if (intake?.second_party_name) {
    return `התקשרות עם ${intake.second_party_name}`;
  }
  if (req.supplier_name) {
    return `התקשרות עם ${req.supplier_name}`;
  }
  if (req.description) {
    const first = req.description.split(/[.\n]/)[0].trim();
    return first.length > 60 ? first.slice(0, 57) + "..." : first || "פנייה חדשה";
  }
  return "פנייה חדשה";
}
