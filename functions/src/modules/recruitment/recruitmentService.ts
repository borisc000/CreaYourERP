import { onCall, HttpsError } from "firebase-functions/v2/https";
import { assertAction } from "../../shared/rbac";
import { db } from "../../config";
import {
  cleanString,
  isValidChileanRut,
  generateEmployeeCode,
} from "../hr/hrService";

const cors = ["http://localhost:5173", "http://localhost:5000", "https://your-erp.web.app", "https://your-erp-staging.web.app", "https://your-erp-staging.firebaseapp.com"];
function nowIso() { return new Date().toISOString(); }
function companyRef(companyId: string) { return db.collection("companies").doc(companyId); }

const DEFAULT_STAGES = [
  { key: "applied", name: "Postulado", order: 1, isTerminal: false },
  { key: "screening", name: "Screening", order: 2, isTerminal: false },
  { key: "interview", name: "Entrevista", order: 3, isTerminal: false },
  { key: "assessment", name: "Evaluación", order: 4, isTerminal: false },
  { key: "offer", name: "Oferta", order: 5, isTerminal: false },
  { key: "hired", name: "Contratado", order: 6, isTerminal: true },
  { key: "rejected", name: "Rechazado", order: 7, isTerminal: true },
];

export const seedRecruitmentStages = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "recruitment.create", { companyId });
    const existing = await companyRef(companyId).collection("recruitmentStages").limit(1).get();
    if (!existing.empty) return { alreadySeeded: true };
    for (const stage of DEFAULT_STAGES) {
      await companyRef(companyId).collection("recruitmentStages").add({ ...stage, companyId, createdAt: nowIso() });
    }
    return { seeded: true };
  }
);

export const getRecruitmentStats = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "recruitment.view", { companyId });
    const [jobs, candidates, applications] = await Promise.all([
      companyRef(companyId).collection("jobOpenings").get(),
      companyRef(companyId).collection("candidates").get(),
      companyRef(companyId).collection("jobApplications").get(),
    ]);
    const activeJobs = jobs.docs.filter((d) => d.data().status === "published").length;
    const hiredApps = applications.docs.filter((d) => d.data().status === "hired").length;
    return {
      totalJobs: jobs.size, activeJobs, closedJobs: jobs.size - activeJobs,
      totalCandidates: candidates.size, totalApplications: applications.size,
      hiredCount: hiredApps,
    };
  }
);

export const createJobOpening = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "recruitment.create", { companyId });
    const { companyId: _, ...data } = request.data;
    if (!data.title) throw new HttpsError("invalid-argument", "Datos incompletos");
    const count = (await companyRef(companyId).collection("jobOpenings").count().get()).data().count;
    const code = `JOB-${String(count + 1).padStart(4, "0")}`;
    const ref = await companyRef(companyId).collection("jobOpenings").add({
      companyId, code, title: data.title, status: "published", hiredCount: 0,
      employmentType: data.employmentType || "full_time", workMode: data.workMode || "onsite",
      openingsCount: data.openingsCount || 1, salaryMin: data.salaryMin || 0, salaryMax: data.salaryMax || 0,
      description: data.description || "", requirements: data.requirements || "",
      jobProfileId: data.jobProfileId || "", departmentId: data.departmentId || "",
      location: data.location || "", targetStartDate: data.targetStartDate || "",
      createdAt: nowIso(), updatedAt: nowIso(),
    });
    return { id: ref.id, code };
  }
);

export const updateJobOpening = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "recruitment.edit", { companyId });
    const { companyId: _, id, ...data } = request.data;
    if (!id) throw new HttpsError("invalid-argument", "Datos incompletos");
    await companyRef(companyId).collection("jobOpenings").doc(id).update({ ...data, updatedAt: nowIso() });
    return { updated: true };
  }
);

export const createCandidate = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "recruitment.create", { companyId });
    const { companyId: _, ...data } = request.data;
    if (!data.fullName) throw new HttpsError("invalid-argument", "Nombre requerido");
    // Calculate completion
    const required = [data.nationalId, data.email, data.phone, data.birthDate, data.address, data.city, data.healthSystem, data.afpCode, data.emergencyContactName, data.emergencyContactPhone, data.criminalRecordStatus];
    const completionPct = Math.round((required.filter(Boolean).length / 11) * 100);
    const ref = await companyRef(companyId).collection("candidates").add({
      companyId, fullName: data.fullName, nationalId: data.nationalId || "", email: data.email || "",
      phone: data.phone || "", birthDate: data.birthDate || "", healthSystem: data.healthSystem || "",
      afpCode: data.afpCode || "", criminalRecordStatus: data.criminalRecordStatus || "pending",
      completionPct, rating: data.rating || 0, source: data.source || "", currentPosition: data.currentPosition || "",
      expectedSalary: data.expectedSalary || 0, summary: data.summary || "", resumeUrl: data.resumeUrl || "",
      createdAt: nowIso(), updatedAt: nowIso(),
    });
    return { id: ref.id };
  }
);

