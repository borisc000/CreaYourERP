import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db } from "../../config";
import { assertAction } from "../../shared/rbac";
import { toCents, taxFromSubtotalCents } from "../../shared/money";

function companyRef(companyId: string) {
  return db.collection("companies").doc(companyId);
}

function nowIso() {
  return new Date().toISOString();
}

export const createBillingDocumentFromQuote = onCall(
  {
    region: "us-central1",
    cors: ["https://your-erp.web.app", "https://your-erp-staging.web.app", "https://your-erp-staging.firebaseapp.com", "http://localhost:5173"],
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }
    const companyId = request.auth.token.companyId;
    if (!companyId) {
      throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    }
    await assertAction(request, "billing.create_document", { companyId });

    const quoteId = request.data?.quoteId;
    if (!quoteId) throw new HttpsError("invalid-argument", "quoteId es requerido");

    const cref = companyRef(companyId);
    const quoteSnap = await cref.collection("quotes").doc(quoteId).get();
    if (!quoteSnap.exists) throw new HttpsError("not-found", "Cotización no encontrada");
    const quote = quoteSnap.data() as any;
    if (quote.status !== "accepted") {
      throw new HttpsError("failed-precondition", "Solo se puede facturar una cotización aceptada");
    }

    // Check if billing doc already exists for this quote
    const existingSnap = await cref.collection("billingDocuments").where("sourceQuoteId", "==", quoteId).limit(1).get();
    if (!existingSnap.empty) {
      const existing = existingSnap.docs[0];
      return { success: true, documentId: existing.id, alreadyExists: true };
    }

    // Resolve customer
    let customerName = quote.customerName || "";
    let customerTaxId = "";
    let customerEmail = "";
    if (quote.customerId) {
      const custSnap = await cref.collection("customers").doc(quote.customerId).get();
      if (custSnap.exists) {
        const cust = custSnap.data() as any;
        customerName = cust.name || customerName;
        customerTaxId = cust.taxId || "";
        customerEmail = cust.email || "";
      }
    }

    // Build lines from quote lines (convert unitPrice to cents)
    const lines = (quote.lines || []).map((l: any) => ({
      description: l.description || "",
      quantity: Number(l.quantity) || 1,
      unitPrice: toCents(Number(l.unitPrice) || 0),
      discountPct: Number(l.discountPercent) || 0,
      isExempt: false,
    }));

    if (lines.length === 0) {
      throw new HttpsError("failed-precondition", "La cotización no tiene líneas para facturar");
    }

    // Compute totals in cents
    const taxRate = Number(quote.taxPct) || 19;
    const factor = 1;
    let subtotalAmountCents = 0;
    const computedLines = lines.map((l: any) => {
      const quantity = Math.max(0, Number(l.quantity) || 0);
      const unitPriceCents = Math.max(0, Math.round(Number(l.unitPrice) || 0));
      const discountPct = Math.max(0, Math.min(100, Number(l.discountPct) || 0));
      const lineSubCents = Math.round(quantity * unitPriceCents * (1 - discountPct / 100));
      subtotalAmountCents += lineSubCents;
      return { ...l, quantity, unitPrice: unitPriceCents, discountPct, lineTotal: lineSubCents };
    });
    subtotalAmountCents = Math.round(subtotalAmountCents);
    const taxAmountCents = taxFromSubtotalCents(subtotalAmountCents, taxRate);
    const totalAmountCents = Math.round((subtotalAmountCents + taxAmountCents) * factor);

    // Generate document number
    const countSnap = await cref.collection("billingDocuments").count().get();
    const seq = countSnap.data().count + 1;
    const documentNumber = `F${String(seq).padStart(6, "0")}`;

    const now = nowIso();
    const today = now.split("T")[0];
    const docRef = cref.collection("billingDocuments").doc();
    const docId = docRef.id;

    const docData: Record<string, any> = {
      id: docId,
      companyId,
      documentNumber,
      documentType: "33",
      customerId: quote.customerId || "",
      customerName: customerName || "Cliente sin nombre",
      customerTaxId,
      customerEmail,
      sourceQuoteId: quoteId,
      sourceReference: quote.quoteNumber || "",
      createdFrom: "quote",
      issueDate: today,
      dueDate: today,
      paymentTerms: "30 días",
      currency: "CLP",
      status: "draft",
      siiStatus: "not_sent",
      paymentStatus: "pending",
      deliveryStatus: "pending",
      taxRate,
      subtotalAmount: Math.round(subtotalAmountCents * factor),
      taxAmount: Math.round(taxAmountCents * factor),
      totalAmount: totalAmountCents,
      paidAmount: 0,
      balanceDue: Math.abs(totalAmountCents),
      customerMessage: `Documento generado desde cotización ${quote.quoteNumber || quoteId}`,
      internalNotes: `Quote grossTotal: ${quote.grossTotal || 0}`,
      createdAt: now,
      updatedAt: now,
    };

    await docRef.set(docData);

    const batch = db.batch();
    computedLines.forEach((line: any, idx: number) => {
      const lineRef = cref.collection("billingLines").doc();
      batch.set(lineRef, {
        id: lineRef.id,
        documentId: docId,
        companyId,
        description: line.description?.trim() || `Línea ${idx + 1}`,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        discountPct: line.discountPct,
        isExempt: Boolean(line.isExempt),
        lineTotal: line.lineTotal,
        createdAt: now,
      });
    });
    await batch.commit();

    // Event
    const eventRef = cref.collection("billingEvents").doc();
    await eventRef.set({
      id: eventRef.id,
      companyId,
      documentId: docId,
      eventType: "created_from_quote",
      title: "Documento creado desde cotización",
      detail: `Documento ${documentNumber} creado desde cotización ${quote.quoteNumber || quoteId}`,
      actorName: request.auth.token.name || "Sistema",
      payload: { quoteId, quoteNumber: quote.quoteNumber },
      occurredAt: now,
    });

    return { success: true, documentId: docId, documentNumber, alreadyExists: false };
  }
);
