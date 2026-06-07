import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase/config";

export async function createBillingDocumentFromQuote(quoteId: string): Promise<{ success: boolean; documentId: string; documentNumber?: string; alreadyExists?: boolean }> {
  const fn = httpsCallable(functions, "createBillingDocumentFromQuote");
  const result = await fn({ quoteId });
  return result.data as { success: boolean; documentId: string; documentNumber?: string; alreadyExists?: boolean };
}
