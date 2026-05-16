import { onCall, HttpsError } from "firebase-functions/v2/https";
import {
  cors,
  cleanString,
  asNumber,
  companyRef,
  validateQuoteInput,
  computeQuoteTotals,
  normalizeLines,
  getQuote,
} from "./quoteService";

export const updateQuote = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }

    const companyId = request.auth.token.companyId as string | undefined;
    if (!companyId) {
      throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    }

    const quoteId = cleanString(request.data?.id || request.data?.quoteId);
    if (!quoteId) {
      throw new HttpsError("invalid-argument", "quoteId es obligatorio");
    }

    const data = request.data || {};

    // Verificar quote existe
    const quote = await getQuote(companyId, quoteId);
    if (!quote) {
      throw new HttpsError("not-found", "Cotización no encontrada");
    }
    if (cleanString(quote.companyId) && cleanString(quote.companyId) !== companyId) {
      throw new HttpsError("permission-denied", "No tienes acceso a esta cotización");
    }

    // Validar estado: no se puede editar si ya fue aceptada, rechazada o cancelada
    const currentStatus = cleanString(quote.status);
    if (["accepted", "rejected", "cancelled"].includes(currentStatus)) {
      throw new HttpsError("failed-precondition", `No se puede editar una cotización ${currentStatus}`);
    }

    // Validación de entrada (líneas opcionales si solo se actualiza metadata)
    const hasLines = Array.isArray(data.lines) && data.lines.length > 0;
    const validationError = validateQuoteInput(data, hasLines);
    if (validationError && hasLines) {
      throw new HttpsError("invalid-argument", validationError);
    }

    // Recalcular totales si hay líneas
    let totals = null;
    const lines = hasLines ? normalizeLines(data.lines) : undefined;
    const taxPct = asNumber(data.taxPct) || asNumber(quote.taxPct) || 19;
    const admMarginPct = asNumber(data.admMarginPct) || asNumber(quote.admMarginPct) || 5;
    const profitMarginPct = asNumber(data.profitMarginPct) || asNumber(quote.profitMarginPct) || 10;

    if (lines) {
      totals = await computeQuoteTotals(lines, taxPct, admMarginPct, profitMarginPct);
    }

    const now = new Date().toISOString();
    const updateData: Record<string, unknown> = {
      updatedAt: now,
      updatedBy: request.auth.uid,
    };

    if (data.title !== undefined) updateData.title = cleanString(data.title);
    if (data.description !== undefined) updateData.description = cleanString(data.description);
    if (data.leadId !== undefined) updateData.leadId = cleanString(data.leadId);
    if (data.customerId !== undefined) updateData.customerId = cleanString(data.customerId) || null;
    if (data.notes !== undefined) updateData.notes = cleanString(data.notes);
    if (data.quoteDate !== undefined) updateData.quoteDate = cleanString(data.quoteDate);
    if (data.validUntil !== undefined) updateData.validUntil = cleanString(data.validUntil) || null;
    if (data.taxPct !== undefined) updateData.taxPct = taxPct;
    if (data.admMarginPct !== undefined) updateData.admMarginPct = admMarginPct;
    if (data.profitMarginPct !== undefined) updateData.profitMarginPct = profitMarginPct;
    if (lines) {
      updateData.lines = lines;
      updateData.subtotalItems = totals!.subtotalItems;
      updateData.admExpenseAmount = totals!.admExpenseAmount;
      updateData.profitAmount = totals!.profitAmount;
      updateData.netTotal = totals!.netTotal;
      updateData.taxAmount = totals!.taxAmount;
      updateData.grossTotal = totals!.grossTotal;
    }

    await companyRef(companyId).collection("quotes").doc(quoteId).update(updateData);

    return { id: quoteId, updated: true };
  }
);
