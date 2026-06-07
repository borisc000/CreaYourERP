import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase/config";
import type { ServiceOrder, CrewAssignment } from "@/types";

export async function createServiceOrder(payload: Partial<ServiceOrder>): Promise<{ id: string } & Partial<ServiceOrder>> {
  const fn = httpsCallable(functions, "createServiceOrder");
  const result = await fn(payload);
  return result.data as { id: string } & Partial<ServiceOrder>;
}

export async function updateServiceOrder(orderId: string, payload: Partial<ServiceOrder>): Promise<{ id: string; updated: boolean }> {
  const fn = httpsCallable(functions, "updateServiceOrder");
  const result = await fn({ id: orderId, ...payload });
  return result.data as { id: string; updated: boolean };
}

export async function assignCrewMember(serviceOrderId: string, employeeId: string, role: string): Promise<{ id: string } & Partial<CrewAssignment>> {
  const fn = httpsCallable(functions, "assignCrewMember");
  const result = await fn({ serviceOrderId, employeeId, role });
  return result.data as { id: string } & Partial<CrewAssignment>;
}

export async function removeCrewMember(assignmentId: string): Promise<{ id: string; status: string }> {
  const fn = httpsCallable(functions, "removeCrewMember");
  const result = await fn({ assignmentId });
  return result.data as { id: string; status: string };
}

export async function authorizeCrew(assignmentIds: string[]): Promise<{ results: Array<{ id: string; status: string }>; authorizedAt: string }> {
  const fn = httpsCallable(functions, "authorizeCrew");
  const result = await fn({ assignmentIds });
  return result.data as { results: Array<{ id: string; status: string }>; authorizedAt: string };
}

export async function recomputeChecks(serviceOrderId: string): Promise<{ serviceOrderId: string; checksComputed: number; totalAssignments: number; errors?: string[] }> {
  const fn = httpsCallable(functions, "recomputeChecks");
  const result = await fn({ serviceOrderId });
  return result.data as { serviceOrderId: string; checksComputed: number; totalAssignments: number; errors?: string[] };
}

export interface GapResult {
  requirementId: string;
  requirementName: string;
  level: "A" | "B";
  templateId?: string;
  templateName?: string;
  requiresSignature?: boolean;
}

export async function detectGaps(accreditationCheckId: string): Promise<{ gaps: GapResult[]; fullyCompliant: boolean; serviceOrderId: string; employeeId: string }> {
  const fn = httpsCallable(functions, "detectGaps");
  const result = await fn({ accreditationCheckId });
  return result.data as { gaps: GapResult[]; fullyCompliant: boolean; serviceOrderId: string; employeeId: string };
}

export async function triggerDocumentGeneration(accreditationCheckId: string): Promise<{ generated: number; skipped: number; requests: Array<{ id: string; status: string; error?: string }> }> {
  const fn = httpsCallable(functions, "triggerDocumentGeneration");
  const result = await fn({ accreditationCheckId });
  return result.data as { generated: number; skipped: number; requests: Array<{ id: string; status: string; error?: string }> };
}

export async function bulkAssignCrew(serviceOrderId: string, assignments: Array<{ employeeId: string; role: string }>): Promise<{ serviceOrderId: string; results: Array<{ id: string; employeeId: string; status: string }>; assignedCount: number; skippedCount: number }> {
  const fn = httpsCallable(functions, "bulkAssignCrew");
  const result = await fn({ serviceOrderId, assignments });
  return result.data as { serviceOrderId: string; results: Array<{ id: string; employeeId: string; status: string }>; assignedCount: number; skippedCount: number };
}

export interface ExpiringDocument {
  accreditationId: string;
  employeeId: string;
  employeeName?: string;
  requirementId: string;
  requirementName?: string;
  documentUrl?: string;
  validUntil: string;
  daysRemaining: number;
  serviceOrderIds: string[];
}

export async function checkExpiringDocuments(daysAhead?: number): Promise<{ expiring: ExpiringDocument[]; total: number; daysAhead: number }> {
  const fn = httpsCallable(functions, "checkExpiringDocuments");
  const result = await fn({ daysAhead });
  return result.data as { expiring: ExpiringDocument[]; total: number; daysAhead: number };
}
