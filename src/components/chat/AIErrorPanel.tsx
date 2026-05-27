interface Props {
  onRetry: () => void;
  onContinueManual: () => void;
  manualBusy?: boolean;
}

/**
 * Hebrew RTL error fallback. Shown when OpenAI fails / rate limits /
 * returns invalid output. The user can retry or continue manually.
 */
export default function AIErrorPanel({
  onRetry,
  onContinueManual,
  manualBusy,
}: Props) {
  return (
    <div className="rounded-2xl bg-red-50 border border-red-200 p-4 text-sm">
      <div className="font-semibold text-red-900 mb-1">
        נראה שיש כרגע תקלה בעיבוד האוטומטי
      </div>
      <p className="text-red-800 mb-3">
        אפשר לנסות שוב בעוד רגע, או להמשיך לסיכום ידני ולצרף את הפרטים למחלקה
        המשפטית.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-primary"
          onClick={onRetry}
        >
          נסה שוב
        </button>
        <button
          type="button"
          className="btn-secondary"
          onClick={onContinueManual}
          disabled={manualBusy}
        >
          {manualBusy ? "טוען..." : "המשך לסיכום ידני"}
        </button>
      </div>
    </div>
  );
}
