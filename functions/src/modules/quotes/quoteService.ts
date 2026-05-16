/**
 * Servicio compartido de validaciones y utilidades para el módulo Quotes.
 */

import { db } from "../../config";
import { calculateQuoteTotal, type QuoteLine } from "./calculateTotal";

const cors = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5000",
  "https://your-erp.web.app",
  "https://your-erp-staging.web.app",
  "https://your-erp-staging.firebaseapp.com",
];

export { cors };

export function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function asNumber(value: unknown): number {
  return Number(value || 0);
}

export function companyRef(companyId: string) {
  return db.collection("companies").doc(companyId);
}

export function serializeDoc(snapshot: FirebaseFirestore.DocumentSnapshot): Record<string, unknown> | null {
  if (!snapshot.exists) return null;
  return { id: snapshot.id, ...snapshot.data() };
}

export function normalizeLines(rawLines: unknown[]): QuoteLine[] {
  return rawLines.map((raw: any, index: number) => {
    const quantity = asNumber(raw.quantity);
    const unitPrice = asNumber(raw.unitPrice ?? raw.unit_price);
    return {
      id: cleanString(raw.id) || String(index + 1),
      sectionType: raw.sectionType || raw.section_type || "SERVICIOS",
      description: cleanString(raw.description),
      quantity,
      unitPrice,
      discountPercent: raw.discountPercent ?? raw.discount_percent,
      subtotalLine: quantity * unitPrice,
    };
  });
}

export function validateQuoteInput(data: Record<string, unknown>, requireLines = true): string | null {
  const title = cleanString(data.title);
  if (!title) return "El título es obligatorio";
  if (title.length < 2) return "El título debe tener al menos 2 caracteres";

  const leadId = cleanString(data.leadId);
  if (!leadId) return "Debes seleccionar una oportunidad (lead)";

  const lines = Array.isArray(data.lines) ? data.lines : [];
  if (requireLines && lines.length === 0) return "La cotización debe tener al menos una línea";

  for (const line of lines) {
    const l = line as any;
    if (!cleanString(l.description)) return "Todas las líneas deben tener descripción";
    if (asNumber(l.quantity) <= 0) return "Todas las líneas deben tener cantidad mayor a 0";
    if (asNumber(l.unitPrice) < 0) return "Todas las líneas deben tener precio unitario válido";
  }

  const taxPct = asNumber(data.taxPct);
  if (taxPct < 0 || taxPct > 100) return "El porcentaje de IVA debe estar entre 0 y 100";

  const admMarginPct = asNumber(data.admMarginPct);
  if (admMarginPct < 0 || admMarginPct > 100) return "El porcentaje de gastos administrativos debe estar entre 0 y 100";

  const profitMarginPct = asNumber(data.profitMarginPct);
  if (profitMarginPct < 0 || profitMarginPct > 100) return "El porcentaje de utilidad debe estar entre 0 y 100";

  return null;
}

export async function generateQuoteNumber(companyId: string, projectCode?: string): Promise<string> {
  const companyShort = companyId.slice(-4).toUpperCase();
  const prefix = projectCode ? projectCode.replace(/\s+/g, "") : companyShort;
  const countSnap = await companyRef(companyId).collection("quotes").count().get();
  const seq = countSnap.data().count + 1;
  return `COT-${prefix}-${String(seq).padStart(3, "0")}`;
}

export async function computeQuoteTotals(lines: QuoteLine[], taxPct: number, admMarginPct: number, profitMarginPct: number) {
  return calculateQuoteTotal({ lines, taxPct, admMarginPct, profitMarginPct });
}

export async function getLead(companyId: string, leadId: string) {
  const snap = await companyRef(companyId).collection("leads").doc(leadId).get();
  return serializeDoc(snap);
}

export async function getQuote(companyId: string, quoteId: string) {
  const snap = await companyRef(companyId).collection("quotes").doc(quoteId).get();
  return serializeDoc(snap);
}

export async function createActivityLog(companyId: string, data: {
  type: string;
  quoteId: string;
  message: string;
  userId: string;
  metadata?: Record<string, unknown>;
}) {
  return companyRef(companyId).collection("activityLogs").add({
    companyId,
    ...data,
    createdAt: new Date().toISOString(),
  });
}
