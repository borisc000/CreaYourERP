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
