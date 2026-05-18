import { onCall, HttpsError } from "firebase-functions/v2/https";
import { assertAction } from "../../shared/rbac";
import { db } from "../../config";

const cors = [
  "http://localhost:5173",
  "http://localhost:5000",
  "https://your-erp.web.app", "https://your-erp-staging.web.app", "https://your-erp-staging.firebaseapp.com",
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
    await assertAction(request, "rentals.view", { companyId });

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
    await assertAction(request, "rentals.create", { companyId });
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
    await assertAction(request, "rentals.edit", { companyId });
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
    await assertAction(request, "rentals.create", { companyId });
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
// updateRentalContract (with transition validation + lead side effects)
// ==========================================

const VALID_TRANSITIONS: Record<string, string[]> = {
  draft: ["precheck", "quoted", "approved", "reserved", "contracted", "dispatched", "cancelled"],
  precheck: ["quoted", "approved", "reserved", "contracted", "dispatched", "cancelled"],
  quoted: ["approved", "reserved", "contracted", "dispatched", "cancelled"],
  approved: ["reserved", "contracted", "dispatched", "cancelled"],
  reserved: ["contracted", "dispatched", "cancelled"],
  contracted: ["dispatched", "cancelled"],
  dispatched: ["active", "returned", "cancelled"],
  active: ["returned", "cancelled"],
  returned: ["closed", "cancelled"],
  closed: [],
  cancelled: [],
};

export const updateRentalContract = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "rentals.edit", { companyId });
    const { id, lines, ...data } = request.data;
    if (!id) throw new HttpsError("invalid-argument", "id requerido");

    const cref = companyRef(companyId);
    const contractRef = cref.collection("rentalContracts").doc(id);
    const contractSnap = await contractRef.get();
    if (!contractSnap.exists) throw new HttpsError("not-found", "Contrato no encontrado");

    const before = contractSnap.data() as any;
    const currentStatus = before.status || "draft";

    // Validate status transition
    if (data.status && data.status !== currentStatus) {
      const allowed = VALID_TRANSITIONS[currentStatus] || [];
      if (!allowed.includes(data.status)) {
        throw new HttpsError("failed-precondition", `Transición no permitida: ${currentStatus} → ${data.status}`);
      }
    }

    const updates: any = { ...data, updatedAt: nowIso() };
    await contractRef.update(updates);

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

      for (const removedId of existingIds) {
        batch.delete(cref.collection("rentalContractLines").doc(removedId));
      }

      await batch.commit();
    }

    // Lead-change side effects
    if (data.leadId !== undefined && data.leadId !== before.leadId) {
      const userId = request.auth?.uid || "";
      const now = nowIso();
      // Event for old lead unlink
      if (before.leadId) {
        await cref.collection("rentalEvents").add({
          contractId: id,
          companyId,
          userId,
          eventType: "lead_unlinked",
          title: "Lead desvinculado",
          details: `Lead anterior: ${before.leadId}`,
          eventAt: now,
          createdAt: now,
        });
      }
      // Event for new lead link
      if (data.leadId) {
        await cref.collection("rentalEvents").add({
          contractId: id,
          companyId,
          userId,
          eventType: "lead_linked",
          title: "Lead vinculado",
          details: `Nuevo lead: ${data.leadId}`,
          eventAt: now,
          createdAt: now,
        });
      }
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
    await assertAction(request, "rentals.create", { companyId });
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
    await assertAction(request, "rentals.edit", { companyId });
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
    await assertAction(request, "rentals.edit", { companyId });
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


// ==========================================
// createRentalGuarantee
// ==========================================

export const createRentalGuarantee = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "rentals.manage_guarantees", { companyId });

    const { contractId, guaranteeType, amount, currency, reference, status, receivedAt, releasedAt, notes, documentUrl } = request.data;
    if (!contractId) throw new HttpsError("invalid-argument", "contractId requerido");

    const cref = companyRef(companyId);
    const contractSnap = await cref.collection("rentalContracts").doc(contractId).get();
    if (!contractSnap.exists) throw new HttpsError("not-found", "Contrato no encontrado");

    const ref = cref.collection("rentalGuarantees").doc();
    const now = nowIso();
    await ref.set({
      contractId,
      companyId,
      guaranteeType: guaranteeType || "other",
      amount: amount || 0,
      currency: currency || "CLP",
      reference: reference || "",
      status: status || "pending",
      receivedAt: receivedAt || "",
      releasedAt: releasedAt || "",
      notes: notes || "",
      documentUrl: documentUrl || "",
      createdAt: now,
    });

    // Sync contract guaranteeStatus & depositAmount
    const guaranteeStatus = status || "pending";
    const depositAmount = amount || 0;
    await cref.collection("rentalContracts").doc(contractId).update({
      guaranteeStatus,
      depositAmount,
      updatedAt: now,
    });

    // Timeline event
    await cref.collection("rentalEvents").add({
      contractId,
      companyId,
      userId: request.auth?.uid || "",
      eventType: "guarantee",
      title: "Garantía registrada",
      details: `Tipo: ${guaranteeType}, Monto: ${amount} ${currency}`,
      eventAt: now,
      createdAt: now,
    });

    return { id: ref.id };
  }
);

