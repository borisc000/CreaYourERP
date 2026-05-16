import type { CallableRequest } from "firebase-functions/v2/https";
import { HttpsError } from "firebase-functions/v2/https";
import { db } from "../config";

export const rbacCors = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5000",
  "https://your-erp.web.app",
  "https://your-erp-staging.web.app",
  "https://your-erp-staging.firebaseapp.com",
];

// ==========================================
// ACTIONS DEFINITIONS
// ==========================================

export const SERVICE_ACTIONS = [
  // CRM / Service actions (existentes)
  "service.view_internal",
  "service.edit_context",
  "service.edit_operational_control",
  "service.close_operational_step",
  "service.manage_documents",
  "service.version_documents",
  "service.request_report_signature",
  "service.view_mirror_internal",
  "service.publish_mirror",
  "service.view_financial",
  "service.edit_financial",
  "crm.create_lead",
  "crm.edit_lead",
  "crm.delete_lead",
  "crm.manage_pipeline",
  // Quotes
  "quote.create",
  "quote.edit",
  "quote.delete",
  "quote.send",
  "quote.accept",
  "quote.reject",
  "quote.cancel",
  "quote.view_preview",
  "quote.view_export",
  // HR
  "hr.create_employee",
  "hr.edit_employee",
  "hr.delete_employee",
  "hr.view_contracts",
  "hr.manage_contracts",
  // Accreditation
  "accreditation.create_service_order",
  "accreditation.edit_service_order",
  "accreditation.delete_service_order",
  "accreditation.assign_crew",
  "accreditation.remove_crew",
  "accreditation.authorize_crew",
  "accreditation.generate_documents",
  "accreditation.recompute_checks",
  "accreditation.view_compliance",
] as const;

export type ServiceAction = (typeof SERVICE_ACTIONS)[number];

// ==========================================
// AUTH CONTEXT
// ==========================================

export interface AuthContext {
  uid: string;
  companyId: string;
  role: string;
  name: string;
  email: string;
  allowedModules: string[];
  serviceActions: string[];
}

// ==========================================
// MODULE MAP (action -> required modules)
// ==========================================

const moduleMap: Record<ServiceAction, string[]> = {
  "service.view_internal": ["crm", "reports", "finance", "expenses", "safety", "accreditation", "document_center"],
  "service.edit_context": ["crm"],
  "service.edit_operational_control": ["crm", "reports", "safety"],
  "service.close_operational_step": ["reports", "safety"],
  "service.manage_documents": ["crm", "document_center"],
  "service.version_documents": ["crm", "document_center"],
  "service.request_report_signature": ["reports", "signature"],
  "service.view_mirror_internal": ["crm", "reports"],
  "service.publish_mirror": ["crm"],
  "service.view_financial": ["finance", "expenses"],
  "service.edit_financial": ["finance", "expenses"],
  "crm.create_lead": ["crm"],
  "crm.edit_lead": ["crm"],
  "crm.delete_lead": ["crm"],
  "crm.manage_pipeline": ["crm"],
  "quote.create": ["quotes"],
  "quote.edit": ["quotes"],
  "quote.delete": ["quotes"],
  "quote.send": ["quotes"],
  "quote.accept": ["quotes"],
  "quote.reject": ["quotes"],
  "quote.cancel": ["quotes"],
  "quote.view_preview": ["quotes"],
  "quote.view_export": ["quotes"],
  "hr.create_employee": ["hr"],
  "hr.edit_employee": ["hr"],
  "hr.delete_employee": ["hr"],
  "hr.view_contracts": ["hr"],
  "hr.manage_contracts": ["hr"],
  "accreditation.create_service_order": ["accreditation"],
  "accreditation.edit_service_order": ["accreditation"],
  "accreditation.delete_service_order": ["accreditation"],
  "accreditation.assign_crew": ["accreditation"],
  "accreditation.remove_crew": ["accreditation"],
  "accreditation.authorize_crew": ["accreditation"],
  "accreditation.generate_documents": ["accreditation"],
  "accreditation.recompute_checks": ["accreditation"],
  "accreditation.view_compliance": ["accreditation"],
};

// ==========================================
// ROLE DEFINITIONS
// ==========================================

const adminRoles = new Set(["admin", "company_admin", "superadmin"]);
const managerRoles = new Set(["manager"]);

function fallbackModulesForRole(role: string): string[] {
  if (adminRoles.has(role)) {
    return [
      "crm",
      "reports",
      "finance",
      "expenses",
      "safety",
      "accreditation",
      "document_center",
      "signature",
      "quotes",
      "hr",
    ];
  }
  if (managerRoles.has(role)) {
    return ["crm", "reports", "safety", "accreditation", "document_center", "quotes", "hr"];
  }
  if (role === "user" || role === "employee") {
    return ["crm"];
  }
  if (role === "supervisor") {
    return ["crm", "reports", "safety", "accreditation"];
  }
  return [];
}

// ==========================================
// HELPERS
// ==========================================

function normalizeStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter(Boolean);
}

function isKnownAction(action: string): action is ServiceAction {
  return (SERVICE_ACTIONS as readonly string[]).includes(action);
}

export function actionAllowed(ctx: AuthContext, action: ServiceAction): boolean {
  if (adminRoles.has(ctx.role)) return true;
  if (ctx.serviceActions.includes(action)) return true;

  // Hard denials
  if (action === "crm.delete_lead") return false;
  if (action === "crm.manage_pipeline" && !managerRoles.has(ctx.role) && !adminRoles.has(ctx.role)) return false;

  const allowedModules = ctx.allowedModules.length > 0 ? ctx.allowedModules : fallbackModulesForRole(ctx.role);
  const requiredModules = moduleMap[action] || [];
  return requiredModules.some((moduleName) => allowedModules.includes(moduleName));
}

// ==========================================
// AUTH CONTEXT BUILDER
// ==========================================

export async function getAuthContext(request: CallableRequest): Promise<AuthContext> {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Debes iniciar sesion");
  }

  const companyId = request.auth.token.companyId as string | undefined;
  if (!companyId) {
    throw new HttpsError("failed-precondition", "Usuario no tiene empresa asignada");
  }

  const uid = request.auth.uid;
  const userSnap = await db.collection("companies").doc(companyId).collection("users").doc(uid).get();
  const userData = userSnap.exists ? userSnap.data() || {} : {};
  const role = String(userData.role || request.auth.token.role || "user");
  const allowedModules = normalizeStringList(userData.allowedModules || userData.allowed_modules || userData.modules);
  const serviceActions = normalizeStringList(userData.serviceActions || userData.service_actions);

  return {
    uid,
    companyId,
    role,
    name: String(userData.name || request.auth.token.name || request.auth.token.email || "Usuario"),
    email: String(userData.email || request.auth.token.email || ""),
    allowedModules,
    serviceActions,
  };
}

// ==========================================
// ASSERT ACTION (generic)
// ==========================================

export async function assertAction(
  request: CallableRequest,
  action: ServiceAction,
  resource?: { companyId?: unknown }
): Promise<AuthContext> {
  if (!isKnownAction(action)) {
    throw new HttpsError("invalid-argument", `Accion no reconocida: ${action}`);
  }

  const ctx = await getAuthContext(request);
  if (resource?.companyId && String(resource.companyId) !== ctx.companyId) {
    throw new HttpsError("permission-denied", "No tienes acceso a este recurso");
  }

  if (!actionAllowed(ctx, action)) {
    throw new HttpsError("permission-denied", `No tienes permiso para ${action}`);
  }

  return ctx;
}
