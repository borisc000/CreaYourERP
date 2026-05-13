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

function companyRef(companyId: string) {
  return db.collection("companies").doc(companyId);
}

// ==========================================
// getRentalDashboard
// ==========================================

export const getRentalDashboard = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");

    const cref = companyRef(companyId);

    const [assetsSnap, contractsSnap, linesSnap] = await Promise.all([
      cref.collection("rentalAssets").limit(500).get(),
      cref.collection("rentalContracts").limit(500).get(),
      cref.collection("rentalContractLines").limit(500).get(),
    ]);

    const assets = assetsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as any));
    const contracts = contractsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as any));
    linesSnap.docs.map((d) => ({ id: d.id, ...d.data() } as any));

    const availableAssets = assets.filter((a: any) => a.status === "available");
    const activeContracts = contracts.filter((c: any) => c.status === "active" || c.status === "dispatched");
    const upcomingReturns = contracts
      .filter((c: any) => c.returnDueDate && !c.actualReturnDate)
      .sort((a: any, b: any) => (a.returnDueDate || "").localeCompare(b.returnDueDate || ""))
      .slice(0, 10);

    const contractsByStatus: Record<string, number> = {};
    contracts.forEach((c: any) => {
      contractsByStatus[c.status] = (contractsByStatus[c.status] || 0) + 1;
    });

    const totalContractValue = contracts.reduce((sum: number, c: any) => sum + (c.contractValue || 0), 0);
    const totalDeposit = contracts.reduce((sum: number, c: any) => sum + (c.depositAmount || 0), 0);

    return {
      stats: {
        totalAssets: assets.length,
        availableAssets: availableAssets.length,
        inMaintenance: assets.filter((a: any) => a.status === "maintenance").length,
        totalContracts: contracts.length,
        activeContracts: activeContracts.length,
        totalContractValue: Math.round(totalContractValue),
        totalDeposit: Math.round(totalDeposit),
      },
      contractsByStatus,
      availableAssets: availableAssets.slice(0, 20),
      activeContracts: activeContracts.slice(0, 20),
      upcomingReturns,
      recentContracts: contracts
        .sort((a: any, b: any) => (b.createdAt || "").localeCompare(a.createdAt || ""))
        .slice(0, 10),
    };
  }
);

// ==========================================
// createRentalAsset
// ==========================================

export const createRentalAsset = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    const { code, name, category, assetType, trackingMode, unit, brand, model, serialNumber, plateNumber, totalQuantity, dailyRate, weeklyRate, monthlyRate, replacementValue, guaranteeRequired, defaultGuaranteeAmount, currentLocation, status } = request.data;
    if (!code || !name) throw new HttpsError("invalid-argument", "code y name requeridos");

    const existing = await db.collection("companies").doc(companyId).collection("rentalAssets").where("code", "==", code).limit(1).get();
    if (!existing.empty) throw new HttpsError("already-exists", "Ya existe un activo con ese código");

    const ref = await db.collection("companies").doc(companyId).collection("rentalAssets").add({
      companyId,
      code,
      name,
      category: category || "General",
      assetType: assetType || "equipment",
      trackingMode: trackingMode || "bulk",
      unit: unit || "und",
      brand: brand || "",
      model: model || "",
      serialNumber: serialNumber || "",
      plateNumber: plateNumber || "",
      totalQuantity: totalQuantity || 0,
      reservedQuantity: 0,
      rentedQuantity: 0,
      dailyRate: dailyRate || 0,
      weeklyRate: weeklyRate || 0,
      monthlyRate: monthlyRate || 0,
      replacementValue: replacementValue || 0,
      guaranteeRequired: guaranteeRequired ?? false,
      defaultGuaranteeAmount: defaultGuaranteeAmount || 0,
      currentLocation: currentLocation || "",
      status: status || "available",
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    return { id: ref.id };
  }
);

// ==========================================
// updateRentalAsset
// ==========================================

export const updateRentalAsset = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    const { id, ...data } = request.data;
    if (!id) throw new HttpsError("invalid-argument", "id requerido");

    await db.collection("companies").doc(companyId).collection("rentalAssets").doc(id).update({
      ...data,
      updatedAt: nowIso(),
    });
    return { updated: true };
  }
);

// ==========================================
// createRentalContract
// ==========================================

