import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db } from "../../config";

const cors = [
  "http://localhost:5173",
  "http://localhost:5000",
  "https://your-erp.web.app",
];

function nowIso() {
  return new Date().toISOString();
}

export const getAssetDashboard = onCall(
  { region: "us-central1", cors },
  async (request) => {
    const { companyId } = request.data;
    if (!companyId) throw new HttpsError("invalid-argument", "companyId requerido");

    const assetsSnap = await db.collection("companies").doc(companyId).collection("assets").get();
    const maintenanceSnap = await db.collection("companies").doc(companyId).collection("assetMaintenance").get();

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
    const { companyId, code, name, category, acquisitionDate, acquisitionCost, depreciationRate, location, assignedTo, assignedToName, supplier, serialNumber, brand, model, plateNumber, maintenanceIntervalMonths, notes } = request.data;
    if (!companyId || !code || !name) throw new HttpsError("invalid-argument", "companyId, code y name requeridos");

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
    const { companyId, id, ...data } = request.data;
    if (!companyId || !id) throw new HttpsError("invalid-argument", "companyId e id requeridos");

    await db.collection("companies").doc(companyId).collection("assets").doc(id).update({
      ...data, updatedAt: nowIso(),
    });
    return { updated: true };
  }
);

export const deleteAsset = onCall(
  { region: "us-central1", cors },
  async (request) => {
    const { companyId, id } = request.data;
    if (!companyId || !id) throw new HttpsError("invalid-argument", "companyId e id requeridos");

    const maintenance = await db.collection("companies").doc(companyId).collection("assetMaintenance").where("assetId", "==", id).limit(1).get();
    if (!maintenance.empty) throw new HttpsError("failed-precondition", "El activo tiene registros de mantenimiento. No se puede eliminar.");

    await db.collection("companies").doc(companyId).collection("assets").doc(id).delete();
    return { deleted: true };
  }
);

export const createAssetMaintenance = onCall(
  { region: "us-central1", cors },
  async (request) => {
    const { companyId, assetId, maintenanceType, description, cost, performedBy, performedByName, performedDate, nextDueDate, notes } = request.data;
    if (!companyId || !assetId || !description) throw new HttpsError("invalid-argument", "Datos incompletos");

    const ref = await db.collection("companies").doc(companyId).collection("assetMaintenance").add({
      companyId, assetId, maintenanceType: maintenanceType || "preventive", description,
      cost: cost || 0, performedBy: performedBy || "", performedByName: performedByName || "",
      performedDate: performedDate || nowIso(), nextDueDate: nextDueDate || "",
      status: "completed", notes: notes || "", createdAt: nowIso(), updatedAt: nowIso(),
    });

    if (nextDueDate) {
      await db.collection("companies").doc(companyId).collection("assets").doc(assetId).update({
        lastMaintenanceDate: performedDate || nowIso(), nextMaintenanceDate: nextDueDate, updatedAt: nowIso(),
      });
    }

    return { id: ref.id };
  }
);
