import { onCall, HttpsError } from "firebase-functions/v2/https";
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

type QuoteSection = "SERVICIOS" | "PERSONAL" | "INSUMOS";

interface RawLine {
  id?: string;
  sectionType?: QuoteSection;
  section_type?: QuoteSection;
  catalogItemId?: string;
  catalog_item_id?: string;
  description?: string;
  quantity?: number;
  unitPrice?: number;
  unit_price?: number;
  discountPercent?: number;
  discount_percent?: number;
  subtotalLine?: number;
  subtotal_line?: number;
}

function companyRef(companyId: string) {
  return db.collection("companies").doc(companyId);
}

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asNumber(value: unknown): number {
  return Number(value || 0);
}

function serializeDoc(snapshot: FirebaseFirestore.DocumentSnapshot): Record<string, unknown> | null {
  if (!snapshot.exists) return null;
  return { id: snapshot.id, ...snapshot.data() };
}

function normalizeLine(rawLine: RawLine, index: number): QuoteLine & { catalogItemId?: string; subtotalLine: number } {
  const sectionType = rawLine.sectionType || rawLine.section_type || "SERVICIOS";
  const quantity = asNumber(rawLine.quantity);
  const unitPrice = asNumber(rawLine.unitPrice ?? rawLine.unit_price);
  return {
    id: cleanString(rawLine.id) || String(index + 1),
    sectionType,
    catalogItemId: cleanString(rawLine.catalogItemId || rawLine.catalog_item_id) || undefined,
    description: cleanString(rawLine.description),
    quantity,
    unitPrice,
    discountPercent: rawLine.discountPercent ?? rawLine.discount_percent,
    subtotalLine: asNumber(rawLine.subtotalLine ?? rawLine.subtotal_line) || quantity * unitPrice,
  };
}

async function getOptionalDoc(companyId: string, collectionName: string, id: unknown): Promise<Record<string, unknown> | null> {
  const docId = cleanString(id);
  if (!docId) return null;
  const snapshot = await companyRef(companyId).collection(collectionName).doc(docId).get();
  return serializeDoc(snapshot);
}

async function getCatalogItem(companyId: string, sectionType: QuoteSection, catalogItemId?: string) {
  if (!catalogItemId) return null;
  const collections =
    sectionType === "SERVICIOS"
      ? ["serviceCatalog", "servicesCatalog", "quoteServiceCatalog"]
      : sectionType === "PERSONAL"
        ? ["workerCatalog", "workersCatalog", "quoteWorkerCatalog"]
        : ["itemCatalog", "itemsCatalog", "quoteItemCatalog"];

  for (const collectionName of collections) {
    const item = await getOptionalDoc(companyId, collectionName, catalogItemId);
    if (item) return item;
  }
  return null;
}

function buildFallbackCode(index: number): string {
  return `#${String(index + 1).padStart(3, "0")}`;
}

function mapCompany(company: Record<string, unknown> | null) {
  return {
    id: cleanString(company?.id),
    name: cleanString(company?.name) || cleanString(company?.legalName) || "Tu Empresa",
    legalName: cleanString(company?.legalName),
    rut: cleanString(company?.taxId),
    address: cleanString(company?.address),
    phone: cleanString(company?.phone),
    email: cleanString(company?.email),
    logoUrl: cleanString(company?.logoUrl),
    bankName: cleanString(company?.bankName),
    accountType: cleanString(company?.accountType),
    accountNumber: cleanString(company?.accountNumber),
    defaultTerms: cleanString(company?.defaultTerms),
  };
}

function mapCustomer(customer: Record<string, unknown> | null) {
  return {
    id: cleanString(customer?.id),
    name: cleanString(customer?.name),
    legalName: cleanString(customer?.legalName),
    rut: cleanString(customer?.taxId),
    address: cleanString(customer?.address),
    phone: cleanString(customer?.phone),
    email: cleanString(customer?.email),
    contactName: cleanString(customer?.contactName),
  };
}

function mapLead(lead: Record<string, unknown> | null, serviceType: Record<string, unknown> | null) {
  return {
    id: cleanString(lead?.id),
    title: cleanString(lead?.title),
    projectCode: cleanString(lead?.projectCode),
    description: cleanString(lead?.description),
    serviceTypeName: cleanString(serviceType?.name),
  };
}

export const getQuoteExportData = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesion");
    }

    const companyId = request.auth.token.companyId as string | undefined;
    if (!companyId) {
      throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    }

    const quoteId = cleanString(request.data?.quoteId || request.data?.id);
    if (!quoteId) {
      throw new HttpsError("invalid-argument", "quoteId requerido");
    }

    const quoteSnapshot = await companyRef(companyId).collection("quotes").doc(quoteId).get();
    const quote = serializeDoc(quoteSnapshot);
    if (!quote) {
      throw new HttpsError("not-found", "Cotizacion no encontrada");
    }
    if (cleanString(quote.companyId) && cleanString(quote.companyId) !== companyId) {
      throw new HttpsError("permission-denied", "No tienes acceso a esta cotizacion");
    }

    const companySnapshot = await companyRef(companyId).get();
    const company = serializeDoc(companySnapshot);
    const lead = await getOptionalDoc(companyId, "leads", quote.leadId);
    const customer = await getOptionalDoc(companyId, "customers", quote.customerId || lead?.customerId);
    const serviceType = await getOptionalDoc(companyId, "serviceTypes", lead?.serviceTypeId);
    const creator =
      (await getOptionalDoc(companyId, "users", quote.createdBy)) ||
      serializeDoc(await db.collection("users").doc(cleanString(quote.createdBy)).get());

    const rawLines = Array.isArray(quote.lines) ? (quote.lines as RawLine[]) : [];
    const normalizedLines = rawLines.map(normalizeLine);
    const totals = await calculateQuoteTotal({
      lines: normalizedLines,
      taxPct: asNumber(quote.taxPct) || 19,
      admMarginPct: asNumber(quote.admMarginPct) || 5,
      profitMarginPct: asNumber(quote.profitMarginPct) || 10,
    });

    const lines = await Promise.all(
      normalizedLines.map(async (line, index) => {
        const catalogItem = await getCatalogItem(companyId, line.sectionType, line.catalogItemId);
        const catalogCode =
          cleanString(catalogItem?.code) ||
          (line.sectionType === "PERSONAL" && catalogItem ? `HH-${String(line.catalogItemId || index + 1).padStart(3, "0")}` : "");
        return {
          ...line,
          itemCode: catalogCode || buildFallbackCode(index),
          subtotalLine: line.quantity * line.unitPrice,
        };
      })
    );

    return {
      quote: {
        ...quote,
        id: quoteId,
        subtotalItems: quote.subtotalItems ?? totals.subtotalItems,
        admExpenseAmount: quote.admExpenseAmount ?? totals.admExpenseAmount,
        profitAmount: quote.profitAmount ?? totals.profitAmount,
        netTotal: quote.netTotal ?? totals.netTotal,
        taxAmount: quote.taxAmount ?? totals.taxAmount,
        grossTotal: quote.grossTotal ?? totals.grossTotal,
      },
      company: mapCompany(company),
      customer: mapCustomer(customer),
      lead: mapLead(lead, serviceType),
      creator: {
        id: cleanString(creator?.id || quote.createdBy),
        name: cleanString(creator?.name) || cleanString(request.auth.token.name) || cleanString(request.auth.token.email),
        email: cleanString(creator?.email) || cleanString(request.auth.token.email),
      },
      lines,
    };
  }
);