// ==========================================
// updateRentalGuarantee
// ==========================================

export const updateRentalGuarantee = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "rentals.manage_guarantees", { companyId });

    const { id, ...data } = request.data;
    if (!id) throw new HttpsError("invalid-argument", "id requerido");

    const cref = companyRef(companyId);
    const snap = await cref.collection("rentalGuarantees").doc(id).get();
    if (!snap.exists) throw new HttpsError("not-found", "Garantía no encontrada");

    const now = nowIso();
    await cref.collection("rentalGuarantees").doc(id).update({ ...data, updatedAt: now });

    // Sync contract if status or amount changed
    if (data.status || data.amount !== undefined) {
      const guarantee = { ...snap.data(), ...data } as any;
      await cref.collection("rentalContracts").doc(guarantee.contractId).update({
        guaranteeStatus: guarantee.status,
        depositAmount: guarantee.amount || 0,
        updatedAt: now,
      });
    }

    return { updated: true };
  }
);

// ==========================================
// deleteRentalGuarantee
// ==========================================

export const deleteRentalGuarantee = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "rentals.manage_guarantees", { companyId });

    const { id } = request.data;
    if (!id) throw new HttpsError("invalid-argument", "id requerido");

    const cref = companyRef(companyId);
    const snap = await cref.collection("rentalGuarantees").doc(id).get();
    if (!snap.exists) throw new HttpsError("not-found", "Garantía no encontrada");

    const guarantee = snap.data() as any;
    await cref.collection("rentalGuarantees").doc(id).delete();

    // Re-sync contract guaranteeStatus from latest guarantee
    const latestSnap = await cref
      .collection("rentalGuarantees")
      .where("contractId", "==", guarantee.contractId)
      .orderBy("createdAt", "desc")
      .limit(1)
      .get();

    const newStatus = latestSnap.empty ? "pending" : (latestSnap.docs[0].data().status as string);
    const newAmount = latestSnap.empty ? 0 : (latestSnap.docs[0].data().amount as number) || 0;
    await cref.collection("rentalContracts").doc(guarantee.contractId).update({
      guaranteeStatus: newStatus,
      depositAmount: newAmount,
      updatedAt: nowIso(),
    });

    return { deleted: true };
  }
);

// ==========================================
// createRentalEvent
// ==========================================

export const createRentalEvent = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "rentals.view_timeline", { companyId });

    const { contractId, eventType, title, details, payload } = request.data;
    if (!contractId || !eventType || !title) throw new HttpsError("invalid-argument", "contractId, eventType y title requeridos");

    const cref = companyRef(companyId);
    const now = nowIso();
    const ref = await cref.collection("rentalEvents").add({
      contractId,
      companyId,
      userId: request.auth?.uid || "",
      eventType,
      title,
      details: details || "",
      payload: payload || {},
      eventAt: now,
      createdAt: now,
    });

    return { id: ref.id };
  }
);

// ==========================================
// getRentalTimeline
// ==========================================

export const getRentalTimeline = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "rentals.view_timeline", { companyId });

    const { contractId } = request.data;
    if (!contractId) throw new HttpsError("invalid-argument", "contractId requerido");

    const snap = await companyRef(companyId)
      .collection("rentalEvents")
      .where("contractId", "==", contractId)
      .orderBy("eventAt", "desc")
      .limit(200)
      .get();

    const events = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    return { events };
  }
);

// ==========================================
// createRentalBackup
// ==========================================

import { createHash } from "crypto";

