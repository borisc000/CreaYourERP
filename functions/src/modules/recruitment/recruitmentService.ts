import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db } from "../../config";

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
    const { companyId: _c, ...data } = request.data;
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
    const { companyId: _c, id, ...data } = request.data;
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
    const { companyId: _c, ...data } = request.data;
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
    const { companyId: _c, id, ...data } = request.data;
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
    const { companyId: _c, id, ...data } = request.data;
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
    const { applicationId, employeeData } = request.data;
    if (!applicationId) throw new HttpsError("invalid-argument", "Datos incompletos");

    const appRef = companyRef(companyId).collection("jobApplications").doc(applicationId);
    const app = await appRef.get();
    if (!app.exists) throw new HttpsError("not-found", "Postulación no encontrada");
    const appData = app.data()!;

    // Create employee
    const empRef = await companyRef(companyId).collection("employees").add({
      companyId, fullName: employeeData.fullName || appData.candidateName,
      nationalId: employeeData.nationalId || "", email: employeeData.email || "",
      phone: employeeData.phone || "", positionTitle: appData.jobTitle,
      departmentId: employeeData.departmentId || "", hireDate: nowIso().slice(0, 10),
      status: "active", isActive: true, createdAt: nowIso(), updatedAt: nowIso(),
    });

    // Update application
    await appRef.update({ status: "hired", hiredEmployeeId: empRef.id, updatedAt: nowIso() });

    // Update job hired count
    const jobRef = companyRef(companyId).collection("jobOpenings").doc(appData.jobId);
    const job = await jobRef.get();
    if (job.exists) {
      const newCount = (job.data()?.hiredCount || 0) + 1;
      const updates: any = { hiredCount: newCount };
      if (newCount >= (job.data()?.openingsCount || 1)) updates.status = "closed";
      await jobRef.update(updates);
    }

    return { hired: true, employeeId: empRef.id };
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
    const { companyId: _c, id, ...data } = request.data;
    if (!id) throw new HttpsError("invalid-argument", "Datos incompletos");
    await companyRef(companyId).collection("interviews").doc(id).update({ ...data, updatedAt: nowIso() });
    return { updated: true };
  }
);
