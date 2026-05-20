import { onCall, HttpsError } from "firebase-functions/v2/https";
import { assertAction } from "../../shared/rbac";
import { db } from "../../config";

const cors = ["http://localhost:5173", "http://localhost:5000", "https://your-erp.web.app", "https://your-erp-staging.web.app", "https://your-erp-staging.firebaseapp.com"];
function nowIso() { return new Date().toISOString(); }
function companyRef(companyId: string) { return db.collection("companies").doc(companyId); }
function cleanString(value: unknown): string { return typeof value === "string" ? value.trim() : ""; }

export const createSafetyFolder = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "safety.create_folder", { companyId });

    const { name, serviceProfileId, leadId, customerId, siteId, areaId, description, startDate, endDate } = request.data;
    if (!name) throw new HttpsError("invalid-argument", "name requerido");

    const count = (await companyRef(companyId).collection("safetyFolders").count().get()).data().count;
    const code = `SF-${String(count + 1).padStart(4, "0")}`;

    const ref = await companyRef(companyId).collection("safetyFolders").add({
      companyId, code, name, serviceProfileId: serviceProfileId || "", leadId: leadId || "",
      customerId: customerId || "", siteId: siteId || "", areaId: areaId || "",
      description: description || "", startDate: startDate || "", endDate: endDate || "",
      status: "draft", readinessPct: 0, trafficLight: "red",
      createdAt: nowIso(), updatedAt: nowIso(),
    });
    return { id: ref.id, code };
  }
);

export const updateSafetyFolder = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "safety.edit_folder", { companyId });

    const id = cleanString(request.data?.id);
    if (!id) throw new HttpsError("invalid-argument", "id requerido");

    const { id: _, ...updateData } = request.data;
    await companyRef(companyId).collection("safetyFolders").doc(id).update({ ...updateData, updatedAt: nowIso() });
    return { updated: true };
  }
);

export const deleteSafetyFolder = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "safety.delete_folder", { companyId });

    const id = cleanString(request.data?.id);
    if (!id) throw new HttpsError("invalid-argument", "id requerido");

    await companyRef(companyId).collection("safetyFolders").doc(id).delete();
    return { deleted: true };
  }
);
