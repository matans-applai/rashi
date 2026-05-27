import type { RequestRecord } from "../lib/types";
import type { IntakeResponse, IntakeSummary } from "../lib/aiTypes";

interface Props {
  requests: RequestRecord[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  open: boolean;
  onClose: () => void;
}

export default function RequestSidebar({
  requests,
  activeId,
  onSelect,
  onNew,
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
}: {
  req: RequestRecord;
  active: boolean;
  onClick: () => void;
}) {
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

  return (
    <li>
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
