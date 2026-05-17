/**
 * CAF (Código de Autorización de Folios) management for Chilean SII DTEs
 * - uploadCafRange: Registers a new CAF range for a document type
 * - getNextFolio: Atomically reserves the next available folio
 * - reserveFolio: Internal helper for SII provider simulation
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db } from "../../config";
import { assertAction } from "../../shared/rbac";

export interface FolioReservation {
  folio: number;
  cafRangeId: string;
}

function companyRef(companyId: string) {
  return db.collection("companies").doc(companyId);
}

const cors = [
  "https://your-erp.web.app",
  "https://your-erp-staging.web.app",
  "https://your-erp-staging.firebaseapp.com",
  "http://localhost:5173",
];

// ==========================================
// uploadCafRange
// ==========================================

interface UploadCafPayload {
  documentType: "33" | "34" | "61" | "56";
  startFolio: number;
  endFolio: number;
  cafXmlBase64?: string;
}

export const uploadCafRange = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }
    const companyId = request.auth.token.companyId as string | undefined;
    if (!companyId) {
      throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    }
    await assertAction(request, "billing.manage_caf", { companyId });

    const payload = request.data as UploadCafPayload;
    const startFolio = Math.max(1, Math.round(Number(payload.startFolio) || 0));
    const endFolio = Math.max(1, Math.round(Number(payload.endFolio) || 0));

    if (!payload.documentType) {
      throw new HttpsError("invalid-argument", "documentType es requerido");
    }
    if (startFolio > endFolio) {
      throw new HttpsError("invalid-argument", "startFolio no puede ser mayor que endFolio");
    }

    try {
      const cref = companyRef(companyId);

      // Check for overlapping active ranges
      const existingSnap = await cref
        .collection("billingCafRanges")
        .where("documentType", "==", payload.documentType)
        .where("isActive", "==", true)
        .get();

      for (const doc of existingSnap.docs) {
        const data = doc.data() as any;
        const existingStart = data.startFolio;
        const existingEnd = data.endFolio;
        // Overlap check: [startFolio, endFolio] intersects [existingStart, existingEnd]
        if (startFolio <= existingEnd && endFolio >= existingStart) {
          throw new HttpsError(
            "already-exists",
            `Rango solapado con CAF existente ${existingStart}-${existingEnd}`
          );
        }
      }

      const ref = cref.collection("billingCafRanges").doc();
      const now = new Date().toISOString();
      await ref.set({
        id: ref.id,
        companyId,
        documentType: payload.documentType,
        startFolio,
        endFolio,
        nextFolio: startFolio,
        cafXmlBase64: payload.cafXmlBase64 || "",
        uploadDate: now,
        isActive: true,
        createdAt: now,
      });

      return { success: true, cafRangeId: ref.id, startFolio, endFolio };
    } catch (error: any) {
      console.error("[uploadCafRange] Error:", error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", error.message || "Error al cargar CAF");
    }
  }
);

// ==========================================
// getNextFolio
// ==========================================

interface GetNextFolioPayload {
  documentType: "33" | "34" | "61" | "56";
}

export const getNextFolio = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }
    const companyId = request.auth.token.companyId as string | undefined;
    if (!companyId) {
      throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    }
    await assertAction(request, "billing.manage_caf", { companyId });

    const payload = request.data as GetNextFolioPayload;
    if (!payload.documentType) {
      throw new HttpsError("invalid-argument", "documentType es requerido");
    }

    try {
      const cref = companyRef(companyId);

      // Firestore doesn't support range queries on nextFolio <= endFolio directly with inequality on different fields.
      // We query active ranges ordered by nextFolio and check in memory.
      const rangesSnap = await cref
        .collection("billingCafRanges")
        .where("documentType", "==", payload.documentType)
        .where("isActive", "==", true)
        .orderBy("nextFolio", "asc")
        .limit(10)
        .get();

      let selectedId = "";
      let selectedFolio = 0;
      for (const doc of rangesSnap.docs) {
        const data = doc.data() as any;
        if (data.nextFolio <= data.endFolio) {
          selectedId = doc.id;
          selectedFolio = data.nextFolio;
          break;
        }
      }

      if (!selectedId) {
        throw new HttpsError("failed-precondition", "No hay folios CAF disponibles para este tipo de documento");
      }

      // Atomically increment nextFolio
      const rangeRef = cref.collection("billingCafRanges").doc(selectedId);
      await db.runTransaction(async (tx) => {
        const snap = await tx.get(rangeRef);
        if (!snap.exists) {
          throw new HttpsError("not-found", "Rango CAF no encontrado");
        }
        const data = snap.data() as any;
        if (data.nextFolio > data.endFolio) {
          throw new HttpsError("failed-precondition", "Rango CAF agotado");
        }
        tx.update(rangeRef, { nextFolio: data.nextFolio + 1 });
      });

      return { success: true, folio: selectedFolio, cafRangeId: selectedId };
    } catch (error: any) {
      console.error("[getNextFolio] Error:", error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", error.message || "Error al obtener folio");
    }
  }
);

// ==========================================
// Internal: reserveFolio (used by SII provider)
// ==========================================

export async function reserveFolio(
  companyId: string,
  documentType: string
): Promise<FolioReservation> {
  const cref = companyRef(companyId);
  const rangesSnap = await cref
    .collection("billingCafRanges")
    .where("documentType", "==", documentType)
    .where("isActive", "==", true)
    .orderBy("nextFolio", "asc")
    .limit(10)
    .get();

  let selectedId = "";
  let selectedFolio = 0;
  for (const doc of rangesSnap.docs) {
    const data = doc.data() as any;
    if (data.nextFolio <= data.endFolio) {
      selectedId = doc.id;
      selectedFolio = data.nextFolio;
      break;
    }
  }

  if (!selectedId) {
    throw new Error("No hay folios CAF disponibles para este tipo de documento");
  }

  const rangeRef = cref.collection("billingCafRanges").doc(selectedId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(rangeRef);
    if (!snap.exists) throw new Error("Rango CAF no encontrado");
    const data = snap.data() as any;
    if (data.nextFolio > data.endFolio) throw new Error("Rango CAF agotado");
    tx.update(rangeRef, { nextFolio: data.nextFolio + 1 });
  });

  return { folio: selectedFolio, cafRangeId: selectedId };
}
