import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db, storage } from "../../config";
import { assertCRMAction, crmCors, type CRMAuthContext, type ServiceAction } from "./rbac";

const region = "us-central1";
const maxUploadBytes = 20 * 1024 * 1024;
const publicDocumentTypes = new Set([
  "po_oc",
  "contrato",
  "factura",
  "respaldo",
  "operativo",
  "preventivo",
  "reporte_firmado",
]);

const leadFields = [
  "title",
  "description",
  "customerId",
  "mandanteId",
  "stageId",
  "serviceTypeId",
  "assignedTo",
  "priority",
  "status",
  "expectedRevenue",
  "probability",
  "expectedCloseDate",
  "visitDate",
  "quoteDeadline",
  "source",
  "serviceName",
  "empresaFaena",
  "aprName",
  "supervisorName",
  "contractAdminName",
  "poNumber",
  "reportNumber",
  "hesNumber",
  "invoiceNumber",
  "isPaid",
  "reportAreaId",
  "reportSectorId",
] as const;

function nowIso(): string {
  return new Date().toISOString();
}

function companyRef(companyId: string) {
  return db.collection("companies").doc(companyId);
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asOptionalString(value: unknown): string | null {
  const text = asString(value);
  return text || null;
}

function sanitizeFilename(filename: string): string {
  return filename.replace(/[^\w.\-() ]+/g, "_").slice(0, 180) || "documento";
}

function normalizeModelName(modelName: unknown): "Lead" | "Service" | "Customer" {
  const normalized = asString(modelName).toLowerCase();
  if (normalized === "lead") return "Lead";
  if (normalized === "service") return "Service";
  if (normalized === "customer") return "Customer";
  throw new HttpsError("invalid-argument", "modelName debe ser Lead, Service o Customer");
}

function serializeDoc(snapshot: FirebaseFirestore.DocumentSnapshot): Record<string, unknown> | null {
  if (!snapshot.exists) return null;
  return { id: snapshot.id, ...snapshot.data() };
}

function sortByCreatedDesc(items: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
  return items.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
}

function cleanLeadPayload(data: Record<string, unknown>): Record<string, unknown> {
  const cleaned: Record<string, unknown> = {};
  for (const field of leadFields) {
    if (data[field] !== undefined) {
      cleaned[field] = data[field] === "" ? null : data[field];
    }
  }
  if (cleaned.expectedRevenue !== undefined) cleaned.expectedRevenue = Number(cleaned.expectedRevenue || 0);
  if (cleaned.probability !== undefined) cleaned.probability = Number(cleaned.probability || 0);
  if (cleaned.isPaid !== undefined) cleaned.isPaid = Boolean(cleaned.isPaid);
  return cleaned;
}

function buildStatusSnapshot(lead: Record<string, unknown>, existingService?: Record<string, unknown>) {
  const financialStatus = lead.isPaid
    ? "paid"
    : lead.invoiceNumber
      ? "invoiced"
      : lead.hesNumber
        ? "hes_requested"
        : lead.status === "won"
          ? "pending_billing"
          : "pre_sale";
  const commercialStatus = lead.status === "won" ? "won" : String(existingService?.commercialStatus || "intake");
  const operationalStatus = String(existingService?.operationalStatus || "not_started");

  return {
    commercialStatus,
    operationalStatus,
    financialStatus,
    updatedAt: nowIso(),
  };
}

function buildServicePayload(lead: Record<string, unknown>, existingService?: Record<string, unknown>) {
  const serviceCode =
    asString(existingService?.serviceCode) ||
    asString(lead.projectCode) ||
    `SRV-${asString(lead.id).slice(-6).toUpperCase() || "000000"}`;
  const statusSnapshot = buildStatusSnapshot(lead, existingService);

  return {
    leadId: lead.id,
    companyId: lead.companyId,
    customerId: lead.customerId || null,
    mandanteId: lead.mandanteId || null,
    serviceTypeId: lead.serviceTypeId || null,
    acceptedQuoteId: existingService?.acceptedQuoteId || null,
    serviceCode,
    title: asString(lead.title) || "Servicio sin titulo",
    description: asString(lead.description),
    serviceName: asString(lead.serviceName) || asString(lead.title),
    empresaFaena: asString(lead.empresaFaena),
    aprName: asString(lead.aprName),
    supervisorName: asString(lead.supervisorName),
    contractAdminName: asString(lead.contractAdminName),
    commercialStatus: statusSnapshot.commercialStatus,
    operationalStatus: statusSnapshot.operationalStatus,
    financialStatus: statusSnapshot.financialStatus,
    statusSnapshot,
    contextSnapshot: {
      projectCode: asString(lead.projectCode),
      serviceName: asString(lead.serviceName),
      empresaFaena: asString(lead.empresaFaena),
      aprName: asString(lead.aprName),
      supervisorName: asString(lead.supervisorName),
      contractAdminName: asString(lead.contractAdminName),
      expectedRevenue: Number(lead.expectedRevenue || 0),
      poNumber: asString(lead.poNumber),
      reportNumber: asString(lead.reportNumber),
      hesNumber: asString(lead.hesNumber),
      invoiceNumber: asString(lead.invoiceNumber),
      isPaid: Boolean(lead.isPaid),
    },
    operationalControl: existingService?.operationalControl || {},
    mirrorEnabled: existingService?.mirrorEnabled ?? true,
    active: existingService?.active ?? true,
  };
}

async function getLead(companyId: string, leadId: string): Promise<Record<string, unknown>> {
  const snap = await companyRef(companyId).collection("leads").doc(leadId).get();
  const lead = serializeDoc(snap);
  if (!lead) throw new HttpsError("not-found", "Oportunidad no encontrada");
  return lead;
}

async function getService(companyId: string, serviceId: string): Promise<Record<string, unknown>> {
  const snap = await companyRef(companyId).collection("crmServices").doc(serviceId).get();
  const service = serializeDoc(snap);
  if (!service) throw new HttpsError("not-found", "Servicio no encontrado");
  return service;
}

async function findServiceByLead(companyId: string, leadId: string): Promise<Record<string, unknown> | null> {
  const snap = await companyRef(companyId).collection("crmServices").where("leadId", "==", leadId).limit(1).get();
  if (snap.empty) return null;
  return { id: snap.docs[0].id, ...snap.docs[0].data() };
}

async function ensureCRMServiceForLead(companyId: string, lead: Record<string, unknown>): Promise<Record<string, unknown>> {
  const existing = await findServiceByLead(companyId, String(lead.id));
  const payload = buildServicePayload(lead, existing || undefined);

  if (!existing) {
    const ref = companyRef(companyId).collection("crmServices").doc();
    const data = { ...payload, createdAt: nowIso(), updatedAt: nowIso() };
    await ref.set(data);
    return { id: ref.id, ...data };
  }

  await companyRef(companyId).collection("crmServices").doc(String(existing.id)).update({
    ...payload,
    updatedAt: nowIso(),
  });
  return { ...existing, ...payload, updatedAt: nowIso() };
}

async function getOptionalDoc(companyId: string, collectionName: string, id: unknown): Promise<Record<string, unknown> | null> {
  const docId = asString(id);
  if (!docId) return null;
  const snap = await companyRef(companyId).collection(collectionName).doc(docId).get();
  return serializeDoc(snap);
}

async function getCollectionByLead(companyId: string, collectionName: string, leadId: string, limit = 200) {
  const snap = await companyRef(companyId).collection(collectionName).where("leadId", "==", leadId).limit(limit).get();
  return sortByCreatedDesc(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
}

async function addActivity(
  companyId: string,
  leadId: string,
  ctx: CRMAuthContext,
  type: string,
  message: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  await companyRef(companyId).collection("activityLogs").add({
    companyId,
    leadId,
    type,
    message,
    userId: ctx.uid,
    userName: ctx.name,
    metadata: metadata || {},
    createdAt: nowIso(),
  });
}

async function deleteQuery(
  query: FirebaseFirestore.Query,
  onDoc?: (doc: FirebaseFirestore.QueryDocumentSnapshot) => Promise<void>
): Promise<number> {
  const snap = await query.limit(300).get();
  const batch = db.batch();
  let count = 0;

  for (const doc of snap.docs) {
    if (onDoc) await onDoc(doc);
    batch.delete(doc.ref);
    count += 1;
  }

  if (count > 0) await batch.commit();
  return count;
}

async function resolveDocumentScope(companyId: string, document: Record<string, unknown>) {
  let service: Record<string, unknown> | null = null;
  let lead: Record<string, unknown> | null = null;
  const modelName = asString(document.modelName).toLowerCase();
  const serviceId = asString(document.serviceId) || (modelName === "service" ? asString(document.recordId) : "");

  if (serviceId) {
    service = await getOptionalDoc(companyId, "crmServices", serviceId);
  }
  const leadId = asString(document.leadId) || asString(service?.leadId) || (modelName === "lead" ? asString(document.recordId) : "");
  if (leadId) {
    lead = await getOptionalDoc(companyId, "leads", leadId);
  }

  return { lead, service };
}

function documentVisibleInMirror(document: Record<string, unknown>): boolean {
  if (document.status && document.status !== "ready") return false;
  if (document.isCurrent === false) return false;
  if (document.publishToMirror === true) return true;

  const metadata = (document.metadata || {}) as Record<string, unknown>;
  if (metadata.publishToMirror === false) return false;
  if (metadata.publishToMirror === true) return true;

  const documentType = asString(document.documentType || document.category) || "general";
  return publicDocumentTypes.has(documentType);
}

async function getDocumentsForRecord(companyId: string, modelName: string, recordId: string, serviceId?: string, leadId?: string) {
  const docsById = new Map<string, Record<string, unknown>>();
  const byRecord = await companyRef(companyId)
    .collection("crmDocuments")
    .where("modelName", "==", modelName)
    .where("recordId", "==", recordId)
    .limit(300)
    .get();
  byRecord.docs.forEach((doc) => docsById.set(doc.id, { id: doc.id, ...doc.data() }));

  if (serviceId) {
    const byService = await companyRef(companyId).collection("crmDocuments").where("serviceId", "==", serviceId).limit(300).get();
    byService.docs.forEach((doc) => docsById.set(doc.id, { id: doc.id, ...doc.data() }));
  }
  if (leadId) {
    const byLead = await companyRef(companyId).collection("crmDocuments").where("leadId", "==", leadId).limit(300).get();
    byLead.docs.forEach((doc) => docsById.set(doc.id, { id: doc.id, ...doc.data() }));
  }

  return sortByCreatedDesc(Array.from(docsById.values()));
}

async function assertDocumentAction(
  request: Parameters<typeof assertCRMAction>[0],
  action: ServiceAction,
  document: Record<string, unknown>
): Promise<CRMAuthContext> {
  const ctx = await assertCRMAction(request, action, { companyId: document.companyId });
  const scope = await resolveDocumentScope(ctx.companyId, document);
  if (scope.service) await assertCRMAction(request, action, scope.service);
  if (!scope.service && scope.lead) await assertCRMAction(request, action, scope.lead);
  return ctx;
}

export const crmCreateLead = onCall({ region, cors: crmCors }, async (request) => {
  const ctx = await assertCRMAction(request, "crm.create_lead");
  const payload = cleanLeadPayload((request.data || {}) as Record<string, unknown>);
  if (!asString(payload.title)) {
    throw new HttpsError("invalid-argument", "El titulo es obligatorio");
  }

  const now = nowIso();
  const ref = await companyRef(ctx.companyId).collection("leads").add({
    ...payload,
    companyId: ctx.companyId,
    priority: payload.priority || "medium",
    status: payload.status || "open",
    expectedRevenue: Number(payload.expectedRevenue || 0),
    probability: Number(payload.probability || 0),
    isPaid: Boolean(payload.isPaid),
    createdBy: ctx.uid,
    updatedBy: ctx.uid,
    createdAt: now,
    updatedAt: now,
  });

  await addActivity(ctx.companyId, ref.id, ctx, "created", "Oportunidad creada");
  return { id: ref.id };
});

export const crmUpdateLead = onCall({ region, cors: crmCors }, async (request) => {
  const data = (request.data || {}) as Record<string, unknown>;
  const leadId = asString(data.id);
  if (!leadId) throw new HttpsError("invalid-argument", "id requerido");

  const ctx = await assertCRMAction(request, "crm.edit_lead");
  const lead = await getLead(ctx.companyId, leadId);
  await assertCRMAction(request, "crm.edit_lead", lead);

  const payload = cleanLeadPayload(data);
  if (payload.title !== undefined && !asString(payload.title)) {
    throw new HttpsError("invalid-argument", "El titulo es obligatorio");
  }

  await companyRef(ctx.companyId).collection("leads").doc(leadId).update({
    ...payload,
    updatedBy: ctx.uid,
    updatedAt: nowIso(),
  });

  return { updated: true };
});

export const crmDeleteLeadCascade = onCall({ region, cors: crmCors }, async (request) => {
  const leadId = asString((request.data || {}).id);
  if (!leadId) throw new HttpsError("invalid-argument", "id requerido");

  const ctx = await assertCRMAction(request, "crm.delete_lead");
  const lead = await getLead(ctx.companyId, leadId);
  await assertCRMAction(request, "crm.delete_lead", lead);
  const ref = companyRef(ctx.companyId);

  const cascade: Record<string, number> = {};
  cascade.activityLogs = await deleteQuery(ref.collection("activityLogs").where("leadId", "==", leadId));
  cascade.notes = await deleteQuery(ref.collection("leadNotes").where("leadId", "==", leadId));
  cascade.quotes = await deleteQuery(ref.collection("quotes").where("leadId", "==", leadId));
  cascade.serviceOrders = await deleteQuery(ref.collection("serviceOrders").where("leadId", "==", leadId));
  cascade.services = await deleteQuery(ref.collection("crmServices").where("leadId", "==", leadId));
  cascade.documents = await deleteQuery(ref.collection("crmDocuments").where("leadId", "==", leadId), async (doc) => {
    const storagePath = asString(doc.data().storagePath || doc.data().filePath);
    if (storagePath) {
      await storage.bucket().file(storagePath).delete({ ignoreNotFound: true });
    }
  });

  await ref.collection("leads").doc(leadId).delete();
  return { deleted: true, cascade };
});

export const crmGetLeadDossier = onCall({ region, cors: crmCors }, async (request) => {
  const leadId = asString((request.data || {}).leadId || (request.data || {}).id);
  if (!leadId) throw new HttpsError("invalid-argument", "leadId requerido");

  const ctx = await assertCRMAction(request, "service.view_internal");
  const lead = await getLead(ctx.companyId, leadId);
  await assertCRMAction(request, "service.view_internal", lead);
  const service = await ensureCRMServiceForLead(ctx.companyId, lead);
  const documents = await getDocumentsForRecord(ctx.companyId, "Lead", leadId, asString(service.id), leadId);
  const quotes = await getCollectionByLead(ctx.companyId, "quotes", leadId);
  const reports = await getCollectionByLead(ctx.companyId, "reports", leadId);
  const expenses = await getCollectionByLead(ctx.companyId, "expenses", leadId);
  const rentals = await getCollectionByLead(ctx.companyId, "rentalContracts", leadId);
  const safetyFolders = await getCollectionByLead(ctx.companyId, "safetyFolders", leadId);
  const activity = await getCollectionByLead(ctx.companyId, "activityLogs", leadId, 100);
  const notes = await getCollectionByLead(ctx.companyId, "leadNotes", leadId, 100);
  const customer = await getOptionalDoc(ctx.companyId, "customers", lead.customerId);
  const mandante = await getOptionalDoc(ctx.companyId, "mandantes", lead.mandanteId);
  const stage = await getOptionalDoc(ctx.companyId, "stages", lead.stageId);
  const serviceType = await getOptionalDoc(ctx.companyId, "serviceTypes", lead.serviceTypeId);
  const assignedUser = await getOptionalDoc(ctx.companyId, "users", lead.assignedTo);

  const acceptedQuotes = quotes.filter((q: any) => q.status === "accepted");
  const openReports = reports.filter((r: any) => r.status !== "cerrado");
  const activeRentals = rentals.filter((r: any) => r.status === "active" || r.status === "dispatched");
  const expenseTotal = expenses.reduce((sum: number, e: any) => sum + (Number(e.totalAmount) || 0), 0);
  const worstTrafficLight = safetyFolders.length > 0
    ? (safetyFolders.some((s: any) => s.trafficLight === "red") ? "red" : safetyFolders.some((s: any) => s.trafficLight === "yellow") ? "yellow" : "green")
    : null;

  return {
    lead,
    customer,
    mandante,
    stage,
    serviceType,
    assignedUser,
    service,
    quotes,
    reports,
    expenses,
    rentals,
    safetyFolders,
    documents,
    activity,
    notes,
    summary: {
      expectedRevenue: Number(lead.expectedRevenue || 0),
      weightedRevenue: Math.round((Number(lead.expectedRevenue || 0) * Number(lead.probability || 0)) / 100),
      quotesCount: quotes.length,
      acceptedQuotesCount: acceptedQuotes.length,
      acceptedQuotesTotal: acceptedQuotes.reduce((sum: number, q: any) => sum + (Number(q.grossTotal) || 0), 0),
      reportsCount: reports.length,
      openReportsCount: openReports.length,
      expensesCount: expenses.length,
      expensesTotal: expenseTotal,
      rentalsCount: rentals.length,
      activeRentalsCount: activeRentals.length,
      safetyFoldersCount: safetyFolders.length,
      safetyTrafficLight: worstTrafficLight,
      documentsCount: documents.length,
      currentDocumentsCount: documents.filter((doc) => doc.isCurrent !== false).length,
      notesCount: notes.length,
      hasService: Boolean(service),
    },
  };
});

export const crmAddLeadNote = onCall({ region, cors: crmCors }, async (request) => {
  const data = (request.data || {}) as Record<string, unknown>;
  const leadId = asString(data.leadId);
  const body = asString(data.body);
  if (!leadId || !body) throw new HttpsError("invalid-argument", "leadId y body son requeridos");

  const ctx = await assertCRMAction(request, "crm.edit_lead");
  const lead = await getLead(ctx.companyId, leadId);
  await assertCRMAction(request, "crm.edit_lead", lead);

  const ref = await companyRef(ctx.companyId).collection("leadNotes").add({
    companyId: ctx.companyId,
    leadId,
    body,
    createdBy: ctx.uid,
    createdByName: ctx.name,
    createdAt: nowIso(),
  });
  await addActivity(ctx.companyId, leadId, ctx, "note_added", "Nota agregada", { noteId: ref.id });
  return { id: ref.id };
});

export const crmListStages = onCall({ region, cors: crmCors }, async (request) => {
  const ctx = await assertCRMAction(request, "service.view_internal");
  const snap = await companyRef(ctx.companyId).collection("stages").limit(200).get();
  return { stages: snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })).sort((a: any, b: any) => (a.order || 0) - (b.order || 0)) };
});

