import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";

/**
 * Legacy route `/requests/:id/legal` — the separate legal-intake flow is gone.
 * The editable review on RequestSummary now covers everything that page did,
 * so we just redirect.
 */
export default function LegalIntake() {
  const { id } = useParams();
  const nav = useNavigate();
  useEffect(() => {
    if (id) nav(`/requests/${id}`, { replace: true });
    else nav("/dashboard", { replace: true });
  }, [id, nav]);
  return null;
}