export const updateCandidate = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "recruitment.edit", { companyId });
    const { companyId: _, id, ...data } = request.data;
    if (!id) throw new HttpsError("invalid-argument", "Datos incompletos");
    await companyRef(companyId).collection("candidates").doc(id).update({ ...data, updatedAt: nowIso() });
    return { updated: true };
  }
);

export const createApplication = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "recruitment.create", { companyId });
    const { jobId, candidateId, stageId, ...data } = request.data;
    if (!jobId || !candidateId) throw new HttpsError("invalid-argument", "Datos incompletos");
    const job = await companyRef(companyId).collection("jobOpenings").doc(jobId).get();
    const candidate = await companyRef(companyId).collection("candidates").doc(candidateId).get();
    const stage = stageId ? await companyRef(companyId).collection("recruitmentStages").doc(stageId).get() : null;
    const ref = await companyRef(companyId).collection("jobApplications").add({
      companyId, jobId, jobTitle: job.exists ? job.data()?.title : "", candidateId,
      candidateName: candidate.exists ? candidate.data()?.fullName : "",
      stageId: stageId || "", stageName: stage?.exists ? stage.data()?.name : "",
      status: "active", score: 0, proposedSalary: data.proposedSalary || 0,
      contractType: data.contractType || "", projectedStartDate: data.projectedStartDate || "",
      workLocation: data.workLocation || "", notes: data.notes || "",
      readinessStatus: "incomplete", createdAt: nowIso(), updatedAt: nowIso(),
    });
    return { id: ref.id };
  }
);

export const updateApplication = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "recruitment.edit", { companyId });
    const { companyId: _, id, ...data } = request.data;
    if (!id) throw new HttpsError("invalid-argument", "Datos incompletos");
    const update: any = { ...data, updatedAt: nowIso() };
    if (data.stageId) {
      const stage = await companyRef(companyId).collection("recruitmentStages").doc(data.stageId).get();
      if (stage.exists) update.stageName = stage.data()?.name;
    }
    await companyRef(companyId).collection("jobApplications").doc(id).update(update);
    return { updated: true };
  }
);

