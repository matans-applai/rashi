import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/auth";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import NewRequest from "./pages/NewRequest";
import RequestSummary from "./pages/RequestSummary";
import LegalIntake from "./pages/LegalIntake";
import LegalConfirmation from "./pages/LegalConfirmation";

function RequireAuth({ children }: { children: JSX.Element }) {
  const { user, loading, configured } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center text-slate-500">
        טוען...
      </div>
    );
  }
  if (!configured || !user) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route
          path="/dashboard"
          element={
            <RequireAuth>
              <Dashboard />
            </RequireAuth>
          }
        />
        <Route
          path="/requests/new"
          element={
            <RequireAuth>
              <NewRequest />
            </RequireAuth>
          }
        />
        <Route
          path="/requests/:id"
          element={
            <RequireAuth>
              <RequestSummary />
            </RequireAuth>
          }
        />
        <Route
          path="/requests/:id/legal"
          element={
            <RequireAuth>
              <LegalIntake />
            </RequireAuth>
          }
        />
        <Route
          path="/requests/:id/confirm"
          element={
            <RequireAuth>
              <LegalConfirmation />
            </RequireAuth>
          }
        />
        <Route
          path="/requests/:id/sent"
          element={
            <RequireAuth>
              <LegalConfirmation />
            </RequireAuth>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
