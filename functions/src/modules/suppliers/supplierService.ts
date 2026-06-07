/**
 * Cloud Functions para gestión de proveedores (Suppliers).
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { assertAction } from "../../shared/rbac";
import { db } from "../../config";

function companyRef(companyId: string) {
  return db.collection("companies").doc(companyId);
}

// ==========================================
// GET DASHBOARD STATS
// ==========================================

export const getSupplierDashboard = onCall(
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
    await assertAction(request, "suppliers.view", { companyId });

    try {
      const snap = await companyRef(companyId).collection("suppliers").get();
      const suppliers = snap.docs.map((d) => d.data());

      const total = suppliers.length;
      const preferred = suppliers.filter((s) => s.status === "preferred").length;
      const inactive = suppliers.filter((s) => s.status === "inactive").length;
      const active = suppliers.filter((s) => s.status === "active").length;
      const avgLeadTime = total > 0
        ? Math.round(suppliers.reduce((sum, s) => sum + (s.leadTimeDays || 0), 0) / total)
        : 0;

      return {
        total,
        preferred,
        inactive,
        active,
        avgLeadTime,
      };
    } catch (error: any) {
      console.error("[getSupplierDashboard] Error:", error);
      throw new HttpsError("internal", error.message || "Error al obtener estadísticas");
    }
  }
);

// ==========================================
// CREATE SUPPLIER
// ==========================================

export const createSupplier = onCall(
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
    await assertAction(request, "suppliers.create", { companyId });

    const data = request.data as Record<string, any>;
    const code = String(data.code || "").trim();
    const name = String(data.name || "").trim();

    if (!code) {
      throw new HttpsError("invalid-argument", "El código es obligatorio");
    }
    if (!name) {
      throw new HttpsError("invalid-argument", "El nombre es obligatorio");
    }

    try {
      // Validar código único por empresa
      const existing = await companyRef(companyId)
        .collection("suppliers")
        .where("code", "==", code)
        .limit(1)
        .get();

      if (!existing.empty) {
        throw new HttpsError("already-exists", "Ya existe un proveedor con este código");
      }

      const now = new Date().toISOString();
      const docRef = companyRef(companyId).collection("suppliers").doc();
      const payload = {
        id: docRef.id,
        companyId,
        code,
        name,
        taxId: data.taxId || "",
        category: data.category || "General",
        status: data.status || "active",
        contactName: data.contactName || "",
        email: data.email || "",
        phone: data.phone || "",
        address: data.address || "",
        paymentTerms: data.paymentTerms || "",
        leadTimeDays: Number(data.leadTimeDays ?? 0),
        rating: Number(data.rating ?? 0),
        notes: data.notes || "",
        createdAt: now,
        updatedAt: now,
      };

      await docRef.set(payload);
      return { success: true, id: docRef.id, supplier: payload };
    } catch (error: any) {
      console.error("[createSupplier] Error:", error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", error.message || "Error al crear proveedor");
    }
  }
);

// ==========================================
// UPDATE SUPPLIER
// ==========================================

export const updateSupplier = onCall(
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
    await assertAction(request, "suppliers.edit", { companyId });

    const { id, ...data } = request.data as Record<string, any>;
    if (!id) {
      throw new HttpsError("invalid-argument", "ID de proveedor requerido");
    }

    try {
      const docRef = companyRef(companyId).collection("suppliers").doc(id);
      const snap = await docRef.get();
      if (!snap.exists) {
        throw new HttpsError("not-found", "Proveedor no encontrado");
      }

      // Si se cambia el código, validar unicidad
      const newCode = data.code ? String(data.code).trim() : undefined;
      if (newCode && newCode !== snap.data()?.code) {
        const existing = await companyRef(companyId)
          .collection("suppliers")
          .where("code", "==", newCode)
          .limit(1)
          .get();
        if (!existing.empty && existing.docs[0].id !== id) {
          throw new HttpsError("already-exists", "Ya existe un proveedor con este código");
        }
      }

      const updateData: Record<string, any> = {
        ...data,
        updatedAt: new Date().toISOString(),
      };
      // No permitir sobreescribir campos protegidos
      delete updateData.id;
      delete updateData.companyId;
      delete updateData.createdAt;

      await docRef.update(updateData);
      return { success: true, id };
    } catch (error: any) {
      console.error("[updateSupplier] Error:", error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", error.message || "Error al actualizar proveedor");
    }
  }
);

// ==========================================
// DELETE SUPPLIER
// ==========================================

export const deleteSupplier = onCall(
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
    await assertAction(request, "suppliers.delete", { companyId });

    const { id } = request.data as { id?: string };
    if (!id) {
      throw new HttpsError("invalid-argument", "ID de proveedor requerido");
    }

    try {
      // Verificar items enlazados (inventory)
      const itemsSnap = await companyRef(companyId)
        .collection("inventoryItems")
        .where("supplierId", "==", id)
        .limit(1)
        .get();

      if (!itemsSnap.empty) {
        throw new HttpsError("failed-precondition", "No se puede eliminar: el proveedor tiene ítems de inventario asociados");
      }

      // Verificar gastos enlazados (expenses)
      const expensesSnap = await companyRef(companyId)
        .collection("expenses")
        .where("supplierId", "==", id)
        .limit(1)
        .get();

      if (!expensesSnap.empty) {
        throw new HttpsError("failed-precondition", "No se puede eliminar: el proveedor tiene gastos asociados");
      }

      await companyRef(companyId).collection("suppliers").doc(id).delete();
      return { success: true, id };
    } catch (error: any) {
      console.error("[deleteSupplier] Error:", error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", error.message || "Error al eliminar proveedor");
    }
  }
);
