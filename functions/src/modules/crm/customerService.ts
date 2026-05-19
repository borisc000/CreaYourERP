import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db } from "../../config";
import { assertCRMAction, crmCors } from "./rbac";

const region = "us-central1";

function nowIso(): string {
  return new Date().toISOString();
}

function companyRef(companyId: string) {
  return db.collection("companies").doc(companyId);
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function serializeDoc(snapshot: FirebaseFirestore.DocumentSnapshot): Record<string, unknown> | null {
  if (!snapshot.exists) return null;
  return { id: snapshot.id, ...snapshot.data() };
}

// ==========================================
// CUSTOMER CRUD
// ==========================================

const customerFields = [
  "name",
  "legalName",
  "taxId",
  "address",
  "city",
  "country",
  "phone",
  "email",
  "contactName",
  "paymentTerms",
  "website",
  "notes",
  "active",
] as const;

function cleanCustomerPayload(data: Record<string, unknown>): Record<string, unknown> {
  const cleaned: Record<string, unknown> = {};
  for (const field of customerFields) {
    if (data[field] !== undefined) {
      cleaned[field] = data[field] === "" ? null : data[field];
    }
  }
  if (cleaned.active !== undefined) cleaned.active = Boolean(cleaned.active);
  return cleaned;
}

export const crmListCustomers = onCall({ region, cors: crmCors }, async (request) => {
  const ctx = await assertCRMAction(request, "service.view_internal");
  const data = (request.data || {}) as Record<string, unknown>;
  const search = asString(data.search).toLowerCase();
  const activeOnly = data.activeOnly !== false;

  let query = companyRef(ctx.companyId).collection("customers").orderBy("name").limit(500);
  if (activeOnly) {
    query = query.where("active", "==", true);
  }

  const snap = await query.get();
  let customers = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

  if (search) {
    customers = customers.filter((c: any) =>
      String(c.name || "").toLowerCase().includes(search) ||
      String(c.taxId || "").toLowerCase().includes(search) ||
      String(c.email || "").toLowerCase().includes(search)
    );
  }

  return { customers };
});

export const crmGetCustomer = onCall({ region, cors: crmCors }, async (request) => {
  const data = (request.data || {}) as Record<string, unknown>;
  const customerId = asString(data.id || data.customerId);
  if (!customerId) throw new HttpsError("invalid-argument", "id requerido");

  const ctx = await assertCRMAction(request, "service.view_internal");
  const snap = await companyRef(ctx.companyId).collection("customers").doc(customerId).get();
  const customer = serializeDoc(snap);
  if (!customer) throw new HttpsError("not-found", "Cliente no encontrado");

  return { customer };
});

export const crmCreateCustomer = onCall({ region, cors: crmCors }, async (request) => {
  const ctx = await assertCRMAction(request, "crm.manage_customers");
  const payload = cleanCustomerPayload((request.data || {}) as Record<string, unknown>);

  if (!asString(payload.name)) {
    throw new HttpsError("invalid-argument", "El nombre es obligatorio");
  }

  const now = nowIso();
  const ref = await companyRef(ctx.companyId).collection("customers").add({
    ...payload,
    companyId: ctx.companyId,
    active: payload.active !== false,
    createdAt: now,
    updatedAt: now,
  });

  return { id: ref.id };
});

export const crmUpdateCustomer = onCall({ region, cors: crmCors }, async (request) => {
  const data = (request.data || {}) as Record<string, unknown>;
  const customerId = asString(data.id);
  if (!customerId) throw new HttpsError("invalid-argument", "id requerido");

  const ctx = await assertCRMAction(request, "crm.manage_customers");
  const payload = cleanCustomerPayload(data);
  if (payload.name !== undefined && !asString(payload.name)) {
    throw new HttpsError("invalid-argument", "El nombre es obligatorio");
  }

  await companyRef(ctx.companyId).collection("customers").doc(customerId).update({
    ...payload,
    updatedAt: nowIso(),
  });

  return { updated: true };
});

export const crmDeleteCustomer = onCall({ region, cors: crmCors }, async (request) => {
  const customerId = asString((request.data || {}).id);
  if (!customerId) throw new HttpsError("invalid-argument", "id requerido");

  const ctx = await assertCRMAction(request, "crm.manage_customers");
  const ref = companyRef(ctx.companyId);

  // Cascade: delete mandantes
  const mandantesSnap = await ref.collection("mandantes").where("customerId", "==", customerId).limit(300).get();
  const batch = db.batch();
  let mandanteCount = 0;
  for (const doc of mandantesSnap.docs) {
    batch.delete(doc.ref);
    mandanteCount++;
  }

  // Unlink leads
  const leadsSnap = await ref.collection("leads").where("customerId", "==", customerId).limit(300).get();
  let leadCount = 0;
  for (const doc of leadsSnap.docs) {
    batch.update(doc.ref, { customerId: null, updatedAt: nowIso() });
    leadCount++;
  }

  // Unlink services
  const servicesSnap = await ref.collection("crmServices").where("customerId", "==", customerId).limit(300).get();
  let serviceCount = 0;
  for (const doc of servicesSnap.docs) {
    batch.update(doc.ref, { customerId: null, updatedAt: nowIso() });
    serviceCount++;
  }

  batch.delete(ref.collection("customers").doc(customerId));
  await batch.commit();

  return { deleted: true, cascade: { mandantes: mandanteCount, leadsUnlinked: leadCount, servicesUnlinked: serviceCount } };
});

// ==========================================
// MANDANTE CRUD
// ==========================================

const mandanteFields = [
  "name",
  "email",
  "phone",
  "position",
  "department",
  "isPrimary",
  "active",
] as const;

function cleanMandantePayload(data: Record<string, unknown>): Record<string, unknown> {
  const cleaned: Record<string, unknown> = {};
  for (const field of mandanteFields) {
    if (data[field] !== undefined) {
      cleaned[field] = data[field] === "" ? null : data[field];
    }
  }
  if (cleaned.isPrimary !== undefined) cleaned.isPrimary = Boolean(cleaned.isPrimary);
  if (cleaned.active !== undefined) cleaned.active = Boolean(cleaned.active);
  return cleaned;
}

export const crmListMandantes = onCall({ region, cors: crmCors }, async (request) => {
  const ctx = await assertCRMAction(request, "service.view_internal");
  const data = (request.data || {}) as Record<string, unknown>;
  const customerId = asString(data.customerId);

  let query = companyRef(ctx.companyId).collection("mandantes").orderBy("name").limit(300);
  if (customerId) {
    query = query.where("customerId", "==", customerId);
  }

  const snap = await query.get();
  return { mandantes: snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) };
});