export const crmCreateStage = onCall({ region, cors: crmCors }, async (request) => {
  const ctx = await assertCRMAction(request, "crm.manage_pipeline");
  const name = asString((request.data || {}).name);
  if (!name) throw new HttpsError("invalid-argument", "name requerido");
  const ref = await companyRef(ctx.companyId).collection("stages").add({
    companyId: ctx.companyId,
    name,
    order: Number((request.data || {}).order || 0),
    color: asOptionalString((request.data || {}).color),
    isDefault: false,
    isActive: true,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  });
  return { id: ref.id };
});

export const crmUpdateStage = onCall({ region, cors: crmCors }, async (request) => {
  const ctx = await assertCRMAction(request, "crm.manage_pipeline");
  const data = (request.data || {}) as Record<string, unknown>;
  const id = asString(data.id);
  if (!id) throw new HttpsError("invalid-argument", "id requerido");
  const payload: Record<string, unknown> = { updatedAt: nowIso() };
  if (data.name !== undefined) payload.name = asString(data.name);
  if (data.order !== undefined) payload.order = Number(data.order || 0);
  if (data.color !== undefined) payload.color = asOptionalString(data.color);
  if (data.isActive !== undefined) payload.isActive = Boolean(data.isActive);
  await companyRef(ctx.companyId).collection("stages").doc(id).update(payload);
  return { updated: true };
});

