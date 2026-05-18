import { onCall, HttpsError } from "firebase-functions/v2/https";
import { assertAction } from "../../shared/rbac";
import { db } from "../../config";
import { generateExpenseNumber } from "../expenses/expenseService";

const cors = [
  "http://localhost:5173",
  "http://localhost:5000",
  "https://your-erp.web.app", "https://your-erp-staging.web.app", "https://your-erp-staging.firebaseapp.com",
];

function nowIso() {
  return new Date().toISOString();
}

function computeStockStatus(currentStock: number, minimumStock: number, status: "active" | "inactive"): "healthy" | "low" | "out" | "inactive" {
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

export const getAssetDashboard = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "assets.view", { companyId });

    const assetsSnap = await db.collection("companies").doc(companyId).collection("assets").limit(500).get();
    const maintenanceSnap = await db.collection("companies").doc(companyId).collection("assetMaintenance").limit(100).get();

    const assets = assetsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const maintenance = maintenanceSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    const totalValue = assets.reduce((sum: number, a: any) => sum + (a.currentValue || 0), 0);
    const maintenanceDue = assets.filter((a: any) => {
      if (!a.nextMaintenanceDate) return false;
      return new Date(a.nextMaintenanceDate) <= new Date();
    }).length;

    return {
      stats: {
        totalAssets: assets.length,
        activeAssets: assets.filter((a: any) => a.status === "active").length,
        inMaintenance: assets.filter((a: any) => a.status === "maintenance").length,
        retiredAssets: assets.filter((a: any) => a.status === "retired").length,
        totalValue: Math.round(totalValue),
        maintenanceDue,
        pendingMaintenance: maintenance.filter((m: any) => m.status === "scheduled").length,
      },
      assets: assets.slice(0, 50),
      recentMaintenance: maintenance.slice(0, 10),
    };
  }
);

export const createAsset = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "assets.create", { companyId });
    const { code, name, category, acquisitionDate, acquisitionCost, depreciationRate, location, assignedTo, assignedToName, supplier, serialNumber, brand, model, plateNumber, maintenanceIntervalMonths, notes } = request.data;
    if (!code || !name) throw new HttpsError("invalid-argument", "code y name requeridos");

    const existing = await db.collection("companies").doc(companyId).collection("assets").where("code", "==", code).limit(1).get();
    if (!existing.empty) throw new HttpsError("already-exists", "Ya existe un activo con ese código");

    const currentValue = acquisitionCost || 0;
    const ref = await db.collection("companies").doc(companyId).collection("assets").add({
      companyId, code, name, category: category || "General", status: "active",
      acquisitionDate: acquisitionDate || "", acquisitionCost: acquisitionCost || 0,
      currentValue, depreciationRate: depreciationRate || 0, location: location || "",
      assignedTo: assignedTo || "", assignedToName: assignedToName || "", supplier: supplier || "",
      serialNumber: serialNumber || "", brand: brand || "", model: model || "", plateNumber: plateNumber || "",
      lastMaintenanceDate: "", nextMaintenanceDate: "", maintenanceIntervalMonths: maintenanceIntervalMonths || 6,
      notes: notes || "", createdAt: nowIso(), updatedAt: nowIso(),
    });
    return { id: ref.id };
  }
);

export const updateAsset = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "assets.edit", { companyId });
    const { id, ...data } = request.data;
    if (!id) throw new HttpsError("invalid-argument", "id requerido");

    await db.collection("companies").doc(companyId).collection("assets").doc(id).update({
      ...data, updatedAt: nowIso(),
    });
    return { updated: true };
  }
);

export const deleteAsset = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "assets.delete", { companyId });
    const { id } = request.data;
    if (!id) throw new HttpsError("invalid-argument", "id requerido");

    const maintenance = await db.collection("companies").doc(companyId).collection("assetMaintenance").where("assetId", "==", id).limit(1).get();
    if (!maintenance.empty) throw new HttpsError("failed-precondition", "El activo tiene registros de mantenimiento. No se puede eliminar.");

    await db.collection("companies").doc(companyId).collection("assets").doc(id).delete();
    return { deleted: true };
  }
);

