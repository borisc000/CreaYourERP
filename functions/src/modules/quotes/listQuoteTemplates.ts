import { onCall, HttpsError } from "firebase-functions/v2/https";
import { cors, companyRef } from "./quoteService";

export const listQuoteTemplates = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }
    const companyId = request.auth.token.companyId as string | undefined;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");

    const snap = await companyRef(companyId)
      .collection("quoteTemplates")
      .where("isActive", "==", true)
      .orderBy("name")
      .get();

    return {
      items: snap.docs.map((d) => ({ id: d.id, ...d.data() })),
    };
  }
);
