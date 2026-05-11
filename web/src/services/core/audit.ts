/**
 * Servicio de auditoría centralizado.
 * Crea logs de todas las acciones importantes para trazabilidad.
 */

import { db } from "@/firebase/config";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

export interface AuditLog {
  companyId: string;
  userId: string;
  userEmail: string;
  action: "create" | "update" | "delete" | "view" | "export" | "sign";
  resourceType: string;  // "quote", "employee", "serviceOrder", etc.
  resourceId: string;
  changes?: Record<string, { before: any; after: any }>;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Registra una acción en el log de auditoría.
 * Usar en TODOS los create/update/delete del ERP.
 */
export async function logAudit(entry: Omit<AuditLog, "timestamp">): Promise<void> {
  try {
    await addDoc(
      collection(db, "companies", entry.companyId, "auditLogs"),
      {
        ...entry,
        timestamp: serverTimestamp(),
      }
    );
  } catch (error) {
    // Nunca debe fallar la app por un log, pero sí lo reportamos
    console.error("[Audit] Error guardando log:", error);
  }
}

/**
 * Helper para loggear cambios detectando diferencias
 */
export function detectChanges<T extends Record<string, any>>(
  before: T,
  after: T
): Record<string, { before: any; after: any }> {
  const changes: Record<string, { before: any; after: any }> = {};

  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);

  for (const key of allKeys) {
    const beforeVal = before[key];
    const afterVal = after[key];

    // Ignorar campos internos
    if (key.startsWith("_")) continue;

    // Comparar (para objetos usar JSON.stringify)
    const isEqual =
      typeof beforeVal === "object" && typeof afterVal === "object"
        ? JSON.stringify(beforeVal) === JSON.stringify(afterVal)
        : beforeVal === afterVal;

    if (!isEqual) {
      changes[key] = { before: beforeVal, after: afterVal };
    }
  }

  return changes;
}
