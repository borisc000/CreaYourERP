import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db } from "../../config";
import {
  cors,
  cleanString,
  asNumber,
  companyRef,
  validateQuoteInput,
  generateQuoteNumber,
  computeQuoteTotals,
  normalizeLines,
  getLead,
} from "./quoteService";

export const createQuote = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }

    const companyId = request.auth.token.companyId as string | undefined;
    if (!companyId) {
      throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    }

    const data = request.data || {};

    // Validación de entrada
    const validationError = validateQuoteInput(data, true);
    if (validationError) {
      throw new HttpsError("invalid-argument", validationError);
    }

    // Validar lead existe y pertenece a la empresa
    const leadId = cleanString(data.leadId);
    const lead = await getLead(companyId, leadId);
    if (!lead) {
      throw new HttpsError("not-found", "La oportunidad seleccionada no existe");
    }
    if (cleanString(lead.companyId) && cleanString(lead.companyId) !== companyId) {
      throw new HttpsError("permission-denied", "No tienes acceso a esta oportunidad");
    }

    // Cálculos server-side
    const lines = normalizeLines(Array.isArray(data.lines) ? data.lines : []);
    const taxPct = asNumber(data.taxPct) || 19;
    const admMarginPct = asNumber(data.admMarginPct) || 5;
    const profitMarginPct = asNumber(data.profitMarginPct) || 10;
    const totals = await computeQuoteTotals(lines, taxPct, admMarginPct, profitMarginPct);

    // Numeración atómica
    const projectCode = cleanString(data.projectCode) || cleanString(lead.projectCode);
    const quoteNumber = await generateQuoteNumber(companyId, projectCode);

    // Crear documento
    const quoteRef = companyRef(companyId).collection("quotes").doc();
    const now = new Date().toISOString();
    const quoteData = {
      companyId,
      quoteNumber,
      title: cleanString(data.title),
      description: cleanString(data.description),
      leadId,
      customerId: cleanString(data.customerId) || cleanString(lead.customerId) || null,
      status: "draft",
      lines,
      taxPct,
      admMarginPct,
      profitMarginPct,
      subtotalItems: totals.subtotalItems,
      admExpenseAmount: totals.admExpenseAmount,
      profitAmount: totals.profitAmount,
      netTotal: totals.netTotal,
      taxAmount: totals.taxAmount,
      grossTotal: totals.grossTotal,
      notes: cleanString(data.notes),
      quoteDate: cleanString(data.quoteDate) || now.split("T")[0],
      validUntil: cleanString(data.validUntil) || null,
      createdBy: request.auth.uid,
      createdAt: now,
      updatedAt: now,
    };

    await db.runTransaction(async (t) => {
      t.set(quoteRef, quoteData);
      t.set(companyRef(companyId).collection("activityLogs").doc(), {
        companyId,
        type: "quote.created",
        quoteId: quoteRef.id,
        message: `Cotización ${quoteNumber} creada como borrador`,
        userId: request.auth!.uid,
        metadata: { quoteNumber, leadId },
        createdAt: now,
      });
    });

    return {
      id: quoteRef.id,
      ...quoteData,
    };
  }
);
