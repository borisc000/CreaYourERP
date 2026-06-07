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
      experienceYears: Number(data.experienceYears) || 0,
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
    const update: any = { ...data, updatedAt: nowIso() };
    if (data.experienceYears !== undefined) update.experienceYears = Number(data.experienceYears) || 0;
    await companyRef(companyId).collection("candidates").doc(id).update(update);
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

    // Transaction: create employee + contract + payroll + invite + update app + update job + audit
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

      // 7. EmploymentStatusEvent
      t.set(companyRef(companyId).collection("employmentStatusEvents").doc(), {
        companyId,
        employeeId: empRef.id,
        eventType: "hired",
        newStatus: "active",
        reason: `Contratado desde postulación ${applicationId}`,
        effectiveDate: hireDate,
        processedBy: request.auth!.uid,
        createdAt: now,
      });

      // 8. Activity log
      t.set(companyRef(companyId).collection("activityLogs").doc(), {
        companyId,
        type: "recruitment.hired",
        employeeId: empRef.id,
        applicationId,
        message: `Candidato contratado: ${firstName} ${lastName}`,
        userId: request.auth!.uid,
        metadata: { jobId: appData.jobId, jobTitle: jobData.title, contractType: employeeData?.contractType || "indefinite" },
        createdAt: now,
      });
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

export const calculateCandidateScore = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "recruitment.calculate_score", { companyId });

    const candidateId = cleanString(request.data?.candidateId);
    if (!candidateId) throw new HttpsError("invalid-argument", "candidateId requerido");

    const candidateRef = companyRef(companyId).collection("candidates").doc(candidateId);
    const candidateSnap = await candidateRef.get();
    if (!candidateSnap.exists) throw new HttpsError("not-found", "Candidato no encontrado");
    const candidateData = candidateSnap.data()!;

    // Fetch all interviews for this candidate (via applications)
    const applicationsSnap = await companyRef(companyId)
      .collection("jobApplications")
      .where("candidateId", "==", candidateId)
      .get();

    const applicationIds = applicationsSnap.docs.map((d) => d.id);
    const interviewScores: number[] = [];

    if (applicationIds.length > 0) {
      // Firestore "in" query limited to 10; chunk if needed
      const chunks: string[][] = [];
      for (let i = 0; i < applicationIds.length; i += 10) {
        chunks.push(applicationIds.slice(i, i + 10));
      }
      for (const chunk of chunks) {
        const interviewsSnap = await companyRef(companyId)
          .collection("interviews")
          .where("applicationId", "in", chunk)
          .get();
        for (const doc of interviewsSnap.docs) {
          const score = Number(doc.data().overallScore);
          if (!isNaN(score) && score > 0) interviewScores.push(score);
        }
      }
    }

    const interviewAvg = interviewScores.length > 0
      ? interviewScores.reduce((a, b) => a + b, 0) / interviewScores.length
      : 0;

    const completionPct = Number(candidateData.completionPct) || 0;
    const experienceYears = Number(candidateData.experienceYears) || 0;
    const rating = Number(candidateData.rating) || 0;

    // Normalize experience to 0-100 scale (cap at 20 years)
    const experienceScore = Math.min(experienceYears, 20) * 5;

    const calculatedScore = Math.round(
      (interviewAvg * 0.4) +
      (completionPct * 0.3) +
      (experienceScore * 0.2) +
      (rating * 0.1)
    );

    const now = nowIso();
    await candidateRef.update({
      calculatedScore,
      scoreUpdatedAt: now,
      updatedAt: now,
    });

    return {
      candidateId,
      calculatedScore,
      components: {
        interviewAvg: Math.round(interviewAvg * 10) / 10,
        completionPct,
        experienceYears,
        rating,
      },
    };
  }
);