export const hireApplication = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "recruitment.hire", { companyId });

    const { applicationId, employeeData } = request.data || {};
    if (!applicationId) throw new HttpsError("invalid-argument", "applicationId requerido");

    const firstName = cleanString(employeeData?.firstName);
    const lastName = cleanString(employeeData?.lastName);
    const email = cleanString(employeeData?.email).toLowerCase();
    if (!firstName || !lastName) throw new HttpsError("invalid-argument", "firstName y lastName son obligatorios");
    if (!email) throw new HttpsError("invalid-argument", "El email es obligatorio");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpsError("invalid-argument", "El email no es válido");

    const cedula = cleanString(employeeData?.cedula || employeeData?.nationalId);
    if (cedula && !isValidChileanRut(cedula)) throw new HttpsError("invalid-argument", "El RUT no es válido");

    const appRef = companyRef(companyId).collection("jobApplications").doc(applicationId);
    const appSnap = await appRef.get();
    if (!appSnap.exists) throw new HttpsError("not-found", "Postulación no encontrada");
    const appData = appSnap.data()!;

    const candidateSnap = appData.candidateId
      ? await companyRef(companyId).collection("candidates").doc(appData.candidateId).get()
      : null;
    const candidateData = candidateSnap?.exists ? candidateSnap.data()! : {};

    const jobRef = companyRef(companyId).collection("jobOpenings").doc(appData.jobId);
    const jobSnap = await jobRef.get();
    const jobData = jobSnap.exists ? jobSnap.data()! : {};

    const employeeCode = await generateEmployeeCode(companyId);
    const now = nowIso();
    const hireDate = cleanString(employeeData?.startDate) || now.slice(0, 10);
    const baseSalary = typeof employeeData?.baseSalary === "number" ? employeeData.baseSalary : 0;

    // Transaction: create employee + contract + payroll + invite + update app + update job
    const empRef = companyRef(companyId).collection("employees").doc();
    const contractRef = companyRef(companyId).collection("contracts").doc();
    const payrollRef = companyRef(companyId).collection("payrollProfiles").doc();
    const inviteRef = companyRef(companyId).collection("pendingInvites").doc();

    await db.runTransaction(async (t) => {
      // 1. Employee (rich)
      t.set(empRef, {
        companyId,
        employeeCode,
        firstName,
        lastName,
        fullName: `${firstName} ${lastName}`,
        email,
        workEmail: email,
        personalEmail: candidateData.personalEmail || null,
        phone: cleanString(employeeData?.phone) || candidateData.phone || null,
        alternatePhone: candidateData.alternatePhone || null,
        cedula: cedula || null,
        birthDate: candidateData.birthDate || null,
        gender: candidateData.gender || null,
        maritalStatus: candidateData.maritalStatus || null,
        nationality: candidateData.nationality || null,
        address: candidateData.address || null,
        commune: candidateData.commune || null,
        city: candidateData.city || null,
        region: candidateData.region || null,
        emergencyContactName: candidateData.emergencyContactName || null,
        emergencyContactPhone: candidateData.emergencyContactPhone || null,
        healthSystem: candidateData.healthSystem || null,
        afpCode: candidateData.afpCode || null,
        criminalRecordStatus: candidateData.criminalRecordStatus || "not_provided",
        departmentId: cleanString(employeeData?.departmentId) || jobData.departmentId || null,
        jobProfileId: cleanString(employeeData?.jobProfileId) || jobData.jobProfileId || null,
        managerUserId: null,
        positionTitle: appData.jobTitle || jobData.title || null,
        hireDate,
        baseSalary,
        status: "active",
        isActive: true,
        photoURL: null,
        notes: null,
        courses: [],
        certifications: [],
        assignedCustomerIds: [],
        createdBy: request.auth!.uid,
        createdAt: now,
        updatedAt: now,
      });

      // 2. Contract (active)
      t.set(contractRef, {
        companyId,
        employeeId: empRef.id,
        contractType: cleanString(employeeData?.contractType) || "indefinite",
        status: "active",
        startDate: hireDate,
        endDate: null,
        salaryAmount: baseSalary,
        workSchedule: null,
        shiftPattern: null,
        workLocation: cleanString(employeeData?.workLocation) || null,
        assignedCustomer: null,
        assignedService: null,
        notes: null,
        createdAt: now,
        updatedAt: now,
        createdBy: request.auth!.uid,
      });

      // 3. Payroll profile
      t.set(payrollRef, {
        companyId,
        employeeId: empRef.id,
        payrollEnabled: true,
        requireSignature: false,
        afpCode: candidateData.afpCode || null,
        healthSystem: candidateData.healthSystem || null,
        baseSalary,
        createdAt: now,
        updatedAt: now,
      });

      // 4. Pending invite (auth provisioning)
      t.set(inviteRef, {
        companyId,
        email,
        role: "employee",
        status: "pending",
        invitedBy: request.auth!.uid,
        createdAt: now,
        updatedAt: now,
      });

      // 5. Update application
      t.update(appRef, { status: "hired", hiredEmployeeId: empRef.id, updatedAt: now });

      // 6. Update job opening
      const newCount = (jobData.hiredCount || 0) + 1;
      const jobUpdates: any = { hiredCount: newCount, updatedAt: now };
      if (newCount >= (jobData.openingsCount || 1)) jobUpdates.status = "closed";
      t.update(jobRef, jobUpdates);
    });

    return {
      hired: true,
      employeeId: empRef.id,
      contractId: contractRef.id,
      payrollProfileId: payrollRef.id,
      inviteId: inviteRef.id,
    };
  }
);

export const createInterview = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "recruitment.create", { companyId });
    const { applicationId, ...data } = request.data;
    if (!applicationId) throw new HttpsError("invalid-argument", "Datos incompletos");
    const ref = await companyRef(companyId).collection("interviews").add({
      companyId, applicationId, interviewType: data.interviewType || "video",
      scheduledAt: data.scheduledAt || nowIso(), durationMinutes: data.durationMinutes || 60,
      location: data.location || "", result: "pending", recommendation: data.recommendation || "",
      overallScore: data.overallScore || 0, feedback: data.feedback || "",
      createdAt: nowIso(), updatedAt: nowIso(),
    });
    return { id: ref.id };
  }
);

export const updateInterview = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "recruitment.edit", { companyId });
    const { companyId: _, id, ...data } = request.data;
    if (!id) throw new HttpsError("invalid-argument", "Datos incompletos");
    await companyRef(companyId).collection("interviews").doc(id).update({ ...data, updatedAt: nowIso() });
    return { updated: true };
  }
);
