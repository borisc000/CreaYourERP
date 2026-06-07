import { onCall, HttpsError } from "firebase-functions/v2/https";
// db imported via companyRef utility
import { assertAction } from "../../shared/rbac";
import { cors, cleanString, companyRef } from "./quoteService";

export const saveQuoteTemplate = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }
    const companyId = request.auth.token.companyId as string | undefined;
    if (!companyId) throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");

    await assertAction(request, "quote.manage_templates", { companyId });

    const data = request.data || {};
    const id = cleanString(data.id);
    const name = cleanString(data.name);
    if (!name) throw new HttpsError("invalid-argument", "El nombre de la plantilla es obligatorio");

    const lines = Array.isArray(data.lines) ? data.lines : [];
    for (const line of lines) {
      if (!cleanString(line.description)) throw new HttpsError("invalid-argument", "Todas las líneas deben tener descripción");
      if (typeof line.quantity !== "number" || line.quantity <= 0) throw new HttpsError("invalid-argument", "Cantidad inválida en línea");
      if (typeof line.unitPrice !== "number" || line.unitPrice < 0) throw new HttpsError("invalid-argument", "Precio unitario inválido en línea");
    }

    const now = new Date().toISOString();
    const payload = {
      companyId,
      name,
      description: cleanString(data.description),
      lines: lines.map((l: any) => ({
        id: l.id || crypto.randomUUID(),
        sectionType: l.sectionType || "SERVICIOS",
        catalogItemId: cleanString(l.catalogItemId) || "",
        description: cleanString(l.description),
        quantity: Number(l.quantity) || 1,
        unitPrice: Number(l.unitPrice) || 0,
        discountPercent: Number(l.discountPercent) || 0,
      })),
      taxPct: Number(data.taxPct) ?? 19,
      admMarginPct: Number(data.admMarginPct) ?? 5,
      profitMarginPct: Number(data.profitMarginPct) ?? 10,
      notes: cleanString(data.notes),
      isActive: data.isActive !== false,
      updatedAt: now,
    };

    if (id) {
      const ref = companyRef(companyId).collection("quoteTemplates").doc(id);
      const snap = await ref.get();
      if (!snap.exists) throw new HttpsError("not-found", "Plantilla no encontrada");
      await ref.update(payload);
      return { id, updated: true };
    } else {
      const ref = companyRef(companyId).collection("quoteTemplates").doc();
      await ref.set({ ...payload, createdAt: now });
      return { id: ref.id, created: true };
    }
  }
);
