import type { IntakeStep } from "../../lib/aiTypes";

const STEPS: { id: IntakeStep; label: string }[] = [
  { id: "describe", label: "תיאור הפנייה" },
  { id: "chat", label: "השלמת מידע" },
  { id: "review", label: "סיכום ועריכה" },
  { id: "ready", label: "הכנה לשליחה" },
];

/**
 * Minimal step indicator at the top of intake pages. Backward-compatible —
 * accepts the legacy step name "final_summary" as an alias for "review".
 */
export default function StepIndicator({
  current,
  legalActive: _legalActive,
}: {
  current: IntakeStep | "final_summary" | "review_route" | "clarify" | "legal_chat";
  legalActive?: boolean;
}) {
  // Map legacy values
  const normalised: IntakeStep =
    current === "final_summary"
      ? "ready"
      : current === "review_route" || current === "clarify" || current === "legal_chat"
      ? "chat"
      : (current as IntakeStep);

  const idx = STEPS.findIndex((s) => s.id === normalised);
  return (
    <ol className="flex items-center gap-2 sm:gap-4 mb-6 justify-center flex-wrap">
      {STEPS.map((s, i) => {
        const state = i < idx ? "done" : i === idx ? "active" : "upcoming";
        return (
          <li key={s.id} className="flex items-center gap-2">
            <span
              className={
                "h-7 w-7 grid place-items-center rounded-full text-xs font-medium transition " +
                (state === "done"
                  ? "bg-emerald-500 text-white"
                  : state === "active"
                  ? "bg-brand-600 text-white shadow-md ring-4 ring-brand-100"
                  : "bg-slate-100 text-slate-400")
              }
            >
              {state === "done" ? "✓" : i + 1}
            </span>
            <span
              className={
                "text-xs sm:text-sm " +
                (state === "upcoming"
                  ? "text-slate-400"
                  : "text-slate-700 font-medium")
              }
            >
              {s.label}
            </span>
            {i < STEPS.length - 1 && (
              <span className="hidden sm:block w-8 h-px bg-slate-200" />
            )}
          </li>
        );
      })}
    </ol>
  );
}
