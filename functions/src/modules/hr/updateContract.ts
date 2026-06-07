import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db } from "../../config";
import { assertAction } from "../../shared/rbac";
import { cors, cleanString, companyRef } from "./hrService";

const VALID_STATUSES = ["draft", "active", "expired", "terminated"];
const VALID_CONTRACT_TYPES = new Set(["indefinite", "fixed_term", "internship", "services"]);

export const updateContract = onCall(
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

    const contractId = cleanString(request.data?.id || request.data?.contractId);
    if (!contractId) {
      throw new HttpsError("invalid-argument", "contractId es obligatorio");
    }

    const data = request.data || {};
    const contractRef = companyRef(companyId).collection("contracts").doc(contractId);
    const contractSnap = await contractRef.get();
    if (!contractSnap.exists) {
      throw new HttpsError("not-found", "Contrato no encontrado");
    }

    const contract = contractSnap.data() || {};
    if (cleanString(contract.companyId) && cleanString(contract.companyId) !== companyId) {
      throw new HttpsError("permission-denied", "No tienes acceso a este contrato");
    }

    const now = new Date().toISOString();
    const updateData: Record<string, unknown> = { updatedAt: now, updatedBy: request.auth.uid };

    if (data.contractType !== undefined && VALID_CONTRACT_TYPES.has(cleanString(data.contractType))) {
      updateData.contractType = cleanString(data.contractType);
    }
    if (data.startDate !== undefined) updateData.startDate = cleanString(data.startDate) || null;
    if (data.endDate !== undefined) updateData.endDate = cleanString(data.endDate) || null;
    if (data.salaryAmount !== undefined) {
      updateData.salaryAmount = typeof data.salaryAmount === "number" ? data.salaryAmount : null;
    }
    if (data.workSchedule !== undefined) updateData.workSchedule = cleanString(data.workSchedule) || null;
    if (data.shiftPattern !== undefined) updateData.shiftPattern = cleanString(data.shiftPattern) || null;
    if (data.workLocation !== undefined) updateData.workLocation = cleanString(data.workLocation) || null;
    if (data.assignedCustomer !== undefined) updateData.assignedCustomer = cleanString(data.assignedCustomer) || null;
    if (data.assignedService !== undefined) updateData.assignedService = cleanString(data.assignedService) || null;
    if (data.notes !== undefined) updateData.notes = cleanString(data.notes) || null;

    const newStatus = cleanString(data.status);
    const oldStatus = cleanString(contract.status);
    const statusChanged = newStatus && newStatus !== oldStatus;

    if (statusChanged) {
      if (!VALID_STATUSES.includes(newStatus)) {
        throw new HttpsError("invalid-argument", "Estado de contrato no válido");
      }
      updateData.status = newStatus;
    }

    await db.runTransaction(async (t) => {
      t.update(contractRef, updateData);

      if (statusChanged) {
        const employeeId = cleanString(contract.employeeId);
        const employeeRef = companyRef(companyId).collection("employees").doc(employeeId);

        if (newStatus === "active") {
          t.update(employeeRef, {
            hireDate: updateData.startDate || contract.startDate || null,
            status: "active",
            baseSalary: updateData.salaryAmount !== undefined ? updateData.salaryAmount : contract.salaryAmount || null,
            updatedAt: now,
          });
          t.set(companyRef(companyId).collection("employmentStatusEvents").doc(), {
            companyId,
            employeeId,
            eventType: "hired",
            previousStatus: oldStatus,
            newStatus: "active",
            reason: `Contrato ${contractId} activado`,
            effectiveDate: updateData.startDate || contract.startDate || now,
            processedBy: uid,
            createdAt: now,
          });
        } else if (newStatus === "terminated") {
          // Verificar si hay otros contratos activos
          const otherActiveSnap = await companyRef(companyId)
            .collection("contracts")
            .where("employeeId", "==", employeeId)
            .where("status", "==", "active")
            .where("__name__", "!=", contractId)
            .limit(1)
            .get();

          if (otherActiveSnap.empty) {
            t.update(employeeRef, {
              status: "inactive",
              terminationDate: now,
              updatedAt: now,
            });
          }
          t.set(companyRef(companyId).collection("employmentStatusEvents").doc(), {
            companyId,
            employeeId,
            eventType: "terminated",
            previousStatus: oldStatus,
            newStatus: "terminated",
            reason: `Contrato ${contractId} terminado`,
            effectiveDate: now,
            processedBy: uid,
            createdAt: now,
          });
        }
      }

      t.set(companyRef(companyId).collection("activityLogs").doc(), {
        companyId,
        type: "contract.updated",
        contractId,
        employeeId: contract.employeeId,
        message: `Contrato ${contractId} actualizado`,
        userId: uid,
        metadata: { statusChanged, oldStatus, newStatus: newStatus || oldStatus },
        createdAt: now,
      });
    });

    return { id: contractId, updated: true };
  }
);
