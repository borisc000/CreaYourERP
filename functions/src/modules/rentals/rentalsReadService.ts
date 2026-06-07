import { onCall, HttpsError } from "firebase-functions/v2/https";
import { assertAction } from "../../shared/rbac";
import { db } from "../../config";

const cors = ["https://your-erp.web.app", "https://your-erp-staging.web.app", "https://your-erp-staging.firebaseapp.com", "http://localhost:5173"];
function companyRef(companyId: string) { return db.collection("companies").doc(companyId); }
function cleanString(value: unknown): string { return typeof value === "string" ? value.trim() : ""; }

// ==========================================
// ASSETS
// ==========================================

export const listRentalAssets = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "rentals.view", { companyId });

    const data = request.data || {};
    const status = cleanString(data.status);
    const assetType = cleanString(data.assetType);
    const search = cleanString(data.search).toLowerCase();
    const limit = Math.min(500, Math.max(1, Number(data.limit || 200)));

    let q: FirebaseFirestore.Query = companyRef(companyId).collection("rentalAssets").orderBy("updatedAt", "desc").limit(limit);
    if (status) q = q.where("status", "==", status);
    if (assetType) q = q.where("assetType", "==", assetType);

    const snap = await q.get();
    let assets = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    if (search) {
      assets = assets.filter((a: any) =>
        String(a.name || "").toLowerCase().includes(search) ||
        String(a.code || "").toLowerCase().includes(search)
      );
    }
    return { assets };
  }
);

export const getRentalAsset = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "rentals.view", { companyId });

    const id = cleanString(request.data?.id || request.data?.assetId);
    if (!id) throw new HttpsError("invalid-argument", "id requerido");

    const snap = await companyRef(companyId).collection("rentalAssets").doc(id).get();
    if (!snap.exists) throw new HttpsError("not-found", "Activo no encontrado");
    return { asset: { id: snap.id, ...snap.data() } };
  }
);

export const deleteRentalAsset = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "rentals.delete", { companyId });

    const id = cleanString(request.data?.id);
    if (!id) throw new HttpsError("invalid-argument", "id requerido");

    await companyRef(companyId).collection("rentalAssets").doc(id).delete();
    return { deleted: true };
  }
);

// ==========================================
// CONTRACTS
// ==========================================

export const listRentalContracts = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "rentals.view", { companyId });

    const data = request.data || {};
    const status = cleanString(data.status);
    const customerId = cleanString(data.customerId);
    const leadId = cleanString(data.leadId);
    const search = cleanString(data.search).toLowerCase();
    const limit = Math.min(500, Math.max(1, Number(data.limit || 200)));

    let q: FirebaseFirestore.Query = companyRef(companyId).collection("rentalContracts").orderBy("updatedAt", "desc").limit(limit);
    if (status) q = q.where("status", "==", status);
    if (customerId) q = q.where("customerId", "==", customerId);
    if (leadId) q = q.where("leadId", "==", leadId);

    const snap = await q.get();
    let contracts = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    if (search) {
      contracts = contracts.filter((c: any) =>
        String(c.rentalNumber || "").toLowerCase().includes(search) ||
        String(c.title || "").toLowerCase().includes(search)
      );
    }
    return { contracts };
  }
);

export const getRentalContract = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "rentals.view", { companyId });

    const id = cleanString(request.data?.id || request.data?.contractId);
    if (!id) throw new HttpsError("invalid-argument", "id requerido");

    const snap = await companyRef(companyId).collection("rentalContracts").doc(id).get();
    if (!snap.exists) throw new HttpsError("not-found", "Contrato no encontrado");

    const [linesSnap, guaranteesSnap, eventsSnap] = await Promise.all([
      companyRef(companyId).collection("rentalContractLines").where("contractId", "==", id).get(),
      companyRef(companyId).collection("rentalGuarantees").where("contractId", "==", id).get(),
      companyRef(companyId).collection("rentalEvents").where("contractId", "==", id).orderBy("eventAt", "desc").limit(50).get(),
    ]);

    return {
      contract: { id: snap.id, ...snap.data() },
      lines: linesSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
      guarantees: guaranteesSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
      events: eventsSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
    };
  }
);

export const deleteRentalContract = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "rentals.delete", { companyId });

    const id = cleanString(request.data?.id);
    if (!id) throw new HttpsError("invalid-argument", "id requerido");

    const ref = companyRef(companyId);
    const [linesSnap, guaranteesSnap, eventsSnap, backupsSnap] = await Promise.all([
      ref.collection("rentalContractLines").where("contractId", "==", id).limit(500).get(),
      ref.collection("rentalGuarantees").where("contractId", "==", id).limit(500).get(),
      ref.collection("rentalEvents").where("contractId", "==", id).limit(500).get(),
      ref.collection("rentalBackups").where("contractId", "==", id).limit(500).get(),
    ]);

    const batch = db.batch();
    for (const doc of linesSnap.docs) batch.delete(doc.ref);
    for (const doc of guaranteesSnap.docs) batch.delete(doc.ref);
    for (const doc of eventsSnap.docs) batch.delete(doc.ref);
    for (const doc of backupsSnap.docs) batch.delete(doc.ref);
    batch.delete(ref.collection("rentalContracts").doc(id));
    await batch.commit();

    return { deleted: true, cascade: { lines: linesSnap.size, guarantees: guaranteesSnap.size, events: eventsSnap.size, backups: backupsSnap.size } };
  }
);