export const createAssetMaintenance = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "assets.create", { companyId });

    const { assetId, maintenanceType, description, cost, performedBy, performedByName, performedDate, nextDueDate, notes, partsUsed } = request.data;
    if (!assetId || !description) throw new HttpsError("invalid-argument", "assetId y description son requeridos");

    const assetSnap = await db.collection("companies").doc(companyId).collection("assets").doc(assetId).get();
    if (!assetSnap.exists) throw new HttpsError("not-found", "Activo no encontrado");
    const assetData = assetSnap.data()!;

    const now = nowIso();
    const maintenanceCost = typeof cost === "number" ? cost : 0;
    const maintenanceRef = db.collection("companies").doc(companyId).collection("assetMaintenance").doc();
    const expenseNumber = partsUsed?.length ? await generateExpenseNumber(companyId) : "";

    const result = await db.runTransaction(async (t) => {
      let totalPartsCost = 0;
      const inventoryMovementIds: string[] = [];

      if (Array.isArray(partsUsed) && partsUsed.length > 0) {
        for (const part of partsUsed) {
          const itemId = part.inventoryItemId || part.itemId;
          const quantity = Math.max(0, Number(part.quantity) || 0);
          if (!itemId || quantity <= 0) continue;

          const itemRef = db.collection("companies").doc(companyId).collection("inventoryItems").doc(itemId);
          const itemSnap = await t.get(itemRef);
          if (!itemSnap.exists) throw new HttpsError("not-found", `Item de inventario no encontrado: ${itemId}`);

          const item = itemSnap.data() as any;
          const stockBefore = Number(item.currentStock) || 0;
          const averageCost = Number(item.averageCost) || 0;

          if (stockBefore < quantity) {
            throw new HttpsError("failed-precondition", `Stock insuficiente para ${item.name || itemId}. Disponible: ${stockBefore}, Requerido: ${quantity}`);
          }

          const stockAfter = stockBefore - quantity;
          const partCost = Math.round(quantity * averageCost * 100) / 100;
          totalPartsCost += partCost;

          const stockStatus = computeStockStatus(stockAfter, item.minimumStock || 0, item.status || "active");
          const healthRatio = computeHealthRatio(stockAfter, item.minimumStock || 0);
          const inventoryValue = computeInventoryValue(stockAfter, averageCost);

          t.update(itemRef, {
            currentStock: stockAfter,
            lastMovementAt: now,
            inventoryValue,
            stockStatus,
            healthRatio,
            needsRestock: stockStatus === "low" || stockStatus === "out",
            updatedAt: now,
          });

          const moveRef = db.collection("companies").doc(companyId).collection("inventoryMovements").doc();
          t.set(moveRef, {
            itemId,
            companyId,
            itemName: item.name || "",
            itemCode: item.code || "",
            itemUnit: item.unit || "",
            movementType: "adjustment_out",
            movementLabel: "Ajuste de salida",
            movementDirection: "out",
            quantity,
            signedQuantity: quantity,
            stockBefore,
            stockAfter,
            unitCost: averageCost,
            totalCost: partCost,
            reference: `Mantenimiento activo: ${assetData.code || assetId}`,
            reason: "Consumo por mantenimiento",
            destination: "",
            deliveredByName: performedByName || "",
            receivedByName: "",
            hasPhotoEvidence: false,
            hasSignatureEvidence: false,
            evidenceAvailable: false,
            evidencePhotoData: "",
            evidenceSignatureData: "",
            notes: `Mantenimiento ${maintenanceRef.id}`,
            performedBy: request.auth!.uid,
            performedByName: request.auth!.token.name || "",
            movementDate: performedDate || now,
            assetMaintenanceId: maintenanceRef.id,
            createdAt: now,
          });
          inventoryMovementIds.push(moveRef.id);
        }
      }

      const totalExpenseCost = Math.round((maintenanceCost + totalPartsCost) * 100) / 100;
      let expenseId = "";

      if (totalExpenseCost > 0) {
        const expenseRef = db.collection("companies").doc(companyId).collection("expenses").doc();
        t.set(expenseRef, {
          id: expenseRef.id,
          companyId,
          expenseNumber,
          scope: "general",
          category: "Mantenimiento",
          leadId: "",
          assetRecordId: assetId,
          assetRecordCode: assetData.code || "",
          assetRecordName: assetData.name || "",
          assetMaintenanceId: maintenanceRef.id,
          expenseDate: (performedDate || now).split("T")[0],
          vendorName: "",
          spenderName: performedByName || "",
          paymentMethod: "",
          documentType: "otro",
          documentNumber: "",
          netAmount: totalExpenseCost,
          taxAmount: 0,
          totalAmount: totalExpenseCost,
          status: "pending_support",
          description: `Mantenimiento ${maintenanceType || "preventive"}: ${description}`,
          notes: notes || "",
          supportFileName: "",
          supportMimeType: "",
          supportData: "",
          recordedByUserId: request.auth!.uid,
          reviewedByUserId: "",
          reviewedAt: "",
          createdAt: now,
          updatedAt: now,
        });
        expenseId = expenseRef.id;
      }

      t.set(maintenanceRef, {
        companyId,
        assetId,
        maintenanceType: maintenanceType || "preventive",
        description,
        cost: maintenanceCost,
        performedBy: performedBy || "",
        performedByName: performedByName || "",
        performedDate: performedDate || now,
        nextDueDate: nextDueDate || "",
        status: "completed",
        notes: notes || "",
        partsUsed: partsUsed || [],
        expenseId,
        inventoryMovementIds,
        createdAt: now,
        updatedAt: now,
      });

      if (nextDueDate) {
        t.update(db.collection("companies").doc(companyId).collection("assets").doc(assetId), {
          lastMaintenanceDate: performedDate || now,
          nextMaintenanceDate: nextDueDate,
          updatedAt: now,
        });
      }

      return { maintenanceId: maintenanceRef.id, expenseId, inventoryMovementIds, totalExpenseCost };
    });

    return { id: result.maintenanceId, ...result };
  }
);
