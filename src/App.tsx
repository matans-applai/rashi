import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/auth";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import ChatWorkspace from "./pages/ChatWorkspace";
import RequestSummary from "./pages/RequestSummary";
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
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route
          path="/chat"
          element={
            <RequireAuth>
              <ChatWorkspace />
            </RequireAuth>
          }
        />
        <Route
          path="/chat/:id"
          element={
            <RequireAuth>
              <ChatWorkspace />
            </RequireAuth>
          }
        />
        {/* Legacy routes redirect to workspace */}
        <Route
          path="/dashboard"
          element={
            <RequireAuth>
              <Navigate to="/chat" replace />
            </RequireAuth>
          }
        />
        <Route
          path="/requests/new"
          element={
            <RequireAuth>
              <Navigate to="/chat" replace />
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