export const createRentalContract = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    const { title, leadId, customerId, customerName, sourceType, sourceQuoteId, startDate, endDate, returnDueDate, assignedTo, contractValue, depositAmount, notes, lines } = request.data;
    if (!title) throw new HttpsError("invalid-argument", "title requerido");

    const cref = companyRef(companyId);
    const countSnap = await cref.collection("rentalContracts").count().get();
    const seq = countSnap.data().count + 1;
    const companyShort = companyId.slice(-4).toUpperCase();
    const rentalNumber = `RNT-${companyShort}-${String(seq).padStart(3, "0")}`;

    const contractRef = cref.collection("rentalContracts").doc();
    const contractId = contractRef.id;

    const contractData = {
      companyId,
      rentalNumber,
      title,
      leadId: leadId || "",
      customerId: customerId || "",
      customerName: customerName || "",
      sourceType: sourceType || "",
      sourceQuoteId: sourceQuoteId || "",
      status: "draft",
      precheckStatus: "pending",
      legalStatus: "pending",
      guaranteeStatus: "pending",
      billingStatus: "pending",
      riskLevel: "low",
      startDate: startDate || "",
      endDate: endDate || "",
      dispatchDate: "",
      returnDueDate: returnDueDate || "",
      actualReturnDate: "",
      assignedTo: assignedTo || "",
      contractValue: contractValue || 0,
      depositAmount: depositAmount || 0,
      notes: notes || "",
      closureSummary: "",
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };

    await contractRef.set(contractData);

    // Create lines if provided
    if (Array.isArray(lines) && lines.length > 0) {
      const batch = db.batch();
      for (const line of lines) {
        const lineRef = cref.collection("rentalContractLines").doc();
        batch.set(lineRef, {
          contractId,
          companyId,
          assetId: line.assetId || "",
          assetName: line.assetName || "",
          quantity: line.quantity || 0,
          deliveredQuantity: 0,
          returnedQuantity: 0,
          unitRate: line.unitRate || 0,
          billingCycle: line.billingCycle || "daily",
          subtotal: line.subtotal || 0,
          createdAt: nowIso(),
          updatedAt: nowIso(),
        });
      }
      await batch.commit();
    }

    return { id: contractId, rentalNumber };
  }
);

// ==========================================
// updateRentalContract
// ==========================================

export const updateRentalContract = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    const { id, lines, ...data } = request.data;
    if (!id) throw new HttpsError("invalid-argument", "id requerido");

    const cref = companyRef(companyId);
    const updates: any = { ...data, updatedAt: nowIso() };

    await cref.collection("rentalContracts").doc(id).update(updates);

    // Upsert lines if provided
    if (Array.isArray(lines)) {
      const existingSnap = await cref.collection("rentalContractLines").where("contractId", "==", id).get();
      const existingIds = new Set(existingSnap.docs.map((d) => d.id));
      const batch = db.batch();

      for (const line of lines) {
        if (line.id && existingIds.has(line.id)) {
          batch.update(cref.collection("rentalContractLines").doc(line.id), {
            assetId: line.assetId || "",
            assetName: line.assetName || "",
            quantity: line.quantity || 0,
            unitRate: line.unitRate || 0,
            billingCycle: line.billingCycle || "daily",
            subtotal: line.subtotal || 0,
            updatedAt: nowIso(),
          });
          existingIds.delete(line.id);
        } else {
          const lineRef = cref.collection("rentalContractLines").doc();
          batch.set(lineRef, {
            contractId: id,
            companyId,
            assetId: line.assetId || "",
            assetName: line.assetName || "",
            quantity: line.quantity || 0,
            deliveredQuantity: 0,
            returnedQuantity: 0,
            unitRate: line.unitRate || 0,
            billingCycle: line.billingCycle || "daily",
            subtotal: line.subtotal || 0,
            createdAt: nowIso(),
            updatedAt: nowIso(),
          });
        }
      }

      // Delete removed lines
      for (const removedId of existingIds) {
        batch.delete(cref.collection("rentalContractLines").doc(removedId));
      }

      await batch.commit();
    }

    return { updated: true };
  }
);

// ==========================================
// dispatchRentalContract
// ==========================================