export const crmDeleteStage = onCall({ region, cors: crmCors }, async (request) => {
  const ctx = await assertCRMAction(request, "crm.manage_pipeline");
  const id = asString((request.data || {}).id);
  if (!id) throw new HttpsError("invalid-argument", "id requerido");
  const used = await companyRef(ctx.companyId).collection("leads").where("stageId", "==", id).limit(1).get();
  if (used.empty) {
    await companyRef(ctx.companyId).collection("stages").doc(id).delete();
    return { deleted: true, deactivated: false };
  }
  await companyRef(ctx.companyId).collection("stages").doc(id).update({ isActive: false, updatedAt: nowIso() });
  return { deleted: false, deactivated: true };
});

export const crmReorderStages = onCall({ region, cors: crmCors }, async (request) => {
  const ctx = await assertCRMAction(request, "crm.manage_pipeline");
  const stages = Array.isArray((request.data || {}).stages) ? (request.data || {}).stages as Array<Record<string, unknown>> : [];
  const batch = db.batch();
  stages.forEach((stage, index) => {
    const id = asString(stage.id);
    if (id) {
      batch.update(companyRef(ctx.companyId).collection("stages").doc(id), { order: Number(stage.order ?? index + 1), updatedAt: nowIso() });
    }
  });
  await batch.commit();
  return { updated: stages.length };
});

