import { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth, getUserDisplayName } from "../lib/auth";

export default function Layout({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const nav = useNavigate();

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/dashboard" className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-brand-600 text-white grid place-items-center font-bold">
              ר
            </div>
            <div>
              <div className="text-sm text-slate-500">קרן רש"י</div>
              <div className="font-semibold leading-tight">עוזר הכנת פנייה למשפטית</div>
            </div>
          </Link>
          {user && (
            <div className="flex items-center gap-4">
              <div className="text-sm text-slate-600 hidden sm:block">
                {getUserDisplayName(user)}
              </div>
              <button
                className="btn-secondary"
                onClick={async () => {
                  await signOut();
                  nav("/");
                }}
              >
                התנתק
              </button>
            </div>
          )}
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
