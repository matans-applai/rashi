import type { RoutingResponse } from "../../lib/aiTypes";
import { OutcomeBadge } from "../OutcomeBadge";

interface Props {
  routing: RoutingResponse;
  onApprove?: () => void;
  onAmend?: () => void;
  approveLabel?: string;
  amendLabel?: string;
  showActions?: boolean;
}

const CONFIDENCE_LABEL = {
  low: "ביטחון נמוך",
  medium: "ביטחון בינוני",
  high: "ביטחון גבוה",
} as const;

const CONFIDENCE_CLASS = {
  low: "bg-amber-50 text-amber-700",
  medium: "bg-blue-50 text-blue-700",
  high: "bg-emerald-50 text-emerald-700",
} as const;

export default function RouteRecommendationCard({
  routing,
  onApprove,
  onAmend,
  approveLabel = "מאשר/ת וממשיכים",
  amendLabel = "אני רוצה לתקן",
  showActions = true,
}: Props) {
  return (
    <div className="card bg-gradient-to-br from-white to-slate-50">
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <h3 className="font-semibold">המסלול המומלץ</h3>
        <OutcomeBadge outcome={routing.route} />
        <span
          className={
            "tag " + CONFIDENCE_CLASS[routing.confidence]
          }
        >
          {CONFIDENCE_LABEL[routing.confidence]}
        </span>
      </div>

      <p className="text-slate-800 leading-relaxed mb-4">
        {routing.user_facing_message_he}
      </p>

      {routing.reasoning_summary_he && (
        <div className="text-sm text-slate-500 border-r-2 border-slate-200 pr-3 mb-4">
          {routing.reasoning_summary_he}
        </div>
      )}

      {routing.detected_triggers.length > 0 && (
        <div className="mb-4">
          <div className="text-xs font-medium text-slate-500 mb-2">
            טריגרים שזוהו
          </div>
          <ul className="space-y-1.5">
            {routing.detected_triggers.map((t, i) => (
              <li key={i} className="text-sm">
                <span className="font-medium text-slate-800">{t.label_he}</span>
                {t.explanation_he && (
                  <span className="text-slate-500"> — {t.explanation_he}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {showActions && (
        <div className="flex items-center gap-3 justify-end pt-3 border-t border-slate-100">
          {onAmend && (
            <button type="button" className="btn-secondary" onClick={onAmend}>
              {amendLabel}
            </button>
          )}
          {onApprove && (
            <button type="button" className="btn-primary" onClick={onApprove}>
              {approveLabel}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
