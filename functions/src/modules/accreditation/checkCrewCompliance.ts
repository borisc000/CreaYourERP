import { db } from "../../config";

/**
 * Verifica si un empleado cumple con los requisitos de acreditación
 * para ser asignado a una orden de servicio.
 *
 * Implementa discriminación Level A (general) vs Level B (cliente/específico)
 * y evaluación de vencimiento de documentos.
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

  // 1. Obtener la orden de servicio
  const orderDoc = await db
    .collection("companies")
    .doc(companyId)
    .collection("serviceOrders")
    .doc(serviceOrderId)
    .get();

  if (!orderDoc.exists) {
    throw new Error("Orden de servicio no encontrada");
  }

  const orderData = orderDoc.data() || {};
  const customerId: string | null = orderData.customerId || null;
  const orderRequiredRequirementIds: string[] = orderData.requiredRequirementIds || [];

  // 2. Obtener TODOS los requisitos de acreditación de la empresa
  const reqsSnap = await db
    .collection("companies")
    .doc(companyId)
    .collection("accreditationRequirements")
    .get();

  const allRequirements = reqsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

  // 3. Separar Level A (globales) y Level B (cliente + explícitos de la orden)
  const levelAReqs = allRequirements.filter(
    (r: any) => !r.customerId || r.isGlobal === true
  );

  const levelBReqs = allRequirements.filter((r: any) => {
    // Requisitos específicos del cliente de la orden
    if (customerId && r.customerId === customerId) return true;
    // Requisitos explícitamente requeridos por la orden
    if (orderRequiredRequirementIds.includes(r.id)) return true;
    return false;
  });

  // Eliminar duplicados en Level B (un req puede ser del cliente Y explícito)
  const seenB = new Set<string>();
  const uniqueLevelBReqs = levelBReqs.filter((r: any) => {
    if (seenB.has(r.id)) return false;
    seenB.add(r.id);
    return true;
  });

  // 4. Obtener acreditaciones válidas del empleado (con evaluación de vencimiento)
  const accreditationsSnap = await db
    .collection("companies")
    .doc(companyId)
    .collection("employees")
    .doc(employeeId)
    .collection("accreditations")
    .where("status", "==", "valid")
    .get();

  const todayIso = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  const validAccreditations = new Map<string, { validUntil?: string }>();
  accreditationsSnap.forEach((doc) => {
    const data = doc.data();
    const refId = data.referenceId as string;
    const validUntil = data.validUntil as string | undefined;

    // Evaluar vencimiento: validUntil == null OR validUntil >= hoy
    const isNotExpired = !validUntil || validUntil >= todayIso;
    if (isNotExpired) {
      validAccreditations.set(refId, { validUntil });
    }
  });

  // 5. Calcular compliance Level A
  const levelAMissing: string[] = [];
  for (const req of levelAReqs) {
    if (!validAccreditations.has(req.id)) {
      levelAMissing.push(req.id);
    }
  }

  const levelAStatus = levelAMissing.length === 0 ? "compliant" : "non_compliant";

  // 6. Calcular compliance Level B
  const levelBMissing: string[] = [];
  for (const req of uniqueLevelBReqs) {
    if (!validAccreditations.has(req.id)) {
      levelBMissing.push(req.id);
    }
  }

  const levelBStatus = levelBMissing.length === 0 ? "compliant" : "non_compliant";

  // 7. Calcular overallStatus
  let overallStatus: "compliant" | "attention" | "non_compliant";
  if (levelAStatus === "compliant" && levelBStatus === "compliant") {
    overallStatus = "compliant";
  } else if (levelAStatus === "compliant" || levelBStatus === "compliant") {
    overallStatus = "attention";
  } else {
    overallStatus = "non_compliant";
  }

  // 8. Crear o actualizar el accreditationCheck
  const checkRef = db
    .collection("companies")
    .doc(companyId)
    .collection("accreditationChecks")
    .doc(`${serviceOrderId}_${employeeId}`);

  await checkRef.set({
    companyId,
    serviceOrderId,
    employeeId,
    levelAStatus,
    levelATotal: levelAReqs.length,
    levelAValid: levelAReqs.length - levelAMissing.length,
    levelAMissingIds: levelAMissing,
    levelBStatus,
    levelBTotal: uniqueLevelBReqs.length,
    levelBValid: uniqueLevelBReqs.length - levelBMissing.length,
    levelBMissingIds: levelBMissing,
    overallStatus,
    lastCheckedAt: new Date().toISOString(),
  });

  // 9. Actualizar la asignación con el estado de autorización
  const assignmentRef = db
    .collection("companies")
    .doc(companyId)
    .collection("crewAssignments")
    .doc(assignmentId);

  const isFullyCompliant = overallStatus === "compliant";

  await assignmentRef.update({
    authorizationStatus: isFullyCompliant ? "authorized" : "requires_revalidation",
    authorizationMode: isFullyCompliant ? "ready" : "warning",
    lastComplianceCheck: new Date().toISOString(),
  });
}
