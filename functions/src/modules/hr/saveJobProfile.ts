import { onCall, HttpsError } from "firebase-functions/v2/https";
import { db } from "../../config";
import { assertAction } from "../../shared/rbac";

function companyRef(companyId: string) {
  return db.collection("companies").doc(companyId);
}

const cors = [
  "https://your-erp.web.app",
  "https://your-erp-staging.web.app",
  "https://your-erp-staging.firebaseapp.com",
  "http://localhost:5173",
];

interface SavePayload {
  id?: string;
  name: string;
  code?: string;
  departmentId?: string;
  description?: string;
  riskLevel?: string;
  requiredCourseIds?: string[];
  requiredRequirementIds?: string[];
  salaryRangeMin?: number;
  salaryRangeMax?: number;
  isActive?: boolean;
  status?: "draft" | "active" | "archived";
}

export const saveJobProfile = onCall(
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

    const payload = request.data as SavePayload;
    if (!payload.name?.trim()) {
      throw new HttpsError("invalid-argument", "El nombre es requerido");
    }

    const now = new Date().toISOString();
    const cleanPayload = {
      companyId,
      name: payload.name.trim(),
      code: payload.code?.trim() || "",
      departmentId: payload.departmentId || "",
      description: payload.description || "",
      riskLevel: payload.riskLevel || "low",
      requiredCourseIds: payload.requiredCourseIds || [],
      requiredRequirementIds: payload.requiredRequirementIds || [],
      salaryRangeMin: Number(payload.salaryRangeMin) || 0,
      salaryRangeMax: Number(payload.salaryRangeMax) || 0,
      isActive: payload.isActive !== false,
      status: payload.status || "active",
      updatedAt: now,
    };

    try {
      // Validate unique code within company
      if (cleanPayload.code) {
        const codeQuery = await companyRef(companyId)
          .collection("jobProfiles")
          .where("code", "==", cleanPayload.code)
          .limit(1)
          .get();
        if (!codeQuery.empty && codeQuery.docs[0].id !== payload.id) {
          throw new HttpsError("already-exists", `Ya existe un perfil con el código '${cleanPayload.code}'`);
        }
      }

      if (payload.id) {
        const ref = companyRef(companyId).collection("jobProfiles").doc(payload.id);
        const snap = await ref.get();
        if (!snap.exists) {
          throw new HttpsError("not-found", "Perfil no encontrado");
        }
        await ref.update(cleanPayload);
        return { success: true, id: payload.id, updated: true };
      } else {
        const ref = companyRef(companyId).collection("jobProfiles").doc();
        await ref.set({ ...cleanPayload, createdAt: now });
        return { success: true, id: ref.id, created: true };
      }
    } catch (error: any) {
      console.error("[saveJobProfile] Error:", error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", error.message || "Error al guardar perfil");
    }
  }
);
