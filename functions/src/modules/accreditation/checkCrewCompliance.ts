import { db } from "../../config";

/**
 * Verifica si un empleado cumple con los requisitos de acreditación
 * para ser asignado a una orden de servicio.
 */
export async function checkCrewCompliance(
  companyId: string,
  assignmentId: string,
  assignmentData: {
    serviceOrderId: string;
    employeeId: string;
    role: string;
  }
): Promise<void> {
  const { serviceOrderId, employeeId } = assignmentData;

  // 1. Obtener la orden de servicio (qué requisitos necesita)
  const orderDoc = await db
    .collection("companies")
    .doc(companyId)
    .collection("serviceOrders")
    .doc(serviceOrderId)
    .get();

  if (!orderDoc.exists) {
    throw new Error("Orden de servicio no encontrada");
  }

  const requiredRequirementIds: string[] = orderDoc.data()?.requiredRequirementIds || [];
  const requiredCourseIds: string[] = orderDoc.data()?.requiredCourseIds || [];

  // 2. Obtener acreditaciones del empleado
  const accreditationsSnap = await db
    .collection("companies")
    .doc(companyId)
    .collection("employees")
    .doc(employeeId)
    .collection("accreditations")
    .where("status", "==", "valid")
    .get();

  const validRequirementIds = new Set<string>();
  const validCourseIds = new Set<string>();

  accreditationsSnap.forEach((doc) => {
    const data = doc.data();
    if (data.type === "requirement") validRequirementIds.add(data.referenceId);
    if (data.type === "course") validCourseIds.add(data.referenceId);
  });

  // 3. Verificar cumplimiento
  const missingRequirements = requiredRequirementIds.filter(
    (id) => !validRequirementIds.has(id)
  );
  const missingCourses = requiredCourseIds.filter((id) => !validCourseIds.has(id));

  // 4. Crear o actualizar el accreditationCheck
  const checkRef = db
    .collection("companies")
    .doc(companyId)
    .collection("accreditationChecks")
    .doc(`${serviceOrderId}_${employeeId}`);

  await checkRef.set({
    serviceOrderId,
    employeeId,
    levelAStatus: missingRequirements.length === 0 ? "compliant" : "non_compliant",
    levelAMissingIds: missingRequirements,
    levelATotal: requiredRequirementIds.length,
    levelAValid: requiredRequirementIds.length - missingRequirements.length,
    levelBStatus: missingCourses.length === 0 ? "compliant" : "non_compliant",
    levelBMissingIds: missingCourses,
    levelBTotal: requiredCourseIds.length,
    levelBValid: requiredCourseIds.length - missingCourses.length,
    overallStatus:
      missingRequirements.length === 0 && missingCourses.length === 0
        ? "compliant"
        : "non_compliant",
    lastCheckedAt: new Date().toISOString(),
  });

  // 5. Actualizar la asignación con el estado de autorización
  const assignmentRef = db
    .collection("companies")
    .doc(companyId)
    .collection("crewAssignments")
    .doc(assignmentId);

  await assignmentRef.update({
    authorizationStatus:
      missingRequirements.length === 0 && missingCourses.length === 0
        ? "authorized"
        : "requires_revalidation",
    authorizationMode:
      missingRequirements.length === 0 && missingCourses.length === 0
        ? "ready"
        : "warning",
    lastComplianceCheck: new Date().toISOString(),
  });
}
