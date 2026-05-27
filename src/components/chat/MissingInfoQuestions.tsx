export default function MissingInfoQuestions({
  questions,
}: {
  questions: string[];
}) {
  if (!questions || questions.length === 0) return null;
  return (
    <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 text-sm">
      <div className="font-semibold text-amber-900 mb-2">שאלות השלמה</div>
      <ol className="space-y-1.5 list-none pr-1">
        {questions.map((q, i) => (
          <li key={i} className="flex gap-2 text-amber-900">
            <span className="font-medium shrink-0">{i + 1}.</span>
            <span>{q}</span>
          </li>
        ))}
      </ol>
      <div className="text-xs text-amber-800 mt-3">
        אפשר לענות חופשי בתיבה למטה — גם תשובה חלקית מספיקה.
      </div>
    </div>
  );
}
