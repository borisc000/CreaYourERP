import { onCall, HttpsError } from "firebase-functions/v2/https";
import { assertAction } from "../../shared/rbac";
import { db } from "../../config";

const cors = ["http://localhost:5173", "http://localhost:5000", "https://your-erp.web.app", "https://your-erp-staging.web.app", "https://your-erp-staging.firebaseapp.com"];
function companyRef(companyId: string) { return db.collection("companies").doc(companyId); }
function cleanString(value: unknown): string { return typeof value === "string" ? value.trim() : ""; }
function nowIso() { return new Date().toISOString(); }

// ==========================================
// TASKS
// ==========================================

export const listTasks = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "tasks.view", { companyId });

    const data = request.data || {};
    const status = cleanString(data.status);
    const priority = cleanString(data.priority);
    const assignedTo = cleanString(data.assignedTo);
    const relatedModule = cleanString(data.relatedModule);
    const search = cleanString(data.search).toLowerCase();
    const limit = Math.min(500, Math.max(1, Number(data.limit || 200)));

    let q: FirebaseFirestore.Query = companyRef(companyId).collection("tasks").orderBy("updatedAt", "desc").limit(limit);
    if (status) q = q.where("status", "==", status);
    if (priority) q = q.where("priority", "==", priority);
    if (assignedTo) q = q.where("assignedTo", "==", assignedTo);
    if (relatedModule) q = q.where("relatedModule", "==", relatedModule);

    const snap = await q.get();
    let tasks = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    if (search) {
      tasks = tasks.filter((t: any) =>
        String(t.title || "").toLowerCase().includes(search) ||
        String(t.description || "").toLowerCase().includes(search)
      );
    }
    return { tasks };
  }
);

export const getTask = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "tasks.view", { companyId });

    const id = cleanString(request.data?.id || request.data?.taskId);
    if (!id) throw new HttpsError("invalid-argument", "id requerido");

    const snap = await companyRef(companyId).collection("tasks").doc(id).get();
    if (!snap.exists) throw new HttpsError("not-found", "Tarea no encontrada");
    return { task: { id: snap.id, ...snap.data() } };
  }
);

// ==========================================
// ATTACHMENTS
// ==========================================

export const addTaskAttachment = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "tasks.edit", { companyId });

    const { taskId, fileName, fileUrl, fileSize, mimeType } = request.data;
    if (!taskId || !fileName || !fileUrl) throw new HttpsError("invalid-argument", "taskId, fileName y fileUrl son requeridos");

    const taskRef = companyRef(companyId).collection("tasks").doc(taskId);
    const snap = await taskRef.get();
    if (!snap.exists) throw new HttpsError("not-found", "Tarea no encontrada");

    const attachment = {
      id: db.collection("companies").doc().id,
      taskId, fileName, fileUrl,
      fileSize: Number(fileSize) || 0,
      mimeType: mimeType || "",
      uploadedBy: request.auth?.uid || "",
      createdAt: nowIso(),
    };

    const current = snap.data() || {};
    const attachments = Array.isArray(current.attachments) ? current.attachments : [];
    attachments.push(attachment);

    await taskRef.update({ attachments, updatedAt: nowIso() });
    return { added: true, attachmentId: attachment.id };
  }
);

export const removeTaskAttachment = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "tasks.edit", { companyId });

    const { taskId, attachmentId } = request.data;
    if (!taskId || !attachmentId) throw new HttpsError("invalid-argument", "taskId y attachmentId son requeridos");

    const taskRef = companyRef(companyId).collection("tasks").doc(taskId);
    const snap = await taskRef.get();
    if (!snap.exists) throw new HttpsError("not-found", "Tarea no encontrada");

    const current = snap.data() || {};
    const attachments = Array.isArray(current.attachments) ? current.attachments : [];
    const filtered = attachments.filter((a: any) => a.id !== attachmentId);

    await taskRef.update({ attachments: filtered, updatedAt: nowIso() });
    return { removed: true };
  }
);
