import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";

export default function ResetPassword() {
  const nav = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setSessionReady(true);
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setSessionReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("הסיסמה חייבת להכיל לפחות 8 תווים.");
      return;
    }
    if (password !== confirm) {
      setError("הסיסמאות אינן תואמות.");
      return;
    }

    setLoading(true);
    try {
      const { error: err } = await supabase.auth.updateUser({
        password,
      });
      if (err) throw err;
      setSuccess(true);
      setTimeout(() => nav("/"), 3000);
    } catch (err: any) {
      setError(err?.message ?? "שגיאה בעדכון הסיסמה");
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
          {success ? (
            <>
              <h1 className="text-xl font-semibold mb-2">הסיסמה עודכנה</h1>
              <p className="text-sm text-slate-600 mb-6">
                הסיסמה עודכנה בהצלחה. אפשר להתחבר עם הסיסמה החדשה.
              </p>
              <Link to="/" className="btn-primary inline-block text-center w-full">
                התחבר
              </Link>
            </>
          ) : !sessionReady ? (
            <>
              <h1 className="text-xl font-semibold mb-2">הגדרת סיסמה חדשה</h1>
              <p className="text-sm text-slate-500 mb-4">
                ממתין לאימות הקישור...
              </p>
              <p className="text-xs text-slate-400">
                אם הדף לא מתעדכן, נסו ללחוץ שוב על הקישור שנשלח אליכם במייל.
              </p>
            </>
          ) : (
            <>
              <h1 className="text-xl font-semibold mb-1">הגדרת סיסמה חדשה</h1>
              <p className="text-sm text-slate-500 mb-6">
                בחרו סיסמה חדשה (לפחות 8 תווים).
              </p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="label" htmlFor="password">
                    סיסמה חדשה
                  </label>
                  <input
                    id="password"
                    type="password"
                    className="input"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    autoFocus
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="label" htmlFor="confirm">
                    אימות סיסמה
                  </label>
                  <input
                    id="confirm"
                    type="password"
                    className="input"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                    minLength={8}
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
                  {loading ? "מעדכן..." : "עדכן סיסמה"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
