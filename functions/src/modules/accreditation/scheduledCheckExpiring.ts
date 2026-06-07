import { onSchedule } from "firebase-functions/v2/scheduler";
import { db } from "../../config";
import { companyRef } from "./accreditationService";

/**
 * Job programado: revisa documentos de acreditación por vencer
 * en todas las empresas activas y crea notificaciones.
 *
 * Schedule: todos los días a las 06:00 AM (America/Santiago).
 * Requiere Cloud Scheduler API habilitado en el proyecto Firebase.
 */
export const scheduledCheckExpiringDocuments = onSchedule(
  {
    schedule: "0 6 * * *",
    timeZone: "America/Santiago",
    region: "us-central1",
  },
  async (_event) => {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const futureDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    // Obtener empresas activas
    const companiesSnap = await db
      .collection("companies")
      .where("isActive", "!=", false)
      .get();

    let totalNotifications = 0;
    let totalCompaniesChecked = 0;

    for (const companyDoc of companiesSnap.docs) {
      const companyId = companyDoc.id;
      const companyData = companyDoc.data();

      // Saltar empresas inactivas o de prueba
      if (companyData.isActive === false || companyData.plan === "demo") {
        continue;
      }

      totalCompaniesChecked++;

      try {
        // Buscar acreditaciones válidas que vencen en los próximos 30 días
        const accSnap = await db
          .collectionGroup("accreditations")
          .where("companyId", "==", companyId)
          .where("status", "==", "valid")
          .where("validUntil", ">=", today)
          .where("validUntil", "<=", futureDate)
          .get();

        if (accSnap.empty) {
          continue;
        }

        // Agrupar por empleado para notificación consolidada
        const byEmployee = new Map<
          string,
          { employeeName: string; docs: Array<{ requirementName: string; daysRemaining: number; validUntil: string }> }
        >();

        for (const doc of accSnap.docs) {
          const data = doc.data();
          const validUntil = data.validUntil as string;
          const daysRemaining = Math.ceil(
            (new Date(validUntil).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
          );

          // Enriquecer con nombre de empleado
          let employeeName = "Desconocido";
          try {
            const empDoc = await companyRef(companyId)
              .collection("employees")
              .doc(data.employeeId)
              .get();
            if (empDoc.exists) {
              const empData = empDoc.data();
              employeeName =
                empData?.fullName ||
                `${empData?.firstName || ""} ${empData?.lastName || ""}`.trim() ||
                "Desconocido";
            }
          } catch {
            // ignore enrichment errors
          }

          // Enriquecer con nombre de requisito
          let requirementName = "Requisito desconocido";
          try {
            const reqDoc = await companyRef(companyId)
              .collection("accreditationRequirements")
              .doc(data.referenceId)
              .get();
            if (reqDoc.exists) {
              requirementName = reqDoc.data()?.name || "Requisito desconocido";
            }
          } catch {
            // ignore enrichment errors
          }

          if (!byEmployee.has(data.employeeId)) {
            byEmployee.set(data.employeeId, { employeeName, docs: [] });
          }
          byEmployee.get(data.employeeId)!.docs.push({
            requirementName,
            daysRemaining,
            validUntil,
          });
        }

        // Crear notificaciones por empresa
        const batch = db.batch();
        const notificationsRef = companyRef(companyId).collection("notifications");

        for (const [employeeId, { employeeName, docs }] of byEmployee) {
          // Notificación consolidada por empleado
          const title =
            docs.length === 1
              ? `Documento de ${employeeName} vence en ${docs[0].daysRemaining} días`
              : `${docs.length} documentos de ${employeeName} próximos a vencer`;

          const body =
            docs.length === 1
              ? `${docs[0].requirementName} — vence el ${docs[0].validUntil}`
              : docs
                .map((d) => `• ${d.requirementName} (en ${d.daysRemaining} días)`)
                .join("\n");

          const notifRef = notificationsRef.doc();
          batch.set(notifRef, {
            companyId,
            type: "accreditation_expiring",
            title,
            body,
            employeeId,
            employeeName,
            documentCount: docs.length,
            documents: docs,
            priority: docs.some((d) => d.daysRemaining <= 7) ? "high" : "medium",
            read: false,
            createdAt: new Date().toISOString(),
          });

          totalNotifications++;
        }

        await batch.commit();
      } catch (err) {
        console.error(
          `[scheduledCheckExpiring] Error processing company ${companyId}:`
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          , (err as any).message || err
        );
      }
    }

    console.log(
      `[scheduledCheckExpiring] Checked ${totalCompaniesChecked} companies, created ${totalNotifications} notifications.`
    );
  }
);
