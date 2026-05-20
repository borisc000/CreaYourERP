import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db } from "../../config";
import { assertAction } from "../../shared/rbac";

const cors = [
  "http://localhost:5173", "http://localhost:5000",
  "https://your-erp.web.app", "https://your-erp-staging.web.app", "https://your-erp-staging.firebaseapp.com",
];

function nowIso() { return new Date().toISOString(); }
function cleanString(value: unknown): string { return typeof value === "string" ? value.trim() : ""; }

// ==========================================
// ASSETS
// ==========================================

export const listAssets = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "assets.view", { companyId });

    const data = request.data || {};
    const status = cleanString(data.status);
    const category = cleanString(data.category);
    const search = cleanString(data.search).toLowerCase();
    const limit = Math.min(500, Math.max(1, Number(data.limit || 200)));

    let q: FirebaseFirestore.Query = db.collection("companies").doc(companyId).collection("assets").orderBy("updatedAt", "desc").limit(limit);
    if (status) q = q.where("status", "==", status);
    if (category) q = q.where("category", "==", category);

    const snap = await q.get();
    let assets = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    if (search) {
      assets = assets.filter((a: any) =>
        String(a.code || "").toLowerCase().includes(search) ||
        String(a.name || "").toLowerCase().includes(search) ||
        String(a.serialNumber || "").toLowerCase().includes(search) ||
        String(a.location || "").toLowerCase().includes(search)
      );
    }
    return { assets };
  }
);

export const getAsset = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "assets.view", { companyId });

    const id = cleanString(request.data?.id || request.data?.assetId);
    if (!id) throw new HttpsError("invalid-argument", "id requerido");

    const snap = await db.collection("companies").doc(companyId).collection("assets").doc(id).get();
    if (!snap.exists) throw new HttpsError("not-found", "Activo no encontrado");

    const maintenanceSnap = await db.collection("companies").doc(companyId).collection("assetMaintenance").where("assetId", "==", id).orderBy("performedDate", "desc").limit(100).get();
    return { asset: { id: snap.id, ...snap.data() }, maintenance: maintenanceSnap.docs.map((d) => ({ id: d.id, ...d.data() })) };
  }
);

// ==========================================
// MAINTENANCE
// ==========================================

export const listAssetMaintenance = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "assets.view_maintenance", { companyId });

    const data = request.data || {};
    const assetId = cleanString(data.assetId);
    const status = cleanString(data.status);
    const limit = Math.min(500, Math.max(1, Number(data.limit || 200)));

    let q: FirebaseFirestore.Query = db.collection("companies").doc(companyId).collection("assetMaintenance").orderBy("performedDate", "desc").limit(limit);
    if (assetId) q = q.where("assetId", "==", assetId);
    if (status) q = q.where("status", "==", status);

    const snap = await q.get();
    return { maintenance: snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) };
  }
);

export const getAssetMaintenance = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "assets.view_maintenance", { companyId });

    const id = cleanString(request.data?.id || request.data?.maintenanceId);
    if (!id) throw new HttpsError("invalid-argument", "id requerido");

    const snap = await db.collection("companies").doc(companyId).collection("assetMaintenance").doc(id).get();
    if (!snap.exists) throw new HttpsError("not-found", "Registro de mantenimiento no encontrado");
    return { maintenance: { id: snap.id, ...snap.data() } };
  }
);

export const updateAssetMaintenance = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "assets.edit_maintenance", { companyId });

    const id = cleanString(request.data?.id);
    if (!id) throw new HttpsError("invalid-argument", "id requerido");

    const { id: _, ...updateData } = request.data;
    await db.collection("companies").doc(companyId).collection("assetMaintenance").doc(id).update({ ...updateData, updatedAt: nowIso() });
    return { updated: true };
  }
);

export const deleteAssetMaintenance = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "assets.delete_maintenance", { companyId });

    const id = cleanString(request.data?.id);
    if (!id) throw new HttpsError("invalid-argument", "id requerido");

    await db.collection("companies").doc(companyId).collection("assetMaintenance").doc(id).delete();
    return { deleted: true };
  }
);

// ==========================================
// REFERENCE DATA
// ==========================================

export const getAssetReferenceData = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "assets.view_reference", { companyId });

    const cref = db.collection("companies").doc(companyId);
    const employeesSnap = await cref.collection("employees").orderBy("fullName").limit(200).get();

    return {
      categories: [
        "Maquinaria", "Vehiculo", "Herramienta", "Equipo electronico", "Mobiliario", "Infraestructura", "Seguridad", "General",
      ],
      statuses: [
        { code: "active", name: "Activo" },
        { code: "maintenance", name: "En mantenimiento" },
        { code: "retired", name: "Dado de baja" },
        { code: "inactive", name: "Inactivo" },
      ],
      maintenanceTypes: [
        { code: "preventive", name: "Preventivo" },
        { code: "corrective", name: "Correctivo" },
        { code: "predictive", name: "Predictivo" },
        { code: "overhaul", name: "Overhaul" },
      ],
      employees: employeesSnap.docs.map((d) => ({ id: d.id, fullName: d.data().fullName || "" })),
    };
  }
);
