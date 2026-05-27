import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import ConfigBanner from "../components/ConfigBanner";

export default function Login() {
  const { signIn, configured } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signIn(email, password);
      nav("/chat");
    } catch (err: any) {
      setError(err?.message ?? "שגיאה בהתחברות");
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
          <h1 className="text-xl font-semibold mb-1">התחברות</h1>
          <p className="text-sm text-slate-500 mb-6">
            הזינו את פרטי המשתמש שקיבלתם ממנהל המערכת.
          </p>

          <ConfigBanner />

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
            <div>
              <label className="label" htmlFor="password">
                סיסמה
              </label>
              <input
                id="password"
                type="password"
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
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
              disabled={loading || !configured}
            >
              {loading ? "מתחבר..." : "התחבר"}
            </button>
          </form>

          <div className="mt-4 text-center">
            <Link to="/forgot-password" className="text-sm text-brand-600 hover:underline">
              שכחתי סיסמה
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}
