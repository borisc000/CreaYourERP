/**
 * Cloud Functions para Tareas (Tasks)
 * - createTask: Crea una tarea
 * - updateTask: Actualiza una tarea
 * - completeTask: Marca tarea como completada
 * - deleteTask: Elimina una tarea
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { assertAction } from "../../shared/rbac";
import { db } from "../../config";

function companyRef(companyId: string) {
  return db.collection("companies").doc(companyId);
}

// ---------- createTask ----------
interface CreateTaskPayload {
  title: string;
  description?: string;
  status?: "pending" | "in_progress" | "review" | "completed" | "cancelled";
  priority?: "low" | "medium" | "high" | "urgent";
  assignedTo?: string;
  assignedToName?: string;
  assignedBy?: string;
  dueDate?: string;
  relatedModule?: string;
  relatedRecordId?: string;
  tags?: string[];
}

export const createTask = onCall(
  {
    region: "us-central1",
    cors: ["https://your-erp.web.app", "https://your-erp-staging.web.app", "https://your-erp-staging.firebaseapp.com", "http://localhost:5173"],
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }

    const companyId = request.auth.token.companyId;
    if (!companyId) {
      throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    }
    await assertAction(request, "tasks.create", { companyId });

    const payload = request.data as CreateTaskPayload;
    if (!payload.title?.trim()) {
      throw new HttpsError("invalid-argument", "El título es requerido");
    }

    try {
      const now = new Date().toISOString();
      const ref = companyRef(companyId).collection("tasks").doc();
      await ref.set({
        companyId,
        title: payload.title.trim(),
        description: payload.description || "",
        status: payload.status || "pending",
        priority: payload.priority || "medium",
        assignedTo: payload.assignedTo || "",
        assignedToName: payload.assignedToName || "",
        assignedBy: payload.assignedBy || request.auth.uid,
        createdBy: request.auth.uid,
        dueDate: payload.dueDate || "",
        relatedModule: payload.relatedModule || "",
        relatedRecordId: payload.relatedRecordId || "",
        tags: payload.tags || [],
        attachments: [],
        createdAt: now,
        updatedAt: now,
      });
      return { success: true, id: ref.id };
    } catch (error: any) {
      console.error("[createTask] Error:", error);
      throw new HttpsError("internal", error.message || "Error al crear tarea");
    }
  }
);

// ---------- updateTask ----------
interface UpdateTaskPayload {
  id: string;
  title?: string;
  description?: string;
  status?: "pending" | "in_progress" | "review" | "completed" | "cancelled";
  priority?: "low" | "medium" | "high" | "urgent";
  assignedTo?: string;
  assignedToName?: string;
  dueDate?: string;
  relatedModule?: string;
  relatedRecordId?: string;
  tags?: string[];
}

export const updateTask = onCall(
  {
    region: "us-central1",
    cors: ["https://your-erp.web.app", "https://your-erp-staging.web.app", "https://your-erp-staging.firebaseapp.com", "http://localhost:5173"],
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }

    const companyId = request.auth.token.companyId;
    if (!companyId) {
      throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    }
    await assertAction(request, "tasks.edit", { companyId });

    const { id, ...payload } = request.data as UpdateTaskPayload;
    if (!id) {
      throw new HttpsError("invalid-argument", "id es requerido");
    }

    try {
      const ref = companyRef(companyId).collection("tasks").doc(id);
      const snap = await ref.get();
      if (!snap.exists) {
        throw new HttpsError("not-found", "Tarea no encontrada");
      }

      const updateData: Record<string, any> = {};
      if (payload.title !== undefined) updateData.title = payload.title.trim();
      if (payload.description !== undefined) updateData.description = payload.description;
      if (payload.status !== undefined) updateData.status = payload.status;
      if (payload.priority !== undefined) updateData.priority = payload.priority;
      if (payload.assignedTo !== undefined) updateData.assignedTo = payload.assignedTo;
      if (payload.assignedToName !== undefined) updateData.assignedToName = payload.assignedToName;
      if (payload.dueDate !== undefined) updateData.dueDate = payload.dueDate;
      if (payload.relatedModule !== undefined) updateData.relatedModule = payload.relatedModule;
      if (payload.relatedRecordId !== undefined) updateData.relatedRecordId = payload.relatedRecordId;
      if (payload.tags !== undefined) updateData.tags = payload.tags;

      updateData.updatedAt = new Date().toISOString();

      await ref.update(updateData);
      return { success: true };
    } catch (error: any) {
      console.error("[updateTask] Error:", error);
      throw new HttpsError("internal", error.message || "Error al actualizar tarea");
    }
  }
);

// ---------- completeTask ----------
interface CompleteTaskPayload {
  id: string;
}

export const completeTask = onCall(
  {
    region: "us-central1",
    cors: ["https://your-erp.web.app", "https://your-erp-staging.web.app", "https://your-erp-staging.firebaseapp.com", "http://localhost:5173"],
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }

    const companyId = request.auth.token.companyId;
    if (!companyId) {
      throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    }
    await assertAction(request, "tasks.edit", { companyId });

    const { id } = request.data as CompleteTaskPayload;
    if (!id) {
      throw new HttpsError("invalid-argument", "id es requerido");
    }

    try {
      const now = new Date().toISOString();
      const ref = companyRef(companyId).collection("tasks").doc(id);
      const snap = await ref.get();
      if (!snap.exists) {
        throw new HttpsError("not-found", "Tarea no encontrada");
      }

      await ref.update({
        status: "completed",
        completedAt: now,
        updatedAt: now,
      });
      return { success: true };
    } catch (error: any) {
      console.error("[completeTask] Error:", error);
      throw new HttpsError("internal", error.message || "Error al completar tarea");
    }
  }
);

// ---------- deleteTask ----------
interface DeleteTaskPayload {
  id: string;
}

export const deleteTask = onCall(
  {
    region: "us-central1",
    cors: ["https://your-erp.web.app", "https://your-erp-staging.web.app", "https://your-erp-staging.firebaseapp.com", "http://localhost:5173"],
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }

    const companyId = request.auth.token.companyId;
    if (!companyId) {
      throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    }
    await assertAction(request, "tasks.delete", { companyId });

    const { id } = request.data as DeleteTaskPayload;
    if (!id) {
      throw new HttpsError("invalid-argument", "id es requerido");
    }

    try {
      await companyRef(companyId).collection("tasks").doc(id).delete();
      return { success: true };
    } catch (error: any) {
      console.error("[deleteTask] Error:", error);
      throw new HttpsError("internal", error.message || "Error al eliminar tarea");
    }
  }
);
