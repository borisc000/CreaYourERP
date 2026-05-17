/**
 * Cloud Functions para el módulo de Inventario (Inventory)
 * - getInventoryDashboard: Stats, alertas, items y movimientos recientes, backups
 * - createInventoryItem: Crea un item de inventario
 * - updateInventoryItem: Actualiza campos editables de un item
 * - deleteInventoryItem: Elimina un item solo si no tiene movimientos
 * - createInventoryMovement: Crea movimiento, actualiza stock y average_cost
 * - createInventoryBackup: Crea backup con snapshot y checksum SHA-1
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { assertAction } from "../../shared/rbac";
import { db } from "../../config";
import * as crypto from "crypto";

function companyRef(companyId: string) {
  return db.collection("companies").doc(companyId);
}

type StockStatus = "healthy" | "low" | "out" | "inactive";
type MovementType = "in" | "out" | "adjustment_in" | "adjustment_out";

function computeStockStatus(currentStock: number, minimumStock: number, status: "active" | "inactive"): StockStatus {
  if (status === "inactive") return "inactive";
  if (currentStock <= 0) return "out";
  if (currentStock <= minimumStock) return "low";
  return "healthy";
}

function computeHealthRatio(currentStock: number, minimumStock: number): number {
  if (minimumStock <= 0) return currentStock > 0 ? 1 : 0;
  return currentStock / minimumStock;
}

function computeInventoryValue(currentStock: number, averageCost: number): number {
  return Math.round(currentStock * averageCost * 100) / 100;
}

// ==========================================
// getInventoryDashboard
// ==========================================

export const getInventoryDashboard = onCall(
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
    await assertAction(request, "inventory.view", { companyId });

    try {
      const cref = companyRef(companyId);

      const [
        itemsSnap,
        movementsSnap,
        backupsSnap,
      ] = await Promise.all([
        cref.collection("inventoryItems").limit(500).get(),
        cref.collection("inventoryMovements").orderBy("createdAt", "desc").limit(10).get(),
        cref.collection("inventoryBackups").orderBy("createdAt", "desc").limit(5).get(),
      ]);

      const items = itemsSnap.docs.map((d) => d.data() as any);
      const totalItems = items.length;
      const activeItems = items.filter((i) => i.status === "active").length;
      const inactiveItems = items.filter((i) => i.status === "inactive").length;
      const lowStockItems = items.filter((i) => i.stockStatus === "low").length;
      const outOfStockItems = items.filter((i) => i.stockStatus === "out").length;
      const totalInventoryValue = items.reduce((sum, i) => sum + (i.inventoryValue || 0), 0);

      const categories = Array.from(new Set(items.map((i) => i.category).filter(Boolean)));
      const categoryBreakdown = categories.map((cat) => ({
        name: cat,
        count: items.filter((i) => i.category === cat).length,
        value: items.filter((i) => i.category === cat).reduce((sum, i) => sum + (i.inventoryValue || 0), 0),
      }));

      const alerts = items
        .filter((i) => i.stockStatus === "low" || i.stockStatus === "out")
        .sort((a, b) => (a.healthRatio || 0) - (b.healthRatio || 0))
        .slice(0, 10)
        .map((i) => ({
          id: i.id,
          code: i.code,
          name: i.name,
          stockStatus: i.stockStatus,
          currentStock: i.currentStock,
          minimumStock: i.minimumStock,
          healthRatio: i.healthRatio,
        }));

      const recentItems = items
        .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))
        .slice(0, 10)
        .map((i) => ({
          id: i.id,
          code: i.code,
          name: i.name,
          category: i.category,
          currentStock: i.currentStock,
          stockStatus: i.stockStatus,
          createdAt: i.createdAt,
        }));

      const recentMovements = movementsSnap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          itemId: data.itemId,
          itemName: data.itemName,
          itemCode: data.itemCode,
          movementType: data.movementType,
          quantity: data.quantity,
          stockBefore: data.stockBefore,
          stockAfter: data.stockAfter,
          totalCost: data.totalCost,
          performedByName: data.performedByName,
          movementDate: data.movementDate,
          createdAt: data.createdAt,
        };
      });

      const recentBackups = backupsSnap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          backupName: data.backupName,
          backupType: data.backupType,
          itemsCount: data.itemsCount,
          movementsCount: data.movementsCount,
          createdByName: data.createdByName,
          createdAt: data.createdAt,
        };
      });

      return {
        stats: {
          totalItems,
          activeItems,
          inactiveItems,
          lowStockItems,
          outOfStockItems,
          totalInventoryValue: Math.round(totalInventoryValue * 100) / 100,
        },
        categories: categoryBreakdown,
        alerts,
        recentItems,
        recentMovements,
        recentBackups,
      };
    } catch (error: any) {
      console.error("[getInventoryDashboard] Error:", error);
      throw new HttpsError("internal", error.message || "Error al obtener dashboard");
    }
  }
);

// ==========================================
// createInventoryItem
// ==========================================

interface CreateInventoryItemPayload {
  code: string;
  name: string;
  category: string;
  unit: string;
  location: string;
  supplier?: string;
  minimumStock: number;
  initialStock?: number;
  initialUnitCost?: number;
  status?: "active" | "inactive";
  notes?: string;
}

export const createInventoryItem = onCall(
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
    await assertAction(request, "inventory.create", { companyId });

    const payload = request.data as CreateInventoryItemPayload;
    if (!payload.code?.trim() || !payload.name?.trim() || !payload.category?.trim() || !payload.unit?.trim() || !payload.location?.trim()) {
      throw new HttpsError("invalid-argument", "Código, nombre, categoría, unidad y ubicación son requeridos");
    }

    try {
      const cref = companyRef(companyId);
      const now = new Date().toISOString();
      const initialStock = Math.max(0, payload.initialStock || 0);
      const initialUnitCost = Math.max(0, payload.initialUnitCost || 0);
      const minimumStock = Math.max(0, payload.minimumStock || 0);
      const status = payload.status || "active";

      const stockStatus = computeStockStatus(initialStock, minimumStock, status);
      const healthRatio = computeHealthRatio(initialStock, minimumStock);
      const inventoryValue = computeInventoryValue(initialStock, initialUnitCost);
      const needsRestock = stockStatus === "low" || stockStatus === "out";

      const itemRef = cref.collection("inventoryItems").doc();
      const itemId = itemRef.id;

      const itemData = {
        id: itemId,
        companyId,
        code: payload.code.trim(),
        name: payload.name.trim(),
        category: payload.category.trim(),
        unit: payload.unit.trim(),
        location: payload.location.trim(),
        supplier: payload.supplier?.trim() || "",
        minimumStock,
        currentStock: initialStock,
        averageCost: initialUnitCost,
        status,
        notes: payload.notes?.trim() || "",
        lastMovementAt: initialStock > 0 ? now : "",
        inventoryValue,
        stockStatus,
        healthRatio,
        needsRestock,
        createdAt: now,
        updatedAt: now,
      };

      await itemRef.set(itemData);

      // If initial stock > 0, create an adjustment_in movement
      if (initialStock > 0) {
        await cref.collection("inventoryMovements").add({
          itemId,
          companyId,
          itemName: payload.name.trim(),
          itemCode: payload.code.trim(),
          itemUnit: payload.unit.trim(),
          movementType: "adjustment_in",
          movementLabel: "Ajuste de entrada",
          movementDirection: "in",
          quantity: initialStock,
          signedQuantity: initialStock,
          stockBefore: 0,
          stockAfter: initialStock,
          unitCost: initialUnitCost,
          totalCost: inventoryValue,
          reference: "",
          reason: "Stock inicial",
          destination: "",
          deliveredByName: "",
          receivedByName: "",
          hasPhotoEvidence: false,
          hasSignatureEvidence: false,
          evidenceAvailable: false,
          evidencePhotoData: "",
          evidenceSignatureData: "",
          notes: "Creación de item con stock inicial",
          performedBy: request.auth.uid,
          performedByName: request.auth.token.name || "",
          movementDate: now,
          createdAt: now,
        });
      }

      return { success: true, itemId };
    } catch (error: any) {
      console.error("[createInventoryItem] Error:", error);
      throw new HttpsError("internal", error.message || "Error al crear item");
    }
  }
);

// ==========================================
// updateInventoryItem
// ==========================================

interface UpdateInventoryItemPayload {
  itemId: string;
  name?: string;
  category?: string;
  unit?: string;
  location?: string;
  supplier?: string;
  minimumStock?: number;
  status?: "active" | "inactive";
  notes?: string;
}

export const updateInventoryItem = onCall(
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
    await assertAction(request, "inventory.edit", { companyId });

    const { itemId, ...updates } = request.data as UpdateInventoryItemPayload;
    if (!itemId) {
      throw new HttpsError("invalid-argument", "itemId es requerido");
    }

    try {
      const cref = companyRef(companyId);
      const itemRef = cref.collection("inventoryItems").doc(itemId);
      const snap = await itemRef.get();
      if (!snap.exists) {
        throw new HttpsError("not-found", "Item no encontrado");
      }

      const current = snap.data() as any;
      const now = new Date().toISOString();

      const updateData: Record<string, any> = { updatedAt: now };

      if (updates.name !== undefined) updateData.name = updates.name.trim();
      if (updates.category !== undefined) updateData.category = updates.category.trim();
      if (updates.unit !== undefined) updateData.unit = updates.unit.trim();
      if (updates.location !== undefined) updateData.location = updates.location.trim();
      if (updates.supplier !== undefined) updateData.supplier = updates.supplier.trim();
      if (updates.minimumStock !== undefined) updateData.minimumStock = Math.max(0, updates.minimumStock);
      if (updates.status !== undefined) updateData.status = updates.status;
      if (updates.notes !== undefined) updateData.notes = updates.notes.trim();

      // Recalculate computed fields if minimumStock or status changed
      const newMin = updateData.minimumStock !== undefined ? updateData.minimumStock : current.minimumStock;
      const newStatus = updateData.status !== undefined ? updateData.status : current.status;
      const currentStock = current.currentStock || 0;
      const averageCost = current.averageCost || 0;

      updateData.stockStatus = computeStockStatus(currentStock, newMin, newStatus);
      updateData.healthRatio = computeHealthRatio(currentStock, newMin);
      updateData.inventoryValue = computeInventoryValue(currentStock, averageCost);
      updateData.needsRestock = updateData.stockStatus === "low" || updateData.stockStatus === "out";

      await itemRef.update(updateData);
      return { success: true, itemId };
    } catch (error: any) {
      console.error("[updateInventoryItem] Error:", error);
      throw new HttpsError("internal", error.message || "Error al actualizar item");
    }
  }
);

// ==========================================
// deleteInventoryItem
// ==========================================

interface DeleteInventoryItemPayload {
  itemId: string;
}

export const deleteInventoryItem = onCall(
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
    await assertAction(request, "inventory.delete", { companyId });

    const { itemId } = request.data as DeleteInventoryItemPayload;
    if (!itemId) {
      throw new HttpsError("invalid-argument", "itemId es requerido");
    }

    try {
      const cref = companyRef(companyId);

      // Check if item has movements
      const movementsSnap = await cref.collection("inventoryMovements").where("itemId", "==", itemId).limit(1).get();
      if (!movementsSnap.empty) {
        throw new HttpsError("failed-precondition", "No se puede eliminar el item porque tiene movimientos asociados");
      }

      await cref.collection("inventoryItems").doc(itemId).delete();
      return { success: true };
    } catch (error: any) {
      console.error("[deleteInventoryItem] Error:", error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", error.message || "Error al eliminar item");
    }
  }
);

// ==========================================
// createInventoryMovement
// ==========================================

interface CreateInventoryMovementPayload {
  itemId: string;
  movementType: MovementType;
  quantity: number;
  unitCost?: number;
  reference?: string;
  reason?: string;
  destination?: string;
  deliveredByName?: string;
  receivedByName?: string;
  hasPhotoEvidence?: boolean;
  hasSignatureEvidence?: boolean;
  evidencePhotoData?: string;
  evidenceSignatureData?: string;
  notes?: string;
  movementDate?: string;
}

export const createInventoryMovement = onCall(
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
    await assertAction(request, "inventory.create", { companyId });

    const payload = request.data as CreateInventoryMovementPayload;
    if (!payload.itemId || !payload.movementType || payload.quantity === undefined || payload.quantity === null) {
      throw new HttpsError("invalid-argument", "itemId, movementType y quantity son requeridos");
    }

    const quantity = Math.max(0, Number(payload.quantity) || 0);
    if (quantity <= 0) {
      throw new HttpsError("invalid-argument", "La cantidad debe ser mayor a 0");
    }

    const isIn = payload.movementType === "in" || payload.movementType === "adjustment_in";
    const isOut = payload.movementType === "out" || payload.movementType === "adjustment_out";

    if (!isIn && !isOut) {
      throw new HttpsError("invalid-argument", "Tipo de movimiento no válido");
    }

    // For in/out movements, require deliveredByName, receivedByName, and at least one evidence
    if (payload.movementType === "in" || payload.movementType === "out") {
      if (!payload.deliveredByName?.trim() || !payload.receivedByName?.trim()) {
        throw new HttpsError("invalid-argument", "Las entradas y salidas requieren nombre de quien entrega y quien recibe");
      }
      if (!payload.hasPhotoEvidence && !payload.hasSignatureEvidence) {
        throw new HttpsError("invalid-argument", "Las entradas y salidas requieren al menos una evidencia (foto o firma)");
      }
    }

    try {
      const cref = companyRef(companyId);
      const itemRef = cref.collection("inventoryItems").doc(payload.itemId);

      const performedBy = request.auth!.uid;
      const performedByName = request.auth!.token.name || "";

      const result = await db.runTransaction(async (t) => {
        const itemSnap = await t.get(itemRef);
        if (!itemSnap.exists) {
          throw new HttpsError("not-found", "Item no encontrado");
        }

        const item = itemSnap.data() as any;
        const stockBefore = Number(item.currentStock) || 0;
        const averageCost = Number(item.averageCost) || 0;
        const unitCost = Math.max(0, Number(payload.unitCost) || 0);

        let stockAfter = stockBefore;
        let newAverageCost = averageCost;
        let totalCost = 0;

        if (isIn) {
          stockAfter = stockBefore + quantity;
          if (unitCost > 0 && stockAfter > 0) {
            const currentValue = stockBefore * averageCost;
            const incomingValue = quantity * unitCost;
            newAverageCost = (currentValue + incomingValue) / stockAfter;
            newAverageCost = Math.round(newAverageCost * 100) / 100;
          }
          totalCost = Math.round(quantity * unitCost * 100) / 100;
        } else {
          stockAfter = stockBefore - quantity;
          if (stockAfter < 0) {
            throw new HttpsError("failed-precondition", "No hay stock suficiente para realizar este movimiento");
          }
          totalCost = Math.round(quantity * averageCost * 100) / 100;
        }

        const now = new Date().toISOString();
        const movementDate = payload.movementDate || now;

        // Update item atomically
        const stockStatus = computeStockStatus(stockAfter, item.minimumStock || 0, item.status || "active");
        const healthRatio = computeHealthRatio(stockAfter, item.minimumStock || 0);
        const inventoryValue = computeInventoryValue(stockAfter, newAverageCost);
        const needsRestock = stockStatus === "low" || stockStatus === "out";

        t.update(itemRef, {
          currentStock: stockAfter,
          averageCost: newAverageCost,
          lastMovementAt: now,
          inventoryValue,
          stockStatus,
          healthRatio,
          needsRestock,
          updatedAt: now,
        });

        // Create movement atomically
        const movementRef = cref.collection("inventoryMovements").doc();
        t.set(movementRef, {
          itemId: payload.itemId,
          companyId,
          itemName: item.name || "",
          itemCode: item.code || "",
          itemUnit: item.unit || "",
          movementType: payload.movementType,
          movementLabel: payload.movementType === "in" ? "Entrada" : payload.movementType === "out" ? "Salida" : payload.movementType === "adjustment_in" ? "Ajuste de entrada" : "Ajuste de salida",
          movementDirection: isIn ? "in" : "out",
          quantity,
          signedQuantity: quantity,
          stockBefore,
          stockAfter,
          unitCost,
          totalCost,
          reference: payload.reference?.trim() || "",
          reason: payload.reason?.trim() || "",
          destination: payload.destination?.trim() || "",
          deliveredByName: payload.deliveredByName?.trim() || "",
          receivedByName: payload.receivedByName?.trim() || "",
          hasPhotoEvidence: Boolean(payload.hasPhotoEvidence),
          hasSignatureEvidence: Boolean(payload.hasSignatureEvidence),
          evidenceAvailable: Boolean(payload.hasPhotoEvidence) || Boolean(payload.hasSignatureEvidence),
          evidencePhotoData: payload.evidencePhotoData?.trim() || "",
          evidenceSignatureData: payload.evidenceSignatureData?.trim() || "",
          notes: payload.notes?.trim() || "",
          performedBy,
          performedByName,
          movementDate,
          createdAt: now,
        });

        return { movementId: movementRef.id, stockAfter, newAverageCost };
      });

      return { success: true, ...result };
    } catch (error: any) {
      console.error("[createInventoryMovement] Error:", error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", error.message || "Error al crear movimiento");
    }
  }
);

// ==========================================
// createInventoryBackup
// ==========================================

interface CreateInventoryBackupPayload {
  backupName: string;
  backupType?: "manual" | "automatic";
  notes?: string;
}

export const createInventoryBackup = onCall(
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
    await assertAction(request, "inventory.create", { companyId });

    const payload = request.data as CreateInventoryBackupPayload;
    if (!payload.backupName?.trim()) {
      throw new HttpsError("invalid-argument", "backupName es requerido");
    }

    try {
      const cref = companyRef(companyId);

      const [itemsSnap, movementsSnap] = await Promise.all([
        cref.collection("inventoryItems").get(),
        cref.collection("inventoryMovements").get(),
      ]);

      const items = itemsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const movements = movementsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

      const snapshot = { items, movements, exportedAt: new Date().toISOString() };
      const snapshotJson = JSON.stringify(snapshot);
      const checksum = crypto.createHash("sha1").update(snapshotJson).digest("hex");

      const now = new Date().toISOString();
      const backupRef = cref.collection("inventoryBackups").doc();
      await backupRef.set({
        id: backupRef.id,
        companyId,
        backupName: payload.backupName.trim(),
        backupType: payload.backupType || "manual",
        notes: payload.notes?.trim() || "",
        itemsCount: items.length,
        movementsCount: movements.length,
        checksum,
        snapshot,
        snapshotSize: snapshotJson.length,
        createdByUserId: request.auth.uid,
        createdByName: request.auth.token.name || "",
        createdAt: now,
      });

      return { success: true, backupId: backupRef.id, itemsCount: items.length, movementsCount: movements.length, checksum };
    } catch (error: any) {
      console.error("[createInventoryBackup] Error:", error);
      throw new HttpsError("internal", error.message || "Error al crear backup");
    }
  }
);