export const crmListServiceTypes = onCall({ region, cors: crmCors }, async (request) => {
  const ctx = await assertCRMAction(request, "service.view_internal");
  const snap = await companyRef(ctx.companyId).collection("serviceTypes").limit(200).get();
  return { serviceTypes: snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })).sort((a: any, b: any) => String(a.name || "").localeCompare(String(b.name || ""))) };
});

export const crmCreateServiceType = onCall({ region, cors: crmCors }, async (request) => {
  const ctx = await assertCRMAction(request, "crm.manage_pipeline");
  const name = asString((request.data || {}).name);
  if (!name) throw new HttpsError("invalid-argument", "name requerido");
  const ref = await companyRef(ctx.companyId).collection("serviceTypes").add({
    companyId: ctx.companyId,
    name,
    description: asString((request.data || {}).description),
    isActive: true,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  });
  return { id: ref.id };
});

export const crmUpdateServiceType = onCall({ region, cors: crmCors }, async (request) => {
  const ctx = await assertCRMAction(request, "crm.manage_pipeline");
  const data = (request.data || {}) as Record<string, unknown>;
  const id = asString(data.id);
  if (!id) throw new HttpsError("invalid-argument", "id requerido");
  const payload: Record<string, unknown> = { updatedAt: nowIso() };
  if (data.name !== undefined) payload.name = asString(data.name);
  if (data.description !== undefined) payload.description = asString(data.description);
  if (data.isActive !== undefined) payload.isActive = Boolean(data.isActive);
  await companyRef(ctx.companyId).collection("serviceTypes").doc(id).update(payload);
  return { updated: true };
});

