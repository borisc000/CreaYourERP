import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase/config";
import type { QuoteTemplate, QuoteTemplateLine } from "@/types";

export interface SaveQuoteTemplatePayload {
  id?: string;
  name: string;
  description?: string;
  lines: QuoteTemplateLine[];
  taxPct: number;
  admMarginPct: number;
  profitMarginPct: number;
  notes?: string;
  isActive?: boolean;
}

export async function listQuoteTemplates(): Promise<{ items: QuoteTemplate[] }> {
  const fn = httpsCallable(functions, "listQuoteTemplates");
  const result = await fn();
  return result.data as { items: QuoteTemplate[] };
}

export async function saveQuoteTemplate(payload: SaveQuoteTemplatePayload): Promise<{ id: string; created?: boolean; updated?: boolean }> {
  const fn = httpsCallable(functions, "saveQuoteTemplate");
  const result = await fn(payload);
  return result.data as { id: string; created?: boolean; updated?: boolean };
}

export async function deleteQuoteTemplate(id: string): Promise<{ deleted: boolean }> {
  const fn = httpsCallable(functions, "deleteQuoteTemplate");
  const result = await fn({ id });
  return result.data as { deleted: boolean };
}
