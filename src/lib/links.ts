/**
 * Centralised URLs / file paths used across the app.
 * Placeholders for the POC — replace with real URLs / documents later.
 */

// External dummy SAP page that simulates the supplier registration form.
export const SAP_SUPPLIER_REGISTRATION_URL =
  "https://sap-rashi.example.org/suppliers/registration/2026";

// Backwards-compat alias — older code imports the old name.
export const SUPPLIER_REGISTRATION_URL = SAP_SUPPLIER_REGISTRATION_URL;

// Documents served from /public/files/. Real files should be placed here by
// the legal team; the POC ships placeholder files with TODO markers.
export const RASHI_GENERAL_TERMS_DOC_URL = "/files/rashi-general-terms.docx";
export const GRANT_MASTER_DOC_URL = "/files/rashi-grant-master.docx";
export const SUPPLIER_SELECTION_PROTOCOL_URL =
  "/files/rashi-supplier-selection-protocol.docx";
export const SINGLE_SUPPLIER_FORM_URL =
  "/files/rashi-single-supplier-form.docx";
export const PRELIMINARY_LEGAL_QUESTIONS_URL =
  "/files/rashi-preliminary-legal-questions.docx";

/**
 * Short Hebrew message a Rashi employee can copy and send to a supplier
 * who needs to register in the 2026 registry. The recipient name can be
 * substituted before sending.
 */
export function buildSupplierRegistrationMessage(supplierName?: string | null): string {
  const greeting = supplierName ? `שלום ${supplierName},` : "שלום,";
  return [
    greeting,
    "",
    "כדי שנוכל להתקדם בהתקשרות, יש להירשם במאגר הספקים של קרן רש\"י לשנת 2026.",
    "כחלק מהרישום תידרשו לחתום על תנאי ההתקשרות הכלליים של הקרן.",
    "",
    `קישור לטופס הרישום: ${SAP_SUPPLIER_REGISTRATION_URL}`,
    "",
    "תודה,",
    "קרן רש\"י",
  ].join("\n");
}
