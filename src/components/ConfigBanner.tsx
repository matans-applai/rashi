import { SUPABASE_CONFIGURED } from "../lib/supabase";

export default function ConfigBanner() {
  if (SUPABASE_CONFIGURED) return null;
  return (
    <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 text-amber-900 px-4 py-3 text-sm">
      <div className="font-semibold mb-1">Supabase לא מוגדר</div>
      <div>
        צרו קובץ <code>.env</code> בתיקיית הפרויקט, והוסיפו את{" "}
        <code>VITE_SUPABASE_URL</code> ו-<code>VITE_SUPABASE_ANON_KEY</code>. ראו
        ה-README להוראות.
      </div>
    </div>
  );
}
