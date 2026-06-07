import { onCall, HttpsError } from "firebase-functions/v2/https";
import { assertAction } from "../../shared/rbac";
import { db } from "../../config";

const cors = ["https://your-erp.web.app", "https://your-erp-staging.web.app", "https://your-erp-staging.firebaseapp.com", "http://localhost:5173"];
function companyRef(companyId: string) { return db.collection("companies").doc(companyId); }
function cleanString(value: unknown): string { return typeof value === "string" ? value.trim() : ""; }

// ==========================================
// ITEMS
// ==========================================

export const listInventoryItems = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "inventory.view", { companyId });

    const data = request.data || {};
    const category = cleanString(data.category);
    const status = cleanString(data.status);
    const stockStatus = cleanString(data.stockStatus);
    const search = cleanString(data.search).toLowerCase();
    const limit = Math.min(500, Math.max(1, Number(data.limit || 200)));

    let q: FirebaseFirestore.Query = companyRef(companyId).collection("inventoryItems").orderBy("updatedAt", "desc").limit(limit);
    if (category) q = q.where("category", "==", category);
    if (status) q = q.where("status", "==", status);
    if (stockStatus) q = q.where("stockStatus", "==", stockStatus);

    const snap = await q.get();
    let items = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    if (search) {
      items = items.filter((i: any) =>
        String(i.name || "").toLowerCase().includes(search) ||
        String(i.code || "").toLowerCase().includes(search) ||
        String(i.location || "").toLowerCase().includes(search)
      );
    }
    return { items };
  }
);

export const getInventoryItem = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "inventory.view", { companyId });

    const id = cleanString(request.data?.id || request.data?.itemId);
    if (!id) throw new HttpsError("invalid-argument", "id requerido");

    const snap = await companyRef(companyId).collection("inventoryItems").doc(id).get();
    if (!snap.exists) throw new HttpsError("not-found", "Item no encontrado");

    const movementsSnap = await companyRef(companyId).collection("inventoryMovements").where("itemId", "==", id).orderBy("createdAt", "desc").limit(50).get();
    return { item: { id: snap.id, ...snap.data() }, movements: movementsSnap.docs.map((d) => ({ id: d.id, ...d.data() })) };
  }
);

export const deleteInventoryItem = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "inventory.delete", { companyId });

    const id = cleanString(request.data?.id);
    if (!id) throw new HttpsError("invalid-argument", "id requerido");

    const movementsSnap = await companyRef(companyId).collection("inventoryMovements").where("itemId", "==", id).limit(1).get();
    if (!movementsSnap.empty) throw new HttpsError("failed-precondition", "No se puede eliminar el item porque tiene movimientos asociados");

    await companyRef(companyId).collection("inventoryItems").doc(id).delete();
    return { deleted: true };
  }
);

// ==========================================
// MOVEMENTS
// ==========================================

export const listInventoryMovements = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "inventory.view", { companyId });

    const data = request.data || {};
    const itemId = cleanString(data.itemId);
    const movementType = cleanString(data.movementType);
    const dateFrom = cleanString(data.dateFrom);
    const dateTo = cleanString(data.dateTo);
    const limit = Math.min(500, Math.max(1, Number(data.limit || 200)));

    let q: FirebaseFirestore.Query = companyRef(companyId).collection("inventoryMovements").orderBy("createdAt", "desc").limit(limit);
    if (itemId) q = q.where("itemId", "==", itemId);
    if (movementType) q = q.where("movementType", "==", movementType);

    const snap = await q.get();
    let movements = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    if (dateFrom) movements = movements.filter((m: any) => (m.movementDate || "").slice(0, 10) >= dateFrom);
    if (dateTo) movements = movements.filter((m: any) => (m.movementDate || "").slice(0, 10) <= dateTo);
    return { movements };
  }
);

export const getInventoryMovement = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "inventory.view", { companyId });

    const id = cleanString(request.data?.id || request.data?.movementId);
    if (!id) throw new HttpsError("invalid-argument", "id requerido");

    const snap = await companyRef(companyId).collection("inventoryMovements").doc(id).get();
    if (!snap.exists) throw new HttpsError("not-found", "Movimiento no encontrado");
    return { movement: { id: snap.id, ...snap.data() } };
  }
);

// ==========================================
// BACKUPS
// ==========================================

export const listInventoryBackups = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "inventory.view", { companyId });

    const data = request.data || {};
    const backupType = cleanString(data.backupType);
    const limit = Math.min(200, Math.max(1, Number(data.limit || 50)));

    let q: FirebaseFirestore.Query = companyRef(companyId).collection("inventoryBackups").orderBy("createdAt", "desc").limit(limit);
    if (backupType) q = q.where("backupType", "==", backupType);

    const snap = await q.get();
    return { backups: snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) };
  }
);

export const getInventoryBackup = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "inventory.view", { companyId });

    const id = cleanString(request.data?.id || request.data?.backupId);
    if (!id) throw new HttpsError("invalid-argument", "id requerido");

    const snap = await companyRef(companyId).collection("inventoryBackups").doc(id).get();
    if (!snap.exists) throw new HttpsError("not-found", "Backup no encontrado");
    return { backup: { id: snap.id, ...snap.data() } };
  }
);

export const deleteInventoryBackup = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "inventory.delete", { companyId });

    const id = cleanString(request.data?.id);
    if (!id) throw new HttpsError("invalid-argument", "id requerido");

    await companyRef(companyId).collection("inventoryBackups").doc(id).delete();
    return { deleted: true };
  }
);

// ==========================================
// REFERENCE DATA
// ==========================================

export const getInventoryReferenceData = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "inventory.view", { companyId });

    const itemsSnap = await companyRef(companyId).collection("inventoryItems").limit(500).get();
    const categories = new Set<string>();
    const units = new Set<string>();
    const locations = new Set<string>();
    const suppliers = new Set<string>();

    for (const doc of itemsSnap.docs) {
      const d = doc.data();
      if (d.category) categories.add(d.category);
      if (d.unit) units.add(d.unit);
      if (d.location) locations.add(d.location);
      if (d.supplier) suppliers.add(d.supplier);
    }

    return {
      categories: Array.from(categories).sort(),
      units: Array.from(units).sort(),
      locations: Array.from(locations).sort(),
      suppliers: Array.from(suppliers).sort(),
      statuses: [
        { code: "active", name: "Activo" },
        { code: "inactive", name: "Inactivo" },
      ],
      stockStatuses: [
        { code: "healthy", name: "Saludable" },
        { code: "low", name: "Bajo stock" },
        { code: "out", name: "Sin stock" },
        { code: "inactive", name: "Inactivo" },
      ],
      movementTypes: [
        { code: "in", name: "Entrada" },
        { code: "out", name: "Salida" },
        { code: "adjustment_in", name: "Ajuste +" },
        { code: "adjustment_out", name: "Ajuste -" },
      ],
    };
  }
);