export const dispatchRentalContract = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    const { id, dispatchDate } = request.data;
    if (!id) throw new HttpsError("invalid-argument", "id requerido");

    const cref = companyRef(companyId);
    const contractSnap = await cref.collection("rentalContracts").doc(id).get();
    if (!contractSnap.exists) throw new HttpsError("not-found", "Contrato no encontrado");

    const contract = contractSnap.data() as any;
    if (!["ready", "signed"].includes(contract.legalStatus)) {
      throw new HttpsError("failed-precondition", "El contrato debe tener estado legal ready o signed");
    }
    if (contract.guaranteeStatus !== "ok" && contract.guaranteeStatus !== "waived") {
      throw new HttpsError("failed-precondition", "La garantía debe estar OK o dispensada");
    }

    const linesSnap = await cref.collection("rentalContractLines").where("contractId", "==", id).get();
    const batch = db.batch();

    for (const lineDoc of linesSnap.docs) {
      const line = lineDoc.data() as any;
      const assetId = line.assetId;
      if (!assetId) continue;

      const assetRef = cref.collection("rentalAssets").doc(assetId);
      const assetSnap = await assetRef.get();
      if (assetSnap.exists) {
        const asset = assetSnap.data() as any;
        const newRented = (asset.rentedQuantity || 0) + (line.quantity || 0);
        const newReserved = Math.max(0, (asset.reservedQuantity || 0) - (line.quantity || 0));
        batch.update(assetRef, {
          rentedQuantity: newRented,
          reservedQuantity: newReserved,
          status: newRented >= (asset.totalQuantity || 0) ? "restricted" : asset.status,
          updatedAt: nowIso(),
        });
      }

      batch.update(lineDoc.ref, { deliveredQuantity: line.quantity || 0, updatedAt: nowIso() });
    }

    batch.update(contractSnap.ref, {
      status: "dispatched",
      dispatchDate: dispatchDate || nowIso(),
      updatedAt: nowIso(),
    });

    await batch.commit();
    return { dispatched: true };
  }
);

// ==========================================
// returnRentalContract
// ==========================================

export const returnRentalContract = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    const { id, actualReturnDate, lineReturns } = request.data;
    if (!id) throw new HttpsError("invalid-argument", "id requerido");

    const cref = companyRef(companyId);
    const contractSnap = await cref.collection("rentalContracts").doc(id).get();
    if (!contractSnap.exists) throw new HttpsError("not-found", "Contrato no encontrado");

    const batch = db.batch();
    const linesSnap = await cref.collection("rentalContractLines").where("contractId", "==", id).get();

    for (const lineDoc of linesSnap.docs) {
      const line = lineDoc.data() as any;
      const returnQty = lineReturns?.[lineDoc.id] ?? line.quantity;
      const assetId = line.assetId;

      batch.update(lineDoc.ref, {
        returnedQuantity: returnQty,
        updatedAt: nowIso(),
      });

      if (assetId) {
        const assetRef = cref.collection("rentalAssets").doc(assetId);
        const assetSnap = await assetRef.get();
        if (assetSnap.exists) {
          const asset = assetSnap.data() as any;
          const newRented = Math.max(0, (asset.rentedQuantity || 0) - (returnQty || 0));
          batch.update(assetRef, {
            rentedQuantity: newRented,
            status: newRented === 0 ? "available" : asset.status,
            updatedAt: nowIso(),
          });
        }
      }
    }

    batch.update(contractSnap.ref, {
      actualReturnDate: actualReturnDate || nowIso(),
      status: "returned",
      updatedAt: nowIso(),
    });

    await batch.commit();
    return { returned: true };
  }
);

// ==========================================
// closeRentalContract
// ==========================================

export const closeRentalContract = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    const { id, closureSummary } = request.data;
    if (!id) throw new HttpsError("invalid-argument", "id requerido");

    const cref = companyRef(companyId);
    const linesSnap = await cref.collection("rentalContractLines").where("contractId", "==", id).get();

    const allReturned = linesSnap.docs.every((d) => {
      const line = d.data() as any;
      return (line.returnedQuantity || 0) >= (line.deliveredQuantity || 0);
    });

    if (!allReturned) {
      throw new HttpsError("failed-precondition", "No se puede cerrar: faltan ítems por devolver");
    }

    await cref.collection("rentalContracts").doc(id).update({
      status: "closed",
      closureSummary: closureSummary || "",
      updatedAt: nowIso(),
    });

    return { closed: true };
  }
);
