import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase/config";
import type { EmployeeContract } from "@/types";

export async function createContract(payload: Partial<EmployeeContract>): Promise<{ id: string; created: boolean }> {
  const fn = httpsCallable(functions, "createContract");
  const result = await fn(payload);
  return result.data as { id: string; created: boolean };
}

export async function updateContract(contractId: string, payload: Partial<EmployeeContract>): Promise<{ id: string; updated: boolean }> {
  const fn = httpsCallable(functions, "updateContract");
  const result = await fn({ id: contractId, ...payload });
  return result.data as { id: string; updated: boolean };
}

export async function deleteContract(contractId: string): Promise<{ id: string; deleted: boolean }> {
  const fn = httpsCallable(functions, "deleteContract");
  const result = await fn({ contractId });
  return result.data as { id: string; deleted: boolean };
}
