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
