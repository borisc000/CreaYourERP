import { httpsCallable } from "firebase/functions";
import { functions } from "@/firebase/config";
import type { CatalogItem, CatalogType } from "@/types";

export async function saveCatalogItem(payload: Partial<CatalogItem>): Promise<{ id: string; created?: boolean; updated?: boolean }> {
  const fn = httpsCallable(functions, "saveCatalogItem");
  const result = await fn(payload);
  return result.data as { id: string; created?: boolean; updated?: boolean };
}

export async function deleteCatalogItem(catalogType: CatalogType, id: string): Promise<{ id: string; deleted: boolean }> {
  const fn = httpsCallable(functions, "deleteCatalogItem");
  const result = await fn({ catalogType, id });
  return result.data as { id: string; deleted: boolean };
}
