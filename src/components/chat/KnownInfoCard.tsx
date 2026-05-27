import type { IntakeResponse } from "../../lib/aiTypes";

/**
 * Compact "כבר ידוע למערכת" card — replaces the old "extracted facts" /
 * "route recommendation" cards. Just shows what's been gathered so far,
 * without claiming any decision.
 */
export default function KnownInfoCard({ intake }: { intake: IntakeResponse }) {
  const items = intake.known_information_he;
  if (!items || items.length === 0) {
    return (
      <div className="card">
        <h3 className="font-semibold mb-2">מה כבר ידוע</h3>
        <p className="text-sm text-slate-500">
          טרם נאסף מידע מובנה. אפשר להמשיך לתאר את הפנייה או לענות על שאלות
          השלמה.
        </p>
      </div>
    );
  }
  return (
    <div className="card">
      <h3 className="font-semibold mb-3">מה כבר ידוע</h3>
      <ul className="space-y-1.5 text-sm text-slate-700">
        {items.map((it, i) => (
          <li key={i} className="flex gap-2">
            <span className="text-emerald-600 mt-0.5">✓</span>
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
