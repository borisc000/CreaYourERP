import { onCall, HttpsError } from "firebase-functions/v2/https";
import { assertAction } from "../../shared/rbac";
import { db } from "../../config";

const cors = ["https://your-erp.web.app", "https://your-erp-staging.web.app", "https://your-erp-staging.firebaseapp.com", "http://localhost:5173"];
function companyRef(companyId: string) { return db.collection("companies").doc(companyId); }
function cleanString(value: unknown): string { return typeof value === "string" ? value.trim() : ""; }

// ==========================================
// SUPPLIERS
// ==========================================

export const listSuppliers = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "suppliers.view", { companyId });

    const data = request.data || {};
    const status = cleanString(data.status);
    const category = cleanString(data.category);
    const search = cleanString(data.search).toLowerCase();
    const limit = Math.min(500, Math.max(1, Number(data.limit || 200)));

    let q: FirebaseFirestore.Query = companyRef(companyId).collection("suppliers").orderBy("updatedAt", "desc").limit(limit);
    if (status) q = q.where("status", "==", status);
    if (category) q = q.where("category", "==", category);

    const snap = await q.get();
    let suppliers = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    if (search) {
      suppliers = suppliers.filter((s: any) =>
        String(s.name || "").toLowerCase().includes(search) ||
        String(s.code || "").toLowerCase().includes(search) ||
        String(s.contactName || "").toLowerCase().includes(search)
      );
    }
    return { suppliers };
  }
);

export const getSupplier = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "suppliers.view", { companyId });

    const id = cleanString(request.data?.id || request.data?.supplierId);
    if (!id) throw new HttpsError("invalid-argument", "id requerido");

    const snap = await companyRef(companyId).collection("suppliers").doc(id).get();
    if (!snap.exists) throw new HttpsError("not-found", "Proveedor no encontrado");

    // Enrich with counts
    const [itemsSnap, expensesSnap] = await Promise.all([
      companyRef(companyId).collection("inventoryItems").where("supplierId", "==", id).limit(1).get(),
      companyRef(companyId).collection("expenses").where("supplierId", "==", id).limit(1).get(),
    ]);

    return { supplier: { id: snap.id, ...snap.data(), itemsCount: itemsSnap.size, expensesCount: expensesSnap.size } };
  }
);

// ==========================================
// REFERENCE DATA
// ==========================================

export const getSupplierReferenceData = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "suppliers.view", { companyId });

    const suppliersSnap = await companyRef(companyId).collection("suppliers").limit(500).get();
    const categories = new Set<string>();
    for (const doc of suppliersSnap.docs) {
      const d = doc.data();
      if (d.category) categories.add(d.category);
    }

    return {
      categories: Array.from(categories).sort(),
      statuses: [
        { code: "active", name: "Activo" },
        { code: "preferred", name: "Preferido" },
        { code: "inactive", name: "Inactivo" },
      ],
      paymentTerms: [
        { code: "immediate", name: "Contado" },
        { code: "net15", name: "15 días" },
        { code: "net30", name: "30 días" },
        { code: "net60", name: "60 días" },
        { code: "net90", name: "90 días" },
      ],
    };
  }
);
