/**
 * Servicio de permisos RBAC (Role-Based Access Control).
 * Define qué puede hacer cada rol en cada módulo.
 */

export type UserRole = "admin" | "manager" | "supervisor" | "user";
export type ResourceType =
  | "company"
  | "user"
  | "customer"
  | "lead"
  | "quote"
  | "serviceOrder"
  | "crewAssignment"
  | "employee"
  | "contract"
  | "signatureRequest"
  | "expense"
  | "inventoryItem"
  | "safetyDocument";

export type PermissionAction = "create" | "read" | "update" | "delete" | "approve" | "export";

/**
 * Matriz de permisos.
 * true = permitido, false = denegado.
 */
const PERMISSIONS: Record<UserRole, Partial<Record<ResourceType, PermissionAction[]>>> = {
  admin: {
    company: ["read", "update"],
    user: ["create", "read", "update", "delete"],
    customer: ["create", "read", "update", "delete"],
    lead: ["create", "read", "update", "delete"],
    quote: ["create", "read", "update", "delete", "approve", "export"],
    serviceOrder: ["create", "read", "update", "delete", "approve"],
    crewAssignment: ["create", "read", "update", "delete"],
    employee: ["create", "read", "update", "delete"],
    contract: ["create", "read", "update", "delete", "approve"],
    signatureRequest: ["create", "read", "update", "delete"],
    expense: ["create", "read", "update", "delete", "approve"],
    inventoryItem: ["create", "read", "update", "delete"],
    safetyDocument: ["create", "read", "update", "delete"],
  },

  manager: {
    company: ["read"],
    user: ["create", "read", "update"],
    customer: ["create", "read", "update"],
    lead: ["create", "read", "update", "delete"],
    quote: ["create", "read", "update", "delete", "export"],
    serviceOrder: ["create", "read", "update"],
    crewAssignment: ["create", "read", "update"],
    employee: ["create", "read", "update"],
    contract: ["create", "read", "update"],
    signatureRequest: ["create", "read", "update"],
    expense: ["create", "read", "update", "approve"],
    inventoryItem: ["create", "read", "update"],
    safetyDocument: ["create", "read", "update"],
  },

  supervisor: {
    company: ["read"],
    user: ["read"],
    customer: ["read"],
    lead: ["read", "update"],
    quote: ["read"],
    serviceOrder: ["read", "update"],
    crewAssignment: ["create", "read", "update"],
    employee: ["read"],
    contract: ["read"],
    signatureRequest: ["read"],
    expense: ["create", "read"],
    inventoryItem: ["read"],
    safetyDocument: ["create", "read", "update"],
  },

  user: {
    company: ["read"],
    user: ["read"],
    customer: ["read"],
    lead: ["create", "read", "update"],
    quote: ["create", "read", "update"],
    serviceOrder: ["read"],
    crewAssignment: ["read"],
    employee: ["read"],
    contract: ["read"],
    signatureRequest: ["read", "update"], // Puede firmar
    expense: ["create", "read"],
    inventoryItem: ["read"],
    safetyDocument: ["read"],
  },
};

/**
 * Verifica si un rol tiene permiso para una acción en un recurso.
 */
export function hasPermission(
  role: UserRole,
  resource: ResourceType,
  action: PermissionAction
): boolean {
  const rolePerms = PERMISSIONS[role];
  if (!rolePerms) return false;

  const resourcePerms = rolePerms[resource];
  if (!resourcePerms) return false;

  return resourcePerms.includes(action);
}

/**
 * Hook helper para deshabilitar botones en UI.
 */
export function canCreate(role: UserRole, resource: ResourceType): boolean {
  return hasPermission(role, resource, "create");
}

export function canEdit(role: UserRole, resource: ResourceType): boolean {
  return hasPermission(role, resource, "update");
}

export function canDelete(role: UserRole, resource: ResourceType): boolean {
  return hasPermission(role, resource, "delete");
}

export function canApprove(role: UserRole, resource: ResourceType): boolean {
  return hasPermission(role, resource, "approve");
}
