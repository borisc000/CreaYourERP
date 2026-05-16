import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db } from "../../config";
import {
  cors,
  cleanString,
  companyRef,
} from "./accreditationService";

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

        t.update(docRef, {
          status: "active",
          authorizationStatus: "authorized",
          authorizedAt: now,
          authorizedBy: request.auth!.uid,
        });

        results.push({ id, status: "authorized" });
      }
    });

    return { results, authorizedAt: now };
  }
);
