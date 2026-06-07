import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db } from "../../config";
import { assertAction } from "../../shared/rbac";
import { cors, cleanString, companyRef } from "./hrService";

export const deleteContract = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }

    const companyId = request.auth.token.companyId as string | undefined;
    if (!companyId) {
      throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    }

    await assertAction(request, "hr.manage_contracts", { companyId });
    const uid = request.auth.uid;

    const contractId = cleanString(request.data?.contractId);
    if (!contractId) {
      throw new HttpsError("invalid-argument", "contractId es obligatorio");
    }

    const contractRef = companyRef(companyId).collection("contracts").doc(contractId);
    const contractSnap = await contractRef.get();
    if (!contractSnap.exists) {
      throw new HttpsError("not-found", "Contrato no encontrado");
    }

    const contract = contractSnap.data() || {};
    if (cleanString(contract.companyId) && cleanString(contract.companyId) !== companyId) {
      throw new HttpsError("permission-denied", "No tienes acceso a este contrato");
    }

    const employeeId = cleanString(contract.employeeId);
    const now = new Date().toISOString();

    await db.runTransaction(async (t) => {
      t.delete(contractRef);

      // Si el contrato eliminado estaba activo, verificar si quedan otros activos
      if (cleanString(contract.status) === "active") {
        const otherActiveSnap = await companyRef(companyId)
          .collection("contracts")
          .where("employeeId", "==", employeeId)
          .where("status", "==", "active")
          .where("__name__", "!=", contractId)
          .limit(1)
          .get();

        if (otherActiveSnap.empty) {
          t.update(companyRef(companyId).collection("employees").doc(employeeId), {
            status: "inactive",
            updatedAt: now,
          });
          t.set(companyRef(companyId).collection("employmentStatusEvents").doc(), {
            companyId,
            employeeId,
            eventType: "terminated",
            previousStatus: "active",
            newStatus: "inactive",
            reason: `Último contrato activo eliminado (${contractId})`,
            effectiveDate: now,
            processedBy: uid,
            createdAt: now,
          });
        }
      }

      t.set(companyRef(companyId).collection("activityLogs").doc(), {
        companyId,
        type: "contract.deleted",
        contractId,
        employeeId,
        message: `Contrato ${contractId} eliminado`,
        userId: uid,
        metadata: { contractType: contract.contractType, status: contract.status },
        createdAt: now,
      });
    });

    return { id: contractId, deleted: true };
  }
);
