interface Props {
  message?: string;
  errorCode?: string | null;
  onRetry: () => void;
  onContinueManual: () => void;
  manualBusy?: boolean;
}

/**
 * Hebrew RTL error fallback. Shown when OpenAI fails / rate limits /
 * returns invalid output / times out. The user can retry or continue
 * manually.
 */
export default function AIErrorPanel({
  message,
  errorCode,
  onRetry,
  onContinueManual,
  manualBusy,
}: Props) {
  const isRateLimit = errorCode === "AI_RATE_LIMIT";
  const isTimeout = errorCode === "AI_TIMEOUT" || errorCode === "CLIENT_TIMEOUT";

  const defaultMessage =
    "אפשר לנסות שוב בעוד רגע, או להמשיך לסיכום ידני ולצרף את הפרטים למחלקה המשפטית.";

  const displayMessage = message || defaultMessage;

  return (
    <div
      className={
        "rounded-2xl border p-4 text-sm " +
        (isRateLimit
          ? "bg-amber-50 border-amber-200"
          : isTimeout
            ? "bg-orange-50 border-orange-200"
            : "bg-red-50 border-red-200")
      }
    >
      <div
        className={
          "font-semibold mb-1 " +
          (isRateLimit
            ? "text-amber-900"
            : isTimeout
              ? "text-orange-900"
              : "text-red-900")
        }
      >
        {isRateLimit
          ? "עומס זמני"
          : isTimeout
            ? "זמן התגובה ארוך מהרגיל"
            : "נראה שיש כרגע תקלה בעיבוד האוטומטי"}
      </div>
      <p
        className={
          "mb-3 " +
          (isRateLimit
            ? "text-amber-800"
            : isTimeout
              ? "text-orange-800"
              : "text-red-800")
        }
      >
        {displayMessage}
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-primary" onClick={onRetry}>
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
