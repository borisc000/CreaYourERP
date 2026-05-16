import { onCall, HttpsError } from "firebase-functions/v2/https";
import { cors, cleanString, companyRef } from "./accreditationService";

export interface GapResult {
  requirementId: string;
  requirementName: string;
  level: "A" | "B";
  templateId?: string;
  templateName?: string;
  requiresSignature?: boolean;
}

export const detectGaps = onCall(
  { region: "us-central1", cors },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }

    const companyId = request.auth.token.companyId as string | undefined;
    if (!companyId) {
      throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    }

    const accreditationCheckId = cleanString(request.data?.accreditationCheckId);
    if (!accreditationCheckId) {
      throw new HttpsError("invalid-argument", "accreditationCheckId es obligatorio");
    }

    // 1. Leer el check
    const checkDoc = await companyRef(companyId)
      .collection("accreditationChecks")
      .doc(accreditationCheckId)
      .get();

    if (!checkDoc.exists) {
      throw new HttpsError("not-found", "Check de acreditación no encontrado");
    }

    const checkData = checkDoc.data() || {};
    const serviceOrderId = checkData.serviceOrderId as string;
    const employeeId = checkData.employeeId as string;

    if (!serviceOrderId || !employeeId) {
      throw new HttpsError("failed-precondition", "Check incompleto: falta serviceOrderId o employeeId");
    }

    // 2. Leer la orden de servicio para customerId
    const orderDoc = await companyRef(companyId)
      .collection("serviceOrders")
      .doc(serviceOrderId)
      .get();

    const orderCustomerId = orderDoc.exists ? (orderDoc.data()?.customerId as string | undefined) : undefined;

    // 3. Recopilar IDs de requisitos faltantes
    const missingIds: Array<{ id: string; level: "A" | "B" }> = [];
    const levelAMissing: string[] = checkData.levelAMissingIds || [];
    const levelBMissing: string[] = checkData.levelBMissingIds || [];

    for (const id of levelAMissing) missingIds.push({ id, level: "A" });
    for (const id of levelBMissing) missingIds.push({ id, level: "B" });

    if (missingIds.length === 0) {
      return { gaps: [], fullyCompliant: true };
    }

    // 4. Leer requisitos y templates en paralelo
    const reqIds = missingIds.map((m) => m.id);
    const reqsSnap = await companyRef(companyId)
      .collection("accreditationRequirements")
      .where("__name__", "in", reqIds)
      .get();

    const requirements = new Map<string, { name: string; code: string }>();
    const requirementCodes: string[] = [];
    reqsSnap.forEach((doc) => {
      const data = doc.data();
      requirements.set(doc.id, {
        name: data.name || "Requisito sin nombre",
        code: data.code || "",
      });
      if (data.code) requirementCodes.push(data.code);
    });

    // 5. Buscar templates activos para esos códigos
    const templatesSnap = requirementCodes.length > 0
      ? await companyRef(companyId)
          .collection("documentTemplates")
          .where("status", "==", "active")
          .where("accreditationRequirementCode", "in", requirementCodes)
          .get()
      : { docs: [] as FirebaseFirestore.QueryDocumentSnapshot[] };

    // Agrupar templates por código
    const templatesByCode = new Map<string, Array<{ id: string; name: string; customerId?: string; requiresSignature?: boolean }>>();
    templatesSnap.docs.forEach((doc) => {
      const data = doc.data();
      const code = data.accreditationRequirementCode as string;
      if (!code) return;
      if (!templatesByCode.has(code)) templatesByCode.set(code, []);
      templatesByCode.get(code)!.push({
        id: doc.id,
        name: data.name || "Plantilla sin nombre",
        customerId: data.customerId,
        requiresSignature: !!data.requiresSignature,
      });
    });

    // 6. Resolver mejor template por requisito (preferencia: customer-specific > general)
    const gaps: GapResult[] = [];
    for (const missing of missingIds) {
      const req = requirements.get(missing.id);
      if (!req) continue;

      const codeTemplates = templatesByCode.get(req.code) || [];
      let selected = codeTemplates.find((t) => orderCustomerId && t.customerId === orderCustomerId);
      if (!selected) {
        selected = codeTemplates.find((t) => !t.customerId);
      }
      if (!selected && codeTemplates.length > 0) {
        selected = codeTemplates[0];
      }

      gaps.push({
        requirementId: missing.id,
        requirementName: req.name,
        level: missing.level,
        templateId: selected?.id,
        templateName: selected?.name,
        requiresSignature: selected?.requiresSignature,
      });
    }

    return {
      gaps,
      fullyCompliant: gaps.length === 0,
      serviceOrderId,
      employeeId,
    };
  }
);
