import { onCall, HttpsError } from "firebase-functions/v2/https";
import { assertAction } from "../../shared/rbac";
import { cors, cleanString, companyRef } from "./quoteService";

const VALID_CATALOG_TYPES = new Set(["service", "worker", "item"]);

function collectionName(catalogType: string): string {
  if (catalogType === "service") return "serviceCatalog";
  if (catalogType === "worker") return "workerCatalog";
  return "itemCatalog";
}

export const deleteCatalogItem = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }

    const companyId = request.auth.token.companyId as string | undefined;
    if (!companyId) {
      throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    }

    await assertAction(request, "quotes.manage_catalogs", { companyId });

    const catalogType = cleanString(request.data?.catalogType);
    if (!VALID_CATALOG_TYPES.has(catalogType)) {
      throw new HttpsError("invalid-argument", "Tipo de catálogo no válido");
    }

    const id = cleanString(request.data?.id);
    if (!id) {
      throw new HttpsError("invalid-argument", "id es obligatorio");
    }

    const colName = collectionName(catalogType);
    const ref = companyRef(companyId).collection(colName).doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      throw new HttpsError("not-found", "Ítem no encontrado");
    }

    await ref.delete();
    return { id, deleted: true };
  }
);