export const crmGetMandante = onCall({ region, cors: crmCors }, async (request) => {
  const data = (request.data || {}) as Record<string, unknown>;
  const mandanteId = asString(data.id || data.mandanteId);
  if (!mandanteId) throw new HttpsError("invalid-argument", "id requerido");

  const ctx = await assertCRMAction(request, "service.view_internal");
  const snap = await companyRef(ctx.companyId).collection("mandantes").doc(mandanteId).get();
  const mandante = serializeDoc(snap);
  if (!mandante) throw new HttpsError("not-found", "Contacto no encontrado");

  return { mandante };
});

export const crmCreateMandante = onCall({ region, cors: crmCors }, async (request) => {
  const ctx = await assertCRMAction(request, "crm.manage_mandantes");
  const data = (request.data || {}) as Record<string, unknown>;
  const customerId = asString(data.customerId);
  if (!customerId) throw new HttpsError("invalid-argument", "customerId requerido");

  const payload = cleanMandantePayload(data);
  if (!asString(payload.name)) {
    throw new HttpsError("invalid-argument", "El nombre es obligatorio");
  }

  // Verify customer exists
  const customerSnap = await companyRef(ctx.companyId).collection("customers").doc(customerId).get();
  if (!customerSnap.exists) {
    throw new HttpsError("not-found", "Cliente no encontrado");
  }

  const now = nowIso();
  const ref = await companyRef(ctx.companyId).collection("mandantes").add({
    ...payload,
    companyId: ctx.companyId,
    customerId,
    active: payload.active !== false,
    createdAt: now,
    updatedAt: now,
  });

  return { id: ref.id };
});

export const crmUpdateMandante = onCall({ region, cors: crmCors }, async (request) => {
  const data = (request.data || {}) as Record<string, unknown>;
  const mandanteId = asString(data.id);
  if (!mandanteId) throw new HttpsError("invalid-argument", "id requerido");

  const ctx = await assertCRMAction(request, "crm.manage_mandantes");
  const payload = cleanMandantePayload(data);
  if (payload.name !== undefined && !asString(payload.name)) {
    throw new HttpsError("invalid-argument", "El nombre es obligatorio");
  }

  await companyRef(ctx.companyId).collection("mandantes").doc(mandanteId).update({
    ...payload,
    updatedAt: nowIso(),
  });

  return { updated: true };
});

export const crmDeleteMandante = onCall({ region, cors: crmCors }, async (request) => {
  const mandanteId = asString((request.data || {}).id);
  if (!mandanteId) throw new HttpsError("invalid-argument", "id requerido");

  const ctx = await assertCRMAction(request, "crm.manage_mandantes");

  // Unlink from leads
  const ref = companyRef(ctx.companyId);
  const leadsSnap = await ref.collection("leads").where("mandanteId", "==", mandanteId).limit(300).get();
  const batch = db.batch();
  for (const doc of leadsSnap.docs) {
    batch.update(doc.ref, { mandanteId: null, updatedAt: nowIso() });
  }

  // Unlink from services
  const servicesSnap = await ref.collection("crmServices").where("mandanteId", "==", mandanteId).limit(300).get();
  for (const doc of servicesSnap.docs) {
    batch.update(doc.ref, { mandanteId: null, updatedAt: nowIso() });
  }

  batch.delete(ref.collection("mandantes").doc(mandanteId));
  await batch.commit();

  return { deleted: true };
});
