import { useEffect, useMemo, useRef, useState } from "react";
import {
  filterSuppliers,
  supplierStatusLabel,
  type Supplier,
} from "../lib/suppliers";

interface Props {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

/**
 * Supplier name input with a filtered dropdown.
 *
 * - List of suppliers narrows down as the user types (substring match on name
 *   or category, normalized).
 * - Browser autocomplete from history is disabled — only known suppliers are
 *   suggested.
 * - Keyboard: ↑ / ↓ to move, Enter to select, Esc to close.
 * - Click outside or blur closes the menu.
 */
export default function SupplierTypeahead({
  id,
  value,
  onChange,
  placeholder,
}: Props) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const options = useMemo(() => filterSuppliers(value), [value]);

  // Reset active index when options change.
  useEffect(() => {
    setActiveIndex(options.length > 0 ? 0 : -1);
  }, [options.length, open]);

  // Close on click outside.
  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  function selectSupplier(s: Supplier) {
    onChange(s.name);
    setOpen(false);
    inputRef.current?.blur();
  }

  function handleKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      setOpen(true);
      return;
    }
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, options.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      if (activeIndex >= 0 && options[activeIndex]) {
        e.preventDefault();
        selectSupplier(options[activeIndex]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="relative" ref={wrapRef}>
      <input
        id={id}
        ref={inputRef}
        className="input"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKey}
        placeholder={placeholder}
        autoComplete="off"
        spellCheck={false}
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        aria-controls="supplier-typeahead-listbox"
      />

      {open && options.length > 0 && (
        <ul
          id="supplier-typeahead-listbox"
          role="listbox"
          className="absolute z-20 mt-1 w-full max-h-72 overflow-auto rounded-xl border border-slate-200 bg-white shadow-lg"
        >
          {options.map((s, i) => {
            const active = i === activeIndex;
            return (
              <li
                key={s.name}
                role="option"
                aria-selected={active}
                onMouseEnter={() => setActiveIndex(i)}
                onMouseDown={(e) => {
                  // mousedown (not click) — fires before input blur, so the
                  // selection isn't swallowed by the close-on-blur handler.
                  e.preventDefault();
                  selectSupplier(s);
                }}
                className={
                  "px-3 py-2 cursor-pointer flex items-center justify-between gap-3 " +
                  (active ? "bg-brand-50" : "hover:bg-slate-50")
                }
              >
                <div className="min-w-0">
                  <div className="text-sm text-slate-800 truncate">{s.name}</div>
                  <div className="text-xs text-slate-500 truncate">
                    {s.category}
                  </div>
                </div>
                <StatusPill status={s.status} />
              </li>
            );
          })}
        </ul>
      )}

      {open && options.length === 0 && (
        <div className="absolute z-20 mt-1 w-full rounded-xl border border-slate-200 bg-white shadow-lg px-3 py-2 text-sm text-slate-500">
          לא נמצא ספק בשם זה. ניתן להזין שם ידנית או לפתוח ספק חדש.
        </div>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: Supplier["status"] }) {
  const cls =
    status === "registered"
      ? "bg-emerald-50 text-emerald-700"
      : status === "not_registered"
      ? "bg-red-50 text-red-700"
      : "bg-slate-100 text-slate-600";
  return (
    <span
      className={
        "shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium " +
        cls
      }
    >
      {supplierStatusLabel(status)}
    </span>
  );
}
