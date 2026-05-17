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

export const deleteJobProfile = onCall(
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

    const { id } = request.data as { id: string };
    if (!id) {
      throw new HttpsError("invalid-argument", "id es requerido");
    }

    try {
      // Check if any employee is using this profile
      const empSnap = await companyRef(companyId)
        .collection("employees")
        .where("jobProfileId", "==", id)
        .limit(1)
        .get();

      if (!empSnap.empty) {
        throw new HttpsError("failed-precondition", "No se puede eliminar: hay empleados asignados a este perfil");
      }

      const ref = companyRef(companyId).collection("jobProfiles").doc(id);
      await ref.delete();
      return { success: true };
    } catch (error: any) {
      console.error("[deleteJobProfile] Error:", error);
      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", error.message || "Error al eliminar perfil");
    }
  }
);
