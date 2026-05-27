import type { ChatStep } from "../../lib/aiTypes";

const STEPS: { id: ChatStep; label: string }[] = [
  { id: "describe", label: "תיאור הפנייה" },
  { id: "clarify", label: "שאלות השלמה" },
  { id: "review_route", label: "המלצה" },
  { id: "final_summary", label: "סיכום / מסמך" },
];

/** Light step indicator at the top of the chat page. */
export default function StepIndicator({
  current,
  legalActive,
}: {
  current: ChatStep;
  legalActive?: boolean;
}) {
  const idx = STEPS.findIndex((s) => s.id === current);
  const labelOverride: Partial<Record<ChatStep, string>> = legalActive
    ? { final_summary: "סיכום משפטי" }
    : {};
  return (
    <ol className="flex items-center gap-2 sm:gap-4 mb-6 justify-center flex-wrap">
      {STEPS.map((s, i) => {
        const state =
          i < idx ? "done" : i === idx ? "active" : "upcoming";
        const label = labelOverride[s.id] ?? s.label;
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
                (state === "upcoming" ? "text-slate-400" : "text-slate-700 font-medium")
              }
            >
              {label}
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
