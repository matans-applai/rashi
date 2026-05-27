/**
 * Renders the AI's clarifying questions as suggestion chips.
 * Clicking a chip prefills the chat input via the onPick callback.
 */
export default function MissingInfoQuestions({
  questions,
  onPick,
}: {
  questions: string[];
  onPick?: (q: string) => void;
}) {
  if (!questions || questions.length === 0) return null;
  return (
    <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 text-sm">
      <div className="font-semibold text-amber-900 mb-2">
        כדי לדייק את ההמלצה, אפשר להשלים רק מה שידוע
      </div>
      <ul className="space-y-2">
        {questions.slice(0, 3).map((q, i) => (
          <li key={i}>
            <button
              type="button"
              className="text-right w-full bg-white border border-amber-200 hover:border-amber-300 hover:bg-amber-50 rounded-lg px-3 py-2 text-amber-900 transition"
              onClick={() => onPick?.(q)}
            >
              {q}
            </button>
          </li>
        ))}
      </ul>
      <div className="text-xs text-amber-800 mt-3">
        אפשר גם להמשיך עם המידע הקיים, ואציין את החוסרים בסיכום.
      </div>
    </div>
  );
}