export const getCandidateRanking = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "recruitment.view", { companyId });

    const jobOpeningId = cleanString(request.data?.jobOpeningId);
    if (!jobOpeningId) throw new HttpsError("invalid-argument", "jobOpeningId requerido");

    // Get applications for this job
    const appsSnap = await companyRef(companyId)
      .collection("jobApplications")
      .where("jobId", "==", jobOpeningId)
      .get();

    const candidateIds = appsSnap.docs.map((d) => d.data().candidateId as string).filter(Boolean);
    if (candidateIds.length === 0) return { jobOpeningId, candidates: [], total: 0 };

    // Fetch candidates in chunks (max 10 per "in" query)
    const candidates: Array<{ id: string; fullName: string; calculatedScore?: number; rating: number; completionPct: number }> = [];
    for (let i = 0; i < candidateIds.length; i += 10) {
      const chunk = candidateIds.slice(i, i + 10);
      const chunkSnap = await companyRef(companyId)
        .collection("candidates")
        .where("__name__", "in", chunk)
        .get();
      for (const doc of chunkSnap.docs) {
        const d = doc.data();
        candidates.push({
          id: doc.id,
          fullName: d.fullName || "",
          calculatedScore: d.calculatedScore,
          rating: d.rating || 0,
          completionPct: d.completionPct || 0,
        });
      }
    }

    // Sort by calculatedScore desc, then rating desc
    candidates.sort((a, b) => (b.calculatedScore ?? 0) - (a.calculatedScore ?? 0) || b.rating - a.rating);

    const ranked = candidates.map((c, idx) => ({ ...c, rank: idx + 1 }));

    return { jobOpeningId, candidates: ranked, total: ranked.length };
  }
);

// ==========================================
// LIST / GET / DELETE — JobOpenings
// ==========================================

export const listJobOpenings = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "recruitment.view", { companyId });

    const data = request.data || {};
    const status = cleanString(data.status);
    const search = cleanString(data.search).toLowerCase();
    const limit = Math.min(500, Math.max(1, Number(data.limit || 200)));

    let query: FirebaseFirestore.Query = companyRef(companyId).collection("jobOpenings").orderBy("createdAt", "desc").limit(limit);
    if (status) query = query.where("status", "==", status);

    const snap = await query.get();
    let jobs = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    if (search) {
      jobs = jobs.filter((j: any) =>
        String(j.title || "").toLowerCase().includes(search) ||
        String(j.code || "").toLowerCase().includes(search)
      );
    }
    return { jobs };
  }
);

export const getJobOpening = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "recruitment.view", { companyId });

    const id = cleanString(request.data?.id || request.data?.jobOpeningId);
    if (!id) throw new HttpsError("invalid-argument", "id requerido");

    const snap = await companyRef(companyId).collection("jobOpenings").doc(id).get();
    if (!snap.exists) throw new HttpsError("not-found", "Vacante no encontrada");
    return { job: { id: snap.id, ...snap.data() } };
  }
);

export const deleteJobOpening = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "recruitment.delete_job", { companyId });

    const id = cleanString(request.data?.id);
    if (!id) throw new HttpsError("invalid-argument", "id requerido");

    const ref = companyRef(companyId);
    // Cascade: delete applications
    const appsSnap = await ref.collection("jobApplications").where("jobId", "==", id).limit(300).get();
    const batch = db.batch();
    for (const doc of appsSnap.docs) batch.delete(doc.ref);
    batch.delete(ref.collection("jobOpenings").doc(id));
    await batch.commit();

    return { deleted: true, cascade: { applications: appsSnap.size } };
  }
);

// ==========================================
// LIST / GET / DELETE — Candidates
// ==========================================

export const listCandidates = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "recruitment.view", { companyId });

    const data = request.data || {};
    const search = cleanString(data.search).toLowerCase();
    const limit = Math.min(500, Math.max(1, Number(data.limit || 200)));

    const snap = await companyRef(companyId).collection("candidates").orderBy("createdAt", "desc").limit(limit).get();
    let candidates = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    if (search) {
      candidates = candidates.filter((c: any) =>
        String(c.fullName || "").toLowerCase().includes(search) ||
        String(c.email || "").toLowerCase().includes(search) ||
        String(c.nationalId || "").includes(search)
      );
    }
    return { candidates };
  }
);

