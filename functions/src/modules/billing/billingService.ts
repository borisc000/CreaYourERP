/**
 * Cloud Functions para el módulo de Facturación / Billing (DTE Chile)
 * - getBillingDashboard: Stats, documentos por estado SII, cobranza, vencidos
 * - createBillingDocument: Crea documento con líneas y evento inicial
 * - updateBillingDocument: Actualiza documento editable (draft/observed/rejected)
 * - deleteBillingDocument: Elimina documento no emitido (solo admin)
 * - simulateSii: Simula envío SII según perfil
 * - registerPayment: Registra abono y actualiza estados de pago
 * - sendDocumentToCustomer: Marca enviado al cliente
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db } from "../../config";

function companyRef(companyId: string) {
  return db.collection("companies").doc(companyId);
}

function nowIso() {
  return new Date().toISOString();
}

function paymentStatusFromBalance(balanceDue: number, paidAmount: number, dueDate: string) {
  if (balanceDue <= 0) return "paid";
  if (paidAmount > 0) return "partial";
  const today = new Date().toISOString().split("T")[0];
  if (dueDate < today) return "overdue";
  return "pending";
}

function computeDocumentTotals(
  lines: Array<any>,
  documentType: "33" | "34" | "61" | "56",
  taxRateInput?: number
) {
  const factor = documentType === "61" ? -1 : 1;
  const isExempt = documentType === "34";
  const taxRate = isExempt ? 0 : Math.max(0, taxRateInput || 19);

  let subtotalAmount = 0;
  const computedLines = lines.map((l) => {
    const quantity = Math.max(0, Number(l.quantity) || 0);
    const unitPrice = Math.max(0, Number(l.unitPrice) || 0);
    const discountPct = Math.max(0, Math.min(100, Number(l.discountPct) || 0));
    const lineSub = quantity * unitPrice * (1 - discountPct / 100);
    const lineTotal = Math.round(lineSub * 100) / 100;
    subtotalAmount += lineTotal;
    return {
      ...l,
      quantity,
      unitPrice,
      discountPct,
      lineTotal,
    };
  });

  subtotalAmount = Math.round(subtotalAmount * 100) / 100;
  const taxAmount = Math.round(subtotalAmount * taxRate) / 100;
  const totalAmount = Math.round((subtotalAmount + taxAmount) * factor * 100) / 100;
  const absTotal = Math.abs(totalAmount);

  return {
    lines: computedLines,
    taxRate,
    subtotalAmount: Math.round(subtotalAmount * factor * 100) / 100,
    taxAmount: Math.round(taxAmount * factor * 100) / 100,
    totalAmount,
    balanceDue: absTotal,
    paidAmount: 0,
    factor,
  };
}

async function getCompanyDefaultTaxRate(companyId: string): Promise<number> {
  try {
    const snap = await companyRef(companyId).get();
    return snap.data()?.defaultTaxRate ?? 19;
  } catch {
    return 19;
  }
}

async function addBillingEvent(
  companyId: string,
  documentId: string,
  eventType: string,
  title: string,
  detail?: string,
  actorName?: string,
  payload?: Record<string, any>
) {
  const ref = companyRef(companyId).collection("billingEvents").doc();
  await ref.set({
    id: ref.id,
    companyId,
    documentId,
    eventType,
    title,
    detail: detail || "",
    actorName: actorName || "Sistema",
    payload: payload || {},
    occurredAt: nowIso(),
  });
  return ref.id;
}

// ==========================================
// getBillingDashboard
// ==========================================

export const getBillingDashboard = onCall(
  {
    region: "us-central1",
    cors: ["https://your-erp.web.app", "http://localhost:5173"],
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }
    const companyId = request.auth.token.companyId;
    if (!companyId) {
      throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    }

    try {
      const cref = companyRef(companyId);
      const docsSnap = await cref.collection("billingDocuments").limit(500).get();
      const docs = docsSnap.docs.map((d) => d.data() as any);

      const totalDocuments = docs.length;
      const siiCounts = {
        not_sent: 0,
        queued: 0,
        accepted: 0,
        observed: 0,
        rejected: 0,
      };
      let pendingCollection = 0;
      let overdueCount = 0;
      let currentMonthTotal = 0;
      const today = new Date().toISOString().split("T")[0];
      const currentMonthPrefix = today.substring(0, 7);

      docs.forEach((d) => {
        const s = d.siiStatus || "not_sent";
        if (siiCounts[s as keyof typeof siiCounts] !== undefined) {
          siiCounts[s as keyof typeof siiCounts]++;
        }
        if ((d.paymentStatus === "pending" || d.paymentStatus === "partial" || d.paymentStatus === "overdue") && d.balanceDue > 0 && d.totalAmount > 0) {
          pendingCollection += d.balanceDue || 0;
        }
        if (d.dueDate < today && d.balanceDue > 0 && d.totalAmount > 0) {
          overdueCount++;
        }
        if (d.issueDate && d.issueDate.startsWith(currentMonthPrefix)) {
          currentMonthTotal += d.totalAmount || 0;
        }
      });

      const recentDocuments = docs
        .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))
        .slice(0, 10)
        .map((d) => ({
          id: d.id,
          documentNumber: d.documentNumber,
          documentType: d.documentType,
          customerName: d.customerName,
          totalAmount: d.totalAmount,
          status: d.status,
          siiStatus: d.siiStatus,
          paymentStatus: d.paymentStatus,
          issueDate: d.issueDate,
          dueDate: d.dueDate,
        }));

      const overdueDocuments = docs
        .filter((d) => d.dueDate < today && d.balanceDue > 0 && d.totalAmount > 0)
        .sort((a, b) => (a.dueDate || "").localeCompare(b.dueDate || ""))
        .slice(0, 10)
        .map((d) => ({
          id: d.id,
          documentNumber: d.documentNumber,
          customerName: d.customerName,
          balanceDue: d.balanceDue,
          dueDate: d.dueDate,
        }));

      return {
        stats: {
          totalDocuments,
          siiCounts,
          pendingCollection: Math.round(pendingCollection * 100) / 100,
          overdueCount,
          currentMonthTotal: Math.round(currentMonthTotal * 100) / 100,
        },
        recentDocuments,
        overdueDocuments,
      };
    } catch (error: any) {
      console.error("[getBillingDashboard] Error:", error);
      throw new HttpsError("internal", error.message || "Error al obtener dashboard");
    }
  }
);

// ==========================================
// createBillingDocument
// ==========================================

interface BillingLineInput {
  description: string;
  quantity: number;
  unitPrice: number;
  discountPct?: number;
  isExempt?: boolean;
}

interface CreateBillingDocumentPayload {
  documentNumber: string;
  documentType: "33" | "34" | "61" | "56";
  customerId?: string;
  customerName: string;
  customerTaxId?: string;
  customerEmail?: string;
  customerContactName?: string;
  sourceQuoteId?: string;
  sourceReference?: string;
  createdFrom: string;
  referenceDocumentId?: string;
  referenceDocumentNumber?: string;
  referenceDocumentType?: string;
  correctionMode?: string;
  correctionReason?: string;
  issueDate: string;
  dueDate: string;
  paymentTerms?: string;
  currency?: string;
  taxRate?: number;
  customerMessage?: string;
  internalNotes?: string;
  lines: BillingLineInput[];
}

export const createBillingDocument = onCall(
  {
    region: "us-central1",
    cors: ["https://your-erp.web.app", "http://localhost:5173"],
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }
    const companyId = request.auth.token.companyId;
    if (!companyId) {
      throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    }

    const payload = request.data as CreateBillingDocumentPayload;
    if (!payload.documentNumber?.trim() || !payload.documentType || !payload.customerName?.trim() || !payload.issueDate || !payload.dueDate) {
      throw new HttpsError("invalid-argument", "Número de documento, tipo, nombre de cliente, fecha de emisión y vencimiento son requeridos");
    }
    if (!payload.lines || payload.lines.length === 0) {
      throw new HttpsError("invalid-argument", "El documento debe tener al menos una línea");
    }
    if ((payload.documentType === "61" || payload.documentType === "56") && (!payload.referenceDocumentId || !payload.referenceDocumentNumber)) {
      throw new HttpsError("invalid-argument", "Notas de crédito/débito requieren documento de referencia");
    }

    try {
      const cref = companyRef(companyId);
      const docRef = cref.collection("billingDocuments").doc();
      const docId = docRef.id;
      const now = nowIso();
      const defaultTax = await getCompanyDefaultTaxRate(companyId);

      const totals = computeDocumentTotals(payload.lines, payload.documentType, payload.taxRate ?? defaultTax);

      const docData: Record<string, any> = {
        id: docId,
        companyId,
        documentNumber: payload.documentNumber.trim(),
        documentType: payload.documentType,
        customerId: payload.customerId || "",
        customerName: payload.customerName.trim(),
        customerTaxId: payload.customerTaxId?.trim() || "",
        customerEmail: payload.customerEmail?.trim() || "",
        customerContactName: payload.customerContactName?.trim() || "",
        sourceQuoteId: payload.sourceQuoteId || "",
        sourceReference: payload.sourceReference || "",
        createdFrom: payload.createdFrom || "manual",
        referenceDocumentId: payload.referenceDocumentId || "",
        referenceDocumentNumber: payload.referenceDocumentNumber || "",
        referenceDocumentType: payload.referenceDocumentType || "",
        correctionMode: payload.correctionMode || "",
        correctionReason: payload.correctionReason || "",
        issueDate: payload.issueDate,
        dueDate: payload.dueDate,
        paymentTerms: payload.paymentTerms || "",
        currency: payload.currency || "CLP",
        status: "draft",
        siiStatus: "not_sent",
        paymentStatus: "pending",
        deliveryStatus: "pending",
        taxRate: totals.taxRate,
        subtotalAmount: totals.subtotalAmount,
        taxAmount: totals.taxAmount,
        totalAmount: totals.totalAmount,
        paidAmount: 0,
        balanceDue: totals.balanceDue,
        customerMessage: payload.customerMessage || "",
        internalNotes: payload.internalNotes || "",
        sentToCustomerAt: "",
        paidAt: "",
        createdAt: now,
        updatedAt: now,
      };

      await docRef.set(docData);

      // Create lines in subcollection
      const batch = db.batch();
      totals.lines.forEach((line, idx) => {
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

      await addBillingEvent(companyId, docId, "created", "Documento creado", `Documento ${payload.documentNumber} creado como borrador`, request.auth.token.name || "");

      return { success: true, documentId: docId };
    } catch (error: any) {
      console.error("[createBillingDocument] Error:", error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", error.message || "Error al crear documento");
    }
  }
);

// ==========================================
// updateBillingDocument
// ==========================================

interface UpdateBillingDocumentPayload {
  documentId: string;
  customerName?: string;
  customerTaxId?: string;
  customerEmail?: string;
  customerContactName?: string;
  referenceDocumentId?: string;
  referenceDocumentNumber?: string;
  referenceDocumentType?: string;
  correctionMode?: string;
  correctionReason?: string;
  issueDate?: string;
  dueDate?: string;
  paymentTerms?: string;
  customerMessage?: string;
  internalNotes?: string;
  taxRate?: number;
  lines?: BillingLineInput[];
}

export const updateBillingDocument = onCall(
  {
    region: "us-central1",
    cors: ["https://your-erp.web.app", "http://localhost:5173"],
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }
    const companyId = request.auth.token.companyId;
    if (!companyId) {
      throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    }

    const payload = request.data as UpdateBillingDocumentPayload;
    if (!payload.documentId) {
      throw new HttpsError("invalid-argument", "documentId es requerido");
    }

    try {
      const cref = companyRef(companyId);
      const docRef = cref.collection("billingDocuments").doc(payload.documentId);
      const snap = await docRef.get();
      if (!snap.exists) {
        throw new HttpsError("not-found", "Documento no encontrado");
      }
      const current = snap.data() as any;
      const editableStatuses = ["draft", "observed", "rejected"];
      if (!editableStatuses.includes(current.status)) {
        throw new HttpsError("failed-precondition", "No se puede editar un documento emitido o pagado");
      }

      const now = nowIso();
      const updateData: Record<string, any> = { updatedAt: now };

      if (payload.customerName !== undefined) updateData.customerName = payload.customerName.trim();
      if (payload.customerTaxId !== undefined) updateData.customerTaxId = payload.customerTaxId.trim();
      if (payload.customerEmail !== undefined) updateData.customerEmail = payload.customerEmail.trim();
      if (payload.customerContactName !== undefined) updateData.customerContactName = payload.customerContactName.trim();
      if (payload.referenceDocumentId !== undefined) updateData.referenceDocumentId = payload.referenceDocumentId;
      if (payload.referenceDocumentNumber !== undefined) updateData.referenceDocumentNumber = payload.referenceDocumentNumber;
      if (payload.referenceDocumentType !== undefined) updateData.referenceDocumentType = payload.referenceDocumentType;
      if (payload.correctionMode !== undefined) updateData.correctionMode = payload.correctionMode;
      if (payload.correctionReason !== undefined) updateData.correctionReason = payload.correctionReason;
      if (payload.issueDate !== undefined) updateData.issueDate = payload.issueDate;
      if (payload.dueDate !== undefined) updateData.dueDate = payload.dueDate;
      if (payload.paymentTerms !== undefined) updateData.paymentTerms = payload.paymentTerms;
      if (payload.customerMessage !== undefined) updateData.customerMessage = payload.customerMessage;
      if (payload.internalNotes !== undefined) updateData.internalNotes = payload.internalNotes;

      // Recalculate if lines changed
      if (payload.lines && payload.lines.length > 0) {
        const taxRate = payload.taxRate !== undefined ? payload.taxRate : current.taxRate;
        const totals = computeDocumentTotals(payload.lines, current.documentType, taxRate);
        updateData.taxRate = totals.taxRate;
        updateData.subtotalAmount = totals.subtotalAmount;
        updateData.taxAmount = totals.taxAmount;
        updateData.totalAmount = totals.totalAmount;
        updateData.balanceDue = totals.balanceDue;
        updateData.paidAmount = current.paidAmount || 0;

        // Replace lines
        const existingLinesSnap = await cref.collection("billingLines").where("documentId", "==", payload.documentId).get();
        const batch = db.batch();
        existingLinesSnap.docs.forEach((d) => batch.delete(d.ref));
        totals.lines.forEach((line, idx) => {
          const lineRef = cref.collection("billingLines").doc();
          batch.set(lineRef, {
            id: lineRef.id,
            documentId: payload.documentId,
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
      } else if (payload.taxRate !== undefined) {
        // Only tax rate changed, recalc with existing lines
        const linesSnap = await cref.collection("billingLines").where("documentId", "==", payload.documentId).get();
        const existingLines = linesSnap.docs.map((d) => d.data() as BillingLineInput);
        const totals = computeDocumentTotals(existingLines, current.documentType, payload.taxRate);
        updateData.taxRate = totals.taxRate;
        updateData.subtotalAmount = totals.subtotalAmount;
        updateData.taxAmount = totals.taxAmount;
        updateData.totalAmount = totals.totalAmount;
        updateData.balanceDue = totals.balanceDue;
        updateData.paidAmount = current.paidAmount || 0;
      }

      await docRef.update(updateData);
      await addBillingEvent(companyId, payload.documentId, "updated", "Documento actualizado", "Se actualizaron los datos del documento", request.auth.token.name || "");

      return { success: true, documentId: payload.documentId };
    } catch (error: any) {
      console.error("[updateBillingDocument] Error:", error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", error.message || "Error al actualizar documento");
    }
  }
);

// ==========================================
// deleteBillingDocument
// ==========================================

interface DeleteBillingDocumentPayload {
  documentId: string;
}

export const deleteBillingDocument = onCall(
  {
    region: "us-central1",
    cors: ["https://your-erp.web.app", "http://localhost:5173"],
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }
    const companyId = request.auth.token.companyId;
    if (!companyId) {
      throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    }
    if (request.auth.token.role !== "admin") {
      throw new HttpsError("permission-denied", "Solo administradores pueden eliminar documentos");
    }

    const { documentId } = request.data as DeleteBillingDocumentPayload;
    if (!documentId) {
      throw new HttpsError("invalid-argument", "documentId es requerido");
    }

    try {
      const cref = companyRef(companyId);
      const docRef = cref.collection("billingDocuments").doc(documentId);
      const snap = await docRef.get();
      if (!snap.exists) {
        throw new HttpsError("not-found", "Documento no encontrado");
      }
      const data = snap.data() as any;
      if (data.status === "issued" || data.siiStatus === "accepted") {
        throw new HttpsError("failed-precondition", "No se pueden eliminar documentos emitidos o aceptados por el SII");
      }

      const batch = db.batch();
      batch.delete(docRef);

      const linesSnap = await cref.collection("billingLines").where("documentId", "==", documentId).get();
      linesSnap.docs.forEach((d) => batch.delete(d.ref));

      const eventsSnap = await cref.collection("billingEvents").where("documentId", "==", documentId).get();
      eventsSnap.docs.forEach((d) => batch.delete(d.ref));

      await batch.commit();
      return { success: true };
    } catch (error: any) {
      console.error("[deleteBillingDocument] Error:", error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", error.message || "Error al eliminar documento");
    }
  }
);

// ==========================================
// simulateSii
// ==========================================

interface SimulateSiiPayload {
  documentId: string;
  profile: "auto_accept" | "observed_then_accept" | "rejected_then_accept" | "manual";
}

export const simulateSii = onCall(
  {
    region: "us-central1",
    cors: ["https://your-erp.web.app", "http://localhost:5173"],
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }
    const companyId = request.auth.token.companyId;
    if (!companyId) {
      throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    }

    const payload = request.data as SimulateSiiPayload;
    if (!payload.documentId || !payload.profile) {
      throw new HttpsError("invalid-argument", "documentId y profile son requeridos");
    }

    try {
      const cref = companyRef(companyId);
      const docRef = cref.collection("billingDocuments").doc(payload.documentId);
      const snap = await docRef.get();
      if (!snap.exists) {
        throw new HttpsError("not-found", "Documento no encontrado");
      }
      const doc = snap.data() as any;
      if (doc.siiStatus === "accepted") {
        throw new HttpsError("failed-precondition", "El documento ya fue aceptado por el SII");
      }

      const now = nowIso();
      let newSiiStatus = doc.siiStatus;
      let newStatus = doc.status;
      let eventTitle = "";
      let eventDetail = "";

      switch (payload.profile) {
        case "auto_accept":
          newSiiStatus = "accepted";
          newStatus = "issued";
          eventTitle = "SII - Aceptado";
          eventDetail = "El documento fue aceptado automáticamente por el SII (simulación)";
          break;
        case "observed_then_accept":
          if (doc.siiStatus === "observed") {
            newSiiStatus = "accepted";
            newStatus = "issued";
            eventTitle = "SII - Observación resuelta";
            eventDetail = "El documento fue aceptado tras resolver observaciones";
          } else {
            newSiiStatus = "observed";
            newStatus = "observed";
            eventTitle = "SII - Observado";
            eventDetail = "El SII observó el documento; requiere corrección";
          }
          break;
        case "rejected_then_accept":
          if (doc.siiStatus === "rejected") {
            newSiiStatus = "accepted";
            newStatus = "issued";
            eventTitle = "SII - Rechazo revertido";
            eventDetail = "El documento fue aceptado tras corregir el rechazo";
          } else {
            newSiiStatus = "rejected";
            newStatus = "rejected";
            eventTitle = "SII - Rechazado";
            eventDetail = "El SII rechazó el documento; edítalo y reenvía";
          }
          break;
        case "manual":
          newSiiStatus = "queued";
          eventTitle = "SII - En cola";
          eventDetail = "El documento fue puesto en cola de envío al SII";
          break;
      }

      await docRef.update({
        siiStatus: newSiiStatus,
        status: newStatus,
        updatedAt: now,
      });

      await addBillingEvent(companyId, payload.documentId, "sii_simulated", eventTitle, eventDetail, request.auth.token.name || "", { profile: payload.profile, newSiiStatus });

      return { success: true, siiStatus: newSiiStatus, status: newStatus };
    } catch (error: any) {
      console.error("[simulateSii] Error:", error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", error.message || "Error al simular SII");
    }
  }
);

// ==========================================
// registerPayment
// ==========================================

interface RegisterPaymentPayload {
  documentId: string;
  amount: number;
  paymentMethod?: string;
  notes?: string;
  paidAt?: string;
}

export const registerPayment = onCall(
  {
    region: "us-central1",
    cors: ["https://your-erp.web.app", "http://localhost:5173"],
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }
    const companyId = request.auth.token.companyId;
    if (!companyId) {
      throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    }

    const payload = request.data as RegisterPaymentPayload;
    if (!payload.documentId || payload.amount === undefined || payload.amount === null) {
      throw new HttpsError("invalid-argument", "documentId y amount son requeridos");
    }
    const amount = Math.max(0, Number(payload.amount) || 0);
    if (amount <= 0) {
      throw new HttpsError("invalid-argument", "El monto debe ser mayor a 0");
    }

    try {
      const cref = companyRef(companyId);
      const docRef = cref.collection("billingDocuments").doc(payload.documentId);
      const snap = await docRef.get();
      if (!snap.exists) {
        throw new HttpsError("not-found", "Documento no encontrado");
      }
      const doc = snap.data() as any;
      const absoluteTotal = Math.abs(doc.totalAmount || 0);
      const currentPaid = doc.paidAmount || 0;
      const newPaid = currentPaid + amount;
      let balanceDue = Math.round((absoluteTotal - newPaid) * 100) / 100;
      if (balanceDue < 0) balanceDue = 0;

      const today = new Date().toISOString().split("T")[0];
      const newPaymentStatus = paymentStatusFromBalance(balanceDue, newPaid, doc.dueDate || today);
      const paidAt = newPaymentStatus === "paid" ? (payload.paidAt || nowIso()) : doc.paidAt || "";

      await docRef.update({
        paidAmount: Math.round(newPaid * 100) / 100,
        balanceDue,
        paymentStatus: newPaymentStatus,
        paidAt,
        updatedAt: nowIso(),
      });

      await addBillingEvent(
        companyId,
        payload.documentId,
        "payment_registered",
        "Pago registrado",
        `Abono de $${amount.toLocaleString("es-CL")}${payload.notes ? ` - ${payload.notes}` : ""}`,
        request.auth.token.name || "",
        { amount, paymentMethod: payload.paymentMethod || "", newBalance: balanceDue }
      );

      return { success: true, paidAmount: newPaid, balanceDue, paymentStatus: newPaymentStatus };
    } catch (error: any) {
      console.error("[registerPayment] Error:", error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", error.message || "Error al registrar pago");
    }
  }
);

// ==========================================
// sendDocumentToCustomer
// ==========================================

interface SendDocumentPayload {
  documentId: string;
}

export const sendDocumentToCustomer = onCall(
  {
    region: "us-central1",
    cors: ["https://your-erp.web.app", "http://localhost:5173"],
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }
    const companyId = request.auth.token.companyId;
    if (!companyId) {
      throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    }

    const { documentId } = request.data as SendDocumentPayload;
    if (!documentId) {
      throw new HttpsError("invalid-argument", "documentId es requerido");
    }

    try {
      const cref = companyRef(companyId);
      const docRef = cref.collection("billingDocuments").doc(documentId);
      const snap = await docRef.get();
      if (!snap.exists) {
        throw new HttpsError("not-found", "Documento no encontrado");
      }

      const now = nowIso();
      await docRef.update({
        sentToCustomerAt: now,
        deliveryStatus: "sent",
        updatedAt: now,
      });

      await addBillingEvent(companyId, documentId, "sent_to_customer", "Enviado al cliente", "El documento fue enviado al cliente", request.auth.token.name || "");

      return { success: true, sentAt: now };
    } catch (error: any) {
      console.error("[sendDocumentToCustomer] Error:", error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", error.message || "Error al enviar documento");
    }
  }
);
