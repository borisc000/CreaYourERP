import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db } from "../../config";
import { assertAction } from "../../shared/rbac";
import { cors, cleanString, companyRef, getEmployee } from "./hrService";

const VALID_CONTRACT_TYPES = new Set(["indefinite", "fixed_term", "internship", "services"]);

function validateContractInput(data: Record<string, unknown>): string | null {
  const employeeId = cleanString(data.employeeId);
  if (!employeeId) return "employeeId es obligatorio";

  const contractType = cleanString(data.contractType);
  if (!VALID_CONTRACT_TYPES.has(contractType)) return "Tipo de contrato no válido";

  const startDate = cleanString(data.startDate);
  if (!startDate) return "Fecha de inicio es obligatoria";

  const status = cleanString(data.status) || "draft";
  if (!["draft", "active", "expired", "terminated"].includes(status)) {
    return "Estado de contrato no válido";
  }

  const salaryAmount = data.salaryAmount;
  if (salaryAmount !== undefined && salaryAmount !== null && (typeof salaryAmount !== "number" || salaryAmount < 0)) {
    return "El salario debe ser un número positivo";
  }

  return null;
}

export const createContract = onCall(
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

    const data = request.data || {};

    const validationError = validateContractInput(data);
    if (validationError) {
      throw new HttpsError("invalid-argument", validationError);
    }

    const employeeId = cleanString(data.employeeId);
    const employee = await getEmployee(companyId, employeeId);
    if (!employee) {
      throw new HttpsError("not-found", "Empleado no encontrado");
    }
    if (cleanString(employee.companyId) && cleanString(employee.companyId) !== companyId) {
      throw new HttpsError("permission-denied", "No tienes acceso a este empleado");
    }

    const now = new Date().toISOString();
    const status = cleanString(data.status) || "draft";

    const contractRef = companyRef(companyId).collection("contracts").doc();
    const contractData = {
      companyId,
      employeeId,
      contractType: cleanString(data.contractType),
      status,
      startDate: cleanString(data.startDate),
      endDate: cleanString(data.endDate) || null,
      salaryAmount: typeof data.salaryAmount === "number" ? data.salaryAmount : null,
      workSchedule: cleanString(data.workSchedule) || null,
      shiftPattern: cleanString(data.shiftPattern) || null,
      workLocation: cleanString(data.workLocation) || null,
      assignedCustomer: cleanString(data.assignedCustomer) || null,
      assignedService: cleanString(data.assignedService) || null,
      notes: cleanString(data.notes) || null,
      createdAt: now,
      updatedAt: now,
      createdBy: uid,
    };

    await db.runTransaction(async (t) => {
      t.set(contractRef, contractData);

      // Si el contrato se crea como activo, actualizar empleado
      if (status === "active") {
        t.update(companyRef(companyId).collection("employees").doc(employeeId), {
          hireDate: cleanString(data.startDate),
          status: "active",
          baseSalary: typeof data.salaryAmount === "number" ? data.salaryAmount : null,
          updatedAt: now,
        });
        t.set(companyRef(companyId).collection("employmentStatusEvents").doc(), {
          companyId,
          employeeId,
          eventType: "hired",
          newStatus: "active",
          reason: `Contrato ${contractRef.id} creado como activo`,
          effectiveDate: cleanString(data.startDate),
          processedBy: uid,
          createdAt: now,
        });
      }

      t.set(companyRef(companyId).collection("activityLogs").doc(), {
        companyId,
        type: "contract.created",
        employeeId,
        contractId: contractRef.id,
        message: `Contrato ${contractData.contractType} creado para ${employee.fullName || employeeId}`,
        userId: uid,
        metadata: { contractType: contractData.contractType, status },
        createdAt: now,
      });
    });

    return { id: contractRef.id, created: true };
  }
);
