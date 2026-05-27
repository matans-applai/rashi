import { useEffect, useRef, useState } from "react";

interface Props {
  placeholder?: string;
  disabled?: boolean;
  busy?: boolean;
  onSend: (text: string) => void;
  /** Optional helper chips shown above the input on empty state. */
  chips?: { label: string; value: string }[];
  /** Initial text (used to restore drafts). */
  initialText?: string;
  /** Render as a bigger first-screen input vs a compact follow-up input. */
  size?: "hero" | "compact";
}

/**
 * Modern Gen-AI-style chat input. Auto-resizing textarea, Enter to send,
 * Shift+Enter for newline. RTL-first.
 */
export default function ChatInput({
  placeholder = "כתבו כאן...",
  disabled,
  busy,
  onSend,
  chips,
  initialText = "",
  size = "compact",
}: Props) {
  const [value, setValue] = useState(initialText);
  const ref = useRef<HTMLTextAreaElement | null>(null);

  // auto-resize
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 280) + "px";
  }, [value]);

  function submit() {
    const t = value.trim();
    if (!t || disabled) return;
    onSend(t);
    setValue("");
  }

  const isHero = size === "hero";

  return (
    <div className="w-full">
      <div
        className={
          "bg-white border border-slate-200 rounded-3xl shadow-sm transition focus-within:border-brand-300 focus-within:shadow-md " +
          (isHero ? "p-3" : "p-2")
        }
      >
        <textarea
          ref={ref}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={placeholder}
          disabled={disabled}
          rows={isHero ? 3 : 1}
          className={
            "w-full resize-none bg-transparent outline-none placeholder:text-slate-400 px-3 py-2 " +
            (isHero ? "text-base" : "text-sm")
          }
        />
        <div className="flex items-center justify-between gap-3 mt-1 px-1">
          <div className="text-[11px] text-slate-400">
            Enter לשליחה • Shift+Enter שורה חדשה
          </div>
          <button
            type="button"
            onClick={submit}
            disabled={disabled || !value.trim()}
            className="btn-primary rounded-full px-5"
          >
            {busy ? "..." : "שלח"}
          </button>
        </div>
      </div>

      {chips && value.length === 0 && (
        <div className="flex flex-wrap gap-2 mt-3 justify-center">
          {chips.map((c) => (
            <button
              key={c.label}
              type="button"
              disabled={disabled}
              onClick={() => setValue(c.value)}
              className="text-xs px-3 py-1.5 rounded-full bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition"
            >
              {c.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
