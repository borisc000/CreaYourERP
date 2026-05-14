/**
 * Trigger: Cuando se crea un empleado nuevo,
 * generar tareas de onboarding y asignar cursos obligatorios.
 */

import { onDocumentCreated } from "firebase-functions/v2/firestore";
import { db } from "../../config";

export const onEmployeeHired = onDocumentCreated(
  {
    document: "companies/{companyId}/employees/{employeeId}",
    region: "southamerica-west1",
  },
  async (event) => {
    const { companyId, employeeId } = event.params;
    const data = event.data?.data();
    if (!data) return;

    console.log(`[onEmployeeHired] New employee ${employeeId} in company ${companyId}`);

    try {
      // 1. Crear tareas de onboarding
      const onboardingTasks = [
        { title: "Entrega de EPP", description: "Entregar equipo de protección personal" },
        { title: "Charla de inducción", description: "Realizar charla de seguridad" },
        { title: "Firmar contrato", description: "Generar y firmar contrato laboral" },
        { title: "Foto y credencial", description: "Tomar foto para credencial de faena" },
      ];

      for (const task of onboardingTasks) {
        await db.collection("companies").doc(companyId).collection("tasks").add({
          companyId,
          title: task.title,
          description: task.description,
          relatedTo: "employee",
          relatedId: employeeId,
          assignedTo: data.createdBy || null,
          status: "pending",
          priority: "medium",
          createdAt: new Date().toISOString(),
        });
      }

      // 2. Si tiene jobProfile, asignar cursos y requisitos obligatorios
      if (data.jobProfileId) {
        const profileDoc = await db
          .collection("companies")
          .doc(companyId)
          .collection("jobProfiles")
          .doc(data.jobProfileId)
          .get();

        if (profileDoc.exists) {
          const profile = profileDoc.data();
          const requiredCourseIds = profile?.requiredCourseIds || [];
          const requiredRequirementIds = profile?.requiredRequirementIds || [];

          for (const courseId of requiredCourseIds) {
            await db
              .collection("companies")
              .doc(companyId)
              .collection("employees")
              .doc(employeeId)
              .collection("accreditations")
              .add({
                companyId,
                employeeId,
                type: "course",
                referenceId: courseId,
                status: "pending",
                validFrom: null,
                validUntil: null,
                createdAt: new Date().toISOString(),
              });
          }

          for (const reqId of requiredRequirementIds) {
            await db
              .collection("companies")
              .doc(companyId)
              .collection("employees")
              .doc(employeeId)
              .collection("accreditations")
              .add({
                companyId,
                employeeId,
                type: "requirement",
                referenceId: reqId,
                status: "pending",
                validFrom: null,
                validUntil: null,
                createdAt: new Date().toISOString(),
              });
          }
        }
      }

      console.log(`[onEmployeeHired] Onboarding created for ${employeeId}`);
    } catch (error) {
      console.error("[onEmployeeHired] Error:", error);
    }
  }
);
