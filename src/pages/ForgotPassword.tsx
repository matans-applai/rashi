import { useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";

const REDIRECT_URL =
  window.location.origin === "http://localhost:5173"
    ? "http://localhost:5173/reset-password"
    : "https://rashi-legal-bot.vercel.app/reset-password";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: REDIRECT_URL,
      });
      if (err) throw err;
      setSent(true);
    } catch (err: any) {
      setError(err?.message ?? "שגיאה בשליחת המייל");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center px-6">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div className="h-12 w-12 rounded-2xl bg-brand-600 text-white grid place-items-center text-xl font-bold">
            ר
          </div>
          <div>
            <div className="text-sm text-slate-500">קרן רש"י</div>
            <div className="text-lg font-semibold">עוזר הכנת פנייה למשפטית</div>
          </div>
        </div>

        <div className="card">
          {sent ? (
            <>
              <h1 className="text-xl font-semibold mb-2">נשלח מייל לאיפוס</h1>
              <p className="text-sm text-slate-600 mb-6">
                נשלח אליך מייל לאיפוס סיסמה, אם הכתובת קיימת במערכת.
              </p>
              <Link to="/" className="btn-secondary inline-block text-center w-full">
                חזרה להתחברות
              </Link>
            </>
          ) : (
            <>
              <h1 className="text-xl font-semibold mb-1">שכחתי סיסמה</h1>
              <p className="text-sm text-slate-500 mb-6">
                הזינו את כתובת האימייל ונשלח לכם קישור לאיפוס הסיסמה.
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="label" htmlFor="email">
                    אימייל
                  </label>
                  <input
                    id="email"
                    type="email"
                    className="input"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoFocus
                    dir="ltr"
                  />
                </div>

                {error && (
                  <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 px-3 py-2 text-sm">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  className="btn-primary w-full"
                  disabled={loading}
                >
                  {loading ? "שולח..." : "שלח קישור לאיפוס"}
                </button>
              </form>

              <div className="mt-4 text-center">
                <Link to="/" className="text-sm text-brand-600 hover:underline">
                  חזרה להתחברות
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
