import { onCall, HttpsError } from "firebase-functions/v2/https";
import { assertAction } from "../../shared/rbac";
import { cors, cleanString, companyRef } from "./quoteService";

const VALID_CATALOG_TYPES = new Set(["service", "worker", "item"]);

function collectionName(catalogType: string): string {
  if (catalogType === "service") return "serviceCatalog";
  if (catalogType === "worker") return "workerCatalog";
  return "itemCatalog";
}

function validateInput(data: Record<string, unknown>): string | null {
  const catalogType = cleanString(data.catalogType);
  if (!VALID_CATALOG_TYPES.has(catalogType)) return "Tipo de catálogo no válido";

  const code = cleanString(data.code);
  if (!code) return "Código es obligatorio";

  const name = cleanString(data.name);
  if (!name) return "Nombre es obligatorio";

  const unitPrice = data.unitPrice;
  if (unitPrice !== undefined && unitPrice !== null && (typeof unitPrice !== "number" || unitPrice < 0)) {
    return "El precio unitario debe ser un número positivo";
  }

  return null;
}

export const saveCatalogItem = onCall(
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
    const uid = request.auth.uid;

    const data = request.data || {};
    const validationError = validateInput(data);
    if (validationError) {
      throw new HttpsError("invalid-argument", validationError);
    }

    const catalogType = cleanString(data.catalogType);
    const id = cleanString(data.id);
    const now = new Date().toISOString();

    const itemData = {
      companyId,
      catalogType,
      code: cleanString(data.code),
      name: cleanString(data.name),
      description: cleanString(data.description) || null,
      unitPrice: typeof data.unitPrice === "number" ? data.unitPrice : 0,
      unit: cleanString(data.unit) || null,
      category: cleanString(data.category) || null,
      isActive: data.isActive !== false,
      updatedAt: now,
      updatedBy: uid,
    };

    const colName = collectionName(catalogType);

    if (id) {
      const ref = companyRef(companyId).collection(colName).doc(id);
      const snap = await ref.get();
      if (!snap.exists) {
        throw new HttpsError("not-found", "Ítem no encontrado");
      }
      await ref.update(itemData);
      return { id, updated: true };
    } else {
      const ref = companyRef(companyId).collection(colName).doc();
      await ref.set({
        ...itemData,
        createdAt: now,
        createdBy: uid,
      });
      return { id: ref.id, created: true };
    }
  }
);
