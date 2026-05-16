import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase/config";
import type { Employee } from "@/types";

export async function createEmployee(payload: Partial<Employee>): Promise<{ id: string; employeeCode: string }> {
  const fn = httpsCallable(functions, "createEmployee");
  const result = await fn(payload);
  return result.data as { id: string; employeeCode: string };
}

export async function updateEmployee(employeeId: string, payload: Partial<Employee>): Promise<{ id: string; updated: boolean }> {
  const fn = httpsCallable(functions, "updateEmployee");
  const result = await fn({ id: employeeId, ...payload });
  return result.data as { id: string; updated: boolean };
}
