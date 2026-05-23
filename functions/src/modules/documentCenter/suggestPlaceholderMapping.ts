import { onCall, HttpsError } from "firebase-functions/v2/https";
import { assertAction } from "../../shared/rbac";
import { autoMapPlaceholders } from "./autoMapPlaceholders";

const cors = [
  "https://your-erp.web.app",
  "https://your-erp-staging.web.app",
  "https://your-erp-staging.firebaseapp.com",
  "http://localhost:5173",
];

export const suggestPlaceholderMapping = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }
    const companyId = request.auth.token.companyId as string;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    await assertAction(request, "document_center.save_template", { companyId });

    const { placeholders } = request.data;
    if (!Array.isArray(placeholders)) {
      throw new HttpsError("invalid-argument", "placeholders debe ser un array");
    }

    const mapping = autoMapPlaceholders(placeholders);
    return { mapping, total: placeholders.length, mapped: mapping.filter((m) => m.suggestedField).length };
  }
);
