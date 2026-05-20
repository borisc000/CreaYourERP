import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db } from "../../config";
import { assertAction } from "../../shared/rbac";

const cors = [
  "https://your-erp.web.app", "https://your-erp-staging.web.app", "https://your-erp-staging.firebaseapp.com",
  "http://localhost:5173",
];

function companyRef(companyId: string) { return db.collection("companies").doc(companyId); }
function cleanString(value: unknown): string { return typeof value === "string" ? value.trim() : ""; }

// ==========================================
// POLICIES
// ==========================================

export const listAttendancePolicies = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "attendance.view", { companyId });

    const data = request.data || {};
    const isActive = data.isActive;
    const limit = Math.min(200, Math.max(1, Number(data.limit || 100)));

    let q: FirebaseFirestore.Query = companyRef(companyId).collection("attendancePolicies").orderBy("updatedAt", "desc").limit(limit);
    if (typeof isActive === "boolean") q = q.where("isActive", "==", isActive);

    const snap = await q.get();
    return { policies: snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) };
  }
);

export const getAttendancePolicy = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "attendance.view", { companyId });

    const id = cleanString(request.data?.id || request.data?.policyId);
    if (!id) throw new HttpsError("invalid-argument", "id requerido");

    const snap = await companyRef(companyId).collection("attendancePolicies").doc(id).get();
    if (!snap.exists) throw new HttpsError("not-found", "Política no encontrada");
    return { policy: { id: snap.id, ...snap.data() } };
  }
);

export const deleteAttendancePolicy = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "attendance.delete_policy", { companyId });

    const id = cleanString(request.data?.id);
    if (!id) throw new HttpsError("invalid-argument", "id requerido");

    await companyRef(companyId).collection("attendancePolicies").doc(id).delete();
    return { deleted: true };
  }
);

// ==========================================
// RECORDS
// ==========================================

export const listAttendanceRecords = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "attendance.view_records", { companyId });

    const data = request.data || {};
    const employeeId = cleanString(data.employeeId);
    const dateFrom = cleanString(data.dateFrom);
    const dateTo = cleanString(data.dateTo);
    const status = cleanString(data.status);
    const search = cleanString(data.search).toLowerCase();
    const limit = Math.min(500, Math.max(1, Number(data.limit || 200)));

    let q: FirebaseFirestore.Query = companyRef(companyId).collection("attendanceRecords").orderBy("date", "desc").limit(limit);
    if (employeeId) q = q.where("employeeId", "==", employeeId);
    if (dateFrom) q = q.where("date", ">=", dateFrom);
    if (dateTo) q = q.where("date", "<=", dateTo);

    const snap = await q.get();
    let records = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    if (status) records = records.filter((r: any) => (r.status || "") === status);
    if (search) {
      records = records.filter((r: any) =>
        String(r.employeeName || "").toLowerCase().includes(search) ||
        String(r.employeeId || "").includes(search)
      );
    }

    return { records };
  }
);

export const getAttendanceRecord = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "attendance.view_records", { companyId });

    const id = cleanString(request.data?.id || request.data?.recordId);
    if (!id) throw new HttpsError("invalid-argument", "id requerido");

    const snap = await companyRef(companyId).collection("attendanceRecords").doc(id).get();
    if (!snap.exists) throw new HttpsError("not-found", "Registro no encontrado");
    return { record: { id: snap.id, ...snap.data() } };
  }
);

export const deleteAttendanceRecord = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "attendance.delete_record", { companyId });

    const id = cleanString(request.data?.id);
    if (!id) throw new HttpsError("invalid-argument", "id requerido");

    await companyRef(companyId).collection("attendanceRecords").doc(id).delete();
    return { deleted: true };
  }
);

// ==========================================
// REFERENCE DATA
// ==========================================

export const getAttendanceReferenceData = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "attendance.view", { companyId });

    const employeesSnap = await companyRef(companyId).collection("employees").orderBy("fullName").limit(200).get();
    return {
      recordStatuses: [
        { code: "normal", name: "Normal" },
        { code: "late", name: "Atraso" },
        { code: "early_exit", name: "Salida anticipada" },
        { code: "overtime", name: "Horas extras" },
        { code: "absent", name: "Ausente" },
        { code: "pending", name: "Pendiente" },
      ],
      punchTypes: [
        { code: "entry", name: "Entrada" },
        { code: "break_start", name: "Inicio colación" },
        { code: "break_end", name: "Fin colación" },
        { code: "exit", name: "Salida" },
      ],
      employees: employeesSnap.docs.map((d) => ({ id: d.id, fullName: d.data().fullName || "" })),
    };
  }
);
