export type SupplierStatus = "registered" | "not_registered" | "unknown";

export interface Supplier {
  name: string;
  status: SupplierStatus;
  category: string;
}

export const DEMO_SUPPLIERS: Supplier[] = [
  { name: "הסעות הצפון בע\"מ", status: "registered", category: "הסעות" },
  { name: "ODT ישראל", status: "registered", category: "פעילות אתגרית" },
  { name: "קייטרינג הבית", status: "not_registered", category: "אוכל" },
  { name: "יועצי אסטרטגיה ABC", status: "registered", category: "ייעוץ" },
  { name: "מלון הגליל", status: "unknown", category: "לינה" },
  { name: "מרכז למידה אורנים", status: "not_registered", category: "הדרכה" },
  { name: "מחשוב ישיר", status: "registered", category: "מחשוב" },
];

function normalize(s: string): string {
  return s.replace(/["'״׳`]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
}

export function lookupSupplier(name: string | null | undefined): Supplier | null {
  if (!name) return null;
  const n = normalize(name);
  if (!n) return null;
  // exact-ish match first
  const exact = DEMO_SUPPLIERS.find((s) => normalize(s.name) === n);
  if (exact) return exact;
  // partial match (supplier name contained in user text, or vice versa)
  const partial = DEMO_SUPPLIERS.find(
    (s) => normalize(s.name).includes(n) || n.includes(normalize(s.name))
  );
  return partial ?? null;
}

/**
 * Filter suppliers for typeahead.
 *
 * - Empty query → return all suppliers (so the user sees the list on focus).
 * - Non-empty query → substring match on either name or category, normalized
 *   (case-insensitive, ignores quote marks and double-spaces).
 * - Registered suppliers float to the top so the common case is one click.
 */
export function filterSuppliers(query: string, limit = 20): Supplier[] {
  const q = normalize(query);
  const sorted = [...DEMO_SUPPLIERS].sort(
    (a, b) => statusRank(a.status) - statusRank(b.status)
  );
  if (!q) return sorted.slice(0, limit);
  const hits = sorted.filter(
    (s) => normalize(s.name).includes(q) || normalize(s.category).includes(q)
  );
  return hits.slice(0, limit);
}

function statusRank(s: SupplierStatus): number {
  // lower = appears earlier
  if (s === "registered") return 0;
  if (s === "unknown") return 1;
  return 2; // not_registered last
}

export function supplierStatusLabel(status: SupplierStatus): string {
  if (status === "registered") return "רשום במאגר 2026";
  if (status === "not_registered") return "לא רשום במאגר";
  return "סטטוס לא ברור";
}
