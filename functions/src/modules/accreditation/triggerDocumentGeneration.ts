import { onCall, HttpsError } from "firebase-functions/v2/https";
import { storage } from "../../config";
import { assertAction } from "../../shared/rbac";
import { cors, cleanString, companyRef } from "./accreditationService";
import { buildPDF } from "../../shared/pdfGenerator";
import { checkCrewCompliance } from "./checkCrewCompliance";
import { registerAccreditationDocument } from "./registerAccreditationDocument";

export const triggerDocumentGeneration = onCall(
  {
    region: "us-central1",
    cors,
    memory: "512MiB",
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Debes iniciar sesión");
    }

    const companyId = request.auth.token.companyId as string | undefined;
    if (!companyId) {
      throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
    }

    await assertAction(request, "accreditation.generate_documents", { companyId });

    const accreditationCheckId = cleanString(request.data?.accreditationCheckId);
    if (!accreditationCheckId) {
      throw new HttpsError("invalid-argument", "accreditationCheckId es obligatorio");
    }

    // 1. Leer check
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
      throw new HttpsError("failed-precondition", "Check incompleto");
    }

    // 2. Leer entidades relacionadas en paralelo
    const [orderDoc, employeeDoc, companyDoc] = await Promise.all([
      companyRef(companyId).collection("serviceOrders").doc(serviceOrderId).get(),
      companyRef(companyId).collection("employees").doc(employeeId).get(),
      companyRef(companyId).get(),
    ]);

    const orderData = orderDoc.exists ? orderDoc.data() : {};
    const employeeData = employeeDoc.exists ? employeeDoc.data() : {};
    const companyData = companyDoc.exists ? companyDoc.data() : {};
    const orderCustomerId = orderData?.customerId as string | undefined;

    // 3. Recopilar requisitos faltantes
    const missingIds: Array<{ id: string; level: "A" | "B" }> = [];
    const levelAMissing: string[] = checkData.levelAMissingIds || [];
    const levelBMissing: string[] = checkData.levelBMissingIds || [];
    for (const id of levelAMissing) missingIds.push({ id, level: "A" });
    for (const id of levelBMissing) missingIds.push({ id, level: "B" });

    if (missingIds.length === 0) {
      return { generated: 0, skipped: 0, requests: [], message: "No hay brechas documentales" };
    }

    // 4. Leer requisitos
    const reqIds = missingIds.map((m) => m.id);
    const reqsSnap = await companyRef(companyId)
      .collection("accreditationRequirements")
      .where("__name__", "in", reqIds)
      .get();

    const requirements = new Map<string, { name: string; code: string; defaultValidityDays?: number }>();
    const requirementCodes: string[] = [];
    reqsSnap.forEach((doc) => {
      const data = doc.data();
      requirements.set(doc.id, {
        name: data.name || "Requisito sin nombre",
        code: data.code || "",
        defaultValidityDays: data.defaultValidityDays,
      });
      if (data.code) requirementCodes.push(data.code);
    });

    // 5. Buscar templates
    const templatesSnap = requirementCodes.length > 0
      ? await companyRef(companyId)
        .collection("documentTemplates")
        .where("status", "==", "active")
        .where("accreditationRequirementCode", "in", requirementCodes)
        .get()
      : { docs: [] as FirebaseFirestore.QueryDocumentSnapshot[] };

    const templatesByCode = new Map<string, Array<{ id: string; name: string; customerId?: string; requiresSignature?: boolean; autoRegisterAccreditation?: boolean }>>();
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
        autoRegisterAccreditation: !!data.autoRegisterAccreditation,
      });
    });

    // 6. Generar documentos por gap
    const results: Array<{ id: string; status: string; error?: string }> = [];
    let generatedCount = 0;
    let skippedCount = 0;
    const now = new Date().toISOString();
    const bucket = storage.bucket();

    for (const missing of missingIds) {
      const req = requirements.get(missing.id);
      if (!req) {
        skippedCount++;
        continue;
      }

      const codeTemplates = templatesByCode.get(req.code) || [];
      let selected = codeTemplates.find((t) => orderCustomerId && t.customerId === orderCustomerId);
      if (!selected) selected = codeTemplates.find((t) => !t.customerId);
      if (!selected && codeTemplates.length > 0) selected = codeTemplates[0];

      if (!selected) {
        // Sin template: crear DGR skipped
        const dgrRef = companyRef(companyId).collection("documentGenerationRequests").doc();
        await dgrRef.set({
          companyId,
          accreditationCheckId,
          serviceOrderId,
          employeeId,
          requirementId: missing.id,
          status: "skipped",
          errorMessage: "No se encontró plantilla para el requisito",
          createdAt: now,
        });
        results.push({ id: dgrRef.id, status: "skipped" });
        skippedCount++;
        continue;
      }

      // Crear DGR template_found
      const dgrRef = companyRef(companyId).collection("documentGenerationRequests").doc();
      await dgrRef.set({
        companyId,
        accreditationCheckId,
        serviceOrderId,
        employeeId,
        requirementId: missing.id,
        templateId: selected.id,
        status: "template_found",
        createdAt: now,
      });

      try {
        // Generar PDF
        const employeeName = employeeData?.fullName || `${employeeData?.firstName || ""} ${employeeData?.lastName || ""}`.trim() || "N/A";
        const validUntil = req.defaultValidityDays
          ? new Date(Date.now() + req.defaultValidityDays * 24 * 60 * 60 * 1000).toISOString()
          : null;

        const pdfBuffer = await buildPDF({
          companyName: companyData?.name || "Empresa",
          documentTitle: `${req.name} - ${employeeName}`,
          sections: [
            {
              title: "Trabajador",
              lines: [
                { label: "Nombre", value: employeeName },
                { label: "RUT", value: employeeData?.cedula || "N/A" },
                { label: "Cargo", value: employeeData?.positionTitle || "N/A" },
              ],
            },
            {
              title: "Requisito de acreditación",
              lines: [
                { label: "Nombre", value: req.name },
                { label: "Nivel", value: missing.level },
                { label: "Código", value: req.code },
              ],
            },
            {
              title: "Orden de servicio",
              lines: [
                { label: "Título", value: orderData?.title || "N/A" },
                { label: "Ubicación", value: orderData?.location || "N/A" },
              ],
            },
            {
              title: "Vigencia",
              lines: [
                { label: "Emitido", value: now.slice(0, 10) },
                { label: "Vence", value: validUntil ? validUntil.slice(0, 10) : "Sin vencimiento" },
              ],
            },
          ],
        });

        // Guardar en Storage
        const fileName = `${req.code}_${employeeName.replace(/\s+/g, "_")}_${Date.now()}.pdf`
          .replace(/[^a-zA-Z0-9_.-]/g, "");
        const storagePath = `companies/${companyId}/generated/${fileName}`;
        await bucket.file(storagePath).save(pdfBuffer, { metadata: { contentType: "application/pdf" } });

        // Crear GeneratedDocument
        const genRef = companyRef(companyId).collection("generatedDocuments").doc();
        await genRef.set({
          companyId,
          templateId: selected.id,
          templateName: selected.name,
          name: `${req.name} - ${employeeName}`,
          outputFilename: fileName,
          recipientName: employeeName,
          recipientEmail: employeeData?.email || "",
          employeeId,
          customerId: orderCustomerId || null,
          serviceOrderId,
          targetModule: "accreditation",
          targetRecordId: accreditationCheckId,
          sourceModule: "accreditation",
          sourceRecordId: accreditationCheckId,
          sourceLabel: `${employeeName} / ${req.name}`,
          mergePayload: {
            employee: { fullName: employeeName, cedula: employeeData?.cedula, positionTitle: employeeData?.positionTitle },
            requirement: { name: req.name, code: req.code, level: missing.level },
            serviceOrder: { title: orderData?.title },
            validUntil,
          },
          storagePath,
          availableFormats: ["pdf"],
          status: "generated",
          requiresSignature: selected.requiresSignature,
          createdAt: now,
          updatedAt: now,
        });

        // Actualizar DGR
        await dgrRef.update({
          status: "generated",
          generatedDocumentId: genRef.id,
          completedAt: now,
        });

        generatedCount++;

        // Si no requiere firma: registrar acreditación y recompute
        if (!selected.requiresSignature) {
          await registerAccreditationDocument({
            companyId,
            employeeId,
            requirementId: missing.id,
            generatedDocumentId: genRef.id,
            storagePath,
            verificationStatus: "approved",
            signatureStatus: "not_required",
            validUntil,
          });

          // Recompute check
          const assignmentSnap = await companyRef(companyId)
            .collection("crewAssignments")
            .where("serviceOrderId", "==", serviceOrderId)
            .where("employeeId", "==", employeeId)
            .where("status", "in", ["assigned", "active"])
            .limit(1)
            .get();

          if (!assignmentSnap.empty) {
            const assignmentDoc = assignmentSnap.docs[0];
            await checkCrewCompliance(companyId, assignmentDoc.id, {
              serviceOrderId,
              employeeId,
              role: assignmentDoc.data().role || "worker",
            });
          }

          results.push({ id: dgrRef.id, status: "generated_and_registered" });
        } else {
          // Requiere firma: crear SignatureRequest
          const sigRef = companyRef(companyId).collection("signatureRequests").doc();
          const token = Array.from({ length: 32 }, () =>
            "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789".charAt(Math.floor(Math.random() * 62))
          ).join("");

          await sigRef.set({
            companyId,
            name: `${req.name} - ${employeeName}`,
            description: `Documento de acreditación generado automáticamente: ${req.name}`,
            requestFrom: request.auth.uid,
            requestToEmail: employeeData?.email || "firmante@ejemplo.cl",
            requestToName: employeeName,
            generatedDocumentId: genRef.id,
            storagePath,
            signaturePositions: [],
            status: "draft",
            accessToken: token,
            sourceModule: "accreditation",
            accreditationCheckId,
            requirementId: missing.id,
            createdAt: now,
            updatedAt: now,
          });

          // Actualizar GeneratedDocument con link a signature
          await genRef.update({ status: "signature_pending", signatureRequestId: sigRef.id });

          // Actualizar DGR
          await dgrRef.update({
            status: "signature_pending",
            signatureRequestId: sigRef.id,
          });

          results.push({ id: dgrRef.id, status: "signature_pending" });
        }
      } catch (err: any) {
        console.error(`[triggerDocumentGeneration] Error generando doc para req ${missing.id}:`, err);
        await dgrRef.update({
          status: "failed",
          errorMessage: err.message || "Error desconocido al generar documento",
        });
        results.push({ id: dgrRef.id, status: "failed", error: err.message });
      }
    }

    return {
      generated: generatedCount,
      skipped: skippedCount,
      requests: results,
    };
  }
);