export const crmDeleteServiceType = onCall({ region, cors: crmCors }, async (request) => {
  const ctx = await assertCRMAction(request, "crm.manage_pipeline");
  const id = asString((request.data || {}).id);
  if (!id) throw new HttpsError("invalid-argument", "id requerido");
  const used = await companyRef(ctx.companyId).collection("leads").where("serviceTypeId", "==", id).limit(1).get();
  if (used.empty) {
    await companyRef(ctx.companyId).collection("serviceTypes").doc(id).delete();
    return { deleted: true, deactivated: false };
  }
  await companyRef(ctx.companyId).collection("serviceTypes").doc(id).update({ isActive: false, updatedAt: nowIso() });
  return { deleted: false, deactivated: true };
});

export const crmGetService = onCall({ region, cors: crmCors }, async (request) => {
  const serviceId = asString((request.data || {}).serviceId || (request.data || {}).id);
  if (!serviceId) throw new HttpsError("invalid-argument", "serviceId requerido");
  const ctx = await assertCRMAction(request, "service.view_internal");
  const service = await getService(ctx.companyId, serviceId);
  await assertCRMAction(request, "service.view_internal", service);
  return { service };
});

export const crmGetServiceByLead = onCall({ region, cors: crmCors }, async (request) => {
  const leadId = asString((request.data || {}).leadId);
  if (!leadId) throw new HttpsError("invalid-argument", "leadId requerido");
  const ctx = await assertCRMAction(request, "service.view_internal");
  const lead = await getLead(ctx.companyId, leadId);
  await assertCRMAction(request, "service.view_internal", lead);
  const service = await ensureCRMServiceForLead(ctx.companyId, lead);
  return { service };
});

