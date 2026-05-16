import { useAuth } from "@/contexts/AuthContext";

const adminRoles = new Set(["admin", "company_admin", "superadmin"]);
const managerRoles = new Set(["manager"]);

type ServiceAction =
  | "service.view_internal"
  | "service.edit_context"
  | "service.edit_operational_control"
  | "service.close_operational_step"
  | "service.manage_documents"
  | "service.version_documents"
  | "service.request_report_signature"
  | "service.view_mirror_internal"
  | "service.publish_mirror"
  | "service.view_financial"
  | "service.edit_financial"
  | "crm.create_lead"
  | "crm.edit_lead"
  | "crm.delete_lead"
  | "crm.manage_pipeline"
  | "quote.create"
  | "quote.edit"
  | "quote.delete"
  | "quote.send"
  | "quote.accept"
  | "quote.reject"
  | "quote.cancel"
  | "quote.view_preview"
  | "quote.view_export"
  | "hr.create_employee"
  | "hr.edit_employee"
  | "hr.delete_employee"
  | "hr.view_contracts"
  | "hr.manage_contracts"
  | "accreditation.create_service_order"
  | "accreditation.edit_service_order"
  | "accreditation.delete_service_order"
  | "accreditation.assign_crew"
  | "accreditation.remove_crew"
  | "accreditation.authorize_crew"
  | "accreditation.generate_documents"
  | "accreditation.recompute_checks"
  | "accreditation.view_compliance";

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

function fallbackModulesForRole(role: string | null): string[] {
  if (!role) return [];
  if (adminRoles.has(role)) {
    return ["crm", "reports", "finance", "expenses", "safety", "accreditation", "document_center", "signature", "quotes", "hr"];
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

export function usePermission() {
  const { role, allowedModules, serviceActions } = useAuth();

  function hasPermission(action: ServiceAction): boolean {
    if (adminRoles.has(role || "")) return true;
    if (serviceActions.includes(action)) return true;

    // Hard denials
    if (action === "crm.delete_lead") return false;
    if (action === "crm.manage_pipeline" && !managerRoles.has(role || "") && !adminRoles.has(role || "")) return false;

    const mods = allowedModules.length > 0 ? allowedModules : fallbackModulesForRole(role);
    const required = moduleMap[action] || [];
    return required.some((m) => mods.includes(m));
  }

  return { hasPermission, role };
}