export const createRentalBackup = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "rentals.create_backup", { companyId });

    const { contractId, backupName } = request.data;
    if (!contractId) throw new HttpsError("invalid-argument", "contractId requerido");

    const cref = companyRef(companyId);
    const contractSnap = await cref.collection("rentalContracts").doc(contractId).get();
    if (!contractSnap.exists) throw new HttpsError("not-found", "Contrato no encontrado");

    const contract = contractSnap.data() as any;

    const [linesSnap, guaranteesSnap, eventsSnap, backupsSnap] = await Promise.all([
      cref.collection("rentalContractLines").where("contractId", "==", contractId).get(),
      cref.collection("rentalGuarantees").where("contractId", "==", contractId).get(),
      cref.collection("rentalEvents").where("contractId", "==", contractId).orderBy("eventAt", "desc").limit(100).get(),
      cref.collection("rentalBackups").where("contractId", "==", contractId).orderBy("createdAt", "desc").limit(20).get(),
    ]);

    const lines = linesSnap.docs.map((d) => d.data());
    const guarantees = guaranteesSnap.docs.map((d) => d.data());
    const timeline = eventsSnap.docs.map((d) => d.data());
    const previousBackups = backupsSnap.docs.map((d) => d.data());

    const requestedQty = lines.reduce((sum: number, l: any) => sum + (l.quantity || 0), 0);
    const deliveredQty = lines.reduce((sum: number, l: any) => sum + (l.deliveredQuantity || 0), 0);
    const returnedQty = lines.reduce((sum: number, l: any) => sum + (l.returnedQuantity || 0), 0);

    const snapshot = {
      contract: { id: contractSnap.id, ...contract },
      lines,
      guarantees,
      timeline,
      backups: previousBackups,
      totals: {
        requested_quantity: requestedQty,
        delivered_quantity: deliveredQty,
        returned_quantity: returnedQty,
        pending_delivery_quantity: Math.max(0, requestedQty - deliveredQty),
        pending_return_quantity: Math.max(0, deliveredQty - returnedQty),
        contract_value: Math.max(contract.contractValue || 0, 0),
      },
      captured_at: nowIso(),
    };

    const snapshotJson = JSON.stringify(snapshot, Object.keys(snapshot).sort(), 0);
    const checksum = createHash("sha256").update(snapshotJson, "utf-8").digest("hex");

    const ref = await cref.collection("rentalBackups").add({
      contractId,
      companyId,
      backupName: backupName || `Backup ${nowIso()}`,
      checksum,
      snapshotSize: snapshotJson.length,
      snapshotJson,
      createdByUserId: request.auth?.uid || "",
      createdAt: nowIso(),
    });

    // Timeline event
    await cref.collection("rentalEvents").add({
      contractId,
      companyId,
      userId: request.auth?.uid || "",
      eventType: "backup",
      title: "Backup creado",
      details: `Checksum: ${checksum.slice(0, 16)}…`,
      eventAt: nowIso(),
      createdAt: nowIso(),
    });

    return { id: ref.id, checksum };
  }
);

// ==========================================
// recomputeAssetAllocations
// ==========================================

export const recomputeAssetAllocations = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "rentals.recompute_allocations", { companyId });

    const cref = companyRef(companyId);

    // Read all contracts except cancelled/closed/draft/quoted (keep returned)
    const contractsSnap = await cref
      .collection("rentalContracts")
      .where("status", "not-in", ["cancelled", "closed", "draft", "quoted"])
      .limit(500)
      .get();

    const contractIds = contractsSnap.docs.map((d) => d.id);
    if (contractIds.length === 0) return { recomputed: 0 };

    // Read all lines for these contracts (Firestore "in" max 30, so batch)
    const linesByContract: Record<string, any[]> = {};
    const batches: string[][] = [];
    for (let i = 0; i < contractIds.length; i += 30) {
      batches.push(contractIds.slice(i, i + 30));
    }

    for (const batchIds of batches) {
      const snap = await cref.collection("rentalContractLines").where("contractId", "in", batchIds).get();
      for (const doc of snap.docs) {
        const d = doc.data();
        if (!linesByContract[d.contractId]) linesByContract[d.contractId] = [];
        linesByContract[d.contractId].push(d);
      }
    }

    // Accumulate per asset
    const byAsset: Record<string, { reserved: number; rented: number }> = {};

    for (const contractDoc of contractsSnap.docs) {
      const contract = contractDoc.data() as any;
      const lines = linesByContract[contractDoc.id] || [];
      const status = contract.status;

      for (const line of lines) {
        const assetId = line.assetId;
        if (!assetId) continue;
        if (!byAsset[assetId]) byAsset[assetId] = { reserved: 0, rented: 0 };

        const requested = line.quantity || 0;
        const delivered = line.deliveredQuantity || 0;
        const returned = line.returnedQuantity || 0;

        const rented = Math.max(delivered - returned, 0);
        let reserved = 0;
        if (["reserved", "contracted", "approved", "dispatched", "active"].includes(status)) {
          reserved = Math.max(requested - delivered, 0);
        }

        byAsset[assetId].rented += rented;
        byAsset[assetId].reserved += reserved;
      }
    }

    // Persist
    const batch = db.batch();
    for (const [assetId, stats] of Object.entries(byAsset)) {
      const ref = cref.collection("rentalAssets").doc(assetId);
      batch.update(ref, {
        reservedQuantity: Math.round(stats.reserved * 100) / 100,
        rentedQuantity: Math.round(stats.rented * 100) / 100,
        updatedAt: nowIso(),
      });
    }
    await batch.commit();

    return { recomputed: Object.keys(byAsset).length };
  }
);
