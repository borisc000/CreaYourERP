import { onCall, HttpsError } from "firebase-functions/v2/https";
import { assertAction } from "../../shared/rbac";
import {
  cors,
  cleanString,
  companyRef,
  validateEmployeeInput,
  getEmployee,
} from "./hrService";

export const updateEmployee = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }

    const companyId = request.auth.token.companyId as string | undefined;
    if (!companyId) {
      throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    }

    await assertAction(request, "hr.edit_employee", { companyId });

    const employeeId = cleanString(request.data?.id || request.data?.employeeId);
    if (!employeeId) {
      throw new HttpsError("invalid-argument", "employeeId es obligatorio");
    }

    const data = request.data || {};

    const employee = await getEmployee(companyId, employeeId);
    if (!employee) {
      throw new HttpsError("not-found", "Empleado no encontrado");
    }
    if (cleanString(employee.companyId) && cleanString(employee.companyId) !== companyId) {
      throw new HttpsError("permission-denied", "No tienes acceso a este empleado");
    }

    const validationError = validateEmployeeInput(data);
    if (validationError) {
      throw new HttpsError("invalid-argument", validationError);
    }

    const now = new Date().toISOString();
    const updateData: Record<string, unknown> = {
      updatedAt: now,
      updatedBy: request.auth.uid,
    };

    if (data.firstName !== undefined) updateData.firstName = cleanString(data.firstName);
    if (data.lastName !== undefined) updateData.lastName = cleanString(data.lastName);
    if (data.firstName !== undefined || data.lastName !== undefined) {
      updateData.fullName = `${cleanString(data.firstName ?? employee.firstName)} ${cleanString(data.lastName ?? employee.lastName)}`;
    }
    if (data.email !== undefined) updateData.email = cleanString(data.email).toLowerCase();
    if (data.workEmail !== undefined) updateData.workEmail = cleanString(data.workEmail).toLowerCase() || null;
    if (data.personalEmail !== undefined) updateData.personalEmail = cleanString(data.personalEmail).toLowerCase() || null;
    if (data.phone !== undefined) updateData.phone = cleanString(data.phone) || null;
    if (data.alternatePhone !== undefined) updateData.alternatePhone = cleanString(data.alternatePhone) || null;
    if (data.cedula !== undefined) updateData.cedula = cleanString(data.cedula) || null;
    if (data.birthDate !== undefined) updateData.birthDate = cleanString(data.birthDate) || null;
    if (data.gender !== undefined) updateData.gender = cleanString(data.gender) || null;
    if (data.maritalStatus !== undefined) updateData.maritalStatus = cleanString(data.maritalStatus) || null;
    if (data.nationality !== undefined) updateData.nationality = cleanString(data.nationality) || null;
    if (data.address !== undefined) updateData.address = cleanString(data.address) || null;
    if (data.commune !== undefined) updateData.commune = cleanString(data.commune) || null;
    if (data.city !== undefined) updateData.city = cleanString(data.city) || null;
    if (data.region !== undefined) updateData.region = cleanString(data.region) || null;
    if (data.emergencyContactName !== undefined) updateData.emergencyContactName = cleanString(data.emergencyContactName) || null;
    if (data.emergencyContactPhone !== undefined) updateData.emergencyContactPhone = cleanString(data.emergencyContactPhone) || null;
    if (data.healthSystem !== undefined) updateData.healthSystem = data.healthSystem || null;
    if (data.afpCode !== undefined) updateData.afpCode = cleanString(data.afpCode) || null;
    if (data.drivingLicense !== undefined) updateData.drivingLicense = cleanString(data.drivingLicense) || null;
    if (data.criminalRecordStatus !== undefined) updateData.criminalRecordStatus = data.criminalRecordStatus;
    if (data.backgroundNotes !== undefined) updateData.backgroundNotes = cleanString(data.backgroundNotes) || null;
    if (data.departmentId !== undefined) updateData.departmentId = cleanString(data.departmentId) || null;
    if (data.jobProfileId !== undefined) updateData.jobProfileId = cleanString(data.jobProfileId) || null;
    if (data.managerUserId !== undefined) updateData.managerUserId = cleanString(data.managerUserId) || null;
    if (data.positionTitle !== undefined) updateData.positionTitle = cleanString(data.positionTitle) || null;
    if (data.hireDate !== undefined) updateData.hireDate = cleanString(data.hireDate) || null;
    if (data.baseSalary !== undefined) updateData.baseSalary = Number(data.baseSalary) || 0;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.isActive !== undefined) updateData.isActive = Boolean(data.isActive);
    if (data.photoURL !== undefined) updateData.photoURL = cleanString(data.photoURL) || null;
    if (data.notes !== undefined) updateData.notes = cleanString(data.notes) || null;
    if (data.courses !== undefined) updateData.courses = Array.isArray(data.courses) ? data.courses : [];
    if (data.certifications !== undefined) updateData.certifications = Array.isArray(data.certifications) ? data.certifications : [];
    if (data.assignedCustomerIds !== undefined) updateData.assignedCustomerIds = Array.isArray(data.assignedCustomerIds) ? data.assignedCustomerIds : [];

    await companyRef(companyId).collection("employees").doc(employeeId).update(updateData);

    return { id: employeeId, updated: true };
  }
);
