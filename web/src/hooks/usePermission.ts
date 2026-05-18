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
  | "quotes.manage_catalogs"
  | "quote.manage_templates"
  | "hr.create_employee"
  | "hr.edit_employee"
  | "hr.delete_employee"
  | "hr.view_contracts"
  | "hr.manage_contracts"
  | "hr.manage_job_profile_functions"
  | "hr.manage_job_profile_responsibilities"
  | "hr.manage_job_profile_risks"
  | "hr.view_job_profile_matrix"
  | "accreditation.create_service_order"
  | "accreditation.edit_service_order"
  | "accreditation.delete_service_order"
  | "accreditation.assign_crew"
  | "accreditation.remove_crew"
  | "accreditation.authorize_crew"
  | "accreditation.generate_documents"
  | "accreditation.recompute_checks"
  | "accreditation.view_compliance"
  // Billing
  | "billing.view_dashboard"
  | "billing.create_document"
  | "billing.edit_document"
  | "billing.delete_document"
  | "billing.simulate_sii"
  | "billing.register_payment"
  | "billing.send_document"
  // Reports
  | "reports.view_dashboard"
  | "reports.create_report"
  | "reports.edit_report"
  | "reports.close_report"
  | "reports.create_checkpoint"
  | "reports.edit_checkpoint"
  | "reports.add_photo"
  // Safety
  | "safety.save_checklist"
  | "safety.delete_checklist"
  | "safety.export_miper"
  | "safety.generate_risk_matrix"
  | "safety.generate_irl"
  | "safety.save_irl"
  | "safety.delete_irl"
  | "safety.save_ppe_delivery"
  | "safety.delete_ppe_delivery"
  | "safety.save_talk"
  | "safety.delete_talk"
  | "safety.seed_catalogs"
  // Document Center
  | "document_center.save_template"
  | "document_center.delete_template"
  | "document_center.generate_document"
  | "document_center.approve_document"
  | "document_center.close_document"
  | "document_center.delete_document"
  | "document_center.view_stats";

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
  "quotes.manage_catalogs": ["quotes"],
  "quote.manage_templates": ["quotes"],
  "hr.create_employee": ["hr"],
  "hr.edit_employee": ["hr"],
  "hr.delete_employee": ["hr"],
  "hr.view_contracts": ["hr"],
  "hr.manage_contracts": ["hr"],
  "hr.manage_job_profile_functions": ["hr"],
  "hr.manage_job_profile_responsibilities": ["hr"],
  "hr.manage_job_profile_risks": ["hr"],
  "hr.view_job_profile_matrix": ["hr"],
  "accreditation.create_service_order": ["accreditation"],
  "accreditation.edit_service_order": ["accreditation"],
  "accreditation.delete_service_order": ["accreditation"],
  "accreditation.assign_crew": ["accreditation"],
  "accreditation.remove_crew": ["accreditation"],
  "accreditation.authorize_crew": ["accreditation"],
  "accreditation.generate_documents": ["accreditation"],
  "accreditation.recompute_checks": ["accreditation"],
  "accreditation.view_compliance": ["accreditation"],
  // Billing
  "billing.view_dashboard": ["finance"],
  "billing.create_document": ["finance"],
  "billing.edit_document": ["finance"],
  "billing.delete_document": ["finance"],
  "billing.simulate_sii": ["finance"],
  "billing.register_payment": ["finance"],
  "billing.send_document": ["finance"],
  // Reports
  "reports.view_dashboard": ["reports"],
  "reports.create_report": ["reports"],
  "reports.edit_report": ["reports"],
  "reports.close_report": ["reports"],
  "reports.create_checkpoint": ["reports"],
  "reports.edit_checkpoint": ["reports"],
  "reports.add_photo": ["reports"],
  // Safety
  "safety.save_checklist": ["safety"],
  "safety.delete_checklist": ["safety"],
  "safety.export_miper": ["safety"],
  "safety.generate_risk_matrix": ["safety"],
  "safety.generate_irl": ["safety"],
  "safety.save_irl": ["safety"],
  "safety.delete_irl": ["safety"],
  "safety.save_ppe_delivery": ["safety"],
  "safety.delete_ppe_delivery": ["safety"],
  "safety.save_talk": ["safety"],
  "safety.delete_talk": ["safety"],
  "safety.seed_catalogs": ["safety"],
  // Document Center
  "document_center.save_template": ["document_center"],
  "document_center.delete_template": ["document_center"],
  "document_center.generate_document": ["document_center"],
  "document_center.approve_document": ["document_center"],
  "document_center.close_document": ["document_center"],
  "document_center.delete_document": ["document_center"],
  "document_center.view_stats": ["document_center"],
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
