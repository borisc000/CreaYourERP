import { onCall, HttpsError } from "firebase-functions/v2/https";
import { assertAction } from "../../shared/rbac";
import { cors, cleanString, companyRef } from "./quoteService";

export const deleteQuoteTemplate = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }
    const companyId = request.auth.token.companyId as string | undefined;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");

    await assertAction(request, "quote.manage_templates", { companyId });

    const id = cleanString(request.data?.id);
    if (!id) throw new HttpsError("invalid-argument", "id requerido");

    const ref = companyRef(companyId).collection("quoteTemplates").doc(id);
    const snap = await ref.get();
    if (!snap.exists) throw new HttpsError("not-found", "Plantilla no encontrada");

    await ref.delete();
    return { deleted: true };
  }
);
