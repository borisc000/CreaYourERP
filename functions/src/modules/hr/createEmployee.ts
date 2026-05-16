import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db } from "../../config";
import {
  cors,
  cleanString,
  companyRef,
  validateEmployeeInput,
  generateEmployeeCode,
} from "./hrService";

export const createEmployee = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }

    const companyId = request.auth.token.companyId as string | undefined;
    if (!companyId) {
      throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    }

    const data = request.data || {};

    const validationError = validateEmployeeInput(data);
    if (validationError) {
      throw new HttpsError("invalid-argument", validationError);
    }

    const employeeCode = await generateEmployeeCode(companyId);
    const now = new Date().toISOString();

    const employeeRef = companyRef(companyId).collection("employees").doc();
    const employeeData = {
      companyId,
      employeeCode,
      firstName: cleanString(data.firstName),
      lastName: cleanString(data.lastName),
      fullName: `${cleanString(data.firstName)} ${cleanString(data.lastName)}`,
      email: cleanString(data.email).toLowerCase(),
      workEmail: cleanString(data.workEmail).toLowerCase() || null,
      personalEmail: cleanString(data.personalEmail).toLowerCase() || null,
      phone: cleanString(data.phone) || null,
      alternatePhone: cleanString(data.alternatePhone) || null,
      cedula: cleanString(data.cedula) || null,
      birthDate: cleanString(data.birthDate) || null,
      gender: cleanString(data.gender) || null,
      maritalStatus: cleanString(data.maritalStatus) || null,
      nationality: cleanString(data.nationality) || null,
      address: cleanString(data.address) || null,
      commune: cleanString(data.commune) || null,
      city: cleanString(data.city) || null,
      region: cleanString(data.region) || null,
      emergencyContactName: cleanString(data.emergencyContactName) || null,
      emergencyContactPhone: cleanString(data.emergencyContactPhone) || null,
      healthSystem: data.healthSystem || null,
      afpCode: cleanString(data.afpCode) || null,
      drivingLicense: cleanString(data.drivingLicense) || null,
      criminalRecordStatus: data.criminalRecordStatus || "not_provided",
      backgroundNotes: cleanString(data.backgroundNotes) || null,
      departmentId: cleanString(data.departmentId) || null,
      jobProfileId: cleanString(data.jobProfileId) || null,
      managerUserId: cleanString(data.managerUserId) || null,
      positionTitle: cleanString(data.positionTitle) || null,
      hireDate: cleanString(data.hireDate) || null,
      baseSalary: Number(data.baseSalary) || 0,
      status: "draft",
      isActive: true,
      photoURL: cleanString(data.photoURL) || null,
      notes: cleanString(data.notes) || null,
      courses: Array.isArray(data.courses) ? data.courses : [],
      certifications: Array.isArray(data.certifications) ? data.certifications : [],
      assignedCustomerIds: Array.isArray(data.assignedCustomerIds) ? data.assignedCustomerIds : [],
      createdBy: request.auth.uid,
      createdAt: now,
      updatedAt: now,
    };

    await db.runTransaction(async (t) => {
      t.set(employeeRef, employeeData);
      t.set(companyRef(companyId).collection("activityLogs").doc(), {
        companyId,
        type: "employee.created",
        employeeId: employeeRef.id,
        message: `Empleado ${employeeData.fullName} creado`,
        userId: request.auth!.uid,
        metadata: { employeeCode },
        createdAt: now,
      });
    });

    return { id: employeeRef.id, ...employeeData };
  }
);
