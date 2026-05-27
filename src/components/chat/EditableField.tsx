import { useEffect, useRef, useState } from "react";

type Mode = "text" | "textarea" | "number" | "select" | "list";

interface Option {
  value: string;
  label: string;
}

interface BaseProps {
  label: string;
  mode?: Mode;
  options?: Option[]; // for mode="select"
  placeholder?: string;
  className?: string;
}

type Value = string | number | string[] | null;

interface Props extends BaseProps {
  value: Value;
  onChange: (next: Value) => void;
}

/**
 * Inline-editable field used on the review cards.
 * - Click the pencil to enter edit mode.
 * - Esc cancels, Enter (or blur) saves.
 * - List mode = one item per line (string[]).
 */
export default function EditableField({
  label,
  value,
  mode = "text",
  options,
  placeholder,
  onChange,
  className,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string>(toDraft(value, mode));
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  useEffect(() => {
    setDraft(toDraft(value, mode));
  }, [value, mode]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  function commit() {
    onChange(fromDraft(draft, mode));
    setEditing(false);
  }
  function cancel() {
    setDraft(toDraft(value, mode));
    setEditing(false);
  }

  return (
    <div className={className}>
      <div className="text-xs text-slate-500 mb-0.5 flex items-center gap-2">
        {label}
        {!editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-slate-400 hover:text-brand-600 transition text-[11px]"
            aria-label={`ערוך ${label}`}
          >
            ✏ ערוך
          </button>
        )}
      </div>

      {!editing ? (
        <div className="text-slate-800 text-sm whitespace-pre-wrap min-h-[1.5em]">
          {renderValue(value, mode, options) || (
            <span className="text-slate-400">—</span>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {mode === "textarea" || mode === "list" ? (
            <textarea
              ref={inputRef as React.RefObject<HTMLTextAreaElement>}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") cancel();
              }}
              placeholder={
                placeholder ?? (mode === "list" ? "פריט אחד בשורה" : "")
              }
              rows={4}
              className="input min-h-[90px]"
            />
          ) : mode === "select" ? (
            <select
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className="input"
            >
              {(options ?? []).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              ref={inputRef as React.RefObject<HTMLInputElement>}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commit();
                if (e.key === "Escape") cancel();
              }}
              placeholder={placeholder}
              type={mode === "number" ? "number" : "text"}
              dir={mode === "number" ? "ltr" : undefined}
              className="input"
            />
          )}
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              className="btn-secondary text-xs px-3 py-1"
              onClick={cancel}
            >
              ביטול
            </button>
            <button
              type="button"
              className="btn-primary text-xs px-3 py-1"
              onClick={commit}
            >
              שמור
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- helpers ----

function toDraft(value: Value, mode: Mode): string {
  if (value == null) return "";
  if (mode === "list" && Array.isArray(value)) return value.join("\n");
  if (typeof value === "number") return String(value);
  return String(value);
}

function fromDraft(draft: string, mode: Mode): Value {
  const t = draft.trim();
  if (mode === "list") {
    const items = draft
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    return items;
  }
  if (mode === "number") {
    if (!t) return null;
    const clean = t.replace(/[,\s₪]/g, "");
    const n = Number(clean);
    return Number.isFinite(n) ? n : null;
  }
  return t || null;
}

function renderValue(
  value: Value,
  mode: Mode,
  options?: Option[]
): string | null {
  if (value == null || value === "") return null;
  if (mode === "list" && Array.isArray(value)) {
    if (value.length === 0) return null;
    return value.map((v) => `• ${v}`).join("\n");
  }
  if (mode === "select" && options) {
    return options.find((o) => o.value === value)?.label ?? String(value);
  }
  if (typeof value === "number") {
    return value.toLocaleString("he-IL");
  }
  return String(value);
}