export const getCandidate = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "recruitment.view", { companyId });

    const id = cleanString(request.data?.id || request.data?.candidateId);
    if (!id) throw new HttpsError("invalid-argument", "id requerido");

    const snap = await companyRef(companyId).collection("candidates").doc(id).get();
    if (!snap.exists) throw new HttpsError("not-found", "Candidato no encontrado");
    return { candidate: { id: snap.id, ...snap.data() } };
  }
);

export const deleteCandidate = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "recruitment.delete_candidate", { companyId });

    const id = cleanString(request.data?.id);
    if (!id) throw new HttpsError("invalid-argument", "id requerido");

    const ref = companyRef(companyId);
    // Cascade: delete applications and their interviews
    const appsSnap = await ref.collection("jobApplications").where("candidateId", "==", id).limit(300).get();
    const batch = db.batch();
    for (const appDoc of appsSnap.docs) {
      const interviewsSnap = await ref.collection("interviews").where("applicationId", "==", appDoc.id).limit(100).get();
      for (const intDoc of interviewsSnap.docs) batch.delete(intDoc.ref);
      batch.delete(appDoc.ref);
    }
    batch.delete(ref.collection("candidates").doc(id));
    await batch.commit();

    return { deleted: true, cascade: { applications: appsSnap.size } };
  }
);

// ==========================================
// LIST / GET / DELETE — Applications
// ==========================================

export const listApplications = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "recruitment.view", { companyId });

    const data = request.data || {};
    const jobId = cleanString(data.jobId);
    const candidateId = cleanString(data.candidateId);
    const status = cleanString(data.status);
    const limit = Math.min(500, Math.max(1, Number(data.limit || 200)));

    let query: FirebaseFirestore.Query = companyRef(companyId).collection("jobApplications").orderBy("createdAt", "desc").limit(limit);
    if (jobId) query = query.where("jobId", "==", jobId);
    if (candidateId) query = query.where("candidateId", "==", candidateId);
    if (status) query = query.where("status", "==", status);

    const snap = await query.get();
    return { applications: snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) };
  }
);

export const getApplication = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "recruitment.view", { companyId });

    const id = cleanString(request.data?.id || request.data?.applicationId);
    if (!id) throw new HttpsError("invalid-argument", "id requerido");

    const snap = await companyRef(companyId).collection("jobApplications").doc(id).get();
    if (!snap.exists) throw new HttpsError("not-found", "Postulación no encontrada");
    return { application: { id: snap.id, ...snap.data() } };
  }
);

export const deleteApplication = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "recruitment.delete_application", { companyId });

    const id = cleanString(request.data?.id);
    if (!id) throw new HttpsError("invalid-argument", "id requerido");

    const ref = companyRef(companyId);
    const interviewsSnap = await ref.collection("interviews").where("applicationId", "==", id).limit(100).get();
    const batch = db.batch();
    for (const doc of interviewsSnap.docs) batch.delete(doc.ref);
    batch.delete(ref.collection("jobApplications").doc(id));
    await batch.commit();

    return { deleted: true, cascade: { interviews: interviewsSnap.size } };
  }
);

// ==========================================
// LIST / GET / DELETE — Interviews
// ==========================================

export const listInterviews = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "recruitment.view", { companyId });

    const data = request.data || {};
    const applicationId = cleanString(data.applicationId);
    const limit = Math.min(500, Math.max(1, Number(data.limit || 200)));

    let query: FirebaseFirestore.Query = companyRef(companyId).collection("interviews").orderBy("createdAt", "desc").limit(limit);
    if (applicationId) query = query.where("applicationId", "==", applicationId);

    const snap = await query.get();
    return { interviews: snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) };
  }
);

export const getInterview = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "recruitment.view", { companyId });

    const id = cleanString(request.data?.id || request.data?.interviewId);
    if (!id) throw new HttpsError("invalid-argument", "id requerido");

    const snap = await companyRef(companyId).collection("interviews").doc(id).get();
    if (!snap.exists) throw new HttpsError("not-found", "Entrevista no encontrada");
    return { interview: { id: snap.id, ...snap.data() } };
  }
);

