/**
 * Servicio compartido de validaciones y utilidades para el módulo Accreditation.
 */

import { db } from "../../config";

export const cors = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5000",
  "https://your-erp.web.app",
  "https://your-erp-staging.web.app",
  "https://your-erp-staging.firebaseapp.com",
];

export function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function companyRef(companyId: string) {
  return db.collection("companies").doc(companyId);
}

export function serializeDoc(snapshot: FirebaseFirestore.DocumentSnapshot): Record<string, unknown> | null {
  if (!snapshot.exists) return null;
  return { id: snapshot.id, ...snapshot.data() };
}

export function validateServiceOrderInput(data: Record<string, unknown>): string | null {
  const title = cleanString(data.title);
  if (!title) return "El título es obligatorio";
  if (title.length < 2) return "El título debe tener al menos 2 caracteres";

  const leadId = cleanString(data.leadId);
  if (!leadId) return "Debes seleccionar una oportunidad";

  const riskLevel = cleanString(data.riskLevel);
  if (!riskLevel) return "El nivel de riesgo es obligatorio";
  if (!["Bajo", "Medio", "Alto", "Crítico"].includes(riskLevel)) {
    return "Nivel de riesgo inválido";
  }

  return null;
}

export async function getServiceOrder(companyId: string, orderId: string) {
  const snap = await companyRef(companyId).collection("serviceOrders").doc(orderId).get();
  return serializeDoc(snap);
}

export async function getCrewAssignment(companyId: string, assignmentId: string) {
  const snap = await companyRef(companyId).collection("crewAssignments").doc(assignmentId).get();
  return serializeDoc(snap);
}
