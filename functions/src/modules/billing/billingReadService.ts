import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db } from "../../config";
import { assertAction } from "../../shared/rbac";

const cors = [
  "https://your-erp.web.app",
  "https://your-erp-staging.web.app",
  "https://your-erp-staging.firebaseapp.com",
  "http://localhost:5173",
];

function companyRef(companyId: string) {
  return db.collection("companies").doc(companyId);
}

function nowIso() {
  return new Date().toISOString();
}

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

// ==========================================
// LIST BILLING DOCUMENTS
// ==========================================

export const listBillingDocuments = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "billing.view", { companyId });

    const data = request.data || {};
    const status = cleanString(data.status);
    const siiStatus = cleanString(data.siiStatus);
    const paymentStatus = cleanString(data.paymentStatus);
    const customerId = cleanString(data.customerId);
    const documentType = cleanString(data.documentType);
    const search = cleanString(data.search).toLowerCase();
    const dateFrom = cleanString(data.dateFrom);
    const dateTo = cleanString(data.dateTo);
    const limit = Math.min(500, Math.max(1, Number(data.limit || 200)));

    let q: FirebaseFirestore.Query = companyRef(companyId).collection("billingDocuments").orderBy("createdAt", "desc").limit(limit);
    if (status) q = q.where("status", "==", status);
    if (siiStatus) q = q.where("siiStatus", "==", siiStatus);
    if (paymentStatus) q = q.where("paymentStatus", "==", paymentStatus);
    if (customerId) q = q.where("customerId", "==", customerId);
    if (documentType) q = q.where("documentType", "==", documentType);

    const snap = await q.get();
    let docs = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    if (dateFrom) docs = docs.filter((d: any) => (d.issueDate || d.createdAt || "").slice(0, 10) >= dateFrom);
    if (dateTo) docs = docs.filter((d: any) => (d.issueDate || d.createdAt || "").slice(0, 10) <= dateTo);
    if (search) {
      docs = docs.filter((d: any) =>
        String(d.documentNumber || "").toLowerCase().includes(search) ||
        String(d.customerName || "").toLowerCase().includes(search) ||
        String(d.customerTaxId || "").includes(search)
      );
    }

    return { documents: docs };
  }
);

// ==========================================
// GET BILLING DOCUMENT
// ==========================================

export const getBillingDocument = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "billing.view", { companyId });

    const id = cleanString(request.data?.id || request.data?.documentId);
    if (!id) throw new HttpsError("invalid-argument", "id requerido");

    const cref = companyRef(companyId);
    const snap = await cref.collection("billingDocuments").doc(id).get();
    if (!snap.exists) throw new HttpsError("not-found", "Documento no encontrado");

    const doc = { id: snap.id, ...snap.data() };
    const [linesSnap, eventsSnap] = await Promise.all([
      cref.collection("billingLines").where("documentId", "==", id).get(),
      cref.collection("billingEvents").where("documentId", "==", id).orderBy("occurredAt", "desc").limit(100).get(),
    ]);

    return {
      document: doc,
      lines: linesSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
      events: eventsSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
    };
  }
);

// ==========================================
// DUPLICATE BILLING DOCUMENT
// ==========================================

export const duplicateBillingDocument = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "billing.duplicate_document", { companyId });

    const id = cleanString(request.data?.id || request.data?.documentId);
    if (!id) throw new HttpsError("invalid-argument", "id requerido");

    const cref = companyRef(companyId);
    const snap = await cref.collection("billingDocuments").doc(id).get();
    if (!snap.exists) throw new HttpsError("not-found", "Documento no encontrado");

    const original = snap.data() || {};
    const newDocRef = cref.collection("billingDocuments").doc();
    const now = nowIso();

    const newDocData: Record<string, any> = {
      ...original,
      id: newDocRef.id,
      documentNumber: `${original.documentNumber || "DOC"}-COPY`,
      status: "draft",
      siiStatus: "not_sent",
      paymentStatus: "pending",
      deliveryStatus: "pending",
      paidAmount: 0,
      balanceDue: original.totalAmount || 0,
      sentToCustomerAt: "",
      paidAt: "",
      sourceQuoteId: "",
      sourceReference: original.documentNumber || "",
      createdFrom: "duplicate",
      createdAt: now,
      updatedAt: now,
    };
    // Remove read-only / Firestore internal fields
    delete newDocData._firestore; // not normally present, defensive

    await newDocRef.set(newDocData);

    // Duplicate lines
    const linesSnap = await cref.collection("billingLines").where("documentId", "==", id).get();
    const batch = db.batch();
    for (const lineDoc of linesSnap.docs) {
      const lineData = lineDoc.data();
      const newLineRef = cref.collection("billingLines").doc();
      batch.set(newLineRef, {
        ...lineData,
        id: newLineRef.id,
        documentId: newDocRef.id,
        companyId,
        createdAt: now,
      });
    }
    await batch.commit();

    // Add event
    const eventRef = cref.collection("billingEvents").doc();
    await eventRef.set({
      id: eventRef.id,
      companyId,
      documentId: newDocRef.id,
      eventType: "duplicated",
      title: "Documento duplicado",
      detail: `Duplicado desde ${original.documentNumber}`,
      actorName: request.auth.token.name || "Sistema",
      payload: { originalDocumentId: id },
      occurredAt: now,
    });

    return { duplicated: true, documentId: newDocRef.id };
  }
);

// ==========================================
// REFERENCE DATA
// ==========================================

export const getBillingReferenceData = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "billing.view", { companyId });

    const cref = companyRef(companyId);
    const [customersSnap, paymentMethodsSnap] = await Promise.all([
      cref.collection("customers").orderBy("name").limit(200).get(),
      cref.collection("paymentMethods").orderBy("name").limit(50).get(),
    ]);

    return {
      documentTypes: [
        { code: "33", name: "Factura Electrónica Afecta", label: "Factura Afecta" },
        { code: "34", name: "Factura Electrónica Exenta", label: "Factura Exenta" },
        { code: "61", name: "Nota de Crédito Electrónica", label: "Nota de Crédito" },
        { code: "56", name: "Nota de Débito Electrónica", label: "Nota de Débito" },
      ],
      paymentStatuses: [
        { code: "pending", name: "Pendiente" },
        { code: "partial", name: "Parcial" },
        { code: "paid", name: "Pagado" },
        { code: "overdue", name: "Vencido" },
      ],
      siiStatuses: [
        { code: "not_sent", name: "No enviado" },
        { code: "queued", name: "En cola" },
        { code: "accepted", name: "Aceptado" },
        { code: "observed", name: "Observado" },
        { code: "rejected", name: "Rechazado" },
      ],
      statuses: [
        { code: "draft", name: "Borrador" },
        { code: "issued", name: "Emitido" },
        { code: "void", name: "Anulado" },
      ],
      customers: customersSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
      paymentMethods: paymentMethodsSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
    };
  }
);