export const crmUpdateServiceOperationalControl = onCall({ region, cors: crmCors }, async (request) => {
  const data = (request.data || {}) as Record<string, unknown>;
  const serviceId = asString(data.serviceId || data.id);
  if (!serviceId) throw new HttpsError("invalid-argument", "serviceId requerido");
  const ctx = await assertCRMAction(request, "service.edit_operational_control");
  const service = await getService(ctx.companyId, serviceId);
  await assertCRMAction(request, "service.edit_operational_control", service);
  await companyRef(ctx.companyId).collection("crmServices").doc(serviceId).update({
    operationalControl: data.operationalControl || {},
    updatedAt: nowIso(),
  });
  return { updated: true };
});

export const crmCreateDocumentUpload = onCall({ region, cors: crmCors }, async (request) => {
  const data = (request.data || {}) as Record<string, unknown>;
  const modelName = normalizeModelName(data.modelName);
  const recordId = asString(data.recordId);
  const filename = sanitizeFilename(asString(data.filename));
  const mimeType = asString(data.mimeType) || "application/octet-stream";
  const sizeBytes = Number(data.sizeBytes || 0);
  const documentType = asString(data.documentType || data.category) || "general";
  if (!recordId || !filename) throw new HttpsError("invalid-argument", "recordId y filename son requeridos");
  if (sizeBytes > maxUploadBytes) throw new HttpsError("invalid-argument", "El archivo supera 20 MB");

  const ctx = await assertCRMAction(request, "service.manage_documents");
  let lead: Record<string, unknown> | null = null;
  let service: Record<string, unknown> | null = null;

  if (modelName === "Lead") {
    lead = await getLead(ctx.companyId, recordId);
    await assertCRMAction(request, "service.manage_documents", lead);
    service = await ensureCRMServiceForLead(ctx.companyId, lead);
  } else if (modelName === "Service") {
    service = await getService(ctx.companyId, recordId);
    await assertCRMAction(request, "service.manage_documents", service);
    lead = await getOptionalDoc(ctx.companyId, "leads", service.leadId);
  } else {
    const customer = await getOptionalDoc(ctx.companyId, "customers", recordId);
    if (!customer) throw new HttpsError("not-found", "Cliente no encontrado");
  }

  const existing = await getDocumentsForRecord(ctx.companyId, modelName, recordId, asString(service?.id), asString(lead?.id));
  const relevant = existing.filter((doc) => asString(doc.documentType || doc.category) === documentType);
  const version = Math.max(0, ...relevant.map((doc) => Number(doc.version || 1))) + 1;
  const parentDocumentId = asString(data.replaceDocumentId) || asString(relevant.find((doc) => doc.parentDocumentId)?.parentDocumentId) || asString(relevant[0]?.id) || null;
  const docRef = companyRef(ctx.companyId).collection("crmDocuments").doc();
  const storagePath = `companies/${ctx.companyId}/crm/${modelName.toLowerCase()}/${recordId}/${docRef.id}/${filename}`;

  await docRef.set({
    companyId: ctx.companyId,
    filename,
    filePath: storagePath,
    storagePath,
    mimeType,
    modelName,
    recordId,
    leadId: lead?.id || null,
    serviceId: service?.id || null,
    customerId: modelName === "Customer" ? recordId : lead?.customerId || service?.customerId || null,
    uploadedBy: ctx.uid,
    uploadedByName: ctx.name,
    category: asString(data.category) || documentType,
    documentType,
    version,
    isCurrent: false,
    parentDocumentId,
    publishToMirror: Boolean(data.publishToMirror),
    metadata: {
      originalFilename: filename,
      sizeBytes,
      publishToMirror: Boolean(data.publishToMirror),
      replacedSignedDocument: Boolean(data.replaceDocumentId),
    },
    status: "pending_upload",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  });

  return { documentId: docRef.id, storagePath, version };
});

