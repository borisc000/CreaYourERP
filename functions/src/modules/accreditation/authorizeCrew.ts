import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db } from "../../config";
import {
  cors,
  cleanString,
  companyRef,
} from "./accreditationService";
import { checkCrewCompliance } from "./checkCrewCompliance";

export const authorizeCrew = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }

    const companyId = request.auth.token.companyId as string | undefined;
    if (!companyId) {
      throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    }

    const assignmentIds = request.data?.assignmentIds;
    if (!Array.isArray(assignmentIds) || assignmentIds.length === 0) {
      throw new HttpsError("invalid-argument", "assignmentIds es obligatorio y debe ser un array");
    }

    const now = new Date().toISOString();
    const results: Array<{ id: string; status: string }> = [];

    const collectionRef = companyRef(companyId).collection("crewAssignments");

    await db.runTransaction(async (t) => {
      for (const assignmentId of assignmentIds) {
        const id = cleanString(assignmentId);
        if (!id) continue;

        const docRef = collectionRef.doc(id);
        const snap: FirebaseFirestore.DocumentSnapshot = await t.get(docRef);

        if (!snap.exists) {
          results.push({ id, status: "not_found" });
          continue;
        }

        const data: FirebaseFirestore.DocumentData | undefined = snap.data();
        if (data?.companyId && data.companyId !== companyId) {
          results.push({ id, status: "permission_denied" });
          continue;
        }

        if (data?.status === "removed") {
          results.push({ id, status: "already_removed" });
          continue;
        }

        // BLOQUEO CRÍTICO: no autorizar si el compliance indica revalidación requerida
        if (data?.authorizationStatus === "requires_revalidation") {
          results.push({ id, status: "requires_revalidation" });
          continue;
        }

        t.update(docRef, {
          status: "active",
          authorizationStatus: "authorized",
          authorizedAt: now,
          authorizedBy: request.auth!.uid,
        });

        results.push({ id, status: "authorized" });
      }
    });

    // Post-transacción: recompute compliance para los autorizados exitosamente
    for (const result of results) {
      if (result.status !== "authorized") continue;

      try {
        const snap = await collectionRef.doc(result.id).get();
        const data = snap.data();
        if (data) {
          await checkCrewCompliance(companyId, result.id, {
            serviceOrderId: data.serviceOrderId,
            employeeId: data.employeeId,
            role: data.role || "worker",
          });
        }
      } catch (err: any) {
        console.error(`[authorizeCrew] Recompute falló para ${result.id}:`, err);
      }
    }

    return { results, authorizedAt: now };
  }
);