// ==========================================
// CONTRACT LINES
// ==========================================

export const listRentalContractLines = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "rentals.view", { companyId });

    const data = request.data || {};
    const contractId = cleanString(data.contractId);
    const limit = Math.min(500, Math.max(1, Number(data.limit || 200)));

    let q: FirebaseFirestore.Query = companyRef(companyId).collection("rentalContractLines").orderBy("createdAt", "desc").limit(limit);
    if (contractId) q = q.where("contractId", "==", contractId);

    const snap = await q.get();
    return { lines: snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) };
  }
);

// ==========================================
// GUARANTEES
// ==========================================

export const listRentalGuarantees = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "rentals.view", { companyId });

    const data = request.data || {};
    const contractId = cleanString(data.contractId);
    const limit = Math.min(500, Math.max(1, Number(data.limit || 200)));

    let q: FirebaseFirestore.Query = companyRef(companyId).collection("rentalGuarantees").orderBy("createdAt", "desc").limit(limit);
    if (contractId) q = q.where("contractId", "==", contractId);

    const snap = await q.get();
    return { guarantees: snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) };
  }
);

export const getRentalGuarantee = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "rentals.view", { companyId });

    const id = cleanString(request.data?.id || request.data?.guaranteeId);
    if (!id) throw new HttpsError("invalid-argument", "id requerido");

    const snap = await companyRef(companyId).collection("rentalGuarantees").doc(id).get();
    if (!snap.exists) throw new HttpsError("not-found", "Garantía no encontrada");
    return { guarantee: { id: snap.id, ...snap.data() } };
  }
);

// ==========================================
// BACKUPS
// ==========================================

export const listRentalBackups = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "rentals.view", { companyId });

    const data = request.data || {};
    const contractId = cleanString(data.contractId);
    const limit = Math.min(200, Math.max(1, Number(data.limit || 50)));

    let q: FirebaseFirestore.Query = companyRef(companyId).collection("rentalBackups").orderBy("createdAt", "desc").limit(limit);
    if (contractId) q = q.where("contractId", "==", contractId);

    const snap = await q.get();
    return { backups: snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) };
  }
);

export const getRentalBackup = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "rentals.view", { companyId });

    const id = cleanString(request.data?.id || request.data?.backupId);
    if (!id) throw new HttpsError("invalid-argument", "id requerido");

    const snap = await companyRef(companyId).collection("rentalBackups").doc(id).get();
    if (!snap.exists) throw new HttpsError("not-found", "Backup no encontrado");
    return { backup: { id: snap.id, ...snap.data() } };
  }
);

export const deleteRentalBackup = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "rentals.delete", { companyId });

    const id = cleanString(request.data?.id);
    if (!id) throw new HttpsError("invalid-argument", "id requerido");

    await companyRef(companyId).collection("rentalBackups").doc(id).delete();
    return { deleted: true };
  }
);

// ==========================================
// EVENTS
// ==========================================

export const listRentalEvents = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "rentals.view_timeline", { companyId });

    const data = request.data || {};
    const contractId = cleanString(data.contractId);
    const limit = Math.min(500, Math.max(1, Number(data.limit || 200)));

    let q: FirebaseFirestore.Query = companyRef(companyId).collection("rentalEvents").orderBy("eventAt", "desc").limit(limit);
    if (contractId) q = q.where("contractId", "==", contractId);

    const snap = await q.get();
    return { events: snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) };
  }
);

// ==========================================
// REFERENCE DATA
// ==========================================

export const getRentalReferenceData = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "rentals.view", { companyId });

    const assetsSnap = await companyRef(companyId).collection("rentalAssets").orderBy("name").limit(200).get();
    return {
      assetTypes: [
        { code: "equipment", name: "Equipo" },
        { code: "vehicle", name: "Vehículo" },
        { code: "tool", name: "Herramienta" },
        { code: "other", name: "Otro" },
      ],
      trackingModes: [
        { code: "unit", name: "Por unidad" },
        { code: "batch", name: "Por lote" },
        { code: "serial", name: "Por serial" },
      ],
      statuses: [
        { code: "available", name: "Disponible" },
        { code: "reserved", name: "Reservado" },
        { code: "rented", name: "Arrendado" },
        { code: "maintenance", name: "Mantenimiento" },
        { code: "retired", name: "Dado de baja" },
      ],
      billingCycles: [
        { code: "daily", name: "Diario" },
        { code: "weekly", name: "Semanal" },
        { code: "monthly", name: "Mensual" },
        { code: "project", name: "Por proyecto" },
      ],
      assets: assetsSnap.docs.map((d) => ({ id: d.id, code: d.data().code || "", name: d.data().name || "" })),
    };
  }
);
