import type { RoutingResponse, SupplierStatusLLM } from "../../lib/aiTypes";

const SUPPLIER_STATUS_LABEL: Record<SupplierStatusLLM, string> = {
  registered: "רשום במאגר 2026",
  not_registered: "לא רשום במאגר 2026",
  unknown: "סטטוס לא ברור",
  not_checked: "לא הוזכר ספק",
};

export default function ExtractedFactsCard({ routing }: { routing: RoutingResponse }) {
  const s = routing.request_summary;
  return (
    <div className="card">
      <h3 className="font-semibold mb-4">מה המערכת הבינה</h3>
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
        <Fact label="מטרה" value={s.purpose || "—"} />
        <Fact label="מיזם / מחלקה" value={s.department_or_project || "—"} />
        <Fact label="צד שני" value={s.second_party || "—"} />
        <Fact
          label="סטטוס ספק"
          value={SUPPLIER_STATUS_LABEL[s.supplier_status]}
        />
        <Fact
          label="סכום"
          value={
            s.amount != null ? `${s.amount.toLocaleString("he-IL")} ₪` : "—"
          }
        />
        <Fact label="לוח זמנים" value={s.timeline || "—"} />
        {s.party_roles && (
          <Fact label="תפקיד כל צד" value={s.party_roles} wide />
        )}
        {s.documents_mentioned.length > 0 && (
          <Fact
            label="מסמכים שהוזכרו"
            value={s.documents_mentioned.join(", ")}
            wide
          />
        )}
      </dl>
    </div>
  );
}

function Fact({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="text-slate-800 mt-0.5">{value}</dd>
    </div>
  );
}