export const crmFinalizeDocumentUpload = onCall({ region, cors: crmCors }, async (request) => {
  const documentId = asString((request.data || {}).documentId);
  if (!documentId) throw new HttpsError("invalid-argument", "documentId requerido");

  const preCtx = await assertCRMAction(request, "service.manage_documents");
  const docRef = companyRef(preCtx.companyId).collection("crmDocuments").doc(documentId);
  const snap = await docRef.get();
  const document = serializeDoc(snap);
  if (!document) throw new HttpsError("not-found", "Documento no encontrado");
  const ctx = await assertDocumentAction(request, "service.manage_documents", document);
  const storagePath = asString(document.storagePath || document.filePath);
  if (!storagePath) throw new HttpsError("failed-precondition", "Documento sin storagePath");

  const [metadata] = await storage.bucket().file(storagePath).getMetadata();
  const modelName = asString(document.modelName);
  const recordId = asString(document.recordId);
  const documentType = asString(document.documentType || document.category) || "general";
  const existing = await getDocumentsForRecord(ctx.companyId, modelName, recordId, asString(document.serviceId), asString(document.leadId));
  const batch = db.batch();

  existing
    .filter((item) => item.id !== documentId && asString(item.documentType || item.category) === documentType && item.isCurrent !== false)
    .forEach((item) => batch.update(companyRef(ctx.companyId).collection("crmDocuments").doc(String(item.id)), { isCurrent: false, updatedAt: nowIso() }));

  batch.update(docRef, {
    isCurrent: true,
    status: "ready",
    mimeType: metadata.contentType || document.mimeType || "application/octet-stream",
    sizeBytes: Number(metadata.size || 0),
    metadata: {
      ...(document.metadata as Record<string, unknown> || {}),
      sizeBytes: Number(metadata.size || 0),
      contentType: metadata.contentType || document.mimeType || "application/octet-stream",
      finalizedAt: nowIso(),
    },
    updatedAt: nowIso(),
  });
  await batch.commit();

  if (document.leadId) {
    await addActivity(ctx.companyId, String(document.leadId), ctx, "document_added", `Documento agregado: ${document.filename}`, { documentId });
  }

  return { finalized: true };
});

export const crmListDocuments = onCall({ region, cors: crmCors }, async (request) => {
  const data = (request.data || {}) as Record<string, unknown>;
  const modelName = normalizeModelName(data.modelName);
  const recordId = asString(data.recordId);
  if (!recordId) throw new HttpsError("invalid-argument", "recordId requerido");
  const ctx = await assertCRMAction(request, "service.view_internal");
  const documents = await getDocumentsForRecord(ctx.companyId, modelName, recordId, asString(data.serviceId), asString(data.leadId));
  return { documents };
});