export const deleteInterview = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "recruitment.delete_interview", { companyId });

    const id = cleanString(request.data?.id);
    if (!id) throw new HttpsError("invalid-argument", "id requerido");

    await companyRef(companyId).collection("interviews").doc(id).delete();
    return { deleted: true };
  }
);

// ==========================================
// READINESS CALCULATION
// ==========================================

export const calculateApplicationReadiness = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "recruitment.calculate_readiness", { companyId });

    const applicationId = cleanString(request.data?.applicationId);
    if (!applicationId) throw new HttpsError("invalid-argument", "applicationId requerido");

    const appRef = companyRef(companyId).collection("jobApplications").doc(applicationId);
    const appSnap = await appRef.get();
    if (!appSnap.exists) throw new HttpsError("not-found", "Postulación no encontrada");
    const appData = appSnap.data()!;

    const candidateId = cleanString(appData.candidateId);
    const jobId = cleanString(appData.jobId);

    const candidateSnap = candidateId ? await companyRef(companyId).collection("candidates").doc(candidateId).get() : null;
    const candidateData = candidateSnap?.exists ? candidateSnap.data()! : {};

    const jobSnap = jobId ? await companyRef(companyId).collection("jobOpenings").doc(jobId).get() : null;
    const jobData = jobSnap?.exists ? jobSnap.data()! : {};

    const jobProfileId = cleanString(jobData.jobProfileId);
    const profileSnap = jobProfileId ? await companyRef(companyId).collection("jobProfiles").doc(jobProfileId).get() : null;
    const profileData = profileSnap?.exists ? profileSnap.data()! : {};

    // Interviews
    const interviewsSnap = await companyRef(companyId).collection("interviews").where("applicationId", "==", applicationId).get();
    const interviewScores = interviewsSnap.docs
      .map((d) => Number(d.data().overallScore))
      .filter((s) => !isNaN(s) && s > 0);
    const interviewAvg = interviewScores.length > 0
      ? interviewScores.reduce((a, b) => a + b, 0) / interviewScores.length
      : 0;

    // Checks
    const checks: Record<string, { pass: boolean; value: string | number }> = {};

    const completionPct = Number(candidateData.completionPct) || 0;
    checks.profileComplete = { pass: completionPct >= 80, value: `${completionPct}%` };

    checks.hasEmail = { pass: Boolean(candidateData.email), value: candidateData.email || "—" };
    checks.hasPhone = { pass: Boolean(candidateData.phone), value: candidateData.phone || "—" };
    checks.hasNationalId = { pass: Boolean(candidateData.nationalId), value: candidateData.nationalId || "—" };

    checks.interviewScore = { pass: interviewAvg >= 60, value: Math.round(interviewAvg * 10) / 10 };

    const requiredCourseIds: string[] = profileData.requiredCourseIds || [];
    checks.requiredCourses = { pass: requiredCourseIds.length === 0, value: `${requiredCourseIds.length} requeridos` };

    const requiredRequirementIds: string[] = profileData.requiredRequirementIds || [];
    checks.requiredRequirements = { pass: requiredRequirementIds.length === 0, value: `${requiredRequirementIds.length} requeridos` };

    const passCount = Object.values(checks).filter((c) => c.pass).length;
    const totalChecks = Object.keys(checks).length;
    const readinessPct = Math.round((passCount / totalChecks) * 100);

    let readinessStatus: "ready" | "attention" | "incomplete" = "incomplete";
    if (readinessPct >= 90 && checks.profileComplete.pass && checks.interviewScore.pass) {
      readinessStatus = "ready";
    } else if (readinessPct >= 60) {
      readinessStatus = "attention";
    }

    const now = nowIso();
    await appRef.update({
      readinessStatus,
      readinessChecks: checks,
      readinessPct,
      readinessUpdatedAt: now,
      updatedAt: now,
    });

    return {
      applicationId,
      readinessStatus,
      readinessPct,
      checks,
      stats: {
        passCount,
        totalChecks,
        interviewAvg: Math.round(interviewAvg * 10) / 10,
        completionPct,
      },
    };
  }
);
