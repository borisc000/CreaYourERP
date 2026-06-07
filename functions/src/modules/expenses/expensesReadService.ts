import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db } from "../../config";
import { assertAction } from "../../shared/rbac";

const cors = [
  "https://your-erp.web.app", "https://your-erp-staging.web.app", "https://your-erp-staging.firebaseapp.com",
  "http://localhost:5173",
];

function companyRef(companyId: string) {
  return db.collection("companies").doc(companyId);
}

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

// ==========================================
// EXPENSE RECORDS
// ==========================================

export const listExpenseRecords = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "expenses.view", { companyId });

    const data = request.data || {};
    const status = cleanString(data.status);
    const category = cleanString(data.category);
    const scope = cleanString(data.scope);
    const leadId = cleanString(data.leadId);
    const search = cleanString(data.search).toLowerCase();
    const dateFrom = cleanString(data.dateFrom);
    const dateTo = cleanString(data.dateTo);
    const limit = Math.min(500, Math.max(1, Number(data.limit || 200)));

    let q: FirebaseFirestore.Query = companyRef(companyId).collection("expenses").orderBy("createdAt", "desc").limit(limit);
    if (status) q = q.where("status", "==", status);
    if (category) q = q.where("category", "==", category);
    if (scope) q = q.where("scope", "==", scope);
    if (leadId) q = q.where("leadId", "==", leadId);

    const snap = await q.get();
    let expenses = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    if (dateFrom) expenses = expenses.filter((e: any) => (e.expenseDate || "").slice(0, 10) >= dateFrom);
    if (dateTo) expenses = expenses.filter((e: any) => (e.expenseDate || "").slice(0, 10) <= dateTo);
    if (search) {
      expenses = expenses.filter((e: any) =>
        String(e.expenseNumber || "").toLowerCase().includes(search) ||
        String(e.vendorName || "").toLowerCase().includes(search) ||
        String(e.description || "").toLowerCase().includes(search) ||
        String(e.spenderName || "").toLowerCase().includes(search)
      );
    }

    return { expenses };
  }
);

export const getExpenseRecord = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "expenses.view", { companyId });

    const id = cleanString(request.data?.id || request.data?.expenseId);
    if (!id) throw new HttpsError("invalid-argument", "id requerido");

    const snap = await companyRef(companyId).collection("expenses").doc(id).get();
    if (!snap.exists) throw new HttpsError("not-found", "Gasto no encontrado");
    return { expense: { id: snap.id, ...snap.data() } };
  }
);

// ==========================================
// EXPENSE BACKUPS
// ==========================================

export const listExpenseBackups = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "expenses.view", { companyId });

    const data = request.data || {};
    const backupType = cleanString(data.backupType);
    const limit = Math.min(200, Math.max(1, Number(data.limit || 50)));

    let q: FirebaseFirestore.Query = companyRef(companyId).collection("expenseBackups").orderBy("createdAt", "desc").limit(limit);
    if (backupType) q = q.where("backupType", "==", backupType);

    const snap = await q.get();
    return { backups: snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) };
  }
);

export const getExpenseBackup = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "expenses.view", { companyId });

    const id = cleanString(request.data?.id || request.data?.backupId);
    if (!id) throw new HttpsError("invalid-argument", "id requerido");

    const snap = await companyRef(companyId).collection("expenseBackups").doc(id).get();
    if (!snap.exists) throw new HttpsError("not-found", "Backup no encontrado");
    return { backup: { id: snap.id, ...snap.data() } };
  }
);

export const deleteExpenseBackup = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "expenses.delete_backup", { companyId });

    const id = cleanString(request.data?.id);
    if (!id) throw new HttpsError("invalid-argument", "id requerido");

    await companyRef(companyId).collection("expenseBackups").doc(id).delete();
    return { deleted: true };
  }
);

export const updateExpenseBackup = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "expenses.edit_backup", { companyId });

    const id = cleanString(request.data?.id);
    if (!id) throw new HttpsError("invalid-argument", "id requerido");

    const { id: _, ...updateData } = request.data;
    await companyRef(companyId).collection("expenseBackups").doc(id).update({ ...updateData, updatedAt: new Date().toISOString() });
    return { updated: true };
  }
);

export const restoreExpenseBackup = onCall(
  { region: "us-central1", cors, memory: "1GiB" },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "expenses.restore_backup", { companyId });

    const id = cleanString(request.data?.id || request.data?.backupId);
    if (!id) throw new HttpsError("invalid-argument", "id requerido");

    const snap = await companyRef(companyId).collection("expenseBackups").doc(id).get();
    if (!snap.exists) throw new HttpsError("not-found", "Backup no encontrado");

    const backup = snap.data() || {};
    const snapshot: any[] = backup.snapshot || [];
    if (!Array.isArray(snapshot) || snapshot.length === 0) {
      throw new HttpsError("failed-precondition", "Backup vacío o corrupto");
    }

    // Optional: clear existing expenses first
    const clearExisting = Boolean(request.data?.clearExisting);
    const expensesRef = companyRef(companyId).collection("expenses");
    const batch = db.batch();

    if (clearExisting) {
      const existingSnap = await expensesRef.limit(500).get();
      for (const doc of existingSnap.docs) batch.delete(doc.ref);
    }

    for (const item of snapshot) {
      const newRef = expensesRef.doc();
      const { id: _originalId, createdAt: _createdAt, updatedAt: _updatedAt, ...rest } = item;
      batch.set(newRef, {
        ...rest,
        companyId,
        restoredFromBackupId: id,
        restoredAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }

    await batch.commit();
    return { restored: true, count: snapshot.length, clearExisting };
  }
);

// ==========================================
// REFERENCE DATA
// ==========================================

export const getExpenseReferenceData = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "expenses.view_reference", { companyId });

    const cref = companyRef(companyId);
    const [leadsSnap, assetsSnap] = await Promise.all([
      cref.collection("leads").where("status", "==", "open").orderBy("title").limit(100).get(),
      cref.collection("assets").orderBy("name").limit(200).get(),
    ]);

    return {
      categories: [
        "Materiales e insumos", "Combustible y peajes", "Arriendos y equipos",
        "Subcontratos", "Viaticos y traslados", "EPP y seguridad",
        "Mantenimiento", "Administracion", "Gastos generales", "Otros",
      ],
      paymentMethods: [
        "Transferencia", "Tarjeta empresa", "Caja chica", "Efectivo", "Cheque", "Credito proveedor", "Otro",
      ],
      scopes: [
        { code: "project", name: "Proyecto" },
        { code: "general", name: "General" },
        { code: "administrative", name: "Administrativo" },
        { code: "field", name: "Terreno" },
        { code: "other", name: "Otro" },
      ],
      statuses: [
        { code: "pending_support", name: "Pendiente de respaldo" },
        { code: "supported", name: "Respaldado" },
        { code: "observed", name: "Observado" },
        { code: "reconciled", name: "Conciliado" },
      ],
      leads: leadsSnap.docs.map((d) => ({ id: d.id, title: d.data().title || "" })),
      assets: assetsSnap.docs.map((d) => ({ id: d.id, code: d.data().code || "", name: d.data().name || "" })),
    };
  }
);