export const crmGetDocumentDownloadUrl = onCall({ region, cors: crmCors }, async (request) => {
  const documentId = asString((request.data || {}).documentId);
  if (!documentId) throw new HttpsError("invalid-argument", "documentId requerido");
  const ctx = await assertCRMAction(request, "service.view_internal");
  const snap = await companyRef(ctx.companyId).collection("crmDocuments").doc(documentId).get();
  const document = serializeDoc(snap);
  if (!document) throw new HttpsError("not-found", "Documento no encontrado");
  await assertDocumentAction(request, "service.view_internal", document);
  const storagePath = asString(document.storagePath || document.filePath);
  const [url] = await storage.bucket().file(storagePath).getSignedUrl({
    action: "read",
    expires: Date.now() + 15 * 60 * 1000,
  });
  return { url };
});

export const crmUpdateDocumentMirrorFlag = onCall({ region, cors: crmCors }, async (request) => {
  const data = (request.data || {}) as Record<string, unknown>;
  const documentId = asString(data.documentId);
  if (!documentId) throw new HttpsError("invalid-argument", "documentId requerido");
  const ctx = await assertCRMAction(request, "service.publish_mirror");
  const snap = await companyRef(ctx.companyId).collection("crmDocuments").doc(documentId).get();
  const document = serializeDoc(snap);
  if (!document) throw new HttpsError("not-found", "Documento no encontrado");
  await assertDocumentAction(request, "service.publish_mirror", document);
  await snap.ref.update({
    publishToMirror: Boolean(data.publishToMirror),
    metadata: {
      ...(document.metadata as Record<string, unknown> || {}),
      publishToMirror: Boolean(data.publishToMirror),
    },
    updatedAt: nowIso(),
  });
  return { updated: true };
});

export const crmGetServiceMirror = onCall({ region, cors: crmCors }, async (request) => {
  const serviceId = asString((request.data || {}).serviceId || (request.data || {}).id);
  if (!serviceId) throw new HttpsError("invalid-argument", "serviceId requerido");
  const ctx = await assertCRMAction(request, "service.view_mirror_internal");
  const service = await getService(ctx.companyId, serviceId);
  await assertCRMAction(request, "service.view_mirror_internal", service);
  const lead = await getOptionalDoc(ctx.companyId, "leads", service.leadId);
  const customer = await getOptionalDoc(ctx.companyId, "customers", service.customerId || lead?.customerId);
  const mandante = await getOptionalDoc(ctx.companyId, "mandantes", service.mandanteId || lead?.mandanteId);
  const serviceType = await getOptionalDoc(ctx.companyId, "serviceTypes", service.serviceTypeId || lead?.serviceTypeId);
  const activity = lead ? await getCollectionByLead(ctx.companyId, "activityLogs", String(lead.id), 50) : [];
  const documents = (await getDocumentsForRecord(ctx.companyId, "Service", serviceId, serviceId, asString(lead?.id))).filter(documentVisibleInMirror);

  return {
    service: {
      id: service.id,
      serviceCode: service.serviceCode,
      title: service.title,
      description: service.description,
      serviceName: service.serviceName,
      empresaFaena: service.empresaFaena,
      aprName: service.aprName,
      supervisorName: service.supervisorName,
      contractAdminName: service.contractAdminName,
      commercialStatus: service.commercialStatus,
      operationalStatus: service.operationalStatus,
      financialStatus: service.financialStatus,
      statusSnapshot: service.statusSnapshot,
      contextSnapshot: service.contextSnapshot,
      mirrorEnabled: service.mirrorEnabled,
      updatedAt: service.updatedAt,
    },
    lead,
    customer,
    mandante,
    serviceType,
    documents,
    activity,
  };
});

export const crmGetCRMStats = onCall({ region, cors: crmCors }, async (request) => {
  const ctx = await assertCRMAction(request, "service.view_internal");
  const leadsSnap = await companyRef(ctx.companyId).collection("leads").limit(1000).get();
  const servicesSnap = await companyRef(ctx.companyId).collection("crmServices").limit(1000).get();
  const documentsSnap = await companyRef(ctx.companyId).collection("crmDocuments").limit(1000).get();
  const leads = leadsSnap.docs.map((doc) => doc.data());
  return {
    stats: {
      totalLeads: leads.length,
      openLeads: leads.filter((lead) => lead.status === "open").length,
      wonLeads: leads.filter((lead) => lead.status === "won").length,
      services: servicesSnap.size,
      documents: documentsSnap.size,
      pipelineValue: Math.round(leads.filter((lead) => lead.status === "open").reduce((sum, lead) => sum + (Number(lead.expectedRevenue || 0) * Number(lead.probability || 0)) / 100, 0)),
      wonValue: Math.round(leads.filter((lead) => lead.status === "won").reduce((sum, lead) => sum + Number(lead.expectedRevenue || 0), 0)),
    },
  };
});
